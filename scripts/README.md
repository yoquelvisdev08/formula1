# LiveF1 Snapshot Pipeline

Pulls the official Formula 1 livetiming archive via the [LiveF1](https://pypi.org/project/livef1/)
Python library and saves a JSON dump that the static frontend consumes at
runtime to enrich the **Race Replay** view (sector times, telemetry, GPS).

The script is **post-race only** — it grabs immutable data once a round
is over, runs in seconds, and writes a single JSON file. No persistent
backend, no streaming, no extra cost.

## Files

| File | Purpose |
| --- | --- |
| `livef1_dump.py` | Fetch one race, downsample, write `public/data/livef1/{season}-{round}.json` and update `index.json`. |
| `requirements.txt` | `livef1`, `pandas`, `requests`. |
| `../.github/workflows/livef1-snapshot.yml` | Runs the script every Monday 08:00 UTC + on demand from the Actions tab. |

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r scripts/requirements.txt

# Dump the most recently completed race
python scripts/livef1_dump.py

# Or pin a specific one
python scripts/livef1_dump.py --season 2026 --round 5

# Force a redo even if that round was already dumped
python scripts/livef1_dump.py --season 2026 --round 5 --force
```

## Output shape

`public/data/livef1/{season}-{round}.json` (compact JSON, typically <2 MB):

```jsonc
{
  "schema": 1,
  "season": 2026,
  "round": 5,
  "raceName": "Miami Grand Prix",
  "source": "livef1 + Formula1 Livetiming",
  "generatedAt": "2026-05-13T08:01:22+00:00",
  "counts": { "laps": 1180, "telemetryDrivers": 20, "positionSamples": 1800 },
  "laps": [ { "driver": "44", "lap": 1, "position": 3, "lapTime": 92.341, "sector1": 31.05, ... } ],
  "telemetry": { "44": [ { "t": 0.0, "speed": 280, "rpm": 11200, ... }, ... ] },
  "positionTrack": [ { "driver": "44", "x": 123.4, "y": -56.7, "t": 1.2 }, ... ]
}
```

`public/data/livef1/index.json` lists the dumps the frontend can rely on:

```jsonc
{
  "schema": 1,
  "latest": { "season": 2026, "round": 5, "file": "2026-5.json", ... },
  "dumps":  [ { ... }, { ... } ]
}
```

## Triggering the workflow manually

1. GitHub → Actions tab → **LiveF1 Snapshot**
2. **Run workflow** → optionally specify season / round / force.
3. If new data arrives, the bot commits to `main` automatically.

## Caveats

- Data comes from Formula 1's livetiming archive via LiveF1. Not for
  commercial use without explicit permission from FOM.
- The script downsamples telemetry to ~400 points per driver per session
  to keep the JSON light. Increase `TELEMETRY_TARGET_POINTS` if you need
  higher fidelity (but mind the file size).
- Telemetry availability varies by year — older seasons may not have it.
