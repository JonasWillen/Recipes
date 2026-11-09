(function (global) {
  'use strict';

  const DB_NAME = 'recipe-box';
  const DB_VERSION = 1;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('recipes')) {
          const store = db.createObjectStore('recipes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-date', 'createdAt');
          store.createIndex('by-fav', 'favorite');
          store.createIndex('by-tag', 'tags', { multiEntry: true });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function run(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const request = action(s);
      if (request && typeof request.onsuccess !== 'undefined') {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        t.oncomplete = () => resolve(request);
        t.onerror = () => reject(t.error);
      }
    });
  }

  global.RecipeDB = {
    all: () => run('recipes', 'readonly', (s) => s.getAll()),
    get: (id) => run('recipes', 'readonly', (s) => s.get(id)),
    add: (rec) => run('recipes', 'readwrite', (s) => s.add(rec)),
    put: (rec) => run('recipes', 'readwrite', (s) => s.put(rec)),
    del: (id) => run('recipes', 'readwrite', (s) => s.delete(id)),
    metaGet: (key) => run('meta', 'readonly', (s) => s.get(key)),
    metaSet: (key, value) => run('meta', 'readwrite', (s) => s.put({ key, value })),
    metaDel: (key) => run('meta', 'readwrite', (s) => s.delete(key)),
  };
})(typeof self !== 'undefined' ? self : window);
