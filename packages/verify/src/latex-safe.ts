/** Commands that must never appear in generated text, even escaped by mistake. */
export const DENIED_COMMANDS = [
  'input',
  'include',
  'includeonly',
  'write',
  'write18',
  'immediate',
  'openin',
  'openout',
  'read',
  'readline',
  'catcode',
  'def',
  'edef',
  'gdef',
  'xdef',
  'let',
  'csname',
  'expandafter',
  'newcommand',
  'renewcommand',
  'providecommand',
  'usepackage',
  'RequirePackage',
  'documentclass',
  'directlua',
  'luaexec',
  'special',
  'pdfliteral',
  'pdfshellescape',
  'verbatiminput',
  'lstinputlisting',
  'endinput',
  'url',
  'href',
] as const;

const DENIED_RE = new RegExp(
  `\\\\(?:${[...DENIED_COMMANDS].sort((a, b) => b.length - a.length).join('|')})(?![A-Za-z])`,
  'g',
);

/** Denied commands present in the text. */
export function findDenied(text: string): string[] {
  return [...new Set(text.match(DENIED_RE) ?? [])];
}

/** Generated text must be plain: any backslash command is rejected before it can reach the compiler. */
export function latexProblem(text: string): string | undefined {
  const denied = findDenied(text);
  if (denied.length > 0) return `contains the forbidden LaTeX command ${denied.join(', ')}`;
  if (/\\[A-Za-z]+/.test(text)) return 'contains a LaTeX command; write plain text only';
  return undefined;
}

const UNICODE_MAP: [RegExp, string][] = [
  [/[‘’‛]/g, "'"],
  [/[“”„]/g, '"'],
  [/–/g, '--'],
  [/—/g, '---'],
  [/…/g, '...'],
  [/ /g, ' '],
  [/[•·]/g, '-'],
  [/→/g, '->'],
  [/×/g, 'x'],
];

/** Escape LaTeX special characters in plain text. */
export function escapeLatex(text: string): string {
  let s = text;
  for (const [re, rep] of UNICODE_MAP) s = s.replace(re, rep);
  s = s.replace(/[​-‏⁠﻿]/g, '');
  let out = '';
  for (const ch of s) {
    switch (ch) {
      case '\\':
        out += '\\textbackslash{}';
        break;
      case '&':
        out += '\\&';
        break;
      case '%':
        out += '\\%';
        break;
      case '$':
        out += '\\$';
        break;
      case '#':
        out += '\\#';
        break;
      case '_':
        out += '\\_';
        break;
      case '{':
        out += '\\{';
        break;
      case '}':
        out += '\\}';
        break;
      case '~':
        out += '\\textasciitilde{}';
        break;
      case '^':
        out += '\\textasciicircum{}';
        break;
      case '<':
        out += '\\textless{}';
        break;
      case '>':
        out += '\\textgreater{}';
        break;
      case '|':
        out += '\\textbar{}';
        break;
      default:
        out += ch;
    }
  }
  return out;
}
