// AI Systems & Integration. Cache for LLM judge / hint results.
//
// Key shape: `${challengeId}:${sha256(shaderSource)}`. Same shader on
// the same challenge must hit cache, never the API. The default
// implementation is in-memory; Content & Backend can plug in a
// Supabase-backed `AICache` when the `judge_cache` table lands.

export interface AICache<V> {
  get(key: string): Promise<V | null>;
  set(key: string, value: V): Promise<void>;
}

export function cacheKey(challengeId: string, shaderHashHex: string): string {
  return `${challengeId}:${shaderHashHex}`;
}

/**
 * SHA-256 of a shader source, hex-encoded. Uses Web Crypto, available
 * in modern browsers and node 18+.
 */
export async function shaderHash(source: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  );
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export class InMemoryCache<V> implements AICache<V> {
  private readonly store = new Map<string, V>();

  async get(key: string): Promise<V | null> {
    return this.store.has(key) ? (this.store.get(key) as V) : null;
  }

  async set(key: string, value: V): Promise<void> {
    this.store.set(key, value);
  }

  /** Test-only: clear the cache between runs. */
  clear(): void {
    this.store.clear();
  }
}
