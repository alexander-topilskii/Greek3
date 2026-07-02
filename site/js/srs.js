(function (global) {
  const MINUTES = 60 * 1000;
  const DAY = 24 * 60 * MINUTES;

  const DEFAULTS = {
    initialBatchSize: 5,
    batchIncrement: 3,
    masteryReps: 3,
    /** Правильных ответов в одной сессии — достаточно, чтобы не показывать слово снова до конца сессии. */
    sessionCorrectThreshold: 2,
  };

  let sessionActive = false;
  /** @type {Map<string, number>} slug#direction → correct count in current session */
  const sessionCorrect = new Map();
  /** @type {{ slug: string, direction: string }[]} newest first */
  const recentPicks = [];
  const RECENT_PICK_HISTORY = 3;
  const SAME_DIRECTION_GAP = 2;
  const REVERSE_DIRECTION_GAP = 1;

  const RECENT_PICKS_KEY = 'practice:recentPicks';

  /** Ελ→Ру ×1, Ру→Ελ ×3 — с русского нужно больше повторений */
  const DIRECTION_REP_FACTOR = {
    'el-ru': 1,
    'ru-el': 3,
  };

  const WEIGHT = {
    activeLesson: 150,
    newWord: 100,
    learningSummary: 75,
    learningForm: 65,
    newForm: 55,
  };

  const DIRECTIONS = ['el-ru', 'ru-el'];

  function masteryThreshold(direction) {
    const factor = DIRECTION_REP_FACTOR[direction] ?? 1;
    return DEFAULTS.masteryReps * factor;
  }

  /** SM-2 inspired scheduling */
  function gradeCard(card, remembered) {
    const now = Date.now();
    const updated = { ...card, lastReview: now };

    if (remembered) {
      updated.remembered = (updated.remembered ?? 0) + 1;
      updated.repetitions = (updated.repetitions ?? 0) + 1;

      if (updated.repetitions === 1) {
        updated.interval = 10 * MINUTES;
      } else if (updated.repetitions === 2) {
        updated.interval = DAY;
      } else {
        updated.ease = Math.min(3, (updated.ease ?? 2.5) + 0.1);
        updated.interval = Math.round((updated.interval || DAY) * updated.ease);
      }
      updated.nextReview = now + updated.interval;
    } else {
      updated.forgotten = (updated.forgotten ?? 0) + 1;
      updated.repetitions = 0;
      updated.interval = 5 * MINUTES;
      updated.ease = Math.max(1.3, (updated.ease ?? 2.5) - 0.2);
      updated.nextReview = now + updated.interval;
    }

    return updated;
  }

  function isDue(card, now = Date.now()) {
    return !card.nextReview || card.nextReview <= now;
  }

  function isMastered(card) {
    const dir = cardDirection(card);
    return (card.repetitions ?? 0) >= masteryThreshold(dir);
  }

  function isLearning(card) {
    const dir = cardDirection(card);
    const reps = card.repetitions ?? 0;
    return reps > 0 && reps < masteryThreshold(dir);
  }

  function cardDirection(card) {
    return card.direction ?? 'el-ru';
  }

  function sessionKey(slug, direction) {
    return `${slug}#${direction}`;
  }

  function beginSession() {
    sessionActive = true;
    sessionCorrect.clear();
  }

  async function loadRecentPicks(db) {
    recentPicks.length = 0;
    if (!db) return;
    const stored = await db.getSetting(RECENT_PICKS_KEY, []);
    if (!Array.isArray(stored)) return;
    for (const item of stored.slice(0, RECENT_PICK_HISTORY)) {
      if (item?.slug && item?.direction) {
        recentPicks.push({ slug: item.slug, direction: item.direction });
      }
    }
  }

  async function persistRecentPicks(db) {
    if (!db) return;
    await db.setSetting(
      RECENT_PICKS_KEY,
      recentPicks.slice(0, RECENT_PICK_HISTORY).map((p) => ({
        slug: p.slug,
        direction: p.direction,
      })),
    );
  }

  function recencyFactor(card, now = Date.now()) {
    const last = card?.lastReview ?? 0;
    if (!last) return 1;
    const hoursSince = (now - last) / (60 * 60 * 1000);
    return Math.min(1, 0.25 + hoursSince * 0.25);
  }

  function endSession(db) {
    sessionActive = false;
    sessionCorrect.clear();
    if (db) {
      persistRecentPicks(db).catch((err) => {
        console.error('Failed to persist recent picks', err);
      });
    }
  }

  function recordRecentPick(slug, direction, db) {
    recentPicks.unshift({ slug, direction });
    if (recentPicks.length > RECENT_PICK_HISTORY) {
      recentPicks.length = RECENT_PICK_HISTORY;
    }
    if (db) {
      persistRecentPicks(db).catch((err) => {
        console.error('Failed to persist recent picks', err);
      });
    }
  }

  function isPickTooSoon(slug, direction) {
    for (let i = 0; i < recentPicks.length; i++) {
      const prev = recentPicks[i];
      if (prev.slug !== slug) continue;
      const distance = i + 1;
      if (prev.direction === direction && distance <= SAME_DIRECTION_GAP) return true;
      if (prev.direction !== direction && distance <= REVERSE_DIRECTION_GAP) return true;
    }
    return false;
  }

  function filterRecentPicks(candidates) {
    const filtered = candidates.filter(
      (c) => !isPickTooSoon(c.word.slug, c.direction),
    );
    return filtered.length ? filtered : candidates;
  }

  function isSessionActive() {
    return sessionActive;
  }

  function recordSessionCorrect(slug, direction) {
    if (!sessionActive) return;
    const key = sessionKey(slug, direction);
    sessionCorrect.set(key, (sessionCorrect.get(key) ?? 0) + 1);
  }

  function getSessionCorrect(slug, direction) {
    return sessionCorrect.get(sessionKey(slug, direction)) ?? 0;
  }

  function isSessionSatisfied(slug, direction) {
    return getSessionCorrect(slug, direction) >= DEFAULTS.sessionCorrectThreshold;
  }

  function poolSessionSatisfiedInDirection(poolWords, direction) {
    if (!poolWords.length) return false;
    return poolWords.every((w) => isSessionSatisfied(w.slug, direction));
  }

  function isWordFullyDoneGlobal(slug, cards, db) {
    const elRu = getSummaryCard(cards, slug, 'el-ru', db);
    const ruEl = getSummaryCard(cards, slug, 'ru-el', db);
    return Boolean(elRu && isMastered(elRu) && ruEl && isMastered(ruEl));
  }

  function isWordDoneForPool(slug, cards, db, now = Date.now()) {
    if (
      sessionActive &&
      isSessionSatisfied(slug, 'el-ru') &&
      isSessionSatisfied(slug, 'ru-el')
    ) {
      return true;
    }
    if (!isWordFullyDoneGlobal(slug, cards, db)) return false;
    for (const dir of DIRECTIONS) {
      const card = getSummaryCard(cards, slug, dir, db);
      if (card && isDue(card, now)) return false;
    }
    return true;
  }

  /** Текущее направление для слова: Ελ→Ру, затем Ру→Ελ; null — слово выучено. */
  function getWordPracticeDirection(slug, cards, db) {
    if (sessionActive) {
      if (!isSessionSatisfied(slug, 'el-ru')) return 'el-ru';
      if (!isSessionSatisfied(slug, 'ru-el')) return 'ru-el';
      return null;
    }
    const elRu = getSummaryCard(cards, slug, 'el-ru', db);
    if (!elRu || !isMastered(elRu)) return 'el-ru';
    const ruEl = getSummaryCard(cards, slug, 'ru-el', db);
    if (!ruEl || !isMastered(ruEl)) return 'ru-el';
    return null;
  }

  /**
   * Скользящий набор: пропускаем полностью выученные слова,
   * на их место приходят следующие из каталога.
   */
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

  function getSummaryCard(cards, slug, direction, db) {
    const id = db.cardId(slug, 'summary', null, direction);
    let card = cards.find((c) => c.id === id);
    if (!card && direction === 'el-ru') {
      card = cards.find(
        (c) =>
          c.wordSlug === slug &&
          c.type === 'summary' &&
          (c.id === db.legacyCardId(slug, 'summary') || !c.direction),
      );
    }
    return card ?? null;
  }

  function getFormCards(cards, slug, direction) {
    return cards.filter(
      (c) =>
        c.wordSlug === slug &&
        c.type === 'form' &&
        cardDirection(c) === direction,
    );
  }

  function directionPct(cards, slug, formCount, direction, db) {
    const M = masteryThreshold(direction);
    const summary = getSummaryCard(cards, slug, direction, db);
    const formCards = getFormCards(cards, slug, direction);
    const summaryPct = Math.min(
      100,
      Math.round(((summary?.repetitions ?? 0) / M) * 100),
    );

    if (formCount <= 0) return summaryPct;

    const formsPct = Math.round(
      formCards.reduce(
        (sum, c) => sum + Math.min(100, ((c.repetitions ?? 0) / M) * 100),
        0,
      ) / formCount,
    );
    return Math.round((summaryPct + formsPct) / 2);
  }

  function statsForWord(cards, slug, formCount, db) {
    return {
      wordPct: directionPct(cards, slug, formCount, 'el-ru', db),
      formsPct: directionPct(cards, slug, formCount, 'ru-el', db),
    };
  }

  function applyProgressBar(el, wordPct, formsPct) {
    if (!el) return;
    const wordFill = el.querySelector('.progress-word');
    const formsFill = el.querySelector('.progress-forms');
    if (wordFill) wordFill.style.width = `${wordPct}%`;
    if (formsFill) formsFill.style.width = `${formsPct}%`;
  }

  function getProgressStats(cards, totalFormsByWord, db) {
    const result = {};
    const slugs = new Set([
      ...Object.keys(totalFormsByWord),
      ...cards.map((c) => c.wordSlug),
    ]);
    for (const slug of slugs) {
      result[slug] = statsForWord(
        cards,
        slug,
        totalFormsByWord[slug] ?? 0,
        db,
      );
    }
    return result;
  }

  /** Урок с невыученными словами — с конца списка (51, 50, 49…). */
  function findActiveLesson(catalog, cards, db, direction) {
    const lessons = [
      ...new Set(
        catalog.words.map((w) => w.lesson).filter((n) => n != null && n > 0),
      ),
    ].sort((a, b) => b - a);

    for (const lesson of lessons) {
      const lessonWords = catalog.words.filter((w) => w.lesson === lesson);
      for (const w of lessonWords) {
        if (!isWordDoneForPool(w.slug, cards, db)) return lesson;
      }
    }
    return null;
  }

  function isNumberTierUnlocked(word, catalog, cards, db, direction) {
    if (word.category !== 'numbers' || word.numberTier == null) return true;
    if (word.numberTier <= 0) return true;

    const prevTier = word.numberTier - 1;
    const prevWords = catalog.words.filter(
      (w) => w.category === 'numbers' && w.numberTier === prevTier,
    );
    if (!prevWords.length) return true;

    return prevWords.every((w) => {
      const card = getSummaryCard(cards, w.slug, direction, db);
      return card && isMastered(card);
    });
  }

  function wordsInBlock(catalog, blockIndex) {
    return catalog.words.filter((w) => (w.blockIndex ?? 0) === blockIndex);
  }

  function blockMasteredInDirection(block, cards, db, direction) {
    return block.every((w) => {
      const card = getSummaryCard(cards, w.slug, direction, db);
      return card && isMastered(card);
    });
  }

  function allCatalogMasteredInDirection(catalog, cards, db, direction) {
    return catalog.words.every((w) => {
      const card = getSummaryCard(cards, w.slug, direction, db);
      return card && isMastered(card);
    });
  }

  function isCatalogFullyMastered(catalog, cards, db) {
    return catalog.words.every((w) => isWordFullyDoneGlobal(w.slug, cards, db));
  }

  function findPoolFrontierIndex(catalog, poolWords, cards, db, options) {
    const { perWordDirection = false, direction: directionFilter = null } = options;
    for (let i = 0; i < catalog.words.length; i++) {
      const word = catalog.words[i];
      if (!poolWords.some((w) => w.slug === word.slug)) continue;
      if (perWordDirection) {
        if (getWordPracticeDirection(word.slug, cards, db)) return i;
      } else {
        const dir = directionFilter ?? 'el-ru';
        const card = getSummaryCard(cards, word.slug, dir, db);
        if (!card || !isMastered(card)) return i;
      }
    }
    const lastPoolWord = poolWords[poolWords.length - 1];
    if (!lastPoolWord) return 0;
    const idx = catalog.words.findIndex((w) => w.slug === lastPoolWord.slug);
    return idx >= 0 ? idx : 0;
  }

  /** @deprecated Используйте getActivePoolWords; оставлено для совместимости. */
  function getPoolEnd(settings, catalog, cards, db, direction) {
    return getActivePoolWords(catalog, cards, db, settings).length;
  }

  function canExpandActiveLimit(settings, catalog) {
    return settings.activeLimit < catalog.words.length;
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

  /**
   * Блок, где Ελ→Ру выучен, а Ру→Εл ещё нет — предложить сменить направление.
   */
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

  /** Индекс «переднего края» в текущем направлении. */
  function findFrontierIndex(wordSlugs, poolEnd, cards, db, direction) {
    for (let i = 0; i < poolEnd; i++) {
      const slug = wordSlugs[i];
      const card = getSummaryCard(cards, slug, direction, db);
      if (!card || !isMastered(card)) return i;
    }
    return Math.max(0, poolEnd - 1);
  }

  function wordAge(wordIndex, frontierIndex) {
    return Math.max(0, frontierIndex - wordIndex);
  }

  function reviewWeight(age) {
    return 35 / (1 + age * 0.35);
  }

  function pickWeighted(candidates) {
    if (!candidates.length) return null;
    const pool = filterRecentPicks(candidates);
    let total = 0;
    for (const c of pool) total += c.weight;
    if (total <= 0) return pool[0];
    let r = Math.random() * total;
    for (const c of pool) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return pool[pool.length - 1];
  }

  function collectCandidates(settings, catalog, cards, db, now, options) {
    const {
      summaryOnly = false,
      direction: directionFilter = null,
      relaxDue = false,
      perWordDirection = false,
    } = options;
    const poolWords = getActivePoolWords(catalog, cards, db, settings);
    const practiceDirection = directionFilter ?? 'el-ru';
    const frontierIndex = findPoolFrontierIndex(catalog, poolWords, cards, db, {
      perWordDirection,
      direction: directionFilter,
    });
    const activeLesson = findActiveLesson(catalog, cards, db, practiceDirection);
    const candidates = [];

    for (const word of poolWords) {
      const wi = catalog.words.findIndex((w) => w.slug === word.slug);
      const age = wordAge(wi >= 0 ? wi : 0, frontierIndex);

      if (!isNumberTierUnlocked(word, catalog, cards, db, practiceDirection)) {
        continue;
      }

      let directions;
      if (perWordDirection) {
        const wordDir = getWordPracticeDirection(word.slug, cards, db);
        if (!wordDir) continue;
        directions = [wordDir];
      } else if (directionFilter) {
        if (sessionActive && isSessionSatisfied(word.slug, directionFilter)) {
          continue;
        }
        directions = [directionFilter];
      } else {
        directions = DIRECTIONS;
      }

      for (const direction of directions) {
        const summaryCard = getSummaryCard(cards, word.slug, direction, db);
        const inActiveLesson = activeLesson != null && word.lesson === activeLesson;

        if (!summaryCard) {
          candidates.push({
            card: null,
            word,
            isNew: true,
            type: 'summary',
            direction,
            weight: inActiveLesson ? WEIGHT.activeLesson : WEIGHT.newWord,
          });
          continue;
        }

        const due = isDue(summaryCard, now);
        if (due || relaxDue) {
          let weight;
          if (isLearning(summaryCard)) {
            weight = inActiveLesson ? WEIGHT.activeLesson : WEIGHT.learningSummary;
          } else if (isMastered(summaryCard)) {
            weight = relaxDue && !due ? reviewWeight(age) * 1.5 : reviewWeight(age);
          } else if ((summaryCard.repetitions ?? 0) === 0) {
            weight = inActiveLesson ? WEIGHT.activeLesson : WEIGHT.newWord;
          } else {
            continue;
          }
          weight *= recencyFactor(summaryCard, now);
          if (relaxDue && !due) weight *= 0.6;
          candidates.push({
            card: summaryCard,
            word,
            type: 'summary',
            direction,
            weight,
          });
        }
      }

      if (summaryOnly) continue;

      const formDirections = perWordDirection
        ? [getWordPracticeDirection(word.slug, cards, db)].filter(Boolean)
        : directionFilter
          ? [directionFilter]
          : DIRECTIONS;

      for (let fi = 0; fi < word.formCount; fi++) {
        for (const direction of formDirections) {
          const formId = db.cardId(word.slug, 'form', fi, direction);
          let formCard = cards.find((c) => c.id === formId);
          if (!formCard && direction === 'el-ru') {
            formCard = cards.find(
              (c) =>
                c.wordSlug === word.slug &&
                c.type === 'form' &&
                c.formIndex === fi &&
                (c.id === db.legacyCardId(word.slug, 'form', fi) || !c.direction),
            );
          }
          if (!formCard || !isDue(formCard, now)) continue;

          let weight;
          if (isMastered(formCard)) {
            weight = reviewWeight(age) * 0.85;
          } else if (formCard.repetitions) {
            weight = WEIGHT.learningForm;
          } else {
            weight = WEIGHT.newForm;
          }
          candidates.push({
            card: formCard,
            word,
            formIndex: fi,
            direction,
            weight,
          });
        }
      }
    }

    return candidates;
  }

  async function resetCatalogSchedule(catalog, db, direction, now = Date.now()) {
    const slugs = new Set(catalog.words.map((w) => w.slug));
    const cards = (await db.getAllCards()).filter((c) => slugs.has(c.wordSlug));
    const resetIds = new Set();

    for (const card of cards) {
      if (card.type !== 'summary') continue;
      if (cardDirection(card) !== direction) continue;
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

  function getStudyPoolWords(catalog, settings, cards, db) {
    if (cards && db) {
      return getActivePoolWords(catalog, cards, db, settings);
    }
    const limit = Math.min(settings.activeLimit, catalog.words.length);
    return catalog.words.slice(0, limit);
  }

  function poolMasteredInDirection(poolWords, cards, db, direction) {
    if (!poolWords.length) return false;
    return poolWords.every((w) => {
      const card = getSummaryCard(cards, w.slug, direction, db);
      return card && isMastered(card);
    });
  }

  function poolDoneInDirection(poolWords, cards, db, direction) {
    if (sessionActive) return poolSessionSatisfiedInDirection(poolWords, direction);
    return poolMasteredInDirection(poolWords, cards, db, direction);
  }

  /** Ελ→Ру пока не выучен набор, затем Ру→Ελ. В сессии — по локальному счётчику. */
  function resolveAutoDirection(catalog, cards, db, settings) {
    const pool = getActivePoolWords(catalog, cards, db, settings);
    if (!poolDoneInDirection(pool, cards, db, 'el-ru')) return 'el-ru';
    if (!poolDoneInDirection(pool, cards, db, 'ru-el')) return 'ru-el';
    return 'el-ru';
  }

  function isStudyPoolFullyMastered(catalog, cards, db, settings) {
    return isCatalogFullyMastered(catalog, cards, db);
  }

  function canExpandStudyPool(settings, catalog) {
    return settings.activeLimit < catalog.words.length;
  }

  function wordSourceLabel(word, categoryLabels = {}) {
    if (word.lesson != null) return `Урок ${word.lesson}`;
    const cat = categoryLabels[word.category] ?? word.category;
    return cat || 'Словарь';
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

  /** Добавить одно слово в набор, когда предыдущее выучено. */
  async function expandPoolOnWordLearned(deckId, catalog, db, settings) {
    if (settings.activeLimit >= catalog.words.length) return settings.activeLimit;
    return expandStudyPool(deckId, catalog, db, settings, 1);
  }

  function countPoolLearned(poolWords, cards, db) {
    if (!poolWords.length) return 0;
    return poolWords.filter((w) => isWordDoneForPool(w.slug, cards, db)).length;
  }

  function isWordInProgress(slug, cards, db) {
    if (isWordDoneForPool(slug, cards, db)) return false;
    for (const dir of DIRECTIONS) {
      const card = getSummaryCard(cards, slug, dir, db);
      if ((card?.repetitions ?? 0) > 0 || (card?.remembered ?? 0) > 0) return true;
    }
    return false;
  }

  function countPoolInProgress(poolWords, cards, db) {
    if (!poolWords.length) return 0;
    return poolWords.filter((w) => isWordInProgress(w.slug, cards, db)).length;
  }

  function getPoolProgress(poolWords, cards, db) {
    const total = poolWords.length;
    const learned = countPoolLearned(poolWords, cards, db);
    const inProgress = countPoolInProgress(poolWords, cards, db);
    return { learned, inProgress, total, remaining: total - learned };
  }

  async function pickNextCard(deckId, catalog, db, options = {}) {
    const settings = await loadDeckSettings(deckId, db);
    const slugs = new Set(catalog.words.map((w) => w.slug));
    const allCards = (await db.getAllCards()).filter((c) => slugs.has(c.wordSlug));
    const now = Date.now();

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidates = collectCandidates(
        settings,
        catalog,
        allCards,
        db,
        now,
        options,
      );
      const pick = pickWeighted(candidates);
      if (pick) {
        recordRecentPick(pick.word.slug, pick.direction, db);
        return pick;
      }

      const relaxed = collectCandidates(
        settings,
        catalog,
        allCards,
        db,
        now,
        { ...options, relaxDue: true },
      );
      const practiceDirection =
        options.perWordDirection || !options.direction
          ? 'el-ru'
          : options.direction;
      const relaxedPick =
        isCatalogFullyMastered(catalog, allCards, db) ||
        (options.perWordDirection &&
          getActivePoolWords(catalog, allCards, db, settings).length === 0)
          ? null
          : pickWeighted(relaxed);
      if (relaxedPick) {
        recordRecentPick(relaxedPick.word.slug, relaxedPick.direction, db);
        return relaxedPick;
      }

      if (
        sessionActive &&
        options.direction &&
        !options.perWordDirection &&
        poolSessionSatisfiedInDirection(
          getActivePoolWords(catalog, allCards, db, settings),
          options.direction,
        )
      ) {
        break;
      }

      if (isCatalogFullyMastered(catalog, allCards, db)) break;
      if (getActivePoolWords(catalog, allCards, db, settings).length === 0) break;
    }

    return null;
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
    findActiveLesson,
    findBlockDirectionPrompt,
    checkBlockDirectionPrompt,
    dismissRuElBlockPrompt,
    isNumberTierUnlocked,
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
  };
})(window);
