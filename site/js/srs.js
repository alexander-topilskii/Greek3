(function (global) {
  const MINUTES = 60 * 1000;
  const DAY = 24 * 60 * MINUTES;

  const DEFAULTS = {
    initialBatchSize: 5,
    batchIncrement: 3,
    maxActive: 20,
    masteryReps: 3,
  };

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

  function statsForWord(cards, slug, formCount) {
    const M = DEFAULTS.masteryReps;
    const summary = cards.find((c) => c.wordSlug === slug && c.type === 'summary');
    const formCards = cards.filter((c) => c.wordSlug === slug && c.type === 'form');
    const wordPct = Math.min(
      100,
      Math.round(((summary?.repetitions ?? 0) / M) * 100),
    );
    let formsPct = 0;
    if (formCount > 0) {
      const total = formCards.reduce(
        (sum, c) => sum + Math.min(100, ((c.repetitions ?? 0) / M) * 100),
        0,
      );
      formsPct = Math.round(total / formCount);
    }
    return { wordPct, formsPct };
  }

  function applyProgressBar(el, wordPct, formsPct) {
    if (!el) return;
    const wordFill = el.querySelector('.progress-word');
    const formsFill = el.querySelector('.progress-forms');
    if (wordFill) wordFill.style.width = `${wordPct}%`;
    if (formsFill) formsFill.style.width = `${formsPct}%`;
  }

  function getProgressStats(cards, totalFormsByWord) {
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
      );
    }
    return result;
  }

  /**
   * Pick next card using spaced repetition + expanding batch.
   * @param {{ summaryOnly?: boolean }} options
   */
  async function pickNextCard(deckId, catalog, db, options = {}) {
    const { summaryOnly = false } = options;
    const settings = await loadDeckSettings(deckId, db);
    const allCards = await db.getDeckCards(deckId);
    const now = Date.now();
    const cardMap = new Map(allCards.map((c) => [c.id, c]));

    const wordSlugs = catalog.words.map((w) => w.slug);
    const activeLimit = settings.activeLimit;

    const activeWords = wordSlugs.slice(0, activeLimit);
    const masteredWords = activeWords.filter((slug) => {
      const summaryId = db.cardId(slug, 'summary');
      const card = cardMap.get(summaryId);
      return card && isMastered(card);
    });

    if (
      masteredWords.length >= activeWords.length - 1 &&
      activeLimit < wordSlugs.length
    ) {
      const newLimit = Math.min(
        wordSlugs.length,
        activeLimit + settings.batchIncrement,
      );
      if (newLimit > activeLimit) {
        await db.setSetting(`deck:${deckId}:activeLimit`, newLimit);
        settings.activeLimit = newLimit;
      }
    }

    const poolSlugs = wordSlugs.slice(0, settings.activeLimit);
    const candidates = [];

    for (const word of catalog.words) {
      if (!poolSlugs.includes(word.slug)) continue;

      const summaryId = db.cardId(word.slug, 'summary');
      const summaryCard = cardMap.get(summaryId);
      if (summaryCard && isDue(summaryCard, now)) {
        candidates.push({ card: summaryCard, priority: 1, word });
      }

      for (let i = 0; i < word.formCount; i++) {
        if (summaryOnly) break;
        const formId = db.cardId(word.slug, 'form', i);
        const formCard = cardMap.get(formId);
        if (formCard && isDue(formCard, now)) {
          candidates.push({ card: formCard, priority: formCard.repetitions ? 2 : 3, word, formIndex: i });
        }
      }

      if (!summaryCard) {
        candidates.push({
          card: null,
          priority: 4,
          word,
          isNew: true,
          type: 'summary',
        });
      }
    }

    candidates.sort((a, b) => a.priority - b.priority);

    const dueReview = candidates.find(
      (c) => c.card && (c.card.repetitions ?? 0) >= DEFAULTS.masteryReps,
    );
    if (dueReview) return dueReview;

    const dueLearning = candidates.find(
      (c) => c.card && isLearning(c.card),
    );
    if (dueLearning) return dueLearning;

    const brandNew = candidates.find((c) => c.isNew);
    if (brandNew) return brandNew;

    const anyDue = candidates.find((c) => c.card);
    if (anyDue) return anyDue;

    return candidates[0] ?? null;
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
    return { initialBatchSize, batchIncrement, activeLimit, maxActive: DEFAULTS.maxActive };
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
