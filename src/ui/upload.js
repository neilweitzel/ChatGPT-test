import { parseCSV } from '../lib/parser.js';
import { saveSessions, getSessions } from '../lib/db.js';
import { renderLeaderboard } from './leaderboard.js';

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

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
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

async function loadExistingSessions() {
  try {
    const sessions = await getSessions();
    renderSessions(sessions);
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

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
