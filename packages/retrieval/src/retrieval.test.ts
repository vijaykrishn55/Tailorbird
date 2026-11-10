import { describe, expect, it } from 'vitest';
import { ok, type JobProfile, type RepoCard } from '@ra/schemas';
import type { Llm } from '@ra/providers';
import {
  bm25Rank,
  canonical,
  canonicalSet,
  countTerms,
  normalise,
  pickDiverse,
  rerankTop,
  scoreCards,
} from './index';

const card = (id: string, over: Partial<RepoCard> = {}): RepoCard => ({
  id,
  tier: 'A',
  oneLine: `${id} project`,
  excluded: false,
  roles: {},
  kw: [],
  grade: 'B',
  group: id,
  pushed: '2026-01-01',
  ...over,
});

const job = (over: Partial<JobProfile> = {}): JobProfile => ({
  title: '',
  roleCode: 'BE',
  mustHave: [],
  niceToHave: [],
  phrases: [],
  ...over,
});

describe('keyword dictionary', () => {
  it('finds technologies, aliases and symbol-heavy terms', () => {
    const t = normalise(
      'We use Node.js, C++ and k8s with REST APIs, plus Postgres. Golang is a plus. R is fine.',
    );
    expect(t).toEqual(expect.arrayContaining(['Node.js', 'C++', 'Kubernetes', 'REST API', 'PostgreSQL']));
  });
  it('does not match inside other words', () => {
    expect(normalise('We love Javascripting and scripted things')).not.toContain('JavaScript');
    expect(normalise('Cobweb')).not.toContain('Go');
  });
  it('is case sensitive for short names', () => {
    expect(normalise('go to the market')).not.toContain('Go');
    expect(normalise('We write Go services')).toContain('Go');
  });
  it('counts occurrences and canonicalises', () => {
    expect(countTerms('Python, python and PYTHON').get('Python')).toBe(3);
    expect(canonical('nodejs')).toBe('Node.js');
    expect(canonicalSet(['Postgres', 'ReactJS']).has('React')).toBe(true);
  });
});

describe('ranking', () => {
  const cards = [
    card('api-gateway', {
      roles: { BE: 10 },
      kw: ['FastAPI', 'Redis', 'Docker'],
      grade: 'A',
      group: 'gateway',
    }),
    card('rag-app', { roles: { AIE: 9, BE: 5 }, kw: ['RAG', 'FAISS', 'Python'], group: 'rag' }),
    card('frontend', { roles: { FE: 8 }, kw: ['React', 'Tailwind CSS'], grade: 'C', group: 'fe' }),
  ];
  it('ranks by role fit and keyword overlap', () => {
    const ranked = scoreCards(cards, job({ mustHave: ['FastAPI', 'Redis'], niceToHave: ['Docker'] }));
    expect(ranked[0]!.card.id).toBe('api-gateway');
    expect(ranked[0]!.matched).toEqual(expect.arrayContaining(['FastAPI', 'Redis']));
  });
  it('uses the role code', () => {
    const ranked = scoreCards(cards, job({ roleCode: 'AIE', mustHave: ['RAG'] }));
    expect(ranked[0]!.card.id).toBe('rag-app');
  });
  it('breaks ties by recency', () => {
    const a = card('old', { roles: { BE: 5 }, pushed: '2024-01-01' });
    const b = card('new', { roles: { BE: 5 }, pushed: '2026-01-01' });
    expect(scoreCards([a, b], job())[0]!.card.id).toBe('new');
  });
  it('returns hits for bm25 and none for empty input', () => {
    expect(bm25Rank(cards, ['redis'])[0]?.id).toBe('api-gateway');
    expect(bm25Rank([], ['x'])).toEqual([]);
  });
  it('avoids two projects from the same group unless on topic', () => {
    const cs = [
      card('a', { roles: { BE: 6 }, group: 'g' }),
      card('b', { roles: { BE: 6 }, group: 'g' }),
      card('c', { roles: { BE: 5 }, group: 'h' }),
    ];
    const ranked = scoreCards(cs, job());
    const picked = pickDiverse(ranked, 2).map((s) => s.card.id);
    expect(picked).toEqual(expect.arrayContaining(['c']));
    expect(new Set(picked).size).toBe(2);
  });
});

describe('rerank', () => {
  const shortlist = scoreCards(
    [
      card('a', { roles: { BE: 9 }, kw: ['Redis'] }),
      card('b', { roles: { BE: 8 } }),
      card('c', { roles: { BE: 7 } }),
    ],
    job({ mustHave: ['Redis'] }),
  );
  const llm = (text: string): Llm => ({ complete: async () => ok({ text }) });
  it('uses valid model picks', async () => {
    const r = await rerankTop(
      llm('{"picks":[{"id":"b","reason":"fits"},{"id":"a","reason":"ok"},{"id":"c","reason":"ok"}]}'),
      shortlist,
      job(),
      3,
    );
    expect(r.ok && r.value.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
  it('falls back to scored order on garbage', async () => {
    const r = await rerankTop(llm('nonsense'), shortlist, job(), 3);
    expect(r.ok && r.value[0]!.id).toBe('a');
  });
  it('rejects unknown ids and falls back', async () => {
    const r = await rerankTop(llm('{"picks":[{"id":"zzz","reason":"x"}]}'), shortlist, job(), 2);
    expect(r.ok && r.value.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('tops up when the model returns fewer picks', async () => {
    const r = await rerankTop(llm('{"picks":[{"id":"c","reason":"x"}]}'), shortlist, job(), 3);
    expect(r.ok && r.value).toHaveLength(3);
    expect(r.ok && r.value[0]!.id).toBe('c');
  });
});
