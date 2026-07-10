(function (global) {
  const ladder = () => global.GreekLearningLadder;

  /**
   * Tap-to-match pairs step.
   * opts: { root, onResult(correct: boolean) }
   */
  function initMatchStep(opts) {
    const root = opts.root;
    if (!root) return null;

    const cardEl = root.querySelector('.learn-step-card');
    const greekCol = root.querySelector('[data-match-greek]');
    const ruCol = root.querySelector('[data-match-ru]');
    const pairsZone = root.querySelector('[data-match-pairs]');
    const feedbackEl = root.querySelector('[data-match-feedback]');
    const speak = global.GreekSpeak;
    const utils = global.GreekUtils;

    let locked = false;
    let pairs = [];
    let ruForms = [];
    let matchedCount = 0;
    let matchedPairIds = new Set();
    let selectedGreek = null;
    let selectedRu = null;

    function clearCardState() {
      cardEl?.classList.remove('learn-step-card--success', 'learn-step-card--error');
    }

    function hideFeedback() {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.className = 'learn-match-feedback';
      feedbackEl.textContent = '';
    }

    function formatRuLabel(text) {
      if (!text || !utils?.formatRuForChoice) return text;
      return utils.formatRuForChoice(text, ruForms);
    }

    function makeChip(text, side, id, isGreek) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `learn-match-chip learn-match-chip--${side}${isGreek ? ' greek' : ''}`;
      btn.dataset.matchId = String(id);
      btn.dataset.matchSide = side;
      if (!isGreek) btn.dataset.matchRu = text;
      btn.textContent = isGreek ? text : formatRuLabel(text);
      return btn;
    }

    function renderColumns() {
      if (!greekCol || !ruCol) return;
      greekCol.innerHTML = '';
      ruCol.innerHTML = '';

      const greekItems = ladder().shuffle(pairs.map((p, i) => ({ ...p, id: i })));
      const ruItems = ladder().shuffle(pairs.map((p, i) => ({ ...p, id: i })));

      for (const item of greekItems) {
        greekCol.appendChild(makeChip(item.greek, 'greek', item.id, true));
      }
      for (const item of ruItems) {
        ruCol.appendChild(makeChip(item.translation, 'ru', item.id, false));
      }
    }

    function clearSelection() {
      selectedGreek = null;
      selectedRu = null;
      root.querySelectorAll('.learn-match-chip--selected').forEach((el) => {
        el.classList.remove('learn-match-chip--selected');
      });
    }

    function lockChip(btn) {
      btn.classList.remove('learn-match-chip--selected');
      btn.classList.add('learn-match-chip--locked');
      btn.disabled = true;
    }

    function addMatchedRow(greek, translation) {
      if (!pairsZone) return;
      const row = document.createElement('div');
      row.className = 'learn-match-pair-row learn-match-pair-row--enter';
      row.innerHTML = `
        <span class="learn-match-pair-greek greek">${ladder().escapeHtml(greek)}</span>
        <span class="learn-match-pair-arrow" aria-hidden="true">↔</span>
        <span class="learn-match-pair-ru">${ladder().escapeHtml(formatRuLabel(translation))}</span>`;
      pairsZone.appendChild(row);
      requestAnimationFrame(() => row.classList.add('learn-match-pair-row--visible'));
    }

    function findPairIndex(greekText, ruText) {
      return pairs.findIndex(
        (pair, index) =>
          !matchedPairIds.has(index) &&
          pair.greek === greekText &&
          pair.translation === ruText,
      );
    }

    function tryPair() {
      if (selectedGreek == null || selectedRu == null) return;

      const greekBtn = greekCol?.querySelector(`[data-match-id="${selectedGreek}"]`);
      const ruBtn = ruCol?.querySelector(`[data-match-id="${selectedRu}"]`);
      const greekText = greekBtn?.textContent?.trim() ?? '';
      const ruText = ruBtn?.dataset.matchRu?.trim() ?? ruBtn?.textContent?.trim() ?? '';
      const pairIndex = findPairIndex(greekText, ruText);

      if (pairIndex >= 0) {
        const pair = pairs[pairIndex];
        matchedPairIds.add(pairIndex);
        lockChip(greekBtn);
        lockChip(ruBtn);
        addMatchedRow(pair.greek, pair.translation);
        matchedCount += 1;
        clearSelection();

        if (matchedCount >= pairs.length) {
          locked = true;
          cardEl?.classList.add('learn-step-card--success');
          global.setTimeout(() => opts.onResult?.(true), 700);
        }
        return;
      }

      root.classList.add('learn-match--shake');
      greekBtn?.classList.add('learn-match-chip--wrong');
      ruBtn?.classList.add('learn-match-chip--wrong');
      global.setTimeout(() => {
        root.classList.remove('learn-match--shake');
        greekBtn?.classList.remove('learn-match-chip--wrong');
        ruBtn?.classList.remove('learn-match-chip--wrong');
        clearSelection();
      }, 450);
    }

    function onChipClick(e) {
      if (locked) return;
      const btn = e.target.closest('.learn-match-chip');
      if (!btn || btn.disabled || btn.classList.contains('learn-match-chip--locked')) return;

      const side = btn.dataset.matchSide;
      const id = Number(btn.dataset.matchId);

      if (side === 'greek') {
        const greekText = btn.textContent?.trim();
        if (greekText && speak?.isSupported?.()) speak.speakGreek(greekText);

        if (selectedGreek === id) {
          btn.classList.remove('learn-match-chip--selected');
          selectedGreek = null;
          return;
        }
        greekCol?.querySelectorAll('.learn-match-chip--selected').forEach((el) => {
          el.classList.remove('learn-match-chip--selected');
        });
        selectedGreek = id;
        btn.classList.add('learn-match-chip--selected');
      } else {
        if (selectedRu === id) {
          btn.classList.remove('learn-match-chip--selected');
          selectedRu = null;
          return;
        }
        ruCol?.querySelectorAll('.learn-match-chip--selected').forEach((el) => {
          el.classList.remove('learn-match-chip--selected');
        });
        selectedRu = id;
        btn.classList.add('learn-match-chip--selected');
      }

      tryPair();
    }

    greekCol?.addEventListener('click', onChipClick);
    ruCol?.addEventListener('click', onChipClick);

    function show({ matchPairs }) {
      locked = false;
      matchedCount = 0;
      matchedPairIds = new Set();
      pairs = matchPairs ?? [];
      ruForms = pairs.map((p) => p.translation).filter(Boolean);
      selectedGreek = null;
      selectedRu = null;
      clearCardState();
      hideFeedback();

      if (pairsZone) pairsZone.innerHTML = '';
      renderColumns();

      root.classList.remove('learn-step--enter');
      requestAnimationFrame(() => {
        root.classList.add('learn-step--visible');
      });
    }

    return { show };
  }

  global.GreekMatchStep = { init: initMatchStep };
})(window);
