(function (global) {
  const schedule = global.GreekSRSSchedule;
  const session = global.GreekSRSSession;
  const {
    DEFAULTS,
    DIRECTIONS,
    WEIGHT,
    getSummaryCard,
    isMastered,
    isDue,
    isLearning,
    recencyFactor,
  } = schedule;
  const {
    isSessionSatisfied,
    isWordDoneForPool,
    filterRecentPicks,
    getSessionState,
    setSessionCardsSinceReview,
    incrementSessionCardsSinceReview,
    poolSessionSatisfiedInDirection,
    recordRecentPick,
  } = session;

  function partitionCandidates(candidates) {
    const reviews = [];
    const learning = [];
    for (const c of candidates) {
      if (c.card && isMastered(c.card) && !c.isNew) {
        reviews.push(c);
      } else {
        learning.push(c);
      }
    }
    return { reviews, learning };
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

  function pickWithSessionMix(candidates) {
    if (!candidates.length) return null;

    const filtered = filterRecentPicks(candidates);
    const pool = filtered.length ? filtered : candidates;
    const { sessionActive, sessionCardsSinceReview } = getSessionState();

    if (sessionActive && DEFAULTS.reviewInsertEvery > 0) {
      const { reviews, learning } = partitionCandidates(pool);
      if (
        sessionCardsSinceReview >= DEFAULTS.reviewInsertEvery &&
        reviews.length &&
        learning.length
      ) {
        setSessionCardsSinceReview(0);
        const reviewPick = pickWeighted(reviews);
        if (reviewPick) return reviewPick;
      }
    }

    const pick = pickWeighted(pool);
    if (pick && sessionActive) {
      if (pick.card && isMastered(pick.card) && !pick.isNew) {
        setSessionCardsSinceReview(0);
      } else {
        incrementSessionCardsSinceReview();
      }
    }
    return pick;
  }

  function wordAge(wordIndex, frontierIndex) {
    return Math.max(0, frontierIndex - wordIndex);
  }

  function reviewWeight(age) {
    return 50 / (1 + age * 0.25);
  }

  function findActiveLesson(catalog, cards, db) {
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

  function findPoolFrontierIndex(catalog, poolWords, cards, db, options, getWordPracticeDirection) {
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

  function collectCandidates(
    settings,
    catalog,
    cards,
    db,
    now,
    options,
    helpers,
  ) {
    const {
      summaryOnly = false,
      direction: directionFilter = null,
      relaxDue = false,
      perWordDirection = false,
    } = options;
    const { getActivePoolWords, getWordPracticeDirection } = helpers;
    const poolWords = getActivePoolWords(catalog, cards, db, settings);
    const practiceDirection = directionFilter ?? 'el-ru';
    const frontierIndex = findPoolFrontierIndex(catalog, poolWords, cards, db, options, getWordPracticeDirection);
    const activeLesson = findActiveLesson(catalog, cards, db);
    const candidates = [];

    for (const word of poolWords) {
      const wi = catalog.words.findIndex((w) => w.slug === word.slug);
      const age = wordAge(wi >= 0 ? wi : 0, frontierIndex);

      if (!isNumberTierUnlocked(word, catalog, cards, db, practiceDirection)) {
        continue;
      }

      let directions;
      if (perWordDirection) {
        const wordDir = getWordPracticeDirection(word.slug, cards, db, now);
        if (wordDir) {
          directions = [wordDir];
        } else if (isWordDoneForPool(word.slug, cards, db, now)) {
          continue;
        } else {
          directions = DIRECTIONS.filter((d) => {
            const card = getSummaryCard(cards, word.slug, d, db);
            return card && !isMastered(card);
          });
          if (!directions.length) continue;
        }
      } else if (directionFilter) {
        directions = [directionFilter];
      } else {
        directions = DIRECTIONS;
      }

      for (const direction of directions) {
        const summaryCard = getSummaryCard(cards, word.slug, direction, db);
        const inActiveLesson = activeLesson != null && word.lesson === activeLesson;

        if (summaryCard && global.GreekLearningLadder?.hasPendingLearningGame(summaryCard)) {
          continue;
        }

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
          if (isSessionSatisfied(word.slug, direction, cards, db, now)) {
            weight *= DEFAULTS.sessionSatisfiedWeight;
          }
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
        ? [getWordPracticeDirection(word.slug, cards, db, now)].filter(Boolean)
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

  async function pickNextCard(deckId, catalog, db, options, helpers) {
    const { loadDeckSettings, isCatalogFullyMastered, getActivePoolWords } = helpers;
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
        helpers,
      );
      const pick = pickWithSessionMix(candidates);
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
        helpers,
      );
      const relaxedPick =
        isCatalogFullyMastered(catalog, allCards, db) ||
        (options.perWordDirection &&
          getActivePoolWords(catalog, allCards, db, settings).length === 0)
          ? null
          : pickWithSessionMix(relaxed);
      if (relaxedPick) {
        recordRecentPick(relaxedPick.word.slug, relaxedPick.direction, db);
        return relaxedPick;
      }

      if (
        session.isSessionActive() &&
        options.direction &&
        !options.perWordDirection &&
        poolSessionSatisfiedInDirection(
          getActivePoolWords(catalog, allCards, db, settings),
          options.direction,
          allCards,
          db,
        )
      ) {
        break;
      }

      if (isCatalogFullyMastered(catalog, allCards, db)) break;
      if (getActivePoolWords(catalog, allCards, db, settings).length === 0) break;
    }

    return null;
  }

  global.GreekSRSPick = {
    collectCandidates,
    pickNextCard,
    pickWithSessionMix,
    findActiveLesson,
    isNumberTierUnlocked,
  };
})(window);
