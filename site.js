(() => {
  const dialog = document.getElementById('install-dialog');
  const copyButton = document.getElementById('copy-link');
  const nativeButton = document.getElementById('native-install');
  let installPrompt;

  document.getElementById('install-open').addEventListener('click', () => dialog.showModal());
  copyButton.addEventListener('click', async () => {
    const address = 'https://wikirng.org/';
    try {
      await navigator.clipboard.writeText(address);
      copyButton.textContent = 'Link copied';
    } catch {
      const url = document.getElementById('install-url');
      url.hidden = false;
      url.focus();
      url.select();
    }
  });
  dialog.addEventListener('close', () => {
    copyButton.textContent = 'Copy site link';
    document.getElementById('install-url').hidden = true;
  });

  if (location.protocol !== 'file:') {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installPrompt = event;
      nativeButton.hidden = false;
    });
    nativeButton.addEventListener('click', async () => {
      const prompt = installPrompt;
      if (!prompt) return;
      installPrompt = undefined;
      nativeButton.hidden = true;
      try {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === 'accepted') dialog.close();
      } catch {
        // The browser instructions are still available after a failed prompt.
      }
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = undefined;
      nativeButton.hidden = true;
    });
    if (location.pathname !== '/info.html' && window.isSecureContext && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  if (location.protocol === 'https:' && location.hostname === 'wikirng.org') {
    const analytics = document.createElement('script');
    analytics.defer = true;
    analytics.src = 'https://data.1back.link/js/app.js';
    analytics.dataset.api = 'https://data.1back.link/api/send';
    analytics.dataset.domain = 'wikirng.org';
    document.head.append(analytics);
  }
})();
