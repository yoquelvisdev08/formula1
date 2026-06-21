/**
 * Frontend reader for LiveF1 snapshots produced by the GitHub Action.
 *
 * Dumps live under /data/livef1/<season>-<round>.json and are described in
 * /data/livef1/index.json. Both are static files served from the build,
 * so this client just does cached fetches against the same origin.
 */

const BASE = `${import.meta.env.BASE_URL}data/livef1`;

export const LIVEF1_SCHEMA = 1;

export interface LiveF1Lap {
  driver: string;
  lap: number | null;
  position: number | null;
  lapTime: number | null;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  compound: string | null;
  tyreLife: number | null;
  stint: number | null;
}

export interface LiveF1TelemetrySample {
  t: number | null;
  speed: number | null;
  rpm: number | null;
  gear: number | null;
  throttle: number | null;
  brake: number | null;
  drs: number | null;
}

export interface LiveF1Position {
  driver: string;
  x: number | null;
  y: number | null;
  t: number | null;
}

export interface LiveF1Snapshot {
  schema: number;
  season: number;
  round: number;
  raceName: string;
  source: string;
  generatedAt: string;
  counts: { laps: number; telemetryDrivers: number; positionSamples: number };
  laps: LiveF1Lap[];
  telemetry: Record<string, LiveF1TelemetrySample[]>;
  positionTrack: LiveF1Position[];
}

export interface LiveF1IndexEntry {
  season: number;
  round: number;
  raceName: string;
  file: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface LiveF1Index {
  schema: number;
  dumps: LiveF1IndexEntry[];
  latest?: LiveF1IndexEntry;
}

// Module-level cache so the same snapshot isn't refetched within a session.
const memo = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T | null> {
  const cached = memo.get(path);
  if (cached) return cached as Promise<T | null>;
  const promise = (async (): Promise<T | null> => {
    try {
      const res = await fetch(path, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  })();
  memo.set(path, promise);
  return promise;
}

export function getLiveF1Index(): Promise<LiveF1Index | null> {
  return fetchJson<LiveF1Index>(`${BASE}/index.json`);
}

export function getLiveF1Snapshot(season: number, round: number): Promise<LiveF1Snapshot | null> {
  return fetchJson<LiveF1Snapshot>(`${BASE}/${season}-${round}.json`);
}

export async function getLatestLiveF1(): Promise<LiveF1Snapshot | null> {
  const index = await getLiveF1Index();
  if (!index?.latest) return null;
  return getLiveF1Snapshot(index.latest.season, index.latest.round);
}

/**
 * Convenience: given a season + round, returns the snapshot only if it
 * exists in the index (avoids 404 spam in DevTools when we know there's
 * no dump for that round yet).
 */
export async function getLiveF1IfAvailable(season: number, round: number): Promise<LiveF1Snapshot | null> {
  const index = await getLiveF1Index();
  if (!index) return null;
  const has = index.dumps.some((d) => d.season === season && d.round === round);
  if (!has) return null;
  return getLiveF1Snapshot(season, round);
}
