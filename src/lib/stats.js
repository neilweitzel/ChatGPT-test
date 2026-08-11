/**
 * Formats time in milliseconds into a readable string (e.g. '1:23.456' or '45.678').
 * @param {number} ms - The time in milliseconds.
 * @returns {string} The formatted time string.
 */
export function formatTime(ms) {
  if (ms === null || ms === undefined || isNaN(ms) || ms === Infinity) return '-';
  const isNegative = ms < 0;
  ms = Math.abs(Math.round(ms));

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  const paddedMs = milliseconds.toString().padStart(3, '0');

  let formatted = '';
  if (minutes > 0) {
    const paddedSec = seconds.toString().padStart(2, '0');
    formatted = `${minutes}:${paddedSec}.${paddedMs}`;
  } else {
    formatted = `${seconds}.${paddedMs}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Computes leaderboard statistics for a given session.
 * Calculates best laps, median laps, consistency, and theoretical bests for all drivers.
 * @param {Object} session - The parsed session object containing lap data.
 * @returns {{ drivers: Array<Object>, overallBestLap: number|null, overallBestSectors: Array<number> }} The computed leaderboard data.
 */
export function computeLeaderboard(session) {
  const driverStats = new Map();
  let overallBestLap = Infinity;
  const overallBestSectors = [];

  session.drivers.forEach(d => {
    driverStats.set(d, {
      driver: d,
      laps: [],
      bestLap: Infinity,
      bestSectors: [],
      averageLap: 0,
      medianLap: 0,
      consistency: 0,
      theoreticalBest: null
    });
  });

  // Group laps and find bests
  session.laps.forEach(lap => {
    let stats = driverStats.get(lap.driver);
    if (!stats) {
      // In case driver wasn't in session.drivers
      stats = {
        driver: lap.driver,
        laps: [],
        bestLap: Infinity,
        bestSectors: [],
        averageLap: 0,
        medianLap: 0,
        consistency: 0,
        theoreticalBest: null
      };
      driverStats.set(lap.driver, stats);
    }

    stats.laps.push(lap.time);

    if (lap.time < stats.bestLap) {
      stats.bestLap = lap.time;
    }
    if (lap.time < overallBestLap) {
      overallBestLap = lap.time;
    }

    if (lap.sectors && lap.sectors.length > 0) {
      lap.sectors.forEach((sec, idx) => {
        if (sec === null || isNaN(sec)) return;

        // Driver best
        if (stats.bestSectors[idx] === undefined || sec < stats.bestSectors[idx]) {
          stats.bestSectors[idx] = sec;
        }
        // Overall best
        if (overallBestSectors[idx] === undefined || sec < overallBestSectors[idx]) {
          overallBestSectors[idx] = sec;
        }
      });
    }
  });

  const results = [];

  for (const stats of driverStats.values()) {
    if (stats.laps.length === 0) continue;

    stats.laps.sort((a, b) => a - b);

    // Average
    const sum = stats.laps.reduce((acc, t) => acc + t, 0);
    stats.averageLap = sum / stats.laps.length;

    // Median
    const mid = Math.floor(stats.laps.length / 2);
    if (stats.laps.length % 2 === 0) {
      stats.medianLap = (stats.laps[mid - 1] + stats.laps[mid]) / 2;
    } else {
      stats.medianLap = stats.laps[mid];
    }

    // Consistency (Sample Standard Deviation of laps <= 105% of best)
    const threshold = stats.bestLap * 1.05;
    const validLaps = stats.laps.filter(t => t <= threshold);

    if (validLaps.length > 1) {
      const validSum = validLaps.reduce((acc, t) => acc + t, 0);
      const validMean = validSum / validLaps.length;
      const sqDiffs = validLaps.map(t => Math.pow(t - validMean, 2));
      const variance = sqDiffs.reduce((acc, diff) => acc + diff, 0) / (validLaps.length - 1);
      stats.consistency = Math.sqrt(variance);
    } else {
      stats.consistency = 0;
    }

    // Theoretical Best
    // Assume 3 sectors minimum, or rely on length of overallBestSectors which tracks total sectors found.
    const numSectors = Math.max(3, overallBestSectors.length);
    if (stats.bestSectors.length === numSectors && !stats.bestSectors.includes(undefined)) {
      stats.theoreticalBest = stats.bestSectors.reduce((acc, s) => acc + s, 0);
    }

    results.push(stats);
  }

  return {
    drivers: results,
    overallBestLap: overallBestLap !== Infinity ? overallBestLap : null,
    overallBestSectors
  };
}
