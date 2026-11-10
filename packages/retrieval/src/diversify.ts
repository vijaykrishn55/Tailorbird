import type { JobProfile } from '@ra/schemas';
import type { ScoredCard } from './score';

/**
 * Pick `n` projects, at most one per overlap group, unless the job is specifically about that topic
 * (a group counts as on-topic when the job's role-fit for the card is 9 or more and several terms match).
 * If groups run out, the best remaining cards fill the list.
 */
export function pickDiverse(ranked: ScoredCard[], n: number, _job?: JobProfile): ScoredCard[] {
  const out: ScoredCard[] = [];
  const used = new Set<string>();
  for (const s of ranked) {
    if (out.length >= n) break;
    const onTopic = s.roleFit >= 9 && s.matched.length >= 3;
    if (used.has(s.card.group) && !onTopic) continue;
    out.push(s);
    used.add(s.card.group);
  }
  for (const s of ranked) {
    if (out.length >= n) break;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}
