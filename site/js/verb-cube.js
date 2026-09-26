(function () {
  const root = document.querySelector('[data-verb-cube]');
  if (!root) return;

  const dataEl = root.querySelector('[data-verb-paradigm]');
  if (!dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent || '');
  } catch (err) {
    return;
  }

  const aspects = data.aspects || [];
  const titles = data.titles || {};
  const conjugations = data.conjugations || {};
  const imperative = data.imperative || [];

  const cube = root.querySelector('.verb-cube');
  const scene = root.querySelector('.verb-cube-scene');
  const switcher = root.querySelector('[data-verb-aspect]');
  const heading = root.querySelector('.verb-cube-heading');
  const titleEl = root.querySelector('.verb-cube-title');
  const subtitleEl = root.querySelector('.verb-cube-subtitle');
  const btnPrev = root.querySelector('[data-cube-dir="-1"]');
  const btnNext = root.querySelector('[data-cube-dir="1"]');
  if (!cube || !scene || !heading || !titleEl || !subtitleEl) return;

  const escapeHtml = window.GreekUtils ? window.GreekUtils.escapeHtml : (text) => String(text);

  let currentFaceIndex = 0;
  let currentAspect = root.getAttribute('data-aspect') || aspects[0] || 'simple';
  let titleTimer = 0;
  let ready = false;

  function tenseFromIndex(index) {
    if (index === -1) return 'past';
    if (index === 1) return 'future';
    return 'present';
  }

  function tenseKey() {
    return tenseFromIndex(currentFaceIndex);
  }

  function rotationFor(index) {
    return index * -90;
  }

  function formatVerb(text, aspect) {
    const value = String(text || '').trim();
    if (!value) return '<span class="verb-person-empty">—</span>';
    if (aspect === 'perfect') {
      const bits = value.split(/\s+/);
      const aux = new Set(['έχω', 'έχουμε', 'έχεις', 'έχετε', 'έχει', 'έχουν', 'είχα', 'είχαμε', 'είχες', 'είχατε', 'είχε', 'είχαν']);
      let auxEnd = bits[0] === 'θα' ? 1 : 0;
      if (aux.has(bits[auxEnd]) && bits.length > auxEnd + 1) {
        const head = bits.slice(0, auxEnd + 1).join(' ');
        const tail = bits.slice(auxEnd + 1).join(' ');
        return `<span class="verb-aux">${escapeHtml(head)}</span><span class="verb-part">${escapeHtml(tail)}</span>`;
      }
    }
    return `<span class="verb-main">${escapeHtml(value)}</span>`;
  }

  function pickImperative(aspect) {
    return (
      imperative.find((item) => item.aspect === aspect) ||
      imperative.find((item) => item.aspect === 'default') ||
      (imperative.length === 1 ? imperative[0] : null)
    );
  }

  function syncGeometry() {
    const width = scene.getBoundingClientRect().width;
    if (!width) return;
    const tz = `${Math.round(width / 2)}px`;
    const prev = cube.style.getPropertyValue('--verb-tz');
    if (prev !== tz) {
      cube.style.transition = 'none';
      cube.style.setProperty('--verb-tz', tz);
      scene.style.perspective = `${Math.max(800, Math.round(width * 2.4))}px`;
      void cube.offsetWidth;
      if (ready && !drag) cube.style.transition = '';
    }

    let max = 0;
    root.querySelectorAll('.verb-cube-grid').forEach((grid) => {
      max = Math.max(max, grid.scrollHeight);
    });
    if (max > 0) {
      const nextHeight = `${Math.ceil(max + 2)}px`;
      if (scene.style.height !== nextHeight) scene.style.height = nextHeight;
    }
  }

  function updateFaces() {
    ['present', 'past', 'future'].forEach((tense) => {
      const forms = (conjugations[tense] && conjugations[tense][currentAspect]) || [];
      const face = root.querySelector(`.verb-cube-face[data-tense="${tense}"]`);
      if (!face) return;
      face.querySelectorAll('.verb-person-form').forEach((el, index) => {
        el.innerHTML = formatVerb(forms[index] || '', currentAspect);
      });
    });
    syncGeometry();
  }

  function updateImperative() {
    const sg = root.querySelector('[data-imp="sg"]');
    const pl = root.querySelector('[data-imp="pl"]');
    if (!sg || !pl) return;
    const item = pickImperative(currentAspect);
    sg.textContent = item && item.sg ? item.sg : '—';
    pl.textContent = item && item.pl ? item.pl : '—';
  }

  function updateTitle(animate) {
    const meta = (titles[tenseKey()] || {})[currentAspect];
    if (!meta) return;
    const apply = () => {
      titleEl.textContent = meta.title;
      subtitleEl.textContent = meta.subtitle;
      heading.classList.remove('is-fading');
    };
    if (!animate) {
      apply();
      return;
    }
    heading.classList.add('is-fading');
    window.clearTimeout(titleTimer);
    titleTimer = window.setTimeout(apply, 150);
  }

  function paintChrome(index) {
    if (btnPrev) btnPrev.disabled = index === -1;
    if (btnNext) btnNext.disabled = index === 1;

    const active = tenseFromIndex(index);
    root.querySelectorAll('.verb-cube-dot').forEach((dot) => {
      dot.classList.toggle('is-active', dot.getAttribute('data-dot') === active);
    });
    root.querySelectorAll('.verb-cube-face').forEach((face) => {
      face.setAttribute('aria-hidden', face.getAttribute('data-tense') === active ? 'false' : 'true');
    });
  }

  function applyRotation(degrees, animate) {
    if (animate) {
      cube.style.transition = '';
      void cube.offsetWidth;
    } else {
      cube.style.transition = 'none';
    }
    cube.style.transform = `translateZ(calc(var(--verb-tz) * -1)) rotateY(${degrees}deg)`;
  }

  function updateChrome() {
    applyRotation(rotationFor(currentFaceIndex), true);
    paintChrome(currentFaceIndex);
  }

  function rotateCube(direction) {
    let next = currentFaceIndex + direction;
    if (next < -1) next = -1;
    if (next > 1) next = 1;
    if (next === currentFaceIndex) return;
    currentFaceIndex = next;
    updateTitle(true);
    updateChrome();
  }

  function setAspect(aspect) {
    const index = aspects.indexOf(aspect);
    if (index < 0 || aspect === currentAspect) return;
    currentAspect = aspect;
    root.setAttribute('data-aspect', aspect);
    if (switcher) switcher.style.setProperty('--i', String(index));
    root.querySelectorAll('.verb-aspect-btn').forEach((btn) => {
      const active = btn.getAttribute('data-aspect') === aspect;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateFaces();
    updateImperative();
    updateTitle(true);
  }

  root.querySelectorAll('.verb-aspect-btn').forEach((btn) => {
    btn.addEventListener('click', () => setAspect(btn.getAttribute('data-aspect')));
  });

  if (btnPrev) btnPrev.addEventListener('click', () => rotateCube(-1));
  if (btnNext) btnNext.addEventListener('click', () => rotateCube(1));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      rotateCube(-1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      rotateCube(1);
      event.preventDefault();
    }
  });

  let drag = null;

  function rubberBand(degrees) {
    if (degrees > 90) return 90 + (degrees - 90) * 0.22;
    if (degrees < -90) return -90 + (degrees + 90) * 0.22;
    return degrees;
  }

  function followFinger(dx) {
    const width = scene.getBoundingClientRect().width || 1;
    const degrees = rubberBand(rotationFor(currentFaceIndex) + (dx / width) * 90);
    applyRotation(degrees, false);
    const nearest = Math.max(-1, Math.min(1, Math.round(-degrees / 90)));
    if (drag && nearest !== drag.shown) {
      drag.shown = nearest;
      const previous = currentFaceIndex;
      currentFaceIndex = nearest;
      updateTitle(false);
      currentFaceIndex = previous;
      paintChrome(nearest);
    }
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const state = drag;
    drag = null;
    const surface = state.surface;
    if (surface && surface.hasPointerCapture && surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }
    if (!state.active) return;

    const width = scene.getBoundingClientRect().width || 1;
    const dx = event.clientX - state.startX;
    const ratio = dx / width;
    let next = currentFaceIndex;
    if (ratio <= -0.22 || (state.vx < -0.45 && dx <= -16)) next = Math.min(1, currentFaceIndex + 1);
    else if (ratio >= 0.22 || (state.vx > 0.45 && dx >= 16)) next = Math.max(-1, currentFaceIndex - 1);

    if (next !== currentFaceIndex) {
      currentFaceIndex = next;
      updateTitle(true);
    }
    updateChrome();
  }

  function bindDrag(surface) {
    surface.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('button, a')) return;
      drag = {
        id: event.pointerId,
        surface,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastT: event.timeStamp,
        vx: 0,
        active: false,
        shown: currentFaceIndex,
      };
    });

    surface.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id || drag.surface !== surface) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          drag = null;
          return;
        }
        drag.active = true;
        try {
          if (surface.setPointerCapture) surface.setPointerCapture(event.pointerId);
        } catch (err) {
          // The pointer may already be gone; the drag still follows clientX.
        }
      }
      const dt = event.timeStamp - drag.lastT;
      if (dt > 0) drag.vx = (event.clientX - drag.lastX) / dt;
      drag.lastX = event.clientX;
      drag.lastT = event.timeStamp;
      followFinger(dx);
    });

    surface.addEventListener('pointerup', finishDrag);
    surface.addEventListener('pointercancel', finishDrag);
  }

  bindDrag(scene);
  bindDrag(heading);

  cube.style.transition = 'none';
  syncGeometry();
  updateChrome();
  void cube.offsetWidth;
  cube.style.transition = '';
  ready = true;

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => syncGeometry());
    observer.observe(scene);
  } else {
    window.addEventListener('resize', syncGeometry);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => syncGeometry());
  }
})();
