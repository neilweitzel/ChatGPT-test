/**
 * Demo picker (DOM layer).
 *
 * Offers the bundled telemetry in `src/demo/` as dropdowns so a race can be
 * viewed, or a lap trace replayed, without finding a file first. Selected files
 * go through the same ingest path as an upload, so the demo cannot drift from
 * real behaviour.
 */

import { normalizeManifest, optionLabel, findEntry } from '../lib/demo-manifest.js';
import { ingestTelemetry } from './ingest.js';

const MANIFEST_URL = 'demo/manifest.json';
const DEMO_DIR = 'demo/';

/**
 * Fills a select element with manifest entries.
 * @param {HTMLSelectElement} select
 * @param {Array<import('../lib/demo-manifest.js').DemoEntry>} entries
 */
function populate(select, entries) {
  select.replaceChildren();
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.file;
    option.textContent = optionLabel(entry);
    select.appendChild(option);
  }
}

/**
 * Sets the status line for the demo section.
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function setDemoStatus(message, isError = false) {
  const status = document.getElementById('demo-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('status-error', isError);
}

/**
 * Fetches a demo file's text.
 * @param {string} file - File name within the demo directory.
 * @returns {Promise<string>}
 */
async function fetchDemoFile(file) {
  const response = await fetch(`${DEMO_DIR}${encodeURIComponent(file)}`);
  if (!response.ok) {
    throw new Error(`${file} could not be loaded (HTTP ${response.status})`);
  }
  return response.text();
}

/**
 * Loads one demo entry and renders it.
 *
 * @param {import('../lib/demo-manifest.js').DemoEntry} entry
 * @param {HTMLButtonElement} button - Button to disable while loading.
 * @param {{autoplay?: boolean}} [options]
 * @returns {Promise<void>}
 */
async function loadEntry(entry, button, { autoplay = false } = {}) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Loading…';
  setDemoStatus(`Loading ${entry.label}…`);

  try {
    const text = await fetchDemoFile(entry.file);
    const kind = await ingestTelemetry(text, entry.file);

    if (kind === 'unknown') {
      setDemoStatus(`${entry.label} could not be read.`, true);
      return;
    }

    const target = document.getElementById(kind === 'trace' ? 'map-panel' : 'results');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (kind === 'trace' && autoplay) {
      // Start playback through the real control, so the demo path and a manual
      // click behave identically.
      document.querySelector('.replay-play-btn')?.click();
    }

    setDemoStatus(`Showing ${entry.label}. ${entry.detail}`);
  } catch (err) {
    console.error('Failed to load demo file:', err);
    setDemoStatus(
      `Could not load ${entry.label}. Demo files need the app to be served over http, not opened as a file.`,
      true
    );
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

/**
 * Wires one dropdown and its button.
 *
 * @param {Object} options
 * @param {string} options.selectId
 * @param {string} options.buttonId
 * @param {Array<import('../lib/demo-manifest.js').DemoEntry>} options.entries
 * @param {boolean} [options.autoplay=false] - Start replay after loading.
 */
function wireControl({ selectId, buttonId, entries, autoplay = false }) {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById(selectId));
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById(buttonId));
  if (!select || !button) return;

  if (entries.length === 0) {
    select.disabled = true;
    button.disabled = true;
    return;
  }

  populate(select, entries);

  button.addEventListener('click', () => {
    const entry = findEntry(entries, select.value);
    if (entry) loadEntry(entry, button, { autoplay });
  });
}

/**
 * Loads the manifest and wires the demo section, hiding it when no demo data is
 * reachable (for example when the page is opened directly from disk).
 * @returns {Promise<void>}
 */
async function initDemo() {
  const section = document.querySelector('section.demo');
  if (!section) return;

  let manifest;
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = normalizeManifest(await response.json());
  } catch (err) {
    console.warn('Demo data unavailable:', err);
    section.hidden = true;
    return;
  }

  if (manifest.races.length === 0 && manifest.traces.length === 0) {
    section.hidden = true;
    return;
  }

  wireControl({
    selectId: 'demo-race',
    buttonId: 'demo-race-load',
    entries: manifest.races,
  });

  wireControl({
    selectId: 'demo-trace',
    buttonId: 'demo-trace-load',
    entries: manifest.traces,
    autoplay: true,
  });

  section.dataset.ready = 'true';
  setDemoStatus(
    `${manifest.races.length} race${manifest.races.length === 1 ? '' : 's'} and ` +
      `${manifest.traces.length} lap trace${manifest.traces.length === 1 ? '' : 's'} bundled.`
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDemo);
} else {
  initDemo();
}
