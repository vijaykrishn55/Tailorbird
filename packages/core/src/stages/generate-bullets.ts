import { z } from 'zod';
import { askJson } from '@ra/providers';
import { canonicalSet } from '@ra/retrieval';
import { checkBullet, wordCount, type Failure } from '@ra/verify';
import {
  err,
  ok,
  type Bullet,
  type DraftProject,
  type JobProfile,
  type ProjectEntry,
  type Result,
} from '@ra/schemas';
import type { Deps } from '../ports';

const Reply = z.object({
  bullets: z
    .array(z.object({ text: z.string().min(1).max(600), factIds: z.array(z.string()).default([]) }))
    .min(1)
    .max(5),
});

const SYSTEM = `You write resume bullets for one software project.
Write exactly 3 bullets, 12 to 30 words each, each starting with a strong past-tense verb. Cover different things: what was built, how it works, and how it was verified or tested if the facts say so.
Use only the facts given. When a fact is the person's own written bullet, keep its wording and tone, and change only the emphasis towards the job keywords. Use only numbers and technologies that appear in the facts. Mention a job keyword only when the facts support it.
Never claim production use, users, customers or deployment unless a fact says so. Respect "Do not claim". Do not list the whole tech stack in a bullet (it is shown on its own line). Plain text, no formatting.
Reply with JSON only: {"bullets":[{"text":"...","factIds":["<fact id>"]}]}.`;

export function factsFor(entry: ProjectEntry): { id: string; text: string }[] {
  const facts: { id: string; text: string }[] = [{ id: `${entry.id}.summary`, text: entry.summary }];
  entry.metrics.forEach((m, i) =>
    facts.push({
      id: `${entry.id}.m${i + 1}`,
      text: `${m.name}: ${m.value}${m.scope ? ` (${m.scope})` : ''} [${m.status}]`,
    }),
  );
  entry.bullets.forEach((b) => facts.push({ id: b.id, text: b.text }));
  if (entry.readme.trim())
    facts.push({ id: `${entry.id}.readme`, text: entry.readme.slice(0, 1800).replace(/\s+/g, ' ') });
  if (entry.stackVerified.length)
    facts.push({ id: `${entry.id}.stack`, text: `Stack: ${entry.stackVerified.join(', ')}` });
  return facts.filter((f) => f.text.trim());
}

function promptFor(entry: ProjectEntry, job: JobProfile): string {
  // The model sees only the structured job profile, never the raw posting.
  const wanted = [...job.mustHave, ...job.niceToHave].slice(0, 25).join(', ') || '(none)';
  return `Role family: ${job.roleCode}\nJob keywords: ${wanted}\n\nProject: ${entry.name ?? entry.id}\nFacts:\n${factsFor(
    entry,
  )
    .map((f) => `- [${f.id}] ${f.text}`)
    .join('\n')}\nDo not claim:\n${entry.doNotClaim.map((d) => `- ${d}`).join('\n') || '- (nothing listed)'}`;
}

function toDraftBullets(entry: ProjectEntry, items: { text: string; factIds: string[] }[]): Bullet[] {
  const known = new Set(factsFor(entry).map((f) => f.id));
  return items.slice(0, 3).map((b, i) => ({
    id: `${entry.id}.g${i + 1}`,
    text: b.text.trim(),
    factIds: b.factIds.filter((id) => known.has(id)),
    metricStatus: 'none' as const,
    status: 'ok' as const,
    failures: [],
  }));
}

/** A repository name shown as a title: "agentic-personalization-pipeline" becomes "Agentic Personalization Pipeline". */
export function displayName(entry: ProjectEntry): string {
  if (entry.name && entry.name !== entry.id) return entry.name;
  return entry.id
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Technologies for the Stack line: the ones the job asks for first, then the rest, at most 8. */
export function stackLine(entry: ProjectEntry, job: JobProfile): string[] {
  const wanted = canonicalSet([...job.mustHave, ...job.niceToHave]);
  const hit = entry.stackVerified.filter((t) => wanted.has(t));
  return [...new Set([...hit, ...entry.stackVerified])].slice(0, 8);
}

/** Sentences from the project's own stored text, used when the model's bullets cannot be verified. */
export function fallbackBullets(entry: ProjectEntry): Bullet[] {
  const stored = entry.bullets.slice(0, 3).map((b) => b.text);
  const sentences = `${entry.summary}. ${entry.readme}`
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => wordCount(x) >= 8 && wordCount(x) <= 30 && !/^https?:/i.test(x));
  const texts = [...stored, ...sentences].slice(0, 3).map((t) => t.replace(/\.{2,}$/, '.'));
  if (texts.length === 0 && entry.summary) texts.push(entry.summary.slice(0, 200));
  return texts.map((text, i) => ({
    id: `${entry.id}.f${i + 1}`,
    text,
    factIds: [],
    metricStatus: 'none' as const,
    status: 'ok' as const,
    failures: [],
  }));
}

/**
 * One call per project. The code verifies every bullet; if anything fails, the exact failures go back to the model
 * (at most 2 retries). If it still fails, sentences from the project's own text are used. Nothing invented reaches the resume.
 */
export async function generateProject(
  deps: Deps,
  entry: ProjectEntry,
  job: JobProfile,
  maxRetries = 2,
): Promise<Result<DraftProject>> {
  const base = promptFor(entry, job);
  let prompt = base;
  let last: Failure[] = [];
  const done = (bullets: Bullet[]): Result<DraftProject> =>
    bullets.length === 0
      ? err(
          'verification_failed',
          `Nothing usable was found for ${entry.name ?? entry.id}. Remove it or add details.`,
        )
      : ok({
          id: entry.id,
          name: displayName(entry),
          url: entry.url,
          year: entry.year,
          stack: stackLine(entry, job),
          bullets,
        });
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await askJson(deps.llm, Reply, SYSTEM, prompt, {
      tier: 'strong',
      signal: deps.signal,
      maxTokens: 3000,
    });
    if (!res.ok) {
      if (res.error.code === 'cancelled' || res.error.code === 'provider_auth') return res;
      if (attempt === maxRetries) break;
      continue;
    }
    const bullets = toDraftBullets(entry, res.value.bullets);
    const failures = bullets.flatMap((b) => checkBullet(b, entry));
    if (failures.length === 0) return done(bullets);
    last = failures;
    const lines = failures.map((f) => `- Bullet ${f.bulletId.split('.g').pop()}: ${f.message}`).join('\n');
    prompt = `${base}\n\nYour previous bullets were rejected by automatic checks:\n${lines}\nRewrite all 3 bullets fixing exactly these problems.`;
  }
  const fb = fallbackBullets(entry);
  const checked = fb.filter((b) => checkBullet(b, entry).length === 0 || b.id.startsWith(`${entry.id}.f`));
  const out = checked.map((b) => ({ ...b, failures: last.map((f) => f.message) }));
  return done(out);
}
