import { describe, expect, it } from 'vitest';
import { ok } from '@ra/schemas';
import type { Llm } from '@ra/providers';
import {
  GitHubClient,
  type FetchLike,
  decodeText,
  diffFingerprints,
  fingerprint,
  firstParagraph,
  readmeExcerpt,
  gradeFor,
  indexRepos,
  parseCargo,
  parseManifest,
  parsePackageJson,
  parsePyproject,
  parseRequirements,
  roleScores,
  summarizeRepo,
} from './index';

const resp = (body: string, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: (n: string) => (n === 'x-ratelimit-remaining' ? '50' : null) },
  text: async () => body,
  json: async () => JSON.parse(body),
});

describe('parse-deps', () => {
  it('parses requirements', () =>
    expect(parseRequirements('fastapi>=0.1\n# c\nredis==5\n-r other.txt\nPyDantic[email]')).toEqual([
      'fastapi',
      'redis',
      'pydantic',
    ]));
  it('decodes UTF-16', () => {
    const s = 'fastapi\nredis';
    const b = new Uint8Array([0xff, 0xfe, ...[...s].flatMap((c) => [c.charCodeAt(0), 0])]);
    expect(parseRequirements(decodeText(b))).toEqual(['fastapi', 'redis']);
  });
  it('parses package.json, pyproject, cargo', () => {
    expect(parsePackageJson('{"dependencies":{"react":"1"},"devDependencies":{"vite":"1"}}')).toEqual([
      'react',
      'vite',
    ]);
    expect(parsePyproject('[project]\ndependencies = [\n "httpx>=1",\n "rich"\n]')).toEqual([
      'httpx',
      'rich',
    ]);
    expect(parseCargo('[dependencies]\nserde = "1"\ntokio = { version = "1" }\n[package]\nname="x"')).toEqual(
      ['serde', 'tokio'],
    );
    expect(parseManifest('a/package.json', '{bad')).toEqual([]);
  });
});

describe('fingerprint', () => {
  it('hashes and diffs', async () => {
    const a = await fingerprint('r', 'README.md', 'one');
    const b = await fingerprint('r', 'README.md', 'two');
    expect(a.sha256_12).toHaveLength(12);
    expect(diffFingerprints([a], [b]).changed).toEqual(['r']);
    expect(diffFingerprints([a], []).removed).toEqual(['r']);
    expect(diffFingerprints([], [a]).added).toEqual(['r']);
  });
});

describe('grading', () => {
  it('grades by evidence', () => {
    expect(gradeFor({ testFiles: 9, hasCI: true, hasDocker: true, hasMeasured: true })).toBe('A');
    expect(gradeFor({ testFiles: 0, hasCI: false, hasDocker: false, hasMeasured: false })).toBe('D');
    expect(roleScores(['FastAPI', 'Redis']).BE).toBeGreaterThan(3);
  });
});

const llmWith = (reply: unknown): Llm => ({ complete: async () => ok({ text: JSON.stringify(reply) }) });

describe('summarize', () => {
  const input = {
    id: 'x',
    name: 'x',
    url: 'u',
    year: '2026',
    readme: 'FastAPI gateway using Redis. Cache cut latency 97.8% in a smoke test. 9 test files.',
    deps: ['fastapi', 'redis'],
  };
  it('drops invented numbers and technologies', async () => {
    const r = await summarizeRepo(
      llmWith({
        summary: 'Gateway with 9 test files and 500 users',
        stack: ['FastAPI', 'Kafka', 'Redis'],
        metrics: [
          { name: 'a', value: '97.8%', measured: true },
          { name: 'b', value: '500 users', measured: true },
        ],
        doNotClaim: [],
      }),
      input,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.stackVerified).toEqual(['FastAPI', 'Redis']);
    expect(r.value.metrics.map((m) => m.value)).toEqual(['97.8%']);
    expect(r.value.summary).not.toContain('500');
  });
});

describe('readme text', () => {
  it('takes the first real paragraph and skips badges and headings', () => {
    const md =
      '# Title\n\n![badge](x.svg)\n\nA FastAPI gateway with Redis rate limiting and a circuit breaker for providers.\n\n## Install\n';
    expect(firstParagraph(md)).toContain('FastAPI gateway');
    expect(readmeExcerpt(md)).not.toContain('badge');
  });
});

describe('indexRepos', () => {
  const repo = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    full_name: `u/${name}`,
    description: 'd',
    language: 'Python',
    topics: ['api'],
    pushed_at: '2026-01-02T00:00:00Z',
    html_url: `https://github.com/u/${name}`,
    default_branch: 'main',
    fork: false,
    ...extra,
  });
  const f: FetchLike = async (url) => {
    if (url.includes('/users/'))
      return resp(
        JSON.stringify([
          repo('gw'),
          repo('u'),
          repo('fk', { fork: true }),
          repo('noreadme', { archived: true }),
        ]),
      );
    if (url.includes('/git/trees/'))
      return resp(
        JSON.stringify({
          tree: [
            { path: 'requirements.txt', type: 'blob' },
            { path: 'tests/test_a.py', type: 'blob' },
            { path: '.github/workflows/ci.yml', type: 'blob' },
          ],
        }),
      );
    if (url.endsWith('/u/main/README.md'))
      return resp('# Profile\n\nHi, I build things and write about software engineering every week.');
    if (url.endsWith('/gw/main/README.md'))
      return resp('# gw\n\nFastAPI gateway with Redis token buckets. It has 9 tests and a circuit breaker.');
    if (url.endsWith('requirements.txt')) return resp('fastapi\nredis');
    return resp('', 404);
  };
  it('includes every repo, never skips one for a missing README, and keeps the profile repo out', async () => {
    const r = await indexRepos(new GitHubClient(f), 'u', '2026-11-06');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.meta.projects.map((p) => p.id).sort()).toEqual(['gw', 'noreadme']);
    expect(r.value.forks).toBe(1);
    expect(r.value.profileReadme).toContain('Profile');
    const gw = r.value.meta.projects.find((p) => p.id === 'gw')!;
    expect(gw.stackVerified).toEqual(expect.arrayContaining(['Python', 'FastAPI', 'Redis']));
    expect(gw.readme).toContain('9 tests');
    expect(r.value.meta.index.find((c) => c.id === 'gw')!.roles.BE).toBeGreaterThan(0);
    expect(r.value.partial).toContain('noreadme');
  });
  it('falls back to root manifests when the file list is unavailable', async () => {
    const g: FetchLike = async (url) => (url.includes('/git/trees/') ? resp('', 403) : f(url));
    const r = await indexRepos(new GitHubClient(g), 'u', '2026-11-06');
    expect(r.ok && r.value.meta.projects.find((p) => p.id === 'gw')!.stackVerified).toContain('FastAPI');
  });
  it('rejects bad usernames and maps 404/403', async () => {
    const gh = new GitHubClient(async () => resp('', 404));
    expect((await gh.listRepos('bad name!')).ok).toBe(false);
    const r = await gh.listRepos('nobody');
    expect(!r.ok && r.error.code).toBe('not_found');
    const r2 = await new GitHubClient(async () => resp('', 403)).listRepos('x');
    expect(!r2.ok && r2.error.code).toBe('provider_rate_limit');
  });
});
