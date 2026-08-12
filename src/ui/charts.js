import { formatTime } from '../lib/stats.js';

/**
 * Returns the single shared tooltip element, creating it on first use.
 * A shared element avoids leaking one detached tooltip per chart re-render.
 * @returns {HTMLElement}
 */
function getTooltip() {
  let tooltip = document.querySelector('.chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

/**
 * Main entry point for rendering charting components (lap trace and sector delta) into the given container.
 * Also handles driver selection controls for the sector delta comparison.
 * @param {HTMLElement} container - The DOM element where the charts section will be injected.
 * @param {Object} session - The parsed session data containing laps.
 * @param {Object} stats - The computed leaderboard stats for all drivers.
 */
export function renderCharts(container, session, stats) {
  if (!stats || stats.drivers.length === 0) return;

  const section = document.createElement('div');
  section.className = 'charts-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Charts';
  section.appendChild(heading);

  // Lap trace chart container
  const lapTraceContainer = document.createElement('div');
  lapTraceContainer.className = 'chart-wrapper';
  section.appendChild(lapTraceContainer);

  // Controls for Delta Chart
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'chart-controls';

  const lblA = document.createElement('label');
  lblA.textContent = 'Compare Driver A: ';
  const selA = document.createElement('select');

  const lblB = document.createElement('label');
  lblB.textContent = ' vs Driver B: ';
  const selB = document.createElement('select');

  stats.drivers.forEach(d => {
    const optA = document.createElement('option');
    optA.value = d.driver;
    optA.textContent = d.driver;
    selA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = d.driver;
    optB.textContent = d.driver;
    selB.appendChild(optB);
  });

  if (stats.drivers.length > 1) {
    selA.value = stats.drivers[0].driver;
    selB.value = stats.drivers[1].driver;
  } else {
    selA.value = stats.drivers[0].driver;
    selB.value = stats.drivers[0].driver;
  }

  controlsDiv.appendChild(lblA);
  controlsDiv.appendChild(selA);
  controlsDiv.appendChild(lblB);
  controlsDiv.appendChild(selB);
  section.appendChild(controlsDiv);

  // Sector delta chart container
  const deltaContainer = document.createElement('div');
  deltaContainer.className = 'chart-wrapper';
  section.appendChild(deltaContainer);

  // Qualitative palette chosen so every series stays visible on a white
  // background. Bright yellow was removed: it was effectively invisible both as
  // a line and as a legend label.
  const colors = [
    '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
    '#00838f', '#a65628', '#c2185b', '#5d4037'
  ];

  const updateCharts = () => {
    renderLapTraceChart(lapTraceContainer, session, stats, colors);
    renderSectorDeltaChart(deltaContainer, session, stats, selA.value, selB.value);
  };

  selA.addEventListener('change', updateCharts);
  selB.addEventListener('change', updateCharts);

  updateCharts();

  container.appendChild(section);
}

/**
 * Renders a scatter/line plot of lap times over the course of a session.
 * Visualizes consistency and flags statistical outliers.
 * @param {HTMLElement} container - The DOM element where the SVG lap trace will be injected.
 * @param {Object} session - The parsed session data containing laps.
 * @param {Object} stats - The computed leaderboard stats.
 * @param {Array<string>} colors - An array of hex color strings to assign to drivers.
 */
function renderLapTraceChart(container, session, stats, colors) {
  container.innerHTML = '<h4>Lap Trace</h4>';

  const width = 800;
  const height = 400;
  const margin = { top: 20, right: 120, bottom: 40, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Compute Max Laps and Min/Max Times
  let maxLaps = 0;
  let minTime = Infinity;
  let maxTime = -Infinity;
  const outlierThreshold = stats.overallBestLap * 1.3;

  const driverData = new Map();
  stats.drivers.forEach(d => driverData.set(d.driver, []));

  // Extract laps in order they happened per driver
  session.laps.forEach(lap => {
    const data = driverData.get(lap.driver);
    if (data) data.push(lap);
  });

  driverData.forEach((laps, driver) => {
    if (laps.length > maxLaps) maxLaps = laps.length;
    laps.forEach(lap => {
      if (lap.time <= outlierThreshold) {
        if (lap.time < minTime) minTime = lap.time;
        if (lap.time > maxTime) maxTime = lap.time;
      }
    });
  });

  if (maxLaps === 0) return;
  if (minTime === Infinity) { minTime = 0; maxTime = 60000; }

  // Pad Y axis
  const timeRange = maxTime - minTime;
  const yMin = Math.max(0, minTime - timeRange * 0.1);
  const yMax = maxTime + timeRange * 0.1;
  const actualYMax = yMax;

  // Scales
  const xScale = (lapIdx) => margin.left + (maxLaps > 1 ? (lapIdx / (maxLaps - 1)) * chartWidth : chartWidth / 2);
  const yScale = (time) => margin.top + chartHeight - ((time - yMin) / (actualYMax - yMin)) * chartHeight;

  // Create SVG element using string concatenation (Vanilla JS, no React/D3)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // A viewBox with no fixed pixel width lets the chart scale down on narrow
  // screens rather than forcing the page to scroll sideways.
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.classList.add('lap-trace-svg');

  // Axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', margin.left);
  xAxis.setAttribute('y1', margin.top + chartHeight);
  xAxis.setAttribute('x2', margin.left + chartWidth);
  xAxis.setAttribute('y2', margin.top + chartHeight);
  xAxis.classList.add('chart-axis');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', margin.left);
  yAxis.setAttribute('y1', margin.top);
  yAxis.setAttribute('x2', margin.left);
  yAxis.setAttribute('y2', margin.top + chartHeight);
  yAxis.classList.add('chart-axis');
  svg.appendChild(yAxis);

  // Draw Lines
  let driverIdx = 0;

  const tooltip = getTooltip();
  tooltip.classList.remove('visible');

  driverData.forEach((laps, driver) => {
    const color = colors[driverIdx % colors.length];
    driverIdx++;

    // Path for valid laps
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let dStr = '';

    laps.forEach((lap, idx) => {
      const isOutlier = lap.time > outlierThreshold;
      const cy = isOutlier ? margin.top : yScale(lap.time);
      const cx = xScale(idx);

      if (!isOutlier) {
        if (dStr === '') dStr += `M ${cx} ${cy}`;
        else dStr += ` L ${cx} ${cy}`;
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', isOutlier ? 3 : 4);
      circle.setAttribute('fill', color);
      if (isOutlier) {
         circle.setAttribute('opacity', 0.5);
      }

      // Tooltip content travels on the element; hover is handled by a single
      // delegated listener on the SVG rather than three listeners per point,
      // which kept thousands of closures alive on large sessions.
      circle.dataset.driver = driver;
      circle.dataset.lap = String(idx + 1);
      circle.dataset.time = formatTime(lap.time);
      if (isOutlier) circle.dataset.outlier = 'true';
      if (lap.sectors && lap.sectors.length > 0) {
         circle.dataset.sectors = lap.sectors.map(formatTime).join('|');
      }

      svg.appendChild(circle);
    });

    if (dStr) {
      path.setAttribute('d', dStr);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', 2);
      svg.insertBefore(path, svg.firstChild); // Put path behind circles
    }

    // Legend: a colour swatch plus a dark label, so the text stays readable
    // regardless of how light the series colour is.
    const legendY = margin.top + (driverIdx - 1) * 20;
    const legendX = margin.left + chartWidth + 10;

    const swatch = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    swatch.setAttribute('x', legendX);
    swatch.setAttribute('y', legendY - 4);
    swatch.setAttribute('width', '10');
    swatch.setAttribute('height', '10');
    swatch.setAttribute('rx', '2');
    swatch.setAttribute('fill', color);
    swatch.classList.add('chart-legend-swatch');
    svg.appendChild(swatch);

    const legendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    legendText.setAttribute('x', legendX + 15);
    legendText.setAttribute('y', legendY + 5);
    legendText.setAttribute('font-size', '12px');
    legendText.classList.add('chart-legend-label');
    legendText.textContent = driver;
    svg.appendChild(legendText);
  });

  // Y-axis labels
  const numYLabels = 5;
  for(let i=0; i<=numYLabels; i++) {
     const t = yMin + (actualYMax - yMin) * (i / numYLabels);
     const y = yScale(t);
     const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
     text.setAttribute('x', margin.left - 5);
     text.setAttribute('y', y + 4);
     text.setAttribute('text-anchor', 'end');
     text.setAttribute('font-size', '10px');
     text.textContent = formatTime(t);
     svg.appendChild(text);
  }

  // X-axis labels
  const numXLabels = Math.min(10, maxLaps);
  for(let i=0; i<numXLabels; i++) {
     const idx = Math.floor(i * (maxLaps - 1) / (numXLabels - 1)) || 0;
     const x = xScale(idx);
     const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
     text.setAttribute('x', x);
     text.setAttribute('y', margin.top + chartHeight + 15);
     text.setAttribute('text-anchor', 'middle');
     text.setAttribute('font-size', '10px');
     text.textContent = idx + 1;
     svg.appendChild(text);
  }

  attachLapTraceTooltip(svg, tooltip);

  container.appendChild(svg);
}

/**
 * Wires hover tooltips for the lap trace using event delegation.
 * @param {SVGSVGElement} svg - The lap trace SVG.
 * @param {HTMLElement} tooltip - The shared tooltip element.
 */
function attachLapTraceTooltip(svg, tooltip) {
  /**
   * Fills the tooltip from a point's data attributes.
   * @param {SVGCircleElement} circle
   */
  function fill(circle) {
    const { driver, lap, time, sectors, outlier } = circle.dataset;

    const strong = document.createElement('strong');
    strong.textContent = driver;
    tooltip.replaceChildren(strong);

    const lines = [`Lap: ${lap}`, `Time: ${time}${outlier ? ' (Outlier)' : ''}`];
    if (sectors) {
      sectors.split('|').forEach((value, idx) => lines.push(`S${idx + 1}: ${value}`));
    }

    for (const line of lines) {
      tooltip.appendChild(document.createElement('br'));
      tooltip.appendChild(document.createTextNode(line));
    }

    tooltip.classList.add('visible');
  }

  svg.addEventListener('mouseover', (event) => {
    const circle = event.target.closest('circle[data-driver]');
    if (circle) fill(circle);
  });

  svg.addEventListener('mousemove', (event) => {
    if (!tooltip.classList.contains('visible')) return;
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
  });

  svg.addEventListener('mouseout', (event) => {
    const to = event.relatedTarget;
    if (to && to.closest && to.closest('circle[data-driver]')) return;
    tooltip.classList.remove('visible');
  });
}

/**
 * Renders a bar chart comparing the best sectors between two specific drivers.
 * @param {HTMLElement} container - The DOM element where the SVG bar chart will be injected.
 * @param {Object} session - The parsed session data containing laps.
 * @param {Object} stats - The computed leaderboard stats.
 * @param {string} driverA - The name of the first driver to compare.
 * @param {string} driverB - The name of the second driver to compare against.
 */
function renderSectorDeltaChart(container, session, stats, driverA, driverB) {
  container.innerHTML = '';
  const h4 = document.createElement('h4');
  h4.textContent = `Sector Delta: ${driverA} vs ${driverB}`;
  container.appendChild(h4);

  if (driverA === driverB) {
    const p = document.createElement('p');
    p.textContent = 'Please select two different drivers.';
    container.appendChild(p);
    return;
  }

  // Find best lap for both drivers
  const statA = stats.drivers.find(d => d.driver === driverA);
  const statB = stats.drivers.find(d => d.driver === driverB);

  if (!statA || !statB) return;

  // We will compare bestSectors of driverA vs bestSectors of driverB
  // Or lap-by-lap sectors? The requirement says: "sector-delta bar chart comparing any two selected drivers"
  // Comparing their best sectors makes the most sense.

  const sectorsA = statA.bestSectors || [];
  const sectorsB = statB.bestSectors || [];

  const maxSectors = Math.max(sectorsA.length, sectorsB.length, 3);
  const deltas = [];

  for(let i=0; i<maxSectors; i++) {
     const valA = sectorsA[i];
     const valB = sectorsB[i];
     if (valA !== undefined && valB !== undefined) {
         deltas.push(valA - valB); // negative means A is faster
     } else {
         deltas.push(0);
     }
  }

  const width = 600;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  let maxDelta = Math.max(...deltas.map(Math.abs));
  if (maxDelta === 0) maxDelta = 1000; // default 1s if flat

  // Padding
  maxDelta = maxDelta * 1.2;

  const xScale = (idx) => margin.left + (idx + 0.5) * (chartWidth / maxSectors);
  const yScale = (delta) => margin.top + chartHeight / 2 - (delta / maxDelta) * (chartHeight / 2);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.classList.add('sector-delta-svg');

  // Center axis
  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', margin.left);
  axis.setAttribute('y1', margin.top + chartHeight / 2);
  axis.setAttribute('x2', margin.left + chartWidth);
  axis.setAttribute('y2', margin.top + chartHeight / 2);
  axis.classList.add('chart-axis');
  svg.appendChild(axis);

  const barWidth = Math.max(10, (chartWidth / maxSectors) * 0.5);

  deltas.forEach((delta, idx) => {
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const x = xScale(idx) - barWidth / 2;
      let y, h;
      if (delta > 0) {
          // B is faster (A is slower) -> positive bar
          y = yScale(delta);
          h = yScale(0) - yScale(delta);
          bar.setAttribute('fill', '#e41a1c'); // red for slower
      } else {
          // A is faster -> negative bar
          y = yScale(0);
          h = yScale(delta) - yScale(0);
          bar.setAttribute('fill', '#4daf4a'); // green for faster
      }

      bar.setAttribute('x', x);
      bar.setAttribute('y', y);
      bar.setAttribute('width', barWidth);
      bar.setAttribute('height', h);

      const tooltipTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      tooltipTitle.textContent = `Sector ${idx + 1}: ${driverA} is ${Math.abs(delta).toFixed(0)}ms ${delta > 0 ? 'slower' : 'faster'}`;
      bar.appendChild(tooltipTitle);

      svg.appendChild(bar);

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', xScale(idx));
      label.setAttribute('y', margin.top + chartHeight + 20);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12px');
      label.textContent = `S${idx + 1}`;
      svg.appendChild(label);
  });

  // Y-axis labels
  [-maxDelta, -maxDelta/2, 0, maxDelta/2, maxDelta].forEach(val => {
     const y = yScale(val);
     const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
     text.setAttribute('x', margin.left - 5);
     text.setAttribute('y', y + 4);
     text.setAttribute('text-anchor', 'end');
     text.setAttribute('font-size', '10px');
     text.textContent = (val > 0 ? '+' : '') + Math.round(val) + 'ms';
     svg.appendChild(text);
  });

  container.appendChild(svg);
}
