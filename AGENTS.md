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

To run tests, install dependencies and use Playwright:
```bash
npm install
npx playwright install
npm run test
```
