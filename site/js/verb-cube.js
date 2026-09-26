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

  function tenseKey() {
    if (currentFaceIndex === -1) return 'past';
    if (currentFaceIndex === 1) return 'future';
    return 'present';
  }

  function formatVerb(text, aspect) {
    const value = String(text || '').trim();
    if (!value) return '<span class="verb-person-empty">—</span>';
    if (aspect === 'perfect') {
      const bits = value.split(/\s+/);
      if (bits.length >= 2) {
        const tail = bits.pop();
        const head = bits.join(' ');
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
      if (ready) cube.style.transition = '';
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

  function updateChrome() {
    const rotationY = currentFaceIndex * -90;
    cube.style.transform = `translateZ(calc(var(--verb-tz) * -1)) rotateY(${rotationY}deg)`;

    if (btnPrev) btnPrev.disabled = currentFaceIndex === -1;
    if (btnNext) btnNext.disabled = currentFaceIndex === 1;

    const active = tenseKey();
    root.querySelectorAll('.verb-cube-dot').forEach((dot) => {
      dot.classList.toggle('is-active', dot.getAttribute('data-dot') === active);
    });
    root.querySelectorAll('.verb-cube-face').forEach((face) => {
      face.setAttribute('aria-hidden', face.getAttribute('data-tense') === active ? 'false' : 'true');
    });
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

  let startX = 0;
  let tracking = false;
  scene.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    tracking = true;
    startX = event.clientX;
    if (scene.setPointerCapture) scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointerup', (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    if (dx <= -40) rotateCube(1);
    else if (dx >= 40) rotateCube(-1);
  });
  scene.addEventListener('pointercancel', () => {
    tracking = false;
  });

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
