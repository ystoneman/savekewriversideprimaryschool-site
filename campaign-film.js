'use strict';
(() => {
  const section = document.getElementById('campaign-film');
  if (!section) return;
  let video;
  const template = document.getElementById('film-video-template');
  const fallback = document.getElementById('film-poster-link');
  const portraitFallback = document.getElementById('film-portrait-link');
  const player = section.querySelector('.film-player');
  const status = document.getElementById('film-status');
  const recovery = document.getElementById('film-recovery');
  const download = document.getElementById('film-download');
  const portraitDownload = document.getElementById('film-portrait-download');
  const narrow = window.matchMedia('(max-width:700px)');
  const formats = {
    landscape: {link:download, poster:fallback.querySelector('img').getAttribute('src'), width:1920, height:1080},
    portrait: {link:portraitDownload, poster:portraitFallback.querySelector('img').getAttribute('src'), width:1080, height:1350},
  };
  let retired = false;
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'film-poster';
  play.id = 'film-play';
  play.setAttribute('aria-label', 'Play the campaign video, narrated by Ram, 1 minute 26 seconds');
  play.append(...fallback.cloneNode(true).childNodes);
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.media = '(max-width:700px)';
  source.srcset = formats.portrait.poster;
  picture.append(source, play.querySelector('img'));
  play.prepend(picture);
  fallback.replaceWith(play);
  portraitFallback.remove();
  function refresh() {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    retired = today > '2027-01-13';
    if (retired) {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      player.hidden = true;
      recovery.hidden = true;
      status.textContent = 'This video’s published petition deadline, 13 January 2027, has passed. Read the current council information before acting.';
      status.hidden = false;
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
    delete player.dataset.format;
    recovery.hidden = false;
    status.textContent = 'Playback could not start. Try Play again, or open the video below.';
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
    recovery.hidden = true;
    play.hidden = true;
    video.hidden = false;
    if (!video.hasAttribute('src')) {
      const format = narrow.matches ? 'portrait' : 'landscape';
      const selected = formats[format];
      video.width = selected.width;
      video.height = selected.height;
      video.poster = selected.poster;
      player.dataset.format = format;
      video.src = selected.link.getAttribute('href');
    }
    video.focus();
    const attempt = video.play();
    if (attempt) attempt.catch(failed);
  });
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  // Check expiry before following a recovery link on a long-open page.
  for (const link of [download, portraitDownload]) link.addEventListener('click', event => {
    refresh();
    if (retired) event.preventDefault();
  });
})();
