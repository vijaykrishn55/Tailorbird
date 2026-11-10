import type { Bullet, ProjectEntry } from '@ra/schemas';
import { forbiddenHits } from './forbidden';
import { lengthProblem } from './length';
import { latexProblem } from './latex-safe';
import { unsupportedNumbers } from './numbers';
import { unsupportedTerms } from './tech-terms';
import type { CheckContext, Failure } from './types';

/** Checks for one bullet against its project entry. Returns every failure with an exact message. */
export function checkBullet(bullet: Pick<Bullet, 'id' | 'text'>, entry: ProjectEntry): Failure[] {
  const out: Failure[] = [];
  const add = (check: Failure['check'], message: string) =>
    out.push({ bulletId: bullet.id, projectId: entry.id, check, message });
  const nums = unsupportedNumbers(bullet.text, entry);
  if (nums.length > 0)
    add(
      'numbers',
      `uses the number ${nums.join(', ')}, which is not in this project's facts. Remove it or use only numbers from the facts`,
    );
  const terms = unsupportedTerms(bullet.text, entry);
  if (terms.length > 0)
    add('tech', `mentions ${terms.join(', ')}, which is not in this project's verified stack`);
  for (const h of forbiddenHits(bullet.text, entry)) add('forbidden', h);
  const len = lengthProblem(bullet.text);
  if (len) add('length', len);
  const tex = latexProblem(bullet.text);
  if (tex) add('latex', tex);
  return out;
}

export interface DraftLike {
  projects: { id: string; bullets: Pick<Bullet, 'id' | 'text'>[] }[];
}

/** Run every check over every bullet of a draft. */
export function runChecks(draft: DraftLike, ctx: CheckContext): Failure[] {
  const out: Failure[] = [];
  for (const p of draft.projects) {
    const entry = ctx.entries.get(p.id);
    if (!entry) {
      for (const b of p.bullets)
        out.push({
          bulletId: b.id,
          projectId: p.id,
          check: 'forbidden',
          message: 'refers to a project that is not in the project bank',
        });
      continue;
    }
    for (const b of p.bullets) out.push(...checkBullet(b, entry));
  }
  return out;
}
