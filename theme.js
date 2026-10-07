/* Apply the local appearance preference before the first page paint.
 * No network requests, identifiers or analytics. CSS provides the no-JS fallback.
 */
(() => {
  'use strict';
  const key = 'kew-appearance-v1';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark'].includes(value) ? value : 'system';
  let preference = 'system', saved = true, select, status;
  try { preference = valid(localStorage.getItem(key)); } catch (_) { saved = false; }
  function apply() {
    if (preference === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = preference;
    if (select) select.value = preference;
    if (status) status.textContent = !saved ? 'This choice applies here, but could not be saved.' :
      preference === 'system' ? 'Follows your device setting.' : 'Remembered in this browser.';
  }
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('pageshow', event => {
    if (event.persisted && saved) {
      try { preference = valid(localStorage.getItem(key)); } catch (_) { saved = false; }
    }
    apply();
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = valid(event.newValue); saved = true; apply(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const controls = document.createElement('div');
    controls.className = 'wrap theme-controls';
    const label = document.createElement('label');
    label.htmlFor = 'appearance'; label.textContent = 'Appearance';
    select = document.createElement('select'); select.id = 'appearance';
    for (const [value, text] of [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    status = document.createElement('span'); status.id = 'appearance-status'; status.setAttribute('role', 'status');
    select.setAttribute('aria-describedby', status.id);
    select.addEventListener('change', () => {
      preference = valid(select.value);
      try {
        if (preference === 'system') localStorage.removeItem(key); else localStorage.setItem(key, preference);
        saved = true;
      } catch (_) { saved = false; }
      apply();
    });
    controls.append(label, select, status); footer.append(controls); apply();
  });
})();
