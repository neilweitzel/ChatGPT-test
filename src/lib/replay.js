/**
 * Distance-synchronized ghost replay maths.
 *
 * Pure functions only: given two laps and an elapsed time on the reference lap,
 * they return the world-space position of each kart plus the time delta.
 */

import { interpolate } from './map.js';

/**
 * @typedef {Object} GhostState
 * @property {number} elapsed - Clamped elapsed time on lap A, in milliseconds.
 * @property {number} distance - Distance travelled on lap A, in metres.
 * @property {{x:number,y:number}} a - World position of the reference kart.
 * @property {{x:number,y:number}} b - World position of the ghost kart.
 * @property {number} deltaMs - Ghost delta in milliseconds. Positive means the
 *   ghost lap is slower at this point on track.
 */

/**
 * Returns the duration of a lap in milliseconds.
 * @param {Array<{t:number}>} lap - Lap points carrying a relative time `t`.
 * @returns {number} Lap duration, or 0 for an empty lap.
 */
export function lapDuration(lap) {
  if (!lap || lap.length === 0) return 0;
  return lap[lap.length - 1].t;
}

/**
 * Computes the replay state for a given elapsed time on the reference lap.
 *
 * The ghost is synchronized by distance: the delta is the time the ghost lap
 * needed to reach the same point on track, minus the reference lap's time.
 *
 * @param {Array<Object>} lapA - Reference lap points (with `t`, `dist`, `x`, `y`).
 * @param {Array<Object>} lapB - Ghost lap points.
 * @param {number} elapsed - Elapsed time on lap A, in milliseconds.
 * @returns {GhostState|null} The replay state, or null when either lap is empty.
 */
export function computeGhostState(lapA, lapB, elapsed) {
  if (!lapA || lapA.length === 0 || !lapB || lapB.length === 0) return null;

  const maxTime = lapDuration(lapA);
  const clamped = Math.max(0, Math.min(maxTime, Number.isFinite(elapsed) ? elapsed : 0));

  const distance = interpolate(lapA, clamped, 't', 'dist');
  const a = {
    x: interpolate(lapA, distance, 'dist', 'x'),
    y: interpolate(lapA, distance, 'dist', 'y'),
  };

  const timeBAtDistance = interpolate(lapB, distance, 'dist', 't');
  const deltaMs = timeBAtDistance - clamped;

  // The ghost is drawn at the point lap B had reached at the same wall-clock
  // moment, which is the reference distance offset by the delta.
  const ghostDistance = interpolate(lapA, clamped - deltaMs, 't', 'dist');
  const b = {
    x: interpolate(lapB, ghostDistance, 'dist', 'x'),
    y: interpolate(lapB, ghostDistance, 'dist', 'y'),
  };

  return { elapsed: clamped, distance, a, b, deltaMs };
}

/**
 * Formats a millisecond delta as a signed, fixed-precision seconds string.
 * @param {number} deltaMs - Delta in milliseconds.
 * @returns {string} e.g. `+0.412s` or `-1.030s`.
 */
export function formatDelta(deltaMs) {
  const seconds = (Number.isFinite(deltaMs) ? deltaMs : 0) / 1000;
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(3)}s`;
}
