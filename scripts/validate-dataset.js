#!/usr/bin/env node
/**
 * Validates telemetry data files against the parsers Apex actually uses.
 *
 * Usage:
 *   node scripts/validate-dataset.js [file ...]
 *
 * With no arguments every file in dataset/ and fixtures/ is checked.
 *
 * Two classes of finding are reported:
 *   errors   - the file would not load correctly in the app.
 *   warnings - the file loads, but the data is degenerate enough that it is
 *              misleading as a demo or as a screenshot source (for example a
 *              driver with a single lap, or thousands of identical rows).
 *
 * scripts/data-expectations.json declares each committed file's intent, so a
 * deliberately broken fixture is not reported as a repo problem:
 *   valid      must parse cleanly with no quality warnings (the default)
 *   synthetic  must parse cleanly; quality warnings are demoted to notes
 *   invalid    must fail to parse; parsing cleanly is itself an error
 *
 * Exits non-zero on any unexpected finding, so it can gate CI.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectTelemetryFormat } from '../src/lib/detect.js';
import { parseCSV, parseTime } from '../src/lib/parser.js';
import { parseGPX, parseGPSCSV, processTelemetry } from '../src/lib/map.js';
import { computeLeaderboard, formatTime } from '../src/lib/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXPECTATIONS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data-expectations.json'), 'utf8')
).files;

// A kart lap under 15s or over 5min is almost certainly a parsing artefact.
const MIN_PLAUSIBLE_LAP_MS = 15_000;
const MAX_PLAUSIBLE_LAP_MS = 300_000;
// Sector times should reconstruct the lap time to within a rounding margin.
const SECTOR_SUM_TOLERANCE_MS = 150;
// Sessions longer than this are not physically plausible for one karting day.
const MAX_PLAUSIBLE_LAPS_PER_DRIVER = 500;

/**
 * Collects findings for a single file.
 */
class Report {
  /** @param {string} file - Path relative to the repo root. */
  constructor(file) {
    this.file = file;
    this.errors = [];
    this.warnings = [];
    this.facts = [];
  }

  /** @param {string} msg */
  error(msg) { this.errors.push(msg); }
  /** @param {string} msg */
  warn(msg) { this.warnings.push(msg); }
  /** @param {string} msg */
  fact(msg) { this.facts.push(msg); }
}

/**
 * Returns the standard deviation of a numeric sample.
 * @param {Array<number>} values
 * @returns {number}
 */
function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Validates a lap-time CSV.
 * @param {string} text - File contents.
 * @param {Report} report
 */
function validateLapCsv(text, report) {
  const { sessions, errors } = parseCSV(text);

  for (const err of errors.slice(0, 10)) {
    report.error(`row ${err.row}: ${err.message}`);
  }
  if (errors.length > 10) {
    report.error(`...and ${errors.length - 10} further row errors`);
  }

  if (sessions.length === 0) {
    report.error('no sessions parsed');
    return;
  }

  const totalLaps = sessions.reduce((n, s) => n + s.laps.length, 0);
  report.fact(`${sessions.length} session(s), ${totalLaps} laps`);

  // Header sanity: the app needs a driver column to build a leaderboard.
  const headerLine = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '';
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  if (!headers.includes('driver')) {
    report.warn('no Driver column: every lap is attributed to "Unknown Driver"');
  }

  for (const session of sessions) {
    const label = `${session.track} ${session.date}`;
    const stats = computeLeaderboard(session);

    report.fact(
      `${label}: ${session.drivers.length} driver(s), ` +
        `best ${formatTime(stats.overallBestLap)}`
    );

    // Duplicate driver+lap keys collapse when a session is re-uploaded.
    const seen = new Set();
    const duplicates = new Set();
    for (const lap of session.laps) {
      const key = `${lap.driver}#${lap.lap}`;
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    }
    if (duplicates.size > 0) {
      report.error(
        `${label}: ${duplicates.size} duplicate driver+lap key(s), e.g. ${[...duplicates][0]}` +
          ' - these merge into one lap when the file is uploaded twice'
      );
    }

    // Implausible lap times usually mean a mis-parsed time column.
    for (const lap of session.laps) {
      if (lap.time < MIN_PLAUSIBLE_LAP_MS || lap.time > MAX_PLAUSIBLE_LAP_MS) {
        report.warn(
          `${label}: implausible lap time ${formatTime(lap.time)} ` +
            `(${lap.driver} lap ${lap.lap})`
        );
        break;
      }
    }

    // Sector times should add up to the lap time.
    let mismatches = 0;
    let sectorLaps = 0;
    for (const lap of session.laps) {
      const sectors = lap.sectors || [];
      if (sectors.length === 0 || sectors.some((s) => typeof s !== 'number')) continue;
      sectorLaps++;
      const sum = sectors.reduce((a, s) => a + s, 0);
      if (Math.abs(sum - lap.time) > SECTOR_SUM_TOLERANCE_MS) mismatches++;
    }
    if (sectorLaps === 0) {
      report.warn(`${label}: no lap has a complete set of sectors, so no theoretical best`);
    } else if (mismatches > 0) {
      report.error(
        `${label}: ${mismatches} of ${sectorLaps} laps have sectors that do not sum to the lap time`
      );
    }

    // Degenerate shapes that make charts and stats meaningless.
    for (const driver of stats.drivers) {
      if (driver.laps.length === 1) {
        report.warn(
          `${label}: ${driver.driver} has a single lap, so median, average and consistency are trivial`
        );
      }
      if (driver.laps.length > MAX_PLAUSIBLE_LAPS_PER_DRIVER) {
        report.warn(
          `${label}: ${driver.driver} has ${driver.laps.length} laps, which is not a plausible session`
        );
      }
      if (driver.laps.length > 5 && stdDev(driver.laps) < 5) {
        report.warn(
          `${label}: ${driver.driver}'s lap times are effectively identical ` +
            `(sigma ${stdDev(driver.laps).toFixed(1)}ms), so the lap trace is a flat line`
        );
      }
    }

    const uniqueTimes = new Set(session.laps.map((l) => l.time));
    if (session.laps.length > 10 && uniqueTimes.size <= 3) {
      report.warn(
        `${label}: only ${uniqueTimes.size} distinct lap time(s) across ${session.laps.length} laps`
      );
    }

    const identicalRows = session.laps.length - new Set(
      session.laps.map((l) => `${l.driver}|${l.time}|${(l.sectors || []).join(',')}`)
    ).size;
    if (identicalRows > 0) {
      report.warn(`${label}: ${identicalRows} laps duplicate another lap value-for-value`);
    }
  }
}

/**
 * Validates a GPS trace (GPX or lat/lon CSV).
 * @param {string} text - File contents.
 * @param {'gpx'|'gps-csv'} format
 * @param {Report} report
 */
function validateGpsTrace(text, format, report) {
  const points = format === 'gpx' ? parseGPX(text) : parseGPSCSV(text);

  if (points.length === 0) {
    report.error('no usable GPS points (each point needs lat, lon and a timestamp)');
    return;
  }

  const rawCount = format === 'gpx'
    ? (text.match(/<trkpt/gi) || []).length
    : text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim()).length - 1;
  if (rawCount > points.length) {
    report.warn(`${rawCount - points.length} of ${rawCount} points skipped as unusable`);
  }

  const nonMonotonic = points.filter((p, i) => i > 0 && p.time <= points[i - 1].time).length;
  if (nonMonotonic > 0) {
    report.error(`${nonMonotonic} point(s) do not advance in time`);
  }

  const mapData = processTelemetry(points);
  if (!mapData) {
    report.error('processTelemetry returned no track');
    return;
  }

  const speeds = mapData.points.map((p) => p.speed).filter(Number.isFinite);
  const maxKph = Math.max(...speeds) * 3.6;
  const spanS = (points[points.length - 1].time - points[0].time) / 1000;

  report.fact(
    `${points.length} points, ${spanS.toFixed(1)}s, ` +
      `${mapData.laps.length} lap(s), peak ${maxKph.toFixed(1)} km/h`
  );

  if (mapData.laps.length < 2) {
    report.warn('fewer than 2 laps detected, so ghost sync replay cannot run');
  }
  if (new Set(speeds.map((s) => Math.round(s))).size < 5) {
    report.warn('speed is nearly constant, so the speed gradient shows one colour');
  }
  if (maxKph > 200) {
    report.warn(`peak speed ${maxKph.toFixed(0)} km/h is implausible for a kart`);
  }

  for (const lap of mapData.laps) {
    if (lap.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      report.error('lap contains non-finite coordinates');
      break;
    }
  }
}

/**
 * Validates one file and returns its report.
 * @param {string} file - Path relative to the repo root.
 * @returns {Report}
 */
function validateFile(file) {
  const report = new Report(file);
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');

  if (!text.trim()) {
    report.error('file is empty');
    return report;
  }

  const format = detectTelemetryFormat(text, file);
  report.fact(`detected format: ${format}`);

  switch (format) {
    case 'lap-csv':
      validateLapCsv(text, report);
      break;
    case 'gpx':
    case 'gps-csv':
      validateGpsTrace(text, format, report);
      break;
    default:
      report.error('format not recognized by the app; it would be rejected on upload');
  }

  return report;
}

/**
 * Resolves the list of files to validate.
 * @param {Array<string>} args - CLI arguments.
 * @returns {Array<string>} Repo-relative file paths.
 */
function resolveTargets(args) {
  if (args.length > 0) {
    return args.map((a) => path.relative(ROOT, path.resolve(a)));
  }
  const targets = [];
  for (const dir of ['dataset', 'fixtures']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs).sort()) {
      if (/\.(csv|gpx)$/i.test(name)) targets.push(path.join(dir, name));
    }
  }
  return targets;
}

const targets = resolveTargets(process.argv.slice(2));
let failures = 0;
let warnings = 0;

console.log(`Validating ${targets.length} file(s) against the Apex parsers\n`);

for (const file of targets) {
  const report = validateFile(file);
  const expectation = EXPECTATIONS[file] || { expect: 'valid' };

  let errors = report.errors;
  let quality = report.warnings;
  const notes = [];

  if (expectation.expect === 'invalid') {
    // The file is meant to be broken, so parse errors are the expected outcome.
    if (errors.length === 0) {
      errors = ['expected this file to be rejected, but it parsed cleanly'];
    } else {
      notes.push(`${errors.length} parse error(s), as expected`);
      errors = [];
      quality = [];
    }
  } else if (expectation.expect === 'synthetic') {
    // Deliberately degenerate: keep the findings visible but do not fail on them.
    notes.push(...quality.map((w) => `known: ${w}`));
    quality = [];
  }

  failures += errors.length;
  warnings += quality.length;

  const status = errors.length > 0 ? 'FAIL' : quality.length > 0 ? 'WARN' : 'OK';
  console.log(`[${status}] ${file}  (${expectation.expect})`);
  if (expectation.why) console.log(`       ${expectation.why}`);
  for (const fact of report.facts) console.log(`       ${fact}`);
  for (const err of errors) console.log(`  error: ${err}`);
  for (const warn of quality) console.log(`   warn: ${warn}`);
  for (const note of notes) console.log(`   note: ${note}`);
  console.log('');
}

console.log(`${failures} unexpected error(s), ${warnings} unexpected warning(s)`);
process.exit(failures > 0 || warnings > 0 ? 1 : 0);
