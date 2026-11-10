/** Reading the user's own documents. Everything here is local text handling; nothing is sent anywhere. */

export interface FoundLink {
  label: string;
  url: string;
}

export interface Contacts {
  name: string;
  email: string;
  phone: string;
  links: FoundLink[];
}

/** Plain text from LaTeX source: comments and macros removed, link targets collected. */
export function latexToText(tex: string): { text: string; links: FoundLink[]; headerLinks: FoundLink[] } {
  const links: FoundLink[] = [];
  let s = tex.replace(/(^|[^\\])%.*$/gm, '$1');
  const body = /\\begin\{document\}([\s\S]*?)(\\end\{document\}|$)/.exec(s);
  if (body) s = body[1]!;
  // Links in the header block (before the first \end{center}, or the first 1500 characters) are the person's own profile links.
  const headEnd = s.indexOf('\\end{center}');
  const header = s.slice(0, headEnd > 0 ? headEnd : 1500);
  const headerLinks: FoundLink[] = [...header.matchAll(/\\href\{([^}]*)\}\{([^}]*)\}/g)]
    .filter((m) => !/^mailto:/i.test(m[1]!))
    .map((m) => ({
      label: m[2]!
        .replace(/\\[A-Za-z]+/g, '')
        .replace(/[{}]/g, '')
        .trim(),
      url: m[1]!.trim(),
    }));
  s = s
    .replace(/\\begin\{tabular\}[^\n]*/g, '')
    .replace(/\\(?:begin|end)\{[A-Za-z*]+\}/g, ' ')
    .replace(/(?<!\\)&/g, ': ')
    .replace(/\\fontsize\{[^}]*\}\{[^}]*\}/g, ' ')
    .replace(/\\color\{[^}]*\}/g, ' ')
    .replace(/\\textcolor\{[^}]*\}/g, ' ')
    .replace(/\$\\cdot\$|\\cdot\b/g, ' · ')
    .replace(/\\selectfont/g, ' ');
  s = s.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, (_m, url: string, label: string) => {
    links.push({
      label: label
        .replace(/\\[A-Za-z]+/g, '')
        .replace(/[{}]/g, '')
        .trim(),
      url: url.trim(),
    });
    return label;
  });
  s = s.replace(/\\url\{([^}]*)\}/g, (_m, url: string) => {
    links.push({ label: '', url: url.trim() });
    return url;
  });
  s = s
    .replace(/\\(?:resumeItem|item)\b/g, '\n- ')
    .replace(/\\\\(\[[^\]]*])?/g, '\n')
    .replace(/\\(?:section|subsection|cvsection)\*?\{([^}]*)\}/g, '\n\n$1\n')
    .replace(/\$\|\$/g, ' | ')
    .replace(/\$([^$\n]{0,12})\$/g, ' $1 ')
    .replace(/\\(&|%|\$|#|_)/g, '$1')
    .replace(/\\textbar\{?}?/g, '|')
    .replace(/\\(?:hfill|quad|qquad|vspace\*?\{[^}]*\}|hspace\*?\{[^}]*\})/g, ' ')
    .replace(/\\[A-Za-z]+\*?(\[[^\]]*])?/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\\\s/g, ' ')
    .replace(/~/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: s, links, headerLinks };
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const PHONE = /(?<![\d])\+?\d[\d\s().-]{8,16}\d(?![\d])/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s)>\]}"',;]+|(?:linkedin\.com|github\.com)\/[^\s)>\]}"',;]+/gi;

function labelFor(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com')) return 'LinkedIn';
  if (u.includes('github.com')) return 'GitHub';
  if (u.includes('leetcode.com')) return 'LeetCode';
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const normUrl = (u: string) => (/^(https?:|mailto:)/i.test(u) ? u : `https://${u}`).replace(/[.,;:]+$/, '');

function titleCase(s: string): string {
  return s === s.toLowerCase() || s === s.toUpperCase()
    ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    : s;
}

/** Name, email, phone and links, found with patterns. The text keeps its original wording. */
const HEADING =
  /^(summary|profile|objective|skills|technical skills|experience|work experience|education|projects|certifications|achievements|contact)$/i;

export function findContacts(texts: { text: string; links?: FoundLink[] }[]): Contacts {
  const all = texts.map((t) => t.text).join('\n');
  const email = all.match(EMAIL)?.[0] ?? '';
  const phone =
    (all.match(PHONE) ?? []).map((p) => p.trim()).find((p) => p.replace(/\D/g, '').length >= 10) ?? '';
  const found: FoundLink[] = [];
  const seen = new Set<string>();
  const add = (url: string, label?: string) => {
    const u = normUrl(url);
    const key = u
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '');
    if (u.startsWith('mailto:') || seen.has(key)) return;
    // Only profile-level links belong in the header (a repo link is not "my GitHub").
    const path = key.split('/').slice(1).filter(Boolean);
    if (/github\.com/.test(key) && path.length > 1) return;
    seen.add(key);
    found.push({ label: label && label.length < 24 && !/@|\d{5}/.test(label) ? label : labelFor(u), url: u });
  };
  for (const t of texts) for (const l of t.links ?? []) add(l.url, l.label);
  // Links written in the person's own LaTeX header are authoritative; text from other files (wrapped, cut-off URLs) is only a fallback.
  if (found.length === 0) for (const m of all.match(URL_RE) ?? []) add(m);
  const head = texts
    .flatMap((t) => t.text.split('\n'))
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  const clean = (l: string) =>
    l
      .replace(EMAIL, ' ')
      .replace(PHONE, ' ')
      .replace(URL_RE, ' ')
      .replace(/[|,·•]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const nameLike = (l: string) =>
    !HEADING.test(l) && /^[\p{L}][\p{L} .'-]{2,40}$/u.test(l) && l.split(/\s+/).length <= 5;
  const picked = head.map(clean).find(nameLike) ?? '';
  EMAIL.lastIndex = 0;
  PHONE.lastIndex = 0;
  return { name: titleCase(picked), email, phone, links: found.slice(0, 5) };
}

/** Replace personal details with placeholders before text goes to a model. */
export function maskPersonal(text: string, c: Pick<Contacts, 'name' | 'email' | 'phone'>): string {
  let s = text.replace(EMAIL, '[email]').replace(PHONE, '[phone]').replace(URL_RE, '[link]');
  if (c.name) s = s.split(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).join('[name]');
  return s;
}

const SECTION_KEYS: [string, RegExp][] = [
  ['summary', /summary|objective|profile|about/i],
  ['skills', /skill|technolog|competenc/i],
  ['experience', /experience|employment|work history|internship/i],
  ['projects', /project/i],
  ['education', /education|academic/i],
  ['certifications', /certif|course|achievement|award|honou?r/i],
];

/** The order of sections in the user's own LaTeX, so the new resume follows it. */
export function detectSectionOrder(tex: string): string[] {
  const out: string[] = [];
  for (const m of tex.matchAll(/\\(?:section|cvsection|resumeSection)\*?\{([^}]*)\}/g)) {
    const heading = m[1]!;
    const key = SECTION_KEYS.find(([, re]) => re.test(heading))?.[0];
    if (key && !out.includes(key)) out.push(key);
  }
  // A summary written as a plain paragraph under the header has no heading of its own, and comes first.
  if (!out.includes('summary')) out.unshift('summary');
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A checker for "does this text come from the user's documents". Short items must appear whole; long ones mostly. */
export function makeSupportCheck(corpus: string): (item: string) => boolean {
  const hay = ` ${norm(corpus)} `;
  const words = new Set(hay.split(' ').filter(Boolean));
  return (item: string) => {
    const n = norm(item);
    if (!n) return true;
    if (hay.includes(` ${n} `)) return true;
    const w = n.split(' ');
    if (w.length < 4) return false;
    return w.filter((x) => words.has(x)).length / w.length >= 0.85;
  };
}

/** The person's name as written in the header of their LaTeX: the first bold text after \\begin{document}. */
export function latexName(tex: string): string {
  const body = tex.split('\\begin{document}')[1] ?? '';
  const m = /\\textbf\{((?:[^{}]|\{[^{}]*\})*)\}/.exec(body.slice(0, 900));
  if (!m) return '';
  const t = m[1]!
    .replace(/\\[A-Za-z]+\{[^}]*\}/g, '')
    .replace(/\\[A-Za-z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /^[\p{L}][\p{L} .'-]{2,40}$/u.test(t) && t.split(' ').length <= 5 ? t : '';
}

export interface OwnProject {
  name: string;
  url: string;
  repo: string;
  bullets: string[];
  stack: string[];
}

/** Text of the first brace group starting at `from` (which must point at "{"), with nesting. */
function group(s: string, from: number): { text: string; end: number } | undefined {
  if (s[from] !== '{') return undefined;
  let d = 0;
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') {
      i++;
      continue;
    }
    if (s[i] === '{') d++;
    else if (s[i] === '}' && --d === 0) return { text: s.slice(from + 1, i), end: i + 1 };
  }
  return undefined;
}

const inline = (t: string) =>
  t
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\(?:texttt|textbf|textit|emph|small|color)\{([^{}]*)\}/g, '$1')
    .replace(/\\(&|%|\$|#|_)/g, '$1')
    .replace(/\s+--\s+/g, ' – ')
    .replace(/\\[A-Za-z]+\*?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The projects the person already wrote about in their own LaTeX: one per GitHub repository link in the Projects section.
 * Name comes from the macro or bold text next to the link, bullets from \resumeItem or \item, the stack from \techstack or a "Stack:" line.
 */
export function parseOwnProjects(tex: string): OwnProject[] {
  const out: OwnProject[] = [];
  const sec = /\\(?:\w*section\w*)\*?\{([^}]*)\}/g;
  const heads = [...tex.matchAll(sec)];
  const start = heads.find((m) => /project/i.test(m[1]!));
  if (!start) return out;
  const after = heads.find((m) => m.index! > start.index!);
  const text = tex.slice(start.index!, after?.index ?? tex.indexOf('\\end{document}'));
  const urls = [...text.matchAll(/https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/g)];
  urls.forEach((u, i) => {
    const from = text.lastIndexOf('\\', u.index!);
    const before = text.slice(Math.max(0, u.index! - 300), u.index!);
    const named = /\\[A-Za-z]+\{((?:[^{}]|\{[^{}]*\})*)\}\{\s*$/.exec(before);
    const bold = [...before.matchAll(/\\textbf\{((?:[^{}]|\{[^{}]*\})*)\}/g)].pop();
    const name = inline(named?.[1] ?? bold?.[1] ?? '');
    const chunkStart = u.index!;
    const next = urls[i + 1] ? text.lastIndexOf('\\', urls[i + 1]!.index!) : text.length;
    const chunk = text.slice(chunkStart, next > chunkStart ? next : text.length);
    void from;
    const bullets: string[] = [];
    for (const m of chunk.matchAll(/\\(?:resumeItem|item)\b/g)) {
      const at = m.index! + m[0].length;
      const g = group(
        chunk,
        chunk.indexOf('{', at) === at || /^\s*\{/.test(chunk.slice(at, at + 3))
          ? at + chunk.slice(at).search(/\{/)
          : -1,
      );
      if (g) bullets.push(inline(g.text));
      else {
        const line = chunk.slice(at).split('\n')[0] ?? '';
        if (line.trim()) bullets.push(inline(line));
      }
    }
    const st = /\\techstack\{((?:[^{}]|\{[^{}]*\})*)\}/.exec(chunk) ?? /Stack:\}?\s*([^\n}]+)/.exec(chunk);
    const stack = st
      ? inline(st[1]!)
          .split(/,\s*/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    out.push({ name, url: u[0], repo: u[2]!.replace(/\.git$/, ''), bullets: bullets.filter(Boolean), stack });
  });
  return out;
}
