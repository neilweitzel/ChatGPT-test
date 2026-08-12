/**
 * Upload wiring (DOM layer).
 *
 * Accepts telemetry files from the file picker or the dropzone, routes them to
 * the correct parser using header-based format detection, and renders results
 * into dedicated panels so the leaderboard, charts, and track map coexist.
 */

import { parseCSV } from '../lib/parser.js';
import { saveSessions, getSessions } from '../lib/db.js';
import { detectTelemetryFormat } from '../lib/detect.js';
import { parseGPX, parseGPSCSV, processTelemetry } from '../lib/map.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderTrackMap } from './map.js';

/** @type {{destroy:()=>void}|null} Active replay handle, torn down on re-render. */
let activeReplay = null;

/**
 * Resolves the panels the UI renders into.
 * @returns {{results:HTMLElement|null,map:HTMLElement|null,status:HTMLElement|null,errors:HTMLElement|null}}
 */
function panels() {
  return {
    results: document.getElementById('results'),
    map: document.getElementById('map-panel'),
    status: document.getElementById('upload-status'),
    errors: document.getElementById('parse-errors'),
  };
}

/**
 * Writes a short status line for the most recent upload.
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function setStatus(message, isError = false) {
  const { status } = panels();
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('status-error', isError);
}

/**
 * Reads a File as UTF-8 text.
 * @param {File} file
 * @returns {Promise<string>} The file contents.
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsText(file);
  });
}

/**
 * Renders GPS telemetry as a track map with speed gradient and ghost replay.
 * @param {string} text - Raw file contents.
 * @param {'gpx'|'gps-csv'} format - Detected GPS format.
 * @param {string} filename - Original file name, used in the status line.
 */
function renderGpsTelemetry(text, format, filename) {
  const { map } = panels();
  if (!map) return;

  const points = format === 'gpx' ? parseGPX(text) : parseGPSCSV(text);
  const mapData = processTelemetry(points);

  if (activeReplay) {
    activeReplay.destroy();
    activeReplay = null;
  }
  map.innerHTML = '';

  if (!mapData) {
    setStatus(`No usable GPS points found in ${filename}.`, true);
    renderTrackMap(map, null);
    return;
  }

  activeReplay = renderTrackMap(map, mapData);
  const lapCount = mapData.laps.length;
  setStatus(
    `Loaded ${points.length} GPS points from ${filename} — ${lapCount} lap${lapCount === 1 ? '' : 's'} detected.`
  );
}

/**
 * Parses a lap-time CSV, persists the sessions, and refreshes the leaderboard.
 * @param {string} text - Raw CSV contents.
 * @param {string} filename - Original file name, used in the status line.
 * @returns {Promise<void>}
 */
async function renderLapTelemetry(text, filename) {
  const { sessions, errors } = parseCSV(text);

  if (sessions.length > 0) {
    try {
      await saveSessions(sessions);
      await loadExistingSessions();
    } catch (err) {
      console.error('Failed to save sessions:', err);
      setStatus('Could not save sessions to local storage.', true);
      return;
    }
  }

  renderErrors(errors);

  if (sessions.length === 0 && errors.length > 0) {
    setStatus(`No valid laps found in ${filename}.`, true);
    return;
  }

  const lapCount = sessions.reduce((total, s) => total + s.laps.length, 0);
  const errorNote = errors.length > 0 ? ` ${errors.length} row(s) skipped.` : '';
  setStatus(`Loaded ${lapCount} laps from ${filename}.${errorNote}`);
}

/**
 * Reads a dropped or selected file, routes it to the matching parser, and
 * updates the UI.
 * @param {File} file - The file to handle.
 * @returns {Promise<void>}
 */
export async function handleFile(file) {
  if (!file) return;

  let text;
  try {
    text = await readFileAsText(file);
  } catch (err) {
    console.error('Failed to read file:', err);
    setStatus(`Could not read ${file.name}.`, true);
    return;
  }

  const format = detectTelemetryFormat(text, file.name);

  switch (format) {
    case 'gpx':
    case 'gps-csv':
      renderGpsTelemetry(text, format, file.name);
      return;
    case 'lap-csv':
      await renderLapTelemetry(text, file.name);
      return;
    default:
      setStatus(
        `Unrecognized file: ${file.name}. Upload a lap CSV (Driver, Lap, Time) or a GPS trace (.gpx, or CSV with Lat, Lon, Time).`,
        true
      );
  }
}

/**
 * Loads persisted sessions from IndexedDB and renders them.
 * @returns {Promise<void>}
 */
async function loadExistingSessions() {
  try {
    const sessions = await getSessions();
    renderSessions(sessions);
  } catch (err) {
    console.error('Failed to load sessions:', err);
    setStatus('Could not load saved sessions.', true);
  }
}

/**
 * Renders sessions into the results panel.
 * @param {Array<Object>} sessions - Session objects to render.
 */
function renderSessions(sessions) {
  const { results } = panels();
  if (!results) return;

  results.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Sessions';
  results.appendChild(heading);

  if (!sessions || sessions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No sessions found.';
    results.appendChild(empty);
    return;
  }

  for (const session of sessions) {
    renderLeaderboard(results, session);
  }
}

/**
 * Renders CSV row errors into the errors panel, clearing any previous list.
 * @param {Array<{row:number,message:string}>} errors - Row-level parse errors.
 */
function renderErrors(errors) {
  const { errors: panel } = panels();
  if (!panel) return;

  panel.innerHTML = '';
  if (!errors || errors.length === 0) {
    panel.hidden = true;
    return;
  }

  console.warn('CSV Parse errors:', errors);
  panel.hidden = false;

  const heading = document.createElement('h3');
  heading.textContent = 'Parse Errors';

  const list = document.createElement('ul');
  for (const err of errors) {
    const item = document.createElement('li');
    item.textContent = `Row ${err.row}: ${err.message}`;
    list.appendChild(item);
  }

  panel.append(heading, list);
}

/**
 * Binds dropzone and file picker events.
 */
function initUpload() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  loadExistingSessions();

  if (fileInput) {
    fileInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];
      if (file) handleFile(file);
      event.target.value = '';
    });
  }

  if (!dropzone) return;

  // The dropzone is exposed as a button, so it must also respond to pointer and
  // keyboard activation instead of being drag-only.
  if (fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) handleFile(files[0]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUpload);
} else {
  initUpload();
}
