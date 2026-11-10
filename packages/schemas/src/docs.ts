import { z } from 'zod';

/** What the user gives the app about themselves: a LaTeX resume (format and facts) and up to two more files (facts). */
export const DocFile = z.object({ name: z.string(), text: z.string() });
export type DocFile = z.infer<typeof DocFile>;

export const Docs = z.object({
  latex: z.string().default(''),
  files: z.array(DocFile).max(2).default([]),
});
export type Docs = z.infer<typeof Docs>;

export const emptyDocs = (): Docs => Docs.parse({});
