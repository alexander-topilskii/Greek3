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
  } catch {
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

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    updateProgressUI();
    pickAndShowNext();
  }

  const fc = flash.init({
    root: document.getElementById('list-flashcard-root'),
    onGrade: (remembered) => {
      gradeAndNext(remembered);
    },
  });

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
    const stats = srs.getProgressStats(cards, totalFormsByWord);

    document.querySelectorAll('[data-progress-slug]').forEach((el) => {
      const slug = el.getAttribute('data-progress-slug');
      if (!slug) return;
      const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
      const wordFill = el.querySelector('.progress-word');
      const formsFill = el.querySelector('.progress-forms');
      if (wordFill) wordFill.style.width = `${st.wordPct}%`;
      if (formsFill) formsFill.style.width = `${st.formsPct}%`;
    });
  }

  function showCardContent(pick) {
    if (!pick) return;
    const word = pick.word;

    if (pick.type === 'summary' || pick.isNew || (pick.card && pick.card.type === 'summary')) {
      const greekLines = word.baseForms?.length ? word.baseForms : [];
      if (startWithRussian) {
        fc.showMultiLine([word.translation], greekLines, false, true);
      } else {
        fc.showMultiLine(greekLines, [word.translation], true, false);
      }
      return;
    }

    const formIndex = pick.formIndex ?? pick.card?.formIndex ?? 0;
    const form = word.forms?.[formIndex];
    if (form) fc.showPair(form.greek, form.translation);
  }

  async function ensurePickCard(pick) {
    if (pick.isNew) {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary'), {
        deckId,
        wordSlug: pick.word.slug,
        type: 'summary',
      });
    }
    if (pick.card) return pick.card;
    if (pick.type === 'summary') {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary'), {
        deckId,
        wordSlug: pick.word.slug,
        type: 'summary',
      });
    }
    const idx = pick.formIndex ?? 0;
    return db.getOrCreateCard(db.cardId(pick.word.slug, 'form', idx), {
      deckId,
      wordSlug: pick.word.slug,
      type: 'form',
      formIndex: idx,
    });
  }

  async function gradeCurrent(remembered) {
    if (!currentPick) return;
    const card = await ensurePickCard(currentPick);
    await db.putCard(srs.gradeCard(card, remembered));
  }

  async function pickAndShowNext() {
    currentPick = await srs.pickNextCard(deckId, catalog, db, { summaryOnly: true });
    if (!currentPick) {
      fc.showPair('—', 'Все карточки изучены! Загляните позже.');
      return;
    }
    showCardContent(currentPick);
  }

  function openPractice() {
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    linksSection?.classList.add('hidden');
    btnPractice?.classList.add('hidden');
    pickAndShowNext();
  }

  function closePractice() {
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    linksSection?.classList.remove('hidden');
    btnPractice?.classList.remove('hidden');
  }

  btnPractice?.addEventListener('click', openPractice);
  btnClose?.addEventListener('click', closePractice);

  btnRandom?.addEventListener('click', pickAndShowNext);
  btnLang?.addEventListener('click', () => {
    startWithRussian = fc.toggleLang(btnLang);
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
    if (!confirm('Сбросить весь прогресс по глаголам?')) return;
    await db.deleteDeckCards(deckId);
    await db.setSetting(`deck:${deckId}:activeLimit`, parseInt(inputInitial?.value ?? '5', 10));
    updateProgressUI();
    if (!practiceSection?.classList.contains('hidden')) pickAndShowNext();
  });

  fc.setLangButton(btnLang);
  loadSettingsUI();
  updateProgressUI();
})();
