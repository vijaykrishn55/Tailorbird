import type { ResumeDraft } from '@ra/schemas';
import { DEFAULT_LAYOUT, type Layout } from './types';

export interface FitResult<S> {
  source: S;
  layout: Layout;
  draft: ResumeDraft;
  pages: number;
  steps: string[];
}

/**
 * Make the resume fit one page. Order of changes: tighten spacing, then reduce margin, then drop the
 * lowest-ranked project's last bullet, one at a time. Never changes the wording of a bullet.
 * `measure` returns the page count for a draft and layout.
 */
export async function fitOnePage(
  draft: ResumeDraft,
  measure: (d: ResumeDraft, l: Layout) => Promise<number>,
  start: Layout = DEFAULT_LAYOUT,
): Promise<FitResult<undefined>> {
  const d = structuredClone(draft);
  let l = { ...start };
  const steps: string[] = [];
  let pages = await measure(d, l);
  const tighten: [string, (x: Layout) => Layout][] = [
    ['tighter line spacing', (x) => ({ ...x, lineSpacing: Math.max(0.92, x.lineSpacing - 0.04) })],
    ['smaller section gaps', (x) => ({ ...x, sectionGapPt: Math.max(3, x.sectionGapPt - 2) })],
    ['narrower margins', (x) => ({ ...x, marginMm: Math.max(10, x.marginMm - 2) })],
    ['slightly smaller text', (x) => ({ ...x, fontPt: Math.max(9, x.fontPt - 0.5) })],
  ];
  for (let guard = 0; pages > 1 && guard < 12; guard++) {
    const [name, fn] = tighten[guard % tighten.length]!;
    const next = fn(l);
    if (JSON.stringify(next) === JSON.stringify(l) && guard >= tighten.length) break;
    if (JSON.stringify(next) !== JSON.stringify(l)) {
      l = next;
      steps.push(name);
      pages = await measure(d, l);
    }
  }
  while (pages > 1) {
    const idx = [...d.projects.keys()]
      .reverse()
      .find((i) => d.projects[i]!.bullets.filter((b) => b.status === 'ok').length > 1);
    if (idx === undefined) {
      // Projects are down to one bullet each: trim the oldest job's longest list instead.
      const ex = d.experience
        ? [...d.experience.keys()].reverse().find((i) => d.experience![i]!.bullets.length > 1)
        : undefined;
      if (ex === undefined) break;
      d.experience![ex]!.bullets.pop();
      steps.push(`dropped a bullet from ${d.experience![ex]!.org}`);
      pages = await measure(d, l);
      continue;
    }
    const p = d.projects[idx]!;
    const lastOk = [...p.bullets.keys()].reverse().find((i) => p.bullets[i]!.status === 'ok')!;
    const removed = p.bullets.splice(lastOk, 1)[0]!;
    steps.push(`dropped a bullet from ${p.name}`);
    void removed;
    pages = await measure(d, l);
  }
  return { source: undefined, layout: l, draft: d, pages, steps };
}
