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
    const text = fs.readFileSync(path.join(process.cwd(), 'dataset/test_data.csv'), 'utf8');
    const { sessions } = parseCSV(text);
    const session = sessions[0];
    const stats = computeLeaderboard(session);

    const mario = stats.drivers.find(d => d.driver === 'Mario');
    expect(mario.bestLap).toBe(84900);
    expect(mario.averageLap).toBeCloseTo(85100, -2);
    expect(mario.medianLap).toBeCloseTo(85100, -2);
    expect(mario.theoreticalBest).toBe(84900);

    const luigi = stats.drivers.find(d => d.driver === 'Luigi');
    expect(luigi.bestLap).toBe(86000);
    expect(luigi.averageLap).toBe(86000);
    expect(luigi.medianLap).toBe(86000);
    expect(luigi.theoreticalBest).toBe(86000);

    expect(stats.overallBestLap).toBe(84900);
  });
});
