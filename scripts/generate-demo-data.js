#!/usr/bin/env node
/**
 * Generates the realistic demo telemetry shipped in dataset/.
 *
 * Usage:
 *   node scripts/generate-demo-data.js
 *
 * Output is deterministic (seeded PRNG), so re-running produces identical
 * files and the committed demo data can be regenerated or extended safely.
 *
 * Two files are written:
 *   dataset/demo_session.csv    lap times with sector splits for six drivers
 *   dataset/demo_lap_trace.gpx  a three-lap GPS trace of a kart circuit
 *
 * The lap CSV drives the leaderboard and charts; the GPX drives the track map,
 * speed gradient and ghost sync replay.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dataset');

/**
 * Creates a small deterministic PRNG (mulberry32).
 * @param {number} seed
 * @returns {() => number} Function returning floats in [0, 1).
 */
function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Formats milliseconds as a lap time string, using M:SS.mmm past a minute.
 * @param {number} ms
 * @returns {string}
 */
function formatLapTime(ms) {
  const total = Math.round(ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const pad = (n, w) => String(n).padStart(w, '0');

  return minutes > 0
    ? `${minutes}:${pad(seconds, 2)}.${pad(millis, 3)}`
    : `${seconds}.${pad(millis, 3)}`;
}

/**
 * Formats a sector time as plain seconds with milliseconds.
 * @param {number} ms
 * @returns {string}
 */
function formatSector(ms) {
  return (Math.round(ms) / 1000).toFixed(3);
}

// --- Lap session -----------------------------------------------------------

/**
 * Driver profiles: pace relative to the track's reference lap, how consistent
 * they are, and how many laps they completed.
 */
const DRIVERS = [
  { name: 'Nina Alvarez', pace: 1.000, spread: 320, laps: 16, note: 'quickest overall' },
  { name: 'Marcus Webb', pace: 1.006, spread: 260, laps: 16, note: 'most consistent' },
  { name: 'Priya Raman', pace: 1.011, spread: 540, laps: 15, note: 'fast but variable' },
  { name: 'Tom Okafor', pace: 1.019, spread: 430, laps: 14, note: 'strong final sector' },
  { name: 'Jesse Lund', pace: 1.032, spread: 700, laps: 13, note: 'improving through the session' },
  { name: 'Dana Cho', pace: 1.048, spread: 900, laps: 12, note: 'rookie, one spin' },
];

// Reference lap for the circuit, split across three sectors.
const REFERENCE_LAP_MS = 31_400;
const SECTOR_SHARE = [0.351, 0.324, 0.325];

/**
 * Builds the demo lap session CSV.
 * @returns {string} CSV text.
 */
function buildLapSessionCsv() {
  const random = createRandom(20260812);
  const track = 'Fastimes Indoor Karting';
  const date = '2026-08-08';

  const rows = [['Track', 'Date', 'Driver', 'Lap', 'Time', 'Sector 1', 'Sector 2', 'Sector 3']];

  for (const driver of DRIVERS) {
    const base = REFERENCE_LAP_MS * driver.pace;

    for (let lap = 1; lap <= driver.laps; lap++) {
      // Drivers learn through the session, so early laps are slower.
      const learning = Math.max(0, (4 - lap)) * 260;
      // Tyres come in, then drop off slightly at the end of a long run.
      const wear = lap > driver.laps - 3 ? 90 : 0;
      const noise = (random() - 0.5) * 2 * driver.spread;

      let lapMs = base + learning + wear + noise;

      // One traffic-affected lap per driver, and a spin for the rookie.
      const isTraffic = lap === Math.max(5, Math.floor(driver.laps * 0.45));
      const isSpin = driver.name === 'Dana Cho' && lap === 7;
      if (isSpin) lapMs += 9_500;
      else if (isTraffic) lapMs += 1_450;

      // Sector split: distribute the lap, then let sectors vary independently
      // while still summing exactly to the lap time.
      const s1 = lapMs * SECTOR_SHARE[0] + (random() - 0.5) * 180;
      const s2 = lapMs * SECTOR_SHARE[1] + (random() - 0.5) * 180;
      const s3 = lapMs - s1 - s2;

      const lapRounded = Math.round(lapMs);
      const s1Rounded = Math.round(s1);
      const s2Rounded = Math.round(s2);
      // Absorb rounding in the final sector so the three always sum to the lap.
      const s3Rounded = lapRounded - s1Rounded - s2Rounded;

      rows.push([
        track,
        date,
        driver.name,
        String(lap),
        formatLapTime(lapRounded),
        formatSector(s1Rounded),
        formatSector(s2Rounded),
        formatSector(s3Rounded),
      ]);
    }
  }

  return rows.map((r) => r.join(',')).join('\n') + '\n';
}

// --- GPS trace -------------------------------------------------------------

const TRACK_ORIGIN = { lat: 39.6421, lon: -86.0688 }; // outdoor kart circuit near Indianapolis
const EARTH_RADIUS_M = 6_371_000;
const SAMPLE_HZ = 10;

/**
 * Circuit layout as a closed list of waypoints in metres, read as a kart track:
 * a main straight, a fast kink, a tight hairpin, a set of esses, a slow complex
 * and a long sweeper back onto the straight. Corner radius varies deliberately
 * so the speed gradient spans its full range.
 * @type {Array<[number, number]>}
 */
const CIRCUIT_WAYPOINTS = [
  [0, 0],        // start/finish, main straight heading east
  [70, 2],
  [140, 6],
  [196, 26],     // turn 1, fast right kink
  [214, 62],
  [196, 96],     // turn 2, hairpin entry
  [156, 104],    // hairpin apex
  [140, 74],     // hairpin exit, doubling back
  [104, 62],
  [78, 88],      // esses left
  [44, 96],      // esses right
  [22, 128],     // long left sweeper in
  [-26, 132],
  [-58, 104],    // slow complex
  [-40, 74],
  [-66, 46],     // tight left
  [-52, 14],
  [-24, -4],     // exit onto the main straight
];

/**
 * Evaluates a closed Catmull-Rom spline through the waypoints.
 * @param {number} t - Parameter in [0, 1) around the whole loop.
 * @returns {{x:number,y:number}} Metres from the track origin.
 */
function circuitPoint(t) {
  const pts = CIRCUIT_WAYPOINTS;
  const n = pts.length;
  const scaled = ((t % 1) + 1) % 1 * n;
  const i = Math.floor(scaled);
  const f = scaled - i;

  const p = (k) => pts[((k % n) + n) % n];
  const [x0, y0] = p(i - 1);
  const [x1, y1] = p(i);
  const [x2, y2] = p(i + 1);
  const [x3, y3] = p(i + 2);

  const f2 = f * f;
  const f3 = f2 * f;

  /**
   * Standard Catmull-Rom basis for one axis.
   * @param {number} a @param {number} b @param {number} c @param {number} d
   * @returns {number}
   */
  const interp = (a, b, c, d) =>
    0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);

  return { x: interp(x0, x1, x2, x3), y: interp(y0, y1, y2, y3) };
}

/**
 * Samples the centreline densely and returns points with cumulative distance
 * and local curvature.
 * @param {number} [samples=4000]
 * @returns {{points:Array<{x:number,y:number,s:number,curvature:number}>,length:number}}
 */
function buildCentreline(samples = 4000) {
  const raw = [];
  for (let i = 0; i < samples; i++) raw.push(circuitPoint(i / samples));

  const points = [];
  let s = 0;

  for (let i = 0; i < raw.length; i++) {
    const prev = raw[(i - 1 + raw.length) % raw.length];
    const cur = raw[i];
    const next = raw[(i + 1) % raw.length];

    if (i > 0) {
      s += Math.hypot(cur.x - raw[i - 1].x, cur.y - raw[i - 1].y);
    }

    // Menger curvature of the three consecutive samples.
    const a = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const b = Math.hypot(next.x - cur.x, next.y - cur.y);
    const c = Math.hypot(next.x - prev.x, next.y - prev.y);
    const area = Math.abs(
      (cur.x - prev.x) * (next.y - prev.y) - (next.x - prev.x) * (cur.y - prev.y)
    ) / 2;
    const curvature = a * b * c > 0 ? (4 * area) / (a * b * c) : 0;

    points.push({ ...cur, s, curvature });
  }

  const length = s + Math.hypot(raw[0].x - raw[raw.length - 1].x, raw[0].y - raw[raw.length - 1].y);
  return { points, length };
}

/**
 * Computes a physically plausible speed profile along the centreline:
 * cornering limit first, then braking and acceleration limits.
 *
 * @param {Array<{s:number,curvature:number}>} points
 * @param {{vMax:number,aLat:number,aBrake:number,aAccel:number}} limits
 * @returns {Array<number>} Speed in m/s per point.
 */
function computeSpeedProfile(points, limits) {
  const { vMax, aLat, aBrake, aAccel } = limits;
  const n = points.length;

  // Cornering limit from lateral grip.
  const speeds = points.map((p) =>
    Math.min(vMax, p.curvature > 1e-6 ? Math.sqrt(aLat / p.curvature) : vMax)
  );

  /**
   * Distance between two consecutive points, wrapping at the lap boundary.
   * @param {number} i
   * @param {number} j
   * @returns {number}
   */
  const gap = (i, j) => Math.abs(points[j].s - points[i].s) || 0.05;

  // Two wrapped passes settle the loop: brake into corners, then accelerate out.
  for (let pass = 0; pass < 2; pass++) {
    for (let k = n - 1; k >= 0; k--) {
      const i = k;
      const j = (k + 1) % n;
      const ds = gap(i, j);
      speeds[i] = Math.min(speeds[i], Math.sqrt(speeds[j] ** 2 + 2 * aBrake * ds));
    }
    for (let k = 0; k < n; k++) {
      const i = k;
      const j = (k + 1) % n;
      const ds = gap(i, j);
      speeds[j] = Math.min(speeds[j], Math.sqrt(speeds[i] ** 2 + 2 * aAccel * ds));
    }
  }

  return speeds;
}

/**
 * Converts local metres to WGS84 degrees around the track origin.
 * @param {number} x - Metres east.
 * @param {number} y - Metres north.
 * @returns {{lat:number,lon:number}}
 */
function toLatLon(x, y) {
  const lat = TRACK_ORIGIN.lat + (y / EARTH_RADIUS_M) * (180 / Math.PI);
  const lon =
    TRACK_ORIGIN.lon +
    (x / (EARTH_RADIUS_M * Math.cos((TRACK_ORIGIN.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat, lon };
}

/**
 * Interpolates the centreline at a given distance along the lap.
 * @param {Array<{x:number,y:number,s:number}>} points
 * @param {Array<number>} speeds
 * @param {number} distance
 * @returns {{x:number,y:number,speed:number}}
 */
function sampleAt(points, speeds, distance) {
  const total = points[points.length - 1].s;
  const d = ((distance % total) + total) % total;

  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].s < d) lo = mid + 1;
    else hi = mid;
  }

  const i = Math.max(1, lo);
  const p0 = points[i - 1];
  const p1 = points[i];
  const span = p1.s - p0.s || 1e-6;
  const f = (d - p0.s) / span;

  return {
    x: p0.x + (p1.x - p0.x) * f,
    y: p0.y + (p1.y - p0.y) * f,
    speed: speeds[i - 1] + (speeds[i] - speeds[i - 1]) * f,
  };
}

/**
 * Builds a multi-lap GPX trace by driving the speed profile around the circuit.
 * @returns {{gpx:string,summary:Object}}
 */
function buildLapTraceGpx() {
  const random = createRandom(770815);
  const { points } = buildCentreline();
  const lapLength = points[points.length - 1].s;

  const speeds = computeSpeedProfile(points, {
    vMax: 17.2,   // ~62 km/h on the main straight
    aLat: 7.4,    // lateral grip, so hairpins drop to roughly 25 km/h
    aBrake: 6.0,
    aAccel: 3.4,
  });

  // Each lap carries a small pace factor, so the ghost replay has a real delta.
  const lapPace = [1.045, 1.0, 1.017];
  const startTime = Date.parse('2026-08-08T14:12:30Z');
  const dt = 1 / SAMPLE_HZ;

  const trkpts = [];
  const lapTimes = [];
  let elapsed = 0;
  let distance = 0;

  for (let lap = 0; lap < lapPace.length; lap++) {
    const lapStart = elapsed;
    const lapStartDistance = distance;

    while (distance - lapStartDistance < lapLength) {
      const sample = sampleAt(points, speeds, distance);
      const { lat, lon } = toLatLon(sample.x, sample.y);

      trkpts.push({
        lat,
        lon,
        // GPS noise at the centimetre-to-decimetre level keeps it realistic
        // without breaking lap detection.
        time: startTime + Math.round(elapsed * 1000),
        speed: sample.speed,
      });

      const v = Math.max(2, sample.speed / lapPace[lap] + (random() - 0.5) * 0.25);
      distance += v * dt;
      elapsed += dt;
    }

    lapTimes.push(elapsed - lapStart);
  }

  // Close the trace back on the start/finish line.
  const closing = sampleAt(points, speeds, 0);
  const closingLatLon = toLatLon(closing.x, closing.y);
  trkpts.push({
    lat: closingLatLon.lat,
    lon: closingLatLon.lon,
    time: startTime + Math.round(elapsed * 1000),
    speed: closing.speed,
  });

  const body = trkpts
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">\n` +
        `        <time>${new Date(p.time).toISOString().replace('.000Z', 'Z')}</time>\n` +
        `      </trkpt>`
    )
    .join('\n');

  const gpx =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Apex demo data generator" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n` +
    `    <name>Apex demo lap trace</name>\n` +
    `    <desc>Synthetic three-lap kart telemetry: ${(lapLength).toFixed(0)}m circuit, ` +
    `${SAMPLE_HZ}Hz sampling.</desc>\n` +
    `    <time>${new Date(startTime).toISOString().replace('.000Z', 'Z')}</time>\n` +
    `  </metadata>\n` +
    `  <trk>\n    <name>Demo kart session</name>\n    <trkseg>\n${body}\n    </trkseg>\n  </trk>\n</gpx>\n`;

  return {
    gpx,
    summary: {
      lapLength,
      points: trkpts.length,
      lapTimes,
      peakKph: Math.max(...speeds) * 3.6,
    },
  };
}

// --- Write -----------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });

const csv = buildLapSessionCsv();
fs.writeFileSync(path.join(OUT_DIR, 'demo_session.csv'), csv);
console.log(
  `dataset/demo_session.csv: ${csv.trim().split('\n').length - 1} laps, ${DRIVERS.length} drivers`
);

const { gpx, summary } = buildLapTraceGpx();
fs.writeFileSync(path.join(OUT_DIR, 'demo_lap_trace.gpx'), gpx);
console.log(
  `dataset/demo_lap_trace.gpx: ${summary.points} points, ` +
    `${summary.lapLength.toFixed(0)}m lap, ` +
    `laps ${summary.lapTimes.map((t) => t.toFixed(1) + 's').join(' / ')}, ` +
    `peak ${summary.peakKph.toFixed(1)} km/h`
);
