(function (global) {
  const schedule = global.GreekSRSSchedule;
  const session = global.GreekSRSSession;
  const progress = global.GreekSRSProgress;
  const pickMod = global.GreekSRSPick;

  const {
    DEFAULTS,
    DIRECTIONS,
    DIRECTION_REP_FACTOR,
    gradeCard: scheduleGradeCard,
    isDue,
    isMastered,
    isLearning,
    getSummaryCard,
    statsForWord,
    masteryThreshold,
    isWordFullyDoneGlobal,
  } = schedule;

  const {
    beginSession,
    endSession,
    loadRecentPicks,
    isSessionActive,
    recordSessionCorrect,
    recordRecentPick,
    isPickTooSoon,
    getSessionCorrect,
    isSessionSatisfied,
    poolSessionSatisfiedInDirection,
    isWordDoneForPool,
  } = session;

  const {
    applyProgressBar,
    getProgressStats,
    countPoolLearned,
    isWordInProgress,
    countPoolInProgress,
    getPoolProgress,
    getWordPoolDotState: progressGetWordPoolDotState,
    getPoolDots: progressGetPoolDots,
  } = progress;

  function gradeCard(card, remembered) {
    return scheduleGradeCard(card, remembered, isSessionActive());
  }

  function getActivePoolWords(catalog, cards, db, settings) {
    const limit = Math.min(settings.activeLimit, catalog.words.length);
    const pool = [];
    for (const word of catalog.words) {
      if (pool.length >= limit) break;
      if (isWordDoneForPool(word.slug, cards, db)) continue;
      pool.push(word);
    }
    return pool;
  }

  function getWordPracticeDirection(slug, cards, db, now = Date.now()) {
    const elRu = getSummaryCard(cards, slug, 'el-ru', db);
    const ruEl = getSummaryCard(cards, slug, 'ru-el', db);

    if (isSessionActive()) {
      const elRuMastered = elRu && isMastered(elRu);
      const elRuDoneThisSession = isSessionSatisfied(slug, 'el-ru', cards, db, now);

      if (!elRuMastered && !elRuDoneThisSession) {
        return 'el-ru';
      }

      const canPracticeRuEl = elRuMastered || elRuDoneThisSession;
      if (canPracticeRuEl && !isSessionSatisfied(slug, 'ru-el', cards, db, now)) {
        if (!ruEl || !isMastered(ruEl)) return 'ru-el';
        if (isDue(ruEl, now)) return 'ru-el';
      }

      if (elRuMastered && !elRuDoneThisSession && isDue(elRu, now)) {
        return 'el-ru';
      }

      return null;
    }

    if (!elRu || !isMastered(elRu)) return 'el-ru';
    if (!ruEl || !isMastered(ruEl)) return 'ru-el';
    return null;
  }

  function wordsInBlock(catalog, blockIndex) {
    return catalog.words.filter((w) => (w.blockIndex ?? 0) === blockIndex);
  }

  function blockElRuComplete(block, cards, db) {
    return block.every((w) => {
      const card = getSummaryCard(cards, w.slug, 'el-ru', db);
      return card && isMastered(card);
    });
  }

  function blockRuElComplete(block, cards, db) {
    return block.every((w) => {
      const card = getSummaryCard(cards, w.slug, 'ru-el', db);
      return card && isMastered(card);
    });
  }

  function findBlockDirectionPrompt(catalog, cards, db, dismissedBlocks) {
    const blockIndices = [
      ...new Set(catalog.words.map((w) => w.blockIndex ?? 0)),
    ].sort((a, b) => a - b);

    for (const bi of blockIndices) {
      if (dismissedBlocks.has(bi)) continue;
      const block = wordsInBlock(catalog, bi);
      if (!block.length) continue;
      if (!blockElRuComplete(block, cards, db)) continue;
      if (blockRuElComplete(block, cards, db)) continue;
      return { blockIndex: bi, wordCount: block.length };
    }
    return null;
  }

  function isCatalogFullyMastered(catalog, cards, db) {
    return catalog.words.every((w) => isWordFullyDoneGlobal(w.slug, cards, db));
  }

  function poolMasteredInDirection(poolWords, cards, db, direction) {
    if (!poolWords.length) return false;
    return poolWords.every((w) => {
      const card = getSummaryCard(cards, w.slug, direction, db);
      return card && isMastered(card);
    });
  }

  function poolDoneInDirection(poolWords, cards, db, direction) {
    if (isSessionActive()) {
      return poolSessionSatisfiedInDirection(poolWords, direction, cards, db);
    }
    return poolMasteredInDirection(poolWords, cards, db, direction);
  }

  function resolveAutoDirection(catalog, cards, db, settings) {
    const pool = getActivePoolWords(catalog, cards, db, settings);
    if (!poolDoneInDirection(pool, cards, db, 'el-ru')) return 'el-ru';
    if (!poolDoneInDirection(pool, cards, db, 'ru-el')) return 'ru-el';
    return 'el-ru';
  }

  function wordSourceLabel(word, categoryLabels = {}) {
    if (word.lesson != null) return `Урок ${word.lesson}`;
    const cat = categoryLabels[word.category] ?? word.category;
    return cat || 'Словарь';
  }

  const pickHelpers = {
    getActivePoolWords,
    getWordPracticeDirection,
    loadDeckSettings,
    isCatalogFullyMastered,
  };

  async function pickNextCard(deckId, catalog, db, options = {}) {
    return pickMod.pickNextCard(deckId, catalog, db, options, pickHelpers);
  }

  function getPoolEnd(settings, catalog, cards, db) {
    return getActivePoolWords(catalog, cards, db, settings).length;
  }

  function canExpandActiveLimit(settings, catalog) {
    return settings.activeLimit < catalog.words.length;
  }

  function getStudyPoolWords(catalog, settings, cards, db) {
    if (cards && db) {
      return getActivePoolWords(catalog, cards, db, settings);
    }
    const limit = Math.min(settings.activeLimit, catalog.words.length);
    return catalog.words.slice(0, limit);
  }

  function isStudyPoolFullyMastered(catalog, cards, db) {
    return isCatalogFullyMastered(catalog, cards, db);
  }

  function canExpandStudyPool(settings, catalog) {
    return settings.activeLimit < catalog.words.length;
  }

  async function resetCatalogSchedule(catalog, db, direction, now = Date.now()) {
    const slugs = new Set(catalog.words.map((w) => w.slug));
    const cards = (await db.getAllCards()).filter((c) => slugs.has(c.wordSlug));
    const resetIds = new Set();

    for (const card of cards) {
      if (card.type !== 'summary') continue;
      if (schedule.cardDirection(card) !== direction) continue;
      resetIds.add(card.id);
      await db.putCard({ ...card, nextReview: now, deckId: db.GLOBAL_DECK_ID });
    }

    for (const word of catalog.words) {
      const id = db.cardId(word.slug, 'summary', null, direction);
      if (resetIds.has(id)) continue;
      const card = await db.getOrCreateCard(id, {
        deckId: db.GLOBAL_DECK_ID,
        wordSlug: word.slug,
        type: 'summary',
        direction,
      });
      await db.putCard({ ...card, nextReview: now, deckId: db.GLOBAL_DECK_ID });
    }
  }

  async function repeatCatalogSession(deckId, catalog, db, direction) {
    await resetCatalogSchedule(catalog, db, direction);
    await saveDeckSettings(deckId, db, { activeLimit: catalog.words.length });
  }

  async function resetStudyPoolMastery(catalog, db, settings, now = Date.now()) {
    const allCards = await db.getAllCards();
    const pool = getActivePoolWords(catalog, allCards, db, settings);
    const slugs = new Set(pool.map((w) => w.slug));
    const poolCards = allCards.filter((c) => slugs.has(c.wordSlug));

    for (const card of poolCards) {
      if (card.type !== 'summary') continue;
      await db.putCard({
        ...card,
        repetitions: 0,
        remembered: 0,
        forgotten: 0,
        nextReview: now,
        interval: 0,
        deckId: db.GLOBAL_DECK_ID,
      });
    }

    for (const word of pool) {
      for (const direction of DIRECTIONS) {
        const id = db.cardId(word.slug, 'summary', null, direction);
        if (poolCards.some((c) => c.id === id)) continue;
        const card = await db.getOrCreateCard(id, {
          deckId: db.GLOBAL_DECK_ID,
          wordSlug: word.slug,
          type: 'summary',
          direction,
        });
        await db.putCard({
          ...card,
          repetitions: 0,
          remembered: 0,
          forgotten: 0,
          nextReview: now,
          interval: 0,
          deckId: db.GLOBAL_DECK_ID,
        });
      }
    }
  }

  async function repeatStudyPool(deckId, catalog, db, settings) {
    await resetStudyPoolMastery(catalog, db, settings);
  }

  async function expandStudyPool(deckId, catalog, db, settings, increment = null) {
    const step = increment ?? settings.batchIncrement;
    const newLimit = Math.min(catalog.words.length, settings.activeLimit + step);
    if (newLimit <= settings.activeLimit) return settings.activeLimit;
    await saveDeckSettings(deckId, db, { activeLimit: newLimit });
    return newLimit;
  }

  async function expandPoolOnWordLearned(deckId, catalog, db, settings) {
    if (settings.activeLimit >= catalog.words.length) return settings.activeLimit;
    const step = DEFAULTS.poolExpandOnLearn ?? 2;
    return expandStudyPool(deckId, catalog, db, settings, step);
  }

  async function expandPoolOnFirstTouch(deckId, catalog, db, settings, slug, cards) {
    if (settings.activeLimit >= catalog.words.length) return settings.activeLimit;
    for (const direction of DIRECTIONS) {
      const card = getSummaryCard(cards, slug, direction, db);
      if ((card?.repetitions ?? 0) > 0 || (card?.remembered ?? 0) > 0) {
        return settings.activeLimit;
      }
    }
    return expandStudyPool(deckId, catalog, db, settings, 1);
  }

  async function loadDeckSettings(deckId, db) {
    const initialBatchSize = await db.getSetting(
      `deck:${deckId}:initialBatchSize`,
      DEFAULTS.initialBatchSize,
    );
    const batchIncrement = await db.getSetting(
      `deck:${deckId}:batchIncrement`,
      DEFAULTS.batchIncrement,
    );
    let activeLimit = await db.getSetting(`deck:${deckId}:activeLimit`, null);
    if (activeLimit === null) {
      activeLimit = initialBatchSize;
      await db.setSetting(`deck:${deckId}:activeLimit`, activeLimit);
    }
    return { initialBatchSize, batchIncrement, activeLimit };
  }

  async function saveDeckSettings(deckId, db, settings) {
    if (settings.initialBatchSize != null) {
      await db.setSetting(`deck:${deckId}:initialBatchSize`, settings.initialBatchSize);
    }
    if (settings.activeLimit != null) {
      await db.setSetting(`deck:${deckId}:activeLimit`, settings.activeLimit);
    }
  }

  async function getDismissedRuElBlocks(db) {
    const dismissed = new Set();
    const prefix = 'practice:dismissedRuElBlock:';
    if (typeof db.getAllSettings === 'function') {
      const all = await db.getAllSettings();
      for (const [key, val] of Object.entries(all)) {
        if (key.startsWith(prefix) && val) {
          dismissed.add(Number(key.slice(prefix.length)));
        }
      }
      return dismissed;
    }
    for (let bi = 0; bi < 200; bi++) {
      const val = await db.getSetting(`${prefix}${bi}`, false);
      if (val) dismissed.add(bi);
    }
    return dismissed;
  }

  async function dismissRuElBlockPrompt(db, blockIndex) {
    await db.setSetting(`practice:dismissedRuElBlock:${blockIndex}`, true);
  }

  async function checkBlockDirectionPrompt(catalog, db) {
    const slugs = new Set(catalog.words.map((w) => w.slug));
    const cards = (await db.getAllCards()).filter((c) => slugs.has(c.wordSlug));
    const dismissed = await getDismissedRuElBlocks(db);
    return findBlockDirectionPrompt(catalog, cards, db, dismissed);
  }

  function getWordPoolDotState(slug, cards, db, now = Date.now()) {
    return progressGetWordPoolDotState(slug, cards, db, getWordPracticeDirection, now);
  }

  function getPoolDots(poolWords, cards, db, currentSlug = null, now = Date.now()) {
    return progressGetPoolDots(poolWords, cards, db, getWordPracticeDirection, currentSlug, now);
  }

  global.GreekSRS = {
    DEFAULTS,
    DIRECTIONS,
    DIRECTION_REP_FACTOR,
    beginSession,
    endSession,
    loadRecentPicks,
    isSessionActive,
    recordSessionCorrect,
    recordRecentPick,
    isPickTooSoon,
    getSessionCorrect,
    getPoolProgress,
    getPoolDots,
    getWordPoolDotState,
    countPoolLearned,
    countPoolInProgress,
    isWordInProgress,
    isSessionSatisfied,
    poolSessionSatisfiedInDirection,
    masteryThreshold,
    gradeCard,
    isDue,
    isMastered,
    isLearning,
    statsForWord,
    applyProgressBar,
    getProgressStats,
    findActiveLesson: pickMod.findActiveLesson,
    findBlockDirectionPrompt,
    checkBlockDirectionPrompt,
    dismissRuElBlockPrompt,
    isNumberTierUnlocked: pickMod.isNumberTierUnlocked,
    pickNextCard,
    loadDeckSettings,
    saveDeckSettings,
    resetCatalogSchedule,
    repeatCatalogSession,
    getPoolEnd,
    canExpandActiveLimit,
    getStudyPoolWords,
    getActivePoolWords,
    getWordPracticeDirection,
    isWordDoneForPool,
    isWordFullyDoneGlobal,
    isCatalogFullyMastered,
    poolMasteredInDirection,
    resolveAutoDirection,
    isStudyPoolFullyMastered,
    canExpandStudyPool,
    wordSourceLabel,
    resetStudyPoolMastery,
    repeatStudyPool,
    expandStudyPool,
    expandPoolOnWordLearned,
    expandPoolOnFirstTouch,
  };
})(window);
