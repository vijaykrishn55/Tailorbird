import { numbersMissingFrom } from '@ra/verify';
import type { ProjectEntry } from '@ra/schemas';

/** Numbers in a drafted entry that do not appear in the source text it was drafted from. */
export function unsupportedInEntry(entry: ProjectEntry, source: string): string[] {
  const text = [
    entry.summary,
    ...entry.metrics.map((m) => m.value),
    ...entry.bullets.map((b) => b.text),
  ].join('\n');
  return numbersMissingFrom(text, source);
}
