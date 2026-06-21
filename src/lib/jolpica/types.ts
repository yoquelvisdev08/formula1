/**
 * Jolpica F1 API types — drop-in Ergast replacement.
 * Docs: https://github.com/jolpica/jolpica-f1
 * Base: https://api.jolpi.ca/ergast/f1
 *
 * Responses are wrapped in an `MRData` envelope (Ergast convention).
 * Numeric fields are returned as strings — we parse at the adapter layer.
 */

export interface MRDataEnvelope<T> {
  MRData: MRData & T;
}

export interface MRData {
  xmlns?: string;
  series: string;
  url: string;
  limit: string;
  offset: string;
  total: string;
}

/* ============================================================
   PRIMITIVES
   ============================================================ */

export interface JolpicaCircuit {
  circuitId: string;
  url: string;
  circuitName: string;
  Location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface JolpicaDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface JolpicaConstructor {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
}

/* ============================================================
   RACE / SCHEDULE
   ============================================================ */

export interface SessionStub {
  date: string;
  time?: string;
}

export interface JolpicaRace {
  season: string;
  round: string;
  url?: string;
  raceName: string;
  Circuit: JolpicaCircuit;
  date: string;
  time?: string;
  FirstPractice?: SessionStub;
  SecondPractice?: SessionStub;
  ThirdPractice?: SessionStub;
  Qualifying?: SessionStub;
  Sprint?: SessionStub;
  SprintQualifying?: SessionStub;
  SprintShootout?: SessionStub;
  Results?: JolpicaRaceResult[];
  QualifyingResults?: JolpicaQualifyingResult[];
  SprintResults?: JolpicaRaceResult[];
  PitStops?: JolpicaPitStop[];
  Laps?: JolpicaLap[];
}

export interface ScheduleResponse {
  RaceTable: {
    season?: string;
    Races: JolpicaRace[];
  };
}

/* ============================================================
   RESULTS
   ============================================================ */

export interface JolpicaTime {
  millis?: string;
  time?: string;
}

export interface JolpicaFastestLap {
  rank?: string;
  lap?: string;
  Time?: { time?: string };
  AverageSpeed?: { units?: string; speed?: string };
}

export interface JolpicaRaceResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: JolpicaDriver;
  Constructor: JolpicaConstructor;
  grid: string;
  laps: string;
  status: string;
  Time?: JolpicaTime;
  FastestLap?: JolpicaFastestLap;
}

export interface JolpicaQualifyingResult {
  number: string;
  position: string;
  Driver: JolpicaDriver;
  Constructor: JolpicaConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

/* ============================================================
   STANDINGS
   ============================================================ */

export interface DriverStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: JolpicaDriver;
  Constructors: JolpicaConstructor[];
}

export interface ConstructorStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: JolpicaConstructor;
}

export interface DriverStandingsResponse {
  StandingsTable: {
    season?: string;
    StandingsLists: {
      season: string;
      round: string;
      DriverStandings: DriverStanding[];
    }[];
  };
}

export interface ConstructorStandingsResponse {
  StandingsTable: {
    season?: string;
    StandingsLists: {
      season: string;
      round: string;
      ConstructorStandings: ConstructorStanding[];
    }[];
  };
}

/* ============================================================
   LAPS / PIT STOPS
   ============================================================ */

export interface JolpicaLap {
  number: string;
  Timings: {
    driverId: string;
    position: string;
    time: string;
  }[];
}

export interface JolpicaPitStop {
  driverId: string;
  lap: string;
  stop: string;
  time: string;
  duration: string;
}

/* ============================================================
   COLLECTIONS
   ============================================================ */

export interface DriversResponse {
  DriverTable: {
    season?: string;
    Drivers: JolpicaDriver[];
  };
}

export interface ConstructorsResponse {
  ConstructorTable: {
    season?: string;
    Constructors: JolpicaConstructor[];
  };
}

/* ============================================================
   TEAM PALETTE — Jolpica doesn't expose team colours; we keep
   a curated palette here so the UI stays on-brand.
   ============================================================ */

export const TEAM_COLOURS: Record<string, string> = {
  red_bull: "#1E1E5C",
  ferrari: "#E80020",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  aston_martin: "#229971",
  alpine: "#0093CC",
  williams: "#1868DB",
  rb: "#6692FF",
  alphatauri: "#2B4562",
  sauber: "#52E252",
  haas: "#B6BABD",
  alfa: "#900000",
  racing_point: "#F596C8",
  renault: "#FFF500",
  toro_rosso: "#469BFF",
  force_india: "#F596C8",
  manor: "#323232",
  lotus_f1: "#FFB800",
  marussia: "#6E0000",
  caterham: "#016854",
};

export function teamColourFor(constructorId: string | null | undefined): string {
  if (!constructorId) return "#6f7070";
  return TEAM_COLOURS[constructorId] ?? "#6f7070";
}

/**
 * Country of incorporation / licence for each constructor — used to
 * render a flag next to the team name. Falls back to the team's
 * canonical nationality, not the headquarters location.
 */
export const TEAM_COUNTRY: Record<string, string> = {
  red_bull: "AT",          // Red Bull Racing — Austrian licence
  ferrari: "IT",
  mercedes: "DE",
  mclaren: "GB",
  aston_martin: "GB",
  alpine: "FR",
  williams: "GB",
  rb: "IT",                // Visa Cash App RB — Italian (Faenza)
  alphatauri: "IT",
  sauber: "CH",            // Stake F1 / Kick Sauber — Swiss
  haas: "US",
  alfa: "CH",
  racing_point: "GB",
  renault: "FR",
  toro_rosso: "IT",
  force_india: "IN",
  manor: "GB",
  lotus_f1: "GB",
  marussia: "RU",
  caterham: "MY",
};

export function teamCountryFor(constructorId: string | null | undefined): string | null {
  if (!constructorId) return null;
  return TEAM_COUNTRY[constructorId] ?? null;
}
