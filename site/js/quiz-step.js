(function (global) {
  /**
   * Multiple-choice step (1 of 4).
   * opts: { root, onResult(correct: boolean) }
   */
  function initQuizStep(opts) {
    const root = opts.root;
    if (!root) return null;

    const labelEl = root.querySelector('[data-quiz-label]');
    const promptEl = root.querySelector('[data-quiz-prompt]');
    const optionsEl = root.querySelector('[data-quiz-options]');
    const feedbackEl = root.querySelector('[data-quiz-feedback]');

    let locked = false;
    let correctAnswer = '';

    function hideFeedback() {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.className = 'learn-quiz-feedback';
      feedbackEl.textContent = '';
    }

    function show({ prompt, promptIsGreek, options, correct, promptLabel }) {
      locked = false;
      correctAnswer = correct;
      hideFeedback();

      if (labelEl) labelEl.textContent = promptLabel ?? 'Выберите перевод';
      if (promptEl) {
        promptEl.textContent = prompt;
        promptEl.classList.toggle('greek', !!promptIsGreek);
      }

      if (!optionsEl) return;
      optionsEl.innerHTML = options
        .map(
          (text, i) =>
            `<button type="button" class="learn-quiz-option${promptIsGreek ? '' : ' greek'}" data-quiz-option="${i}" data-answer="${encodeURIComponent(text)}">${global.GreekLearningLadder.escapeHtml(text)}</button>`,
        )
        .join('');

      root.classList.remove('learn-step--enter');
      requestAnimationFrame(() => {
        root.classList.add('learn-step--visible');
      });
    }

    function reveal(correct, pick) {
      locked = true;
      optionsEl?.querySelectorAll('.learn-quiz-option').forEach((btn) => {
        const val = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
        btn.disabled = true;
        if (val === correctAnswer) btn.classList.add('learn-quiz-option--correct');
        else if (val === pick) btn.classList.add('learn-quiz-option--wrong');
      });

      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = `learn-quiz-feedback learn-quiz-feedback--${correct ? 'ok' : 'bad'}`;
        feedbackEl.textContent = correct ? 'Верно!' : 'Не совсем — попробуем ещё раз позже';
      }
    }

    optionsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quiz-option]');
      if (!btn || locked) return;

      const pick = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
      const correct = pick === correctAnswer;
      btn.classList.add('learn-quiz-option--picked');
      reveal(correct, pick);

      global.setTimeout(() => {
        opts.onResult?.(correct);
      }, correct ? 520 : 900);
    });

    return { show };
  }

  global.GreekQuizStep = { init: initQuizStep };
})(window);
