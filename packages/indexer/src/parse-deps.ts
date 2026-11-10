/** Extract dependency names from common manifest files. Pure text parsing. */

export function decodeText(bytes: Uint8Array): string {
  if (
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  ) {
    return new TextDecoder(bytes[0] === 0xff ? 'utf-16le' : 'utf-16be').decode(bytes).replace(/^﻿/, '');
  }
  return new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
}

export function parseRequirements(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0]!.trim();
    if (!line || line.startsWith('-')) continue;
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line);
    if (m) out.push(m[1]!.toLowerCase());
  }
  return [...new Set(out)];
}

export function parsePackageJson(text: string): string[] {
  try {
    const j = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    return [...new Set([...Object.keys(j.dependencies ?? {}), ...Object.keys(j.devDependencies ?? {})])];
  } catch {
    return [];
  }
}

export function parsePyproject(text: string): string[] {
  const out: string[] = [];
  const dep = /dependencies\s*=\s*\[([\s\S]*?)\]/g;
  for (const m of text.matchAll(dep)) {
    for (const s of m[1]!.matchAll(/["']([A-Za-z0-9][A-Za-z0-9._-]*)/g)) out.push(s[1]!.toLowerCase());
  }
  return [...new Set(out)];
}

export function parseCargo(text: string): string[] {
  const out: string[] = [];
  let inDeps = false;
  for (const line of text.split(/\r?\n/)) {
    const h = /^\s*\[(.+)]\s*$/.exec(line);
    if (h) {
      inDeps = /dependencies$/.test(h[1]!);
      continue;
    }
    const m = inDeps ? /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line) : null;
    if (m) out.push(m[1]!);
  }
  return [...new Set(out)];
}

export function parseManifest(path: string, text: string): string[] {
  const p = path.toLowerCase();
  if (p.endsWith('package.json')) return parsePackageJson(text);
  if (p.endsWith('pyproject.toml')) return parsePyproject(text);
  if (p.endsWith('cargo.toml')) return parseCargo(text);
  if (/requirements.*\.txt$/.test(p)) return parseRequirements(text);
  return [];
}

export const MANIFEST_RE = /(^|\/)(package\.json|pyproject\.toml|Cargo\.toml|requirements[^/]*\.txt)$/i;
