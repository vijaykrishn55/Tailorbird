/** Turn a README into plain text and pull a one-line summary from it. Pure text handling, no model. */
export function readmeToPlain(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*_=]{3,}\s*$/gm, ' ')
    .replace(/[*_`>#|]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** First real paragraph of the README (skipping the title, badges and tables of contents). */
export function firstParagraph(md: string, max = 300): string {
  const paras = readmeToPlain(md)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 40 && !/^(table of contents|contents|license|installation)/i.test(p));
  const p = paras[0] ?? '';
  return p.length > max ? p.slice(0, max).replace(/\s+\S*$/, '') + '…' : p;
}

/** A trimmed excerpt used as the project's facts. Keeps the start of the README, where the substance usually is. */
export function readmeExcerpt(md: string, max = 2500): string {
  const plain = readmeToPlain(md)
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ');
  return plain.length > max ? plain.slice(0, max) : plain;
}
