import { describe, expect, it } from 'vitest';
import {
  JobProfile,
  Bullet,
  ResumeDraft,
  parseMetaFile,
  serializeMetaFile,
  emptyMeta,
  Settings,
  Profile,
  err,
  ok,
} from './index';

describe('schemas', () => {
  it('accepts a valid JobProfile and rejects a bad role', () => {
    expect(
      JobProfile.safeParse({ roleCode: 'BE', mustHave: ['Python'], niceToHave: [], phrases: [] }).success,
    ).toBe(true);
    expect(JobProfile.safeParse({ roleCode: 'CEO', mustHave: [], niceToHave: [], phrases: [] }).success).toBe(
      false,
    );
  });
  it('applies bullet defaults', () => {
    const b = Bullet.parse({ id: 'x.b1', text: 'Built a thing.' });
    expect(b.status).toBe('ok');
    expect(b.factIds).toEqual([]);
  });
  it('parses an empty draft', () => {
    expect(ResumeDraft.parse({ projects: [] }).gaps).toEqual([]);
  });
  it('round-trips a meta file', () => {
    const meta = emptyMeta('someone', '2026-11-04');
    const text = serializeMetaFile(meta);
    const r = parseMetaFile(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.githubUser).toBe('someone');
  });
  it('rejects unknown meta-file versions and bad JSON', () => {
    const r1 = parseMetaFile({ schema: 'resume-meta/9.9' });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe('unsupported');
    const r2 = parseMetaFile('{nope');
    expect(r2.ok).toBe(false);
  });
  it('has sane settings defaults', () => {
    const s = Settings.parse({});
    expect(s.consentVersion).toBe(0);
    expect(s.engine).toBe('typst');
  });
  it('defaults profile arrays', () => {
    expect(Profile.parse({}).skills).toEqual([]);
  });
  it('marks retryable errors', () => {
    expect(err('provider_rate_limit', 'x').error.retryable).toBe(true);
    expect(err('validation', 'x').error.retryable).toBe(false);
    expect(ok(1).ok).toBe(true);
  });
});
