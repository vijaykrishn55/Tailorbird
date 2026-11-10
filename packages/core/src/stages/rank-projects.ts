import { pickDiverse, rerankTop, scoreCards, type Ranked } from '@ra/retrieval';
import { err, ok, type JobProfile, type MetaFile, type Result } from '@ra/schemas';
import type { Deps } from '../ports';

/** Score all cards, shortlist with diversity, and let one LLM call choose among the shortlist. */
export async function rankProjects(
  deps: Deps,
  meta: MetaFile,
  job: JobProfile,
  n = 3,
): Promise<Result<Ranked[]>> {
  if (meta.index.filter((c) => !c.excluded).length === 0)
    return err('not_found', 'No projects are indexed yet. Add your GitHub username or import a meta file.');
  deps.emit?.({ type: 'progress', stage: 'rank', message: 'Ranking projects' });
  const scored = scoreCards(
    meta.index.filter((c) => !c.excluded),
    job,
  );
  const shortlist = pickDiverse(scored, Math.min(8, scored.length), job);
  const res = await rerankTop(deps.llm, shortlist, job, Math.min(n, shortlist.length), deps.signal);
  if (res.ok) deps.emit?.({ type: 'partial', stage: 'rank', data: res.value });
  return res.ok ? ok(res.value) : res;
}
