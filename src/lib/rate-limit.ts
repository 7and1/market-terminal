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

export class RateLimiter {
  private windowMs: number;
  private max: number;
  private hits = new Map<string, number[]>();

  constructor(opts: { windowMs: number; max: number }) {
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

// Pre-configured limiters for API routes
export const rateLimiters = {
  run: new RateLimiter({ windowMs: 60_000, max: 10 }), // 10 pipeline runs / min
  chat: new RateLimiter({ windowMs: 60_000, max: 30 }), // 30 chat messages / min
  price: new RateLimiter({ windowMs: 60_000, max: 60 }), // 60 price lookups / min
};
