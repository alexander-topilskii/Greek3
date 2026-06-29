(function () {
  const listPage = document.querySelector('.verbs-list-page');
  if (!listPage) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  if (!db || !srs || !flash) return;

  const catalogEl = document.getElementById('verbs-catalog');
  if (!catalogEl) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Catalog parse error', e);
    return;
  }

  const deckId = catalog.deckId ?? listPage.getAttribute('data-deck-id') ?? 'verbs';
  const totalFormsByWord = Object.fromEntries(
    catalog.words.map((w) => [w.slug, w.formCount]),
  );

  const btnPractice = document.getElementById('btn-practice-all');
  const btnClose = document.getElementById('btn-close-practice');
  const practiceSection = document.getElementById('list-practice');
  const linksSection = document.getElementById('verbs-links');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnResetDeck = document.getElementById('btn-reset-deck');
  const inputInitial = document.getElementById('setting-initial-batch');
  const inputActive = document.getElementById('setting-active-limit');

  let currentPick = null;
  let startWithRussian = false;
  let fc = null;

  function initFlashcard() {
    if (fc) return fc;
    const root = document.getElementById('list-flashcard-root');
    if (!root) return null;
    fc = flash.init({
      root,
      onGrade: (remembered) => {
        gradeAndNext(remembered);
      },
    });
    return fc;
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateProgressUI();
    pickAndShowNext();
  }

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  const btnForget = practiceControls?.querySelector('.btn-forget');
  const btnRemember = practiceControls?.querySelector('.btn-remember');
  const btnRandom = practiceControls?.querySelector('.btn-random');
  const btnLang = practiceControls?.querySelector('.btn-lang');

  async function loadSettingsUI() {
    const s = await srs.loadDeckSettings(deckId, db);
    if (inputInitial) inputInitial.value = String(s.initialBatchSize);
    if (inputActive) inputActive.value = String(s.activeLimit);
  }

  async function updateProgressUI() {
    const cards = await db.getDeckCards(deckId);
    const stats = srs.getProgressStats(cards, totalFormsByWord, db);

    document.querySelectorAll('[data-progress-slug]').forEach((el) => {
      const slug = el.getAttribute('data-progress-slug');
      if (!slug) return;
      const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
      srs.applyProgressBar(el, st.wordPct, st.formsPct);
    });

    sortWordLinks(stats, cards);
  }

  /** Lower rank = higher in list (unknown first, mastered last). */
  function wordSortRank(slug, stats, cards) {
    const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
    const combined = (st.wordPct + st.formsPct) / 2;
    const elRu = cards.find(
      (c) =>
        c.wordSlug === slug &&
        c.type === 'summary' &&
        (c.direction ?? 'el-ru') === 'el-ru',
    );
    const ruEl = cards.find(
      (c) => c.wordSlug === slug && c.type === 'summary' && c.direction === 'ru-el',
    );
    const hasAny = (elRu?.repetitions ?? 0) > 0 || (ruEl?.repetitions ?? 0) > 0;

    if (!elRu && !ruEl) return combined;
    if (!hasAny) return combined;
    if (elRu && ruEl && srs.isMastered(elRu) && srs.isMastered(ruEl)) {
      return 20000 + combined;
    }
    return 1000 + combined;
  }

  function sortWordLinks(stats, cards) {
    document.querySelectorAll('.links-group-items').forEach((container) => {
      const links = [...container.querySelectorAll('.word-link[data-word-slug]')].filter(
        (el) => el.getAttribute('data-word-slug'),
      );
      if (links.length < 2) return;

      links.sort((a, b) => {
        const slugA = a.getAttribute('data-word-slug');
        const slugB = b.getAttribute('data-word-slug');
        const diff = wordSortRank(slugA, stats, cards) - wordSortRank(slugB, stats, cards);
        if (diff !== 0) return diff;
        return (a.querySelector('.word-link-label')?.textContent ?? '').localeCompare(
          b.querySelector('.word-link-label')?.textContent ?? '',
          'ru',
        );
      });

      links.forEach((link) => container.appendChild(link));
    });
  }

  function greekSummaryLines(word) {
    if (word.baseForms?.length) return word.baseForms;
    if (word.forms?.length) return word.forms.slice(0, 3).map((f) => f.greek);
    return [];
  }

  function showCardContent(pick) {
    if (!fc || !pick) return;
    const word = pick.word;

    if (pick.type === 'summary' || pick.isNew || (pick.card && pick.card.type === 'summary')) {
      const greekLines = greekSummaryLines(word);
      if (startWithRussian) {
        fc.showMultiLine([word.translation], greekLines, false, true);
      } else {
        fc.showMultiLine(greekLines, [word.translation], true, false);
      }
      return;
    }

    const formIndex = pick.formIndex ?? pick.card?.formIndex ?? 0;
    const form = word.forms?.[formIndex];
    if (form) {
      fc.showPair(form.greek, form.translation);
      return;
    }

    const greekLines = greekSummaryLines(word);
    if (startWithRussian) {
      fc.showMultiLine([word.translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [word.translation], true, false);
    }
  }

  async function ensurePickCard(pick) {
    const direction =
      pick.direction ?? (startWithRussian ? 'ru-el' : 'el-ru');

    if (pick.isNew) {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
        deckId,
        wordSlug: pick.word.slug,
        type: 'summary',
        direction,
      });
    }
    if (pick.card) return pick.card;
    if (pick.type === 'summary') {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
        deckId,
        wordSlug: pick.word.slug,
        type: 'summary',
        direction,
      });
    }
    const idx = pick.formIndex ?? 0;
    return db.getOrCreateCard(db.cardId(pick.word.slug, 'form', idx, direction), {
      deckId,
      wordSlug: pick.word.slug,
      type: 'form',
      formIndex: idx,
      direction,
    });
  }

  async function gradeCurrent(remembered) {
    if (!currentPick) return;
    const card = await ensurePickCard(currentPick);
    await db.putCard(srs.gradeCard(card, remembered));
  }

  async function pickAndShowNext() {
    const card = initFlashcard();
    if (!card) return;

    try {
      currentPick = await srs.pickNextCard(deckId, catalog, db, { summaryOnly: true });
      const s = await srs.loadDeckSettings(deckId, db);
      if (inputActive) inputActive.value = String(s.activeLimit);
    } catch (err) {
      console.error('Practice pick error', err);
      currentPick = catalog.words[0]
        ? { word: catalog.words[0], isNew: true, type: 'summary', direction: 'el-ru' }
        : null;
    }

    if (!currentPick) {
      card.showPair('—', 'Весь словарь пройден. Повторения — по расписанию, загляните позже.');
      return;
    }

    const direction = currentPick.direction ?? 'el-ru';
    startWithRussian = direction === 'ru-el';
    card.startWithRussian = startWithRussian;
    card.setLangButton(btnLang);
    showCardContent(currentPick);
  }

  function openPractice() {
    const card = initFlashcard();
    if (!card) return;

    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    linksSection?.classList.add('hidden');
    btnPractice?.classList.add('hidden');
    card.setLangButton(btnLang);
    pickAndShowNext();
  }

  function closePractice() {
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    linksSection?.classList.remove('hidden');
    btnPractice?.classList.remove('hidden');
    updateProgressUI();
  }

  btnPractice?.addEventListener('click', openPractice);
  btnClose?.addEventListener('click', closePractice);

  btnRandom?.addEventListener('click', pickAndShowNext);
  btnLang?.addEventListener('click', () => {
    const card = initFlashcard();
    if (!card) return;
    startWithRussian = card.toggleLang(btnLang);
    if (currentPick) showCardContent(currentPick);
  });

  btnForget?.addEventListener('click', () => gradeAndNext(false));
  btnRemember?.addEventListener('click', () => gradeAndNext(true));

  btnSaveSettings?.addEventListener('click', async () => {
    await srs.saveDeckSettings(deckId, db, {
      initialBatchSize: parseInt(inputInitial?.value ?? '5', 10),
      activeLimit: parseInt(inputActive?.value ?? '5', 10),
    });
    await loadSettingsUI();
    updateProgressUI();
  });

  btnResetDeck?.addEventListener('click', async () => {
    if (!confirm('Сбросить весь прогресс по этому разделу?')) return;
    await db.deleteDeckCards(deckId);
    await db.setSetting(`deck:${deckId}:activeLimit`, parseInt(inputInitial?.value ?? '5', 10));
    updateProgressUI();
    if (!practiceSection?.classList.contains('hidden')) pickAndShowNext();
  });

  db.migrateLegacyCards().then(() => {
    loadSettingsUI();
    updateProgressUI();
  });
})();
