(function (global) {
  const schedule = global.GreekSRSSchedule;
  const { DEFAULTS, DIRECTIONS, getSummaryCard, isMastered, isDue } = schedule;

  let sessionActive = false;
  /** @type {Map<string, number>} */
  const sessionCorrect = new Map();
  let sessionCardsSinceReview = 0;
  /** @type {{ slug: string, direction: string }[]} */
  const recentPicks = [];
  const RECENT_PICK_HISTORY = 10;
  const SAME_DIRECTION_GAP = 3;
  const REVERSE_DIRECTION_GAP = 8;
  const RECENT_PICKS_KEY = 'practice:recentPicks';

  function sessionKey(slug, direction) {
    return `${slug}#${direction}`;
  }

  function beginSession() {
    sessionActive = true;
    sessionCorrect.clear();
    sessionCardsSinceReview = 0;
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

  function endSession(db) {
    sessionActive = false;
    sessionCorrect.clear();
    sessionCardsSinceReview = 0;
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

  function isSessionSatisfied(slug, direction, cards, db, now = Date.now()) {
    const card = cards && db ? getSummaryCard(cards, slug, direction, db) : null;
    if (card && isMastered(card) && !isDue(card, now)) {
      return true;
    }
    const threshold =
      card && isMastered(card)
        ? DEFAULTS.sessionReviewThreshold
        : DEFAULTS.sessionCorrectThreshold;
    return getSessionCorrect(slug, direction) >= threshold;
  }

  function poolSessionSatisfiedInDirection(poolWords, direction, cards, db) {
    if (!poolWords.length) return false;
    return poolWords.every((w) =>
      isSessionSatisfied(w.slug, direction, cards, db),
    );
  }

  function isWordDoneForPool(slug, cards, db, now = Date.now()) {
    if (
      sessionActive &&
      isSessionSatisfied(slug, 'el-ru', cards, db, now) &&
      isSessionSatisfied(slug, 'ru-el', cards, db, now)
    ) {
      return true;
    }
    if (!schedule.isWordFullyDoneGlobal(slug, cards, db)) return false;
    for (const dir of DIRECTIONS) {
      const card = getSummaryCard(cards, slug, dir, db);
      if (card && isDue(card, now)) return false;
    }
    return true;
  }

  function getSessionState() {
    return { sessionActive, sessionCardsSinceReview };
  }

  function setSessionCardsSinceReview(value) {
    sessionCardsSinceReview = value;
  }

  function incrementSessionCardsSinceReview() {
    sessionCardsSinceReview += 1;
  }

  global.GreekSRSSession = {
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
    filterRecentPicks,
    getSessionState,
    setSessionCardsSinceReview,
    incrementSessionCardsSinceReview,
  };
})(window);
