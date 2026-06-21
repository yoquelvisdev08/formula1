/**
 * Jolpica F1 (Ergast-compatible) client.
 *
 * Jolpica's free tier is far more generous than OpenF1's — practical
 * limits sit around 500 requests/hour with no token. We still queue
 * politely (1.5 concurrent average via min spacing) and cache
 * aggressively, since season-wide data barely changes within a day.
 */

import type { MRDataEnvelope } from "./types";

const BASE = "https://api.jolpi.ca/ergast/f1";
const DEFAULT_TIMEOUT = 20_000;
const MIN_SPACING_MS = 150;
const MAX_CONCURRENT = 3;

let active = 0;
const waiting: (() => void)[] = [];
let lastStart = 0;

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    const tryAcquire = (): void => {
      const now = Date.now();
      if (active >= MAX_CONCURRENT) {
        waiting.push(tryAcquire);
        return;
      }
      const sinceLast = now - lastStart;
      if (sinceLast < MIN_SPACING_MS) {
        setTimeout(tryAcquire, MIN_SPACING_MS - sinceLast);
        return;
      }
      active++;
      lastStart = Date.now();
      resolve();
    };
    tryAcquire();
  });
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = waiting.shift();
  if (next) next();
}

interface CacheEntry {
  expiresAt: number;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous payloads
  data: any;
}
const cache = new Map<string, CacheEntry>();

export class JolpicaError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "JolpicaError";
    this.status = status;
    this.url = url;
  }
}

export interface JolpicaFetchOptions {
  /** TTL in ms; default 5 min for stable season data. */
  ttl?: number;
  signal?: AbortSignal;
  /** Override result limit (Ergast pagination, default 30). */
  limit?: number;
}

/**
 * Low-level fetcher — pass an Ergast-style path (without the .json suffix)
 * and get back the typed envelope. Use the typed wrappers below in app code.
 */
export async function fetchJolpica<T>(
  path: string,
  opts: JolpicaFetchOptions = {},
): Promise<T> {
  const limit = opts.limit ?? 100;
  const url = `${BASE}/${path}.json?limit=${limit}`;
  const ttl = opts.ttl ?? 5 * 60_000;
  const now = Date.now();

  if (ttl > 0) {
    const hit = cache.get(url);
    if (hit && hit.expiresAt > now) return hit.data as T;
  }

  await acquire();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  const signal = opts.signal ? mergeSignals(controller.signal, opts.signal) : controller.signal;

  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new JolpicaError(`Jolpica ${path} → ${res.status} ${res.statusText}`, res.status, url);
    }
    const envelope = (await res.json()) as MRDataEnvelope<T>;
    const data = envelope.MRData as unknown as T;
    if (ttl > 0) cache.set(url, { data, expiresAt: now + ttl });
    return data;
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new JolpicaError(`Jolpica ${path} timed out after ${DEFAULT_TIMEOUT}ms`, 0, url);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    release();
  }
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = (): void => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return ctrl.signal;
}

export function flushJolpicaCache(): void {
  cache.clear();
}
