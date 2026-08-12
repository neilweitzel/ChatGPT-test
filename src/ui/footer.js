/**
 * Footer year (DOM layer).
 *
 * Keeps the copyright current instead of hardcoding a year that goes stale.
 * The markup ships with a sensible fallback in case scripts do not run.
 */

/**
 * Writes the current year into the footer.
 * @param {Date} [now=new Date()] - Injectable for testing.
 */
export function updateFooterYear(now = new Date()) {
  const target = document.getElementById('footer-year');
  if (target) target.textContent = String(now.getFullYear());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updateFooterYear());
} else {
  updateFooterYear();
}
