(function (global) {
  const utils = global.GreekUtils;
  const STEPS = {
    SUMMARY: 'summary',
    QUIZ: 'quiz',
    SPELL: 'spell',
    MATCH: 'match',
    CLOZE: 'cloze',
    BUILD: 'build',
  };

  const STEP_ORDER = [
    STEPS.SUMMARY,
    STEPS.QUIZ,
    STEPS.SPELL,
    STEPS.MATCH,
    STEPS.CLOZE,
    STEPS.BUILD,
  ];

  const SPELL_EXTRA_LETTERS = 2;
  const SPELL_MAX_LENGTH = 18;
  const GREEK_DECOY_LETTERS = 'αβγδεζηθικλμνξοπρστυφχψωάέήίόύώ';

  /** Диапазоны греческих букв (для границ слова в примерах). */
  const GREEK_LETTER_RANGE = '\\u0370-\\u03FF\\u1F00-\\u1FFF';
  const CLOZE_MAX_ITEMS = 3;

  const BUILD_MAX_ITEMS = 3;
  const BUILD_MIN_TOKENS = 3;
  const BUILD_MAX_TOKENS = 8;
  const BUILD_EXTRA_WORDS = 2;
  /** Запасные слова-помехи, если в пуле мало кандидатов. */
  const BUILD_FALLBACK_DECOYS = [
    'και', 'να', 'με', 'σε', 'για', 'το', 'η', 'ο', 'ένα', 'μια',
    'πολύ', 'εδώ', 'τώρα', 'αλλά', 'όχι', 'ναι', 'μου', 'σου',
  ];

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

  function escapeRegExp(text) {
    return String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Уникальные греческие формы слова (для поиска в примере), длинные первыми. */
  function getClozeForms(word) {
    const set = new Set();
    (word.baseForms ?? []).forEach((g) => {
      if (g) set.add(String(g).trim());
    });
    (word.forms ?? []).forEach((f) => {
      if (f?.greek) set.add(String(f.greek).trim());
    });
    return [...set].filter(Boolean).sort((a, b) => b.length - a.length);
  }

  /** Находит форму как отдельное слово в предложении (без учёта регистра). */
  function findFormInSentence(sentence, form) {
    const text = String(sentence ?? '');
    const target = String(form ?? '').trim();
    if (!text || !target) return null;
    const pattern = new RegExp(
      `(^|[^${GREEK_LETTER_RANGE}])(${escapeRegExp(target)})(?![${GREEK_LETTER_RANGE}])`,
      'iu',
    );
    const match = pattern.exec(text);
    if (!match) return null;
    const start = match.index + match[1].length;
    return { start, end: start + match[2].length, text: match[2] };
  }

  /**
   * Cloze-задания: предложение из «Контекста» с пропущенной формой слова.
   * @param {import('./types').CatalogWord} word
   * @param {number} maxItems
   */
  function getClozeItems(word, maxItems = CLOZE_MAX_ITEMS) {
    const examples = word?.examples ?? [];
    if (!examples.length) return [];
    const forms = getClozeForms(word);
    if (!forms.length) return [];

    const items = [];
    const seen = new Set();

    for (const example of examples) {
      const sentence = String(example?.greek ?? '').trim();
      if (!sentence) continue;

      let hit = null;
      for (const form of forms) {
        hit = findFormInSentence(sentence, form);
        if (hit) break;
      }
      if (!hit) continue;

      const key = `${sentence}::${hit.start}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        sentence,
        before: sentence.slice(0, hit.start),
        after: sentence.slice(hit.end),
        answer: hit.text,
        translation: String(example?.translation ?? '').trim(),
      });
      if (items.length >= maxItems) break;
    }

    return items;
  }

  /** true, если строка начинается с заглавной буквы (начало предложения). */
  function startsUppercase(text) {
    const first = String(text ?? '').charAt(0);
    if (!first) return false;
    return (
      first === first.toLocaleUpperCase('el') &&
      first !== first.toLocaleLowerCase('el')
    );
  }

  /** Приводит первую букву варианта к нужному регистру. */
  function matchFirstLetterCase(text, capitalize) {
    const value = String(text ?? '');
    if (!value) return value;
    const first = value.charAt(0);
    const normalized = capitalize
      ? first.toLocaleUpperCase('el')
      : first.toLocaleLowerCase('el');
    return normalized + value.slice(1);
  }

  /**
   * 4 варианта для cloze: правильная форма + греческие формы других слов.
   * Регистр всех вариантов подгоняется под правильный ответ: если пропуск в
   * начале предложения (ответ с заглавной) — все варианты с заглавной, если в
   * середине (ответ строчный) — все со строчной.
   * @param {import('./types').CatalogWord[]} poolWords
   * @param {import('./types').CatalogWord} word
   * @param {string} answer
   */
  function buildClozeOptions(poolWords, word, answer) {
    const used = new Set([answer]);
    const distractors = [];

    const shuffledPool = shuffle(
      (poolWords ?? []).filter((w) => w.slug !== word.slug),
    );

    for (const other of shuffledPool) {
      if (distractors.length >= 3) break;
      const pairs = getBaseFormPairs(other);
      const greek =
        pairs[0]?.greek ?? other.primaryGreek ?? other.forms?.[0]?.greek ?? '';
      if (!greek || used.has(greek)) continue;
      used.add(greek);
      distractors.push(greek);
    }

    if (distractors.length < 3) {
      for (const form of word.forms ?? []) {
        if (distractors.length >= 3) break;
        const greek = form?.greek ?? '';
        if (!greek || used.has(greek)) continue;
        used.add(greek);
        distractors.push(greek);
      }
    }

    const capitalize = startsUppercase(answer);
    const normalizedDistractors = distractors
      .slice(0, 3)
      .map((text) => matchFirstLetterCase(text, capitalize));
    return shuffle([answer, ...normalizedDistractors]);
  }

  /** Убирает завершающую пунктуацию предложения (. ! ; · …). */
  function stripSentencePunctuation(sentence) {
    return String(sentence ?? '')
      .trim()
      .replace(/[.!;·…]+$/u, '')
      .trim();
  }

  /** Токен без пунктуации и регистра — для сравнения слов между собой. */
  function wordKey(token) {
    return String(token ?? '')
      .normalize('NFC')
      .toLocaleLowerCase('el')
      .replace(/[.,;!·:»«"'()]/gu, '')
      .trim();
  }

  /**
   * Задания «собери предложение»: слова примера вперемешку → собрать по-гречески.
   * Направление всегда Ру → Ελ (показываем перевод, собираем греческий).
   * @param {import('./types').CatalogWord} word
   * @param {number} maxItems
   */
  function getSentenceBuildItems(word, maxItems = BUILD_MAX_ITEMS) {
    const examples = word?.examples ?? [];
    if (!examples.length) return [];

    const items = [];
    const seen = new Set();

    for (const example of examples) {
      const translation = String(example?.translation ?? '').trim();
      const core = stripSentencePunctuation(example?.greek);
      if (!translation || !core) continue;

      const tokens = core.split(/\s+/u).filter(Boolean);
      if (tokens.length < BUILD_MIN_TOKENS || tokens.length > BUILD_MAX_TOKENS) {
        continue;
      }

      const key = tokens.join('|').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        sentence: String(example?.greek ?? '').trim(),
        translation,
        tokens,
      });
      if (items.length >= maxItems) break;
    }

    return items;
  }

  /**
   * Банк слов для сборки: токены предложения + несколько слов-помех.
   * @param {import('./types').CatalogWord[]} poolWords
   * @param {import('./types').CatalogWord} word
   * @param {string[]} tokens
   * @param {number} extraCount
   */
  function buildSentenceOptions(poolWords, word, tokens, extraCount = BUILD_EXTRA_WORDS) {
    const answerKeys = new Set(tokens.map(wordKey));
    const usedKeys = new Set(answerKeys);
    const decoys = [];

    function tryDecoy(candidate) {
      const text = String(candidate ?? '').trim();
      if (!text || text.includes(' ')) return;
      const key = wordKey(text);
      if (!key || usedKeys.has(key)) return;
      usedKeys.add(key);
      decoys.push(text);
    }

    const shuffledPool = shuffle(
      (poolWords ?? []).filter((w) => w.slug !== word.slug),
    );
    for (const other of shuffledPool) {
      if (decoys.length >= extraCount) break;
      const pairs = getBaseFormPairs(other);
      tryDecoy(pairs[0]?.greek ?? other.primaryGreek ?? other.forms?.[0]?.greek);
    }

    if (decoys.length < extraCount) {
      for (const fallback of shuffle(BUILD_FALLBACK_DECOYS)) {
        if (decoys.length >= extraCount) break;
        tryDecoy(fallback);
      }
    }

    const bank = tokens
      .map((text, index) => ({ id: index, text, decoy: false }))
      .concat(
        decoys
          .slice(0, extraCount)
          .map((text, index) => ({ id: tokens.length + index, text, decoy: true })),
      );

    return { bank: shuffle(bank), decoys: decoys.slice(0, extraCount) };
  }

  /**
   * Mini-games after summary (quiz / spell / match / cloze / build).
   * @param {import('./types').CatalogWord} word
   * @param {{ spellEligible?: boolean }} [options]
   */
  function buildLearningPath(word, options = {}) {
    const { spellEligible = false } = options;
    const steps = [];
    if (getBaseFormPairs(word).length) steps.push(STEPS.QUIZ);
    if (spellEligible && getSpellablePairs(word).length) steps.push(STEPS.SPELL);
    if (getMatchPairs(word).length >= 2) steps.push(STEPS.MATCH);
    if (getClozeItems(word).length) steps.push(STEPS.CLOZE);
    if (getSentenceBuildItems(word).length) steps.push(STEPS.BUILD);
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
    getClozeItems,
    buildClozeOptions,
    getSentenceBuildItems,
    buildSentenceOptions,
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
