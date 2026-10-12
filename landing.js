// Landing page enhancements. Everything works without this script:
// links stay links, the share card falls back to an email draft.
(function () {
  'use strict';

  // Calendar dates are compared in UK local time so a visitor abroad sees the same state.
  function londonToday() {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var get = function (type) { return parts.find(function (p) { return p.type === type; }).value; };
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function daysBetween(from, to) {
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
  }

  // Countdown and open-day states depend on the UK date. They are refreshed on load,
  // when the tab becomes visible again and once a minute, so a page left open
  // overnight still rolls over at midnight.
  var countdown = document.querySelector('.days-left[data-deadline]');
  var dates = document.querySelectorAll('.date[data-date]');
  var shownFor = null;

  function refreshDates() {
    var today = londonToday();
    if (today === shownFor) return;
    shownFor = today;

    if (countdown) {
      var left = daysBetween(today, countdown.dataset.deadline);
      countdown.textContent = left === 0 ? 'Last day' : left === 1 ? '1 day left' : left + ' days left';
      countdown.hidden = left < 0;
    }

    var nextMarked = false;
    dates.forEach(function (item) {
      var past = item.dataset.date < today;
      var flag = item.querySelector('.date-flag');
      item.classList.toggle('is-past', past);
      if (flag) flag.hidden = !past;
      item.classList.toggle('is-next', !past && !nextMarked);
      if (!past) nextMarked = true;
    });
  }

  refreshDates();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshDates(); });
  setInterval(refreshDates, 60000);

  // Share card: native share sheet, then clipboard, then the mailto link.
  var share = document.querySelector('[data-share]');
  var status = document.querySelector('.share-status');
  if (share) {
    share.addEventListener('click', function (event) {
      var data = {
        title: 'Help save Kew Riverside Primary School',
        text: 'Richmond Council is consulting on a proposal to close Kew Riverside Primary School. Responses close 16 October 2026.',
        url: location.origin + location.pathname
      };
      if (navigator.share) {
        event.preventDefault();
        navigator.share(data).catch(function () {});
      } else if (navigator.clipboard && window.isSecureContext) {
        event.preventDefault();
        navigator.clipboard.writeText(data.url).then(function () {
          if (status) status.textContent = 'Link copied. Paste it into a message or post.';
        }, function () { location.href = share.href; });
      }
    });
  }

  // Close the mobile menu after choosing a section.
  var menu = document.querySelector('.nav-mobile');
  if (menu) {
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) menu.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }
})();
