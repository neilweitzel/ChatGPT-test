/**
 * Telemetry file format detection.
 *
 * Pure helpers used by the upload UI to decide which parser to run.
 * Detection is header-driven: it only inspects the file extension and the
 * first non-empty line, so a lap CSV that happens to contain the substring
 * "lat" somewhere in its data (a track named "Atlanta", a driver named
 * "Latoya") is never mistaken for a GPS trace.
 */

/** @typedef {'gpx'|'gps-csv'|'lap-csv'|'unknown'} TelemetryFormat */

const LAT_HEADERS = ['lat', 'latitude'];
const LON_HEADERS = ['lon', 'lng', 'long', 'longitude'];
const TIME_HEADERS = ['time', 'timestamp', 'date'];
const LAP_HEADERS = ['lap', 'lap number', 'lap #'];
const LAP_TIME_HEADERS = ['time', 'lap time', 'total time', 'total'];

/**
 * Strips a UTF-8 BOM from the start of a string.
 * @param {string} text
 * @returns {string}
 */
function stripBOM(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Returns the first non-empty line of a text blob, normalized for line endings.
 * @param {string} text
 * @returns {string} The header line, or an empty string when none exists.
 */
export function firstNonEmptyLine(text) {
  if (!text) return '';
  const lines = stripBOM(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (line.trim()) return line;
  }
  return '';
}

/**
 * Splits a CSV header line into normalized (trimmed, lower-cased, unquoted)
 * column names.
 * @param {string} line - A single CSV header line.
 * @returns {Array<string>} Normalized header names.
 */
export function normalizeHeaders(line) {
  if (!line) return [];
  return line
    .split(',')
    .map((h) => h.trim().replace(/^"(.*)"$/, '$1').trim().toLowerCase())
    .filter((h) => h !== '');
}

/**
 * Reports whether a header list contains any of the candidate names.
 * @param {Array<string>} headers - Normalized header names.
 * @param {Array<string>} candidates - Accepted names.
 * @returns {boolean}
 */
function hasHeader(headers, candidates) {
  return headers.some((h) => candidates.includes(h));
}

/**
 * Detects the telemetry format of an uploaded file.
 *
 * @param {string} text - Raw file contents.
 * @param {string} [filename=''] - Original file name, used as a weak hint.
 * @returns {TelemetryFormat} The detected format.
 */
export function detectTelemetryFormat(text, filename = '') {
  const name = (filename || '').toLowerCase();
  const content = stripBOM(text || '');

  if (!content.trim()) return 'unknown';

  // GPX is XML, so the extension or the root element is authoritative.
  if (name.endsWith('.gpx') || /<gpx[\s>]/i.test(content)) return 'gpx';

  const headers = normalizeHeaders(firstNonEmptyLine(content));
  if (headers.length === 0) return 'unknown';

  const hasLat = hasHeader(headers, LAT_HEADERS);
  const hasLon = hasHeader(headers, LON_HEADERS);
  const hasTime = hasHeader(headers, TIME_HEADERS);

  if (hasLat && hasLon && hasTime) return 'gps-csv';

  if (hasHeader(headers, LAP_HEADERS) && hasHeader(headers, LAP_TIME_HEADERS)) {
    return 'lap-csv';
  }

  // A lat/lon pair without a usable time column is still a GPS trace attempt;
  // reporting it as such produces a clearer error than a lap-parse failure.
  if (hasLat && hasLon) return 'gps-csv';

  return 'unknown';
}
