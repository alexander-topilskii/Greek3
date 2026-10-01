(function () {
  const root = document.querySelector('[data-adverbs-cube]');
  if (!root) return;

  const dataEl = root.querySelector('[data-adverbs-data]');
  if (!dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent || '');
  } catch (err) {
    return;
  }

  const paradigms = data.paradigms || {};
  let currentParadigmId = data.currentParadigm || Object.keys(paradigms)[0] || 'place';
  let currentVariantId = data.currentVariant || (paradigms[currentParadigmId]?.variants[0]?.id) || 'coords';
  let highlightForm = data.highlightForm || '';

  const cube = root.querySelector('.adverbs-cube');
  const scene = root.querySelector('.adverbs-cube-scene');
  const heading = root.querySelector('.adverbs-cube-heading');
  const titleEl = root.querySelector('.adverbs-cube-title');
  const subtitleEl = root.querySelector('.adverbs-cube-subtitle');
  const btnPrev = root.querySelector('[data-cube-dir="-1"]');
  const btnNext = root.querySelector('[data-cube-dir="1"]');
  const aspectWrap = root.querySelector('[data-adverbs-aspect]');
  const extraWrap = root.querySelector('.adverbs-extra');

  if (!cube || !scene || !heading || !titleEl || !subtitleEl) return;

  const escapeHtml = window.GreekUtils ? window.GreekUtils.escapeHtml : (text) => String(text);

  function indexFromPos(pos) {
    if (pos === 'left') return -1;
    if (pos === 'right') return 1;
    return 0; // center
  }

  function posFromIndex(index) {
    if (index === -1) return 'left';
    if (index === 1) return 'right';
    return 'center';
  }

  let currentFaceIndex = indexFromPos(data.currentPos || 'left');
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

  function getActiveFace(pos) {
    const v = getActiveVariant();
    if (!v || !v.faces) return null;
    const targetPos = pos || posFromIndex(currentFaceIndex);
    return v.faces[targetPos] || null;
  }

  function syncGeometry() {
    const width = scene.getBoundingClientRect().width;
    if (!width) return;
    const tz = `${Math.round(width / 2)}px`;
    const prev = cube.style.getPropertyValue('--adverbs-tz');
    if (prev !== tz) {
      cube.style.transition = 'none';
      cube.style.setProperty('--adverbs-tz', tz);
      scene.style.perspective = `${Math.max(800, Math.round(width * 2.4))}px`;
      void cube.offsetWidth;
      if (ready && !drag) cube.style.transition = '';
    }

    let max = 0;
    root.querySelectorAll('.adverbs-cube-grid').forEach((grid) => {
      max = Math.max(max, grid.scrollHeight);
    });
    if (max > 0) {
      const nextHeight = `${Math.ceil(max + 6)}px`;
      if (scene.style.height !== nextHeight) scene.style.height = nextHeight;
    }
  }

  function renderCellHtml(cell) {
    if (!cell) return '';
    const isEmpty = !cell.greek || cell.greek === '—';
    const isCurrent = Boolean(
      highlightForm &&
        cell.greek &&
        (cell.greek.toLowerCase().includes(highlightForm.toLowerCase()) ||
          cell.label.toLowerCase().includes(highlightForm.toLowerCase()))
    );

    return `
      <div class="adverbs-item${isCurrent ? ' is-current' : ''}${isEmpty ? ' is-empty' : ''}" data-greek="${escapeHtml(cell.greek)}">
        <div class="adverbs-item-info">
          <span class="adverbs-item-label">${escapeHtml(cell.label)}</span>
          ${cell.hint ? `<span class="adverbs-item-hint">${escapeHtml(cell.hint)}</span>` : ''}
        </div>
        <div class="adverbs-item-forms">
          <span class="adverbs-item-greek greek">${escapeHtml(cell.greek)}</span>
          ${cell.ru ? `<span class="adverbs-item-ru">${escapeHtml(cell.ru)}</span>` : ''}
        </div>
      </div>`;
  }

  function updateFacesContent() {
    const v = getActiveVariant();
    if (!v || !v.faces) return;

    ['left', 'center', 'right'].forEach((pos) => {
      const face = v.faces[pos];
      const faceEl = root.querySelector(`.adverbs-cube-face--${pos}`);
      if (!face || !faceEl) return;

      const gridEl = faceEl.querySelector('.adverbs-cube-grid');
      if (!gridEl) return;

      let html = `
        <div class="adverbs-col-label">${escapeHtml(face.colLeftTitle || '')}</div>
        <div class="adverbs-col-label">${escapeHtml(face.colRightTitle || '')}</div>`;

      (face.rows || []).forEach((row) => {
        html += renderCellHtml(row.left);
        html += renderCellHtml(row.right);
      });

      gridEl.innerHTML = html;
    });

    if (extraWrap) {
      if (v.extraNotes) {
        const notes = v.extraNotes;
        let examplesHtml = '';
        (notes.examples || []).forEach((ex) => {
          examplesHtml += `
            <div class="adverbs-extra-example" data-greek="${escapeHtml(ex.greek)}">
              <span class="adverbs-extra-greek greek">${escapeHtml(ex.greek)}</span>
              <span class="adverbs-extra-ru">${escapeHtml(ex.ru)}</span>
            </div>`;
        });
        extraWrap.innerHTML = `
          <div class="adverbs-extra-card">
            <h3 class="adverbs-extra-title">${escapeHtml(notes.title || '')}</h3>
            ${notes.description ? `<p class="adverbs-extra-desc">${escapeHtml(notes.description)}</p>` : ''}
            ${examplesHtml ? `<div class="adverbs-extra-examples">${examplesHtml}</div>` : ''}
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
      clearTimeout(titleTimer);
      apply();
      return;
    }
    heading.classList.add('is-fading');
    clearTimeout(titleTimer);
    titleTimer = window.setTimeout(apply, 150);
  }

  function updateAria() {
    const activePos = posFromIndex(currentFaceIndex);
    root.querySelectorAll('.adverbs-cube-face').forEach((face) => {
      const match = face.getAttribute('data-pos') === activePos;
      face.setAttribute('aria-hidden', match ? 'false' : 'true');
    });
  }

  function updateDots() {
    const activePos = posFromIndex(currentFaceIndex);
    root.querySelectorAll('.adverbs-cube-dot').forEach((dot) => {
      const match = dot.getAttribute('data-dot') === activePos;
      dot.classList.toggle('is-active', match);
    });
  }

  function applyCubeRotation(deg, withTransition) {
    cube.style.transition = withTransition
      ? 'transform 0.45s cubic-bezier(0.2, 0.85, 0.32, 1.05)'
      : 'none';
    cube.style.transform = `translateZ(calc(var(--adverbs-tz, 150px) * -1)) rotateY(${deg}deg)`;
  }

  function updateChrome() {
    applyCubeRotation(rotationFor(currentFaceIndex), true);
    updateAria();
    updateDots();
    root.setAttribute('data-pos', posFromIndex(currentFaceIndex));
  }

  function rotateCube(dir) {
    let next = currentFaceIndex + dir;
    if (next < -1) next = -1;
    if (next > 1) next = 1;
    if (next === currentFaceIndex) return;
    currentFaceIndex = next;
    updateTitle(true);
    updateChrome();
  }

  function setPos(pos) {
    const next = indexFromPos(pos);
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
      aspectWrap.querySelectorAll('.adverbs-aspect-btn').forEach((btn) => {
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

    let html = '<div class="adverbs-aspect-slider" aria-hidden="true"></div>';
    variants.forEach((v) => {
      const active = v.id === currentVariantId;
      html += `<button type="button" class="adverbs-aspect-btn${active ? ' is-active' : ''}" data-variant="${v.id}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeHtml(v.label)}">${escapeHtml(v.label)}</button>`;
    });
    aspectWrap.innerHTML = html;

    aspectWrap.querySelectorAll('.adverbs-aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant')));
    });
  }

  function setParadigm(paradigmId) {
    if (paradigmId === currentParadigmId || !paradigms[paradigmId]) return;
    currentParadigmId = paradigmId;
    root.setAttribute('data-paradigm', paradigmId);

    root.querySelectorAll('.adverbs-tab').forEach((tab) => {
      const active = tab.getAttribute('data-paradigm') === paradigmId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const p = paradigms[paradigmId];
    currentVariantId = p.defaultVariant || p.variants[0]?.id || 'coords';
    if (p.defaultPosition) {
      currentFaceIndex = indexFromPos(p.defaultPosition);
    }

    rebuildVariantSwitcher(p);
    updateFacesContent();
    updateTitle(true);
    updateChrome();
  }

  if (aspectWrap) {
    aspectWrap.querySelectorAll('.adverbs-aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant')));
    });
  }

  root.querySelectorAll('.adverbs-tab').forEach((tab) => {
    tab.addEventListener('click', () => setParadigm(tab.getAttribute('data-paradigm')));
  });

  root.querySelectorAll('.adverbs-cube-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const pos = dot.getAttribute('data-dot');
      if (pos) setPos(pos);
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

  let drag = null;
  let blockSpeak = false;

  function greekToSpeak(node) {
    const item = node.closest('.adverbs-item, .adverbs-extra-example');
    if (!item || !root.contains(item)) return '';

    const face = item.closest('.adverbs-cube-face');
    if (face && face.getAttribute('aria-hidden') === 'true') return '';

    const text = item.getAttribute('data-greek') ||
      item.querySelector('.adverbs-item-greek, .adverbs-extra-greek')?.textContent || '';

    if (text.includes('…') || text === '—') return '';

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

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('button, a, input, select, textarea, [data-adverbs-aspect]')) return;

    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseRotation: rotationFor(currentFaceIndex),
      currentRotation: rotationFor(currentFaceIndex),
      moved: false,
    };
    try {
      scene.setPointerCapture(event.pointerId);
    } catch (err) {}
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        try {
          scene.releasePointerCapture(drag.id);
        } catch (err) {}
        drag = null;
        return;
      }
      drag.moved = true;
    }

    const sceneWidth = scene.getBoundingClientRect().width || 320;
    const deltaDeg = (dx / sceneWidth) * 90;
    const rawDeg = drag.baseRotation - deltaDeg;
    drag.currentRotation = rubberBand(rawDeg);
    applyCubeRotation(drag.currentRotation, false);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    try {
      scene.releasePointerCapture(drag.id);
    } catch (err) {}

    const dx = event.clientX - drag.startX;
    const moved = drag.moved;
    drag = null;

    if (moved) {
      blockSpeak = true;
      const threshold = 40;
      if (dx < -threshold && currentFaceIndex < 1) {
        rotateCube(1);
      } else if (dx > threshold && currentFaceIndex > -1) {
        rotateCube(-1);
      } else {
        updateChrome();
      }
    }
  }

  scene.addEventListener('pointerdown', onPointerDown);
  scene.addEventListener('pointermove', onPointerMove);
  scene.addEventListener('pointerup', onPointerUp);
  scene.addEventListener('pointercancel', onPointerUp);

  heading.addEventListener('pointerdown', onPointerDown);
  heading.addEventListener('pointermove', onPointerMove);
  heading.addEventListener('pointerup', onPointerUp);
  heading.addEventListener('pointercancel', onPointerUp);

  syncGeometry();
  updateChrome();
  ready = true;

  window.addEventListener('resize', syncGeometry);
  if (document.fonts?.ready) {
    document.fonts.ready.then(syncGeometry).catch(() => {});
  }
})();
