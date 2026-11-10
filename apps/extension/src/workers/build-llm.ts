import {
  MemoryCacheStore,
  RateLimiter,
  ResponseCache,
  createOpenAICompatible,
  createRouter,
  type Llm,
} from '@ra/providers';
import type { WorkerConfig } from './protocol';

/** Build the tiered LLM from settings. The key is only passed in the Authorization header by the provider adapter. */
export function buildLlm(config: WorkerConfig): Llm {
  const { provider, limits } = config.settings;
  const mk = (model: string) =>
    createOpenAICompatible({ baseUrl: provider.baseUrl, apiKey: config.apiKey, model, name: provider.name });
  return createRouter({
    tiers: { fast: [mk(provider.fastModel)], strong: [mk(provider.strongModel)] },
    limiter: new RateLimiter(limits.requestsPerMinute, limits.tokensPerMinute),
    cache: new ResponseCache(new MemoryCacheStore()),
  });
}
