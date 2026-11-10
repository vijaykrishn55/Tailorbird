import { describe, expect, it } from 'vitest';
import { ok, type ProjectEntry, type ResumeDraft } from '@ra/schemas';
import type { Llm } from '@ra/providers';
import {
  DENIED_COMMANDS,
  checkBullet,
  coverageReport,
  escapeLatex,
  extractNumbers,
  findDenied,
  forbiddenHits,
  judgePair,
  latexProblem,
  lengthProblem,
  numbersMissingFrom,
  runChecks,
  unsupportedNumbers,
  unsupportedTerms,
} from './index';

const entry: ProjectEntry = {
  id: 'gateway',
  url: 'https://example.com/gateway',
  name: 'Gateway',
  readme: '',
  year: '2026',
  summary: 'FastAPI gateway with Redis token buckets, a circuit breaker and 9 pytest test files.',
  stackVerified: ['Python', 'FastAPI', 'Redis', 'Docker'],
  metrics: [
    {
      name: 'Cache effect',
      value: 'cold 159.236 ms vs warm 3.515 ms (97.8% reduction)',
      status: 'measured',
      scope: 'smoke test',
    },
  ],
  bullets: [
    {
      id: 'gateway.b1',
      text: 'Built a FastAPI gateway with Redis rate limiting.',
      angle: '',
      keywordsSupported: ['Redis'],
      evidence: [],
      metricStatus: 'none',
    },
  ],
  doNotClaim: [
    'Any of the targets above',
    'Deployed to a real cluster',
    'Kubernetes autoscaling (KEDA)',
    'Use by "real traffic"',
  ],
  ratingBasis: '',
  liveCheck: [],
};
const good =
  'Built a FastAPI gateway with Redis token buckets and a circuit breaker covered by 9 pytest test files.';

describe('numbers', () => {
  it('extracts and normalises', () => {
    expect(extractNumbers('Handled 1,000 requests, 97.8% faster, Python 3.11.')).toEqual([
      '1000',
      '97.8',
      '3.11',
    ]);
  });
  it('allows numbers present in the entry and flags others', () => {
    expect(unsupportedNumbers('Cut latency by 97.8% across 9 files', entry)).toEqual([]);
    expect(unsupportedNumbers('Cut latency by 60% and served 5000 users', entry)).toEqual(['60', '5000']);
  });
  it('finds numbers missing from a source', () => {
    expect(numbersMissingFrom('42 items and 7 more', 'there are 42 items')).toEqual(['7']);
  });
});

describe('tech terms', () => {
  it('flags technologies outside the verified stack', () => {
    expect(unsupportedTerms('Built with FastAPI and Kafka on AWS', entry).sort()).toEqual(['AWS', 'Kafka']);
    expect(unsupportedTerms('Built with FastAPI and Redis', entry)).toEqual([]);
  });
});

describe('forbidden', () => {
  it('flags do-not-claim terms and quoted phrases', () => {
    expect(forbiddenHits('Added Kubernetes autoscaling with KEDA', entry).join(' ')).toContain('KEDA');
    expect(forbiddenHits('Handled real traffic daily', entry).join(' ')).toContain('real traffic');
  });
  it('flags overclaiming verbs unless the project states them', () => {
    expect(forbiddenHits('Deployed to production for customers', entry).length).toBeGreaterThan(0);
    expect(forbiddenHits(good, entry)).toEqual([]);
  });
});

describe('length', () => {
  it('flags too short and too long', () => {
    expect(lengthProblem('Too short.')).toContain('at least');
    expect(lengthProblem(Array(50).fill('word').join(' '))).toContain('or fewer');
    expect(lengthProblem(good)).toBeUndefined();
  });
});

describe('latex safety', () => {
  it('rejects every denied command', () => {
    for (const c of DENIED_COMMANDS) {
      expect(findDenied(`text \\${c}{x} more`), c).toContain(`\\${c}`);
      expect(latexProblem(`text \\${c}{x}`), c).toBeTruthy();
    }
  });
  it('rejects any command, accepts plain text', () => {
    expect(latexProblem('use \\textbf{this}')).toContain('LaTeX command');
    expect(latexProblem('Plain text with 50% and R&D')).toBeUndefined();
  });
  it('escapes specials and normalises unicode', () => {
    expect(escapeLatex('R&D 50% $5 #1 a_b {x} ~ ^')).toBe(
      'R\\&D 50\\% \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{}',
    );
    expect(escapeLatex('it’s “ok” – fine')).toBe('it\'s "ok" -- fine');
    expect(escapeLatex('a\\b')).toBe('a\\textbackslash{}b');
    expect(escapeLatex('zero​width')).toBe('zerowidth');
  });
});

describe('checkBullet / runChecks', () => {
  it('passes a clean bullet', () => {
    expect(checkBullet({ id: 'b', text: good }, entry)).toEqual([]);
  });
  it('collects every kind of failure with exact messages', () => {
    const bad =
      'Deployed Kafka and Kubernetes autoscaling with KEDA to production for 5000 customers using \\input{x} daily.';
    const checks = new Set(checkBullet({ id: 'b', text: bad }, entry).map((f) => f.check));
    expect(checks).toEqual(new Set(['numbers', 'tech', 'forbidden', 'latex']));
  });
  it('reports bullets for unknown projects', () => {
    const f = runChecks(
      { projects: [{ id: 'nope', bullets: [{ id: 'x', text: good }] }] },
      { entries: new Map([['gateway', entry]]) },
    );
    expect(f).toHaveLength(1);
  });
});

describe('coverage', () => {
  const draft: ResumeDraft = {
    summary: '',
    skills: [],
    projects: [
      {
        id: 'gateway',
        name: 'Gateway',
        url: '',
        year: '',
        stack: ['FastAPI'],
        bullets: [{ id: 'b', text: good, factIds: [], metricStatus: 'none', status: 'ok', failures: [] }],
      },
    ],
    gaps: [],
  };
  it('separates covered terms, supported-but-missing and no-evidence', () => {
    const r = coverageReport(
      draft,
      { title: '', roleCode: 'BE', mustHave: ['FastAPI', 'Docker', 'Kafka'], niceToHave: [], phrases: [] },
      ['FastAPI', 'Docker'],
    );
    expect(r.covered).toEqual(['FastAPI']);
    expect(r.gaps).toEqual([
      { term: 'Docker', reason: 'supported_not_included' },
      { term: 'Kafka', reason: 'no_evidence' },
    ]);
    expect(r.ratio).toBeCloseTo(1 / 3);
  });
  it('ignores failed bullets', () => {
    const d = structuredClone(draft);
    d.projects[0]!.bullets[0]!.status = 'failed';
    d.projects[0]!.stack = [];
    d.projects[0]!.name = 'X';
    const r = coverageReport(
      d,
      { title: '', roleCode: 'BE', mustHave: ['Redis'], niceToHave: [], phrases: [] },
      ['Redis'],
    );
    expect(r.covered).toEqual([]);
  });
});

describe('judge', () => {
  const llmWinner = (fn: (n: number) => string): Llm => {
    let n = 0;
    return { complete: async () => ok({ text: JSON.stringify({ winner: fn(n++) }) }) };
  };
  it('keeps a consistent preference', async () => {
    // first call: "first" => a; second call (swapped): "second" => a
    const r = await judgePair(
      llmWinner((n) => (n === 0 ? 'first' : 'second')),
      [],
      'A',
      'B',
    );
    expect(r.ok && r.value).toBe('a');
  });
  it('returns tie on position bias (always says first)', async () => {
    const r = await judgePair(
      llmWinner(() => 'first'),
      [],
      'A',
      'B',
    );
    expect(r.ok && r.value).toBe('tie');
  });
});
