(function (global) {
  const MINUTES = 60 * 1000;
  const DAY = 24 * 60 * MINUTES;

  const DEFAULTS = {
    initialBatchSize: 8,
    batchIncrement: 3,
    poolExpandOnLearn: 2,
    reviewInsertEvery: 3,
    masteryReps: 2,
    sessionCorrectThreshold: 2,
    sessionReviewThreshold: 1,
    sessionSatisfiedWeight: 0.12,
    sessionLearningMaxInterval: 8 * MINUTES,
  };

  const DIRECTION_REP_FACTOR = {
    'el-ru': 1,
    'ru-el': 1,
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

  function gradeCard(card, remembered, sessionActive) {
    const now = Date.now();
    const updated = { ...card, lastReview: now };
    const dir = cardDirection(card);
    const masteredBefore = (card.repetitions ?? 0) >= masteryThreshold(dir);

    if (remembered) {
      updated.remembered = (updated.remembered ?? 0) + 1;
      updated.repetitions = (updated.repetitions ?? 0) + 1;

      if (updated.repetitions === 1) {
        updated.interval = 3 * MINUTES;
      } else if (updated.repetitions === 2) {
        updated.interval = 20 * MINUTES;
      } else if (updated.repetitions === 3) {
        updated.interval = 2 * 60 * MINUTES;
      } else {
        updated.ease = Math.min(3, (updated.ease ?? 2.5) + 0.1);
        updated.interval = Math.round((updated.interval || DAY) * updated.ease);
      }

      const masteredAfter = updated.repetitions >= masteryThreshold(dir);
      if (sessionActive && !masteredBefore && !masteredAfter) {
        updated.interval = Math.min(
          updated.interval,
          DEFAULTS.sessionLearningMaxInterval,
        );
      }
      updated.nextReview = now + updated.interval;
    } else {
      updated.forgotten = (updated.forgotten ?? 0) + 1;
      updated.repetitions = 0;
      updated.interval = 3 * MINUTES;
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
    const elRuPct = directionPct(cards, slug, formCount, 'el-ru', db);
    const ruElPct = directionPct(cards, slug, formCount, 'ru-el', db);
    const elRuCard = getSummaryCard(cards, slug, 'el-ru', db);
    const ruElCard = getSummaryCard(cards, slug, 'ru-el', db);
    const elRuMax = masteryThreshold('el-ru');
    const ruElMax = masteryThreshold('ru-el');
    return {
      wordPct: elRuPct,
      formsPct: ruElPct,
      elRuPct,
      ruElPct,
      elRuReps: elRuCard?.repetitions ?? 0,
      ruElReps: ruElCard?.repetitions ?? 0,
      elRuMax,
      ruElMax,
    };
  }

  function recencyFactor(card, now = Date.now()) {
    const last = card?.lastReview ?? 0;
    if (!last) return 1;
    const hoursSince = (now - last) / (60 * 60 * 1000);
    return Math.min(1, 0.25 + hoursSince * 0.25);
  }

  function isWordFullyDoneGlobal(slug, cards, db) {
    const elRu = getSummaryCard(cards, slug, 'el-ru', db);
    const ruEl = getSummaryCard(cards, slug, 'ru-el', db);
    return Boolean(elRu && isMastered(elRu) && ruEl && isMastered(ruEl));
  }

  global.GreekSRSSchedule = {
    MINUTES,
    DAY,
    DEFAULTS,
    DIRECTION_REP_FACTOR,
    DIRECTIONS,
    WEIGHT,
    masteryThreshold,
    gradeCard,
    isDue,
    isMastered,
    isLearning,
    cardDirection,
    getSummaryCard,
    getFormCards,
    directionPct,
    statsForWord,
    recencyFactor,
    isWordFullyDoneGlobal,
  };
})(window);
