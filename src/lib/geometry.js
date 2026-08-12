/**
 * Pure geometry and colour helpers for track map rendering.
 *
 * These functions contain no DOM access so they can be unit tested directly
 * and reused by any renderer.
 */

/**
 * Computes the bounding box and speed range of a set of projected points.
 * @param {Array<{x:number,y:number,speed?:number}>} points
 * @returns {{minX:number,maxX:number,minY:number,maxY:number,minSpeed:number,maxSpeed:number}|null}
 *   Bounds, or null when there are no points.
 */
export function computeBounds(points) {
  if (!points || points.length === 0) return null;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minSpeed = Infinity, maxSpeed = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    const speed = typeof pt.speed === 'number' ? pt.speed : 0;
    if (speed < minSpeed) minSpeed = speed;
    if (speed > maxSpeed) maxSpeed = speed;
  }

  return { minX, maxX, minY, maxY, minSpeed, maxSpeed };
}

/**
 * Builds a projector that maps world coordinates into a fixed-size SVG
 * viewport, preserving aspect ratio and flipping the Y axis for screen space.
 *
 * @param {{minX:number,maxX:number,minY:number,maxY:number}} bounds
 * @param {{width:number,height:number,padding?:number}} viewport
 * @returns {{scale:number,offsetX:number,offsetY:number,width:number,height:number,
 *   project:(x:number,y:number)=>{x:number,y:number}}} A projector object.
 */
export function createProjector(bounds, viewport) {
  const { width, height, padding = 20 } = viewport;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;

  const scale = w > 0 && h > 0
    ? Math.min((width - 2 * padding) / w, (height - 2 * padding) / h)
    : 1;

  const offsetX = (width - w * scale) / 2;
  const offsetY = (height - h * scale) / 2;

  return {
    scale,
    offsetX,
    offsetY,
    width,
    height,
    project(x, y) {
      return {
        x: (x - bounds.minX) * scale + offsetX,
        y: height - ((y - bounds.minY) * scale + offsetY),
      };
    },
  };
}

/**
 * Returns the value at a given percentile of a numeric sample.
 * Used to clip speed outliers so the gradient stays readable.
 *
 * @param {Array<number>} values - Unsorted numeric values.
 * @param {number} p - Percentile in the range 0..1.
 * @returns {number} The percentile value, or 0 for an empty sample.
 */
export function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

/**
 * Maps a speed onto a blue (slow) → green → red (fast) gradient.
 * @param {number} speed - Speed value in metres per second.
 * @param {number} minSpeed - Lower bound of the gradient.
 * @param {number} maxSpeed - Upper bound of the gradient.
 * @returns {string} An `rgb(r,g,b)` colour string.
 */
export function speedToColor(speed, minSpeed, maxSpeed) {
  if (maxSpeed === minSpeed) return 'rgb(0,255,0)';

  let t = (speed - minSpeed) / (maxSpeed - minSpeed);
  t = Math.max(0, Math.min(1, t));

  let r, g, b;
  if (t < 0.5) {
    const factor = t * 2;
    r = 0;
    g = Math.round(255 * factor);
    b = Math.round(255 * (1 - factor));
  } else {
    const factor = (t - 0.5) * 2;
    r = Math.round(255 * factor);
    g = Math.round(255 * (1 - factor));
    b = 0;
  }

  return `rgb(${r},${g},${b})`;
}
