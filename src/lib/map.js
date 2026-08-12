/**
 * Parses a GPX string and extracts track points.
 * @param {string} gpxStr - The GPX file content.
 * @returns {Array<Object>} Array of objects with lat, lon, and time.
 */
export function parseGPX(gpxStr) {
    const points = [];
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)">(?:[\s\S]*?)<time>([^<]+)<\/time>/gi;
    let match;
    while ((match = trkptRegex.exec(gpxStr)) !== null) {
        points.push({
            lat: parseFloat(match[1]),
            lon: parseFloat(match[2]),
            time: new Date(match[3]).getTime()
        });
    }
    return points;
}

/**
 * Parses CSV containing GPS data.
 * Expected headers: latitude, longitude, timestamp (or similar).
 * @param {string} csvStr
 * @returns {Array<Object>} Array of objects with lat, lon, and time.
 */
export function parseGPSCSV(csvStr) {
    const points = [];
    if (!csvStr) return points;

    if (csvStr.charCodeAt(0) === 0xFEFF) {
        csvStr = csvStr.slice(1);
    }
    const lines = csvStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return points;

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    let latIdx = headers.findIndex(h => h === 'lat' || h === 'latitude');
    let lonIdx = headers.findIndex(h => h === 'lon' || h === 'lng' || h === 'longitude');
    let timeIdx = headers.findIndex(h => h === 'time' || h === 'timestamp' || h === 'date');

    if (latIdx === -1 || lonIdx === -1 || timeIdx === -1) {
        return points; // Invalid CSV format for GPS
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());

        let timeVal = new Date(cols[timeIdx]).getTime();
        if (isNaN(timeVal)) {
            timeVal = parseFloat(cols[timeIdx]);
        }

        points.push({
            lat: parseFloat(cols[latIdx]),
            lon: parseFloat(cols[lonIdx]),
            time: timeVal
        });
    }

    return points;
}

/**
 * Smooths an array of projected points using a moving average window.
 * @param {Array<Object>} points
 * @param {number} windowSize
 * @returns {Array<Object>}
 */
function smoothPoints(points, windowSize = 3) {
    const smoothed = [];
    for (let i = 0; i < points.length; i++) {
        let sumX = 0, sumY = 0, count = 0;
        for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
            sumX += points[j].x;
            sumY += points[j].y;
            count++;
        }
        smoothed.push({
            ...points[i],
            x: sumX / count,
            y: sumY / count
        });
    }
    return smoothed;
}

/**
 * Projects points using equirectangular projection, smooths them, calculates speed,
 * and segments the track into laps based on crossings of the start/finish area.
 * @param {Array<Object>} points - Array of GPS points.
 * @returns {Object|null} Processed map data including points and laps, or null if invalid.
 */
export function processTelemetry(points) {
    if (!points || points.length < 2) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const pt of points) {
        if (pt.lat < minLat) minLat = pt.lat;
        if (pt.lat > maxLat) maxLat = pt.lat;
        if (pt.lon < minLon) minLon = pt.lon;
        if (pt.lon > maxLon) maxLon = pt.lon;
    }

    const latMid = (minLat + maxLat) / 2;
    const cosLatMid = Math.cos(latMid * Math.PI / 180);
    const R = 6371000;

    const projected = points.map(p => ({
        x: R * (p.lon - minLon) * Math.PI / 180 * cosLatMid,
        y: R * (p.lat - minLat) * Math.PI / 180,
        time: p.time,
        lat: p.lat,
        lon: p.lon
    }));

    const smoothed = smoothPoints(projected, 2);

    // Compute cumulative distance & speed
    let cumulativeDist = [0];
    smoothed[0].speed = 0;

    for (let i = 1; i < smoothed.length; i++) {
        const dx = smoothed[i].x - smoothed[i-1].x;
        const dy = smoothed[i].y - smoothed[i-1].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        cumulativeDist.push(cumulativeDist[i-1] + dist);

        const dt = (smoothed[i].time - smoothed[i-1].time) / 1000;
        smoothed[i].speed = dt > 0 ? dist / dt : smoothed[i-1].speed;
    }
    // Set first point speed
    smoothed[0].speed = smoothed.length > 1 ? smoothed[1].speed : 0;

    // Add cumulative distance to points
    for (let i = 0; i < smoothed.length; i++) {
        smoothed[i].dist = cumulativeDist[i];
    }

    // Lap segmentation
    // We assume the start/finish line is near the origin (first point) for simplicity,
    // or we can find the point that returns closest to the origin.
    const origin = smoothed[0];
    const crossings = [];
    let inZone = false;
    let zoneMinDist = Infinity;
    let zoneMinIdx = -1;
    let lastCrossingDist = -100;

    for (let i = 0; i < smoothed.length; i++) {
        const dx = smoothed[i].x - origin.x;
        const dy = smoothed[i].y - origin.y;
        const d = Math.sqrt(dx*dx + dy*dy);

        // 30 meter radius for S/F line crossing, minimum 50m traveled between crossings
        if (d < 30 && cumulativeDist[i] - lastCrossingDist > 50) {
            inZone = true;
            if (d < zoneMinDist) {
                zoneMinDist = d;
                zoneMinIdx = i;
            }
        } else if (inZone && d >= 30) {
            crossings.push(zoneMinIdx);
            lastCrossingDist = cumulativeDist[zoneMinIdx];
            inZone = false;
            zoneMinDist = Infinity;
            zoneMinIdx = -1;
        }
    }
    // If the session ends inside the S/F zone
    if (inZone && zoneMinIdx !== -1) {
        crossings.push(zoneMinIdx);
    }

    let laps = [];
    let startIdx = 0;
    for (const idx of crossings) {
        if (idx > startIdx) {
            laps.push(smoothed.slice(startIdx, idx + 1));
        }
        startIdx = idx;
    }
    // Add the final out-lap or partial lap if significant
    if (startIdx < smoothed.length - 1) {
        laps.push(smoothed.slice(startIdx));
    }

    // Post-process laps to ensure they start at dist=0 and t=0
    laps = laps.map(lap => {
        if (lap.length === 0) return lap;
        const startDist = lap[0].dist;
        const startTime = lap[0].time;
        return lap.map(pt => ({
            ...pt,
            dist: pt.dist - startDist,
            t: pt.time - startTime
        }));
    });

    return { points: smoothed, laps, crossings };
}

/**
 * Linearly interpolates a property in an array of points based on a key value.
 * @param {Array<Object>} points - The array of objects to search within.
 * @param {number} value - The input value to match against `inKey`.
 * @param {string} inKey - The key to search by (e.g., 'dist' or 't').
 * @param {string} outKey - The key whose value we want to interpolate (e.g., 't', 'x', 'y').
 * @returns {number} The interpolated value.
 */
export function interpolate(points, value, inKey, outKey) {
    if (!points || points.length === 0) return 0;
    if (points.length === 1) return points[0][outKey];

    if (value <= points[0][inKey]) return points[0][outKey];
    if (value >= points[points.length - 1][inKey]) return points[points.length - 1][outKey];

    let low = 0;
    let high = points.length - 1;

    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (points[mid][inKey] === value) {
            return points[mid][outKey];
        } else if (points[mid][inKey] < value) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    const p1 = points[high];
    const p2 = points[low];

    if (!p1 || !p2 || p1[inKey] === p2[inKey]) return p1 ? p1[outKey] : 0;

    const ratio = (value - p1[inKey]) / (p2[inKey] - p1[inKey]);
    return p1[outKey] + ratio * (p2[outKey] - p1[outKey]);
}
