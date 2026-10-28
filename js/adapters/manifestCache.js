/**
 * Firebase マニフェスト型 IndexedDB キャッシュ層 (manifestCache.js)
 * 
 * 役割:
 *  1. 起動時に /data/manifest-index.json (軽量・no-cache) を確認
 *  2. ハッシュが IndexedDB と一致していれば実データ通信ゼロ (0ms 超高速起動)
 *  3. ハッシュ更新時・初回のみ Firebase Hosting CDN からハッシュ付き静的 JSON を取得
 *  4. マニフェスト未配置またはネットワーク異常時は既存 GAS API へ完全自動フォールバック
 */
(function (global) {
  'use strict';

  const DB_NAME = 'ESEnglishKanjiDataCache';
  const DB_VERSION = 1;
  const STORE_META = 'manifest_meta';
  const STORE_MATERIALS = 'manifest_materials';
  const STORE_BOOKS = 'manifest_books';

  let dbPromise_ = null;
  let remoteIndex_ = null;

  function openDb() {
    if (dbPromise_) return dbPromise_;
    dbPromise_ = new Promise(function (resolve, reject) {
      if (!('indexedDB' in global)) {
        return resolve(null); // IndexedDB 非対応環境
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
          db.createObjectStore(STORE_MATERIALS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'modeId' });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { resolve(null); }; // エラー時はフォールバックできるよう null
    });
    return dbPromise_;
  }

  function idbGet(storeName, key) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (_) {
          resolve(null);
        }
      });
    });
  }

  function idbPut(storeName, val) {
    return openDb().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(val);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (_) {
          resolve();
        }
      });
    });
  }

  function getFirestoreDb_() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  /**
   * サーバーから最新の軽量インデックスを取得（Firestore または 静的JSON、no-cache）
   */
  function fetchRemoteIndex() {
    if (remoteIndex_) return Promise.resolve(remoteIndex_);

    // 1. Firestore からの取得を試みる
    const db = getFirestoreDb_();
    const fetchFromFirestore = db ?
      db.collection('system').doc('manifest_index').get().then(function (doc) {
        if (doc.exists) {
          const d = doc.data();
          if (d && d.materials && d.books) return d;
        }
        return null;
      }).catch(function () { return null; }) :
      Promise.resolve(null);

    // パスを相対パスまたはベースURL考慮で正規化
    function normalizeDataPath_(p) {
      if (!p) return null;
      let s = String(p).trim();
      if (s.startsWith('/')) s = s.slice(1);
      return s;
    }

    // 2. 静的ファイル (data/manifest-index.json) からの取得
    const fetchFromStatic = fetch(normalizeDataPath_('data/manifest-index.json'), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () { return null; });

    return Promise.all([fetchFromFirestore, fetchFromStatic]).then(function (results) {
      const fsIdx = results[0];
      const staticIdx = results[1];

      // より新しいインデックス（または存在する方）を採用
      let chosen = null;
      if (fsIdx && staticIdx) {
        const fsTime = new Date(fsIdx.exportedAt || 0).getTime();
        const staticTime = new Date(staticIdx.exportedAt || 0).getTime();
        chosen = fsTime >= staticTime ? fsIdx : staticIdx;
      } else {
        chosen = fsIdx || staticIdx;
      }

      if (chosen && typeof chosen === 'object') {
        remoteIndex_ = chosen;
        idbPut(STORE_META, { key: 'index', data: chosen, savedAt: Date.now() });
        return remoteIndex_;
      }

      // オフラインまたは取得失敗時は IndexedDB の保存済みインデックスを使用
      return idbGet(STORE_META, 'index').then(function (cached) {
        remoteIndex_ = (cached && cached.data) || null;
        return remoteIndex_;
      });
    });
  }

  /**
   * 教材一覧（英語・漢字ブック一覧）をマニフェストキャッシュから取得（GAS通信ゼロ）
   */
  function getMaterialsList() {
    return fetchRemoteIndex().then(function (index) {
      const expectedHash = (index && index.materials && index.materials.hash) || '';
      const rawPath = (index && index.materials && index.materials.path) || (expectedHash ? ('data/manifest-materials.' + expectedHash + '.json') : 'data/manifest-materials.json');
      const dataPath = rawPath ? (rawPath.startsWith('/') ? rawPath.slice(1) : rawPath) : null;

      return idbGet(STORE_MATERIALS, 'materials').then(function (cached) {
        if (cached && (!expectedHash || cached.hash === expectedHash) && Array.isArray(cached.materials)) {
          // Cache Hit: 通信ゼロ・即時返却
          return { status: 'success', materials: cached.materials, fromCache: true };
        }

        // Cache Miss / 新バージョン: 静的JSONまたはFirestoreを取得
        const fetchStaticPromise = dataPath
          ? fetch(dataPath)
              .then(function (res) {
                if (!res.ok) throw new Error('Failed to load materials manifest');
                return res.json();
              })
              .then(function (payload) {
                if (payload && payload.status === 'success' && Array.isArray(payload.materials)) {
                  idbPut(STORE_MATERIALS, {
                    key: 'materials',
                    hash: expectedHash || payload.hash || '',
                    materials: payload.materials,
                    updatedAt: Date.now()
                  });
                  return payload;
                }
                throw new Error('Invalid materials payload');
              })
          : Promise.reject(new Error('No static path'));

        return fetchStaticPromise.catch(function () {
          // 静的ファイルが未配置の場合、Firestore の system/manifest_materials を確認
          const db = getFirestoreDb_();
          if (db) {
            return db.collection('system').doc('manifest_materials').get().then(function (doc) {
              if (doc.exists && doc.data() && Array.isArray(doc.data().materials)) {
                const mats = doc.data().materials;
                idbPut(STORE_MATERIALS, {
                  key: 'materials',
                  hash: expectedHash || (doc.data().hash || ''),
                  materials: mats,
                  updatedAt: Date.now()
                });
                return { status: 'success', materials: mats, fromCache: true };
              }
              if (cached && cached.materials) {
                return { status: 'success', materials: cached.materials, fromCache: true };
              }
              return { status: 'success', materials: [], fromCache: false };
            }).catch(function () {
              if (cached && cached.materials) {
                return { status: 'success', materials: cached.materials, fromCache: true };
              }
              return { status: 'success', materials: [], fromCache: false };
            });
          }
          if (cached && cached.materials) {
            return { status: 'success', materials: cached.materials, fromCache: true };
          }
          return { status: 'success', materials: [], fromCache: false };
        });
      });
    });
  }

  /**
   * 特定のブックの全データを取得（英語または漢字、GAS通信ゼロ）
   */
  function getBookPayload(modeId) {
    if (!modeId) return Promise.resolve(null);
    return fetchRemoteIndex().then(function (index) {
      const bMeta = (index && index.books && index.books[modeId]) || null;
      const expectedHash = bMeta ? bMeta.hash : '';
      const rawPath = (bMeta && bMeta.path) || (expectedHash ? ('data/books/' + modeId + '.' + expectedHash + '.json') : null);
      const dataPath = rawPath ? (rawPath.startsWith('/') ? rawPath.slice(1) : rawPath) : null;

      return idbGet(STORE_BOOKS, modeId).then(function (cached) {
        if (cached && (!expectedHash || cached.hash === expectedHash) && cached.units) {
          return cached;
        }

        const fetchStaticPromise = dataPath
          ? fetch(dataPath).then(function (res) {
              if (!res.ok) throw new Error('Book manifest not found');
              return res.json();
            }).then(function (data) {
              if (data && data.units) {
                idbPut(STORE_BOOKS, Object.assign({ modeId: modeId, hash: expectedHash }, data));
                return data;
              }
              return null;
            })
          : Promise.reject(new Error('No static path'));

        return fetchStaticPromise.catch(function () {
          // 静的ファイルが未配置または取得失敗の場合、Firestore の system/manifest_book_{modeId} を確認
          const db = getFirestoreDb_();
          if (db) {
            return db.collection('system').doc('manifest_book_' + modeId).get().then(function (doc) {
              if (doc.exists) {
                const d = doc.data();
                const hasInlineUnits = d && d.units && typeof d.units === 'object' && Object.keys(d.units).length > 0;
                if (d && d.isChunked && Array.isArray(d.unitNames) && d.unitNames.length) {
                  // 1MB 超え対策の分割単元ドキュメント群を並列取得して復元
                  const unitPromises = d.unitNames.map(function (uName) {
                    const uDocId = 'manifest_book_' + modeId + '_u_' + encodeURIComponent(uName);
                    return db.collection('system').doc(uDocId).get().then(function (uDoc) {
                      return { name: uName, data: uDoc.exists ? uDoc.data().data : null };
                    });
                  });
                  return Promise.all(unitPromises).then(function (unitsList) {
                    const reconstructedUnits = {};
                    unitsList.forEach(function (it) {
                      if (it && it.name && it.data) {
                        reconstructedUnits[it.name] = it.data;
                      }
                    });
                    // 分割ドキュメントが空で、親に units が残っている場合は親を使う
                    // （以前 isChunked=true のまま非分割上書きされた残骸対策）
                    if (Object.keys(reconstructedUnits).length === 0 && hasInlineUnits) {
                      idbPut(STORE_BOOKS, Object.assign({ modeId: modeId, hash: expectedHash }, d));
                      return d;
                    }
                    d.units = reconstructedUnits;
                    idbPut(STORE_BOOKS, Object.assign({ modeId: modeId, hash: expectedHash }, d));
                    return d;
                  });
                }
                if (hasInlineUnits) {
                  idbPut(STORE_BOOKS, Object.assign({ modeId: modeId, hash: expectedHash }, d));
                  return d;
                }
              }
              return (cached && cached.units) ? cached : null;
            }).catch(function () {
              return (cached && cached.units) ? cached : null;
            });
          }
          return (cached && cached.units) ? cached : null;
        });
      });
    });
  }

  /**
   * 英語の問題一覧を取得（GAS通信ゼロ）
   */
  function getEnglishQuestions(modeId, unitName) {
    return getBookPayload(modeId).then(function (book) {
      if (book && book.units && Array.isArray(book.units[unitName])) {
        return { status: 'success', questions: book.units[unitName], fromCache: true };
      }
      return { status: 'success', questions: [], fromCache: false, message: '問題が見つかりません' };
    });
  }

  /** 単元名のゆれ（前後空白・全角数字など）を吸収して units から取り出す */
  function resolveUnitPayload_(units, unitName) {
    if (!units || typeof units !== 'object') return null;
    const want = String(unitName || '').trim();
    if (!want) return null;
    if (units[want]) return units[want];
    if (units[unitName]) return units[unitName];
    const keys = Object.keys(units);
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i] || '').trim() === want) return units[keys[i]];
    }
    return null;
  }

  /** setQuestions のキー型ゆれ（"1" / 1）を吸収 */
  function resolveSetQuestions_(setQuestions, setId) {
    if (!setQuestions || typeof setQuestions !== 'object') return null;
    const sid = String(setId || '');
    if (sid && Array.isArray(setQuestions[sid])) return setQuestions[sid];
    if (sid && Array.isArray(setQuestions[setId])) return setQuestions[setId];
    const keys = Object.keys(setQuestions);
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i]) === sid) {
        const arr = setQuestions[keys[i]];
        return Array.isArray(arr) ? arr : null;
      }
    }
    return null;
  }

  /**
   * 漢字のセット一覧を取得（GAS通信ゼロ）
   */
  function getKanjiQuizSets(modeId, unitName) {
    return getBookPayload(modeId).then(function (book) {
      if (!book || !book.units) {
        return { status: 'error', sets: [], sheetKind: 'standard', fromCache: false, message: '漢字教材ブックが見つかりません。親画面で教材を更新してください。' };
      }
      const u = resolveUnitPayload_(book.units, unitName);
      if (u && Array.isArray(u.sets) && u.sets.length > 0) {
        return { status: 'success', sets: u.sets, sheetKind: u.sheetKind || 'standard', fromCache: true };
      }
      // setQuestions だけある古いマニフェストからもセット一覧を復元
      if (u && u.setQuestions && typeof u.setQuestions === 'object') {
        const keys = Object.keys(u.setQuestions);
        if (keys.length) {
          const sets = keys.map(function (sid) {
            const items = Array.isArray(u.setQuestions[sid]) ? u.setQuestions[sid] : [];
            return {
              setId: String(sid),
              count: items.length,
              kanjiList: items.map(function (it) {
                return String((it && (it['ターゲット漢字'] || it['漢字'] || it.kanji)) || '').trim();
              }).filter(Boolean)
            };
          });
          return { status: 'success', sets: sets, sheetKind: (u && u.sheetKind) || 'standard', fromCache: true };
        }
      }
      return { status: 'error', sets: [], sheetKind: (u && u.sheetKind) || 'standard', fromCache: false, message: 'セットが見つかりません' };
    });
  }

  /** 生行（漢字／ターゲット漢字）にも kanji を付与し、練習タイル・検索が空にならないようにする */
  function normalizeKanjiQuestionItem_(it) {
    if (!it || typeof it !== 'object') return it;
    const existing = String(it.kanji || '').trim();
    if (existing) return it;
    const k = String(
      (it['ターゲット漢字'] != null ? it['ターゲット漢字'] : '') ||
      (it['漢字'] != null ? it['漢字'] : '') ||
      (it.targetKanji != null ? it.targetKanji : '') ||
      ''
    ).trim();
    if (!k) return it;
    const copy = Object.assign({}, it);
    copy.kanji = k;
    return copy;
  }
  function normalizeKanjiQuestionList_(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeKanjiQuestionItem_);
  }

  /**
   * 漢字の問題一覧を取得（GAS通信ゼロ）
   */
  function getKanjiQuizQuestions(modeId, unitName, setId) {
    return getBookPayload(modeId).then(function (book) {
      if (!book || !book.units) {
        return { status: 'error', questions: [], fromCache: false, message: '漢字教材ブックが見つかりません。親画面で教材を更新してください。' };
      }
      const u = resolveUnitPayload_(book.units, unitName);
      if (u) {
        const sid = String(setId || '');
        const hit = resolveSetQuestions_(u.setQuestions, sid);
        if (hit && hit.length) {
          return {
            status: 'success',
            questions: normalizeKanjiQuestionList_(hit),
            setId: sid,
            sheetKind: u.sheetKind || 'standard',
            fromCache: true
          };
        }
        // setId が未指定または空文字、"ALL" の場合は全セットの質問を平坦化して返却
        if ((!sid || sid === 'ALL') && u.setQuestions && typeof u.setQuestions === 'object') {
          const allQuestions = [];
          Object.keys(u.setQuestions).forEach(function (k) {
            if (Array.isArray(u.setQuestions[k])) {
              allQuestions.push.apply(allQuestions, u.setQuestions[k]);
            }
          });
          if (allQuestions.length > 0) {
            return {
              status: 'success',
              questions: normalizeKanjiQuestionList_(allQuestions),
              setId: sid || 'ALL',
              sheetKind: u.sheetKind || 'standard',
              fromCache: true
            };
          }
        }
      }
      return { status: 'error', questions: [], fromCache: false, message: '漢字問題が見つかりません' };
    });
  }

  /**
   * Firestore 用データサニタイズ（空キー "" や undefined を再帰的に除外）
   */
  function sanitizeForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(function (item) {
        return sanitizeForFirestore(item);
      });
    }
    const clean = {};
    Object.keys(obj).forEach(function (key) {
      if (typeof key === 'string' && key.trim() !== '') {
        const val = obj[key];
        if (val !== undefined) {
          clean[key] = sanitizeForFirestore(val);
        }
      }
    });
    return clean;
  }

  /**
   * 教材マニフェストの最新化（Firestore & IndexedDB 同期）
   * @param {Object} manifestData { exportedAt, materials, materialsHash, booksMeta, booksData }
   */
  function applyManifestUpdate(manifestData) {
    if (!manifestData || !manifestData.materials || !manifestData.booksMeta) {
      return Promise.reject(new Error('不正なマニフェストデータです'));
    }

    const cleanMaterials = sanitizeForFirestore(manifestData.materials || []);
    const cleanBooksMeta = sanitizeForFirestore(manifestData.booksMeta || {});
    Object.keys(cleanBooksMeta).forEach(function (mId) {
      const bm = cleanBooksMeta[mId];
      if (bm && !bm.path && bm.hash) {
        bm.path = 'data/books/' + mId + '.' + bm.hash + '.json';
      }
    });
    const indexData = sanitizeForFirestore({
      schemaVersion: 1,
      exportedAt: manifestData.exportedAt || new Date().toISOString(),
      materials: {
        hash: manifestData.materialsHash,
        path: `data/manifest-materials.${manifestData.materialsHash}.json`,
        count: Array.isArray(cleanMaterials) ? cleanMaterials.length : 0
      },
      books: cleanBooksMeta
    });

    const promises = [];
    const db = getFirestoreDb_();

    // 1. Firestore への保存
    if (db) {
      promises.push(db.collection('system').doc('manifest_index').set(indexData, { merge: true }));
      promises.push(db.collection('system').doc('manifest_materials').set(sanitizeForFirestore({
        status: 'success',
        hash: manifestData.materialsHash,
        materials: cleanMaterials,
        exportedAt: indexData.exportedAt
      }), { merge: true }));

      if (manifestData.booksData) {
        Object.keys(manifestData.booksData).forEach(function (mId) {
          const rawB = manifestData.booksData[mId];
          if (!rawB) return;
          const bData = sanitizeForFirestore(rawB);
          const jsonStr = JSON.stringify(bData);

          // Firestore の 1 ドキュメント上限（1MB = 1,048,576 bytes）対策
          if (jsonStr.length > 700000 && bData.units && typeof bData.units === 'object') {
            const unitNames = Object.keys(bData.units);
            const metaDoc = {
              modeId: bData.modeId || mId,
              modeName: bData.modeName || '',
              category: bData.category || '',
              hash: bData.hash || '',
              exportedAt: bData.exportedAt || indexData.exportedAt,
              isChunked: true,
              unitNames: unitNames
            };
            // merge だと旧 units が残り読み取りが混乱するため置換
            promises.push(db.collection('system').doc('manifest_book_' + mId).set(metaDoc));

            // 単元ごとの分割ドキュメント
            unitNames.forEach(function (uName) {
              const uDocId = 'manifest_book_' + mId + '_u_' + encodeURIComponent(uName);
              promises.push(db.collection('system').doc(uDocId).set({
                modeId: mId,
                unitName: uName,
                data: bData.units[uName]
              }, { merge: true }));
            });
          } else {
            // 非分割保存時は isChunked 残骸を消すため merge せず置換
            const inlineDoc = Object.assign({}, bData, { isChunked: false });
            delete inlineDoc.unitNames;
            promises.push(db.collection('system').doc('manifest_book_' + mId).set(inlineDoc));
          }
        });
      }
    }

    // 2. IndexedDB への即時保存（IndexedDB には常に全単元を含む完全オブジェクトを保存）
    promises.push(idbPut(STORE_META, { key: 'index', data: indexData, savedAt: Date.now() }));
    promises.push(idbPut(STORE_MATERIALS, {
      key: 'materials',
      hash: manifestData.materialsHash,
      materials: cleanMaterials,
      updatedAt: Date.now()
    }));
    if (manifestData.booksData) {
      Object.keys(manifestData.booksData).forEach(function (mId) {
        const rawB = manifestData.booksData[mId];
        if (!rawB) return;
        const cleanB = sanitizeForFirestore(rawB);
        promises.push(idbPut(STORE_BOOKS, Object.assign({ modeId: mId, hash: cleanB.hash }, cleanB)));
      });
    }

    return Promise.all(promises).then(function () {
      remoteIndex_ = indexData;
      return {
        status: 'success',
        exportedAt: indexData.exportedAt,
        materialsCount: indexData.materials.count,
        booksCount: Object.keys(cleanBooksMeta || {}).length
      };
    });
  }

  // グローバル公開
  global.ESManifestCache = {
    init: openDb,
    fetchRemoteIndex: fetchRemoteIndex,
    getMaterialsList: getMaterialsList,
    getEnglishQuestions: getEnglishQuestions,
    getKanjiQuizSets: getKanjiQuizSets,
    getKanjiQuizQuestions: getKanjiQuizQuestions,
    applyManifestUpdate: applyManifestUpdate
  };

  // ページロード時に先行初期化とインデックス照合
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { fetchRemoteIndex(); });
    } else {
      fetchRemoteIndex();
    }
  }

})(typeof window !== 'undefined' ? window : this);

