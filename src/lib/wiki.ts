/**
 * Wikipedia REST helper — pulls the thumbnail for any /wiki/<slug> page.
 *
 *  - Endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/<slug>
 *  - Public, CORS-open, no auth. The summary payload includes a
 *    `thumbnail.source` field (typically 120px wide); we rewrite the
 *    URL to request a larger size.
 *  - Results are cached in localStorage *per slug, forever* — driver
 *    portraits don't change. Negative results ("no image") are also
 *    cached as empty strings so we don't refetch missing pages.
 */

// Bumped to v2 — invalidates the broken-resize cache from previous builds.
const CACHE_PREFIX = "velocity-prime::wiki::v2::";
const NEGATIVE_TTL = 24 * 60 * 60_000; // 24h — re-try missing photos next day
const inflight = new Map<string, Promise<string | null>>();

export function extractWikiSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/wiki\/(.+?)(?:[?#]|$)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

interface CacheRecord {
  url: string | null;
  ts: number;
}

function cacheRead(slug: string): string | null | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(CACHE_PREFIX + slug);
  if (raw === null) return undefined;
  try {
    const parsed = JSON.parse(raw) as CacheRecord;
    if (parsed.url) return parsed.url;
    // Negative result — only honour it within the TTL
    if (Date.now() - parsed.ts < NEGATIVE_TTL) return null;
    return undefined;
  } catch {
    // Legacy plain-string entry — treat as positive if non-empty
    return raw || undefined;
  }
}

function cacheWrite(slug: string, value: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const rec: CacheRecord = { url: value, ts: Date.now() };
    localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify(rec));
  } catch { /* quota — ignore */ }
}

/**
 * Historical helper — kept for callers but unused internally.
 *
 * Wikimedia's thumb endpoint refuses any width other than the exact
 * pre-rendered thumbnail. Asking `/200px-…` or `/480px-…` returns HTTP
 * 400 even though `/330px-…` works. So we leave the URL untouched and
 * let CSS `object-fit: cover` scale to the display size.
 */
export function resizeWikiThumb(url: string, _size = 320): string {
  return url;
}

export async function fetchWikiThumbnail(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const cached = cacheRead(slug);
  if (cached !== undefined) return cached;
  const existing = inflight.get(slug);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000);
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);
      if (!res.ok) {
        cacheWrite(slug, null);
        return null;
      }
      const data = await res.json();
      const thumb = data?.thumbnail?.source ?? data?.originalimage?.source ?? null;
      cacheWrite(slug, thumb);
      return thumb;
    } catch {
      return null;
    } finally {
      inflight.delete(slug);
    }
  })();

  inflight.set(slug, promise);
  return promise;
}

/* ============================================================
   Markup helper — call this from the page render to produce a
   self-hydrating photo container. After mounting, call
   `hydratePhotos(root)` to fetch & swap in the real image.
   ============================================================ */

export interface PhotoMarkupInput {
  wikiUrl?: string | null;
  initials: string;
  color: string;
  /** "xs" 32 · "sm" 40 · "md" 56 · "lg" 96 · "xl" 192 px */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Tailwind class overrides for the container */
  class?: string;
}

const SIZE_PX: Record<NonNullable<PhotoMarkupInput["size"]>, number> = {
  xs: 32,
  sm: 40,
  md: 56,
  lg: 96,
  xl: 192,
};

// SIZE_FETCH is retained for the `data-wiki-size` attribute (helpful
// in DevTools) but no longer drives the URL — see `resizeWikiThumb`.
const SIZE_FETCH: Record<NonNullable<PhotoMarkupInput["size"]>, number> = {
  xs: 100,
  sm: 120,
  md: 200,
  lg: 320,
  xl: 320,
};

export function photoMarkup(input: PhotoMarkupInput): string {
  const size = input.size ?? "md";
  const px = SIZE_PX[size];
  const slug = extractWikiSlug(input.wikiUrl) ?? "";
  const fetchSize = SIZE_FETCH[size];
  return `
    <div class="driver-photo relative shrink-0 bg-surface-low border-2 overflow-hidden ${input.class ?? ""}"
         style="border-color:${input.color}; width:${px}px; height:${px}px"
         data-wiki-slug="${slug}"
         data-wiki-size="${fetchSize}">
      <span class="photo-fallback absolute inset-0 flex items-center justify-center font-display font-extrabold"
            style="color:${input.color}; font-size:${Math.floor(px * 0.32)}px">
        ${input.initials}
      </span>
      <img class="photo-img absolute inset-0 h-full w-full object-cover object-top opacity-0 transition-opacity duration-500"
           alt="${input.initials}" decoding="async" />
    </div>
  `;
}

/* ============================================================
   Team logo — same Wikipedia-thumbnail trick, but the thumbnail of
   a constructor's page is its 2026 official logo. Rectangular, fit
   without cropping, falls back to the team name in its own colour.
   ============================================================ */

export interface TeamLogoInput {
  wikiUrl?: string | null;
  name: string;
  color: string;
  /** CSS height; width auto. Default 2.5rem. */
  height?: string;
  class?: string;
}

export function teamLogoMarkup(input: TeamLogoInput): string {
  const slug = extractWikiSlug(input.wikiUrl) ?? "";
  const height = input.height ?? "2.5rem";
  return `
    <div class="team-logo inline-flex items-center justify-center shrink-0 ${input.class ?? ""}"
         style="height:${height}; min-width:${height}"
         data-wiki-slug="${slug}">
      <span class="logo-fallback font-display font-extrabold uppercase tracking-tight whitespace-nowrap"
            style="color:${input.color}; font-size:calc(${height} * 0.55)">${input.name}</span>
      <img class="logo-img hidden h-full w-auto max-w-[8rem] object-contain opacity-0 transition-opacity duration-500"
           alt="${input.name}" decoding="async" />
    </div>
  `;
}

/**
 * Walk a container, fetch any Wikipedia thumbnails referenced by
 * `[data-wiki-slug]` children, then fade-swap the image in.
 * Handles both driver photos (`.driver-photo`) and team logos
 * (`.team-logo`) — the only difference is which CSS class names
 * mark the <img> and fallback element.
 */
export async function hydratePhotos(root: ParentNode = document): Promise<void> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-wiki-slug]"));
  if (!nodes.length) return;
  await Promise.all(nodes.map(async (el) => {
    const slug = el.dataset.wikiSlug;
    if (!slug) return;
    const url = await fetchWikiThumbnail(slug);
    if (!url) return;
    const img = el.querySelector<HTMLImageElement>(".photo-img, .logo-img");
    const fallback = el.querySelector<HTMLElement>(".photo-fallback, .logo-fallback");
    if (!img) return;
    const reveal = (): void => {
      img.classList.remove("hidden");
      img.style.opacity = "1";
      if (fallback) fallback.style.opacity = "0";
    };
    img.onload = reveal;
    img.onerror = () => {
      // Image URL is broken — wipe the cache so we'll re-probe next page load.
      cacheClear(slug);
    };
    img.src = url;
    // The browser may already have the file cached — onload won't fire then.
    if (img.complete && img.naturalHeight > 0) reveal();
  }));
}

/** Alias for clarity at call sites that only hydrate team logos. */
export const hydrateTeamLogos = hydratePhotos;

function cacheClear(slug: string): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(CACHE_PREFIX + slug); }
  catch { /* ignore */ }
}
