/**
 * OpenF1 API — typed responses
 * Docs: https://openf1.org/docs/
 *
 * All endpoints accept query filters via URL params (e.g. ?driver_number=44&session_key=latest).
 * "latest" is a magic value for session_key and meeting_key.
 */

export type IsoDate = string;
export type SessionKey = number | "latest";
export type MeetingKey = number | "latest";

/* ============================================================
   MEETINGS — A meeting groups all sessions of a Grand Prix weekend.
   ============================================================ */
export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  meeting_code: string;
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  date_start: IsoDate;
  gmt_offset: string;
  year: number;
}

/* ============================================================
   SESSIONS — Practice / Qualifying / Sprint / Race within a meeting.
   ============================================================ */
export interface Session {
  session_key: number;
  session_name: string;
  session_type: "Practice" | "Qualifying" | "Race" | string;
  meeting_key: number;
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  date_start: IsoDate;
  date_end: IsoDate;
  gmt_offset: string;
  year: number;
}

/* ============================================================
   DRIVERS — Roster for a session.
   ============================================================ */
export interface Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  name_acronym: string;
  team_name: string;
  team_colour: string; // hex without #
  country_code: string | null;
  headshot_url: string | null;
  session_key: number;
  meeting_key: number;
}

/* ============================================================
   LAPS — Lap-by-lap timing for each driver.
   ============================================================ */
export interface Lap {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  lap_number: number;
  date_start: IsoDate | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
  segments_sector_1: (number | null)[] | null;
  segments_sector_2: (number | null)[] | null;
  segments_sector_3: (number | null)[] | null;
}

/* ============================================================
   INTERVALS — Gap to leader and to the car ahead.
   ============================================================ */
export interface Interval {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  gap_to_leader: number | string | null; // can be "+1 LAP"
  interval: number | string | null;
}

/* ============================================================
   POSITION — Track position of a driver at a given moment.
   ============================================================ */
export interface Position {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  position: number;
}

/* ============================================================
   CAR_DATA — Telemetry sampled at ~3.7 Hz.
   ============================================================ */
export interface CarData {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  rpm: number;
  speed: number;
  n_gear: number;
  throttle: number;
  brake: number;
  drs: number;
}

/* ============================================================
   LOCATION — GPS coordinates on track.
   ============================================================ */
export interface Location {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  x: number;
  y: number;
  z: number;
}

/* ============================================================
   PIT — Pit-stop entries.
   ============================================================ */
export interface Pit {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  pit_duration: number | null;
  lap_number: number;
}

/* ============================================================
   STINTS — Continuous segment on a given compound.
   ============================================================ */
export interface Stint {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" | string;
  tyre_age_at_start: number;
}

/* ============================================================
   RACE_CONTROL — Yellow flags, SC, VSC, penalties, etc.
   ============================================================ */
export interface RaceControl {
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  category: string;
  flag: string | null;
  lap_number: number | null;
  message: string;
  driver_number: number | null;
  sector: number | null;
  scope: string | null;
}

/* ============================================================
   WEATHER — Track conditions.
   ============================================================ */
export interface Weather {
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_direction: number;
  wind_speed: number;
}

/* ============================================================
   TEAM_RADIO — Driver radio clips (URL to MP3).
   ============================================================ */
export interface TeamRadio {
  driver_number: number;
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  recording_url: string;
}

/* ============================================================
   SESSION_RESULT — Classification for a session.
   ============================================================ */
export interface SessionResult {
  position: number | null;
  driver_number: number;
  session_key: number;
  meeting_key: number;
  number_of_laps: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | number[] | null; // qualy = array of Q1/Q2/Q3
  gap_to_leader: number | string | null;
  points: number | null;
}

/* ============================================================
   STARTING_GRID — Grid positions before a race.
   ============================================================ */
export interface StartingGrid {
  position: number;
  driver_number: number;
  session_key: number;
  meeting_key: number;
  lap_duration: number | null;
}

/* ============================================================
   OVERTAKES — Position changes during a race.
   ============================================================ */
export interface Overtake {
  session_key: number;
  meeting_key: number;
  date: IsoDate;
  overtaking_driver_number: number;
  overtaken_driver_number: number;
  position: number;
}

/* ============================================================
   ENDPOINT registry — name → response type
   ============================================================ */
export interface EndpointMap {
  meetings: Meeting;
  sessions: Session;
  drivers: Driver;
  laps: Lap;
  intervals: Interval;
  position: Position;
  car_data: CarData;
  location: Location;
  pit: Pit;
  stints: Stint;
  race_control: RaceControl;
  weather: Weather;
  team_radio: TeamRadio;
  session_result: SessionResult;
  starting_grid: StartingGrid;
  overtakes: Overtake;
}

export type EndpointName = keyof EndpointMap;
