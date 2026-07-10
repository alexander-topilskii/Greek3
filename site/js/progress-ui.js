(function () {
  const LABELED = 'progress-labeled';
  const FULLSCREEN_OPEN = 'progress-fullscreen-open';

  function isPoolProgress(el) {
    return el.id === 'practice-pool-progress' || el.classList.contains('practice-pool-progress');
  }

  function getPoolFullscreen() {
    return document.getElementById('practice-pool-fullscreen');
  }

  function openPoolFullscreen(trigger) {
    const overlay = getPoolFullscreen();
    if (!overlay) return false;

    overlay.removeAttribute('hidden');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add(FULLSCREEN_OPEN);

    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
    });

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    document.dispatchEvent(new CustomEvent('greek3:progress-fullscreen-open'));
    return true;
  }

  function closePoolFullscreen(trigger) {
    const overlay = getPoolFullscreen();
    if (!overlay || !overlay.classList.contains('is-open')) return;

    overlay.classList.remove('is-open');
    document.body.classList.remove(FULLSCREEN_OPEN);

    const finishClose = () => {
      overlay.hidden = true;
      overlay.setAttribute('hidden', '');
      overlay.setAttribute('aria-hidden', 'true');
    };

    const onEnd = (event) => {
      if (event.target !== overlay || event.propertyName !== 'transform') return;
      overlay.removeEventListener('transitionend', onEnd);
      finishClose();
    };
    overlay.addEventListener('transitionend', onEnd);
    window.setTimeout(finishClose, 400);

    const toggle = trigger ?? document.getElementById('practice-pool-progress');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  function initPoolFullscreenClose(trigger) {
    const overlay = getPoolFullscreen();
    if (!overlay || overlay.dataset.progressFullscreenInit) return;
    overlay.dataset.progressFullscreenInit = '1';

    const closeBtn = document.getElementById('practice-pool-fullscreen-close');
    closeBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      closePoolFullscreen(trigger);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !overlay.classList.contains('is-open')) return;
      event.preventDefault();
      closePoolFullscreen(trigger);
    });
  }

  function initToggle(el) {
    if (el.dataset.progressToggleInit) return;
    el.dataset.progressToggleInit = '1';

    if (isPoolProgress(el)) {
      initPoolFullscreenClose(el);
    }

    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (isPoolProgress(el)) {
        const overlay = getPoolFullscreen();
        if (overlay?.classList.contains('is-open')) {
          closePoolFullscreen(el);
        } else {
          openPoolFullscreen(el);
        }
        return;
      }

      const labeled = el.classList.toggle(LABELED);
      el.setAttribute('aria-expanded', labeled ? 'true' : 'false');
    });

    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      el.click();
    });
  }

  function initAll(root = document) {
    root.querySelectorAll('.progress-toggle').forEach(initToggle);
  }

  document.addEventListener('DOMContentLoaded', () => initAll());

  window.GreekProgressUI = {
    initAll,
    initToggle,
    openPoolFullscreen,
    closePoolFullscreen,
    isPoolFullscreenOpen() {
      return getPoolFullscreen()?.classList.contains('is-open') ?? false;
    },
  };
})();
