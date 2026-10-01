(function () {
  const root = document.querySelector('[data-pronoun-cube]');
  if (!root) return;

  const dataEl = root.querySelector('[data-pronoun-data]');
  if (!dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent || '');
  } catch (err) {
    return;
  }

  const paradigms = data.paradigms || {};
  let currentParadigmId = data.currentParadigm || Object.keys(paradigms)[0] || 'personal';
  let currentVariantId = data.currentVariant || (paradigms[currentParadigmId]?.variants[0]?.id) || 'weak';
  let highlightForm = data.highlightForm || '';

  const cube = root.querySelector('.pronoun-cube');
  const scene = root.querySelector('.pronoun-cube-scene');
  const heading = root.querySelector('.pronoun-cube-heading');
  const titleEl = root.querySelector('.pronoun-cube-title');
  const subtitleEl = root.querySelector('.pronoun-cube-subtitle');
  const btnPrev = root.querySelector('[data-cube-dir="-1"]');
  const btnNext = root.querySelector('[data-cube-dir="1"]');
  const aspectWrap = root.querySelector('[data-pronoun-aspect]');
  const extraWrap = root.querySelector('.pronoun-extra');

  if (!cube || !scene || !heading || !titleEl || !subtitleEl) return;

  const escapeHtml = window.GreekUtils ? window.GreekUtils.escapeHtml : (text) => String(text);

  function indexFromCase(pCase) {
    if (pCase === 'nominative') return -1;
    if (pCase === 'genitive') return 1;
    return 0; // accusative
  }

  function caseFromIndex(index) {
    if (index === -1) return 'nominative';
    if (index === 1) return 'genitive';
    return 'accusative';
  }

  let currentFaceIndex = indexFromCase(data.currentCase || 'accusative');
  let titleTimer = 0;
  let ready = false;

  function rotationFor(index) {
    return index * -90;
  }

  function getActiveVariant() {
    const p = paradigms[currentParadigmId];
    if (!p || !p.variants) return null;
    return p.variants.find((v) => v.id === currentVariantId) || p.variants[0] || null;
  }

  function getActiveFace(pCase) {
    const v = getActiveVariant();
    if (!v || !v.faces) return null;
    const targetCase = pCase || caseFromIndex(currentFaceIndex);
    return v.faces[targetCase] || null;
  }

  function syncGeometry() {
    const width = scene.getBoundingClientRect().width;
    if (!width) return;
    const tz = `${Math.round(width / 2)}px`;
    const prev = cube.style.getPropertyValue('--pronoun-tz');
    if (prev !== tz) {
      cube.style.transition = 'none';
      cube.style.setProperty('--pronoun-tz', tz);
      scene.style.perspective = `${Math.max(800, Math.round(width * 2.4))}px`;
      void cube.offsetWidth;
      if (ready && !drag) cube.style.transition = '';
    }

    let max = 0;
    root.querySelectorAll('.pronoun-cube-grid').forEach((grid) => {
      max = Math.max(max, grid.scrollHeight);
    });
    if (max > 0) {
      const nextHeight = `${Math.ceil(max + 4)}px`;
      if (scene.style.height !== nextHeight) scene.style.height = nextHeight;
    }
  }

  function renderCellHtml(cell) {
    if (!cell) return '';
    const isEmpty = !cell.greek || cell.greek === '—';
    const isCurrent = Boolean(
      highlightForm &&
        cell.greek &&
        (cell.greek.toLowerCase() === highlightForm.toLowerCase() ||
          cell.greek.split('/').map((s) => s.trim().toLowerCase()).includes(highlightForm.toLowerCase()) ||
          cell.greek.split('(')[0]?.trim().toLowerCase() === highlightForm.toLowerCase())
    );

    const cleanSlug = cell.slug ? cell.slug.replace(/^words\//, '') : '';
    const linkHref = cleanSlug ? `words/${cleanSlug}.html` : '';

    return `
      <div class="pronoun-person${isCurrent ? ' is-current' : ''}${isEmpty ? ' is-empty' : ''}" data-greek="${escapeHtml(cell.greek)}"${cleanSlug ? ` data-slug="${escapeHtml(cleanSlug)}"` : ''}>
        <div class="pronoun-person-info">
          <span class="pronoun-person-label">${escapeHtml(cell.personLabel || '')}</span>
          ${cell.hint ? `<span class="pronoun-person-hint">${escapeHtml(cell.hint)}</span>` : ''}
        </div>
        <div class="pronoun-person-forms">
          <span class="pronoun-person-form greek">${escapeHtml(cell.greek || '')}</span>
          ${cell.ru ? `<span class="pronoun-person-ru">${escapeHtml(cell.ru)}</span>` : ''}
        </div>
        ${linkHref && !isCurrent ? `<a href="${escapeHtml(linkHref)}" class="pronoun-person-link" title="Перейти к «${escapeHtml(cell.greek)}»" aria-label="Перейти к ${escapeHtml(cell.greek)}">↗</a>` : ''}
      </div>`;
  }

  function updateFacesContent() {
    const v = getActiveVariant();
    if (!v) return;

    ['nominative', 'accusative', 'genitive'].forEach((pCase) => {
      const face = v.faces[pCase];
      const faceEl = root.querySelector(`.pronoun-cube-face--${pCase}`);
      if (!face || !faceEl) return;

      const gridEl = faceEl.querySelector('.pronoun-cube-grid');
      if (!gridEl) return;

      let html = `
        <div class="pronoun-col-label">${escapeHtml(face.colLeftTitle || '')}</div>
        <div class="pronoun-col-label">${escapeHtml(face.colRightTitle || '')}</div>`;

      (face.rows || []).forEach((row) => {
        html += renderCellHtml(row.left);
        html += renderCellHtml(row.right);
      });

      gridEl.innerHTML = html;
    });

    // Update extra notes
    if (extraWrap) {
      if (v.extraNotes) {
        const notes = v.extraNotes;
        let examplesHtml = '';
        (notes.examples || []).forEach((ex) => {
          examplesHtml += `
            <div class="pronoun-extra-example" data-greek="${escapeHtml(ex.greek)}">
              <span class="pronoun-extra-greek greek">${escapeHtml(ex.greek)}</span>
              <span class="pronoun-extra-ru">${escapeHtml(ex.ru)}</span>
            </div>`;
        });
        extraWrap.innerHTML = `
          <div class="pronoun-extra-card">
            <h3 class="pronoun-extra-title">${escapeHtml(notes.title || '')}</h3>
            ${notes.description ? `<p class="pronoun-extra-desc">${escapeHtml(notes.description)}</p>` : ''}
            ${examplesHtml ? `<div class="pronoun-extra-examples">${examplesHtml}</div>` : ''}
          </div>`;
      } else {
        extraWrap.innerHTML = '';
      }
    }

    syncGeometry();
  }

  function updateTitle(animate) {
    const face = getActiveFace();
    if (!face) return;
    const apply = () => {
      titleEl.textContent = face.title;
      subtitleEl.textContent = face.subtitle;
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

    const activeCase = caseFromIndex(index);
    root.querySelectorAll('.pronoun-cube-dot').forEach((dot) => {
      dot.classList.toggle('is-active', dot.getAttribute('data-dot') === activeCase);
    });
    root.querySelectorAll('.pronoun-cube-face').forEach((face) => {
      face.setAttribute('aria-hidden', face.getAttribute('data-case') === activeCase ? 'false' : 'true');
    });
  }

  function applyRotation(degrees, animate) {
    if (animate) {
      cube.style.transition = '';
      void cube.offsetWidth;
    } else {
      cube.style.transition = 'none';
    }
    cube.style.transform = `translateZ(calc(var(--pronoun-tz) * -1)) rotateY(${degrees}deg)`;
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

  function setCase(pCase) {
    const next = indexFromCase(pCase);
    if (next === currentFaceIndex) return;
    currentFaceIndex = next;
    updateTitle(true);
    updateChrome();
  }

  function setVariant(variantId) {
    const p = paradigms[currentParadigmId];
    if (!p) return;
    const vIndex = (p.variants || []).findIndex((v) => v.id === variantId);
    if (vIndex < 0 || variantId === currentVariantId) return;

    currentVariantId = variantId;
    root.setAttribute('data-variant', variantId);

    if (aspectWrap) {
      aspectWrap.style.setProperty('--i', String(vIndex));
      aspectWrap.querySelectorAll('.pronoun-aspect-btn').forEach((btn) => {
        const active = btn.getAttribute('data-variant') === variantId;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    updateFacesContent();
    updateTitle(true);
  }

  function rebuildVariantSwitcher(paradigm) {
    if (!aspectWrap) return;
    const variants = paradigm.variants || [];
    if (variants.length <= 1) {
      aspectWrap.style.display = 'none';
      return;
    }
    aspectWrap.style.display = '';
    aspectWrap.style.setProperty('--n', String(variants.length));
    const activeIndex = Math.max(0, variants.findIndex((v) => v.id === currentVariantId));
    aspectWrap.style.setProperty('--i', String(activeIndex));

    let html = '<div class="pronoun-aspect-slider" aria-hidden="true"></div>';
    variants.forEach((v) => {
      const active = v.id === currentVariantId;
      html += `<button type="button" class="pronoun-aspect-btn${active ? ' is-active' : ''}" data-variant="${v.id}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(v.label)}</button>`;
    });
    aspectWrap.innerHTML = html;

    aspectWrap.querySelectorAll('.pronoun-aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant')));
    });
  }

  function setParadigm(paradigmId) {
    if (paradigmId === currentParadigmId || !paradigms[paradigmId]) return;
    currentParadigmId = paradigmId;
    root.setAttribute('data-paradigm', paradigmId);

    root.querySelectorAll('.pronoun-tab').forEach((tab) => {
      const active = tab.getAttribute('data-paradigm') === paradigmId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const p = paradigms[paradigmId];
    currentVariantId = p.defaultVariant || p.variants[0]?.id || 'singular';
    if (p.defaultCase) {
      currentFaceIndex = indexFromCase(p.defaultCase);
    }

    rebuildVariantSwitcher(p);
    updateFacesContent();
    updateTitle(true);
    updateChrome();
  }

  // Bind variant switcher buttons
  if (aspectWrap) {
    aspectWrap.querySelectorAll('.pronoun-aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant')));
    });
  }

  // Bind hub paradigm tabs
  root.querySelectorAll('.pronoun-tab').forEach((tab) => {
    tab.addEventListener('click', () => setParadigm(tab.getAttribute('data-paradigm')));
  });

  // Bind dots
  root.querySelectorAll('.pronoun-cube-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const pCase = dot.getAttribute('data-dot');
      if (pCase) setCase(pCase);
    });
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

  // Touch and pointer gestures
  let drag = null;
  let blockSpeak = false;

  function greekToSpeak(node) {
    const item = node.closest('.pronoun-person, .pronoun-extra-example');
    if (!item || !root.contains(item)) return '';

    const face = item.closest('.pronoun-cube-face');
    if (face && face.getAttribute('aria-hidden') === 'true') return '';

    const text = item.getAttribute('data-greek') ||
      item.querySelector('.pronoun-person-form, .pronoun-extra-greek')?.textContent || '';

    const cleaned = text.split('/')[0]?.split('(')[0]?.trim() || '';
    return (cleaned || text).replace(/\s+/g, ' ').trim();
  }

  root.addEventListener('click', (event) => {
    if (blockSpeak) {
      blockSpeak = false;
      return;
    }
    if (event.target.closest('a, button')) return;

    const text = greekToSpeak(event.target);
    if (!text || text === '—') return;
    const speak = window.GreekSpeak;
    if (speak?.isSupported?.()) speak.speakGreek(text);
  });

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
    blockSpeak = state.active;
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
      blockSpeak = false;
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
          // pointer capture might fail if already released
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
