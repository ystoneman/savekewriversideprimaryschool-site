'use strict';
(() => {
  const section = document.getElementById('campaign-film');
  if (!section) return;
  let video;
  const template = document.getElementById('film-video-template');
  const fallback = document.getElementById('film-poster-link');
  const player = section.querySelector('.film-player');
  const status = document.getElementById('film-status');
  const petition = document.getElementById('film-petition');
  const note = document.getElementById('film-petition-note');
  const download = document.getElementById('film-download');
  let retired = false;
  const play = document.createElement('button');
  play.type = 'button';
  play.className = fallback.className;
  play.id = 'film-play';
  play.setAttribute('aria-label', 'Play the campaign film, narrated by Ram, 1 minute 26 seconds');
  play.append(...fallback.cloneNode(true).childNodes);
  fallback.replaceWith(play);
  function refresh() {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    retired = today > '2027-01-13';
    petition.textContent = retired ? 'View the petition' : 'Sign the petition';
    if (retired) {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      player.hidden = true;
      download.hidden = true;
      status.textContent = 'This film’s published petition deadline, 13 January 2027, has passed. Read the current council information before acting.';
      status.hidden = false;
      note.textContent = 'The transcript records the film as made on 14 October 2026.';
    } else {
      note.textContent = 'Petition closes 13 January 2027. For people who live, work or study in Richmond borough; a Richmond Account is required.' + (today <= '2026-10-16' ? ' Signing does not replace your consultation response.' : '');
    }
  }
  function failed() {
    if (retired || !video || video.hidden) return;
    play.hidden = false;
    video.hidden = true;
    // A rejected source stays failed until explicitly reset. Retry must make a
    // fresh request, rather than calling play() again on that failed resource.
    video.removeAttribute('src');
    video.load();
    status.textContent = 'Playback could not start. Try Play again, or open the MP4 below.';
    status.hidden = false;
    play.focus();
  }
  play.addEventListener('click', () => {
    refresh();
    if (retired) return;
    if (!video) {
      video = template.content.firstElementChild.cloneNode(true);
      player.insertBefore(video, play);
      video.addEventListener('error', failed);
    }
    status.hidden = true;
    play.hidden = true;
    video.hidden = false;
    if (!video.hasAttribute('src')) video.src = download.getAttribute('href');
    video.focus();
    const attempt = video.play();
    if (attempt) attempt.catch(failed);
  });
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  // Check expiry before following a petition or direct-file link on a long-open page.
  for (const link of [petition, download]) link.addEventListener('click', event => {
    refresh();
    if (link === download && retired) event.preventDefault();
  });
})();
