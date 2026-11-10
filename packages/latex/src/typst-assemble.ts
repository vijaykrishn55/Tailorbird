import type { ResumeInput, Layout } from './types';
import { DEFAULT_LAYOUT, sectionOrder } from './types';

/** Escape text for Typst markup: every character with meaning in markup mode gets a backslash. */
export function escapeTypst(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    .replace(/[\\#$*_`<>@[\]~/=\-+0-9]/g, (c) => (/[0-9]/.test(c) ? c : `\\${c}`))
    .replace(/\n+/g, ' ');
}

/** Escaped text for markup mode. */
const m = escapeTypst;
/** Content block for code mode, e.g. inside function arguments. */
const c = (s: string) => `[${escapeTypst(s)}]`;
const safeUrl = (u: string) => /^https?:\/\//i.test(u) || /^mailto:/i.test(u);
const q = (u: string) => `"${u.replace(/["\\]/g, '')}"`;
/** A link usable in markup mode (with leading #). */
const link = (url: string, label: string) =>
  safeUrl(url) ? `#text(fill: rgb(30, 100, 180))[#link(${q(url)})${c(label)}]` : m(label);
const short = (u: string) => u.replace(/^(https?:\/\/(www\.)?|mailto:)/i, '').replace(/\/$/, '');
const bold = (s: string) => `#text(weight: "bold")${c(s)}`;
const row = (left: string, right: string) => `#grid(columns: (1fr, auto), [${left}], [${right}])`;

/** Build the Typst source for the default one-page resume. */
export function assembleTypst({ profile, draft }: ResumeInput, layout: Layout = DEFAULT_LAYOUT): string {
  const out: string[] = [];
  out.push(`#set page(paper: "a4", margin: ${layout.marginMm}mm)`);
  out.push(`#set text(font: ("Inter", "Liberation Sans", "Arial"), size: ${layout.fontPt}pt, lang: "en")`);
  out.push(`#set par(leading: ${(0.5 * layout.lineSpacing).toFixed(2)}em, justify: false)`);
  out.push(
    `#set list(indent: 0.4em, body-indent: 0.5em, spacing: ${(0.45 * layout.lineSpacing).toFixed(2)}em)`,
  );
  out.push('#let hb = rgb(31, 78, 121)', '#let mid = rgb(80, 80, 80)', '#let lb = rgb(30, 100, 180)');
  out.push(
    `#show heading.where(level: 1): it => block(above: ${layout.sectionGapPt + 3}pt, below: 3pt)[#text(weight: "bold", size: ${layout.fontPt + 0.5}pt, fill: hb)[#upper(it.body)] #v(-5pt) #line(length: 100%, stroke: 0.6pt + hb)]`,
  );

  const contact: string[] = [];
  if (profile.email) contact.push(link(`mailto:${profile.email}`, profile.email));
  if (profile.phone) contact.push(m(profile.phone));
  for (const l of profile.links) if (safeUrl(l.url)) contact.push(link(l.url, short(l.url)));
  const headerLines = [
    `#text(size: ${layout.fontPt + 12}pt, weight: "bold")${c(profile.name || 'Your Name')}`,
  ];
  if (profile.headline) headerLines.push(`#text(fill: mid)${c(profile.headline)}`);
  if (contact.length)
    headerLines.push(
      `#text(size: ${layout.fontPt - 1.2}pt, fill: mid)[${contact.join(' #h(0.4em)|#h(0.4em) ')}]`,
    );
  out.push(`#align(center)[\n${headerLines.join(' \\\n')}\n]`);

  const sec: Record<string, string[]> = {};
  if (draft.summary) sec.summary = [`#v(2pt)`, m(draft.summary)];
  if (draft.skills.length)
    sec.skills = [
      '= Technical Skills',
      `#grid(columns: (auto, 1fr), column-gutter: 8pt, row-gutter: 3pt, ${draft.skills
        .map((g) => `text(weight: "bold")${c(g.label)}, ${c(g.items.join(', '))}`)
        .join(', ')})`,
    ];
  if (draft.projects.length) {
    const lines = ['= Projects'];
    for (const p of draft.projects) {
      const left = `${bold(p.name)}${p.url && safeUrl(p.url) ? ` | ${link(p.url, 'GitHub')}` : ''}`;
      lines.push(`#v(3pt)`, row(left, `#text(style: "italic", fill: mid)${c(p.year)}`));
      const bullets = p.bullets.filter((b) => b.status === 'ok');
      if (bullets.length) lines.push(bullets.map((b) => `- ${m(b.text)}`).join('\n'));
      if (p.stack.length)
        lines.push(
          `#text(size: ${(layout.fontPt - 1.5).toFixed(1)}pt, style: "italic", fill: mid)[*Stack:* ${m(p.stack.join(', '))}]`,
        );
    }
    sec.projects = lines;
  }
  const experience = draft.experience ?? profile.experience;
  if (experience.length) {
    const lines = ['= Experience'];
    for (const e of experience) {
      lines.push(`#v(3pt)`, row(`${bold(e.title)}`, `#text(style: "italic", fill: mid)${c(e.dates)}`));
      lines.push(`#text(style: "italic", fill: mid)${c([e.org, e.location].filter(Boolean).join(' · '))}`);
      if (e.bullets.length) lines.push(e.bullets.map((b) => `- ${m(b)}`).join('\n'));
    }
    sec.experience = lines;
  }
  if (profile.education.length) {
    const lines = ['= Education'];
    for (const e of profile.education) {
      lines.push(row(bold(e.school), `#text(style: "italic", fill: mid)${c(e.dates)}`));
      const sub = [e.degree, e.detail].filter(Boolean).join(' | ');
      if (sub) lines.push(m(sub));
    }
    sec.education = lines;
  }
  const certs = draft.certifications ?? profile.certifications;
  if (certs.length) sec.certifications = ['= Certifications', certs.map((x) => `- ${m(x)}`).join('\n')];
  for (const key of sectionOrder(draft.order)) if (sec[key]) out.push(sec[key]!.join('\n'));
  return out.join('\n') + '\n';
}
