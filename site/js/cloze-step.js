(function (global) {
  const ladder = () => global.GreekLearningLadder;

  /**
   * Fill-in-the-blank step: pick the missing word for a context sentence.
   * opts: { root, onResult(correct: boolean) }
   */
  function initClozeStep(opts) {
    const root = opts.root;
    if (!root) return null;

    const cardEl = root.querySelector('.learn-step-card');
    const sentenceEl = root.querySelector('[data-cloze-sentence]');
    const hintEl = root.querySelector('[data-cloze-hint]');
    const optionsEl = root.querySelector('[data-cloze-options]');
    const feedbackEl = root.querySelector('[data-cloze-feedback]');
    const speak = global.GreekSpeak;

    let locked = false;
    let answer = '';

    function esc(text) {
      return ladder().escapeHtml(text);
    }

    function clearCardState() {
      cardEl?.classList.remove('learn-step-card--success', 'learn-step-card--error');
    }

    function hideFeedback() {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.className = 'learn-quiz-feedback';
      feedbackEl.textContent = '';
    }

    function renderSentence(before, after, blankText, blankModifier) {
      if (!sentenceEl) return;
      const beforeHtml = before ? `<span class="greek">${esc(before)}</span>` : '';
      const afterHtml = after ? `<span class="greek">${esc(after)}</span>` : '';
      const blankClass = `learn-cloze-blank greek${blankModifier ? ` ${blankModifier}` : ''}`;
      sentenceEl.innerHTML =
        `${beforeHtml}<span class="${blankClass}" data-cloze-slot>${esc(blankText)}</span>${afterHtml}`;
    }

    function show({ before, after, answer: ans, translation, options }) {
      locked = false;
      answer = String(ans ?? '');
      clearCardState();
      hideFeedback();

      renderSentence(before ?? '', after ?? '', '…', '');
      if (hintEl) hintEl.textContent = translation ?? '';

      if (optionsEl) {
        optionsEl.innerHTML = (options ?? [])
          .map(
            (text, i) =>
              `<button type="button" class="learn-quiz-option greek" data-cloze-option="${i}" data-answer="${encodeURIComponent(text)}">${esc(text)}</button>`,
          )
          .join('');
      }

      root.classList.remove('learn-step--enter');
      requestAnimationFrame(() => root.classList.add('learn-step--visible'));
    }

    function reveal(correct, pick) {
      locked = true;
      optionsEl?.querySelectorAll('.learn-quiz-option').forEach((btn) => {
        const val = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
        btn.disabled = true;
        if (val === answer) btn.classList.add('learn-quiz-option--correct');
        else if (val === pick) btn.classList.add('learn-quiz-option--wrong');
      });

      const slot = sentenceEl?.querySelector('[data-cloze-slot]');

      if (correct) {
        if (slot) {
          slot.textContent = answer;
          slot.classList.add('learn-cloze-blank--filled');
        }
        cardEl?.classList.add('learn-step-card--success');
        if (speak?.isSupported?.()) speak.speakGreek(answer);
        global.setTimeout(() => {
          opts.onResult?.(true);
        }, 620);
        return;
      }

      cardEl?.classList.add('learn-step-card--error');
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = 'learn-quiz-feedback learn-quiz-feedback--bad';
        feedbackEl.innerHTML =
          `<span class="learn-quiz-feedback-text">Правильно: <strong class="greek">${esc(answer)}</strong></span>` +
          '<button type="button" class="btn btn-secondary learn-quiz-dismiss">Продолжить</button>';
        feedbackEl.querySelector('.learn-quiz-dismiss')?.addEventListener(
          'click',
          () => {
            opts.onResult?.(false);
          },
          { once: true },
        );
      }
    }

    optionsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cloze-option]');
      if (!btn || locked) return;
      const pick = decodeURIComponent(btn.getAttribute('data-answer') ?? '');
      btn.classList.add('learn-quiz-option--picked');
      reveal(pick === answer, pick);
    });

    return { show };
  }

  global.GreekClozeStep = { init: initClozeStep };
})(window);
