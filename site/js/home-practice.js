(function () {
  const homePage = document.querySelector('.home-page');
  if (!homePage) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  if (!db || !srs || !flash) return;

  const catalogEl = document.getElementById('global-catalog');
  if (!catalogEl) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Global catalog parse error', e);
    return;
  }

  const deckId = catalog.deckId ?? 'global';
  const globalDeckId = db.GLOBAL_DECK_ID ?? 'global';
  const catalogSlugs = catalog.words.map((w) => w.slug);
  const totalFormsByWord = Object.fromEntries(
    catalog.words.map((w) => [w.slug, w.formCount]),
  );

  const btnContinue = document.getElementById('btn-continue');
  const btnPracticeEl = document.getElementById('btn-practice-el');
  const btnPracticeRu = document.getElementById('btn-practice-ru');
  const btnClose = document.getElementById('btn-close-practice');
  const practiceSection = document.getElementById('home-practice');
  const sectionsGrid = document.getElementById('sections-grid');
  const heroActions = document.querySelector('.hero-actions');
  const continueHint = document.getElementById('continue-hint');
  const practiceComplete = document.getElementById('practice-complete');
  const btnRepeatSession = document.getElementById('btn-repeat-session');

  let currentPick = null;
  let practiceDirection = null;
  let fc = null;

  function showRussianFirst() {
    return practiceDirection === 'ru-el';
  }

  function syncPracticeButtons() {
    [btnPracticeEl, btnPracticeRu].forEach((btn) => {
      if (!btn) return;
      const active = btn.getAttribute('data-practice-direction') === practiceDirection;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  const btnForget = practiceControls?.querySelector('.btn-forget');
  const btnRemember = practiceControls?.querySelector('.btn-remember');
  const btnRandom = practiceControls?.querySelector('.btn-random');
  const btnLang = practiceControls?.querySelector('.btn-lang');

  function setPracticeComplete(visible) {
    practiceComplete?.classList.toggle('hidden', !visible);
    practiceComplete?.toggleAttribute('hidden', !visible);
    practiceControls?.classList.toggle('hidden', visible);
    practiceControls?.toggleAttribute('hidden', visible);
  }

  function syncCardDisplay() {
    if (!fc) return;
    fc.startWithRussian = showRussianFirst();
    fc.setLangButton(btnLang);
  }

  function initFlashcard() {
    if (fc) return fc;
    const root = document.getElementById('home-flashcard-root');
    if (!root) return null;
    fc = flash.init({
      root,
      onGrade: (remembered) => {
        gradeAndNext(remembered);
      },
    });
    return fc;
  }

  function greekSummaryLines(word) {
    if (word.baseForms?.length) return word.baseForms;
    if (word.forms?.length) return word.forms.slice(0, 3).map((f) => f.greek);
    return [];
  }

  function showCardContent(pick) {
    if (!fc || !pick) return;
    const word = pick.word;
    const greekLines = greekSummaryLines(word);
    if (showRussianFirst()) {
      fc.showMultiLine([word.translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [word.translation], true, false);
    }
  }

  async function ensurePickCard(pick) {
    const direction = practiceDirection ?? pick.direction ?? 'el-ru';
    return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
      deckId: globalDeckId,
      wordSlug: pick.word.slug,
      type: 'summary',
      direction,
    });
  }

  async function gradeCurrent(remembered) {
    if (!currentPick) return;
    const card = await ensurePickCard(currentPick);
    await db.putCard(srs.gradeCard(card, remembered));
  }

  async function updateContinueHint() {
    if (!continueHint) return;
    const cards = await db.getCardsForSlugs(catalogSlugs);
    const stats = srs.getProgressStats(cards, totalFormsByWord, db);
    let started = 0;
    let mastered = 0;
    for (const slug of catalogSlugs) {
      const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
      if (st.wordPct > 0 || st.formsPct > 0) started += 1;
      if (st.wordPct >= 100 && st.formsPct >= 100) mastered += 1;
    }
    if (started === 0) {
      continueHint.textContent = `${catalog.words.length} слов — начните с первой партии`;
    } else if (mastered === catalogSlugs.length) {
      continueHint.textContent = `Все ${catalogSlugs.length} слов пройдены — можно повторить`;
    } else {
      continueHint.textContent = `Изучено ${mastered} из ${catalogSlugs.length} · в работе ${started}`;
    }
  }

  async function pickAndShowNext() {
    const card = initFlashcard();
    if (!card || !practiceDirection) return;

    setPracticeComplete(false);
    syncCardDisplay();

    try {
      currentPick = await srs.pickNextCard(deckId, catalog, db, {
        summaryOnly: true,
        direction: practiceDirection,
      });
    } catch (err) {
      console.error('Home practice pick error', err);
      currentPick = catalog.words[0]
        ? { word: catalog.words[0], isNew: true, type: 'summary', direction: practiceDirection }
        : null;
    }

    if (!currentPick) {
      card.showPair('—', 'Все слова пройдены!');
      setPracticeComplete(true);
      return;
    }

    showCardContent(currentPick);
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateContinueHint();
    pickAndShowNext();
  }

  function openPractice(direction) {
    const card = initFlashcard();
    if (!card) return;

    practiceDirection = direction;
    db.setSetting('practice:lastDirection', direction);
    syncPracticeButtons();
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    sectionsGrid?.classList.add('hidden');
    heroActions?.classList.add('hidden');
    syncCardDisplay();
    pickAndShowNext();
  }

  function closePractice() {
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    sectionsGrid?.classList.remove('hidden');
    heroActions?.classList.remove('hidden');
    setPracticeComplete(false);
    updateContinueHint();
  }

  async function continuePractice() {
    const last = await db.getSetting('practice:lastDirection', 'el-ru');
    openPractice(last === 'ru-el' ? 'ru-el' : 'el-ru');
  }

  async function repeatSession() {
    if (!practiceDirection) return;
    await srs.resetCatalogSchedule(catalog, db, practiceDirection);
    pickAndShowNext();
  }

  btnContinue?.addEventListener('click', continuePractice);
  btnPracticeEl?.addEventListener('click', () => {
    practiceDirection = 'ru-el';
    db.setSetting('practice:lastDirection', 'ru-el');
    syncPracticeButtons();
  });
  btnPracticeRu?.addEventListener('click', () => {
    practiceDirection = 'el-ru';
    db.setSetting('practice:lastDirection', 'el-ru');
    syncPracticeButtons();
  });
  btnClose?.addEventListener('click', closePractice);
  btnRepeatSession?.addEventListener('click', repeatSession);
  btnRandom?.addEventListener('click', pickAndShowNext);
  btnForget?.addEventListener('click', () => gradeAndNext(false));
  btnRemember?.addEventListener('click', () => gradeAndNext(true));

  db.migrateLegacyCards().then(async () => {
    const last = await db.getSetting('practice:lastDirection', 'el-ru');
    practiceDirection = last === 'ru-el' ? 'ru-el' : 'el-ru';
    syncPracticeButtons();
    updateContinueHint();
  });
})();
