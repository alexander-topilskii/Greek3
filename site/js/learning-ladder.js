(function (global) {
  const utils = global.GreekUtils;
  const STEPS = {
    SUMMARY: 'summary',
    QUIZ: 'quiz',
    SPELL: 'spell',
    MATCH: 'match',
  };

  const STEP_ORDER = [STEPS.SUMMARY, STEPS.QUIZ, STEPS.SPELL, STEPS.MATCH];

  const SPELL_EXTRA_LETTERS = 2;
  const SPELL_MAX_LENGTH = 18;
  const GREEK_DECOY_LETTERS = 'αβγδεζηθικλμνξοπρστυφχψωάέήίόύώ';

  function shuffle(arr) {
    return utils ? utils.shuffle(arr) : arr.slice();
  }

  function escapeHtml(text) {
    return utils ? utils.escapeHtml(text) : String(text);
  }

  /** @param {import('./types').CatalogWord} word */
  function getBaseFormPairs(word) {
    const greekForms = word.baseForms?.length
      ? word.baseForms
      : word.forms?.length
        ? word.forms.slice(0, 3).map((f) => f.greek)
        : word.primaryGreek
          ? [word.primaryGreek]
          : [];

    return greekForms
      .map((greek) => {
        const exact = word.forms?.find((f) => f.greek === greek);
        return {
          greek,
          translation: exact?.translation ?? word.translation,
        };
      })
      .filter((p) => p.greek && p.translation);
  }

  /**
   * Conjugation blocks from anchor baseForms (past / present / future).
   * @param {import('./types').CatalogWord} word
   */
  function getFormBlocks(word) {
    if (!word.forms?.length) return [];

    const base = word.baseForms ?? [];
    if (base.length < 2) return [word.forms];

    const indices = base
      .map((g) => word.forms.findIndex((f) => f.greek === g))
      .filter((i) => i >= 0);

    if (indices.length < 2) return [word.forms];

    const blocks = [];
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : word.forms.length;
      blocks.push(word.forms.slice(start, end));
    }
    return blocks;
  }

  /**
   * 3–4 pairs for matching: 1-е лицо по временам + 2-е лицо где возможно.
   * @param {import('./types').CatalogWord} word
   * @param {number} maxPairs
   */
  function getMatchPairs(word, maxPairs = 4) {
    const blocks = getFormBlocks(word);
    const pairs = [];
    const seen = new Set();

    function pushPair(pair) {
      const key = `${pair.greek}::${pair.translation}`;
      if (seen.has(key) || pairs.length >= maxPairs) return;
      seen.add(key);
      pairs.push(pair);
    }

    for (const block of blocks.slice(0, 3)) {
      if (block[0]) pushPair({ greek: block[0].greek, translation: block[0].translation });
    }

    if (pairs.length < maxPairs && blocks[0]?.[1]) {
      pushPair({ greek: blocks[0][1].greek, translation: blocks[0][1].translation });
    }
    if (pairs.length < maxPairs && blocks[1]?.[1]) {
      pushPair({ greek: blocks[1][1].greek, translation: blocks[1][1].translation });
    }

    if (pairs.length < 2) {
      for (const p of getBaseFormPairs(word)) {
        pushPair(p);
        if (pairs.length >= maxPairs) break;
      }
    }

    return pairs.slice(0, maxPairs);
  }

  function pickRandomPair(pairs) {
    if (!pairs.length) return null;
    return pairs[Math.floor(Math.random() * pairs.length)];
  }

  function normalizeGreek(text) {
    return String(text ?? '').normalize('NFC');
  }

  function splitGreekLetters(text) {
    return [...normalizeGreek(text)];
  }

  /** @param {import('./types').CatalogWord} word */
  function getSpellablePairs(word) {
    return getBaseFormPairs(word).filter((pair) => {
      const greek = normalizeGreek(pair.greek);
      if (!greek || greek.includes(' ')) return false;
      const letters = splitGreekLetters(greek);
      return letters.length >= 2 && letters.length <= SPELL_MAX_LENGTH;
    });
  }

  function pickSpellPair(word) {
    return pickRandomPair(getSpellablePairs(word));
  }

  function buildSpellLetterBank(greek, extraCount = SPELL_EXTRA_LETTERS) {
    const letters = splitGreekLetters(greek);
    const inWord = new Set(letters);
    const decoys = [];
    const pool = shuffle([...GREEK_DECOY_LETTERS]);

    for (const ch of pool) {
      if (decoys.length >= extraCount) break;
      if (!inWord.has(ch)) decoys.push(ch);
    }

    while (decoys.length < extraCount) {
      for (const ch of pool) {
        if (decoys.length >= extraCount) break;
        decoys.push(ch);
      }
      break;
    }

    const bank = letters
      .map((char, index) => ({ id: index, char }))
      .concat(decoys.map((char, index) => ({ id: letters.length + index, char })));

    return shuffle(bank);
  }

  /**
   * @param {import('./types').CatalogWord[]} poolWords
   * @param {import('./types').CatalogWord} word
   * @param {'el-ru'|'ru-el'} direction
   */
  function buildQuizOptions(poolWords, word, correctPair, direction) {
    const distractors = [];
    const used = new Set();

    function keyFor(w, pair) {
      return direction === 'el-ru' ? pair.translation : pair.greek;
    }

    const correctKey = keyFor(word, correctPair);
    used.add(correctKey);

    const shuffledPool = shuffle(
      poolWords.filter((w) => w.slug !== word.slug),
    );

    for (const other of shuffledPool) {
      if (distractors.length >= 3) break;
      const candidates = getBaseFormPairs(other);
      const pick = candidates[0] ?? {
        greek: other.primaryGreek ?? other.forms?.[0]?.greek ?? '',
        translation: other.translation,
      };
      const val = keyFor(other, pick);
      if (!val || used.has(val)) continue;
      used.add(val);
      distractors.push(val);
    }

    while (distractors.length < 3) {
      for (const other of shuffle(poolWords)) {
        if (distractors.length >= 3) break;
        if (other.slug === word.slug) continue;
        const alt = getBaseFormPairs(other);
        for (const p of alt.slice(1)) {
          const val = keyFor(other, p);
          if (!val || used.has(val)) continue;
          used.add(val);
          distractors.push(val);
          if (distractors.length >= 3) break;
        }
      }
      break;
    }

    return shuffle([correctKey, ...distractors.slice(0, 3)]);
  }

  /**
   * @param {*} card
   * @param {*} srs
   */
  function shouldUseLadder(card, srs) {
    if (!card) return true;
    if (srs.isMastered(card)) return false;
    if ((card.direction ?? 'el-ru') === 'ru-el') return false;
    return true;
  }

  function stepIndex(step) {
    const idx = STEP_ORDER.indexOf(step);
    return idx >= 0 ? idx : 0;
  }

  function stepFromIndex(index) {
    return STEP_ORDER[Math.max(0, Math.min(STEP_ORDER.length - 1, index))] ?? STEPS.SUMMARY;
  }

  function learningStepToName(index) {
    return stepFromIndex(index ?? 0);
  }

  function nameToLearningStep(name) {
    return stepIndex(name ?? STEPS.SUMMARY);
  }

  /**
   * Spell step: word mastered + (seen earlier in session OR spell done perfectly before).
   * @param {import('./types').CatalogWord} word
   * @param {*} card
   * @param {{ isMastered: (card: *) => boolean, hasPriorSessionShow: (slug: string) => boolean }} session
   */
  function isSpellEligible(word, card, session) {
    if (!word || !getSpellablePairs(word).length) return false;
    if (!card || !session?.isMastered?.(card)) return false;
    if (card.spellPerfect) return true;
    return Boolean(session?.hasPriorSessionShow?.(card.wordSlug));
  }

  /**
   * Mini-games after summary (quiz / spell / match).
   * @param {import('./types').CatalogWord} word
   * @param {{ spellEligible?: boolean }} [options]
   */
  function buildLearningPath(word, options = {}) {
    const { spellEligible = false } = options;
    const steps = [];
    if (getBaseFormPairs(word).length) steps.push(STEPS.QUIZ);
    if (spellEligible && getSpellablePairs(word).length) steps.push(STEPS.SPELL);
    if (getMatchPairs(word).length >= 2) steps.push(STEPS.MATCH);
    return steps;
  }

  function filterSpellFromPath(path) {
    if (!Array.isArray(path)) return [];
    return path.filter((step) => step !== STEPS.SPELL);
  }

  function isLastLadderGame(learningStep, path) {
    if (!Array.isArray(path) || !path.length) return false;
    const stepIdx = learningStep ?? 1;
    return stepIdx >= path.length;
  }

  function learningPathStepName(path, pathIndex) {
    return path?.[pathIndex] ?? null;
  }

  function isSummaryLearningStep(stepIndex) {
    return (stepIndex ?? 0) === 0;
  }

  /** Summary done; quiz or match still pending on this card. */
  function hasPendingLearningGame(card) {
    if (!card) return false;
    const stepIdx = card.learningStep ?? 0;
    if (stepIdx === 0) return false;
    const path = card.learningPath;
    if (!Array.isArray(path) || !path.length) return false;
    return stepIdx >= 1 && stepIdx <= path.length;
  }

  global.GreekLearningLadder = {
    STEPS,
    STEP_ORDER,
    shuffle,
    escapeHtml,
    getBaseFormPairs,
    getFormBlocks,
    getMatchPairs,
    getSpellablePairs,
    pickSpellPair,
    buildSpellLetterBank,
    pickRandomPair,
    buildQuizOptions,
    shouldUseLadder,
    stepIndex,
    stepFromIndex,
    learningStepToName,
    nameToLearningStep,
    isSpellEligible,
    buildLearningPath,
    filterSpellFromPath,
    isLastLadderGame,
    learningPathStepName,
    isSummaryLearningStep,
    hasPendingLearningGame,
  };
})(window);
