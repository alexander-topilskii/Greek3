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

  const persons = data.persons || [];
  if (!persons.length) return;

  const cube = root.querySelector('.verb-cube');
  const scene = root.querySelector('.verb-cube-scene');
  const heading = root.querySelector('.verb-cube-heading');
  const titleEl = root.querySelector('.verb-cube-title');
  const subtitleEl = root.querySelector('.verb-cube-subtitle');
  const btnPrev = root.querySelector('[data-cube-dir="-1"]');
  const btnNext = root.querySelector('[data-cube-dir="1"]');
  const tabs = root.querySelectorAll('.verb-person-tab');
  const faces = root.querySelectorAll('.verb-cube-face');

  const dialog = root.querySelector('.verb-dialog');
  const dialogTitle = dialog ? dialog.querySelector('#verb-dialog-title') : null;
  const dialogSpeak = dialog ? dialog.querySelector('.verb-dialog-speak') : null;
  const dialogClose = dialog ? dialog.querySelector('.verb-dialog-close') : null;
  const dialogBadges = dialog ? dialog.querySelector('.verb-dialog-badges') : null;
  const dialogLemma = dialog ? dialog.querySelector('.verb-dialog-lemma') : null;
  const dialogLemmaVal = dialog ? dialog.querySelector('.verb-dialog-lemma-val') : null;
  const dialogExample = dialog ? dialog.querySelector('.verb-dialog-example') : null;
  const dialogExampleSpeak = dialog ? dialog.querySelector('.verb-dialog-example-speak') : null;
  const dialogExampleGreek = dialog ? dialog.querySelector('.verb-dialog-example-greek') : null;
  const dialogExampleRu = dialog ? dialog.querySelector('.verb-dialog-example-ru') : null;
  const dialogNoExample = dialog ? dialog.querySelector('.verb-dialog-no-example') : null;

  if (!cube || !scene || !heading || !titleEl || !subtitleEl) return;

  let currentFaceIndex = typeof data.initialIndex === 'number' ? data.initialIndex : 0;
  let titleTimer = 0;
  let ready = false;

  function rotationFor(index) {
    return index * -60;
  }

  function syncGeometry() {
    const width = scene.getBoundingClientRect().width;
    if (!width) return;
    // Regular hexagonal prism radius (distance from center to face): width / (2 * tan(30deg)) = width * sqrt(3) / 2
    const tz = `${Math.round(width * 0.866025)}px`;
    const prev = cube.style.getPropertyValue('--verb-tz');
    if (prev !== tz) {
      cube.style.transition = 'none';
      cube.style.setProperty('--verb-tz', tz);
      scene.style.perspective = `${Math.max(1000, Math.round(width * 2.5))}px`;
      void cube.offsetWidth;
      if (ready && !drag) cube.style.transition = '';
    }

    let max = 0;
    root.querySelectorAll('.verb-face-tenses').forEach((el) => {
      max = Math.max(max, el.offsetHeight, el.scrollHeight);
    });
    if (max > 0) {
      const nextHeight = `${Math.ceil(max)}px`;
      if (scene.style.height !== nextHeight) scene.style.height = nextHeight;
    }
  }

  function updateTitle(animate) {
    const meta = persons[currentFaceIndex];
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
    if (btnPrev) btnPrev.disabled = index === 0;
    if (btnNext) btnNext.disabled = index === persons.length - 1;

    tabs.forEach((tab) => {
      const tabIdx = Number(tab.getAttribute('data-person-index'));
      const active = tabIdx === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    faces.forEach((face) => {
      const faceIdx = Number(face.getAttribute('data-person-index'));
      face.setAttribute('aria-hidden', faceIdx === index ? 'false' : 'true');
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

  function goToPerson(index) {
    const maxIdx = persons.length - 1;
    let next = Math.max(0, Math.min(maxIdx, index));
    if (next === currentFaceIndex) return;
    currentFaceIndex = next;
    updateTitle(true);
    updateChrome();
  }

  function rotateCube(direction) {
    goToPerson(currentFaceIndex + direction);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const idx = Number(tab.getAttribute('data-person-index'));
      if (!Number.isNaN(idx)) goToPerson(idx);
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
  let currentDialogForm = '';
  let currentDialogSentence = '';

  if (dialogSpeak) {
    dialogSpeak.addEventListener('click', () => {
      if (currentDialogForm && window.GreekSpeak?.speakGreek) {
        window.GreekSpeak.speakGreek(currentDialogForm);
      }
    });
  }

  if (dialogExampleSpeak) {
    dialogExampleSpeak.addEventListener('click', () => {
      if (currentDialogSentence && window.GreekSpeak?.speakGreek) {
        window.GreekSpeak.speakGreek(currentDialogSentence);
      }
    });
  }

  if (dialogClose) {
    dialogClose.addEventListener('click', () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
  }

  if (dialog) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  function greekToSpeak(node) {
    const cell = node.closest('.verb-form-cell, .verb-extra-row, .verb-participle');
    if (!cell || !root.contains(cell)) return '';
    const face = cell.closest('.verb-cube-face');
    if (face && face.getAttribute('aria-hidden') === 'true') return '';
    const greek = cell.querySelector('.verb-form-value, .verb-extra-form');
    if (!greek) return '';
    const bits = [...greek.querySelectorAll('.verb-aux, .verb-part, .verb-main')];
    const text = (bits.length ? bits.map((el) => el.textContent.trim()).filter(Boolean).join(' ') : greek.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || text === '—') return '';
    return text;
  }

  function openFormDialog(cell) {
    const form = (cell.getAttribute('data-form') || greekToSpeak(cell) || '').trim();
    if (!form || form === '—' || form === '-') return;

    if (!dialog) {
      if (window.GreekSpeak?.speakGreek) window.GreekSpeak.speakGreek(form);
      return;
    }

    currentDialogForm = form;
    if (dialogTitle) dialogTitle.textContent = form;

    if (dialogLemmaVal) {
      if (data.lemma && (data.lemma.translation || data.lemma.greek)) {
        const greekPart = data.lemma.greek ? `${data.lemma.greek} — ` : '';
        dialogLemmaVal.textContent = `${greekPart}${data.lemma.translation || ''}`;
        if (dialogLemma) dialogLemma.style.display = '';
      } else if (dialogLemma) {
        dialogLemma.style.display = 'none';
      }
    }

    if (dialogBadges) {
      dialogBadges.innerHTML = '';
      if (cell.classList.contains('verb-form-cell')) {
        const block = cell.closest('.verb-tense-block');
        const tenseClass = block ? block.getAttribute('data-tense') : '';
        const tenseTitle = block ? block.getAttribute('data-tense-title') : '';
        const tenseGreek = block ? block.getAttribute('data-tense-greek') : '';
        if (tenseTitle) {
          const badge = document.createElement('span');
          badge.className = `verb-dialog-badge verb-dialog-badge--tense verb-dialog-badge--${tenseClass || 'default'}`;
          badge.textContent = tenseGreek ? `${tenseTitle} · ${tenseGreek}` : tenseTitle;
          dialogBadges.appendChild(badge);
        }

        const aspectTitle = cell.getAttribute('title') || '';
        if (aspectTitle) {
          const badge = document.createElement('span');
          badge.className = 'verb-dialog-badge verb-dialog-badge--aspect';
          badge.textContent = aspectTitle;
          dialogBadges.appendChild(badge);
        }

        const face = cell.closest('.verb-cube-face');
        const personIdx = face ? Number(face.getAttribute('data-person-index')) : -1;
        const p = data.persons && personIdx >= 0 ? data.persons[personIdx] : null;
        if (p) {
          const badge = document.createElement('span');
          badge.className = 'verb-dialog-badge verb-dialog-badge--person';
          badge.textContent = `${p.subtitle} · ${p.ru} (${p.el})`;
          dialogBadges.appendChild(badge);
        }
      } else if (cell.classList.contains('verb-extra-row')) {
        const badgeMood = document.createElement('span');
        badgeMood.className = 'verb-dialog-badge verb-dialog-badge--mood';
        badgeMood.textContent = 'Повелительное';
        dialogBadges.appendChild(badgeMood);

        const aspectLabel = cell.getAttribute('data-aspect-label');
        if (aspectLabel) {
          const badge = document.createElement('span');
          badge.className = 'verb-dialog-badge verb-dialog-badge--aspect';
          badge.textContent = aspectLabel;
          dialogBadges.appendChild(badge);
        }

        const numLabel = cell.getAttribute('data-num');
        if (numLabel) {
          const badge = document.createElement('span');
          badge.className = 'verb-dialog-badge verb-dialog-badge--person';
          badge.textContent = numLabel;
          dialogBadges.appendChild(badge);
        }
      } else if (cell.classList.contains('verb-participle')) {
        const badgeMood = document.createElement('span');
        badgeMood.className = 'verb-dialog-badge verb-dialog-badge--mood';
        badgeMood.textContent = 'Причастие';
        dialogBadges.appendChild(badgeMood);

        const label = cell.getAttribute('data-label');
        if (label) {
          const badge = document.createElement('span');
          badge.className = 'verb-dialog-badge verb-dialog-badge--aspect';
          badge.textContent = label;
          dialogBadges.appendChild(badge);
        }
      }
    }

    const examples = data.examples || {};
    let example = examples[form] || null;
    if (!example) {
      const firstPart = form.split(/[\s,]+/)[0];
      if (firstPart && examples[firstPart]) {
        example = examples[firstPart];
      }
    }

    if (example && example.greek) {
      currentDialogSentence = example.greek;
      if (dialogExampleGreek) dialogExampleGreek.textContent = example.greek;
      if (dialogExampleRu) dialogExampleRu.textContent = example.translation || '';
      if (dialogExample) dialogExample.style.display = '';
      if (dialogNoExample) dialogNoExample.style.display = 'none';
    } else {
      currentDialogSentence = '';
      if (dialogExample) dialogExample.style.display = 'none';
      if (dialogNoExample) dialogNoExample.style.display = '';
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    const speak = window.GreekSpeak;
    if (speak?.isSupported?.()) {
      speak.speakGreek(form);
    }
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('.verb-dialog')) return;
    if (blockSpeak) {
      blockSpeak = false;
      return;
    }
    const cell = event.target.closest('.verb-form-cell, .verb-extra-row, .verb-participle');
    if (!cell || !root.contains(cell)) return;

    const face = cell.closest('.verb-cube-face');
    if (face && face.getAttribute('aria-hidden') === 'true') return;

    if (cell.classList.contains('verb-form-cell') && cell.querySelector('.verb-person-empty')) {
      return;
    }

    openFormDialog(cell);
  });

  function rubberBand(degrees) {
    const minDeg = (persons.length - 1) * -60;
    if (degrees > 0) return degrees * 0.22;
    if (degrees < minDeg) return minDeg + (degrees - minDeg) * 0.22;
    return degrees;
  }

  function followFinger(dx) {
    const width = scene.getBoundingClientRect().width || 1;
    const degrees = rubberBand(rotationFor(currentFaceIndex) + (dx / width) * 60);
    applyRotation(degrees, false);
    const maxIdx = persons.length - 1;
    const nearest = Math.max(0, Math.min(maxIdx, Math.round(-degrees / 60)));
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
    const maxIdx = persons.length - 1;
    let next = currentFaceIndex;
    if (ratio <= -0.18 || (state.vx < -0.4 && dx <= -16)) next = Math.min(maxIdx, currentFaceIndex + 1);
    else if (ratio >= 0.18 || (state.vx > 0.4 && dx >= 16)) next = Math.max(0, currentFaceIndex - 1);

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
    let lastW = 0;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect ? entry.contentRect.width : scene.getBoundingClientRect().width;
        if (Math.abs(w - lastW) > 1) {
          lastW = w;
          syncGeometry();
        }
      }
    });
    observer.observe(scene);
  } else {
    window.addEventListener('resize', syncGeometry);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => syncGeometry());
  }
})();
