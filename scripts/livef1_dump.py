"""
Dump historical race data from LiveF1 into a JSON file the static frontend
can read at runtime.

The script is deliberately conservative:
  - One race per invocation (the latest one with available official data)
  - Downsamples telemetry so the JSON stays under ~2 MB
  - Skips writing if the existing file already covers the same round, so the
    GitHub Action only produces a commit when there's something new

Output:  public/data/livef1/{season}-{round}.json
         public/data/livef1/index.json   (rolling list of available dumps)

Invoke locally:
    pip install -r scripts/requirements.txt
    python scripts/livef1_dump.py                # latest race
    python scripts/livef1_dump.py --season 2026 --round 5
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

import requests

OUT_DIR = Path("public/data/livef1")
INDEX_FILE = OUT_DIR / "index.json"
TELEMETRY_TARGET_POINTS = 400          # samples per lap per driver after downsample
MAX_TELEMETRY_DRIVERS = 20             # cap to keep payload bounded
SCHEMA_VERSION = 1


def log(msg: str) -> None:
    print(f"[livef1-dump] {msg}", flush=True)


def latest_round_from_jolpica() -> tuple[int, int, str] | None:
    """Returns (season, round, raceName) of the most recently completed race, via Jolpica."""
    try:
        res = requests.get("https://api.jolpi.ca/ergast/f1/current/last/results.json", timeout=15)
        if not res.ok:
            return None
        data = res.json()
        race = data.get("MRData", {}).get("RaceTable", {}).get("Races", [None])[0]
        if not race:
            return None
        return int(race["season"]), int(race["round"]), race["raceName"]
    except Exception as e:
        log(f"could not pull latest round from jolpica: {e}")
        return None


def downsample(samples: list, target: int) -> list:
    """Reduce a list to ~target items via uniform stride."""
    n = len(samples)
    if n <= target:
        return list(samples)
    stride = math.ceil(n / target)
    return samples[::stride]


def safe_float(v) -> float | None:
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def existing_dump_round() -> int | None:
    if not INDEX_FILE.exists():
        return None
    try:
        idx = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        latest = idx.get("latest")
        if latest:
            return int(latest.get("round"))
    except Exception:
        pass
    return None


def update_index(season: int, rnd: int, race_name: str, file_size: int) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload: dict
    if INDEX_FILE.exists():
        try:
            payload = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        except Exception:
            payload = {"schema": SCHEMA_VERSION, "dumps": []}
    else:
        payload = {"schema": SCHEMA_VERSION, "dumps": []}

    payload["schema"] = SCHEMA_VERSION
    entry = {
        "season": season,
        "round": rnd,
        "raceName": race_name,
        "file": f"{season}-{rnd}.json",
        "sizeBytes": file_size,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    dumps = [d for d in payload.get("dumps", []) if not (d.get("season") == season and d.get("round") == rnd)]
    dumps.append(entry)
    dumps.sort(key=lambda d: (d.get("season", 0), d.get("round", 0)), reverse=True)
    payload["dumps"] = dumps[:30]  # keep at most 30 recent
    payload["latest"] = entry
    INDEX_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_payload(session, season: int, rnd: int, race_name: str) -> dict:
    """Build the JSON payload from a livef1 Session object."""
    # Generate the silver layer so structured tables are available
    try:
        session.generate(silver=True)
    except Exception as e:
        log(f"silver generation failed (continuing with raw): {e}")

    # Laps — one row per (driver, lap)
    laps = []
    try:
        laps_df = session.get_laps()
        for _, row in laps_df.iterrows():
            laps.append({
                "driver": str(row.get("DriverNumber") or row.get("Driver", "")),
                "lap": int(row.get("LapNumber", 0)) if row.get("LapNumber") else None,
                "position": int(row.get("Position")) if row.get("Position") not in (None, "") else None,
                "lapTime": safe_float(row.get("LapTime")),
                "sector1": safe_float(row.get("Sector1Time")),
                "sector2": safe_float(row.get("Sector2Time")),
                "sector3": safe_float(row.get("Sector3Time")),
                "compound": str(row.get("Compound")) if row.get("Compound") else None,
                "tyreLife": safe_float(row.get("TyreLife")),
                "stint": int(row.get("Stint")) if row.get("Stint") not in (None, "") else None,
            })
    except Exception as e:
        log(f"laps unavailable: {e}")

    # Telemetry — downsample per driver
    telemetry = {}
    try:
        tel_df = session.get_car_telemetry()
        for driver, group in tel_df.groupby("DriverNumber"):
            if len(telemetry) >= MAX_TELEMETRY_DRIVERS:
                break
            samples = []
            for _, row in group.iterrows():
                samples.append({
                    "t": safe_float(row.get("SessionTime")),
                    "speed": safe_float(row.get("Speed")),
                    "rpm": safe_float(row.get("RPM")),
                    "gear": int(row.get("Gear")) if row.get("Gear") not in (None, "") else None,
                    "throttle": safe_float(row.get("Throttle")),
                    "brake": safe_float(row.get("Brake")),
                    "drs": safe_float(row.get("DRS")),
                })
            telemetry[str(driver)] = downsample(samples, TELEMETRY_TARGET_POINTS)
    except Exception as e:
        log(f"telemetry unavailable: {e}")

    # Position track — for circuit outline / replay map
    position_track = []
    try:
        pos_df = session.get_data(dataNames="Position.z")
        for _, row in pos_df.head(2000).iterrows():
            position_track.append({
                "driver": str(row.get("DriverNumber", "")),
                "x": safe_float(row.get("X")),
                "y": safe_float(row.get("Y")),
                "t": safe_float(row.get("SessionTime")),
            })
    except Exception as e:
        log(f"position track unavailable: {e}")

    return {
        "schema": SCHEMA_VERSION,
        "season": season,
        "round": rnd,
        "raceName": race_name,
        "source": "livef1 + Formula1 Livetiming",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "laps": len(laps),
            "telemetryDrivers": len(telemetry),
            "positionSamples": len(position_track),
        },
        "laps": laps,
        "telemetry": telemetry,
        "positionTrack": position_track,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=None)
    parser.add_argument("--round", type=int, default=None)
    parser.add_argument("--force", action="store_true", help="Re-dump even if same round already saved.")
    args = parser.parse_args(argv)

    season = args.season
    rnd = args.round
    race_name = "Unknown"

    if season is None or rnd is None:
        latest = latest_round_from_jolpica()
        if not latest:
            log("no race info available (Jolpica didn't respond); aborting")
            return 1
        season, rnd, race_name = latest
        log(f"latest completed round resolved → {season} R{rnd} ({race_name})")

    if not args.force and existing_dump_round() == rnd:
        log(f"round {rnd} already dumped — pass --force to redo. skipping.")
        return 0

    # Lazy import — only pay the livef1 cost when we're actually dumping.
    try:
        import livef1
    except ImportError:
        log("livef1 is not installed. run: pip install -r scripts/requirements.txt")
        return 1

    log(f"fetching session season={season} round={rnd}")
    try:
        session = livef1.get_session(season=season, meeting_identifier=rnd, session_identifier="Race")
    except Exception as e:
        log(f"livef1.get_session failed: {e}")
        traceback.print_exc()
        return 1

    payload = build_payload(session, season, rnd, race_name)

    if not payload["laps"]:
        log("no lap data captured — refusing to write an empty dump")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{season}-{rnd}.json"
    out_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    size = out_path.stat().st_size
    log(f"wrote {out_path} ({size / 1024:.1f} KB)")
    log(f"counts: {payload['counts']}")

    update_index(season, rnd, race_name, size)
    log(f"updated {INDEX_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
