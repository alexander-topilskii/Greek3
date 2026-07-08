(function (global) {
  const schedule = global.GreekSRSSchedule;
  const session = global.GreekSRSSession;
  const {
    DEFAULTS,
    DIRECTIONS,
    getSummaryCard,
    isMastered,
    isDue,
    statsForWord,
    masteryThreshold,
  } = schedule;
  const { isSessionSatisfied, isWordDoneForPool } = session;

  function applyProgressBar(el, stats) {
    if (!el) return;
    const wordPct = stats?.wordPct ?? stats?.elRuPct ?? 0;
    const formsPct = stats?.formsPct ?? stats?.ruElPct ?? 0;
    const wordFill = el.querySelector('.progress-word');
    const ruElFill = el.querySelector('.progress-ru-el') ?? el.querySelector('.progress-forms');
    if (wordFill) wordFill.style.width = `${wordPct}%`;
    if (ruElFill) ruElFill.style.width = `${formsPct}%`;

    const elRuFraction = el.querySelector('.progress-el-ru-fraction');
    const ruElFraction = el.querySelector('.progress-ru-el-fraction');
    if (elRuFraction && stats?.elRuMax != null) {
      elRuFraction.textContent = `${stats.elRuReps ?? 0}/${stats.elRuMax}`;
    }
    if (ruElFraction && stats?.ruElMax != null) {
      ruElFraction.textContent = `${stats.ruElReps ?? 0}/${stats.ruElMax}`;
    }
  }

  function getProgressStats(cards, totalFormsByWord, db) {
    const result = {};
    const slugs = new Set([
      ...Object.keys(totalFormsByWord),
      ...cards.map((c) => c.wordSlug),
    ]);
    for (const slug of slugs) {
      result[slug] = statsForWord(cards, slug, totalFormsByWord[slug] ?? 0, db);
    }
    return result;
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

  function getPoolProgress(poolWords, cards, db, direction = null) {
    const total = poolWords.length;
    const learned = countPoolLearned(poolWords, cards, db);
    const inProgress = countPoolInProgress(poolWords, cards, db);
    const fresh = Math.max(0, total - learned - inProgress);

    let directionMastered = 0;
    let directionLearning = 0;
    let directionNew = 0;
    if (direction) {
      for (const word of poolWords) {
        const card = getSummaryCard(cards, word.slug, direction, db);
        if (card && isMastered(card)) {
          directionMastered += 1;
        } else if ((card?.repetitions ?? 0) > 0) {
          directionLearning += 1;
        } else {
          directionNew += 1;
        }
      }
    }

    return {
      learned,
      inProgress,
      total,
      remaining: total - learned,
      fresh,
      directionMastered,
      directionLearning,
      directionNew,
    };
  }

  function getWordPoolDotState(slug, cards, db, getWordPracticeDirection, now = Date.now()) {
    const { sessionActive } = session.getSessionState();
    const direction = getWordPracticeDirection(slug, cards, db, now) ?? 'el-ru';
    const card = getSummaryCard(cards, slug, direction, db);
    const reps = card?.repetitions ?? 0;
    const max = masteryThreshold(direction);
    const progress = Math.min(100, Math.round((reps / max) * 100));

    if (card && isMastered(card)) {
      const due = isDue(card, now);
      return {
        state: due ? 'mastered' : 'resting',
        progress: 100,
        direction,
      };
    }

    if (sessionActive && isSessionSatisfied(slug, direction, cards, db, now)) {
      return { state: 'resting', progress, direction };
    }

    if (reps > 0) {
      return { state: 'learning', progress, direction };
    }

    return { state: 'new', progress: 0, direction };
  }

  function getPoolDots(poolWords, cards, db, getWordPracticeDirection, currentSlug = null, now = Date.now()) {
    return poolWords.map((word) => {
      const dot = getWordPoolDotState(word.slug, cards, db, getWordPracticeDirection, now);
      return {
        slug: word.slug,
        label: word.translation || word.title || word.slug,
        isCurrent: currentSlug === word.slug,
        ...dot,
      };
    });
  }

  global.GreekSRSProgress = {
    applyProgressBar,
    getProgressStats,
    countPoolLearned,
    isWordInProgress,
    countPoolInProgress,
    getPoolProgress,
    getWordPoolDotState,
    getPoolDots,
  };
})(window);
