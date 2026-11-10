import type { Result } from '@ra/schemas';

export type Tier = 'fast' | 'strong';

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      });
    }),
};

export interface ChatRequest {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(req: ChatRequest, signal?: AbortSignal): Promise<Result<ChatResponse>>;
}

/** What the rest of the engine sees: a tiered, validated LLM. */
export interface Llm {
  complete(tier: Tier, req: ChatRequest, signal?: AbortSignal): Promise<Result<ChatResponse>>;
}
