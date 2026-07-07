(function () {
  const LABELED = 'progress-labeled';

  function initToggle(el) {
    if (el.dataset.progressToggleInit) return;
    el.dataset.progressToggleInit = '1';

    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
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

  window.GreekProgressUI = { initAll, initToggle };
})();
