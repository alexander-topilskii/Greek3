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
  const categoryLabels = catalog.categoryLabels ?? {};
  const catalogSlugs = catalog.words.map((w) => w.slug);
  const totalFormsByWord = Object.fromEntries(
    catalog.words.map((w) => [w.slug, w.formCount]),
  );

  const btnContinue = document.getElementById('btn-continue');
  const btnClose = document.getElementById('btn-close-practice');
  const practiceSection = document.getElementById('home-practice');
  const sectionsGrid = document.getElementById('sections-grid');
  const heroActions = document.querySelector('.hero-actions');
  const continueHint = document.getElementById('continue-hint');
  const directionBadge = document.getElementById('practice-direction-badge');
  const poolHint = document.getElementById('practice-pool-hint');
  const wordSourceEl = document.getElementById('practice-word-source');
  const sessionBar = document.getElementById('practice-session-bar');
  const blockComplete = document.getElementById('practice-block-complete');
  const blockCompleteText = document.getElementById('practice-block-complete-text');
  const btnRepeatBlock = document.getElementById('btn-repeat-block');
  const btnAddWords = document.getElementById('btn-add-words');
  const catalogComplete = document.getElementById('practice-catalog-complete');
  const btnRepeatCatalog = document.getElementById('btn-repeat-catalog');
  const btnHomeSettings = document.getElementById('btn-home-settings');
  const settingsDialog = document.getElementById('home-settings-dialog');
  const btnResetAll = document.getElementById('btn-reset-all-progress');

  let currentPick = null;
  let practiceDirection = 'el-ru';
  let fc = null;

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  const btnRandom = practiceControls?.querySelector('.btn-random');

  function directionLabel(direction) {
    return direction === 'ru-el' ? 'Ру → Ελ' : 'Ελ → Ру';
  }

  function showRussianFirst() {
    return practiceDirection === 'ru-el';
  }

  function setWordSource(word) {
    if (!wordSourceEl) return;
    const label = srs.wordSourceLabel(word, categoryLabels);
    wordSourceEl.textContent = label;
    wordSourceEl.classList.remove('hidden');
    wordSourceEl.removeAttribute('hidden');
  }

  function hideWordSource() {
    wordSourceEl?.classList.add('hidden');
    wordSourceEl?.setAttribute('hidden', '');
  }

  function syncSessionInfo(settings) {
    if (directionBadge) {
      directionBadge.textContent = directionLabel(practiceDirection);
    }
    if (poolHint) {
      const poolSize = srs.getStudyPoolWords(catalog, settings).length;
      poolHint.textContent = `${poolSize} слов в наборе`;
    }
  }

  function hideCompletionPanels() {
    blockComplete?.classList.add('hidden');
    blockComplete?.setAttribute('hidden', '');
    catalogComplete?.classList.add('hidden');
    catalogComplete?.setAttribute('hidden', '');
    practiceControls?.classList.remove('hidden');
    practiceControls?.removeAttribute('hidden');
    sessionBar?.classList.remove('hidden');
    sessionBar?.removeAttribute('hidden');
  }

  function showBlockCompleteUI(settings) {
    const poolSize = srs.getStudyPoolWords(catalog, settings).length;
    if (blockCompleteText) {
      blockCompleteText.textContent =
        `Набор из ${poolSize} слов выучен в обоих направлениях. Что дальше?`;
    }
    if (btnAddWords) {
      const canExpand = srs.canExpandStudyPool(settings, catalog);
      btnAddWords.classList.toggle('hidden', !canExpand);
      btnAddWords.toggleAttribute('hidden', !canExpand);
    }
    blockComplete?.classList.remove('hidden');
    blockComplete?.removeAttribute('hidden');
    practiceControls?.classList.add('hidden');
    practiceControls?.setAttribute('hidden', '');
    hideWordSource();
    sessionBar?.classList.add('hidden');
    sessionBar?.setAttribute('hidden', '');
    const card = initFlashcard();
    card?.showPair('—', 'Блок выучен!');
  }

  function showCatalogCompleteUI() {
    catalogComplete?.classList.remove('hidden');
    catalogComplete?.removeAttribute('hidden');
    practiceControls?.classList.add('hidden');
    practiceControls?.setAttribute('hidden', '');
    hideWordSource();
    sessionBar?.classList.add('hidden');
    sessionBar?.setAttribute('hidden', '');
    const card = initFlashcard();
    card?.showPair('—', 'Все слова пройдены!');
  }

  function syncCardDisplay() {
    if (!fc) return;
    fc.startWithRussian = showRussianFirst();
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
    setWordSource(word);
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

  async function resolveDirection(settings, cards) {
    practiceDirection = srs.resolveAutoDirection(catalog, cards, db, settings);
    syncSessionInfo(settings);
  }

  async function updateContinueHint() {
    if (!continueHint) return;
    const cards = await db.getCardsForSlugs(catalogSlugs);
    const settings = await srs.loadDeckSettings(deckId, db);
    const stats = srs.getProgressStats(cards, totalFormsByWord, db);
    const poolSize = srs.getStudyPoolWords(catalog, settings).length;
    let started = 0;
    let mastered = 0;
    for (const slug of catalogSlugs) {
      const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
      if (st.wordPct > 0 || st.formsPct > 0) started += 1;
      if (st.wordPct >= 100 && st.formsPct >= 100) mastered += 1;
    }
    if (started === 0) {
      continueHint.textContent =
        `${poolSize} слов в первом наборе · сначала Ελ → Ру, затем Ру → Ελ`;
    } else if (mastered === catalogSlugs.length) {
      continueHint.textContent = `Все ${catalogSlugs.length} слов пройдены — можно повторить`;
    } else {
      continueHint.textContent =
        `Изучено ${mastered} из ${catalogSlugs.length} · в наборе ${poolSize} слов`;
    }
  }

  async function pickAndShowNext() {
    const card = initFlashcard();
    if (!card) return;

    hideCompletionPanels();

    const settings = await srs.loadDeckSettings(deckId, db);
    const cards = await db.getCardsForSlugs(catalogSlugs);
    await resolveDirection(settings, cards);

    if (srs.isStudyPoolFullyMastered(catalog, cards, db, settings)) {
      if (!srs.canExpandStudyPool(settings, catalog)) {
        showCatalogCompleteUI();
      } else {
        showBlockCompleteUI(settings);
      }
      return;
    }

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
      const refreshedCards = await db.getCardsForSlugs(catalogSlugs);
      const newDir = srs.resolveAutoDirection(catalog, refreshedCards, db, settings);
      if (newDir !== practiceDirection) {
        practiceDirection = newDir;
        syncSessionInfo(settings);
        return pickAndShowNext();
      }
      card.showPair('—', 'Нет слов к повторению — загляните позже');
      hideWordSource();
      return;
    }

    showCardContent(currentPick);
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateContinueHint();

    const settings = await srs.loadDeckSettings(deckId, db);
    const cards = await db.getCardsForSlugs(catalogSlugs);

    if (srs.isStudyPoolFullyMastered(catalog, cards, db, settings)) {
      if (!srs.canExpandStudyPool(settings, catalog)) {
        showCatalogCompleteUI();
      } else {
        showBlockCompleteUI(settings);
      }
      return;
    }

    const prevDir = practiceDirection;
    await resolveDirection(settings, cards);
    if (prevDir === 'el-ru' && practiceDirection === 'ru-el') {
      // Набор выучен с греческого — автоматически переключаемся на русский.
    }

    await pickAndShowNext();
  }

  async function openPractice() {
    const card = initFlashcard();
    if (!card) return;

    hideCompletionPanels();
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    sectionsGrid?.classList.add('hidden');
    heroActions?.classList.add('hidden');
    syncCardDisplay();
    await pickAndShowNext();
  }

  function closePractice() {
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    sectionsGrid?.classList.remove('hidden');
    heroActions?.classList.remove('hidden');
    hideCompletionPanels();
    updateContinueHint();
  }

  async function repeatBlock() {
    const settings = await srs.loadDeckSettings(deckId, db);
    await srs.repeatStudyPool(deckId, catalog, db, settings);
    practiceDirection = 'el-ru';
    await pickAndShowNext();
  }

  async function addWordsToSet() {
    const settings = await srs.loadDeckSettings(deckId, db);
    await srs.expandStudyPool(deckId, catalog, db, settings);
    practiceDirection = 'el-ru';
    await pickAndShowNext();
  }

  async function repeatCatalog() {
    const fullSettings = {
      ...(await srs.loadDeckSettings(deckId, db)),
      activeLimit: catalog.words.length,
    };
    await srs.resetStudyPoolMastery(catalog, db, fullSettings);
    await srs.saveDeckSettings(deckId, db, {
      activeLimit: srs.DEFAULTS.initialBatchSize,
    });
    practiceDirection = 'el-ru';
    await updateContinueHint();
    await pickAndShowNext();
  }

  btnContinue?.addEventListener('click', openPractice);
  btnClose?.addEventListener('click', closePractice);
  btnRepeatBlock?.addEventListener('click', repeatBlock);
  btnAddWords?.addEventListener('click', addWordsToSet);
  btnRepeatCatalog?.addEventListener('click', repeatCatalog);
  btnRandom?.addEventListener('click', pickAndShowNext);

  btnHomeSettings?.addEventListener('click', () => {
    settingsDialog?.showModal();
  });

  btnResetAll?.addEventListener('click', async () => {
    if (!confirm('Сбросить весь прогресс? Все выученные слова будут забыты.')) return;
    await db.resetAllProgress();
    practiceDirection = 'el-ru';
    currentPick = null;
    await updateContinueHint();
    settingsDialog?.close();
    if (!practiceSection?.classList.contains('hidden')) {
      await pickAndShowNext();
    }
  });

  async function initHomePractice() {
    try {
      await updateContinueHint();
      await db.migrateLegacyCards();
      await updateContinueHint();
    } catch (err) {
      console.error('Home practice init error', err);
      if (continueHint) {
        continueHint.textContent = 'Не удалось загрузить прогресс';
      }
    }
  }

  initHomePractice();
})();
