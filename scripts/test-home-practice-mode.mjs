import assert from 'assert';
import { readFileSync } from 'fs';
import vm from 'vm';

const homePracticeSrc = readFileSync('site/js/home-practice.js', 'utf8');

function setupEnv({ mode, hasFavorites = true }) {
  const fullCatalog = {
    deckId: 'global',
    words: [
      { slug: 'word-1', label: 'слово 1', formCount: 1 },
      { slug: 'word-2', label: 'слово 2', formCount: 1 },
      { slug: 'word-3', label: 'слово 3', formCount: 1 },
    ],
  };

  const filteredCatalog = {
    ...fullCatalog,
    words: [
      { slug: 'word-1', label: 'слово 1', formCount: 1 },
    ],
  };

  const fakeScope = {
    dataset: {
      learningPractice: '',
      learningMode: mode,
    },
  };

  const listeners = [];
  const fakeFavorites = {
    hasAnyFavorites: () => hasFavorites,
    filterCatalog: (cat) => filteredCatalog,
    onChange: (fn) => listeners.push(fn),
  };

  const elements = new Map();
  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        querySelector: () => null,
        querySelectorAll: () => [],
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {},
          contains: () => false,
        },
        setAttribute: () => {},
        removeAttribute: () => {},
        addEventListener: () => {},
        textContent: '',
      });
    }
    return elements.get(id);
  }

  getOrCreateElement('global-catalog').textContent = JSON.stringify(fullCatalog);
  getOrCreateElement('continue-hint').textContent = '';

  const sandbox = {
    window: {
      addEventListener: () => {},
      GreekFavorites: fakeFavorites,
      GreekDB: {
        GLOBAL_DECK_ID: 'global',
        init: async () => {},
        getCardsForSlugs: async (slugs) => slugs.map((slug) => ({
          wordSlug: slug,
          type: 'summary',
          direction: 'el-ru',
          repetitions: 0,
        })),
      },
      GreekSRS: {
        DEFAULTS: { initialBatchSize: 10 },
        loadRecentPicks: async () => {},
        beginSession: () => {},
        endSession: () => {},
        loadDeckSettings: async () => ({ activeLimit: 10 }),
        getActivePoolWords: (catalog) => catalog.words,
        resolveAutoDirection: () => 'el-ru',
        getPoolProgress: (pool) => ({
          learned: 0,
          directionLearning: 0,
          total: pool.length,
          directionMastered: 0,
        }),
        isCatalogFullyMastered: () => false,
      },
      GreekFlashcard: {},
      GreekLearningLadder: {
        STEPS: { SUMMARY: 'summary' },
      },
      GreekQuizStep: {},
      GreekMatchStep: {},
      GreekSpellStep: {},
      GreekClozeStep: {},
      GreekBuildStep: {},
      GreekPracticeCommon: {},
    },
    document: {
      querySelector: (selector) => {
        if (selector === '[data-learning-practice]') return fakeScope;
        return null;
      },
      querySelectorAll: () => [],
      getElementById: (id) => getOrCreateElement(id),
      addEventListener: () => {},
      body: {
        classList: {
          add: () => {},
          remove: () => {},
        },
      },
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(homePracticeSrc, sandbox);

  return { sandbox, elements, fullCatalog, filteredCatalog };
}

// 1. Home mode with favorites present -> should use full catalog words count (3), NOT favorites count (1)
{
  const { elements } = setupEnv({ mode: 'home', hasFavorites: true });
  // Wait a microtick for async init
  await new Promise((r) => setTimeout(r, 20));
  const hint = elements.get('continue-hint').textContent;
  assert(hint.includes('3'), `Home hint should reflect full catalog (3 words), got: "${hint}"`);
  assert(!hint.includes('избранных'), `Home hint should not say "избранных", got: "${hint}"`);
  console.log('✓ Home mode always uses regular flow despite favorites present');
}

// 2. Favorites mode with favorites present -> should use filtered catalog (1) and say "избранных"
{
  const { elements } = setupEnv({ mode: 'favorites', hasFavorites: true });
  await new Promise((r) => setTimeout(r, 20));
  const hint = elements.get('continue-hint').textContent;
  assert(hint.includes('1'), `Favorites hint should reflect favorite words count (1), got: "${hint}"`);
  assert(hint.includes('избранных'), `Favorites hint should say "избранных", got: "${hint}"`);
  console.log('✓ Favorites mode uses favorites catalog');
}
