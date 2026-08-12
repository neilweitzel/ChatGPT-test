/**
 * Ghost sync replay controls (DOM layer).
 *
 * All timing and geometry maths live in `src/lib/replay.js`; this module only
 * builds the controls, wires events, and moves the SVG markers.
 */

import { computeGhostState, formatDelta, lapDuration } from '../lib/replay.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4];

/**
 * Creates a marker circle for one kart in the replay.
 * @param {string} fill - Marker fill colour.
 * @param {string} className - CSS class applied to the marker.
 * @param {string} label - Accessible title for the marker.
 * @returns {SVGCircleElement}
 */
function createMarker(fill, className, label) {
  const marker = document.createElementNS(SVG_NS, 'circle');
  marker.setAttribute('r', '6');
  marker.setAttribute('fill', fill);
  marker.setAttribute('stroke', 'white');
  marker.setAttribute('stroke-width', '2');
  marker.setAttribute('class', className);

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = label;
  marker.appendChild(title);

  return marker;
}

/**
 * Builds the replay control bar.
 * @param {number} maxTime - Reference lap duration in milliseconds.
 * @returns {{root:HTMLElement,playBtn:HTMLButtonElement,rateSelect:HTMLSelectElement,
 *   scrubber:HTMLInputElement,readout:HTMLElement}} The controls and their parts.
 */
function createControls(maxTime) {
  const root = document.createElement('div');
  root.className = 'replay-controls';

  const playBtn = document.createElement('button');
  playBtn.className = 'replay-play-btn';
  playBtn.type = 'button';
  playBtn.textContent = 'Play';
  playBtn.setAttribute('aria-label', 'Play replay');

  const rateSelect = document.createElement('select');
  rateSelect.className = 'replay-speed-select';
  rateSelect.setAttribute('aria-label', 'Playback speed');
  for (const rate of PLAYBACK_RATES) {
    const opt = document.createElement('option');
    opt.value = String(rate);
    opt.textContent = `${rate}x`;
    if (rate === 1) opt.selected = true;
    rateSelect.appendChild(opt);
  }

  const scrubber = document.createElement('input');
  scrubber.type = 'range';
  scrubber.className = 'replay-scrubber';
  scrubber.min = '0';
  scrubber.max = String(maxTime);
  scrubber.step = '1';
  scrubber.value = '0';
  scrubber.setAttribute('aria-label', 'Replay position');

  const readout = document.createElement('div');
  readout.className = 'replay-delta';
  readout.setAttribute('role', 'status');
  readout.textContent = '+0.000s';

  root.append(playBtn, rateSelect, scrubber, readout);
  return { root, playBtn, rateSelect, scrubber, readout };
}

/**
 * Attaches distance-synchronized ghost replay to a rendered track map.
 *
 * @param {Object} options
 * @param {HTMLElement} options.container - Element the controls are prepended to.
 * @param {SVGSVGElement} options.svg - The rendered track map SVG.
 * @param {Array<Object>} options.lapA - Reference lap points.
 * @param {Array<Object>} options.lapB - Ghost lap points.
 * @param {{project:(x:number,y:number)=>{x:number,y:number}}} options.projector
 *   Projector used to place markers in SVG space.
 * @returns {{destroy:()=>void}|null} A handle that stops playback, or null when
 *   the laps cannot be replayed.
 */
export function attachReplay({ container, svg, lapA, lapB, projector }) {
  const maxTime = lapDuration(lapA);
  if (!maxTime || maxTime <= 0) return null;

  const controls = createControls(maxTime);
  container.insertBefore(controls.root, container.firstChild);

  const markerA = createMarker('blue', 'replay-marker-a', 'Reference lap');
  const markerB = createMarker('orange', 'replay-marker-b', 'Ghost lap');
  svg.append(markerA, markerB);

  let isPlaying = false;
  let playbackRate = 1;
  let elapsed = 0;
  let lastFrame = 0;
  let frameId = null;

  /**
   * Positions a marker at a world-space coordinate.
   * @param {SVGCircleElement} marker
   * @param {{x:number,y:number}} position
   */
  function place(marker, position) {
    const screen = projector.project(position.x, position.y);
    marker.setAttribute('cx', String(screen.x));
    marker.setAttribute('cy', String(screen.y));
  }

  /** Stops playback and resets the play button label. */
  function pause() {
    isPlaying = false;
    controls.playBtn.textContent = 'Play';
    controls.playBtn.setAttribute('aria-label', 'Play replay');
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  /** Renders the replay at the current elapsed time. */
  function render() {
    const state = computeGhostState(lapA, lapB, elapsed);
    if (!state) return;

    elapsed = state.elapsed;
    if (elapsed >= maxTime && isPlaying) pause();

    controls.scrubber.value = String(elapsed);
    place(markerA, state.a);
    place(markerB, state.b);

    controls.readout.textContent = formatDelta(state.deltaMs);
    const slower = state.deltaMs > 0;
    controls.readout.classList.toggle('positive-delta', slower);
    controls.readout.classList.toggle('negative-delta', !slower);
  }

  /**
   * Animation frame callback advancing the replay clock.
   * @param {number} timestamp
   */
  function loop(timestamp) {
    if (!isPlaying) return;
    if (!lastFrame) lastFrame = timestamp;
    elapsed += (timestamp - lastFrame) * playbackRate;
    lastFrame = timestamp;
    render();
    if (isPlaying) frameId = requestAnimationFrame(loop);
  }

  controls.playBtn.addEventListener('click', () => {
    if (isPlaying) {
      pause();
      return;
    }
    if (elapsed >= maxTime) elapsed = 0;
    isPlaying = true;
    controls.playBtn.textContent = 'Pause';
    controls.playBtn.setAttribute('aria-label', 'Pause replay');
    lastFrame = 0;
    frameId = requestAnimationFrame(loop);
  });

  controls.rateSelect.addEventListener('change', (event) => {
    playbackRate = parseFloat(event.target.value);
  });

  controls.scrubber.addEventListener('input', (event) => {
    pause();
    elapsed = parseFloat(event.target.value);
    render();
  });

  render();

  return { destroy: pause };
}
