import { escapeLatex } from '@ra/verify';
import type { Layout, ResumeInput } from './types';
import { DEFAULT_LAYOUT, sectionOrder } from './types';

const e = escapeLatex;
const safeUrl = (u: string) => /^https?:\/\//i.test(u) || /^mailto:/i.test(u);
const urlArg = (u: string) => u.replace(/[{}\\%#^~]/g, '');

/** Parse a user's LaTeX variant: slots are lines `% SLOT:summary`, `% SLOT:projects`, etc. */
export function findSlots(tex: string): string[] {
  return [...tex.matchAll(/^%\s*SLOT:(\w+)\s*$/gm)].map((m) => m[1]!);
}

function sections(input: ResumeInput): Record<string, string> {
  const { profile, draft } = input;
  const s: Record<string, string> = {};
  s.summary = draft.summary ? `\\section*{Summary}\n${e(draft.summary)}\n` : '';
  s.skills = draft.skills.length
    ? `\\section*{Skills}\n${draft.skills.map((g) => `\\textbf{${e(g.label)}:} ${e(g.items.join(', '))}\\\\`).join('\n')}\n`
    : '';
  s.projects = draft.projects.length
    ? `\\section*{Projects}\n${draft.projects
        .map((p) => {
          const bullets = p.bullets.filter((b) => b.status === 'ok');
          return `\\textbf{${e(p.name)}}\\hfill ${e(p.year)}\n${bullets.length ? `\\begin{itemize}\n${bullets.map((b) => `\\item ${e(b.text)}`).join('\n')}\n\\end{itemize}` : ''}${p.stack.length ? `\n{\\footnotesize\\emph{Stack: ${e(p.stack.join(', '))}}}\\\\` : ''}`;
        })
        .join('\n')}\n`
    : '';
  s.experience = (draft.experience ?? profile.experience).length
    ? `\\section*{Experience}\n${(draft.experience ?? profile.experience)
        .map(
          (x) =>
            `\\textbf{${e(x.title)}}, ${e(x.org)}\\hfill ${e(x.dates)}\n${x.bullets.length ? `\\begin{itemize}\n${x.bullets.map((b) => `\\item ${e(b)}`).join('\n')}\n\\end{itemize}` : ''}`,
        )
        .join('\n')}\n`
    : '';
  s.education = profile.education.length
    ? `\\section*{Education}\n${profile.education.map((x) => `\\textbf{${e(x.school)}} ${e(x.degree)}${x.detail ? `, ${e(x.detail)}` : ''}\\hfill ${e(x.dates)}\\\\`).join('\n')}\n`
    : '';
  const certs = draft.certifications ?? profile.certifications;
  s.certifications = certs.length
    ? `\\section*{Certifications}\n\\begin{itemize}\n${certs.map((c) => `\\item ${e(c)}`).join('\n')}\n\\end{itemize}\n`
    : '';
  const contact = [
    profile.email && `\\href{mailto:${urlArg(profile.email)}}{${e(profile.email)}}`,
    profile.phone && e(profile.phone),
    ...profile.links.filter((l) => safeUrl(l.url)).map((l) => `\\href{${urlArg(l.url)}}{${e(l.label)}}`),
  ].filter(Boolean);
  s.header = `\\begin{center}\n{\\Large\\textbf{${e(profile.name || 'Your Name')}}}\\\\\n${profile.headline ? `${e(profile.headline)}\\\\\n` : ''}${contact.join(' $|$ ')}\n\\end{center}\n`;
  return s;
}

/** Fill a user's variant (slots) or the built-in template with generated content. Generated text is always escaped. */
export function assembleLatex(input: ResumeInput, layout: Layout = DEFAULT_LAYOUT, variant?: string): string {
  const parts = sections(input);
  if (variant && findSlots(variant).length > 0) {
    return variant.replace(/^%\s*SLOT:(\w+)\s*$/gm, (_m, name: string) => parts[name] ?? '');
  }
  const margin = `${layout.marginMm}mm`;
  return `\\documentclass[${Math.round(layout.fontPt)}pt,a4paper]{article}
\\usepackage[margin=${margin}]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\setlist[itemize]{leftmargin=1.2em,itemsep=0pt,topsep=2pt,parsep=0pt}
\\titleformat{\\section}{\\bfseries\\uppercase}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{${layout.sectionGapPt}pt}{3pt}
\\linespread{${layout.lineSpacing.toFixed(2)}}
\\pagestyle{empty}
\\begin{document}
${parts.header}${sectionOrder(input.draft.order)
    .map((k) => parts[k] ?? '')
    .join('')}\\end{document}
`;
}
