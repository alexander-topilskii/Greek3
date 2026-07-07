(function () {
  const meta = document.getElementById('pwa-meta');
  const installSection = document.getElementById('pwa-install-section');
  const btnInstall = document.getElementById('btn-install-app');
  const installHint = document.getElementById('pwa-install-hint');
  const defaultHint =
    'Добавьте Greek3 на главный экран для быстрого доступа и офлайн-режима.';
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

  function isAndroid() {
    return /Android/i.test(window.navigator.userAgent);
  }

  function showInstallSection() {
    if (!installSection) return;
    installSection.hidden = false;
  }

  function hideInstallSection() {
    if (installSection) installSection.hidden = true;
  }

  function setInstallHint(text) {
    if (installHint) installHint.textContent = text;
  }

  function updateInstallUi() {
    if (!installSection) return;

    if (isInstalled()) {
      showInstallSection();
      if (btnInstall) btnInstall.hidden = true;
      setInstallHint(
        'Приложение установлено. Чтобы обновить иконку: удалите Greek3 с главного экрана, откройте сайт в Chrome и установите снова.',
      );
      return;
    }

    if (deferredPrompt) {
      showInstallSection();
      if (btnInstall) btnInstall.hidden = false;
      setInstallHint(defaultHint);
      return;
    }

    if (isIosSafari()) {
      showInstallSection();
      if (btnInstall) btnInstall.hidden = true;
      setInstallHint(
        'В Safari нажмите «Поделиться» и выберите «На экран Домой», чтобы добавить Greek3.',
      );
      return;
    }

    if (isAndroid()) {
      showInstallSection();
      if (btnInstall) btnInstall.hidden = true;
      setInstallHint(
        'В Chrome откройте меню (⋮) и выберите «Установить приложение» или «Добавить на главный экран».',
      );
      return;
    }

    showInstallSection();
    if (btnInstall) btnInstall.hidden = true;
    setInstallHint('В Chrome или Edge нажмите значок установки в адресной строке.');
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
    if (choice.outcome === 'accepted') updateInstallUi();
    else updateInstallUi();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateInstallUi();
  });

  const swUrl = meta?.dataset.sw;
  const swScope = meta?.dataset.scope;
  let swRefreshing = false;

  function reloadForSwUpdate() {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  }

  function watchServiceWorkerUpdates(registration) {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' && navigator.serviceWorker.controller) {
          reloadForSwUpdate();
        }
      });
    });
  }

  function registerServiceWorker() {
    if (!swUrl || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register(swUrl, swScope ? { scope: swScope } : undefined)
      .then((registration) => {
        watchServiceWorkerUpdates(registration);
        registration.update().catch(() => {});
      })
      .catch(() => {});
  }

  if (swUrl && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', reloadForSwUpdate);
    window.addEventListener('load', registerServiceWorker);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration(swScope).then((registration) => {
          registration?.update().catch(() => {});
        });
      }
    });
  }

  updateInstallUi();
})();
