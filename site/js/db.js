(function (global) {
  const DB_NAME = 'greek3-progress';
  const DB_VERSION = 3;

  /** Единый идентификатор колоды — прогресс привязан к слову, не к разделу. */
  const GLOBAL_DECK_ID = 'global';

  const DIRECTIONS = ['el-ru', 'ru-el'];

  let dbPromise = null;
  let migrationPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === 'undefined') {
      dbPromise = Promise.reject(new Error('IndexedDB unavailable'));
      return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
    return dbPromise;
  }

  async function tx(storeName, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      try {
        result = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function defaultCard(id, deckId, wordSlug, type, formIndex, direction) {
    return {
      id,
      deckId,
      wordSlug,
      type,
      formIndex: formIndex ?? null,
      direction: direction ?? 'el-ru',
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: 0,
      lastReview: 0,
      remembered: 0,
      forgotten: 0,
    };
  }

  function mergeCardStats(target, source) {
    target.repetitions = Math.max(target.repetitions ?? 0, source.repetitions ?? 0);
    target.remembered = Math.max(target.remembered ?? 0, source.remembered ?? 0);
    target.forgotten = Math.max(target.forgotten ?? 0, source.forgotten ?? 0);
    target.lastReview = Math.max(target.lastReview ?? 0, source.lastReview ?? 0);
    target.nextReview = Math.min(target.nextReview || 0, source.nextReview || 0);
    target.ease = Math.max(target.ease ?? 2.5, source.ease ?? 2.5);
    target.interval = Math.max(target.interval ?? 0, source.interval ?? 0);
    return target;
  }

  function normalizeCardId(card) {
    const direction = card.direction ?? 'el-ru';
    if (card.type === 'summary') return `${card.wordSlug}#summary#${direction}`;
    return `${card.wordSlug}#form#${card.formIndex}#${direction}`;
  }

  async function replaceAllCards(cards) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cards'], 'readwrite');
      const store = transaction.objectStore('cards');
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => {
        for (const card of cards) {
          store.put(card);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function mergeCardsByCanonicalId(cards, mapCard) {
    const byId = new Map();
    for (const card of cards) {
      const canonicalId = normalizeCardId(card);
      const normalized = mapCard(card, canonicalId);
      const existing = byId.get(canonicalId);
      if (!existing) {
        byId.set(canonicalId, normalized);
        continue;
      }
      mergeCardStats(existing, normalized);
    }
    return [...byId.values()];
  }

  const GreekDB = {
    async getCard(id) {
      return tx('cards', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => reject(req.error);
        });
      });
    },

    async getOrCreateCard(id, meta) {
      const existing = await this.getCard(id);
      if (existing) return existing;
      const card = defaultCard(
        id,
        meta.deckId,
        meta.wordSlug,
        meta.type,
        meta.formIndex,
        meta.direction,
      );
      await this.putCard(card);
      return card;
    },

    async putCard(card) {
      return tx('cards', 'readwrite', (store) => store.put(card));
    },

    async getAllCards() {
      return tx('cards', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result ?? []);
          req.onerror = () => reject(req.error);
        });
      });
    },

    async getDeckCards(deckId) {
      const all = await this.getAllCards();
      return all.filter((c) => c.deckId === deckId || c.deckId === GLOBAL_DECK_ID);
    },

    async getCardsForSlugs(slugs) {
      const set = new Set(slugs);
      const all = await this.getAllCards();
      return all.filter((c) => set.has(c.wordSlug));
    },

    async getWordCards(wordSlug) {
      return tx('cards', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () =>
            resolve((req.result ?? []).filter((c) => c.wordSlug === wordSlug));
          req.onerror = () => reject(req.error);
        });
      });
    },

    async deleteWordCards(wordSlug) {
      const cards = await this.getWordCards(wordSlug);
      await Promise.all(cards.map((c) => this.deleteCard(c.id)));
    },

    async deleteDeckCards(deckId) {
      const all = await this.getAllCards();
      await Promise.all(
        all
          .filter((c) => c.deckId === deckId || c.deckId === GLOBAL_DECK_ID)
          .map((c) => this.deleteCard(c.id)),
      );
    },

    async deleteCardsForSlugs(slugs) {
      const cards = await this.getCardsForSlugs(slugs);
      await Promise.all(cards.map((c) => this.deleteCard(c.id)));
    },

    async deleteCard(id) {
      return tx('cards', 'readwrite', (store) => store.delete(id));
    },

    async getSetting(key, fallback) {
      return tx('settings', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result?.value ?? fallback);
          req.onerror = () => reject(req.error);
        });
      });
    },

    async setSetting(key, value) {
      return tx('settings', 'readwrite', (store) =>
        store.put({ key, value }),
      );
    },

    cardId(wordSlug, type, formIndex, direction = 'el-ru') {
      if (type === 'summary') return `${wordSlug}#summary#${direction}`;
      return `${wordSlug}#form#${formIndex}#${direction}`;
    },

    legacyCardId(wordSlug, type, formIndex) {
      if (type === 'summary') return `${wordSlug}#summary`;
      return `${wordSlug}#form#${formIndex}`;
    },

    DIRECTIONS,

    async migrateLegacyCards() {
      if (migrationPromise) return migrationPromise;

      migrationPromise = (async () => {
        const directionDone = await this.getSetting('migration:direction-v2', false);
        if (!directionDone) {
          const all = await this.getAllCards();
          const merged = mergeCardsByCanonicalId(all, (card, canonicalId) => ({
            ...card,
            id: canonicalId,
            direction: card.direction ?? 'el-ru',
          }));
          await replaceAllCards(merged);
          await this.setSetting('migration:direction-v2', true);
        }

        const globalDone = await this.getSetting('migration:global-deck-v3', false);
        if (globalDone) return;

        const all = await this.getAllCards();
        const merged = mergeCardsByCanonicalId(all, (card, canonicalId) => ({
          ...card,
          id: canonicalId,
          deckId: GLOBAL_DECK_ID,
        }));
        await replaceAllCards(merged);
        await this.setSetting('migration:global-deck-v3', true);
      })().finally(() => {
        migrationPromise = null;
      });

      return migrationPromise;
    },

    GLOBAL_DECK_ID,
  };

  global.GreekDB = GreekDB;
})(window);
