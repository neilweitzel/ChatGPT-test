# Apex

## Screenshots
![Homepage](tests/styles.spec.js-snapshots/homepage-linux.png)
![Charts](tests/charts.spec.js-snapshots/charts-section-linux.png)
![Map & Replay](tests/replay.spec.js-snapshots/map-replay-screenshot-linux.png)

Screenshots are the Playwright visual-regression baselines, so they always
reflect the current UI.

## About Apex
Apex is a client-side karting telemetry and leaderboard app. It supports parsing telemetry data, local CSV upload handling, robust data validation, displaying dynamic leaderboard and charts, track map rendering, GPX/GPS CSV parsing, speed gradients, and ghost sync replay.

## Features
- **Local CSV Upload:** Process telemetry data entirely on the client.
- **Dynamic Leaderboard:** View best laps, theoretical bests, median lap times, and consistency scores.
- **Visualizations:** Compare driver performance through lap trace and sector delta charts.
- **Track Map Rendering:** Visualize track maps derived from telemetry data.
- **GPX and GPS CSV Parsing:** Import raw GPS telemetry files.
- **Speed Gradients:** View speed differences visually on the track map.
- **Ghost Sync Replay:** Replay and compare laps simultaneously.

## Supported Files
- **Lap CSV:** columns for `Driver`, `Lap`, `Time`, and optional `Sector 1..3`, `Track`, `Date`. Drives the leaderboard and charts.
- **GPS trace:** a `.gpx` file, or a CSV with `Lat`, `Lon`, and `Time` columns. Drives the track map, speed gradient, and ghost replay.

File type is detected from the header row, not from the file name, and each
upload renders into its own panel so the leaderboard and the track map can be
viewed side by side.

## Project Structure
```
src/lib/    pure logic: CSV/GPX parsing, format detection, stats, geometry, replay maths, IndexedDB
src/ui/     DOM rendering: upload wiring, leaderboard, charts, track map, replay controls
tests/      Playwright unit + end-to-end specs and visual baselines
fixtures/   small sample files used by tests
dataset/    large sample lap CSV used by performance and visual tests
```

## How to Run
Since there is no build step, you can run the app by serving the `src` directory using any local web server and opening `index.html` in your browser.

Example using `serve`:
```bash
npm start
# or
npx serve src
```

Example using Python's `http.server`:
```bash
python3 -m http.server -d src
```

## Testing
To run tests, install dependencies and use Playwright:
```bash
npm install
npx playwright install
npm run test
```
