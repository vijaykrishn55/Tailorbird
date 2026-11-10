import { err, type Result } from '@ra/schemas';
import type { CompileOutput, Renderer } from '@ra/latex';

/**
 * Placeholder for a LaTeX engine (busytex). It is not bundled yet because the licences of the TeX Live
 * components still need to be reviewed. Until then the LaTeX source can be downloaded and compiled elsewhere.
 */
export const createBusytexRenderer = (): Renderer => ({
  kind: 'latex',
  async compile(): Promise<Result<CompileOutput>> {
    return err(
      'unsupported',
      'The LaTeX engine is not included in this version. Use the PDF engine, or download the .tex file.',
    );
  },
});
