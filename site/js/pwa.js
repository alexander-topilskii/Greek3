(function () {
  const meta = document.getElementById('pwa-meta');
  const installSection = document.getElementById('pwa-install-section');
  const btnInstall = document.getElementById('btn-install-app');
  const installHint = document.getElementById('pwa-install-hint');
  let deferredPrompt = null;

  function isInstalled() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIosSafari() {
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    return isIOS && !window.MSStream;
  }

  function showInstallSection() {
    if (!installSection || isInstalled()) return;
    installSection.hidden = false;
  }

  function hideInstallSection() {
    if (installSection) installSection.hidden = true;
  }

  function updateInstallUi() {
    if (!installSection) return;

    if (isInstalled()) {
      hideInstallSection();
      return;
    }

    if (deferredPrompt) {
      showInstallSection();
      if (btnInstall) btnInstall.hidden = false;
      return;
    }

    if (isIosSafari()) {
      showInstallSection();
      if (btnInstall) btnInstall.hidden = true;
      if (installHint) {
        installHint.textContent =
          'В Safari нажмите «Поделиться» и выберите «На экран Домой», чтобы добавить Greek3.';
      }
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallUi();
  });

  btnInstall?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === 'accepted') hideInstallSection();
    else updateInstallUi();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallSection();
  });

  const swUrl = meta?.dataset.sw;
  const swScope = meta?.dataset.scope;
  if (swUrl && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swUrl, swScope ? { scope: swScope } : undefined).catch(() => {});
    });
  }

  updateInstallUi();
})();
