(function (global) {
  const SIMPLE_LEARNING_KEY = 'practice:simpleLearning';

  async function isSimpleLearning(db) {
    return Boolean(await db.getSetting(SIMPLE_LEARNING_KEY, false));
  }

  async function setSimpleLearning(db, enabled) {
    await db.setSetting(SIMPLE_LEARNING_KEY, Boolean(enabled));
  }

  async function clearAllLearningLadderStates(db) {
    const cards = await db.getAllCards();
    const updates = cards
      .filter((card) => (card.learningStep ?? 0) > 0 || card.learningPath)
      .map((card) => ({
        ...card,
        learningStep: 0,
        learningPath: undefined,
      }));

    for (const card of updates) {
      await db.putCard(card);
    }
  }

  global.GreekAppSettings = {
    SIMPLE_LEARNING_KEY,
    isSimpleLearning,
    setSimpleLearning,
    clearAllLearningLadderStates,
  };
})(window);
