/**
 * Typed wrappers over the Jolpica fetcher — one helper per logical query.
 * Each one returns the parsed array/object directly (no envelope).
 */

import { fetchJolpica, type JolpicaFetchOptions } from "./client";
import type {
  ConstructorsResponse,
  ConstructorStandingsResponse,
  DriverStandingsResponse,
  DriversResponse,
  JolpicaConstructor,
  JolpicaDriver,
  JolpicaRace,
  ScheduleResponse,
} from "./types";

/* ============================================================
   SCHEDULE
   ============================================================ */

export async function getSchedule(season: number | "current" = "current", opts?: JolpicaFetchOptions): Promise<JolpicaRace[]> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races ?? [];
}

export async function getRace(season: number | "current", round: number | "last", opts?: JolpicaFetchOptions): Promise<JolpicaRace | null> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}/${round}`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races?.[0] ?? null;
}

/* ============================================================
   RESULTS — race / qualifying / sprint
   ============================================================ */

export async function getRaceResults(season: number | "current", round: number | "last", opts?: JolpicaFetchOptions): Promise<JolpicaRace | null> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}/${round}/results`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races?.[0] ?? null;
}

export async function getQualifyingResults(season: number | "current", round: number | "last", opts?: JolpicaFetchOptions): Promise<JolpicaRace | null> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}/${round}/qualifying`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races?.[0] ?? null;
}

export async function getSprintResults(season: number | "current", round: number | "last", opts?: JolpicaFetchOptions): Promise<JolpicaRace | null> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}/${round}/sprint`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races?.[0] ?? null;
}

export async function getPitStops(season: number | "current", round: number | "last", opts?: JolpicaFetchOptions): Promise<JolpicaRace | null> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}/${round}/pitstops`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races?.[0] ?? null;
}

/**
 * Returns every lap of the given race with per-driver timings & positions.
 * Heavy payload (~60 laps × 20 drivers); cached aggressively because race
 * data is immutable once the race is over.
 */
export async function getRaceLaps(season: number | "current", round: number | "last", opts?: JolpicaFetchOptions): Promise<JolpicaRace | null> {
  // Bump the page size — default 30 only returns the first 30 laps.
  const data = await fetchJolpica<ScheduleResponse>(`${season}/${round}/laps`, { ttl: 60 * 60_000, limit: 2000, ...opts });
  return data.RaceTable?.Races?.[0] ?? null;
}

/* ============================================================
   DRIVERS / CONSTRUCTORS
   ============================================================ */

export async function getDrivers(season: number | "current" = "current", opts?: JolpicaFetchOptions): Promise<JolpicaDriver[]> {
  const data = await fetchJolpica<DriversResponse>(`${season}/drivers`, { ttl: 30 * 60_000, ...opts });
  return data.DriverTable?.Drivers ?? [];
}

export async function getDriver(driverId: string, opts?: JolpicaFetchOptions): Promise<JolpicaDriver | null> {
  const data = await fetchJolpica<DriversResponse>(`drivers/${driverId}`, { ttl: 60 * 60_000, ...opts });
  return data.DriverTable?.Drivers?.[0] ?? null;
}

export async function getConstructors(season: number | "current" = "current", opts?: JolpicaFetchOptions): Promise<JolpicaConstructor[]> {
  const data = await fetchJolpica<ConstructorsResponse>(`${season}/constructors`, { ttl: 30 * 60_000, ...opts });
  return data.ConstructorTable?.Constructors ?? [];
}

export async function getDriverSeasonResults(driverId: string, season: number | "current" = "current", opts?: JolpicaFetchOptions): Promise<JolpicaRace[]> {
  const data = await fetchJolpica<ScheduleResponse>(`${season}/drivers/${driverId}/results`, { ttl: 10 * 60_000, ...opts });
  return data.RaceTable?.Races ?? [];
}

/* ============================================================
   STANDINGS — driver + constructor
   ============================================================ */

export async function getDriverStandings(season: number | "current" = "current", opts?: JolpicaFetchOptions) {
  const data = await fetchJolpica<DriverStandingsResponse>(`${season}/driverStandings`, { ttl: 10 * 60_000, ...opts });
  return data.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}

export async function getConstructorStandings(season: number | "current" = "current", opts?: JolpicaFetchOptions) {
  const data = await fetchJolpica<ConstructorStandingsResponse>(`${season}/constructorStandings`, { ttl: 10 * 60_000, ...opts });
  return data.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}

/* ============================================================
   Re-exports
   ============================================================ */

export * from "./types";
export { JolpicaError, flushJolpicaCache } from "./client";
