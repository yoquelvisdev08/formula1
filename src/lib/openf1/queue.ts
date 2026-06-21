/**
 * Global request scheduler for the OpenF1 free tier.
 *
 *  - Max 2 concurrent in-flight requests
 *  - Min 250ms between successive request starts (~4 req/sec ceiling)
 *  - On a 429 response, ALL queued requests are paused until the
 *    backoff window expires. Subsequent 429s double the window
 *    (5s → 10s → 20s → 40s, capped at 60s) and decay back to 5s on
 *    any successful response.
 *  - Listeners can subscribe to `onBackoffChange` to surface a UI hint.
 *
 * This is the only place that gates network access for the API client.
 */

type Listener = (msRemaining: number) => void;

class RequestQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  private lastStart = 0;
  private backoffUntil = 0;
  private currentBackoff = 5_000;
  private listeners = new Set<Listener>();
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly maxConcurrent: number = 2,
    private readonly minSpacingMs: number = 250,
  ) {}

  /** Wait until a request slot is free, respecting concurrency, spacing, backoff. */
  acquire(): Promise<void> {
    return new Promise((resolve) => {
      const tryAcquire = (): void => {
        const now = Date.now();
        if (now < this.backoffUntil) {
          const wait = this.backoffUntil - now;
          this.scheduleNotify();
          setTimeout(tryAcquire, wait + 10);
          return;
        }
        if (this.active >= this.maxConcurrent) {
          this.waiting.push(tryAcquire);
          return;
        }
        const sinceLast = now - this.lastStart;
        if (sinceLast < this.minSpacingMs) {
          setTimeout(tryAcquire, this.minSpacingMs - sinceLast);
          return;
        }
        this.active++;
        this.lastStart = Date.now();
        resolve();
      };
      tryAcquire();
    });
  }

  /** Release a slot after a request completes. */
  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiting.shift();
    if (next) next();
  }

  /**
   * Triggered when a 429 (or 503 with Retry-After) is received. Doubles
   * the backoff window, capped at 60s. Honours the API's Retry-After if
   * the header is larger than our computed value.
   */
  triggerBackoff(retryAfterSec?: number): number {
    const fromHeader = retryAfterSec ? retryAfterSec * 1000 : 0;
    const fromState = this.currentBackoff;
    const window = Math.max(fromHeader, fromState);
    this.backoffUntil = Math.max(this.backoffUntil, Date.now() + window);
    this.currentBackoff = Math.min(60_000, this.currentBackoff * 2);
    this.notify();
    return window;
  }

  /** Called on any successful response — decays the backoff. */
  registerSuccess(): void {
    if (this.currentBackoff > 5_000) this.currentBackoff = 5_000;
  }

  /** ms remaining in the active backoff window (0 if not throttled). */
  remaining(): number {
    return Math.max(0, this.backoffUntil - Date.now());
  }

  onBackoffChange(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.remaining());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const remaining = this.remaining();
    for (const l of this.listeners) {
      try { l(remaining); } catch { /* listener errors are not our problem */ }
    }
  }

  private scheduleNotify(): void {
    if (this.notifyTimer) return;
    const tick = (): void => {
      this.notify();
      if (this.remaining() > 0) {
        this.notifyTimer = setTimeout(tick, 500);
      } else {
        this.notifyTimer = null;
      }
    };
    this.notifyTimer = setTimeout(tick, 500);
  }
}

export const requestQueue = new RequestQueue(2, 250);
export type { Listener as QueueListener };
