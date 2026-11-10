import type { ProjectEntry } from '@ra/schemas';
import { canonicalSet, normalise } from '@ra/retrieval';
import { entryText } from './types';

/** Technologies the project is allowed to mention: its verified stack plus terms in its own stored text. */
export function allowedTerms(entry: ProjectEntry): Set<string> {
  const out = canonicalSet(entry.stackVerified);
  for (const t of normalise(entryText(entry))) out.add(t);
  return out;
}

/** Known technologies in `text` that the project is not allowed to mention. */
export function unsupportedTerms(
  text: string,
  entry: ProjectEntry,
  extraAllowed: Iterable<string> = [],
): string[] {
  const allowed = allowedTerms(entry);
  for (const t of extraAllowed) allowed.add(t);
  return normalise(text).filter((t) => !allowed.has(t));
}
