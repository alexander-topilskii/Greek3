(function (global) {
  const ladder = () => global.GreekLearningLadder;

  /**
   * Assemble a Greek sentence from a shuffled word bank (with decoys).
   * Direction is always Ру → Ελ: the Russian translation is the prompt.
   * opts: { root, onResult(correct: boolean) }
   */
  function initBuildStep(opts) {
    const root = opts.root;
    if (!root) return null;

    const cardEl = root.querySelector('.learn-step-card');
    const promptEl = root.querySelector('[data-build-prompt]');
    const assemblyEl = root.querySelector('[data-build-assembly]');
    const bankEl = root.querySelector('[data-build-bank]');
    const checkBtn = root.querySelector('[data-build-check]');
    const skipBtn = root.querySelector('[data-build-skip]');
    const feedbackEl = root.querySelector('[data-build-feedback]');
    const speak = global.GreekSpeak;

    let locked = false;
    let target = '';
    let sentence = '';
    /** @type {{ id: number, text: string, decoy: boolean }[]} */
    let bank = [];
    /** @type {number[]} ids in placed order */
    let assembly = [];

    function esc(text) {
      return ladder().escapeHtml(text);
    }

    function clearCardState() {
      cardEl?.classList.remove('learn-step-card--success', 'learn-step-card--error');
    }

    function hideFeedback() {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.className = 'learn-build-feedback';
      feedbackEl.textContent = '';
    }

    function assembledText() {
      const byId = new Map(bank.map((item) => [item.id, item.text]));
      return assembly.map((id) => byId.get(id) ?? '').join(' ');
    }

    function updateCheckEnabled() {
      if (checkBtn) checkBtn.disabled = locked || assembly.length === 0;
    }

    function setInteractiveEnabled(enabled) {
      if (skipBtn) skipBtn.disabled = !enabled;
      root.querySelectorAll('[data-build-id]').forEach((btn) => {
        btn.disabled = !enabled;
      });
      updateCheckEnabled();
    }

    function renderAssembly() {
      if (!assemblyEl) return;
      assemblyEl.innerHTML = '';

      if (!assembly.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'learn-build-placeholder';
        placeholder.textContent = 'Нажимайте слова ниже';
        assemblyEl.appendChild(placeholder);
        return;
      }

      for (const id of assembly) {
        const item = bank.find((b) => b.id === id);
        if (!item) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'learn-build-chip learn-build-chip--placed greek';
        btn.dataset.buildId = String(id);
        btn.dataset.buildZone = 'assembly';
        btn.textContent = item.text;
        if (locked) btn.disabled = true;
        assemblyEl.appendChild(btn);
      }
    }

    function renderBank() {
      if (!bankEl) return;
      bankEl.innerHTML = '';

      const used = new Set(assembly);
      for (const item of bank) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'learn-build-chip learn-build-chip--bank greek';
        btn.dataset.buildId = String(item.id);
        btn.dataset.buildZone = 'bank';
        btn.textContent = item.text;
        if (used.has(item.id) || locked) {
          btn.classList.add('learn-build-chip--used');
          btn.disabled = true;
        }
        bankEl.appendChild(btn);
      }
    }

    function render() {
      renderAssembly();
      renderBank();
      updateCheckEnabled();
    }

    function showIncorrectFeedback() {
      locked = true;
      setInteractiveEnabled(false);
      cardEl?.classList.add('learn-step-card--error');
      root.classList.add('learn-build--shake');
      global.setTimeout(() => root.classList.remove('learn-build--shake'), 450);

      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = 'learn-build-feedback learn-build-feedback--bad';
        feedbackEl.innerHTML =
          `<span class="learn-build-feedback-text">Правильно: <strong class="greek">${esc(sentence || target)}</strong></span>` +
          '<button type="button" class="btn btn-secondary learn-build-dismiss">Дальше</button>';
        feedbackEl.querySelector('.learn-build-dismiss')?.addEventListener(
          'click',
          () => {
            opts.onResult?.(false);
          },
          { once: true },
        );
      }
    }

    function succeed() {
      locked = true;
      setInteractiveEnabled(false);
      cardEl?.classList.add('learn-step-card--success');
      if (speak?.isSupported?.()) speak.speakGreek(target);
      global.setTimeout(() => {
        opts.onResult?.(true);
      }, 640);
    }

    function checkAssembly() {
      if (locked || !assembly.length) return;
      if (assembledText().trim() === target.trim()) {
        succeed();
      } else {
        showIncorrectFeedback();
      }
    }

    function onChipClick(e) {
      if (locked) return;
      const btn = e.target.closest('[data-build-id]');
      if (!btn) return;

      const id = Number(btn.dataset.buildId);
      const zone = btn.dataset.buildZone;

      if (zone === 'bank') {
        if (assembly.includes(id)) return;
        assembly.push(id);
        render();
        return;
      }

      if (zone === 'assembly') {
        const index = assembly.lastIndexOf(id);
        if (index < 0) return;
        assembly.splice(index, 1);
        render();
      }
    }

    assemblyEl?.addEventListener('click', onChipClick);
    bankEl?.addEventListener('click', onChipClick);
    checkBtn?.addEventListener('click', () => {
      if (locked) return;
      checkAssembly();
    });
    skipBtn?.addEventListener('click', () => {
      if (locked) return;
      showIncorrectFeedback();
    });

    function show({ translation, sentence: fullSentence, tokens, bank: wordBank }) {
      locked = false;
      target = (tokens ?? []).join(' ');
      sentence = fullSentence ?? target;
      bank = Array.isArray(wordBank) ? wordBank : [];
      assembly = [];
      clearCardState();
      hideFeedback();
      setInteractiveEnabled(true);

      if (promptEl) promptEl.textContent = translation ?? '—';

      render();

      root.classList.remove('learn-step--enter', 'learn-build--shake');
      requestAnimationFrame(() => {
        root.classList.add('learn-step--visible');
      });
    }

    return { show };
  }

  global.GreekBuildStep = { init: initBuildStep };
})(window);
