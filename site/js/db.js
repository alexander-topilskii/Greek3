(function (global) {
  const DB_NAME = 'greek3-progress';
  const DB_VERSION = 3;
  const BACKUP_KEY = 'greek3-progress-backup-v1';

  /** Единый идентификатор колоды — прогресс привязан к слову, не к разделу. */
  const GLOBAL_DECK_ID = 'global';

  const DIRECTIONS = ['el-ru', 'ru-el'];

  const MIGRATION_KEYS = ['migration:direction-v2', 'migration:global-deck-v3'];

  let dbPromise = null;
  let migrationPromise = null;
  let initPromise = null;
  let backupDirty = false;
  let backupTimer = null;

  async function ensurePersistentStorage() {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    try {
      if (await navigator.storage.persisted()) return true;
      return navigator.storage.persist();
    } catch {
      return false;
    }
  }

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

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function tx(storeName, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let settled = false;

      const finish = (handler) => (value) => {
        if (settled) return;
        settled = true;
        handler(value);
      };

      transaction.onerror = () => finish(reject)(transaction.error);
      transaction.onabort = () =>
        finish(reject)(transaction.error ?? new Error('IndexedDB transaction aborted'));

      let result;
      try {
        result = fn(store);
      } catch (err) {
        finish(reject)(err);
        return;
      }

      if (result && typeof result.then === 'function') {
        result.then(finish(resolve), finish(reject));
        return;
      }

      transaction.oncomplete = () => finish(resolve)(result);
    });
  }

  function readBackup() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.cards)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeBackup(cards) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        BACKUP_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          cards,
        }),
      );
      backupDirty = false;
    } catch (err) {
      console.error('Failed to write progress backup', err);
    }
  }

  function scheduleBackup(cards) {
    backupDirty = true;
    if (backupTimer) return;
    backupTimer = global.setTimeout(() => {
      backupTimer = null;
      if (!backupDirty) return;
      writeBackup(cards);
    }, 120);
  }

  function clearBackup() {
    backupDirty = false;
    if (backupTimer) {
      global.clearTimeout(backupTimer);
      backupTimer = null;
    }
    try {
      localStorage?.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
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

  async function putCardsBatch(cards) {
    if (!cards.length) return;
    await tx('cards', 'readwrite', (store) =>
      Promise.all(cards.map((card) => requestToPromise(store.put(card)))),
    );
  }

  const GreekDB = {
    async init() {
      if (!initPromise) {
        initPromise = (async () => {
          await ensurePersistentStorage();
          await openDb();
          await this.migrateLegacyCards();
          await this.restoreFromBackupIfNeeded();
          if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'hidden') {
                this.flushBackup().catch(() => {});
              }
            });
          }
        })();
      }
      return initPromise;
    },

    async getCard(id) {
      return tx('cards', 'readonly', (store) => requestToPromise(store.get(id)));
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
      await tx('cards', 'readwrite', (store) => requestToPromise(store.put(card)));
      const all = await this.getAllCards();
      scheduleBackup(all);
      return card;
    },

    async getAllCards() {
      const cards = await tx('cards', 'readonly', (store) =>
        requestToPromise(store.getAll()).then((result) => result ?? []),
      );
      return cards ?? [];
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
      const all = await this.getAllCards();
      return all.filter((c) => c.wordSlug === wordSlug);
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
      await tx('cards', 'readwrite', (store) => requestToPromise(store.delete(id)));
      const all = await this.getAllCards();
      scheduleBackup(all);
    },

    async clearAllCards() {
      await tx('cards', 'readwrite', (store) => requestToPromise(store.clear()));
      clearBackup();
    },

    async clearAllSettings() {
      await tx('settings', 'readwrite', (store) => requestToPromise(store.clear()));
    },

    async resetAllProgress() {
      const preserved = {};
      for (const key of MIGRATION_KEYS) {
        preserved[key] = await this.getSetting(key, false);
      }
      await this.clearAllCards();
      await this.clearAllSettings();
      for (const [key, value] of Object.entries(preserved)) {
        if (value) await this.setSetting(key, value);
      }
    },

    async getSetting(key, fallback) {
      const value = await tx('settings', 'readonly', (store) =>
        requestToPromise(store.get(key)).then((row) => row?.value),
      );
      return value ?? fallback;
    },

    async setSetting(key, value) {
      return tx('settings', 'readwrite', (store) =>
        requestToPromise(store.put({ key, value })),
      );
    },

    async flushBackup() {
      if (!backupDirty) return;
      const cards = await this.getAllCards();
      writeBackup(cards);
    },

    async restoreFromBackupIfNeeded() {
      const cards = await this.getAllCards();
      if (cards.length > 0) return false;

      const backup = readBackup();
      if (!backup?.cards?.length) return false;

      await putCardsBatch(backup.cards);
      console.info(`Restored ${backup.cards.length} cards from local backup`);
      return true;
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
        await openDb();

        const directionDone = await this.getSetting('migration:direction-v2', false);
        if (!directionDone) {
          const all = await this.getAllCards();
          const merged = mergeCardsByCanonicalId(all, (card, canonicalId) => ({
            ...card,
            id: canonicalId,
            direction: card.direction ?? 'el-ru',
          }));
          await putCardsBatch(merged);
          await this.setSetting('migration:direction-v2', true);
        }

        const globalDone = await this.getSetting('migration:global-deck-v3', false);
        if (!globalDone) {
          const all = await this.getAllCards();
          const merged = mergeCardsByCanonicalId(all, (card, canonicalId) => ({
            ...card,
            id: canonicalId,
            deckId: GLOBAL_DECK_ID,
          }));
          await putCardsBatch(merged);
          await this.setSetting('migration:global-deck-v3', true);
        }

        const cards = await this.getAllCards();
        scheduleBackup(cards);
      })().finally(() => {
        migrationPromise = null;
      });

      return migrationPromise;
    },

    GLOBAL_DECK_ID,
  };

  global.GreekDB = GreekDB;
})(window);
