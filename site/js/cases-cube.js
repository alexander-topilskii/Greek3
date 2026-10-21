(function () {
  const root = document.querySelector('[data-cases-cube]');
  if (!root) return;

  const dataEl = root.querySelector('[data-cases-data]');
  if (!dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent || '');
  } catch (err) {
    return;
  }

  const paradigms = data.paradigms || {};
  let currentParadigmId = data.currentParadigm || Object.keys(paradigms)[0] || 'nouns';
  let currentVariantId = data.currentVariant || (paradigms[currentParadigmId]?.variants[0]?.id) || 'endings';
  let highlightForm = data.highlightForm || '';

  const cube = root.querySelector('.cases-cube');
  const scene = root.querySelector('.cases-cube-scene');
  const heading = root.querySelector('.cases-cube-heading');
  const titleEl = root.querySelector('.cases-cube-title');
  const subtitleEl = root.querySelector('.cases-cube-subtitle');
  const btnPrev = root.querySelector('[data-cube-dir="-1"]');
  const btnNext = root.querySelector('[data-cube-dir="1"]');
  const aspectWrap = root.querySelector('[data-cases-aspect]');
  const extraWrap = root.querySelector('.cases-extra');

  if (!cube || !scene || !heading || !titleEl || !subtitleEl) return;

  const escapeHtml = window.GreekUtils ? window.GreekUtils.escapeHtml : (text) => String(text);

  function getActiveVariant() {
    const p = paradigms[currentParadigmId];
    if (!p || !p.variants) return null;
    return p.variants.find((v) => v.id === currentVariantId) || p.variants[0] || null;
  }

  function getFaceOrder() {
    const v = getActiveVariant();
    if (!v) return [];
    return v.faceOrder || Object.keys(v.faces || {});
  }

  function getActiveFace(faceIdOrIndex) {
    const v = getActiveVariant();
    if (!v || !v.faces) return null;
    const order = getFaceOrder();
    if (typeof faceIdOrIndex === 'number') {
      const id = order[faceIdOrIndex];
      return v.faces[id] || null;
    }
    const target = faceIdOrIndex || order[currentFaceIndex];
    return v.faces[target] || null;
  }

  let currentFaceIndex = 0;
  const initialOrder = getFaceOrder();
  if (data.currentFaceIndex != null && data.currentFaceIndex >= 0 && data.currentFaceIndex < initialOrder.length) {
    currentFaceIndex = data.currentFaceIndex;
  } else if (data.currentFace && initialOrder.indexOf(data.currentFace) >= 0) {
    currentFaceIndex = initialOrder.indexOf(data.currentFace);
  } else if (data.currentCase && initialOrder.indexOf(data.currentCase) >= 0) {
    currentFaceIndex = initialOrder.indexOf(data.currentCase);
  } else if (data.currentCase === 'nominative') {
    currentFaceIndex = 0;
  } else if (data.currentCase === 'accusative') {
    currentFaceIndex = initialOrder.length === 3 ? 1 : 0;
  } else if (data.currentCase === 'genitive') {
    currentFaceIndex = initialOrder.length === 3 ? 2 : 0;
  }

  let titleTimer = 0;
  let ready = false;

  function rotationFor(index) {
    const order = getFaceOrder();
    const numFaces = order.length;
    if (numFaces === 6) {
      return index * -60;
    }
    return (1 - index) * 90;
  }

  function syncGeometry() {
    const width = scene.getBoundingClientRect().width;
    if (!width) return;
    const order = getFaceOrder();
    const numFaces = order.length;
    const tz = numFaces === 6
      ? `${Math.round(width * 0.866025)}px`
      : `${Math.round(width / 2)}px`;

    const prev = cube.style.getPropertyValue('--cases-tz');
    if (prev !== tz) {
      cube.style.transition = 'none';
      cube.style.setProperty('--cases-tz', tz);
      scene.style.perspective = `${Math.max(800, Math.round(width * 2.4))}px`;
      void cube.offsetWidth;
      if (ready && !drag) cube.style.transition = '';
    }

    let max = 0;
    root.querySelectorAll('.cases-cube-grid').forEach((grid) => {
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

    const formsContent = cell.from && cell.to
      ? `
        <div class="cases-item-trans">
          <span class="cases-trans-from greek">${escapeHtml(cell.from)}</span>
          <span class="cases-trans-arrow" aria-hidden="true">→</span>
          <span class="cases-trans-to greek">${escapeHtml(cell.to)}</span>
        </div>`
      : `
        <span class="cases-item-greek greek">${escapeHtml(cell.greek || '')}</span>`;

    const hasSub = Boolean(cell.ru || cell.hint);

    return `
      <div class="cases-item${isCurrent ? ' is-current' : ''}${isEmpty ? ' is-empty' : ''}" data-greek="${escapeHtml(cell.greek || '')}">
        <div class="cases-item-main">
          <span class="cases-item-label">${escapeHtml(cell.label || '')}</span>
          <div class="cases-item-target">
            ${formsContent}
            ${cell.rule ? `<span class="cases-item-rule">${escapeHtml(cell.rule)}</span>` : ''}
          </div>
        </div>
        ${hasSub ? `
        <div class="cases-item-sub">
          ${cell.ru ? `<span class="cases-item-ru">${escapeHtml(cell.ru)}</span>` : '<span class="cases-item-ru-spacer"></span>'}
          ${cell.hint ? `<span class="cases-item-hint">${escapeHtml(cell.hint)}</span>` : ''}
        </div>` : ''}
      </div>`;
  }

  function updateFacesContent() {
    const v = getActiveVariant();
    if (!v) return;
    const order = getFaceOrder();

    order.forEach((faceId, idx) => {
      const face = v.faces[faceId];
      const faceEl = root.querySelector(`.cases-cube-face--${faceId}`) ||
                     root.querySelector(`.cases-cube-face--${idx}`);
      if (!face || !faceEl) return;

      const gridEl = faceEl.querySelector('.cases-cube-grid');
      if (!gridEl) return;

      let html = '';
      if (face.sections && face.sections.length > 0) {
        face.sections.forEach((sec) => {
          let itemsHtml = '';
          (sec.items || []).forEach((item) => {
            itemsHtml += renderCellHtml(item);
          });
          html += `
            <div class="cases-section">
              <div class="cases-section-head">
                <div class="cases-section-title-wrap">
                  ${sec.icon ? `<span class="cases-section-icon" aria-hidden="true">${escapeHtml(sec.icon)}</span>` : ''}
                  <h3 class="cases-section-title">${escapeHtml(sec.title)}</h3>
                </div>
                ${sec.badge ? `<span class="cases-section-badge">${escapeHtml(sec.badge)}</span>` : ''}
              </div>
              <div class="cases-section-items">
                ${itemsHtml}
              </div>
            </div>`;
        });
      } else if (face.rows && face.rows.length > 0) {
        if (face.colLeftTitle || face.colRightTitle) {
          html += `
            <div class="cases-col-label">${escapeHtml(face.colLeftTitle || '')}</div>
            <div class="cases-col-label">${escapeHtml(face.colRightTitle || '')}</div>`;
        }
        face.rows.forEach((row) => {
          html += renderCellHtml(row.left);
          html += renderCellHtml(row.right);
        });
      }

      gridEl.innerHTML = html;
    });

    if (extraWrap) {
      if (v.extraNotes) {
        const notes = v.extraNotes;
        let examplesHtml = '';
        (notes.examples || []).forEach((ex) => {
          examplesHtml += `
            <div class="cases-extra-example" data-greek="${escapeHtml(ex.greek)}">
              <span class="cases-extra-greek greek">${escapeHtml(ex.greek)}</span>
              <span class="cases-extra-ru">${escapeHtml(ex.ru)}</span>
            </div>`;
        });
        extraWrap.innerHTML = `
          <div class="cases-extra-card">
            <h3 class="cases-extra-title">${escapeHtml(notes.title || '')}</h3>
            ${notes.description ? `<p class="cases-extra-desc">${escapeHtml(notes.description)}</p>` : ''}
            ${examplesHtml ? `<div class="cases-extra-examples">${examplesHtml}</div>` : ''}
          </div>`;
      } else {
        extraWrap.innerHTML = '';
      }
    }

    syncGeometry();
  }

  function updateTitle(animate) {
    const face = getActiveFace(currentFaceIndex);
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
    const order = getFaceOrder();
    const numFaces = order.length;
    if (btnPrev) btnPrev.disabled = index === 0;
    if (btnNext) btnNext.disabled = index === numFaces - 1;

    const activeFaceId = order[index] || '';

    root.querySelectorAll('.cases-face-tab').forEach((tab) => {
      const tabIdx = Number(tab.getAttribute('data-face-index'));
      const tabId = tab.getAttribute('data-face-id');
      const active = tabIdx === index || tabId === activeFaceId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    root.querySelectorAll('.cases-cube-dot').forEach((dot) => {
      const dotIdx = dot.getAttribute('data-dot-index');
      const dotId = dot.getAttribute('data-dot');
      const active = (dotIdx != null && Number(dotIdx) === index) || dotId === activeFaceId;
      dot.classList.toggle('is-active', active);
    });

    root.querySelectorAll('.cases-cube-face').forEach((face) => {
      const faceIdx = Number(face.getAttribute('data-face-index'));
      const faceId = face.getAttribute('data-face');
      const active = faceIdx === index || faceId === activeFaceId;
      face.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  function applyRotation(degrees, animate) {
    if (animate) {
      cube.style.transition = '';
      void cube.offsetWidth;
    } else {
      cube.style.transition = 'none';
    }
    cube.style.transform = `translateZ(calc(var(--cases-tz) * -1)) rotateY(${degrees}deg)`;
  }

  function updateChrome() {
    applyRotation(rotationFor(currentFaceIndex), true);
    paintChrome(currentFaceIndex);
  }

  function goToFace(index) {
    const order = getFaceOrder();
    const maxIdx = Math.max(0, order.length - 1);
    const next = Math.max(0, Math.min(maxIdx, index));
    if (next === currentFaceIndex) return;
    currentFaceIndex = next;
    updateTitle(true);
    updateChrome();
  }

  function rotateCube(direction) {
    goToFace(currentFaceIndex + direction);
  }

  function setCase(cType) {
    const order = getFaceOrder();
    const idx = order.indexOf(cType);
    if (idx >= 0) goToFace(idx);
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
      aspectWrap.querySelectorAll('.cases-aspect-btn').forEach((btn) => {
        const active = btn.getAttribute('data-variant') === variantId;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    const order = getFaceOrder();
    if (currentFaceIndex >= order.length) {
      currentFaceIndex = 0;
    }

    updateFacesContent();
    updateTitle(true);
    updateChrome();
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

    let html = '<div class="cases-aspect-slider" aria-hidden="true"></div>';
    variants.forEach((v) => {
      const active = v.id === currentVariantId;
      html += `<button type="button" class="cases-aspect-btn${active ? ' is-active' : ''}" data-variant="${v.id}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeHtml(v.label)}">${escapeHtml(v.label)}</button>`;
    });
    aspectWrap.innerHTML = html;

    aspectWrap.querySelectorAll('.cases-aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant')));
    });
  }

  function setParadigm(paradigmId) {
    if (paradigmId === currentParadigmId || !paradigms[paradigmId]) return;
    currentParadigmId = paradigmId;
    root.setAttribute('data-paradigm', paradigmId);

    root.querySelectorAll('.cases-tab').forEach((tab) => {
      const active = tab.getAttribute('data-paradigm') === paradigmId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const p = paradigms[paradigmId];
    currentVariantId = p.defaultVariant || p.variants[0]?.id || 'endings';
    currentFaceIndex = 0;
    if (p.defaultFace) {
      const order = p.variants[0]?.faceOrder || Object.keys(p.variants[0]?.faces || {});
      const fIdx = order.indexOf(p.defaultFace);
      if (fIdx >= 0) currentFaceIndex = fIdx;
    }

    rebuildVariantSwitcher(p);
    updateFacesContent();
    updateTitle(true);
    updateChrome();
  }

  if (aspectWrap) {
    aspectWrap.querySelectorAll('.cases-aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant')));
    });
  }

  root.querySelectorAll('.cases-tab').forEach((tab) => {
    tab.addEventListener('click', () => setParadigm(tab.getAttribute('data-paradigm')));
  });

  root.querySelectorAll('.cases-face-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const idx = Number(tab.getAttribute('data-face-index'));
      if (!Number.isNaN(idx)) goToFace(idx);
    });
  });

  root.querySelectorAll('.cases-cube-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = dot.getAttribute('data-dot-index');
      if (idx != null) {
        goToFace(Number(idx));
      } else {
        const cType = dot.getAttribute('data-dot');
        if (cType) setCase(cType);
      }
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
    const item = node.closest('.cases-item, .cases-extra-example');
    if (!item || !root.contains(item)) return '';

    const face = item.closest('.cases-cube-face');
    if (face && face.getAttribute('aria-hidden') === 'true') return '';

    const text = item.getAttribute('data-greek') ||
      item.querySelector('.cases-item-greek, .cases-extra-greek')?.textContent || '';

    // Ignore placeholder patterns like "ο … -ος" or non-words
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
    const order = getFaceOrder();
    const numFaces = order.length;
    const minRot = rotationFor(numFaces - 1);
    const maxRot = rotationFor(0);
    const lower = Math.min(minRot, maxRot);
    const upper = Math.max(minRot, maxRot);
    if (degrees > upper) return upper + (degrees - upper) * 0.22;
    if (degrees < lower) return lower + (degrees - lower) * 0.22;
    return degrees;
  }

  function followFinger(dx) {
    const width = scene.getBoundingClientRect().width || 1;
    const order = getFaceOrder();
    const numFaces = order.length;
    const step = numFaces === 6 ? 60 : 90;
    const baseRot = rotationFor(currentFaceIndex);
    const degrees = rubberBand(baseRot + (dx / width) * step);
    applyRotation(degrees, false);

    let nearest;
    if (numFaces === 6) {
      nearest = Math.max(0, Math.min(5, Math.round(-degrees / 60)));
    } else {
      nearest = Math.max(0, Math.min(2, 1 - Math.round(degrees / 90)));
    }

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
    const order = getFaceOrder();
    const maxIdx = Math.max(0, order.length - 1);

    let next = currentFaceIndex;
    if (ratio <= -0.20 || (state.vx < -0.4 && dx <= -16)) next = Math.min(maxIdx, currentFaceIndex + 1);
    else if (ratio >= 0.20 || (state.vx > 0.4 && dx >= 16)) next = Math.max(0, currentFaceIndex - 1);

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
          // pointer capture safety
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
