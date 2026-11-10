import type { Gap, JobProfile, ResumeDraft } from '@ra/schemas';
import { canonicalSet, normalise } from '@ra/retrieval';

export interface CoverageReport {
  covered: string[];
  gaps: Gap[];
  ratio: number;
}

/** All text a recruiter will see in the draft. */
export function draftText(draft: ResumeDraft): string {
  return [
    draft.summary,
    ...draft.skills.flatMap((g) => [g.label, ...g.items]),
    ...draft.projects.flatMap((p) => [
      p.name,
      ...p.stack,
      ...p.bullets.filter((b) => b.status === 'ok').map((b) => b.text),
    ]),
  ].join('\n');
}

/**
 * Must-have terms the draft covers, and those it does not.
 * `evidence` is every term the user can honestly support (project stacks, skills). A must-have with no evidence is a real gap;
 * one with evidence that is not in the draft is a "supported but not included" hint.
 */
export function coverageReport(
  draft: ResumeDraft,
  job: JobProfile,
  evidence: Iterable<string>,
): CoverageReport {
  const have = new Set(normalise(draftText(draft)));
  const haveLower = draftText(draft).toLowerCase();
  const ev = new Set(evidence);
  const must = [...canonicalSet(job.mustHave)];
  const covered: string[] = [];
  const gaps: Gap[] = [];
  for (const t of must) {
    if (have.has(t) || haveLower.includes(t.toLowerCase())) covered.push(t);
    else gaps.push({ term: t, reason: ev.has(t) ? 'supported_not_included' : 'no_evidence' });
  }
  return { covered, gaps, ratio: must.length === 0 ? 1 : covered.length / must.length };
}
