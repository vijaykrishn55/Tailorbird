import { systemClock, type ChatRequest, type ChatResponse, type Clock } from './types';

export interface CacheStore {
  get(key: string): Promise<{ value: ChatResponse; expiresAt: number } | undefined>;
  set(key: string, entry: { value: ChatResponse; expiresAt: number }): Promise<void>;
}

export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, { value: ChatResponse; expiresAt: number }>();
  async get(key: string) {
    return this.map.get(key);
  }
  async set(key: string, entry: { value: ChatResponse; expiresAt: number }) {
    this.map.set(key, entry);
  }
  get size(): number {
    return this.map.size;
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cacheKey(model: string, req: ChatRequest): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      model,
      req.system,
      req.user,
      req.json ?? false,
      req.temperature ?? 0.2,
      req.maxTokens ?? 0,
    ]),
  );
}

export class ResponseCache {
  constructor(
    private readonly store: CacheStore,
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly clock: Clock = systemClock,
  ) {}
  async get(key: string): Promise<ChatResponse | undefined> {
    const hit = await this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.clock.now()) return undefined;
    return hit.value;
  }
  async set(key: string, value: ChatResponse): Promise<void> {
    await this.store.set(key, { value, expiresAt: this.clock.now() + this.ttlMs });
  }
}
