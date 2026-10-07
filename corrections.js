'use strict';
(() => {
  const supporter = new URLSearchParams(location.search).get('supporter');
  const message = document.getElementById('message');
  if (message && !message.value && supporter && /^supporter-[a-f0-9]{12}$/.test(supporter)) {
    message.value = 'Please review or remove supporter entry ' + supporter + '.\n\nMy request: ';
  }
})();
