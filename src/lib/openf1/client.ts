import { requestQueue } from "./queue";
import type { EndpointMap, EndpointName } from "./types";

const BASE = "https://api.openf1.org/v1";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

/**
 * OpenF1's free tier rate-limits aggressively. Two safeguards:
 *  1. All requests pass through `requestQueue` (2 concurrent, 250ms apart).
 *  2. We DON'T retry on 429 — that just deepens the backoff. We surface
 *     the error and let the queue throttle the next call.
 * 5xx and network errors still get a single retry with linear backoff.
 */
const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1_200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CacheEntry {
  expiresAt: number;
  // biome-ignore lint/suspicious/noExplicitAny: cache stores heterogeneous endpoint payloads
  data: any;
}
const cache = new Map<string, CacheEntry>();

function buildUrl(endpoint: string, params: QueryParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.append(key, String(value));
  }
  const query = qs.toString();
  return `${BASE}/${endpoint}${query ? `?${query}` : ""}`;
}

export interface FetchOptions {
  /** Time-to-live for the in-memory cache in ms. 0 disables. Default depends on endpoint. */
  ttl?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Sensible TTL defaults per endpoint — driver roster and meetings rarely
 * change in a session, weather is sampled ~once a minute, etc. Without
 * these the caller has to remember a TTL on every call and forgetting
 * tanks the rate budget.
 */
const TTL_DEFAULTS: Record<EndpointName, number> = {
  meetings: 5 * 60_000,
  sessions: 60_000,
  drivers: 5 * 60_000,
  laps: 15_000,
  intervals: 5_000,
  position: 5_000,
  car_data: 5_000,
  location: 3_000,
  pit: 20_000,
  stints: 20_000,
  race_control: 15_000,
  weather: 45_000,
  team_radio: 60_000,
  session_result: 5 * 60_000,
  starting_grid: 5 * 60_000,
  overtakes: 60_000,
};

export async function get<K extends EndpointName>(
  endpoint: K,
  params: QueryParams = {},
  opts: FetchOptions = {},
): Promise<EndpointMap[K][]> {
  const url = buildUrl(endpoint, params);
  const ttl = opts.ttl ?? TTL_DEFAULTS[endpoint] ?? 15_000;
  const now = Date.now();

  if (ttl > 0) {
    const hit = cache.get(url);
    if (hit && hit.expiresAt > now) return hit.data as EndpointMap[K][];
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await requestQueue.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const signal = opts.signal
      ? mergeSignals(controller.signal, opts.signal)
      : controller.signal;

    try {
      const res = await fetch(url, { signal, headers: { Accept: "application/json" } });

      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after")) || undefined;
        const waited = requestQueue.triggerBackoff(retryAfter);
        throw new OpenF1Error(
          `OpenF1 ${endpoint} → ${res.status} (rate limited, pausing ${Math.round(waited / 1000)}s)`,
          res.status,
          url,
        );
      }

      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          throw new OpenF1Error(
            `OpenF1 ${endpoint} → ${res.status} ${res.statusText}`,
            res.status,
            url,
          );
        }
        throw new OpenF1Error(
          `OpenF1 ${endpoint} → ${res.status} ${res.statusText}`,
          res.status,
          url,
        );
      }

      const data = (await res.json()) as EndpointMap[K][];
      requestQueue.registerSuccess();
      if (ttl > 0) cache.set(url, { data, expiresAt: now + ttl });
      return data;
    } catch (err) {
      lastError = err;
      const aborted = (err as { name?: string }).name === "AbortError";
      // 429 is never retried — propagate so callers can show stale cache instead.
      const status = err instanceof OpenF1Error ? err.status : 0;
      const isRetryable = !aborted && status >= 500 && status < 600;
      if (attempt < MAX_RETRIES && isRetryable) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      if (aborted) {
        throw new OpenF1Error(
          `OpenF1 ${endpoint} timed out after ${DEFAULT_TIMEOUT}ms`,
          0,
          url,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      requestQueue.release();
    }
  }
  throw lastError;
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = (): void => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return ctrl.signal;
}

export class OpenF1Error extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "OpenF1Error";
    this.status = status;
    this.url = url;
  }
}

/** Drop everything from the in-memory cache. */
export function flushCache(): void {
  cache.clear();
}

/* ============================================================
   Sugar — one helper per endpoint for ergonomic call sites.
   ============================================================ */

export const openf1 = {
  meetings: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("meetings", params, opts),
  sessions: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("sessions", params, opts),
  drivers: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("drivers", params, opts),
  laps: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("laps", params, opts),
  intervals: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("intervals", params, opts),
  position: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("position", params, opts),
  carData: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("car_data", params, opts),
  location: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("location", params, opts),
  pit: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("pit", params, opts),
  stints: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("stints", params, opts),
  raceControl: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("race_control", params, opts),
  weather: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("weather", params, opts),
  teamRadio: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("team_radio", params, opts),
  sessionResult: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("session_result", params, opts),
  startingGrid: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("starting_grid", params, opts),
  overtakes: (params: QueryParams = {}, opts?: FetchOptions) =>
    get("overtakes", params, opts),
};

export { requestQueue } from "./queue";
