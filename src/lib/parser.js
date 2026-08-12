/**
 * Parses a string representing time into milliseconds.
 * Handles formats like 'MM:SS.ms' or 'SS.ms'.
 * @param {string} timeStr - The time string to parse.
 * @returns {number|null} The time in milliseconds, or null if parsing fails.
 */
export function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  let seconds = 0;

  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  } else if (parts.length === 1) {
    seconds = parseFloat(parts[0]);
    if (isNaN(seconds)) return null;
    return Math.round(seconds * 1000);
  }

  return null;
}

const SECTOR_1_HEADERS = ['sector 1', 'sector1', 's1', 'sec 1', 'sec1'];
const SECTOR_2_HEADERS = ['sector 2', 'sector2', 's2', 'sec 2', 'sec2'];
const SECTOR_3_HEADERS = ['sector 3', 'sector3', 's3', 'sec 3', 'sec3'];

/**
 * Parses raw CSV text into a structured list of sessions and errors.
 * Normalizes headers, handles line endings (CRLF), and groups laps by session.
 * @param {string} text - The raw CSV text to parse.
 * @returns {{ sessions: Array<Object>, errors: Array<Object> }} An object containing the parsed sessions array and any parsing errors encountered.
 */
export function parseCSV(text) {
  const sessions = new Map();
  const errors = [];

  if (!text) {
    return { sessions: [], errors };
  }

  // Handle BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Handle CRLF and split lines
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  if (lines.length === 0) {
    return { sessions: [], errors };
  }

  // Parse headers
  let headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase());

  if (headers.length === 0 || headers.every(h => h === '')) {
     return { sessions: [], errors };
  }

  // Map header columns
  const colMap = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h === 'track') colMap.track = i;
    else if (h === 'date') colMap.date = i;
    else if (h === 'driver') colMap.driver = i;
    else if (h === 'lap') colMap.lap = i;
    else if (h === 'time' || h === 'total time' || h === 'total') colMap.time = i;
    else if (SECTOR_1_HEADERS.includes(h)) colMap.s1 = i;
    else if (SECTOR_2_HEADERS.includes(h)) colMap.s2 = i;
    else if (SECTOR_3_HEADERS.includes(h)) colMap.s3 = i;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip blank lines

    const row = parseCSVLine(line);
    if (row.length === 0 || row.every(c => !c.trim())) continue;

    try {
      const track = colMap.track !== undefined ? row[colMap.track]?.trim() : 'Unknown Track';
      const date = colMap.date !== undefined ? row[colMap.date]?.trim() : 'Unknown Date';
      const driver = colMap.driver !== undefined ? row[colMap.driver]?.trim() : 'Unknown Driver';

      const lapStr = colMap.lap !== undefined ? row[colMap.lap]?.trim() : null;
      const timeStr = colMap.time !== undefined ? row[colMap.time]?.trim() : null;

      if (!lapStr || !timeStr) {
        errors.push({ row: i + 1, message: 'Missing lap number or time' });
        continue;
      }

      const lap = parseInt(lapStr, 10);
      if (isNaN(lap)) {
        errors.push({ row: i + 1, message: `Invalid lap number: ${lapStr}` });
        continue;
      }

      const time = parseTime(timeStr);
      if (time === null) {
        errors.push({ row: i + 1, message: `Invalid time format: ${timeStr}` });
        continue;
      }

      // Sector slots are positional: a missing sector stays null so a present
      // sector never slides into an earlier slot (a lap with S1 and S3 but no
      // S2 used to report its S3 time as S2).
      const sectorCols = [colMap.s1, colMap.s2, colMap.s3];
      const lastPresent = sectorCols.reduce(
        (last, col, idx) => (col !== undefined ? idx : last),
        -1
      );

      const sectors = [];
      for (let s = 0; s <= lastPresent; s++) {
        const col = sectorCols[s];
        sectors.push(col !== undefined ? parseTime(row[col]) : null);
      }

      const sessionId = `${track}-${date}`;

      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          id: sessionId,
          track: track,
          date: date,
          drivers: new Set(),
          laps: []
        });
      }

      const session = sessions.get(sessionId);
      if (driver) {
         session.drivers.add(driver);
      }

      session.laps.push({
        lap: lap,
        time: time,
        sectors: sectors,
        driver: driver
      });

    } catch (e) {
      errors.push({ row: i + 1, message: `Parse error: ${e.message}` });
    }
  }

  // Convert Set to Array for drivers in sessions
  const sessionsArray = Array.from(sessions.values()).map(s => ({
    ...s,
    drivers: Array.from(s.drivers)
  }));

  return { sessions: sessionsArray, errors };
}

/**
 * Parses a single line of CSV text, taking into account quoted fields containing commas.
 * @param {string} line - The single CSV line to parse.
 * @returns {Array<string>} An array of parsed string values for the line's columns.
 */
function parseCSVLine(line) {
  if (!line.includes('"')) {
    return line.split(',');
  }

  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
