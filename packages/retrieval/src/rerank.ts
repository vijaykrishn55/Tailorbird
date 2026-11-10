import { z } from 'zod';
import { ok, type JobProfile, type Result } from '@ra/schemas';
import { askJson, type Llm } from '@ra/providers';
import type { ScoredCard } from './score';

export interface Ranked {
  id: string;
  reason: string;
}

const RerankReply = z.object({
  picks: z
    .array(z.object({ id: z.string(), reason: z.string().max(240) }))
    .min(1)
    .max(6),
});

const SYSTEM = `You pick the best projects for a job. You are given the job's structured requirements and a numbered list of short project cards.
Rules: choose only ids that appear in the list; prefer projects that directly match the role and the required skills; avoid picking two projects that are near duplicates unless the job is about that topic.
Reply with JSON only: {"picks":[{"id":"<project id>","reason":"<one short sentence>"}]} in best-first order.`;

/**
 * One LLM call over the shortlist cards only (never the raw job text or full project details).
 * Falls back to the scored order if the call fails or returns unknown ids.
 */
export async function rerankTop(
  llm: Llm,
  shortlist: ScoredCard[],
  job: JobProfile,
  n = 3,
  signal?: AbortSignal,
): Promise<Result<Ranked[]>> {
  const known = new Set(shortlist.map((s) => s.card.id));
  const fallback = (): Ranked[] =>
    shortlist.slice(0, n).map((s) => ({
      id: s.card.id,
      reason: s.matched.length
        ? `Matches ${s.matched.slice(0, 4).join(', ')}.`
        : 'Best overall fit by score.',
    }));
  const cards = shortlist
    .map(
      (s) =>
        `- id: ${s.card.id} | roles: ${JSON.stringify(s.card.roles)} | tech: ${s.card.kw.join(', ')} | ${s.card.oneLine}`,
    )
    .join('\n');
  const user = `Role family: ${job.roleCode}\nMust-have: ${job.mustHave.join(', ') || '(none)'}\nNice-to-have: ${job.niceToHave.join(', ') || '(none)'}\nPick the best ${n}.\n\nProject cards:\n${cards}`;
  const res = await askJson(llm, RerankReply, SYSTEM, user, {
    tier: 'fast',
    signal,
    refine: (v) => {
      const bad = (v as z.infer<typeof RerankReply>).picks.filter((p) => !known.has(p.id)).map((p) => p.id);
      return bad.length
        ? `These ids are not in the list: ${bad.join(', ')}. Use only listed ids.`
        : undefined;
    },
  });
  if (!res.ok) return res.error.code === 'cancelled' ? res : ok(fallback());
  const seen = new Set<string>();
  const picks = res.value.picks.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, n);
  // Top up from the scored order if the model returned fewer than n.
  for (const s of shortlist) {
    if (picks.length >= n) break;
    if (!seen.has(s.card.id)) {
      seen.add(s.card.id);
      picks.push({ id: s.card.id, reason: 'Next best fit by score.' });
    }
  }
  return ok(picks);
}
