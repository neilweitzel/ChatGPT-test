# Apex - Agent Guidelines

## What is Apex
Apex is a client-side karting telemetry and leaderboard app.

## Project Conventions
- **Language**: Vanilla JS with ES modules.
- **Frameworks**: No frameworks.
- **Build Step**: No build step beyond a plain Node script.
- **State**: All state is client-side.
- **Testing**: Every feature ships with Playwright tests.
- **Architecture**: Prefer small pure functions in `src/lib/` with DOM code isolated in `src/ui/`.

## How to Run
Since there is no build step, you can run the app by serving the root directory using any local web server (e.g., `npx serve .` or `python -m http.server`) and opening `index.html`.

To run tests, install dependencies and use Playwright:
```bash
npm install
npx playwright install
npm run test
```
