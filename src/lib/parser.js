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
    else if (h === 'sector 1' || h === 's1') colMap.s1 = i;
    else if (h === 'sector 2' || h === 's2') colMap.s2 = i;
    else if (h === 'sector 3' || h === 's3') colMap.s3 = i;
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

      const sectors = [];
      if (colMap.s1 !== undefined) {
         const s1 = parseTime(row[colMap.s1]);
         if (s1 !== null) sectors.push(s1);
      }
      if (colMap.s2 !== undefined) {
         const s2 = parseTime(row[colMap.s2]);
         if (s2 !== null) sectors.push(s2);
      }
      if (colMap.s3 !== undefined) {
         const s3 = parseTime(row[colMap.s3]);
         if (s3 !== null) sectors.push(s3);
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

// Simple robust CSV line parser handling quotes
function parseCSVLine(line) {
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
