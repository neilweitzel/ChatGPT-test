import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { detectTelemetryFormat, normalizeHeaders, firstNonEmptyLine } from '../src/lib/detect.js';

/**
 * Unit tests for header-driven telemetry format detection. These guard the
 * routing decision that sends a file to the lap parser or the GPS parser.
 */
test.describe('Telemetry format detection', () => {
  test('detects lap CSVs from their header row', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/clean_session.csv'), 'utf8');
    expect(detectTelemetryFormat(text, 'clean_session.csv')).toBe('lap-csv');
  });

  test('detects lap CSVs with a BOM and shuffled columns', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/messy_columns.csv'), 'utf8');
    expect(detectTelemetryFormat(text, 'messy_columns.csv')).toBe('lap-csv');
  });

  test('detects GPX by extension and by root element', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/kart_track.gpx'), 'utf8');
    expect(detectTelemetryFormat(text, 'kart_track.gpx')).toBe('gpx');
    expect(detectTelemetryFormat(text, 'mystery.txt')).toBe('gpx');
  });

  test('detects GPS CSVs from lat/lon/time headers', () => {
    const csv = 'Lat,Lon,Time\n0.0,0.0,1000\n0.001,0.0,2000';
    expect(detectTelemetryFormat(csv, 'trace.csv')).toBe('gps-csv');

    const verbose = 'Latitude,Longitude,Timestamp\n0.0,0.0,1000';
    expect(detectTelemetryFormat(verbose, 'trace.csv')).toBe('gps-csv');
  });

  test('does not mistake lap data containing "lat" for a GPS trace', () => {
    // The old substring heuristic misrouted these to the map renderer.
    const csv = [
      'Track,Date,Driver,Lap,Time',
      'Atlanta Motorsports Park,2023-10-01,Latoya,1,1:25.100',
      'Atlanta Motorsports Park,2023-10-01,Latoya,2,1:24.900',
    ].join('\n');
    expect(detectTelemetryFormat(csv, 'session.csv')).toBe('lap-csv');
  });

  test('reports unknown for empty or unrelated files', () => {
    expect(detectTelemetryFormat('', 'empty.csv')).toBe('unknown');
    expect(detectTelemetryFormat('   \n  \n', 'blank.csv')).toBe('unknown');
    expect(detectTelemetryFormat('name,email\nAda,ada@example.com', 'contacts.csv')).toBe('unknown');
  });

  test('normalizes headers and finds the header line', () => {
    expect(firstNonEmptyLine('\n\n  Lat,Lon,Time\n0,0,0')).toBe('  Lat,Lon,Time');
    expect(normalizeHeaders('"Sector 1", LAP ,Time,')).toEqual(['sector 1', 'lap', 'time']);
  });
});
