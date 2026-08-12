/**
 * Track map rendering (DOM layer).
 *
 * Draws the racing line as speed-coloured segments, marks the start/finish
 * line, adds the speed gradient legend, and hands ghost replay off to
 * `src/ui/replay.js`. Geometry and colour maths live in `src/lib/geometry.js`.
 */

import { computeBounds, createProjector, percentile, speedToColor } from '../lib/geometry.js';
import { attachReplay } from './replay.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEWPORT = { width: 600, height: 400, padding: 20 };

/**
 * Renders an empty-state message.
 * @param {HTMLElement} container
 * @param {string} message
 */
function renderEmpty(container, message) {
  const p = document.createElement('p');
  p.className = 'map-empty';
  p.textContent = message;
  container.appendChild(p);
}

/**
 * Draws the racing line, coloured by speed, into an SVG element.
 * @param {SVGSVGElement} svg
 * @param {Array<Object>} points - Projected telemetry points.
 * @param {{project:(x:number,y:number)=>{x:number,y:number}}} projector
 */
function drawRacingLine(svg, points, projector) {
  const speeds = points.map((p) => (typeof p.speed === 'number' ? p.speed : 0));
  const low = percentile(speeds, 0.05);
  const high = percentile(speeds, 0.95);

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'racing-line');

  for (let i = 0; i < points.length - 1; i++) {
    const from = projector.project(points[i].x, points[i].y);
    const to = projector.project(points[i + 1].x, points[i + 1].y);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x));
    line.setAttribute('y2', String(to.y));

    const avgSpeed = (speeds[i] + speeds[i + 1]) / 2;
    line.setAttribute('stroke', speedToColor(avgSpeed, low, high));
    line.setAttribute('stroke-width', '4');
    line.setAttribute('stroke-linecap', 'round');
    group.appendChild(line);
  }

  svg.appendChild(group);
}

/**
 * Draws the start/finish marker at the first telemetry point.
 * @param {SVGSVGElement} svg
 * @param {Object} startPoint
 * @param {{project:(x:number,y:number)=>{x:number,y:number}}} projector
 */
function drawStartFinish(svg, startPoint, projector) {
  const { x, y } = projector.project(startPoint.x, startPoint.y);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('class', 'start-finish-marker');
  circle.setAttribute('cx', String(x));
  circle.setAttribute('cy', String(y));
  circle.setAttribute('r', '6');
  circle.setAttribute('fill', 'white');
  circle.setAttribute('stroke', 'black');
  circle.setAttribute('stroke-width', '2');

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = 'Start/Finish Line';
  circle.appendChild(title);

  svg.appendChild(circle);
}

/**
 * Builds the speed gradient legend.
 * @returns {HTMLElement}
 */
function createLegend() {
  const legend = document.createElement('div');
  legend.className = 'map-legend';

  const slow = document.createElement('span');
  slow.className = 'map-legend-label';
  slow.textContent = 'Slow';

  const bar = document.createElement('div');
  bar.className = 'map-legend-bar';

  const fast = document.createElement('span');
  fast.className = 'map-legend-label';
  fast.textContent = 'Fast';

  legend.append(slow, bar, fast);
  return legend;
}

/**
 * Renders a track map, speed gradient, and ghost replay into a container.
 *
 * Existing content in the container is left untouched so the map can live
 * alongside the leaderboard and charts.
 *
 * @param {HTMLElement} container - Target element.
 * @param {{points:Array<Object>,laps:Array<Array<Object>>}|null} mapData
 *   Processed telemetry from `processTelemetry`.
 * @returns {{destroy:()=>void}|null} A replay handle when replay is available.
 */
export function renderTrackMap(container, mapData) {
  if (!mapData || !mapData.points || mapData.points.length === 0) {
    renderEmpty(container, 'No track data available.');
    return null;
  }

  const { points, laps = [] } = mapData;
  const bounds = computeBounds(points);
  const projector = createProjector(bounds, VIEWPORT);

  const heading = document.createElement('h3');
  heading.textContent = `Track Map (${laps.length} laps detected)`;
  container.appendChild(heading);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${VIEWPORT.width} ${VIEWPORT.height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Track map coloured by speed');
  svg.classList.add('map-svg');

  drawRacingLine(svg, points, projector);
  drawStartFinish(svg, points[0], projector);

  const wrapper = document.createElement('div');
  wrapper.className = 'map-container';
  wrapper.appendChild(svg);

  let replay = null;
  if (laps.length >= 2) {
    replay = attachReplay({
      container: wrapper,
      svg,
      lapA: laps[0],
      lapB: laps[1],
      projector,
    });
  }

  wrapper.appendChild(createLegend());
  container.appendChild(wrapper);

  return replay;
}
