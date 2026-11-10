import { sha256Hex } from '@ra/providers';
import type { Fingerprint } from '@ra/schemas';

export async function fingerprint(repo: string, file: string, content: string): Promise<Fingerprint> {
  return { repo, file, sha256_12: (await sha256Hex(content)).slice(0, 12) };
}

/** Repos whose fingerprints changed, appeared or disappeared. */
export function diffFingerprints(
  before: Fingerprint[],
  after: Fingerprint[],
): { changed: string[]; added: string[]; removed: string[] } {
  const key = (f: Fingerprint) => `${f.repo}::${f.file}`;
  const b = new Map(before.map((f) => [key(f), f.sha256_12]));
  const a = new Map(after.map((f) => [key(f), f.sha256_12]));
  const repos = (keys: string[]) => [...new Set(keys.map((k) => k.split('::')[0]!))];
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [k, v] of a) {
    if (!b.has(k)) added.push(k);
    else if (b.get(k) !== v) changed.push(k);
  }
  for (const k of b.keys()) if (!a.has(k)) removed.push(k);
  return { changed: repos(changed), added: repos(added), removed: repos(removed) };
}
