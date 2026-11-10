import type { Profile, ResumeDraft, Result } from '@ra/schemas';

export interface ResumeInput {
  profile: Profile;
  draft: ResumeDraft;
}

/** Layout knobs the one-page fitter may change. */
export interface Layout {
  fontPt: number;
  lineSpacing: number;
  marginMm: number;
  sectionGapPt: number;
}

export const DEFAULT_LAYOUT: Layout = { fontPt: 10, lineSpacing: 1.0, marginMm: 14, sectionGapPt: 7 };

export interface CompileOutput {
  pdf: Uint8Array;
  pages: number;
  log?: string;
}

/** A compiler turns resume source into a PDF. Typst is the default; busytex (LaTeX) is an optional adapter. */
export interface Renderer {
  readonly kind: 'typst' | 'latex';
  compile(source: string, signal?: AbortSignal): Promise<Result<CompileOutput>>;
}

export const DEFAULT_ORDER = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'];

/** The user's own section order first, then any sections they did not have, in the default order. */
export function sectionOrder(preferred?: string[]): string[] {
  const first = (preferred ?? []).filter((k) => DEFAULT_ORDER.includes(k));
  return [...new Set([...first, ...DEFAULT_ORDER])];
}
