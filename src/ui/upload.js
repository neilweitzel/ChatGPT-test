import { parseCSV } from '../lib/parser.js';
import { saveSessions, getSessions } from '../lib/db.js';
import { renderLeaderboard } from './leaderboard.js';
import { parseGPX, parseGPSCSV, processTelemetry } from '../lib/map.js';
import { renderTrackMap } from './map.js';

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');

  loadExistingSessions();

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.backgroundColor = '#f0f0f0';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.backgroundColor = '';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.backgroundColor = '';

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });
  }
});

/**
 * Reads a dropped file (CSV or GPX), parses it, and updates the UI.
 * @param {File} file - The file object to handle.
 */
function handleFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;

    // Check if GPX or GPS CSV
    const isGPX = file.name.toLowerCase().endsWith('.gpx') || text.includes('<gpx');

    // We'll roughly check if it's a GPS CSV (has lat/lon) vs a Leaderboard CSV (has lap/time)
    const isGPSCSV = file.name.toLowerCase().endsWith('.csv') &&
                     (text.toLowerCase().includes('lat') || text.toLowerCase().includes('lon'));

    if (isGPX || isGPSCSV) {
      const points = isGPX ? parseGPX(text) : parseGPSCSV(text);
      const mapData = processTelemetry(points);

      const resultsDiv = document.getElementById('results');
      if (resultsDiv) {
        // Clear previous results or prepend
        resultsDiv.innerHTML = '';
        renderTrackMap(resultsDiv, mapData);
      }
      return;
    }

    // Default to Leaderboard CSV parsing
    const { sessions, errors } = parseCSV(text);

    if (sessions.length > 0) {
      try {
        await saveSessions(sessions);
        loadExistingSessions();
      } catch (err) {
        console.error('Failed to save sessions:', err);
      }
    }

    if (errors.length > 0) {
      console.warn('CSV Parse errors:', errors);
      renderErrors(errors);
    }
  };
  reader.readAsText(file);
}

/**
 * Loads existing sessions from the database and renders them to the UI.
 * @returns {Promise<void>} A promise that resolves when the sessions are loaded and rendered.
 */
async function loadExistingSessions() {
  try {
    const sessions = await getSessions();
    renderSessions(sessions);
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

/**
 * Renders an array of sessions by passing them to the leaderboard renderer.
 * @param {Array<Object>} sessions - The array of session objects to render.
 */
function renderSessions(sessions) {
  const resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;

  resultsDiv.innerHTML = '<h2>Sessions</h2>';
  if (sessions.length === 0) {
    resultsDiv.innerHTML += '<p>No sessions found.</p>';
    return;
  }

  sessions.forEach(session => {
    renderLeaderboard(resultsDiv, session);
  });
}

/**
 * Renders any CSV parsing errors directly to the UI.
 * @param {Array<Object>} errors - An array of error objects containing row and message info.
 */
function renderErrors(errors) {
  const resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;

  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.innerHTML = '<h3>Parse Errors</h3>';
  const ul = document.createElement('ul');
  errors.forEach(err => {
    const li = document.createElement('li');
    li.textContent = `Row ${err.row}: ${err.message}`;
    ul.appendChild(li);
  });
  errorDiv.appendChild(ul);
  resultsDiv.appendChild(errorDiv);
}
