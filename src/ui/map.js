/**
 * Converts a speed value (relative to min/max) into a color string.
 * Uses a continuous gradient from blue (slow) to green to red (fast).
 * @param {number} speed
 * @param {number} minSpeed
 * @param {number} maxSpeed
 * @returns {string} RGB color string
 */
function getSpeedColor(speed, minSpeed, maxSpeed) {
    if (maxSpeed === minSpeed) return 'rgb(0, 255, 0)';

    // Normalize speed to 0.0 - 1.0
    let t = (speed - minSpeed) / (maxSpeed - minSpeed);
    t = Math.max(0, Math.min(1, t));

    // Simple gradient: Blue -> Green -> Red
    let r = 0, g = 0, b = 0;

    if (t < 0.5) {
        // Blue to Green
        const factor = t * 2;
        r = 0;
        g = Math.round(255 * factor);
        b = Math.round(255 * (1 - factor));
    } else {
        // Green to Red
        const factor = (t - 0.5) * 2;
        r = Math.round(255 * factor);
        g = Math.round(255 * (1 - factor));
        b = 0;
    }

    return `rgb(${r},${g},${b})`;
}

/**
 * Renders the track map into the specified container.
 * @param {HTMLElement} container
 * @param {Object} mapData - Object containing points and laps arrays.
 */
export function renderTrackMap(container, mapData) {
    if (!mapData || !mapData.points || mapData.points.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No track data available.';
        container.appendChild(p);
        return;
    }

    const { points, laps } = mapData;

    const h3 = document.createElement('h3');
    h3.textContent = `Track Map (${laps.length} laps detected)`;
    container.appendChild(h3);

    // Calculate bounding box for SVG viewBox
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minSpeed = Infinity, maxSpeed = -Infinity;

    for (const pt of points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
        if (pt.speed < minSpeed) minSpeed = pt.speed;
        if (pt.speed > maxSpeed) maxSpeed = pt.speed;
    }

    // Target dimensions
    const width = 600;
    const height = 400;
    const padding = 20;

    const w = maxX - minX;
    const h = maxY - minY;

    // To prevent division by zero if w or h is 0
    const scale = (w > 0 && h > 0) ? Math.min((width - 2 * padding) / w, (height - 2 * padding) / h) : 1;

    const offsetX = (width - w * scale) / 2;
    const offsetY = (height - h * scale) / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('map-svg');

    // Filter outliers for speed gradient calculation (95th percentile)
    const sortedSpeeds = points.map(p => p.speed).sort((a, b) => a - b);
    const p5 = sortedSpeeds[Math.floor(sortedSpeeds.length * 0.05)];
    const p95 = sortedSpeeds[Math.floor(sortedSpeeds.length * 0.95)];

    // Draw the racing line using line segments to color by speed
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];

        const x1 = (p1.x - minX) * scale + offsetX;
        const y1 = height - ((p1.y - minY) * scale + offsetY); // Flip Y

        const x2 = (p2.x - minX) * scale + offsetX;
        const y2 = height - ((p2.y - minY) * scale + offsetY); // Flip Y

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);

        // Average speed between the two points for color
        const avgSpeed = (p1.speed + p2.speed) / 2;
        const color = getSpeedColor(avgSpeed, p5, p95);

        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
    }

    // Draw Start/Finish line marker (first point)
    if (points.length > 0) {
        const startPt = points[0];
        const sx = (startPt.x - minX) * scale + offsetX;
        const sy = height - ((startPt.y - minY) * scale + offsetY);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', sx);
        circle.setAttribute('cy', sy);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', 'white');
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '2');

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = 'Start/Finish Line';
        circle.appendChild(title);

        svg.appendChild(circle);
    }

    const containerDiv = document.createElement('div');
    containerDiv.className = 'map-container';
    containerDiv.appendChild(svg);

    // Add legend
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.style.display = 'flex';
    legend.style.alignItems = 'center';
    legend.style.justifyContent = 'center';
    legend.style.marginTop = '10px';
    legend.innerHTML = `
        <span style="margin-right: 10px; font-size: 12px;">Slow</span>
        <div style="width: 150px; height: 10px; background: linear-gradient(to right, blue, green, red); border-radius: 5px;"></div>
        <span style="margin-left: 10px; font-size: 12px;">Fast</span>
    `;
    containerDiv.appendChild(legend);

    container.appendChild(containerDiv);
}
