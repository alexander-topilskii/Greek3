(function (global) {
  const DB_NAME = 'greek3-progress';
  const DB_VERSION = 2;

  const DIRECTIONS = ['el-ru', 'ru-el'];

  let dbPromise = null;

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

    async getDeckCards(deckId) {
      return tx('cards', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () =>
            resolve((req.result ?? []).filter((c) => c.deckId === deckId));
          req.onerror = () => reject(req.error);
        });
      });
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
      const cards = await this.getDeckCards(deckId);
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
      const done = await this.getSetting('migration:direction-v2', false);
      if (done) return;

      const all = await tx('cards', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result ?? []);
          req.onerror = () => reject(req.error);
        });
      });

      for (const card of all) {
        if (card.direction) continue;
        const direction = 'el-ru';
        const newId = this.cardId(card.wordSlug, card.type, card.formIndex, direction);
        const updated = { ...card, id: newId, direction };
        await this.putCard(updated);
        if (newId !== card.id) await this.deleteCard(card.id);
      }

      await this.setSetting('migration:direction-v2', true);
    },
  };

  global.GreekDB = GreekDB;
})(window);
