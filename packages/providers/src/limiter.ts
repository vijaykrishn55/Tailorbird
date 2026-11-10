import { systemClock, type Clock } from './types';

/** Token bucket. `capacity` tokens refill evenly over `perMs`. */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(
    private readonly capacity: number,
    private readonly perMs: number,
    private readonly clock: Clock = systemClock,
  ) {
    this.tokens = capacity;
    this.last = clock.now();
  }

  private refill(): void {
    const now = this.clock.now();
    const add = ((now - this.last) / this.perMs) * this.capacity;
    this.tokens = Math.min(this.capacity, this.tokens + add);
    this.last = now;
  }

  /** Take `n` tokens if available. */
  tryTake(n = 1): boolean {
    this.refill();
    if (n > this.capacity) return false;
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /** Milliseconds until `n` tokens would be available. */
  waitMs(n = 1): number {
    this.refill();
    if (this.tokens >= n) return 0;
    return Math.ceil(((n - this.tokens) / this.capacity) * this.perMs);
  }

  async take(n = 1, signal?: AbortSignal): Promise<boolean> {
    if (n > this.capacity) return false;
    for (;;) {
      if (this.tryTake(n)) return true;
      try {
        await this.clock.sleep(this.waitMs(n), signal);
      } catch {
        return false;
      }
    }
  }
}

export class RateLimiter {
  private readonly requests: TokenBucket;
  private readonly tokens: TokenBucket;
  constructor(
    requestsPerMinute: number,
    private readonly tokensPerMinute: number,
    clock: Clock = systemClock,
  ) {
    this.requests = new TokenBucket(requestsPerMinute, 60_000, clock);
    this.tokens = new TokenBucket(tokensPerMinute, 60_000, clock);
  }
  /** Wait for a request slot and an estimated token allowance (clamped to one minute's budget). */
  async acquire(estimatedTokens: number, signal?: AbortSignal): Promise<boolean> {
    const t = Math.min(Math.max(1, estimatedTokens), this.tokensPerMinute);
    if (!(await this.requests.take(1, signal))) return false;
    return this.tokens.take(t, signal);
  }
}
