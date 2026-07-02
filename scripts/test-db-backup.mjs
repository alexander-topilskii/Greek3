/**
 * Smoke-test IndexedDB + localStorage backup layer.
 * Run: node scripts/test-db-backup.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import vm from 'vm';

const dbCode = readFileSync('site/js/db.js', 'utf8');

function makeLocalStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function makeIndexedDB() {
  const stores = {
    cards: new Map(),
    settings: new Map(),
  };

  function makeStore(name) {
    const s = stores[name];
    return {
      get(key) {
        const r = { result: undefined, onsuccess: null, onerror: null };
        setTimeout(() => {
          r.result = name === 'settings' ? s.get(key) : s.get(key);
          r.onsuccess?.({ target: r });
        }, 0);
        return r;
      },
      getAll() {
        const r = { result: [...s.values()], onsuccess: null, onerror: null };
        setTimeout(() => r.onsuccess?.({ target: r }), 0);
        return r;
      },
      put(val) {
        const r = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (name === 'settings') s.set(val.key, val);
          else s.set(val.id, val);
          r.onsuccess?.({ target: r });
        }, 0);
        return r;
      },
      delete(key) {
        const r = { onsuccess: null, onerror: null };
        setTimeout(() => {
          s.delete(key);
          r.onsuccess?.({ target: r });
        }, 0);
        return r;
      },
      clear() {
        const r = { onsuccess: null, onerror: null };
        setTimeout(() => {
          s.clear();
          r.onsuccess?.({ target: r });
        }, 0);
        return r;
      },
    };
  }

  return {
    open() {
      const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: (n) => n in stores },
          transaction(storeNames) {
            const tx = {
              objectStore(n) {
                return makeStore(n);
              },
              oncomplete: null,
              onerror: null,
              onabort: null,
            };
            setTimeout(() => tx.oncomplete?.({ target: tx }), 8);
            return tx;
          },
        };
        req.onsuccess?.({ target: req });
      }, 0);
      return req;
    },
    _stores: stores,
  };
}

function loadDb(storage, idb) {
  const sandbox = {
    window: {},
    localStorage: storage,
    indexedDB: idb,
    navigator: { storage: { persist: async () => true, persisted: async () => false } },
    document: { addEventListener() {} },
    setTimeout,
    clearTimeout,
    console,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(dbCode, sandbox);
  return sandbox.GreekDB;
}

async function testPutAndBackup() {
  const storage = makeLocalStorage();
  const idb = makeIndexedDB();
  const db = loadDb(storage, idb);
  await db.init();

  const card = {
    id: 'word-0#summary#el-ru',
    deckId: 'global',
    wordSlug: 'word-0',
    type: 'summary',
    direction: 'el-ru',
    repetitions: 2,
    remembered: 2,
    forgotten: 0,
    nextReview: Date.now() + 600000,
    lastReview: Date.now(),
    ease: 2.5,
    interval: 600000,
  };
  await db.putCard(card);
  await db.flushBackup();

  const backupRaw = storage.getItem('greek3-progress-backup-v1');
  if (!backupRaw) throw new Error('Expected localStorage backup after putCard');
  const backup = JSON.parse(backupRaw);
  if (backup.cards.length !== 1 || backup.cards[0].repetitions !== 2) {
    throw new Error('Backup payload mismatch');
  }
  console.log('✓ putCard writes localStorage backup');
}

async function testRestoreFromBackup() {
  const storage = makeLocalStorage();
  const idb = makeIndexedDB();
  const db = loadDb(storage, idb);
  await db.init();

  await db.putCard({
    id: 'word-1#summary#el-ru',
    deckId: 'global',
    wordSlug: 'word-1',
    type: 'summary',
    direction: 'el-ru',
    repetitions: 1,
    remembered: 1,
    forgotten: 0,
    nextReview: 0,
    lastReview: Date.now(),
    ease: 2.5,
    interval: 0,
  });
  await db.flushBackup();

  idb._stores.cards.clear();
  const restored = await db.restoreFromBackupIfNeeded();
  if (!restored) throw new Error('Expected restoreFromBackupIfNeeded to return true');

  const cards = await db.getAllCards();
  if (cards.length !== 1 || cards[0].wordSlug !== 'word-1') {
    throw new Error('Restored cards mismatch');
  }
  console.log('✓ restore from localStorage when IndexedDB empty');
}

async function testResetPreservesMigrationFlags() {
  const storage = makeLocalStorage();
  const idb = makeIndexedDB();
  const db = loadDb(storage, idb);
  await db.init();
  await db.setSetting('migration:global-deck-v3', true);
  await db.putCard({
    id: 'word-2#summary#el-ru',
    deckId: 'global',
    wordSlug: 'word-2',
    type: 'summary',
    direction: 'el-ru',
    repetitions: 1,
    remembered: 1,
    forgotten: 0,
    nextReview: 0,
    lastReview: Date.now(),
    ease: 2.5,
    interval: 0,
  });

  await db.resetAllProgress();
  const flag = await db.getSetting('migration:global-deck-v3', false);
  if (!flag) throw new Error('Expected migration flag to survive reset');
  const cards = await db.getAllCards();
  if (cards.length !== 0) throw new Error('Expected cards cleared on reset');
  console.log('✓ reset clears cards but keeps migration flags');
}

async function main() {
  await testPutAndBackup();
  await testRestoreFromBackup();
  await testResetPreservesMigrationFlags();
  console.log('\nAll DB backup tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
