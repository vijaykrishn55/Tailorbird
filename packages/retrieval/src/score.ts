import type { JobProfile, RepoCard } from '@ra/schemas';
import { bm25Rank } from './bm25';
import { canonicalSet } from './keyword-dict';

export const GRADE_POINTS: Record<RepoCard['grade'], number> = { A: 10, B: 7, C: 4, D: 2 };

export interface ScoredCard {
  card: RepoCard;
  score: number;
  roleFit: number;
  overlap: number;
  matched: string[];
}

/** Terms the job wants, canonicalised: must-haves first, then nice-to-haves. */
export function jobTerms(job: JobProfile): { must: Set<string>; nice: Set<string> } {
  return { must: canonicalSet(job.mustHave), nice: canonicalSet(job.niceToHave) };
}

/**
 * score = 0.50 * role fit + 0.35 * keyword overlap + 0.15 * evidence grade (all on a 0-10 scale);
 * ties are broken by the most recent push. A small BM25 bonus (max 0.5) breaks near-ties on wording.
 */
export function scoreCards(cards: RepoCard[], job: JobProfile): ScoredCard[] {
  const { must, nice } = jobTerms(job);
  const wanted = new Set([...must, ...nice]);
  const hits = new Map(bm25Rank(cards, [...wanted, ...job.phrases]).map((h) => [h.id, h.score]));
  const top = Math.max(1, ...hits.values());
  const scored = cards.map((card): ScoredCard => {
    const kw = canonicalSet(card.kw);
    const matched = [...wanted].filter((t) => kw.has(t));
    const mustMatched = [...must].filter((t) => kw.has(t)).length;
    const niceMatched = [...nice].filter((t) => kw.has(t)).length;
    const denom = must.size * 1 + nice.size * 0.5;
    const overlap = denom === 0 ? 0 : ((mustMatched + niceMatched * 0.5) / denom) * 10;
    const roleFit = card.roles[job.roleCode] ?? 0;
    const bonus = ((hits.get(card.id) ?? 0) / top) * 0.5;
    const score = 0.5 * roleFit + 0.35 * overlap + 0.15 * GRADE_POINTS[card.grade] + bonus;
    return { card, score, roleFit, overlap, matched };
  });
  return scored.sort((a, b) => b.score - a.score || b.card.pushed.localeCompare(a.card.pushed));
}
