(function (global) {
  /**
   * Shared flashcard with swipe grading.
   * opts: { onGrade(remembered), onFlip? }
   */
  function initFlashcard(opts) {
    const root = opts.root;
    if (!root) return null;

    const card = root.querySelector('.flashcard');
    const dragLayer = root.querySelector('.flashcard-drag');
    const inner = root.querySelector('.flashcard-inner');
    const frontLabel = root.querySelector('[data-flash-front-label]');
    const backLabel = root.querySelector('[data-flash-back-label]');
    const frontText = root.querySelector('[data-flash-front-text]');
    const backText = root.querySelector('[data-flash-back-text]');
    const hintLeft = root.querySelector('.flashcard-hint--left');
    const hintRight = root.querySelector('.flashcard-hint--right');
    const btnSpeak = root.parentElement?.querySelector('.btn-speak');
    const speak = global.GreekSpeak;

    let flipped = false;
    let greekLines = [];
    let startWithRussian = opts.startWithRussian ?? false;
    let dragging = false;
    let startX = 0;
    let currentX = 0;
    const threshold = 80;

    function setLangButton(btn) {
      if (!btn) return;
      btn.textContent = startWithRussian ? '⇄ EL' : '⇄ RU';
      btn.setAttribute('aria-pressed', String(startWithRussian));
      btn.title = startWithRussian
        ? 'Показывать сначала по-гречески'
        : 'Показывать сначала по-русски';
    }

    function applyFaces(front, back, frontIsGreek, backIsGreek) {
      if (frontLabel) frontLabel.textContent = frontIsGreek ? 'Греческий' : 'Русский';
      if (backLabel) backLabel.textContent = backIsGreek ? 'Греческий' : 'Перевод';
      if (frontText) {
        frontText.textContent = front;
        frontText.classList.toggle('greek', frontIsGreek);
      }
      if (backText) {
        backText.textContent = back;
        backText.classList.toggle('greek', backIsGreek);
      }
    }

    function setGreekLines(lines) {
      greekLines = lines
        .map((l) => String(l).trim())
        .filter((l) => l && l !== '—');
      updateSpeakButton();
    }

    let speakErrorTimer = null;

    function setSpeakError(message) {
      if (!btnSpeak) return;
      btnSpeak.classList.add('is-speak-error');
      btnSpeak.title = message;
      if (speakErrorTimer) global.clearTimeout(speakErrorTimer);
      speakErrorTimer = global.setTimeout(() => {
        speakErrorTimer = null;
        btnSpeak.classList.remove('is-speak-error');
        updateSpeakButton();
      }, 3200);
    }

    function updateSpeakButton() {
      if (!btnSpeak) return;
      if (speakErrorTimer) return;
      const canSpeak = !!speak?.isSupported?.() && greekLines.length > 0;
      btnSpeak.disabled = !canSpeak;
      btnSpeak.classList.toggle('is-speaking', !!speak?.isSpeaking?.());
      if (!speak?.isSupported?.()) {
        btnSpeak.title = 'Озвучка не поддерживается в этом браузере';
      } else if (!greekLines.length) {
        btnSpeak.title = 'Нет греческого текста';
      } else if (!speak.hasGreekVoice?.()) {
        btnSpeak.title = 'Озвучить по-гречески (голос el-GR может отсутствовать на устройстве)';
      } else {
        btnSpeak.title = 'Озвучить по-гречески';
      }
    }

    function speakFailureReason(reason) {
      if (reason === 'unsupported') return 'Озвучка недоступна в этом браузере';
      if (reason === 'timeout') return 'Озвучка не запустилась — попробуйте ещё раз';
      if (reason === 'not-allowed') return 'Браузер заблокировал озвучку';
      if (reason === 'synthesis-failed') {
        return 'Не удалось озвучить — проверьте голос el-GR в настройках системы';
      }
      return 'Не удалось озвучить — попробуйте другой браузер (Chrome, Safari)';
    }

    function speakCurrent() {
      if (!speak?.isSupported?.() || !greekLines.length) return;
      if (speak.isSpeaking?.()) {
        speak.stop();
        updateSpeakButton();
        return;
      }
      btnSpeak?.classList.remove('is-speak-error');
      btnSpeak?.classList.add('is-speaking');
      speak.speakGreek(greekLines).then((result) => {
        if (!result?.ok) setSpeakError(speakFailureReason(result?.reason));
      }).finally(() => updateSpeakButton());
    }

    function showPair(greek, translation) {
      setGreekLines([greek]);
      if (startWithRussian) {
        applyFaces(translation, greek, false, true);
      } else {
        applyFaces(greek, translation, true, false);
      }
      resetFlip();
    }

    function showMultiLine(frontLines, backLines, frontIsGreek, backIsGreek) {
      setGreekLines(frontIsGreek ? frontLines : backLines);
      const frontHtml = frontLines.map((l) => `<span class="${frontIsGreek ? 'greek' : ''}">${escape(l)}</span>`).join('<br>');
      const backHtml = backLines.map((l) => `<span class="${backIsGreek ? 'greek' : ''}">${escape(l)}</span>`).join('<br>');
      if (frontLabel) frontLabel.textContent = frontIsGreek ? 'Греческий' : 'Русский';
      if (backLabel) backLabel.textContent = backIsGreek ? 'Греческий' : 'Перевод';
      if (frontText) {
        frontText.innerHTML = frontHtml;
        frontText.classList.toggle('greek', frontIsGreek);
      }
      if (backText) {
        backText.innerHTML = backHtml;
        backText.classList.toggle('greek', backIsGreek);
      }
      resetFlip();
    }

    function escape(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function resetFlip() {
      flipped = false;
      card?.classList.remove('is-flipped');
    }

    function toggleFlip() {
      if (dragging) return;
      flipped = !flipped;
      card?.classList.toggle('is-flipped', flipped);
      opts.onFlip?.(flipped);
    }

    function setTransform(x) {
      const layer = dragLayer || inner;
      if (!layer) return;
      const rotate = x * 0.04;
      layer.style.transform = `translateX(${x}px) rotate(${rotate}deg)`;
      root.classList.toggle('is-dragging', Math.abs(x) > 8);
      root.classList.toggle('is-swipe-right', x > 20);
      root.classList.toggle('is-swipe-left', x < -20);
      if (hintRight) hintRight.style.opacity = String(Math.min(1, Math.max(0, x / threshold)));
      if (hintLeft) hintLeft.style.opacity = String(Math.min(1, Math.max(0, -x / threshold)));
    }

    function clearTransform() {
      const layer = dragLayer || inner;
      if (!layer) return;
      layer.style.transform = '';
      root.classList.remove('is-dragging', 'is-swipe-right', 'is-swipe-left');
      if (hintRight) hintRight.style.opacity = '0';
      if (hintLeft) hintLeft.style.opacity = '0';
    }

    function finishSwipe(remembered) {
      speak?.stop?.();
      updateSpeakButton();
      const dir = remembered ? 1 : -1;
      const layer = dragLayer || inner;
      root.classList.add(remembered ? 'is-exit-right' : 'is-exit-left');
      if (layer) layer.style.transform = `translateX(${dir * 500}px) rotate(${dir * 20}deg)`;

      setTimeout(() => {
        root.classList.remove('is-exit-right', 'is-exit-left');
        clearTransform();
        opts.onGrade?.(remembered);
      }, 280);
    }

    function onPointerDown(e) {
      if (root.classList.contains('is-exit-right') || root.classList.contains('is-exit-left')) return;
      dragging = true;
      startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      currentX = 0;
      card?.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      currentX = x - startX;
      setTransform(currentX);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      if (currentX > threshold) {
        finishSwipe(true);
      } else if (currentX < -threshold) {
        finishSwipe(false);
      } else {
        clearTransform();
      }
      currentX = 0;
    }

    card?.addEventListener('pointerdown', onPointerDown);
    card?.addEventListener('pointermove', onPointerMove);
    card?.addEventListener('pointerup', onPointerUp);
    card?.addEventListener('pointercancel', onPointerUp);
    card?.addEventListener('click', (e) => {
      if (Math.abs(currentX) > 10) return;
      toggleFlip();
    });
    card?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      }
      if (e.key === 'ArrowRight') finishSwipe(true);
      if (e.key === 'ArrowLeft') finishSwipe(false);
    });

    btnSpeak?.addEventListener('click', (e) => {
      e.stopPropagation();
      speakCurrent();
    });
    updateSpeakButton();

    return {
      showPair,
      showMultiLine,
      toggleLang(btn) {
        startWithRussian = !startWithRussian;
        setLangButton(btn);
        return startWithRussian;
      },
      setLangButton,
      get startWithRussian() {
        return startWithRussian;
      },
      set startWithRussian(v) {
        startWithRussian = v;
      },
      resetFlip,
    };
  }

  global.GreekFlashcard = { init: initFlashcard };
})(window);
