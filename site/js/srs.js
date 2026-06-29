(function (global) {
  const MINUTES = 60 * 1000;
  const DAY = 24 * 60 * MINUTES;

  const DEFAULTS = {
    initialBatchSize: 5,
    batchIncrement: 3,
    masteryReps: 3,
  };

  const WEIGHT = {
    newWord: 100,
    learningSummary: 75,
    learningForm: 65,
    newForm: 55,
  };

  const DIRECTIONS = ['el-ru', 'ru-el'];

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
    return (card.repetitions ?? 0) >= DEFAULTS.masteryReps;
  }

  function isLearning(card) {
    const reps = card.repetitions ?? 0;
    return reps > 0 && reps < DEFAULTS.masteryReps;
  }

  function cardDirection(card) {
    return card.direction ?? 'el-ru';
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
    const M = DEFAULTS.masteryReps;
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

  /** Индекс «переднего края» — первое слово, где не выучено хотя бы одно направление. */
  function findFrontierIndex(wordSlugs, poolEnd, cards, db) {
    for (let i = 0; i < poolEnd; i++) {
      const slug = wordSlugs[i];
      for (const direction of DIRECTIONS) {
        const card = getSummaryCard(cards, slug, direction, db);
        if (!card || !isMastered(card)) return i;
      }
    }
    return Math.max(0, poolEnd - 1);
  }

  function wordAge(wordIndex, frontierIndex) {
    return Math.max(0, frontierIndex - wordIndex);
  }

  /** Чем дальше слово от текущего фронта — тем реже попадает в практику. */
  function reviewWeight(age) {
    return 35 / (1 + age * 0.35);
  }

  function pickWeighted(candidates) {
    if (!candidates.length) return null;
    let total = 0;
    for (const c of candidates) total += c.weight;
    if (total <= 0) return candidates[0];
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return candidates[candidates.length - 1];
  }

  function collectCandidates(settings, catalog, cards, db, now, options) {
    const { summaryOnly = false } = options;
    const wordSlugs = catalog.words.map((w) => w.slug);
    const poolEnd = Math.min(settings.activeLimit, wordSlugs.length);
    const frontierIndex = findFrontierIndex(wordSlugs, poolEnd, cards, db);
    const candidates = [];

    for (let wi = 0; wi < catalog.words.length; wi++) {
      if (wi >= poolEnd) continue;

      const word = catalog.words[wi];
      const age = wordAge(wi, frontierIndex);

      for (const direction of DIRECTIONS) {
        const summaryCard = getSummaryCard(cards, word.slug, direction, db);

        if (!summaryCard) {
          candidates.push({
            card: null,
            word,
            isNew: true,
            type: 'summary',
            direction,
            weight: WEIGHT.newWord,
          });
          continue;
        }

        if (isDue(summaryCard, now)) {
          if (isLearning(summaryCard)) {
            candidates.push({
              card: summaryCard,
              word,
              type: 'summary',
              direction,
              weight: WEIGHT.learningSummary,
            });
          } else if (isMastered(summaryCard)) {
            candidates.push({
              card: summaryCard,
              word,
              type: 'summary',
              direction,
              weight: reviewWeight(age),
            });
          }
        }
      }

      if (summaryOnly) continue;

      for (let fi = 0; fi < word.formCount; fi++) {
        for (const direction of DIRECTIONS) {
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

  /**
   * Выбор карточки: новые слова + повторения по SRS.
   * Если в текущем пуле нечего учить — автоматически расширяет activeLimit.
   */
  async function pickNextCard(deckId, catalog, db, options = {}) {
    const settings = await loadDeckSettings(deckId, db);
    const allCards = await db.getDeckCards(deckId);
    const now = Date.now();
    const wordSlugs = catalog.words.map((w) => w.slug);
    const workingSettings = { ...settings };

    for (let attempt = 0; attempt < 25; attempt++) {
      const candidates = collectCandidates(
        workingSettings,
        catalog,
        allCards,
        db,
        now,
        options,
      );
      const pick = pickWeighted(candidates);
      if (pick) return pick;

      if (workingSettings.activeLimit >= wordSlugs.length) break;

      workingSettings.activeLimit = Math.min(
        wordSlugs.length,
        workingSettings.activeLimit + workingSettings.batchIncrement,
      );
      await db.setSetting(`deck:${deckId}:activeLimit`, workingSettings.activeLimit);
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

  global.GreekSRS = {
    DEFAULTS,
    DIRECTIONS,
    gradeCard,
    isDue,
    isMastered,
    isLearning,
    statsForWord,
    applyProgressBar,
    getProgressStats,
    pickNextCard,
    loadDeckSettings,
    saveDeckSettings,
  };
})(window);
