/**
 * Upload wiring (DOM layer).
 *
 * Binds the dropzone and the file picker. All parsing and rendering lives in
 * ingest.js, which the demo picker shares.
 */

import { handleFile, loadExistingSessions } from './ingest.js';

/**
 * Binds dropzone and file picker events.
 */
function initUpload() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  loadExistingSessions();

  if (fileInput) {
    fileInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];
      if (file) handleFile(file);
      event.target.value = '';
    });
  }

  if (!dropzone) return;

  // The dropzone is exposed as a button, so it must also respond to pointer and
  // keyboard activation instead of being drag-only.
  if (fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) handleFile(files[0]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUpload);
} else {
  initUpload();
}
