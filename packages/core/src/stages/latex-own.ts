import { escapeLatex } from '@ra/verify';
import type { Profile, ResumeDraft } from '@ra/schemas';
import { sectionOrder } from '@ra/latex';

type Kind = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications';
const KINDS: [Kind, RegExp][] = [
  ['skills', /skill|technolog/i],
  ['experience', /experience|employment|work/i],
  ['projects', /project/i],
  ['education', /education|academic/i],
  ['certifications', /certif|licen|award|achiev/i],
];
const HEAD = /\\(?:\w*section\w*)\*?\s*\{([^}]*)\}/g;

/** Does the preamble define this macro, and with how many arguments? */
function macroArgs(tex: string, name: string): number | undefined {
  const m = new RegExp(`\\\\(?:re)?newcommand\\{\\\\${name}\\}\\[(\\d)\\]`).exec(tex);
  return m ? Number(m[1]) : undefined;
}

/** Keep the opening commands of the person's summary block (font, colour) and swap only its words. */
function swapSummary(block: string, summary: string): string {
  const open = block.search(/\{\s*(?:\\[A-Za-z]+(?:\{[^{}]*\})?\s*)+/);
  const text = escapeLatex(summary);
  if (open < 0) return `${block.trimEnd()}\n{${text}}\n\n`;
  const lead = /^\{\s*(?:\\[A-Za-z]+\*?(?:\{[^{}]*\})?\s*)+/.exec(block.slice(open))![0];
  return `${block.slice(0, open)}${lead}${text}}\n\n`;
}

/**
 * Build the .tex from the person's own LaTeX without any model: their preamble, header and macros stay as written, the
 * summary, skills, experience and projects are filled with the tailored content, and sections that do not change per job
 * (education, certifications) are copied through untouched. Returns undefined when the document does not use macros this can fill.
 */
export function assembleOwnLatex(
  tex: string,
  profile: Profile,
  draft: ResumeDraft,
  opts: { smallerText?: boolean } = {},
): string | undefined {
  const begin = tex.indexOf('\\begin{document}');
  const end = tex.lastIndexOf('\\end{document}');
  if (begin < 0 || end < 0) return undefined;
  const job = macroArgs(tex, 'jobHeader');
  const proj = macroArgs(tex, 'projectHeader');
  const item = macroArgs(tex, 'resumeItem');
  const stack = macroArgs(tex, 'techstack');
  if (job !== 3 || proj !== 4 || item !== 1 || stack !== 1) return undefined;
  const bodyStart = begin + '\\begin{document}'.length;
  const body = tex.slice(bodyStart, end);
  const heads = [...body.matchAll(HEAD)];
  if (heads.length === 0) return undefined;
  const e = escapeLatex;
  const items = (xs: string[]) =>
    xs.length
      ? `\\begin{itemize}\n${xs.map((x) => `  \\resumeItem{${e(x)}}`).join('\n')}\n\\end{itemize}\n`
      : '';
  const exp = draft.experience ?? profile.experience;
  const make: Record<string, () => string> = {
    skills: () => {
      const tab = /\\begin\{tabular\}(\{[^\n]*\})\s*\n/.exec(body);
      if (tab && draft.skills.length)
        return `\\vspace{2pt}\n\\begin{tabular}${tab[1]}\n${draft.skills
          .map((g) => `  ${e(g.label)} & ${g.items.map(e).join(', ')}`)
          .join(' \\\\[2pt]\n')} \\\\\n\\end{tabular}\n\n`;
      return `\\vspace{2pt}\n${draft.skills.map((g) => `\\textbf{${e(g.label)}:} ${g.items.map(e).join(', ')}\\\\`).join('\n')}\n\n`;
    },
    experience: () =>
      exp
        .map(
          (x) =>
            `\\vspace{2pt}\n\\jobHeader{${e(x.title)}}{${e(x.dates)}}{${[e(x.org), e(x.location)].filter(Boolean).join(' \\ $\\cdot$ \\ ')}}\n${items(x.bullets)}`,
        )
        .join('\n') + '\n',
    projects: () =>
      draft.projects
        .map(
          (p) =>
            `\\vspace{2pt}\n\\projectHeader{${e(p.name)}}{${p.url}}{GitHub}{${e(p.year)}}\n${items(
              p.bullets.filter((b) => b.status === 'ok').map((b) => b.text),
            )}${p.stack.length ? `\\techstack{${p.stack.map(e).join(', ')}}\n` : ''}`,
        )
        .join('\n') + '\n',
  };
  // The header, plus any summary block between the header and the first section, stays the person's own.
  const first = heads[0]!;
  const intro = body.slice(0, first.index!);
  const centreEnd = intro.lastIndexOf('\\end{center}');
  const pre = centreEnd >= 0 ? intro.slice(0, centreEnd + '\\end{center}'.length) : '';
  const summaryBlock = centreEnd >= 0 ? intro.slice(centreEnd + '\\end{center}'.length) : intro;
  let out = tex.slice(0, bodyStart) + pre + '\n';
  const hasSummarySection = heads.some((h) => /summary|profile|objective/i.test(h[1]!));
  if (!hasSummarySection && draft.summary)
    out += swapSummary(summaryBlock.replace(/%[^\n]*\n/g, '\n'), draft.summary);
  else out += summaryBlock;
  void sectionOrder;
  heads.forEach((h, i) => {
    const stop = heads[i + 1]?.index ?? body.length;
    const raw = body.slice(h.index!, stop);
    const kind = KINDS.find(([, re]) => re.test(h[1]!))?.[0];
    const headLine = raw.slice(0, raw.indexOf('}', h.index! - h.index!) + 1);
    if (kind && make[kind] && (kind !== 'projects' || draft.projects.length)) {
      out += `${headLine}\n\n${make[kind]()}`;
    } else out += raw;
  });
  const text = `${out.trimEnd()}\n\n${tex.slice(end)}`;
  // Only when the page measure showed two pages and smaller text was needed: one step down in the class size.
  return opts.smallerText ? text.replace(/\\documentclass\[10pt/, '\\documentclass[9pt') : text;
}
