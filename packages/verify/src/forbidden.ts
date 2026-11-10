import type { ProjectEntry } from '@ra/schemas';
import { canonicalSet, normalise } from '@ra/retrieval';
import { entryText } from './types';

/** Phrases that imply real-world scale or business impact. Only allowed when the project's own text says so. */
const OVERCLAIM: { re: RegExp; label: string }[] = [
  { re: /\b(?:in|to|into)\s+production\b/i, label: 'production use' },
  { re: /\b(?:real|paying|active|daily)\s+users\b|\b\d[\d,]*\+?\s+users\b/i, label: 'user counts' },
  { re: /\bcustomers?\b/i, label: 'customers' },
  { re: /\brevenue\b|\bsaved\s+\$/i, label: 'revenue or savings' },
  { re: /\b(?:led|managed)\s+(?:a\s+)?team\b/i, label: 'team leadership' },
  { re: /\bdeployed\b/i, label: 'deployment' },
];

/** Terms and quoted phrases that the project's doNotClaim list rules out. */
export function forbiddenTerms(entry: ProjectEntry): { terms: Set<string>; quoted: string[] } {
  const own = canonicalSet(entry.stackVerified);
  const terms = new Set<string>();
  const quoted: string[] = [];
  for (const line of entry.doNotClaim) {
    for (const t of normalise(line)) if (!own.has(t)) terms.add(t);
    for (const m of line.matchAll(/["'“‘]([^"'”’]{3,})["'”’]/g)) quoted.push(m[1]!.trim());
  }
  return { terms, quoted };
}

/** Returns human-readable reasons why `text` breaks the project's do-not-claim rules. */
export function forbiddenHits(text: string, entry: ProjectEntry): string[] {
  const hits: string[] = [];
  const { terms, quoted } = forbiddenTerms(entry);
  for (const t of normalise(text))
    if (terms.has(t)) hits.push(`mentions ${t}, which this project must not claim`);
  const lower = text.toLowerCase();
  for (const q of quoted) if (lower.includes(q.toLowerCase())) hits.push(`uses the forbidden phrase "${q}"`);
  const own = entryText(entry);
  for (const { re, label } of OVERCLAIM) {
    if (re.test(text) && !re.test(own)) hits.push(`implies ${label}, which the project does not state`);
  }
  return hits;
}
