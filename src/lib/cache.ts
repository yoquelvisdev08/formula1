/**
 * Stale-while-revalidate cache backed by localStorage.
 *
 * The pattern: read whatever we cached last (even if old) and paint
 * instantly, then kick off a fresh fetch in the background and re-render
 * when it arrives. The dashboard goes from "blank with skeletons for 2s"
 * to "instant content, refreshes silently".
 */

const STORE_PREFIX = "velocity-prime::";

export interface CachedEnvelope<T> {
  data: T;
  ts: number;
}

export function readCache<T>(key: string): CachedEnvelope<T> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    if (typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify({ data, ts: Date.now() } satisfies CachedEnvelope<T>));
  } catch {
    /* quota exceeded — ignore, fresh fetch will run anyway */
  }
}

export interface SwrOptions<T> {
  key: string;
  /** Max age in ms — older cache entries are still surfaced as "stale". */
  maxAge?: number;
  onCached?: (data: T, age: number) => void;
  onFresh?: (data: T) => void;
  onError?: (err: unknown) => void;
}

/**
 * Pure stale-while-revalidate. Calls `onCached` with cached data if any,
 * then awaits `fetcher`, calls `onFresh` (and persists the result).
 */
export async function swr<T>(
  fetcher: () => Promise<T>,
  opts: SwrOptions<T>,
): Promise<T | null> {
  const cached = readCache<T>(opts.key);
  if (cached) {
    const age = Date.now() - cached.ts;
    opts.onCached?.(cached.data, age);
  }
  try {
    const fresh = await fetcher();
    writeCache(opts.key, fresh);
    opts.onFresh?.(fresh);
    return fresh;
  } catch (err) {
    opts.onError?.(err);
    return cached?.data ?? null;
  }
}
