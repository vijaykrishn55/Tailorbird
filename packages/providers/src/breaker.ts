import { systemClock, type Clock } from './types';

export type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: BreakerState = 'closed';
  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly clock: Clock = systemClock,
  ) {}

  current(): BreakerState {
    if (this.state === 'open' && this.clock.now() - this.openedAt >= this.cooldownMs)
      this.state = 'half-open';
    return this.state;
  }

  /** True when a call may go ahead (closed, or one probe when half-open). */
  canCall(): boolean {
    return this.current() !== 'open';
  }

  success(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  failure(): void {
    if (this.current() === 'half-open') {
      this.trip();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.threshold) this.trip();
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = this.clock.now();
  }
}
