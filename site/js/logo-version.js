(function () {
  const title = document.querySelector('.logo-title');
  const version = document.querySelector('.logo-version');
  if (!title || !version) return;

  const HOLD_MS = 500;
  let holdTimer = null;
  let suppressClick = false;

  function setVisible(visible) {
    version.hidden = !visible;
    version.toggleAttribute('aria-hidden', !visible);
    title.setAttribute('aria-pressed', String(visible));
  }

  function clearHold() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function startHold(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    clearHold();
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      setVisible(version.hidden);
      suppressClick = true;
    }, HOLD_MS);
  }

  title.addEventListener('pointerdown', startHold);
  title.addEventListener('pointerup', clearHold);
  title.addEventListener('pointerleave', clearHold);
  title.addEventListener('pointercancel', clearHold);

  title.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  });
})();
