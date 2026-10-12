// Theme preference: System (default), Light or Dark.
// Loaded in <head> without defer so a saved choice applies before the first paint.
// Shares the main site's storage key and data-theme contract (theme.js), so a choice
// made here carries over to the rest of the website and back. No network requests.
(function () {
  'use strict';
  var key = 'kew-appearance-v1';
  var root = document.documentElement;
  var colours = { light: '#fbf7ee', dark: '#0f1d19' };
  var system = window.matchMedia('(prefers-color-scheme: dark)');
  var valid = function (value) { return value === 'light' || value === 'dark' ? value : 'system'; };
  var preference = 'system';
  try { preference = valid(localStorage.getItem(key)); } catch (e) { /* storage blocked: follow the system */ }

  function apply() {
    if (preference === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', preference);
    root.setAttribute('data-theme-pref', preference);

    var effective = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute('content', colours[effective]);
    });

    document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-theme-choice') === preference));
    });
    document.querySelectorAll('.theme-toggle').forEach(function (toggle) {
      toggle.setAttribute('aria-label', 'Theme: ' + preference.charAt(0).toUpperCase() + preference.slice(1));
    });
  }

  function choose(value) {
    preference = valid(value);
    try {
      if (preference === 'system') localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch (e) { /* the choice still applies to this page */ }
    apply();
  }

  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', function (event) {
    if (event.key === key || event.key === null) { preference = valid(event.newValue); apply(); }
  });
  window.addEventListener('pageshow', function () {
    try { preference = valid(localStorage.getItem(key)); } catch (e) { /* keep current */ }
    apply();
  });

  document.addEventListener('DOMContentLoaded', function () {
    // The controls stay hidden without JavaScript; the page then simply follows the system.
    document.querySelectorAll('.theme-picker, .theme-row').forEach(function (el) { el.hidden = false; });
    apply();

    var picker = document.querySelector('.theme-picker');
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-theme-choice]');
      if (button) {
        choose(button.getAttribute('data-theme-choice'));
        if (picker && picker.contains(button)) {
          picker.open = false;
          picker.querySelector('summary').focus();
        }
        return;
      }
      if (picker && picker.open && !picker.contains(event.target)) picker.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && picker && picker.open) {
        picker.open = false;
        picker.querySelector('summary').focus();
      }
    });
  });
})();
