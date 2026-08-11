import { test, expect } from '@playwright/test';
import { parseCSV } from '../src/lib/parser.js';
import { computeLeaderboard, formatTime } from '../src/lib/stats.js';
import fs from 'fs';
import path from 'path';

test.describe('Stats Logic', () => {
  test('formats time correctly', () => {
    expect(formatTime(null)).toBe('-');
    expect(formatTime(NaN)).toBe('-');
    expect(formatTime(Infinity)).toBe('-');
    expect(formatTime(85100)).toBe('1:25.100'); // 1 min 25.1 sec
    expect(formatTime(45123)).toBe('45.123'); // 45.123 sec
    expect(formatTime(120005)).toBe('2:00.005');
  });

  test('computes leaderboard stats correctly', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/leaderboard_test.csv'), 'utf8');
    const { sessions } = parseCSV(text);
    const session = sessions[0];
    const stats = computeLeaderboard(session);

    // Alice: Laps [85000, 86000, 87000]
    // Best: 85000, Avg: 86000, Median: 86000
    // Consistency: <= 105% of 85000 (which is 89250), so all laps are valid.
    // StdDev of [85000, 86000, 87000] is 1000
    // Best Sectors: [28000, 29000, 28000] => Theo Best: 85000

    // Bob: Laps [85000, 95000]
    // Best: 85000, Avg: 90000, Median: 90000
    // Consistency: valid <= 89250. Only 85000 is valid. Length 1, so consistency is 0.
    // Best Sectors: [28100, 28900, 28000] => Theo Best: 85000

    // Charlie: Laps [90000, 91000]
    // Best: 90000, Avg: 90500, Median: 90500
    // Theo Best: null (no sectors)

    const alice = stats.drivers.find(d => d.driver === 'Alice');
    expect(alice.bestLap).toBe(85000);
    expect(alice.averageLap).toBe(86000);
    expect(alice.medianLap).toBe(86000);
    expect(alice.consistency).toBeCloseTo(1000, 0);
    expect(alice.theoreticalBest).toBe(85000);

    const bob = stats.drivers.find(d => d.driver === 'Bob');
    expect(bob.bestLap).toBe(85000); // Tied with Alice
    expect(bob.averageLap).toBe(90000);
    expect(bob.medianLap).toBe(90000);
    expect(bob.consistency).toBe(0);
    expect(bob.theoreticalBest).toBe(85000);

    const charlie = stats.drivers.find(d => d.driver === 'Charlie');
    expect(charlie.bestLap).toBe(90000);
    expect(charlie.averageLap).toBe(90500);
    expect(charlie.medianLap).toBe(90500);
    expect(charlie.theoreticalBest).toBeNull();

    expect(stats.overallBestLap).toBe(85000);
  });
});
