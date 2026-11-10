import { askJson } from '@ra/providers';
import { z } from 'zod';
import { escapeLatex, findDenied } from '@ra/verify';
import { err, ok, type Profile, type ResumeDraft, type Result } from '@ra/schemas';
import type { Deps } from '../ports';
import { sectionOrder } from '@ra/latex';
import { findContacts, maskPersonal } from '../docs';
import { assembleOwnLatex } from './latex-own';

const Reply = z.object({ body: z.string().min(20) });

const SYSTEM = `You rewrite the body of a LaTeX resume. The EXAMPLE shows the person's own layout and macros. Produce the same layout with the NEW CONTENT instead.
Rules:
- Use only the LaTeX commands that appear in the EXAMPLE, plus \\textbf \\textit \\emph \\item \\href \\\\ and \\begin/\\end itemize.
- Copy every text line of the NEW CONTENT exactly, character for character. It is already LaTeX-escaped. Do not reword, add or drop items.
- Keep the section order of NEW CONTENT. Skip a section that has no content.
- Output JSON only: {"body": "<the LaTeX body, starting at the first section>"}`;

const SECTION = /\\(?:\w*section\w*)\*?\s*[{[]/;

/** Split a document into the part we keep verbatim (preamble and header) and the sections we restyle. */
export function splitLatex(tex: string): { head: string; body: string; tail: string } | undefined {
  const begin = tex.indexOf('\\begin{document}');
  const end = tex.lastIndexOf('\\end{document}');
  if (begin < 0 || end < 0) return undefined;
  const inner = tex.slice(begin + '\\begin{document}'.length, end);
  const m = SECTION.exec(inner);
  if (!m) return undefined;
  const cut = begin + '\\begin{document}'.length + m.index;
  return { head: tex.slice(0, cut), body: tex.slice(cut, end), tail: tex.slice(end) };
}

const cmds = (s: string) => new Set([...s.matchAll(/\\([a-zA-Z]+)/g)].map((m) => m[1]!));

function balanced(s: string): boolean {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      i++;
      continue;
    }
    if (s[i] === '{') d++;
    else if (s[i] === '}' && --d < 0) return false;
  }
  return d === 0;
}

function contentLines(p: Profile, d: ResumeDraft): string[] {
  const e = escapeLatex;
  const out: string[] = [];
  const order = sectionOrder(d.order);
  const exp = d.experience ?? p.experience;
  const certs = d.certifications ?? p.certifications;
  for (const k of order) {
    if (k === 'summary' && d.summary) out.push('SUMMARY', e(d.summary));
    if (k === 'skills' && d.skills.length)
      out.push('SKILLS', ...d.skills.map((g) => `${e(g.label)}: ${g.items.map(e).join(', ')}`));
    if (k === 'projects' && d.projects.length)
      out.push(
        'PROJECTS',
        ...d.projects.flatMap((x) => [
          `${e(x.name)}${x.year ? ` (${e(x.year)})` : ''}${x.url ? ` | link: ${x.url}` : ''}`,
          ...x.bullets.map((b) => `- ${e(b.text)}`),
          ...(x.stack.length ? [`Stack: ${x.stack.map(e).join(', ')}`] : []),
        ]),
      );
    if (k === 'experience' && exp.length)
      out.push(
        'EXPERIENCE',
        ...exp.flatMap((x) => [
          `${e(x.title)} | ${e(x.org)} | ${e(x.dates)} | ${e(x.location)}`,
          ...x.bullets.map((b) => `- ${e(b)}`),
        ]),
      );
    if (k === 'education' && p.education.length)
      out.push(
        'EDUCATION',
        ...p.education.map((x) => `${e(x.school)} | ${e(x.degree)} | ${e(x.dates)} | ${e(x.detail)}`),
      );
    if (k === 'certifications' && certs.length) out.push('CERTIFICATIONS', ...certs.map((c) => `- ${e(c)}`));
  }
  return out;
}

/**
 * Re-create the person's own LaTeX with the new content. Their preamble and header are kept byte for byte and never sent to the
 * model. The model only rewrites the sections, and the result is checked in code. Returns an error if it cannot be trusted.
 */
export async function restyleLatex(
  deps: Deps,
  userLatex: string,
  profile: Profile,
  draft: ResumeDraft,
): Promise<Result<string>> {
  // Documents built from header/item macros are filled directly, with no model, so the layout is exactly theirs.
  const direct = assembleOwnLatex(userLatex, profile, draft);
  if (direct) return ok(direct);
  const parts = splitLatex(userLatex);
  if (!parts)
    return err(
      'validation',
      'Your LaTeX needs \\begin{document} and at least one section to be used as a format.',
    );
  const contacts = findContacts([{ text: userLatex, links: [] }]);
  const example = maskPersonal(parts.body, contacts).slice(0, 9000);
  const lines = contentLines(profile, draft);
  const content = lines.join('\n');
  const allowed = cmds(userLatex);
  for (const c of ['textbf', 'textit', 'emph', 'item', 'href', 'begin', 'end', 'url']) allowed.add(c);
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await askJson(
      deps.llm,
      Reply,
      SYSTEM,
      `<example>\n${example}\n</example>\n<new_content>\n${content}\n</new_content>${feedback}`,
      {
        tier: 'strong',
        signal: deps.signal,
        maxTokens: 6000,
      },
    );
    if (!res.ok) return res;
    const body = res.value.body;
    const problems: string[] = [];
    const denied = findDenied(body);
    if (denied.length) problems.push(`uses forbidden commands ${denied.join(', ')}`);
    const unknown = [...cmds(body)].filter((c) => !allowed.has(c));
    if (unknown.length)
      problems.push(`uses commands not in the example: ${unknown.map((c) => '\\' + c).join(', ')}`);
    if (!balanced(body)) problems.push('has unbalanced braces');
    const missing = lines
      .filter((l) => !/^[A-Z]+$/.test(l) && !/ \| link: /.test(l))
      .map((l) => l.replace(/^- /, '').replace(/^Stack: /, ''))
      .filter((l) => l.trim() && !body.includes(l.split(' | ')[0]!.trim()));
    if (missing.length) problems.push(`left out or changed these lines: ${missing.slice(0, 5).join(' / ')}`);
    if (problems.length === 0) return ok(`${parts.head}${body.trim()}\n\n${parts.tail}`);
    feedback = `\nYour last answer was rejected: ${problems.join('; ')}. Fix exactly that.`;
  }
  return err(
    'verification_failed',
    'The model could not reproduce your LaTeX layout safely. The built-in template was used instead.',
  );
}
