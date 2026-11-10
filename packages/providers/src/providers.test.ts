import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { err, ok } from '@ra/schemas';
import {
  CircuitBreaker,
  MemoryCacheStore,
  ResponseCache,
  TokenBucket,
  askJson,
  createOpenAICompatible,
  createRouter,
  extractJson,
  withRetry,
  type Clock,
  type Llm,
  type LLMProvider,
} from './index';

class FakeClock implements Clock {
  t = 0;
  slept: number[] = [];
  now() {
    return this.t;
  }
  async sleep(ms: number) {
    this.slept.push(ms);
    this.t += ms;
  }
}

const mockFetch = (status: number, body: unknown = {}): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('openai-compatible adapter', () => {
  const good = {
    choices: [{ message: { content: 'hi' } }],
    usage: { prompt_tokens: 3, completion_tokens: 1 },
  };
  const make = (f: typeof fetch) =>
    createOpenAICompatible({ baseUrl: 'http://x/v1/', apiKey: 'k', model: 'm', fetchFn: f });

  it('returns text on success', async () => {
    const r = await make(mockFetch(200, good)).complete({ system: 's', user: 'u' });
    expect(r.ok && r.value.text).toBe('hi');
  });
  it('maps status codes to typed errors', async () => {
    const codes: [number, string][] = [
      [400, 'provider_bad_request'],
      [401, 'provider_auth'],
      [429, 'provider_rate_limit'],
      [500, 'provider_server'],
    ];
    for (const [status, code] of codes) {
      const r = await make(mockFetch(status)).complete({ system: 's', user: 'u' });
      expect(!r.ok && r.error.code).toBe(code);
    }
  });
  it('reports a network error and a timeout', async () => {
    const boom = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    const r1 = await make(boom).complete({ system: 's', user: 'u' });
    expect(!r1.ok && r1.error.code).toBe('network');
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) =>
        init.signal?.addEventListener('abort', () => rej(new Error('abort'))),
      )) as unknown as typeof fetch;
    const p = createOpenAICompatible({
      baseUrl: 'http://x',
      apiKey: 'k',
      model: 'm',
      fetchFn: hang,
      timeoutMs: 20,
    });
    const r2 = await p.complete({ system: 's', user: 'u' });
    expect(!r2.ok && r2.error.code).toBe('timeout');
  });
  it('never puts the key in the URL', async () => {
    let seen = '';
    const f = (async (url: string) => {
      seen = url;
      return new Response(JSON.stringify(good), { status: 200 });
    }) as unknown as typeof fetch;
    await make(f).complete({ system: 's', user: 'u' });
    expect(seen).not.toContain('k=');
    expect(seen).toBe('http://x/v1/chat/completions');
  });
});

describe('retry', () => {
  it('retries retryable errors with backoff and stops on success', async () => {
    const clock = new FakeClock();
    let n = 0;
    const r = await withRetry(async () => (++n < 3 ? err('provider_rate_limit', 'x') : ok('done')), {
      clock,
      random: () => 1,
    });
    expect(r.ok).toBe(true);
    expect(n).toBe(3);
    expect(clock.slept.length).toBe(2);
  });
  it('does not retry non-retryable errors', async () => {
    let n = 0;
    const r = await withRetry(async () => (n++, err('provider_auth', 'x')), { clock: new FakeClock() });
    expect(r.ok).toBe(false);
    expect(n).toBe(1);
  });
  it('gives up after the limit', async () => {
    let n = 0;
    await withRetry(async () => (n++, err('network', 'x')), { retries: 2, clock: new FakeClock() });
    expect(n).toBe(3);
  });
});

describe('token bucket and breaker', () => {
  it('refills over time', () => {
    const clock = new FakeClock();
    const b = new TokenBucket(2, 1000, clock);
    expect(b.tryTake()).toBe(true);
    expect(b.tryTake()).toBe(true);
    expect(b.tryTake()).toBe(false);
    clock.t += 500;
    expect(b.tryTake()).toBe(true);
    expect(b.waitMs()).toBeGreaterThan(0);
  });
  it('moves closed -> open -> half-open -> closed', () => {
    const clock = new FakeClock();
    const br = new CircuitBreaker(2, 1000, clock);
    br.failure();
    expect(br.canCall()).toBe(true);
    br.failure();
    expect(br.current()).toBe('open');
    expect(br.canCall()).toBe(false);
    clock.t += 1000;
    expect(br.current()).toBe('half-open');
    br.success();
    expect(br.current()).toBe('closed');
  });
  it('re-opens when the half-open probe fails', () => {
    const clock = new FakeClock();
    const br = new CircuitBreaker(1, 1000, clock);
    br.failure();
    clock.t += 1000;
    br.failure();
    expect(br.current()).toBe('open');
  });
});

describe('cache', () => {
  it('hits, misses and expires', async () => {
    const clock = new FakeClock();
    const c = new ResponseCache(new MemoryCacheStore(), 1000, clock);
    expect(await c.get('a')).toBeUndefined();
    await c.set('a', { text: 'x' });
    expect((await c.get('a'))?.text).toBe('x');
    clock.t += 1001;
    expect(await c.get('a')).toBeUndefined();
  });
});

const scripted = (
  name: string,
  replies: ReturnType<LLMProvider['complete']>[],
): LLMProvider & { calls: number } => {
  const p = {
    name,
    model: name,
    calls: 0,
    async complete() {
      const r = replies[Math.min(p.calls, replies.length - 1)]!;
      p.calls += 1;
      return r;
    },
  };
  return p;
};

describe('router', () => {
  it('falls back to the next provider and caches', async () => {
    const bad = scripted('bad', [Promise.resolve(err('provider_server', 'x'))]);
    const good = scripted('good', [Promise.resolve(ok({ text: 'ok' }))]);
    const clock = new FakeClock();
    const llm = createRouter({
      tiers: { fast: [bad, good], strong: [good] },
      cache: new ResponseCache(new MemoryCacheStore(), 10_000, clock),
      clock,
      retries: 0,
    });
    const r1 = await llm.complete('fast', { system: 's', user: 'u' });
    expect(r1.ok && r1.value.text).toBe('ok');
    const r2 = await llm.complete('fast', { system: 's', user: 'u' });
    expect(r2.ok).toBe(true);
    expect(good.calls).toBe(1);
  });
  it('opens the breaker after repeated failures and skips that provider', async () => {
    const bad = scripted('bad', [Promise.resolve(err('provider_server', 'x'))]);
    const good = scripted('good', [Promise.resolve(ok({ text: 'ok' }))]);
    const llm = createRouter({
      tiers: { fast: [bad, good], strong: [good] },
      clock: new FakeClock(),
      retries: 0,
    });
    for (let i = 0; i < 5; i++) await llm.complete('fast', { system: 's', user: `u${i}` });
    expect(bad.calls).toBe(3);
  });
  it('stops on an auth error without trying fallbacks', async () => {
    const bad = scripted('bad', [Promise.resolve(err('provider_auth', 'x'))]);
    const good = scripted('good', [Promise.resolve(ok({ text: 'ok' }))]);
    const llm = createRouter({
      tiers: { fast: [bad, good], strong: [good] },
      clock: new FakeClock(),
      retries: 0,
    });
    const r = await llm.complete('fast', { system: 's', user: 'u' });
    expect(!r.ok && r.error.code).toBe('provider_auth');
    expect(good.calls).toBe(0);
  });
});

const llmFrom = (texts: string[]): Llm & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    async complete(_t, req) {
      calls.push(req.user);
      return ok({ text: texts[Math.min(calls.length - 1, texts.length - 1)]! });
    },
  };
};

describe('askJson', () => {
  const schema = z.object({ n: z.number() });
  it('accepts valid JSON, including fenced', async () => {
    const llm = llmFrom(['```json\n{"n": 3}\n```']);
    const r = await askJson(llm, schema, 's', 'u');
    expect(r.ok && r.value.n).toBe(3);
  });
  it('repairs by sending the exact error back', async () => {
    const llm = llmFrom(['{"n": "x"}', '{"n": 4}']);
    const r = await askJson(llm, schema, 's', 'u');
    expect(r.ok && r.value.n).toBe(4);
    expect(llm.calls[1]).toContain('n: Expected number');
  });
  it('gives up after two repairs', async () => {
    const llm = llmFrom(['nope']);
    const r = await askJson(llm, schema, 's', 'u');
    expect(!r.ok && r.error.code).toBe('validation');
    expect(llm.calls.length).toBe(3);
  });
  it('applies a refine check', async () => {
    const llm = llmFrom(['{"n": 1}', '{"n": 9}']);
    const r = await askJson(llm, schema, 's', 'u', {
      refine: (v) => ((v as { n: number }).n < 5 ? 'n must be at least 5' : undefined),
    });
    expect(r.ok && r.value.n).toBe(9);
  });
  it('extracts JSON surrounded by prose', () => {
    expect(extractJson('Sure! {"a":1} done')).toEqual({ a: 1 });
  });
});
