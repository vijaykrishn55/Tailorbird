import { err, ok, type Result } from '@ra/schemas';
import { CircuitBreaker } from './breaker';
import { cacheKey, ResponseCache } from './cache';
import { RateLimiter } from './limiter';
import { withRetry } from './retry';
import {
  systemClock,
  type ChatRequest,
  type ChatResponse,
  type Clock,
  type Llm,
  type LLMProvider,
  type Tier,
} from './types';

export interface RouterOptions {
  /** Providers per tier, in fallback order. */
  tiers: Record<Tier, LLMProvider[]>;
  limiter?: RateLimiter;
  cache?: ResponseCache;
  clock?: Clock;
  retries?: number;
  /** Called with a short stage note for each real provider call (for the trace). */
  onCall?: (info: { tier: Tier; provider: string; model: string; cached: boolean; ok: boolean }) => void;
}

const estimateTokens = (req: ChatRequest) =>
  Math.ceil((req.system.length + req.user.length) / 4) + (req.maxTokens ?? 800);

export function createRouter(opts: RouterOptions): Llm {
  const clock = opts.clock ?? systemClock;
  const breakers = new Map<LLMProvider, CircuitBreaker>();
  const breakerFor = (p: LLMProvider) => {
    let b = breakers.get(p);
    if (!b) {
      b = new CircuitBreaker(3, 30_000, clock);
      breakers.set(p, b);
    }
    return b;
  };

  return {
    async complete(tier, req, signal): Promise<Result<ChatResponse>> {
      const providers = opts.tiers[tier];
      if (!providers || providers.length === 0)
        return err('not_found', 'No provider is configured for this step.');
      let lastError: Result<ChatResponse> | undefined;
      for (const provider of providers) {
        const breaker = breakerFor(provider);
        if (!breaker.canCall()) continue;
        const key = opts.cache ? await cacheKey(provider.model, req) : '';
        if (opts.cache) {
          const hit = await opts.cache.get(key);
          if (hit) {
            opts.onCall?.({ tier, provider: provider.name, model: provider.model, cached: true, ok: true });
            return ok(hit);
          }
        }
        if (opts.limiter && !(await opts.limiter.acquire(estimateTokens(req), signal)))
          return err('cancelled', 'The request was cancelled.');
        const res = await withRetry(() => provider.complete(req, signal), {
          retries: opts.retries ?? 2,
          clock,
          signal,
        });
        opts.onCall?.({ tier, provider: provider.name, model: provider.model, cached: false, ok: res.ok });
        if (res.ok) {
          breaker.success();
          if (opts.cache) await opts.cache.set(key, res.value);
          return res;
        }
        lastError = res;
        if (res.error.code === 'cancelled') return res;
        if (res.error.code === 'provider_auth') return res;
        if (res.error.retryable) breaker.failure();
      }
      return lastError ?? err('provider_server', 'All providers are unavailable right now.');
    },
  };
}
