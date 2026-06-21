/**
 * In-memory sliding-window rate limiter.
 * Good enough for single-instance Docker deployment.
 */

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
};

export type RateLimitConfig = { windowMs: number; max: number };

export class RateLimiter {
  private windowMs: number;
  private max: number;
  private hits = new Map<string, number[]>();

  constructor(opts: RateLimitConfig) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.hits.get(key) ?? [];
    timestamps = timestamps.filter((t) => t > windowStart);

    const allowed = timestamps.length < this.max;
    if (allowed) {
      timestamps.push(now);
    }

    this.hits.set(key, timestamps);

    // Periodic cleanup: remove stale keys every 100 checks
    if (Math.random() < 0.01) this.cleanup(now);

    const oldest = timestamps[0] ?? now;
    return {
      allowed,
      remaining: Math.max(0, this.max - timestamps.length),
      limit: this.max,
      resetMs: oldest + this.windowMs - now,
    };
  }

  private cleanup(now: number) {
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      const valid = timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }
}

export const rateLimitConfigs = {
  run: { windowMs: 60_000, max: 10 }, // 10 pipeline runs / min
  chat: { windowMs: 60_000, max: 30 }, // 30 chat messages / min
  price: { windowMs: 60_000, max: 60 }, // 60 price lookups / min
  serp: { windowMs: 60_000, max: 30 }, // 30 provider-backed SERP lookups / min
  videos: { windowMs: 60_000, max: 30 }, // 30 provider-backed video lookups / min
  queryResolve: { windowMs: 60_000, max: 30 }, // 30 query-resolution requests / min
  subscribe: { windowMs: 60_000, max: 5 }, // 5 subscription requests / min
} satisfies Record<string, RateLimitConfig>;

// Pre-configured in-memory fallback limiters for API routes.
export const rateLimiters = {
  run: new RateLimiter(rateLimitConfigs.run),
  chat: new RateLimiter(rateLimitConfigs.chat),
  price: new RateLimiter(rateLimitConfigs.price),
  serp: new RateLimiter(rateLimitConfigs.serp),
  videos: new RateLimiter(rateLimitConfigs.videos),
  queryResolve: new RateLimiter(rateLimitConfigs.queryResolve),
  subscribe: new RateLimiter(rateLimitConfigs.subscribe),
};
