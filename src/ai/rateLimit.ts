// AI Systems & Integration. Soft per-(user, challenge) rate limit.
//
// Default policy from AI_SYSTEMS.md task 4: 3 hints per challenge per
// hour. In-memory by default; swap in a Supabase-backed limiter once
// the telemetry table is live so limits survive page reload.

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until at least one slot frees up. */
  resetMs: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitDecision>;
}

export function hintRateKey(userId: string, challengeId: string): string {
  return `hint:${userId}:${challengeId}`;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly events = new Map<string, number[]>();

  constructor(
    private readonly limit: number = 3,
    private readonly windowMs: number = 60 * 60 * 1000,
  ) {}

  async check(key: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.events.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, oldest + this.windowMs - now),
      };
    }

    recent.push(now);
    this.events.set(key, recent);
    return {
      allowed: true,
      remaining: this.limit - recent.length,
      resetMs: this.windowMs,
    };
  }

  /** Test-only: clear all counters. */
  clear(): void {
    this.events.clear();
  }
}
