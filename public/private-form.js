'use strict';
// A previous letter or idea Send click in this tab is not evidence about this
// private submission. Keep any later on-site next-steps page neutral.
(() => {
  document.querySelectorAll('form[action="https://formspree.io/f/xnpnenzy"]').forEach(form => {
    form.addEventListener('submit', () => {
      try {
        sessionStorage.removeItem('kr-sent-kind');
        sessionStorage.removeItem('kr-sent-letter');
      } catch { /* storage unavailable */ }
    });
  });
})();
