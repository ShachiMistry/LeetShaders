// AI Systems & Integration. Telemetry sinks for LLM call logs.
// See AI_SYSTEMS.md task 6.
//
// `anthropic.ts` exposes `onTelemetry(listener)` as the emission
// hook. This module provides the concrete sinks: an in-memory one
// for tests, a console one for dev, and a Supabase-backed sink that
// plugs in once Content & Backend lands the telemetry table.
//
// Keep the schema flat per task 6: one table, the columns are
// exactly the fields on `TelemetryEvent`.

import { onTelemetry, type TelemetryEvent } from './anthropic';

export type { TelemetryEvent };

export interface TelemetrySink {
  write(event: TelemetryEvent): void | Promise<void>;
}

/** Register a sink. Returns an unsubscribe function. */
export function registerSink(sink: TelemetrySink): () => void {
  return onTelemetry((event) => sink.write(event));
}

/** Captures events in memory for inspection in tests. */
export class MemorySink implements TelemetrySink {
  readonly events: TelemetryEvent[] = [];
  write(event: TelemetryEvent): void {
    this.events.push(event);
  }
  clear(): void {
    this.events.length = 0;
  }
}

/** Logs a terse one-liner per call. Useful during dev. */
export class ConsoleSink implements TelemetrySink {
  write(event: TelemetryEvent): void {
    const cache = event.cacheHit ? ' (cache)' : '';
    console.debug(
      `[anthropic] ${event.model} in=${event.inputTokens} out=${event.outputTokens} ${event.latencyMs.toFixed(0)}ms${cache}`,
    );
  }
}

/**
 * Shape expected from a Supabase-compatible client. Declared here so
 * we don't have to import the Supabase SDK just to type-check this
 * module. Content & Backend wires the real client at registration
 * time.
 */
export interface SupabaseLike {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Supabase sink. Batching is intentionally omitted - call volume is
 * low (only borderline submissions invoke the LLM) and the extra
 * complexity isn't worth it yet. Failures are swallowed after a
 * debug log so telemetry can never break the user's submit flow.
 */
export class SupabaseSink implements TelemetrySink {
  constructor(
    private readonly client: SupabaseLike,
    private readonly table: string = 'llm_telemetry',
  ) {}

  async write(event: TelemetryEvent): Promise<void> {
    try {
      const { error } = await this.client.from(this.table).insert({
        model: event.model,
        input_tokens: event.inputTokens,
        output_tokens: event.outputTokens,
        latency_ms: event.latencyMs,
        cache_hit: event.cacheHit,
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.debug(`[telemetry] supabase insert failed: ${error.message}`);
      }
    } catch (err) {
      console.debug(
        `[telemetry] supabase sink threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
