/**
 * Demo manifest handling.
 *
 * Pure helpers: validate the shape of `demo/manifest.json` and turn entries into
 * the strings the picker shows, so the UI layer only creates elements.
 */

/**
 * @typedef {Object} DemoEntry
 * @property {string} file - File name inside the demo directory.
 * @property {'race'|'trace'} kind
 * @property {string} label - Short name for the dropdown.
 * @property {string} detail - Supporting summary (drivers, laps, speeds).
 * @property {boolean} [replay] - Trace only: whether ghost replay is available.
 */

/**
 * Returns true when a manifest entry is usable by the picker.
 * @param {any} entry
 * @param {'race'|'trace'} kind
 * @returns {boolean}
 */
function isValidEntry(entry, kind) {
  return Boolean(
    entry &&
      typeof entry.file === 'string' &&
      entry.file.length > 0 &&
      // Reject anything that tries to escape the demo directory.
      !entry.file.includes('/') &&
      !entry.file.includes('\\') &&
      !entry.file.includes('..') &&
      typeof entry.label === 'string' &&
      entry.label.length > 0 &&
      (entry.kind === undefined || entry.kind === kind)
  );
}

/**
 * Normalizes a fetched manifest, dropping malformed entries.
 *
 * @param {any} json - Parsed manifest JSON.
 * @returns {{races: Array<DemoEntry>, traces: Array<DemoEntry>}} Usable entries.
 */
export function normalizeManifest(json) {
  const races = Array.isArray(json?.races) ? json.races : [];
  const traces = Array.isArray(json?.traces) ? json.traces : [];

  return {
    races: races
      .filter((e) => isValidEntry(e, 'race'))
      .map((e) => ({ ...e, kind: 'race', detail: e.detail || '' })),
    traces: traces
      .filter((e) => isValidEntry(e, 'trace'))
      .map((e) => ({ ...e, kind: 'trace', detail: e.detail || '', replay: e.replay !== false })),
  };
}

/**
 * Builds the text shown for one dropdown option.
 * @param {DemoEntry} entry
 * @returns {string}
 */
export function optionLabel(entry) {
  return entry.detail ? `${entry.label} (${entry.detail})` : entry.label;
}

/**
 * Finds an entry by file name.
 * @param {Array<DemoEntry>} entries
 * @param {string} file
 * @returns {DemoEntry|null}
 */
export function findEntry(entries, file) {
  return entries.find((entry) => entry.file === file) || null;
}
