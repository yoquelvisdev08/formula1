# F1 · Velocity Prime

Real-time Formula 1 telemetry dashboard powered by the [OpenF1 API](https://openf1.org/docs/).
Built with **Astro 5**, **Tailwind 4** and **TypeScript** — the design system **Velocity Prime**
was prototyped in [Google Stitch](https://stitch.withgoogle.com/) and translated 1:1 here.

## Pages

| Route | Description |
| --- | --- |
| `/` | **Apex Dashboard** — Active session strip, top order, weather, race control, upcoming sessions. |
| `/live` | **Live Timing Center** — Full timing tower, tyre stints visualisation, pit activity, team radio. |
| `/drivers` | **Drivers & Teams Hub** — Grid grouped by constructor with live search. |
| `/drivers/[number]` | Driver detail — Stints, pit stops, lap-time chart, team radio. |
| `/calendar` | **Season Calendar** — Meetings for the active year, with status (Completed / Live / Upcoming). |
| `/meetings/[key]` | Meeting detail — Sessions of the weekend and roster. |

## OpenF1 endpoints consumed

All 16 endpoints exposed by OpenF1 are wired into the typed client:

`sessions`, `meetings`, `drivers`, `laps`, `intervals`, `position`, `car_data`, `location`,
`pit`, `stints`, `race_control`, `weather`, `team_radio`, `session_result`, `starting_grid`, `overtakes`.

## Stack

- [Astro 5](https://astro.build/) (static output)
- [Tailwind CSS 4](https://tailwindcss.com/) via `@tailwindcss/vite` + design tokens in CSS
- TypeScript strict mode
- Zero runtime dependencies beyond Astro itself — data is fetched client-side from OpenF1

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output → ./dist
npm run preview
```

## Project structure

```
src/
├── layouts/Base.astro            # shell (header + footer + meta)
├── components/                   # UI primitives (Card, Chip, Button, Stat, …)
├── lib/
│   ├── openf1/                   # typed API client (types + fetch wrapper + cache)
│   ├── live.ts                   # snapshot composer (drivers × position × intervals × laps × stints)
│   └── format.ts                 # lap-time / gap / compound / flag helpers
├── pages/
│   ├── index.astro               # Apex Dashboard
│   ├── live.astro                # Live Timing Center (auto-refresh)
│   ├── drivers/
│   │   ├── index.astro           # Drivers & Teams Hub
│   │   └── [number].astro        # Driver detail
│   ├── calendar.astro            # Season Calendar
│   └── meetings/[key].astro      # Meeting detail
└── styles/global.css             # Velocity Prime design tokens (@theme)
```

## Design system — Velocity Prime

- **Palette:** Racing Red `#e10600`, Electric Blue `#00d2ff`, Carbon Surface `#1A1A1A`, Pit-lane Warning `#FFD200`
- **Typography:** Archivo Narrow (display), Inter (body), JetBrains Mono (data / labels)
- **Shape language:** strictly sharp; chamfered corners (45°) for buttons and card headers
- **Depth:** tonal layers + neon glow instead of soft shadows; glassmorphism for overlays

## License

Independent fan project — F1, FIA and OpenF1 are trademarks of their respective owners.
