import { computeLeaderboard, formatTime } from '../lib/stats.js';
import { renderCharts } from './charts.js';

/**
 * Computes and renders a leaderboard table for a specific session into the given container.
 * Also delegates to the charts renderer.
 * @param {HTMLElement} container - The DOM element where the leaderboard will be injected.
 * @param {Object} session - The session object containing track and driver lap data.
 */
export function renderLeaderboard(container, session) {
  const stats = computeLeaderboard(session);
  if (!stats || stats.drivers.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No laps to display.';
    container.appendChild(p);
    return;
  }

  let currentSortConfig = {
    key: 'bestLap',
    direction: 'asc'
  };

  const table = document.createElement('table');
  table.className = 'leaderboard-table';

  const thead = document.createElement('thead');
  const tr = document.createElement('tr');

  const headers = [
    { text: 'Driver', key: 'driver' },
    { text: 'Best Lap', key: 'bestLap' },
    { text: 'Sector 1', key: 's1', getter: (d) => d.bestSectors[0] },
    { text: 'Sector 2', key: 's2', getter: (d) => d.bestSectors[1] },
    { text: 'Sector 3', key: 's3', getter: (d) => d.bestSectors[2] },
    { text: 'Theoretical Best', key: 'theoreticalBest' },
    { text: 'Average Lap', key: 'averageLap' },
    { text: 'Median Lap', key: 'medianLap' },
    { text: 'Consistency', key: 'consistency' }
  ];

  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h.text;
    th.tabIndex = 0; // keyboard accessible
    th.setAttribute('role', 'columnheader');

    // Sort logic
    const handleSort = () => {
      if (currentSortConfig.key === h.key) {
        currentSortConfig.direction = currentSortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortConfig.key = h.key;
        currentSortConfig.direction = 'asc';
      }
      renderTableBody();
      updateHeaders();
    };

    th.addEventListener('click', handleSort);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSort();
      }
    });

    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  function updateHeaders() {
    Array.from(tr.children).forEach((th, idx) => {
      const h = headers[idx];
      if (currentSortConfig.key === h.key) {
        th.setAttribute('aria-sort', currentSortConfig.direction === 'asc' ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });
  }

  function renderTableBody() {
    tbody.innerHTML = '';

    // Stable sorting logic with ties broken by driver name
    const sortedDrivers = [...stats.drivers].sort((a, b) => {
      const key = currentSortConfig.key;
      const header = headers.find(h => h.key === key);
      let valA = header && header.getter ? header.getter(a) : a[key];
      let valB = header && header.getter ? header.getter(b) : b[key];

      // Handle nulls/infinities (e.g. Theoretical best missing)
      if (valA === null || valA === Infinity) valA = Number.MAX_SAFE_INTEGER;
      if (valB === null || valB === Infinity) valB = Number.MAX_SAFE_INTEGER;

      if (valA < valB) return currentSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSortConfig.direction === 'asc' ? 1 : -1;

      // Tie breaker by driver name
      if (a.driver < b.driver) return -1;
      if (a.driver > b.driver) return 1;
      return 0;
    });

    sortedDrivers.forEach(d => {
      const row = document.createElement('tr');

      // Driver
      const tdDriver = document.createElement('td');
      tdDriver.textContent = d.driver;
      row.appendChild(tdDriver);

      // Best Lap
      const tdBest = document.createElement('td');
      tdBest.textContent = formatTime(d.bestLap);
      if (d.bestLap === stats.overallBestLap && stats.overallBestLap !== null) {
        tdBest.classList.add('overall-best');
      } else if (d.bestLap !== Infinity) {
        tdBest.classList.add('personal-best');
      }
      row.appendChild(tdBest);

      // Sectors
      for (let i = 0; i < 3; i++) {
        const tdSec = document.createElement('td');
        const s = d.bestSectors[i];
        tdSec.textContent = formatTime(s);
        if (s !== undefined && s === stats.overallBestSectors[i]) {
          tdSec.classList.add('overall-best');
        } else if (s !== undefined) {
          tdSec.classList.add('personal-best');
        }
        row.appendChild(tdSec);
      }

      // Theoretical Best
      const tdTheo = document.createElement('td');
      tdTheo.textContent = formatTime(d.theoreticalBest);
      row.appendChild(tdTheo);

      // Average Lap
      const tdAvg = document.createElement('td');
      tdAvg.textContent = formatTime(d.averageLap);
      row.appendChild(tdAvg);

      // Median Lap
      const tdMed = document.createElement('td');
      tdMed.textContent = formatTime(d.medianLap);
      row.appendChild(tdMed);

      // Consistency
      const tdCons = document.createElement('td');
      tdCons.textContent = formatTime(d.consistency);
      row.appendChild(tdCons);

      tbody.appendChild(row);
    });
  }

  renderTableBody();
  updateHeaders();

  const headerWrapper = document.createElement('h3');
  headerWrapper.textContent = `${session.track} - ${session.date}`;

  container.appendChild(headerWrapper);

  // The table has eight columns, so on a narrow screen it scrolls inside its own
  // wrapper instead of making the whole page scroll sideways.
  const scroller = document.createElement('div');
  scroller.className = 'table-scroll';
  scroller.appendChild(table);
  container.appendChild(scroller);

  renderCharts(container, session, stats);
}
