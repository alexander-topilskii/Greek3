(function (global) {
  const ladder = () => global.GreekLearningLadder;

  /**
   * Tap Greek letters to spell the word shown in Russian.
   * opts: { root, onResult(correct: boolean) }
   */
  function initSpellStep(opts) {
    const root = opts.root;
    if (!root) return null;

    const cardEl = root.querySelector('.learn-step-card');
    const labelEl = root.querySelector('[data-spell-label]');
    const promptEl = root.querySelector('[data-spell-prompt]');
    const assemblyEl = root.querySelector('[data-spell-assembly]');
    const bankEl = root.querySelector('[data-spell-bank]');
    const feedbackEl = root.querySelector('[data-spell-feedback]');
    const speak = global.GreekSpeak;
    const utils = global.GreekUtils;

    let locked = false;
    let target = '';
    let ruForms = [];
    /** @type {{ id: number, char: string }[]} */
    let bank = [];
    /** @type {number[]} */
    let assembly = [];

    function clearCardState() {
      cardEl?.classList.remove('learn-step-card--success', 'learn-step-card--error');
    }

    function hideFeedback() {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.className = 'learn-spell-feedback';
      feedbackEl.textContent = '';
    }

    function formatRuLabel(text) {
      if (!text || !utils?.formatRuForChoice) return text;
      return utils.formatRuForChoice(text, ruForms);
    }

    function normalizeGreek(text) {
      return String(text ?? '').normalize('NFC');
    }

    function assemblyText() {
      const byId = new Map(bank.map((item) => [item.id, item.char]));
      return assembly.map((id) => byId.get(id) ?? '').join('');
    }

    function renderAssembly() {
      if (!assemblyEl) return;
      assemblyEl.innerHTML = '';

      if (!assembly.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'learn-spell-assembly-placeholder';
        placeholder.textContent = 'Нажимайте буквы ниже';
        assemblyEl.appendChild(placeholder);
        return;
      }

      for (const id of assembly) {
        const item = bank.find((b) => b.id === id);
        if (!item) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'learn-spell-letter learn-spell-letter--placed greek';
        btn.dataset.spellId = String(id);
        btn.dataset.spellZone = 'assembly';
        btn.textContent = item.char;
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
        btn.className = 'learn-spell-letter learn-spell-letter--bank greek';
        btn.dataset.spellId = String(item.id);
        btn.dataset.spellZone = 'bank';
        btn.textContent = item.char;
        if (used.has(item.id)) {
          btn.classList.add('learn-spell-letter--used');
          btn.disabled = true;
        }
        bankEl.appendChild(btn);
      }
    }

    function render() {
      renderAssembly();
      renderBank();
    }

    function failStep() {
      locked = true;
      cardEl?.classList.add('learn-step-card--error');
      root.classList.add('learn-spell--shake');
      global.setTimeout(() => root.classList.remove('learn-spell--shake'), 450);

      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.className = 'learn-spell-feedback learn-spell-feedback--bad';
        feedbackEl.innerHTML =
          `<span class="learn-spell-feedback-text">Правильно: <strong class="greek">${ladder().escapeHtml(target)}</strong></span>` +
          '<button type="button" class="btn btn-secondary learn-spell-dismiss">Продолжить</button>';
        feedbackEl.querySelector('.learn-spell-dismiss')?.addEventListener(
          'click',
          () => {
            opts.onResult?.(false);
          },
          { once: true },
        );
      }
    }

    function succeedStep() {
      locked = true;
      cardEl?.classList.add('learn-step-card--success');
      if (speak?.isSupported?.()) speak.speakGreek(target);
      global.setTimeout(() => {
        opts.onResult?.(true);
      }, 620);
    }

    function checkAssembly() {
      const built = normalizeGreek(assemblyText());
      const expectedLen = normalizeGreek(target).length;
      if (assembly.length < expectedLen) return;
      if (built === normalizeGreek(target)) {
        succeedStep();
      } else {
        failStep();
      }
    }

    function onLetterClick(e) {
      if (locked) return;
      const btn = e.target.closest('[data-spell-id]');
      if (!btn) return;

      const id = Number(btn.dataset.spellId);
      const zone = btn.dataset.spellZone;

      if (zone === 'bank') {
        if (assembly.includes(id)) return;
        assembly.push(id);
        render();
        checkAssembly();
        return;
      }

      if (zone === 'assembly') {
        const index = assembly.lastIndexOf(id);
        if (index < 0) return;
        assembly.splice(index, 1);
        render();
      }
    }

    assemblyEl?.addEventListener('click', onLetterClick);
    bankEl?.addEventListener('click', onLetterClick);

    function show({ translation, greek, ruFormLabels, letterBank }) {
      locked = false;
      target = normalizeGreek(greek);
      ruForms = Array.isArray(ruFormLabels) ? ruFormLabels : [];
      bank = Array.isArray(letterBank) ? letterBank : [];
      assembly = [];
      clearCardState();
      hideFeedback();

      if (labelEl) labelEl.textContent = 'Соберите греческое слово';
      if (promptEl) promptEl.textContent = formatRuLabel(translation) ?? '—';

      render();

      root.classList.remove('learn-step--enter', 'learn-spell--shake');
      requestAnimationFrame(() => {
        root.classList.add('learn-step--visible');
      });
    }

    return { show };
  }

  global.GreekSpellStep = { init: initSpellStep };
})(window);
