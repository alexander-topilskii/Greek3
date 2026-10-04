(function (global) {
  const ROOT = '__root__';
  const layers = [];
  let suppressPop = 0;
  let lockedScrollY = 0;

  function lockBodyScroll() {
    if (document.body.classList.contains('dialog-open')) return;
    lockedScrollY = window.scrollY;
    document.body.classList.add('dialog-open');
    document.body.style.top = `-${lockedScrollY}px`;
  }

  function unlockBodyScroll() {
    if (document.querySelector('dialog[open]')) return;
    document.body.classList.remove('dialog-open');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }

  function syncBodyScrollLock() {
    if (document.querySelector('dialog[open]')) lockBodyScroll();
    else unlockBodyScroll();
  }

  function isOpen(id) {
    return layers.some((layer) => layer.id === id);
  }

  function push(id, onClose) {
    if (!id || typeof onClose !== 'function') return () => {};
    if (isOpen(id)) return () => dismiss(id);

    layers.push({ id, onClose });
    try {
      history.pushState({ greek3Nav: id }, '');
    } catch {
      layers.pop();
    }

    return () => dismiss(id);
  }

  function dismiss(id, options = {}) {
    const fromPopstate = options.fromPopstate === true;
    const idx = id ? layers.findIndex((layer) => layer.id === id) : layers.length - 1;
    if (idx < 0 || idx !== layers.length - 1) return false;

    const layer = layers.pop();
    layer.onClose();

    if (!fromPopstate) {
      suppressPop += 1;
      history.back();
    }

    return true;
  }

  function onPopstate() {
    if (suppressPop > 0) {
      suppressPop -= 1;
      return;
    }
    if (!layers.length) return;
    dismiss(layers[layers.length - 1].id, { fromPopstate: true });
  }

  function bindDialog(dialog) {
    if (!dialog || dialog.dataset.navBackBound) return;
    dialog.dataset.navBackBound = '1';

    const id = `dialog:${dialog.id}`;
    const showModal = dialog.showModal.bind(dialog);

    dialog.showModal = function openWithNavBack() {
      if (!dialog.open && !isOpen(id)) {
        push(id, () => {
          if (dialog.open) dialog.close();
        });
      }
      const result = showModal();
      syncBodyScrollLock();
      return result;
    };

    dialog.addEventListener('close', () => {
      syncBodyScrollLock();
      if (isOpen(id)) dismiss(id);
    });
  }

  function bindDialogs(root = document) {
    root.querySelectorAll('dialog').forEach(bindDialog);
  }

  function hasSameOriginReferrer() {
    if (!document.referrer) return false;
    try {
      const refUrl = new URL(document.referrer, window.location.href);
      if (window.location.protocol === 'file:') {
        return refUrl.protocol === 'file:';
      }
      return refUrl.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function canNavigateBack() {
    return Boolean(history.state && history.state.canGoBack) || hasSameOriginReferrer();
  }

  function goBack(fallbackHref) {
    if (layers.length > 0) {
      dismiss(layers[layers.length - 1].id);
      return;
    }

    if (canNavigateBack() && window.history.length > 1) {
      window.history.back();
      return;
    }

    if (fallbackHref && fallbackHref !== '#') {
      try {
        window.location.replace(fallbackHref);
      } catch {
        window.location.href = fallbackHref;
      }
    } else {
      window.history.back();
    }
  }

  function handleCrumbBackClick(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    const fallbackHref = e.currentTarget.getAttribute('href');
    goBack(fallbackHref);
  }

  function bindCrumbBack(root = document) {
    root.querySelectorAll('.btn-crumb-back').forEach((btn) => {
      if (btn.dataset.navBackBound) return;
      btn.dataset.navBackBound = '1';
      btn.addEventListener('click', handleCrumbBackClick);
    });
  }

  function isStandalone() {
    return (
      Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      Boolean(window.navigator && window.navigator.standalone === true)
    );
  }

  function seedStandaloneGuard() {
    if (!isStandalone() || history.length > 1) return;
    history.pushState({ greek3Nav: '__guard__' }, '');
  }

  function init() {
    const internalReferrer = hasSameOriginReferrer();
    if (!history.state || history.state.greek3Nav === undefined) {
      history.replaceState({ greek3Nav: ROOT, canGoBack: internalReferrer }, '');
    }

    seedStandaloneGuard();
    bindDialogs();
    bindCrumbBack();
    window.addEventListener('popstate', onPopstate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GreekNavBack = {
    push,
    dismiss,
    isOpen,
    hasLayers: () => layers.length > 0,
    bindDialog,
    bindDialogs,
    bindCrumbBack,
    goBack,
    canNavigateBack,
  };
})(window);
