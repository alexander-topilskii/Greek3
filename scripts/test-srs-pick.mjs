/**
 * Smoke-test SRS pick logic (no IndexedDB).
 * Run: node scripts/test-srs-pick.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import vm from 'vm';

const srsCode = readFileSync('site/js/srs.js', 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(srsCode, sandbox);
const srs = sandbox.window.GreekSRS;

function makeDb(cards = []) {
  const store = new Map(cards.map((c) => [c.id, { ...c }]));
  const settings = new Map();
  return {
    GLOBAL_DECK_ID: 'global',
    cardId: (slug, type, fi, dir = 'el-ru') =>
      type === 'summary' ? `${slug}#summary#${dir}` : `${slug}#form#${fi}#${dir}`,
    legacyCardId: (slug, type, fi) =>
      type === 'summary' ? `${slug}#summary` : `${slug}#form#${fi}`,
    async getAllCards() {
      return [...store.values()];
    },
    async getOrCreateCard(id, meta) {
      if (store.has(id)) return store.get(id);
      const card = {
        id,
        deckId: meta.deckId,
        wordSlug: meta.wordSlug,
        type: meta.type,
        direction: meta.direction ?? 'el-ru',
        repetitions: 0,
        nextReview: 0,
      };
      store.set(id, card);
      return card;
    },
    async putCard(card) {
      store.set(card.id, { ...card });
    },
    async getSetting(key, fallback) {
      return settings.has(key) ? settings.get(key) : fallback;
    },
    async setSetting(key, value) {
      settings.set(key, value);
    },
  };
}

function makeCatalog(n, withBlocks = true) {
  return {
    deckId: 'global',
    blockSize: 10,
    words: Array.from({ length: n }, (_, i) => ({
      slug: `word-${i}`,
      blockIndex: withBlocks ? Math.floor(i / 10) : undefined,
      formCount: 0,
      translation: `слово ${i}`,
    })),
  };
}

function masteredCard(slug, direction, reps = 3) {
  const id = `${slug}#summary#${direction}`;
  return {
    id,
    deckId: 'global',
    wordSlug: slug,
    type: 'summary',
    direction,
    repetitions: reps,
    nextReview: Date.now() + 86400000,
  };
}

async function testRepeatAfterComplete() {
  const catalog = makeCatalog(5, false);
  const cards = [
    ...catalog.words.map((w) => masteredCard(w.slug, 'el-ru', 3)),
    ...catalog.words.map((w) => masteredCard(w.slug, 'ru-el', 9)),
  ];
  const db = makeDb(cards);
  await db.setSetting('deck:lessons-51:activeLimit', 5);

  let pick = await srs.pickNextCard('lessons-51', catalog, db, {
    summaryOnly: true,
    direction: 'ru-el',
  });
  if (pick) throw new Error('Expected null when catalog fully mastered and not due');

  await srs.repeatCatalogSession('lessons-51', catalog, db, 'ru-el');
  pick = await srs.pickNextCard('lessons-51', catalog, db, {
    summaryOnly: true,
    direction: 'ru-el',
  });
  if (!pick) throw new Error('Expected pick after repeat session');
  console.log('✓ repeat session makes words pickable again');
}

async function testSlidingPoolReplacesMasteredWords() {
  const catalog = makeCatalog(10, false);
  const cards = [];
  for (let i = 0; i < 5; i++) {
    cards.push(masteredCard(`word-${i}`, 'el-ru', 3));
    cards.push(masteredCard(`word-${i}`, 'ru-el', 9));
  }
  const db = makeDb(cards);
  await db.setSetting('deck:global:activeLimit', 5);

  srs.beginSession();
  const pick = await srs.pickNextCard('global', catalog, db, {
    summaryOnly: true,
    perWordDirection: true,
  });
  srs.endSession();

  if (!pick || !/^word-[5-9]$/.test(pick.word.slug)) {
    throw new Error(`Expected word-5..9 in sliding pool, got ${pick?.word.slug}`);
  }
  console.log('✓ sliding pool replaces fully mastered words');
}

async function testPerWordDirectionMixed() {
  const catalog = makeCatalog(3, false);
  const db = makeDb();
  await db.setSetting('deck:global:activeLimit', 3);
  srs.beginSession();
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.recordSessionCorrect('word-0', 'el-ru');

  const dirs = new Set();
  for (let i = 0; i < 40; i++) {
    const pick = await srs.pickNextCard('global', catalog, db, {
      summaryOnly: true,
      perWordDirection: true,
    });
    if (pick) dirs.add(`${pick.word.slug}:${pick.direction}`);
  }
  srs.endSession();

  if (!dirs.has('word-0:ru-el')) {
    throw new Error('word-0 should appear in ru-el after el-ru session complete');
  }
  if ([...dirs].some((k) => k === 'word-0:el-ru')) {
    throw new Error('word-0 should not appear in el-ru after session complete');
  }
  console.log('✓ per-word direction after el-ru session');
}

async function testDirectionPromptBlock() {
  const catalog = makeCatalog(10, true);
  const cards = catalog.words.map((w) => masteredCard(w.slug, 'el-ru', 3));
  const prompt = srs.findBlockDirectionPrompt(catalog, cards, makeDb(cards), new Set());
  if (!prompt || prompt.wordCount !== 10) {
    throw new Error('Expected direction prompt for completed el-ru block');
  }
  console.log('✓ direction prompt when block el-ru complete');
}

async function testAutoDirection() {
  const catalog = makeCatalog(5, false);
  const cards = catalog.words.map((w) => masteredCard(w.slug, 'el-ru', 3));
  const settings = { activeLimit: 5, batchIncrement: 3, initialBatchSize: 5 };
  const dir = srs.resolveAutoDirection(catalog, cards, makeDb(cards), settings);
  if (dir !== 'ru-el') throw new Error(`Expected ru-el after el-ru mastered, got ${dir}`);
  console.log('✓ auto direction switches to ru-el');
}

async function testStudyPoolFullyMastered() {
  const catalog = makeCatalog(5, false);
  const cards = [
    ...catalog.words.map((w) => masteredCard(w.slug, 'el-ru', 3)),
    ...catalog.words.map((w) => masteredCard(w.slug, 'ru-el', 9)),
  ];
  const settings = { activeLimit: 5, batchIncrement: 3, initialBatchSize: 5 };
  const ok = srs.isStudyPoolFullyMastered(catalog, cards, makeDb(cards), settings);
  if (!ok) throw new Error('Expected study pool fully mastered');
  console.log('✓ study pool fully mastered detection');
}

async function testSessionExcludesWordAfterThreshold() {
  const catalog = makeCatalog(3, false);
  const db = makeDb();
  await db.setSetting('deck:global:activeLimit', 3);
  srs.beginSession();
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.recordSessionCorrect('word-1', 'el-ru');

  const picks = new Set();
  for (let i = 0; i < 30; i++) {
    const pick = await srs.pickNextCard('global', catalog, db, {
      summaryOnly: true,
      direction: 'el-ru',
    });
    if (pick) picks.add(pick.word.slug);
  }
  srs.endSession();

  if (picks.has('word-0')) {
    throw new Error('word-0 should be excluded after 2 session correct answers');
  }
  if (!picks.has('word-1') || !picks.has('word-2')) {
    throw new Error('word-1 and word-2 should still be pickable in session');
  }
  console.log('✓ session excludes word after threshold');
}

async function testSessionAutoDirection() {
  const catalog = makeCatalog(3, false);
  const settings = { activeLimit: 3, batchIncrement: 3, initialBatchSize: 3 };
  srs.beginSession();
  for (const w of catalog.words) {
    srs.recordSessionCorrect(w.slug, 'el-ru');
    srs.recordSessionCorrect(w.slug, 'el-ru');
  }
  const dir = srs.resolveAutoDirection(catalog, [], makeDb(), settings);
  srs.endSession();
  if (dir !== 'ru-el') {
    throw new Error(`Expected ru-el after session el-ru complete, got ${dir}`);
  }
  console.log('✓ session switches auto direction without global mastery');
}

async function testSessionResetsOnEnd() {
  const catalog = makeCatalog(2, false);
  const db = makeDb();
  await db.setSetting('deck:global:activeLimit', 2);
  srs.beginSession();
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.endSession();

  srs.beginSession();
  const pick = await srs.pickNextCard('global', catalog, db, {
    summaryOnly: true,
    direction: 'el-ru',
  });
  srs.endSession();
  if (!pick) throw new Error('Expected pick after new session started');
  console.log('✓ session resets on begin/end');
}

async function testLessonOrderReversed() {
  const { collectLessonWords } = await import('../dist/build/catalog-order.js');
  const lessonHub = {
    links: [
      { resolvedHref: 'lessons/49/index.html' },
      { resolvedHref: 'lessons/51/index.html' },
    ],
  };
  const indexPages = [
    {
      sourcePath: 'lessons/49/readme.md',
      links: [{ resolvedHref: 'verbs/word-a.html', label: 'a' }],
    },
    {
      sourcePath: 'lessons/51/readme.md',
      links: [{ resolvedHref: 'verbs/word-b.html', label: 'b' }],
    },
  ];
  const wordsByHref = {
    'verbs/word-a.html': { slug: 'verbs/word-a', title: 'a', translation: 'а' },
    'verbs/word-b.html': { slug: 'verbs/word-b', title: 'b', translation: 'б' },
  };
  const result = collectLessonWords(indexPages, lessonHub, (link) => wordsByHref[link.resolvedHref] ?? null);
  if (
    result.length !== 2 ||
    result[0].lesson !== 2 ||
    result[0].word.slug !== 'verbs/word-b'
  ) {
    throw new Error(
      `Expected lesson 51/word-b first, got ${JSON.stringify(result.map((r) => [r.lesson, r.word.slug]))}`,
    );
  }
  console.log('✓ lesson words collected from end of list');
}

async function testWordSourceLabel() {
  const word = { lesson: 51, category: 'verbs' };
  if (srs.wordSourceLabel(word, {}) !== 'Урок 51') {
    throw new Error('Expected lesson label');
  }
  const word2 = { category: 'verbs' };
  if (srs.wordSourceLabel(word2, { verbs: 'Глаголы' }) !== 'Глаголы') {
    throw new Error('Expected category label');
  }
  console.log('✓ word source label');
}

async function testNoConsecutiveSameWord() {
  srs.beginSession();
  srs.recordRecentPick('word-0', 'el-ru');
  if (!srs.isPickTooSoon('word-0', 'el-ru')) {
    throw new Error('Expected same direction blocked at distance 1');
  }
  if (!srs.isPickTooSoon('word-0', 'ru-el')) {
    throw new Error('Expected reverse direction blocked at distance 1');
  }
  srs.recordRecentPick('word-1', 'el-ru');
  if (!srs.isPickTooSoon('word-0', 'el-ru')) {
    throw new Error('Expected same direction blocked at distance 2');
  }
  if (srs.isPickTooSoon('word-0', 'ru-el')) {
    throw new Error('Reverse direction should be allowed at distance 2');
  }
  srs.recordRecentPick('word-2', 'el-ru');
  if (srs.isPickTooSoon('word-0', 'el-ru')) {
    throw new Error('Same direction should be allowed at distance 3');
  }
  srs.recordRecentPick('word-3', 'ru-el');
  if (!srs.isPickTooSoon('word-3', 'el-ru')) {
    throw new Error('Expected reverse direction blocked at distance 1');
  }
  srs.endSession();
  console.log('✓ no consecutive same word picks');
}

async function testExpandPoolOnWordLearned() {
  const catalog = makeCatalog(8, false);
  const db = makeDb();
  const settings = { activeLimit: 5, batchIncrement: 3, initialBatchSize: 5 };
  await db.setSetting('deck:global:activeLimit', 5);

  srs.beginSession();
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.recordSessionCorrect('word-0', 'el-ru');
  srs.recordSessionCorrect('word-0', 'ru-el');
  srs.recordSessionCorrect('word-0', 'ru-el');

  const newLimit = await srs.expandPoolOnWordLearned('global', catalog, db, settings);
  srs.endSession();

  if (newLimit !== 6) {
    throw new Error(`Expected activeLimit 6 after one word learned, got ${newLimit}`);
  }
  console.log('✓ pool expands by 1 when word learned');
}

async function testIsWordDoneForPoolExported() {
  if (typeof srs.isWordDoneForPool !== 'function') {
    throw new Error('isWordDoneForPool must be exported for gradeCurrent');
  }
  console.log('✓ isWordDoneForPool exported');
}

async function main() {
  await testRepeatAfterComplete();
  await testSlidingPoolReplacesMasteredWords();
  await testPerWordDirectionMixed();
  await testDirectionPromptBlock();
  await testAutoDirection();
  await testStudyPoolFullyMastered();
  await testSessionExcludesWordAfterThreshold();
  await testSessionAutoDirection();
  await testSessionResetsOnEnd();
  await testNoConsecutiveSameWord();
  await testExpandPoolOnWordLearned();
  await testIsWordDoneForPoolExported();
  await testLessonOrderReversed();
  await testWordSourceLabel();
  console.log('\nAll SRS smoke tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
