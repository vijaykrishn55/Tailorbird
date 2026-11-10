import { err, ok, type Result } from '@ra/schemas';
import type { ChatRequest, ChatResponse, LLMProvider } from './types';

export interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  name?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Plain `fetch` adapter for any OpenAI-compatible chat completions endpoint (Groq, OpenAI, Mistral, local servers). */
export function createOpenAICompatible(opts: OpenAICompatibleOptions): LLMProvider {
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const base = opts.baseUrl.replace(/\/+$/, '');

  return {
    name: opts.name ?? 'openai-compatible',
    model: opts.model,
    async complete(req: ChatRequest, signal?: AbortSignal): Promise<Result<ChatResponse>> {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort('timeout'), timeoutMs);
      const onAbort = () => ctl.abort('cancelled');
      signal?.addEventListener('abort', onAbort);
      try {
        const body: Record<string, unknown> = {
          model: opts.model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          temperature: req.temperature ?? 0.2,
          // Reasoning models spend part of this budget thinking, so it must be generous.
          max_tokens: req.maxTokens ?? 4000,
        };
        if (/gpt-oss/i.test(opts.model)) body.reasoning_effort = 'low';
        if (req.json) body.response_format = { type: 'json_object' };
        const send = () =>
          fetchFn(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
            body: JSON.stringify(body),
            signal: ctl.signal,
          });
        let res = await send();
        if (res.status === 400 && (body.response_format || body.reasoning_effort)) {
          // Some providers reject JSON mode or reasoning options. Retry once without them; the reply is validated anyway.
          delete body.response_format;
          delete body.reasoning_effort;
          res = await send();
        }
        if (res.status === 401 || res.status === 403)
          return err('provider_auth', 'The provider rejected the API key.');
        if (res.status === 429) return err('provider_rate_limit', 'The provider is rate limiting requests.');
        if (res.status >= 500) return err('provider_server', `The provider returned status ${res.status}.`);
        if (res.status >= 400)
          return err('provider_bad_request', `The provider returned status ${res.status}.`);
        const data = (await res.json()) as ChatCompletion;
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim())
          return err('provider_server', 'The provider returned an empty reply.');
        return ok({
          text,
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        });
      } catch (e) {
        if (signal?.aborted) return err('cancelled', 'The request was cancelled.');
        if (ctl.signal.aborted) return err('timeout', 'The request took too long.');
        return err('network', 'The network request failed.', e instanceof Error ? e.message : String(e));
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}
