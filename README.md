# Apex

## About Apex
Apex is a client-side karting telemetry and leaderboard app.

## How to Run
Since there is no build step, you can run the app by serving the root directory using any local web server (e.g., `npx serve .` or `python3 -m http.server`) and opening `index.html`.

## Testing
To run tests, install dependencies and use Playwright:
```bash
npm install
npx playwright install
npm run test
```
