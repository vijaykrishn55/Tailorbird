import type { ProjectEntry } from '@ra/schemas';
import { entryText } from './types';

const NUM = /(?<![\w.])\d[\d,]*(?:\.\d+)?/g;

/** Numbers in a text, normalised (thousands separators removed). */
export function extractNumbers(text: string): string[] {
  return (text.match(NUM) ?? []).map((n) => n.replace(/,/g, '').replace(/\.$/, ''));
}

/** Numbers that appear in the project's stored entry; a bullet may only use these. */
export function allowedNumbers(entry: ProjectEntry): Set<string> {
  return new Set(extractNumbers(entryText(entry)));
}

/** Returns the numbers in `text` that are not supported by the entry. */
export function unsupportedNumbers(text: string, entry: ProjectEntry): string[] {
  const allowed = allowedNumbers(entry);
  return [...new Set(extractNumbers(text))].filter((n) => !allowed.has(n));
}

/** Numbers in `text` that do not appear anywhere in `source` (used by the indexer against a README). */
export function numbersMissingFrom(text: string, source: string): string[] {
  const have = new Set(extractNumbers(source));
  return [...new Set(extractNumbers(text))].filter((n) => !have.has(n));
}
