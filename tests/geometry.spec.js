import { test, expect } from '@playwright/test';
import { computeBounds, createProjector, percentile, speedToColor } from '../src/lib/geometry.js';
import { computeGhostState, formatDelta, lapDuration } from '../src/lib/replay.js';

/**
 * Unit tests for the pure geometry, speed gradient, and ghost replay maths
 * extracted out of the DOM layer.
 */
test.describe('Map geometry', () => {
  test('computes bounds over points and speeds', () => {
    const bounds = computeBounds([
      { x: 0, y: 0, speed: 5 },
      { x: 10, y: 4, speed: 15 },
      { x: -2, y: 8, speed: 10 },
    ]);

    expect(bounds).toEqual({ minX: -2, maxX: 10, minY: 0, maxY: 8, minSpeed: 5, maxSpeed: 15 });
    expect(computeBounds([])).toBeNull();
  });

  test('projects into the viewport preserving aspect ratio and flipping Y', () => {
    const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    const projector = createProjector(bounds, { width: 600, height: 400, padding: 20 });

    // Square track in a 600x400 viewport: limited by height -> (400 - 40) / 100
    expect(projector.scale).toBeCloseTo(3.6, 5);

    const origin = projector.project(0, 0);
    const top = projector.project(0, 100);

    // Y is flipped: the maximum world Y maps to the smaller screen Y.
    expect(top.y).toBeLessThan(origin.y);
    // The track is centred horizontally.
    expect(origin.x).toBeCloseTo((600 - 360) / 2, 5);
  });

  test('handles degenerate bounds without dividing by zero', () => {
    const projector = createProjector({ minX: 5, maxX: 5, minY: 5, maxY: 5 }, { width: 600, height: 400 });
    expect(projector.scale).toBe(1);
    expect(Number.isFinite(projector.project(5, 5).x)).toBe(true);
  });
});

test.describe('Speed gradient', () => {
  test('clips outliers via percentiles', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    expect(percentile(values, 0.05)).toBe(1);
    expect(percentile(values, 0.95)).toBe(100);
    expect(percentile([], 0.5)).toBe(0);
  });

  test('maps slow to blue, mid to green, and fast to red', () => {
    expect(speedToColor(0, 0, 10)).toBe('rgb(0,0,255)');
    expect(speedToColor(5, 0, 10)).toBe('rgb(0,255,0)');
    expect(speedToColor(10, 0, 10)).toBe('rgb(255,0,0)');
  });

  test('clamps out-of-range speeds and handles a flat range', () => {
    expect(speedToColor(-5, 0, 10)).toBe('rgb(0,0,255)');
    expect(speedToColor(50, 0, 10)).toBe('rgb(255,0,0)');
    expect(speedToColor(7, 7, 7)).toBe('rgb(0,255,0)');
  });
});

test.describe('Ghost sync replay maths', () => {
  // Lap A covers 100 m in 10 s; lap B covers the same 100 m in 12 s.
  const lapA = [
    { t: 0, dist: 0, x: 0, y: 0 },
    { t: 5000, dist: 50, x: 50, y: 0 },
    { t: 10000, dist: 100, x: 100, y: 0 },
  ];
  const lapB = [
    { t: 0, dist: 0, x: 0, y: 1 },
    { t: 6000, dist: 50, x: 50, y: 1 },
    { t: 12000, dist: 100, x: 100, y: 1 },
  ];

  test('reports lap duration', () => {
    expect(lapDuration(lapA)).toBe(10000);
    expect(lapDuration([])).toBe(0);
  });

  test('synchronizes the ghost by distance and reports a positive delta for the slower lap', () => {
    const state = computeGhostState(lapA, lapB, 5000);

    expect(state.distance).toBeCloseTo(50, 5);
    expect(state.a.x).toBeCloseTo(50, 5);
    // Lap B needed 6 s to reach 50 m, so it is 1 s slower at this point.
    expect(state.deltaMs).toBeCloseTo(1000, 5);
    // At the same wall-clock moment the ghost is still short of 50 m.
    expect(state.b.x).toBeLessThan(50);
    expect(state.b.y).toBeCloseTo(1, 5);
  });

  test('clamps elapsed time to the lap and tolerates bad input', () => {
    expect(computeGhostState(lapA, lapB, -500).elapsed).toBe(0);
    expect(computeGhostState(lapA, lapB, 99999).elapsed).toBe(10000);
    expect(computeGhostState(lapA, lapB, NaN).elapsed).toBe(0);
    expect(computeGhostState([], lapB, 0)).toBeNull();
    expect(computeGhostState(lapA, [], 0)).toBeNull();
  });

  test('formats deltas with a sign and three decimals', () => {
    expect(formatDelta(1234)).toBe('+1.234s');
    expect(formatDelta(-1030)).toBe('-1.030s');
    expect(formatDelta(0)).toBe('0.000s');
    expect(formatDelta(NaN)).toBe('0.000s');
  });
});
