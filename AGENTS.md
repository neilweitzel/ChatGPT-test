# Apex - Agent Guidelines

## What is Apex
Apex is a client-side karting telemetry and leaderboard app. It handles parsing telemetry data, local CSV upload handling, robust data validation, displaying dynamic leaderboard and charts, track map rendering, GPX/GPS CSV parsing, speed gradients, and ghost sync replay.

## Project Conventions
- **Language**: Vanilla JS with ES modules.
- **Frameworks**: No frameworks.
- **Build Step**: No build step beyond a plain Node script.
- **State**: All state is client-side.
- **Testing**: Every feature ships with Playwright tests.
- **Architecture**: Prefer small pure functions in `src/lib/` with DOM code isolated in `src/ui/`.
  - `src/lib/` must stay free of DOM access: parsing, format detection, stats, geometry, and replay maths belong here.
  - `src/ui/` owns element creation and event wiring, and imports its maths from `src/lib/`.
- **Docs**: The README feature list is the source of truth. Any feature it lists must be reachable in the running UI and covered by a test.
- **Styling**: No inline `style` attributes or inline style strings; add classes to `src/styles/style.css`.

## How to Run
Since there is no build step, you can run the app by serving the `src` directory using any local web server (e.g., `npm start`, `npx serve src`, or `python3 -m http.server -d src`) and opening `index.html`.

## Data and Screenshots
- `dataset/demo_session.csv` and `dataset/demo_lap_trace.gpx` are the realistic
  demo files behind the README screenshots. Regenerate them deterministically
  with `npm run generate:data`.
- `dataset/scale_10k_laps.csv` exists only to exercise parse and render
  performance. It is intentionally repetitive; do not use it for screenshots or
  as an example of real telemetry.
- `src/demo/` is **generated**: copies of the demo files plus `manifest.json`,
  produced by `scripts/sync-demo-data.js` because GitHub Pages serves only
  `src/`. Never edit it by hand — change `dataset/` (or the generator) and run
  `npm run generate:data`. `npm run validate:data` and the test suite both fail
  if it drifts.
- The demo picker must keep going through `src/ui/ingest.js`, the same path an
  uploaded file takes, so the demo can never diverge from real behaviour.
- Run `npm run validate:data` after touching any file in `dataset/` or
  `fixtures/`. It parses each file with the app's own parsers and reports both
  parse errors and data-quality problems. CI runs it too.
- Declare a new data file's intent in `scripts/data-expectations.json`
  (`valid`, `synthetic`, or `invalid`), otherwise it is held to `valid`.
- README screenshots live in `docs/screenshots/` and are produced from the demo
  data by `npm run screenshots`. Refresh them whenever the UI changes.

## Visual Snapshots
The committed baselines under `tests/*-snapshots/` are test artefacts, not
documentation (the README uses `docs/screenshots/`). Regenerate them with
`npx playwright test --update-snapshots=all` after any UI change — plain
`--update-snapshots` only rewrites baselines whose comparison already failed, so
small changes inside the tolerance would leave stale screenshots behind.

Baselines are compared with a pixel-ratio tolerance (see `playwright.config.js`)
because CI runners install different system fonts than a developer machine.
Exact styling is asserted through computed-style checks in `tests/styles.spec.js`
rather than through pixel comparison.

## How to Test
To run tests, install dependencies and use Playwright:
```bash
npm install
npx playwright install
npm run test
```
