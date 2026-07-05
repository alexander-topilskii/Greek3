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
  const catalogComplete = document.getElementById('practice-catalog-complete');
  const btnRepeatCatalog = document.getElementById('btn-repeat-catalog');
  const btnHomeSettings = document.getElementById('btn-home-settings');
  const settingsDialog = document.getElementById('home-settings-dialog');
  const btnResetAll = document.getElementById('btn-reset-all-progress');
  const inputGroupSize = document.getElementById('home-setting-group-size');
  const btnSaveHomeSettings = document.getElementById('btn-save-home-settings');
  const poolProgressFill = document.getElementById('practice-pool-progress-fill');

  let currentPick = null;
  let fc = null;

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  const btnRandom = practiceControls?.querySelector('.btn-random');

  function directionLabel(direction) {
    return direction === 'ru-el' ? 'Ру → Ελ' : 'Ελ → Ру';
  }

  function setWordSource(word, direction) {
    if (!wordSourceEl) return;
    const source = srs.wordSourceLabel(word, categoryLabels);
    wordSourceEl.textContent = direction
      ? `${source} · ${directionLabel(direction)}`
      : source;
    wordSourceEl.classList.remove('hidden');
    wordSourceEl.removeAttribute('hidden');
  }

  function hideWordSource() {
    wordSourceEl?.classList.add('hidden');
    wordSourceEl?.setAttribute('hidden', '');
  }

  async function syncSessionInfo(settings, cards) {
    if (directionBadge && currentPick?.direction) {
      directionBadge.textContent = directionLabel(currentPick.direction);
    } else if (directionBadge) {
      directionBadge.textContent = 'По словам';
    }
    if (poolHint) {
      const pool = srs.getActivePoolWords(catalog, cards, db, settings);
      const { learned, inProgress, total } = srs.getPoolProgress(pool, cards, db);
      const remaining = total - learned;
      if (learned > 0) {
        poolHint.textContent = `Набор: ${learned}/${total} усвоено · ${inProgress} в работе`;
      } else if (inProgress > 0) {
        poolHint.textContent = `Набор: ${inProgress}/${total} в работе · ${remaining} осталось`;
      } else {
        poolHint.textContent = `Набор: 0/${total} — свайп вправо «Помню»`;
      }
      if (poolProgressFill) {
        const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
        poolProgressFill.style.width = `${pct}%`;
      }
    }
  }

  function hideCompletionPanels() {
    catalogComplete?.classList.add('hidden');
    catalogComplete?.setAttribute('hidden', '');
    practiceControls?.classList.remove('hidden');
    practiceControls?.removeAttribute('hidden');
    sessionBar?.classList.remove('hidden');
    sessionBar?.removeAttribute('hidden');
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

  function syncCardDisplay(pick) {
    if (!fc || !pick) return;
    fc.startWithRussian = pick.direction === 'ru-el';
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
    syncCardDisplay(pick);
    if (pick.direction === 'ru-el') {
      fc.showMultiLine([word.translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [word.translation], true, false);
    }
    setWordSource(word, pick.direction);
  }

  async function ensurePickCard(pick) {
    const direction = pick.direction ?? 'el-ru';
    return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
      deckId: globalDeckId,
      wordSlug: pick.word.slug,
      type: 'summary',
      direction,
    });
  }

  async function gradeCurrent(remembered) {
    if (!currentPick) return;
    const slug = currentPick.word.slug;
    const cardsBefore = await db.getCardsForSlugs(catalogSlugs);
    const wasDone = srs.isWordDoneForPool(slug, cardsBefore, db);

    const card = await ensurePickCard(currentPick);
    const graded = srs.gradeCard(card, remembered);
    await db.putCard(graded);
    await db.flushBackup();
    if (remembered && currentPick.direction) {
      srs.recordSessionCorrect(slug, currentPick.direction);
    }

    if (remembered && !wasDone) {
      const cardsAfter = await db.getCardsForSlugs(catalogSlugs);
      const settings = await srs.loadDeckSettings(deckId, db);
      const hadProgress = cardsBefore.some(
        (c) =>
          c.wordSlug === slug &&
          c.type === 'summary' &&
          ((c.repetitions ?? 0) > 0 || (c.remembered ?? 0) > 0),
      );
      if (!hadProgress) {
        await srs.expandPoolOnFirstTouch(
          deckId,
          catalog,
          db,
          settings,
          slug,
          cardsBefore,
        );
      }
      if (srs.isWordDoneForPool(slug, cardsAfter, db)) {
        await srs.expandPoolOnWordLearned(deckId, catalog, db, settings);
      }
    }
  }

  async function updateContinueHint() {
    if (!continueHint) return;
    const cards = await db.getCardsForSlugs(catalogSlugs);
    const settings = await srs.loadDeckSettings(deckId, db);
    const pool = srs.getActivePoolWords(catalog, cards, db, settings);
    const { learned, inProgress, total } = srs.getPoolProgress(pool, cards, db);

    if (srs.isCatalogFullyMastered(catalog, cards, db)) {
      continueHint.textContent = `Все слова пройдены — можно повторить`;
      return;
    }

    if (learned > 0) {
      continueHint.textContent =
        `В группе ${learned} из ${total} усвоено, ${inProgress} в работе · всего в словаре ${catalogSlugs.length}`;
    } else if (inProgress > 0) {
      continueHint.textContent =
        `В группе ${inProgress} из ${total} в работе · всего в словаре ${catalogSlugs.length}`;
    } else if (total > 0) {
      continueHint.textContent =
        `Группа из ${total} слов · свайп вправо «Помню» после переворота`;
    }
  }

  async function loadHomeSettingsUI() {
    const s = await srs.loadDeckSettings(deckId, db);
    if (inputGroupSize) inputGroupSize.value = String(s.initialBatchSize);
  }

  async function saveHomeSettings() {
    const groupSize = parseInt(inputGroupSize?.value ?? '5', 10);
    const clamped = Math.max(1, Math.min(30, groupSize));
    await srs.saveDeckSettings(deckId, db, {
      initialBatchSize: clamped,
      activeLimit: clamped,
    });
    if (inputGroupSize) inputGroupSize.value = String(clamped);
    settingsDialog?.close();
    await updateContinueHint();
    if (!practiceSection?.classList.contains('hidden')) {
      await pickAndShowNext();
    }
  }

  async function pickAndShowNext() {
    const card = initFlashcard();
    if (!card) return;

    hideCompletionPanels();

    const settings = await srs.loadDeckSettings(deckId, db);
    const cards = await db.getCardsForSlugs(catalogSlugs);
    await syncSessionInfo(settings, cards);

    if (srs.isCatalogFullyMastered(catalog, cards, db)) {
      showCatalogCompleteUI();
      return;
    }

    try {
      currentPick = await srs.pickNextCard(deckId, catalog, db, {
        summaryOnly: true,
        perWordDirection: true,
      });
    } catch (err) {
      console.error('Home practice pick error', err);
      const pool = srs.getActivePoolWords(catalog, cards, db, settings);
      const fallback = pool[0];
      currentPick = fallback
        ? {
            word: fallback,
            isNew: true,
            type: 'summary',
            direction: srs.getWordPracticeDirection(fallback.slug, cards, db) ?? 'el-ru',
          }
        : null;
    }

    if (!currentPick) {
      card.showPair('—', 'Нет слов к повторению — загляните позже');
      hideWordSource();
      return;
    }

    showCardContent(currentPick);
    await syncSessionInfo(settings, cards);
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateContinueHint();
    await pickAndShowNext();
  }

  async function openPractice() {
    const card = initFlashcard();
    if (!card) return;

    try {
      await db.init();
    } catch (err) {
      console.error('Home practice init error', err);
      if (continueHint) {
        continueHint.textContent = 'Не удалось загрузить прогресс — проверьте, что сайт не в режиме инкогнито';
      }
      return;
    }

    await srs.loadRecentPicks(db);
    srs.beginSession();
    hideCompletionPanels();
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    sectionsGrid?.classList.add('hidden');
    heroActions?.classList.add('hidden');
    await pickAndShowNext();
  }

  function closePractice() {
    srs.endSession(db);
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    sectionsGrid?.classList.remove('hidden');
    heroActions?.classList.remove('hidden');
    hideCompletionPanels();
    updateContinueHint();
  }

  async function repeatCatalog() {
    await srs.loadRecentPicks(db);
    srs.beginSession();
    const fullSettings = {
      ...(await srs.loadDeckSettings(deckId, db)),
      activeLimit: catalog.words.length,
    };
    await srs.resetStudyPoolMastery(catalog, db, fullSettings);
    await srs.saveDeckSettings(deckId, db, {
      activeLimit: srs.DEFAULTS.initialBatchSize,
    });
    currentPick = null;
    await updateContinueHint();
    await pickAndShowNext();
  }

  btnContinue?.addEventListener('click', openPractice);
  btnClose?.addEventListener('click', closePractice);
  btnRepeatCatalog?.addEventListener('click', repeatCatalog);
  btnRandom?.addEventListener('click', pickAndShowNext);

  btnHomeSettings?.addEventListener('click', async () => {
    await loadHomeSettingsUI();
    settingsDialog?.showModal();
  });

  btnSaveHomeSettings?.addEventListener('click', saveHomeSettings);

  btnResetAll?.addEventListener('click', async () => {
    if (!confirm('Сбросить весь прогресс? Все выученные слова будут забыты.')) return;
    await db.resetAllProgress();
    currentPick = null;
    await updateContinueHint();
    settingsDialog?.close();
    if (!practiceSection?.classList.contains('hidden')) {
      await pickAndShowNext();
    }
  });

  async function initHomePractice() {
    try {
      await db.init();
      await loadHomeSettingsUI();
      await updateContinueHint();
    } catch (err) {
      console.error('Home practice init error', err);
      if (continueHint) {
        continueHint.textContent = 'Не удалось загрузить прогресс — проверьте, что сайт не в режиме инкогнито';
      }
    }
  }

  initHomePractice();
})();
