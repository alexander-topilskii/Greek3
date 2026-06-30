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
  const cards = catalog.words.map((w) => masteredCard(w.slug, 'ru-el', 9));
  const db = makeDb(cards);
  await db.setSetting('deck:lessons-51:activeLimit', 5);

  let pick = await srs.pickNextCard('lessons-51', catalog, db, {
    summaryOnly: true,
    direction: 'ru-el',
  });
  if (pick) throw new Error('Expected null when all mastered and not due');

  await srs.repeatCatalogSession('lessons-51', catalog, db, 'ru-el');
  pick = await srs.pickNextCard('lessons-51', catalog, db, {
    summaryOnly: true,
    direction: 'ru-el',
  });
  if (!pick) throw new Error('Expected pick after repeat session');
  console.log('✓ repeat session makes words pickable again');
}

async function testNoExpandBeforeBlockComplete() {
  const catalog = makeCatalog(15, true);
  const cards = [];
  for (let i = 0; i < 5; i++) {
    cards.push(masteredCard(`word-${i}`, 'el-ru', 3));
  }
  const db = makeDb(cards);
  await db.setSetting('deck:global:activeLimit', 5);
  await db.setSetting('deck:global:initialBatchSize', 5);
  await db.setSetting('deck:global:batchIncrement', 3);

  const before = await db.getSetting('deck:global:activeLimit', 5);
  const pick = await srs.pickNextCard('global', catalog, db, {
    summaryOnly: true,
    direction: 'el-ru',
  });
  const after = await db.getSetting('deck:global:activeLimit', 5);

  if (after > before) {
    throw new Error(`activeLimit expanded ${before} -> ${after} before block complete`);
  }
  if (!pick || pick.word.slug === 'word-5') {
    throw new Error('Should review in-block words, not expand to word-5');
  }
  console.log('✓ does not expand past incomplete block (picked', pick.word.slug + ')');
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

async function main() {
  await testRepeatAfterComplete();
  await testNoExpandBeforeBlockComplete();
  await testDirectionPromptBlock();
  console.log('\nAll SRS smoke tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
