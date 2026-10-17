/**
 * js/adapters/audioCacheStore.js
 * Firebase（Hosting または Storage）上の音声を端末 IndexedDB にキャッシュし、Object URL で再生する
 *
 * DB: ESAudioCache / store: blobs
 * 既定配信: Hosting の /SE/{fileName}
 * 任意: Firebase Storage materials/dungeon/SE/{fileName}
 */
(function (global) {
  'use strict';

  var DB_NAME = 'ESAudioCache';
  var DB_VERSION = 1;
  var STORE_NAME = 'blobs';
  var DEFAULT_HOSTING_BASE = 'SE/';
  var DEFAULT_STORAGE_PREFIX = 'materials/dungeon/SE/';

  var dbPromise_ = null;
  var objectUrlCache_ = Object.create(null);
  var inflight_ = Object.create(null);

  function getStorage_() {
    try {
      if (typeof global.getFirebaseStorage === 'function') {
        return global.getFirebaseStorage();
      }
      if (typeof firebase !== 'undefined' && typeof firebase.storage === 'function') {
        return firebase.storage();
      }
    } catch (_) {}
    return null;
  }

  function openDb_() {
    if (dbPromise_) return dbPromise_;
    dbPromise_ = new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB 非対応'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = function (ev) {
        resolve(ev.target.result);
      };
      req.onerror = function () {
        reject(req.error || new Error('IndexedDB open failed'));
      };
    });
    return dbPromise_;
  }

  function cacheKeyFor_(fileName, opts) {
    opts = opts || {};
    var prefix = opts.storagePrefix != null ? opts.storagePrefix : DEFAULT_STORAGE_PREFIX;
    if (prefix && prefix.charAt(prefix.length - 1) !== '/') prefix += '/';
    return 'audio:' + prefix + String(fileName || '').replace(/^\/+/, '');
  }

  function hostingUrlFor_(fileName, opts) {
    opts = opts || {};
    var base = opts.hostingBase != null ? opts.hostingBase : DEFAULT_HOSTING_BASE;
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    // 相対パス（同一オリジン Hosting）
    return base + String(fileName || '').replace(/^\/+/, '');
  }

  function storagePathFor_(fileName, opts) {
    opts = opts || {};
    var prefix = opts.storagePrefix != null ? opts.storagePrefix : DEFAULT_STORAGE_PREFIX;
    if (prefix && prefix.charAt(prefix.length - 1) !== '/') prefix += '/';
    return prefix + String(fileName || '').replace(/^\/+/, '');
  }

  function idbGet_(key) {
    return openDb_().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function idbPut_(record) {
    return openDb_().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB put failed')); };
      });
    });
  }

  function fetchBlobFromUrl_(url) {
    return fetch(url, { credentials: 'same-origin', cache: 'force-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
      return res.blob();
    });
  }

  function fetchBlobFromStorage_(storagePath) {
    var storage = getStorage_();
    if (!storage) return Promise.reject(new Error('Firebase Storage 未初期化'));
    var ref = storage.ref(storagePath);
    if (typeof ref.getBlob === 'function') {
      return ref.getBlob().catch(function () {
        return ref.getDownloadURL().then(function (url) { return fetchBlobFromUrl_(url); });
      });
    }
    return ref.getDownloadURL().then(function (url) { return fetchBlobFromUrl_(url); });
  }

  /**
   * ネットワークから取得（Storage 優先 → Hosting フォールバック）
   */
  function fetchBlobNetwork_(fileName, opts) {
    opts = opts || {};
    var preferStorage = opts.preferStorage !== false;
    var hostingUrl = hostingUrlFor_(fileName, opts);
    var storagePath = storagePathFor_(fileName, opts);

    if (preferStorage && getStorage_()) {
      return fetchBlobFromStorage_(storagePath).catch(function () {
        return fetchBlobFromUrl_(hostingUrl);
      });
    }
    return fetchBlobFromUrl_(hostingUrl).catch(function (err) {
      if (!getStorage_()) throw err;
      return fetchBlobFromStorage_(storagePath);
    });
  }

  /**
   * IndexedDB 優先で Object URL を返す
   */
  function getObjectUrl(fileName, opts) {
    opts = opts || {};
    var key = cacheKeyFor_(fileName, opts);
    if (!opts.forceRefresh && objectUrlCache_[key]) {
      return Promise.resolve(objectUrlCache_[key]);
    }
    if (!opts.forceRefresh && inflight_[key]) {
      return inflight_[key];
    }

    var p = Promise.resolve().then(function () {
      if (opts.forceRefresh) return null;
      return idbGet_(key);
    }).then(function (cached) {
      if (cached && cached.blob) return cached.blob;
      return fetchBlobNetwork_(fileName, opts).then(function (blob) {
        var rec = {
          key: key,
          fileName: String(fileName),
          blob: blob,
          mime: blob.type || 'audio/mpeg',
          size: blob.size || 0,
          updatedAt: Date.now()
        };
        return idbPut_(rec).catch(function () { /* ignore */ }).then(function () {
          return blob;
        });
      });
    }).then(function (blob) {
      if (objectUrlCache_[key]) {
        try { URL.revokeObjectURL(objectUrlCache_[key]); } catch (_) {}
      }
      var url = URL.createObjectURL(blob);
      objectUrlCache_[key] = url;
      return url;
    }).finally(function () {
      delete inflight_[key];
    });

    inflight_[key] = p;
    return p;
  }

  function createAudio(fileName, opts) {
    return getObjectUrl(fileName, opts).then(function (url) {
      var aud = new Audio(url);
      aud.preload = 'auto';
      return aud;
    });
  }

  function preloadAll(fileNames, opts) {
    opts = opts || {};
    var list = Array.isArray(fileNames) ? fileNames.slice() : [];
    var total = list.length;
    var done = 0;
    var concurrency = Math.max(1, Math.min(8, Number(opts.concurrency) || 4));
    var results = { ok: 0, fail: 0, errors: [] };

    function next() {
      if (!list.length) return Promise.resolve();
      var name = list.shift();
      return getObjectUrl(name, opts)
        .then(function () { results.ok++; })
        .catch(function (err) {
          results.fail++;
          results.errors.push({ file: name, error: String(err && err.message || err) });
        })
        .then(function () {
          done++;
          if (typeof opts.onProgress === 'function') {
            try { opts.onProgress(done, total, name); } catch (_) {}
          }
          return next();
        });
    }

    var workers = [];
    for (var i = 0; i < concurrency; i++) workers.push(next());
    return Promise.all(workers).then(function () { return results; });
  }

  function hasCached(fileName, opts) {
    return idbGet_(cacheKeyFor_(fileName, opts)).then(function (rec) {
      return !!(rec && rec.blob);
    });
  }

  function clearCache() {
    Object.keys(objectUrlCache_).forEach(function (k) {
      try { URL.revokeObjectURL(objectUrlCache_[k]); } catch (_) {}
      delete objectUrlCache_[k];
    });
    return openDb_().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getStats() {
    return openDb_().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          var totalBytes = 0;
          rows.forEach(function (r) {
            totalBytes += Number(r.size) || (r.blob && r.blob.size) || 0;
          });
          resolve({
            fileCount: rows.length,
            totalBytes: totalBytes,
            formatted: (totalBytes / (1024 * 1024)).toFixed(1) + ' MB'
          });
        };
        req.onerror = function () {
          resolve({ fileCount: 0, totalBytes: 0, formatted: '0 MB' });
        };
      });
    }).catch(function () {
      return { fileCount: 0, totalBytes: 0, formatted: '0 MB' };
    });
  }

  global.audioCacheStore = {
    DEFAULT_HOSTING_BASE: DEFAULT_HOSTING_BASE,
    DEFAULT_STORAGE_PREFIX: DEFAULT_STORAGE_PREFIX,
    getObjectUrl: getObjectUrl,
    createAudio: createAudio,
    preloadAll: preloadAll,
    hasCached: hasCached,
    clearCache: clearCache,
    getStats: getStats,
    storagePathFor: storagePathFor_,
    hostingUrlFor: hostingUrlFor_
  };
})(typeof window !== 'undefined' ? window : this);
