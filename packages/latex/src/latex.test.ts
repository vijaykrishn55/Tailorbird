import { describe, expect, it } from 'vitest';
import { emptyProfile, type ResumeDraft } from '@ra/schemas';
import { assembleLatex, assembleTypst, escapeTypst, findSlots, firstError, fitOnePage } from './index';

const draft: ResumeDraft = {
  summary: 'Backend & AI engineer.',
  skills: [{ label: 'Languages', items: ['Python', 'C++'] }],
  projects: [
    {
      id: 'a',
      name: 'Gateway_1',
      url: 'https://github.com/u/a',
      year: '2026',
      stack: ['FastAPI'],
      bullets: [
        {
          id: 'a1',
          text: 'Built 50% faster cache #1 with $5 budget.',
          factIds: [],
          metricStatus: 'none',
          status: 'ok',
          failures: [],
        },
        {
          id: 'a2',
          text: 'Second bullet here that is long enough.',
          factIds: [],
          metricStatus: 'none',
          status: 'ok',
          failures: [],
        },
        {
          id: 'a3',
          text: 'Failed bullet text should be hidden always.',
          factIds: [],
          metricStatus: 'none',
          status: 'failed',
          failures: ['x'],
        },
      ],
    },
  ],
  gaps: [],
};
const profile = {
  ...emptyProfile(),
  name: 'Vijay K',
  email: 'a@b.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/u' },
    { label: 'bad', url: 'javascript:alert(1)' },
  ],
};

describe('assemble', () => {
  it('escapes LaTeX and hides failed bullets', () => {
    const t = assembleLatex({ profile, draft });
    expect(t).toContain('50\\% faster cache \\#1 with \\$5');
    expect(t).toContain('Gateway\\_1');
    expect(t).not.toContain('Failed bullet');
    expect(t).not.toContain('javascript');
    expect(t).toContain('\\end{document}');
  });
  it('fills user slots', () => {
    const v = '\\documentclass{article}\n\\begin{document}\n% SLOT:header\n% SLOT:projects\n\\end{document}';
    expect(findSlots(v)).toEqual(['header', 'projects']);
    const t = assembleLatex({ profile, draft }, undefined, v);
    expect(t).toContain('\\textbf{Gateway\\_1}');
    expect(t).not.toContain('SLOT');
  });
  it('escapes Typst markup and drops unsafe links', () => {
    expect(escapeTypst('a_b #x $y *z* <t> @r [q]')).toBe('a\\_b \\#x \\$y \\*z\\* \\<t\\> \\@r \\[q\\]');
    const t = assembleTypst({ profile, draft });
    expect(t).toContain('github.com/u');
    expect(t).not.toContain('javascript');
    expect(t).not.toContain('Failed bullet');
  });
});

describe('fit', () => {
  it('tightens then drops bullets until one page', async () => {
    const r = await fitOnePage(draft, async (d) =>
      d.projects[0]!.bullets.filter((b) => b.status === 'ok').length > 1 ? 2 : 1,
    );
    expect(r.pages).toBe(1);
    expect(r.steps.some((s) => s.startsWith('dropped'))).toBe(true);
    expect(draft.projects[0]!.bullets).toHaveLength(3);
  });
  it('stops when it cannot fit', async () => {
    const r = await fitOnePage(draft, async () => 2);
    expect(r.pages).toBe(2);
  });
});

describe('log parser', () => {
  it('reads tex and typst errors', () => {
    expect(firstError('! Undefined control sequence.\nl.12 \\foo')).toEqual({
      message: 'Undefined control sequence.',
      line: 12,
    });
    expect(firstError('error: unknown variable\n  ┌─ main.typ:4:2')).toEqual({
      message: 'unknown variable',
      line: 4,
    });
  });
});
