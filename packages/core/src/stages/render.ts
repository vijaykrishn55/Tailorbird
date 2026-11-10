import {
  DEFAULT_LAYOUT,
  assembleLatex,
  assembleTypst,
  fitOnePage,
  type CompileOutput,
  type Layout,
} from '@ra/latex';
import { err, ok, type Profile, type ResumeDraft, type Result } from '@ra/schemas';
import type { Deps } from '../ports';

export interface RenderOutput extends CompileOutput {
  texSource: string;
  typstSource: string;
  draft: ResumeDraft;
  layout: Layout;
  steps: string[];
}

/** Assemble, fit to one page by measuring real page counts, and compile. */
export async function renderResume(
  deps: Deps,
  profile: Profile,
  draft: ResumeDraft,
  variant?: string,
): Promise<Result<RenderOutput>> {
  const r = deps.renderer;
  if (!r) return err('unsupported', 'No renderer is available.');
  deps.emit?.({ type: 'progress', stage: 'render', message: 'Building the PDF' });
  const src = (d: ResumeDraft, l: Layout) =>
    r.kind === 'typst'
      ? assembleTypst({ profile, draft: d }, l)
      : assembleLatex({ profile, draft: d }, l, variant);
  let failure: Result<never> | undefined;
  const measure = async (d: ResumeDraft, l: Layout): Promise<number> => {
    const c = await r.compile(src(d, l), deps.signal);
    if (!c.ok) {
      failure = c;
      return 1;
    }
    return c.value.pages;
  };
  const fit = await fitOnePage(draft, measure, DEFAULT_LAYOUT);
  if (failure) return failure;
  const final = await r.compile(src(fit.draft, fit.layout), deps.signal);
  if (!final.ok) return final;
  return ok({
    ...final.value,
    texSource: assembleLatex({ profile, draft: fit.draft }, fit.layout, variant),
    typstSource: assembleTypst({ profile, draft: fit.draft }, fit.layout),
    draft: fit.draft,
    layout: fit.layout,
    steps: fit.steps,
  });
}
