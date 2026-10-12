/**
 * piperIndexedDB.js
 * Piper TTS 音声モデルおよびアセットを IndexedDB に永続化・管理するモジュール
 * 
 * データベース名: PiperTTSCache
 * オブジェクトストア: models
 */

const DB_NAME = 'PiperTTSCache';
const DB_VERSION = 1;
const STORE_NAME = 'models';

let dbInstance_ = null;

/**
 * IndexedDB を開き、初期化する
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance_) return Promise.resolve(dbInstance_);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB はこのブラウザでサポートされていません。'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (event) => {
      dbInstance_ = event.target.result;
      dbInstance_.onclose = () => { dbInstance_ = null; };
      resolve(dbInstance_);
    };
    req.onerror = (event) => {
      reject(event.target.error || new Error('IndexedDB のオープンに失敗しました。'));
    };
  });
}

/**
 * Blob または ArrayBuffer を IndexedDB に保存
 * @param {string} key ファイル名または識別子 (例: "en_US-lessac-medium.onnx")
 * @param {Blob|ArrayBuffer} data 保存するバイナリデータ
 * @returns {Promise<void>}
 */
export async function saveBlob(key, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(data, key);
    putReq.onsuccess = () => resolve();
    putReq.onerror = (e) => reject(e.target.error || new Error(`保存に失敗: ${key}`));
  });
}

/**
 * IndexedDB からデータを取得
 * @param {string} key 
 * @returns {Promise<Blob|ArrayBuffer|undefined>}
 */
export async function getBlob(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || undefined);
    req.onerror = () => resolve(undefined);
  });
}

/**
 * 指定のキーが存在するか確認
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
export async function hasBlob(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count(key);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => resolve(false);
  });
}

/**
 * 指定のキーを削除
 * @param {string} key 
 * @returns {Promise<void>}
 */
export async function deleteBlob(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error || new Error(`削除に失敗: ${key}`));
  });
}

/**
 * 全ての保存キーを取得
 * @returns {Promise<string[]>}
 */
export async function getAllKeys() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

/**
 * 特定の音声モデルが完全に保存されているか確認
 * (.onnx と .onnx.json の両方が存在すること)
 * @param {string} voiceId 
 * @returns {Promise<boolean>}
 */
export async function isVoiceCached(voiceId) {
  const [hasModel, hasConfig] = await Promise.all([
    hasBlob(`${voiceId}.onnx`),
    hasBlob(`${voiceId}.onnx.json`)
  ]);
  return hasModel && hasConfig;
}

/**
 * 保存されている音声モデルIDの一覧を取得
 * @returns {Promise<string[]>}
 */
export async function listCachedVoices() {
  const keys = await getAllKeys();
  const voices = [];
  for (const key of keys) {
    if (typeof key === 'string' && key.endsWith('.onnx')) {
      const voiceId = key.slice(0, -5);
      if (keys.includes(`${voiceId}.onnx.json`)) {
        voices.push(voiceId);
      }
    }
  }
  return voices;
}

/**
 * 特定の音声モデル（.onnx と .onnx.json）を削除
 * @param {string} voiceId 
 * @returns {Promise<void>}
 */
export async function deleteVoice(voiceId) {
  await Promise.all([
    deleteBlob(`${voiceId}.onnx`),
    deleteBlob(`${voiceId}.onnx.json`)
  ]);
}

/**
 * IndexedDB の利用容量の統計を取得
 * @returns {Promise<{ totalBytes: number, formatted: string, fileCount: number, voices: string[] }>}
 */
export async function getStorageStats() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    let totalBytes = 0;
    let fileCount = 0;

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        fileCount++;
        const val = cursor.value;
        if (val) {
          if (val instanceof Blob) {
            totalBytes += val.size;
          } else if (val instanceof ArrayBuffer) {
            totalBytes += val.byteLength;
          } else if (typeof val === 'string') {
            totalBytes += val.length * 2;
          }
        }
        cursor.continue();
      } else {
        listCachedVoices().then((voices) => {
          const mb = (totalBytes / (1024 * 1024)).toFixed(1);
          resolve({
            totalBytes,
            formatted: totalBytes > 0 ? `${mb} MB` : '0 MB',
            fileCount,
            voices
          });
        });
      }
    };
    req.onerror = () => {
      resolve({ totalBytes: 0, formatted: '0 MB', fileCount: 0, voices: [] });
    };
  });
}

/**
 * 全ての保存データを消去（キャッシュクリア）
 * @returns {Promise<void>}
 */
export async function clearCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error || new Error('キャッシュ消去に失敗しました。'));
  });
}
