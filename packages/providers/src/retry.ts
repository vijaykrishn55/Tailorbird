import type { Result } from '@ra/schemas';
import { systemClock, type Clock } from './types';

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  clock?: Clock;
  random?: () => number;
  signal?: AbortSignal;
}

/** Retries only when the error is marked retryable (429, 5xx, network, timeout). */
export async function withRetry<T>(
  fn: () => Promise<Result<T>>,
  opts: RetryOptions = {},
): Promise<Result<T>> {
  const retries = opts.retries ?? 2;
  const base = opts.baseMs ?? 500;
  const max = opts.maxMs ?? 8000;
  const clock = opts.clock ?? systemClock;
  const rand = opts.random ?? Math.random;
  let last: Result<T> = await fn();
  for (let i = 0; i < retries; i++) {
    if (last.ok || !last.error.retryable || opts.signal?.aborted) return last;
    const delay = Math.min(max, base * 2 ** i) * (0.5 + rand() / 2);
    try {
      await clock.sleep(delay, opts.signal);
    } catch {
      return last;
    }
    last = await fn();
  }
  return last;
}
