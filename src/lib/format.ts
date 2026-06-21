/**
 * Formatting helpers for telemetry display.
 * Keep these tiny and pure — they're called from many components.
 */

/** "1:23.456" from 83.456 seconds. Returns "—" for null/undefined. */
export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (m === 0) return s.toFixed(3);
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** "+1.234" or "+1 LAP" (string passthrough). */
export function formatGap(gap: number | string | null | undefined): string {
  if (gap == null) return "—";
  if (typeof gap === "string") return gap;
  if (gap === 0) return "LEADER";
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap.toFixed(3)}`;
}

/** Sector time → "23.456". */
export function formatSector(s: number | null | undefined): string {
  if (s == null) return "—";
  return s.toFixed(3);
}

export function formatSpeed(kph: number | null | undefined): string {
  if (kph == null) return "—";
  return `${Math.round(kph)}`;
}

export function formatPosition(p: number | null | undefined): string {
  if (p == null) return "—";
  return `P${p}`;
}

/** Date → "Sun, 24 Mar · 15:00". Uses local time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Countdown "2D 14H 32M" between now and target. */
export function formatCountdown(iso: string | null | undefined): string {
  if (!iso) return "—";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "—";
  const diff = target - Date.now();
  if (diff <= 0) return "LIVE";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${minutes}M`;
  return `${minutes}M`;
}

/** Tyre compound → short label. */
export function compoundLabel(c: string | null | undefined): string {
  if (!c) return "—";
  const map: Record<string, string> = {
    SOFT: "S",
    MEDIUM: "M",
    HARD: "H",
    INTERMEDIATE: "I",
    WET: "W",
  };
  return map[c] ?? c.charAt(0);
}

/** Tyre compound → tailwind text color class. */
export function compoundColor(c: string | null | undefined): string {
  switch (c) {
    case "SOFT": return "text-racing";
    case "MEDIUM": return "text-warning";
    case "HARD": return "text-fg";
    case "INTERMEDIATE": return "text-success";
    case "WET": return "text-electric";
    default: return "text-fg-muted";
  }
}

/** "#FF1801" from "FF1801" (OpenF1 returns raw hex). */
export function teamHex(colour: string | null | undefined): string {
  if (!colour) return "#6f7070";
  return colour.startsWith("#") ? colour : `#${colour}`;
}

// ISO-3 → ISO-2 lookup, exposed so flag helpers below can share it.
export const ISO3_TO_ISO2: Record<string, string> = {
  GBR: "GB", NED: "NL", MON: "MC", ESP: "ES", AUS: "AU",
  THA: "TH", MEX: "MX", FRA: "FR", JPN: "JP", DEN: "DK",
  GER: "DE", FIN: "FI", CAN: "CA", USA: "US", CHN: "CN",
  NZL: "NZ", ITA: "IT", BEL: "BE", BRA: "BR", AUT: "AT",
  SUI: "CH", POR: "PT", IND: "IN", RSA: "ZA", ARG: "AR",
  HUN: "HU", POL: "PL", SWE: "SE", BHR: "BH", SAU: "SA",
  AZE: "AZ", QAT: "QA", UAE: "AE", SGP: "SG", TUR: "TR",
};

function to2(code: string): string {
  const upper = code.toUpperCase();
  return (ISO3_TO_ISO2[upper] ?? upper).slice(0, 2);
}

/**
 * Country code → flag emoji ("US" → "🇺🇸").
 * NOTE: Windows does NOT render regional-indicator pairs as flags —
 * it shows the letters. For UI surfaces use `flagImg()` instead, which
 * embeds a cross-platform Twemoji SVG.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length < 2) return "";
  const c = to2(code);
  if (c.length !== 2) return "";
  const base = 0x1f1e6;
  const A = "A".charCodeAt(0);
  return String.fromCodePoint(base + (c.charCodeAt(0) - A), base + (c.charCodeAt(1) - A));
}

/* ============================================================
   Shared name → ISO-2 maps, used to derive flags for nationalities
   (drivers) and country names (race meetings, constructors).
   ============================================================ */

export const NATIONALITY_TO_CODE: Record<string, string> = {
  Dutch: "NL", British: "GB", German: "DE", Spanish: "ES",
  Monégasque: "MC", Monegasque: "MC", Australian: "AU", Mexican: "MX",
  French: "FR", Japanese: "JP", Danish: "DK", Canadian: "CA",
  American: "US", Chinese: "CN", "New Zealander": "NZ", Italian: "IT",
  Belgian: "BE", Brazilian: "BR", Austrian: "AT", Swiss: "CH",
  Portuguese: "PT", Indian: "IN", "South African": "ZA", Argentine: "AR",
  Argentinian: "AR", Hungarian: "HU", Polish: "PL", Swedish: "SE",
  Finnish: "FI", Russian: "RU", Thai: "TH", Saudi: "SA",
  Venezuelan: "VE", Colombian: "CO", Malaysian: "MY", Indonesian: "ID",
  Turkish: "TR", Czech: "CZ", Estonian: "EE", Liechtensteiner: "LI",
  Irish: "IE", Scottish: "GB", Welsh: "GB",
};

export const COUNTRY_TO_CODE: Record<string, string> = {
  Australia: "AU", Bahrain: "BH", "Saudi Arabia": "SA", Japan: "JP",
  China: "CN", USA: "US", "United States": "US", Italy: "IT",
  Monaco: "MC", Spain: "ES", Canada: "CA", Austria: "AT",
  UK: "GB", "United Kingdom": "GB", Hungary: "HU", Belgium: "BE",
  Netherlands: "NL", Singapore: "SG", Azerbaijan: "AZ", Mexico: "MX",
  Brazil: "BR", Qatar: "QA", UAE: "AE", "United Arab Emirates": "AE",
  France: "FR", Germany: "DE", Portugal: "PT", Russia: "RU",
  Turkey: "TR", Argentina: "AR", Malaysia: "MY", Thailand: "TH",
  Switzerland: "CH", India: "IN",
};

export function flagFromNationality(nationality: string | null | undefined): string {
  if (!nationality) return "";
  const code = NATIONALITY_TO_CODE[nationality];
  return code ? countryFlag(code) : "";
}

export function flagFromCountry(country: string | null | undefined): string {
  if (!country) return "";
  const code = COUNTRY_TO_CODE[country];
  return code ? countryFlag(code) : "";
}

/* ============================================================
   Twemoji-backed flag images — work identically on Windows,
   macOS, Linux, iOS and Android. Use these in any innerHTML
   surface so the flag actually renders for everyone.
   ============================================================ */

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";
const CHECKERED_FLAG = `<span class="inline-block align-[-0.15em]" style="font-size:1.1em">🏁</span>`;

function regionalCodepoints(code: string): string | null {
  if (code.length !== 2) return null;
  const A = "A".charCodeAt(0);
  const base = 0x1f1e6;
  const c1 = (base + (code.charCodeAt(0) - A)).toString(16);
  const c2 = (base + (code.charCodeAt(1) - A)).toString(16);
  return `${c1}-${c2}`;
}

export interface FlagImgOptions {
  /** CSS height of the rendered flag. Width auto-scales. Default 1.2em. */
  size?: string;
  /** Optional extra Tailwind classes. */
  class?: string;
  /** Alt text override (defaults to the country code). */
  alt?: string;
}

/**
 * Returns an `<img>` markup string pointing at a Twemoji SVG flag.
 * Drop the result straight into `innerHTML`. Falls back to a checkered
 * flag glyph if no code is given.
 */
export function flagImg(code: string | null | undefined, opts: FlagImgOptions = {}): string {
  if (!code) return CHECKERED_FLAG;
  const c = to2(code);
  const cps = regionalCodepoints(c);
  if (!cps) return CHECKERED_FLAG;
  const size = opts.size ?? "1.2em";
  const alt = opts.alt ?? c;
  const extra = opts.class ?? "";
  return `<img src="${TWEMOJI_BASE}/${cps}.svg" alt="${alt}" class="inline-block align-[-0.15em] ${extra}" style="height:${size};width:auto;flex-shrink:0" loading="lazy" decoding="async" />`;
}

export function flagImgFromCountry(country: string | null | undefined, opts: FlagImgOptions = {}): string {
  const code = country ? COUNTRY_TO_CODE[country] : null;
  return flagImg(code, { ...opts, alt: opts.alt ?? country ?? undefined });
}

export function flagImgFromNationality(nationality: string | null | undefined, opts: FlagImgOptions = {}): string {
  const code = nationality ? NATIONALITY_TO_CODE[nationality] : null;
  return flagImg(code, { ...opts, alt: opts.alt ?? nationality ?? undefined });
}
