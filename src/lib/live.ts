/**
 * Live-state helpers — build composite views from raw OpenF1 endpoints.
 * Used by client-side scripts to render the dashboard / live timing.
 *
 * Strategy for the OpenF1 free tier:
 *  1. Fetch session metadata first (small, cheap).
 *  2. If the session is currently live, narrow telemetry queries with
 *     `date>=<now-2min>` so we only pull the last few samples per driver
 *     instead of the whole session history (which on a race can be
 *     hundreds of thousands of rows).
 *  3. Use Promise.allSettled so a single slow / failing endpoint never
 *     blanks the whole dashboard — partial data is better than nothing.
 */
import { openf1 } from "./openf1/client";
import type {
  Driver,
  Interval,
  Lap,
  Position,
  Session,
  Stint,
  Weather,
} from "./openf1/types";

export interface DriverTimingRow {
  driver: Driver;
  position: number | null;
  gap_to_leader: number | string | null;
  interval: number | string | null;
  last_lap: number | null;
  best_lap: number | null;
  sector_1: number | null;
  sector_2: number | null;
  sector_3: number | null;
  compound: string | null;
  tyre_age: number | null;
  stint_laps: number | null;
}

/** Latest entry per driver — works on date-ordered streams from OpenF1. */
export function latestPerDriver<T extends { driver_number: number; date?: string | null }>(items: T[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const item of items) {
    const prev = map.get(item.driver_number);
    if (!prev) {
      map.set(item.driver_number, item);
      continue;
    }
    const a = item.date ? Date.parse(item.date) : 0;
    const b = prev.date ? Date.parse(prev.date) : 0;
    if (a >= b) map.set(item.driver_number, item);
  }
  return map;
}

/** Best lap (lowest duration) per driver. */
export function bestLapPerDriver(laps: Lap[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const lap of laps) {
    if (lap.lap_duration == null) continue;
    const prev = map.get(lap.driver_number);
    if (prev == null || lap.lap_duration < prev) {
      map.set(lap.driver_number, lap.lap_duration);
    }
  }
  return map;
}

/** Latest lap (highest lap number) per driver. */
export function latestLapPerDriver(laps: Lap[]): Map<number, Lap> {
  const map = new Map<number, Lap>();
  for (const lap of laps) {
    const prev = map.get(lap.driver_number);
    if (!prev || lap.lap_number > prev.lap_number) {
      map.set(lap.driver_number, lap);
    }
  }
  return map;
}

/** Active stint per driver (highest stint_number). */
export function activeStintPerDriver(stints: Stint[]): Map<number, Stint> {
  const map = new Map<number, Stint>();
  for (const stint of stints) {
    const prev = map.get(stint.driver_number);
    if (!prev || stint.stint_number > prev.stint_number) {
      map.set(stint.driver_number, stint);
    }
  }
  return map;
}

/**
 * Detect whether the latest session is currently live.
 * OpenF1 doesn't publish a "live" flag, so we check date_start <= now <= date_end.
 */
export function isSessionLive(session: { date_start: string; date_end: string } | null): boolean {
  if (!session) return false;
  const now = Date.now();
  const start = Date.parse(session.date_start);
  const end = Date.parse(session.date_end);
  return now >= start && now <= end;
}

export interface LiveSnapshot {
  session: Session | null;
  drivers: Driver[];
  rows: DriverTimingRow[];
  weather: Weather | null;
  /** Endpoints that failed during this snapshot, for UI degradation. */
  failures: string[];
}

const RECENT_WINDOW_MS = 2 * 60_000; // 2 minutes

function settled<T>(result: PromiseSettledResult<T>, fallback: T, failures: string[], label: string): T {
  if (result.status === "fulfilled") return result.value;
  failures.push(label);
  if (typeof console !== "undefined") {
    console.warn(`[openf1] ${label} failed:`, result.reason);
  }
  return fallback;
}

/**
 * Pull a snapshot for the latest session — drivers, positions, intervals,
 * laps (best/last), stints, weather. Returns whatever succeeds.
 */
export async function fetchLiveSnapshot(): Promise<LiveSnapshot> {
  // Phase 1 — small, critical metadata. If THIS fails we can't continue.
  const [sessionRes, driversRes] = await Promise.allSettled([
    openf1.sessions({ session_key: "latest" }, { ttl: 10_000 }),
    openf1.drivers({ session_key: "latest" }, { ttl: 60_000 }),
  ]);

  const failures: string[] = [];
  const sessionList = settled(sessionRes, [] as Session[], failures, "sessions");
  const drivers = settled(driversRes, [] as Driver[], failures, "drivers");
  const session = sessionList.at(-1) ?? null;

  // Phase 2 — telemetry. If the session is live, narrow the time window so
  // the free tier doesn't have to ship the whole session every refresh.
  const live = isSessionLive(session);
  const sinceIso = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const recentParams = live
    ? { session_key: "latest" as const, "date>=": sinceIso }
    : { session_key: "latest" as const };

  const [posRes, intRes, lapRes, stintRes, weatherRes] = await Promise.allSettled([
    openf1.position(recentParams, { ttl: 4_000 }),
    openf1.intervals(recentParams, { ttl: 4_000 }),
    openf1.laps({ session_key: "latest" }, { ttl: 10_000 }),
    openf1.stints({ session_key: "latest" }, { ttl: 15_000 }),
    openf1.weather(recentParams, { ttl: 30_000 }),
  ]);

  const positions = settled(posRes, [] as Position[], failures, "position");
  const intervals = settled(intRes, [] as Interval[], failures, "intervals");
  const laps = settled(lapRes, [] as Lap[], failures, "laps");
  const stints = settled(stintRes, [] as Stint[], failures, "stints");
  const weather = settled(weatherRes, [] as Weather[], failures, "weather");

  const lastPosition = latestPerDriver(positions);
  const lastInterval = latestPerDriver(intervals);
  const lastLap = latestLapPerDriver(laps);
  const bestLap = bestLapPerDriver(laps);
  const activeStint = activeStintPerDriver(stints);

  const rows: DriverTimingRow[] = drivers.map((driver) => {
    const lap = lastLap.get(driver.driver_number);
    const stint = activeStint.get(driver.driver_number);
    return {
      driver,
      position: lastPosition.get(driver.driver_number)?.position ?? null,
      gap_to_leader: lastInterval.get(driver.driver_number)?.gap_to_leader ?? null,
      interval: lastInterval.get(driver.driver_number)?.interval ?? null,
      last_lap: lap?.lap_duration ?? null,
      best_lap: bestLap.get(driver.driver_number) ?? null,
      sector_1: lap?.duration_sector_1 ?? null,
      sector_2: lap?.duration_sector_2 ?? null,
      sector_3: lap?.duration_sector_3 ?? null,
      compound: stint?.compound ?? null,
      tyre_age: stint ? stint.tyre_age_at_start + (lap?.lap_number ?? stint.lap_start) - stint.lap_start : null,
      stint_laps: stint ? (lap?.lap_number ?? stint.lap_start) - stint.lap_start + 1 : null,
    };
  });

  rows.sort((a, b) => {
    if (a.position == null && b.position == null) return 0;
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return a.position - b.position;
  });

  const latestWeather = weather.at(-1) ?? null;
  return { session, drivers, rows, weather: latestWeather, failures };
}

/**
 * Lightweight snapshot for the dashboard hero — skips laps + stints to
 * keep the very first paint fast on the free tier.
 */
export interface HeroSnapshot {
  session: Session | null;
  driversCount: number;
  topRows: { driver: Driver; position: number | null; gap_to_leader: number | string | null }[];
  weather: Weather | null;
  failures: string[];
}

export async function fetchHeroSnapshot(): Promise<HeroSnapshot> {
  const [sessionRes, driversRes] = await Promise.allSettled([
    openf1.sessions({ session_key: "latest" }, { ttl: 10_000 }),
    openf1.drivers({ session_key: "latest" }, { ttl: 60_000 }),
  ]);

  const failures: string[] = [];
  const sessionList = settled(sessionRes, [] as Session[], failures, "sessions");
  const drivers = settled(driversRes, [] as Driver[], failures, "drivers");
  const session = sessionList.at(-1) ?? null;

  const live = isSessionLive(session);
  const sinceIso = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const recentParams = live
    ? { session_key: "latest" as const, "date>=": sinceIso }
    : { session_key: "latest" as const };

  const [posRes, intRes, weatherRes] = await Promise.allSettled([
    openf1.position(recentParams, { ttl: 4_000 }),
    openf1.intervals(recentParams, { ttl: 4_000 }),
    openf1.weather(recentParams, { ttl: 30_000 }),
  ]);

  const positions = settled(posRes, [] as Position[], failures, "position");
  const intervals = settled(intRes, [] as Interval[], failures, "intervals");
  const weather = settled(weatherRes, [] as Weather[], failures, "weather");

  const lastPosition = latestPerDriver(positions);
  const lastInterval = latestPerDriver(intervals);

  const topRows = drivers
    .map((driver) => ({
      driver,
      position: lastPosition.get(driver.driver_number)?.position ?? null,
      gap_to_leader: lastInterval.get(driver.driver_number)?.gap_to_leader ?? null,
    }))
    .sort((a, b) => {
      if (a.position == null && b.position == null) return 0;
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });

  return {
    session,
    driversCount: drivers.length,
    topRows,
    weather: weather.at(-1) ?? null,
    failures,
  };
}
