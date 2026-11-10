import { z } from 'zod';
import { askJson } from '@ra/providers';
import { canonical, normalise } from '@ra/retrieval';
import { ROLE_CODES, ROLE_LABELS, err, ok, type JobProfile, type Result } from '@ra/schemas';
import { UNTRUSTED_NOTE, sanitizeJobText, wrapUntrusted } from '../sanitize';
import type { Deps } from '../ports';

const Reply = z.object({
  title: z.string().max(200).default(''),
  company: z.string().max(200).optional(),
  roleCode: z.enum(ROLE_CODES),
  mustHave: z.array(z.string().max(80)).max(40).default([]),
  niceToHave: z.array(z.string().max(80)).max(40).default([]),
  phrases: z.array(z.string().max(120)).max(40).default([]),
});

const SYSTEM = `You extract structured requirements from a job posting. ${UNTRUSTED_NOTE}
roleCode must be one of: ${ROLE_CODES.map((c) => `${c} (${ROLE_LABELS[c]})`).join('; ')}.
mustHave: skills the posting requires. niceToHave: skills it prefers or mentions as a plus. phrases: short exact phrases from the posting worth echoing.
Every item must appear in the posting text. Reply with JSON only: {"title","company","roleCode","mustHave","niceToHave","phrases"}.`;

const hasIn = (text: string, item: string) => text.toLowerCase().includes(item.toLowerCase());

/** Dictionary pass first, LLM fills in the rest; items not found in the text are discarded. */
export async function analyzeJob(deps: Deps, raw: string): Promise<Result<JobProfile>> {
  const { text } = sanitizeJobText(raw);
  if (text.length < 40)
    return err('validation', 'The job text is too short to analyse. Paste the full description.');
  deps.emit?.({ type: 'progress', stage: 'analyse', message: 'Reading the job description' });
  const found = [...new Set(normalise(text))];
  const res = await askJson(
    deps.llm,
    Reply,
    SYSTEM,
    `Terms already detected: ${found.join(', ') || '(none)'}\n\n${wrapUntrusted(text)}`,
    { tier: 'fast', signal: deps.signal },
  );
  if (!res.ok) return res;
  const keep = (xs: string[]) => [
    ...new Set(
      xs
        .map((x) => x.trim())
        .filter((x) => x && hasIn(text, x))
        .map(canonical),
    ),
  ];
  const llmMust = keep(res.value.mustHave);
  const mustHave = llmMust;
  const nice = keep(res.value.niceToHave).filter((t) => !mustHave.includes(t));
  // Dictionary terms the model missed are added as nice-to-have so nothing found in the text is lost.
  for (const t of found) if (!mustHave.includes(t) && !nice.includes(t)) nice.push(t);
  return ok({
    title: res.value.title,
    company: res.value.company,
    roleCode: res.value.roleCode,
    mustHave,
    niceToHave: nice.slice(0, 40),
    phrases: res.value.phrases.filter((p) => hasIn(text, p)).slice(0, 40),
  });
}
