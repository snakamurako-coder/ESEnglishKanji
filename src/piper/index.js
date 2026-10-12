/**
 * index.js (Piper TTS エントリポイント)
 * window.PiperTTS としてブラウザ環境にエクスポート
 * 英語（Piper / Lessac等）および 日本語（Piper-Plus / つくよみちゃん等）のハイブリッド統合
 */

import * as idb from './piperIndexedDB.js';
import * as engine from './piperEngine.js';
import * as jaEngine from './piperJapaneseEngine.js';

const STORAGE_KEY_ENABLED = 'piper_tts_enabled';
const STORAGE_KEY_VOICE = 'piper_active_voice';

const STORAGE_KEY_JA_ENABLED = 'piper_tts_ja_enabled';
const STORAGE_KEY_JA_VOICE = 'piper_active_ja_voice';

export const PiperTTS = {
  /** 利用可能な英語音声モデル一覧 */
  VOICES: engine.VOICE_CATALOG,

  /** 利用可能な日本語音声モデル一覧 */
  JA_VOICES: jaEngine.JA_VOICE_CATALOG,

  /** ブラウザの動作要件を満たしているか確認 */
  isSupported() {
    return (
      typeof indexedDB !== 'undefined' &&
      typeof WebAssembly !== 'undefined' &&
      typeof Audio !== 'undefined'
    );
  },

  /** 日本語文字列を含むかの判定 */
  isLikelyJapanese(text) {
    if (!text || typeof text !== 'string') return false;
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
  },

  /** 指定モデルが IndexedDB に保存済みか判定 (英語/日本語両対応) */
  isModelDownloaded(voiceId) {
    if (jaEngine.JA_VOICE_CATALOG[voiceId]) {
      return jaEngine.isJapaneseVoiceCached(voiceId);
    }
    return idb.isVoiceCached(voiceId);
  },

  /** 保存済みのモデルID一覧を取得 */
  listDownloadedVoices() {
    return idb.listCachedVoices();
  },

  /** IndexedDB の使用容量などの統計を取得 */
  getStorageStats() {
    return idb.getStorageStats();
  },

  /** 音声モデルのダウンロードと IndexedDB への保存 (英語/日本語両対応) */
  downloadVoice(voiceId, onProgress) {
    if (jaEngine.JA_VOICE_CATALOG[voiceId]) {
      return jaEngine.downloadJapaneseVoice(voiceId, onProgress);
    }
    return engine.downloadVoice(voiceId, onProgress);
  },

  /** 音声モデルの削除 (英語/日本語両対応) */
  async deleteVoice(voiceId) {
    if (jaEngine.JA_VOICE_CATALOG[voiceId]) {
      jaEngine.disposeJapaneseSession();
    } else {
      engine.disposeSession();
    }
    await idb.deleteVoice(voiceId);
  },

  /** 全ての保存データを消去 */
  async clearAllStorage() {
    engine.disposeSession();
    jaEngine.disposeJapaneseSession();
    await idb.clearCache();
  },

  // -------------------------------------------------------------
  // 英語 Piper 設定
  // -------------------------------------------------------------

  /** 英語 Piper TTS が有効化されているか（デフォルト: 有効 1） */
  isEnabled() {
    const val = localStorage.getItem(STORAGE_KEY_ENABLED);
    return val === null ? true : val === '1';
  },

  /** 英語 Piper TTS の有効/無効を切り替え */
  setEnabled(enabled) {
    localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? '1' : '0');
  },

  /** 現在選択されている英語音声モデルID */
  getActiveVoiceId() {
    return localStorage.getItem(STORAGE_KEY_VOICE) || 'en_US-lessac-medium';
  },

  /** 使用する英語音声モデルIDを設定 */
  setActiveVoiceId(voiceId) {
    if (engine.VOICE_CATALOG[voiceId]) {
      localStorage.setItem(STORAGE_KEY_VOICE, voiceId);
    }
  },

  // -------------------------------------------------------------
  // 日本語 Piper 設定
  // -------------------------------------------------------------

  /** 日本語 Piper TTS が有効化されているか（デフォルト: 0 = 未保存時は標準音声） */
  isJapaneseEnabled() {
    const val = localStorage.getItem(STORAGE_KEY_JA_ENABLED);
    return val === '1';
  },

  /** 日本語 Piper TTS の有効/無効を切り替え */
  setJapaneseEnabled(enabled) {
    localStorage.setItem(STORAGE_KEY_JA_ENABLED, enabled ? '1' : '0');
  },

  /** 現在選択されている日本語音声モデルID */
  getActiveJapaneseVoiceId() {
    return localStorage.getItem(STORAGE_KEY_JA_VOICE) || 'ja_JP-tsukuyomi-chan';
  },

  /** 使用する日本語音声モデルIDを設定 */
  setActiveJapaneseVoiceId(voiceId) {
    if (jaEngine.JA_VOICE_CATALOG[voiceId]) {
      localStorage.setItem(STORAGE_KEY_JA_VOICE, voiceId);
    }
  },

  // -------------------------------------------------------------
  // 推論・再生
  // -------------------------------------------------------------

  /** セッション初期化（起動・ウォームアップ） */
  init(voiceId) {
    const targetVoice = voiceId || this.getActiveVoiceId();
    if (jaEngine.JA_VOICE_CATALOG[targetVoice]) {
      return jaEngine.initJapaneseVoiceSession(targetVoice);
    }
    return engine.initVoiceSession(targetVoice);
  },

  /** 音声合成 (WAV Blob 生成) */
  synthesize(text, voiceId) {
    const isJa = jaEngine.JA_VOICE_CATALOG[voiceId] || (!voiceId && this.isLikelyJapanese(text));
    if (isJa) {
      const targetVoice = voiceId || this.getActiveJapaneseVoiceId();
      return jaEngine.synthesizeJapanese(text, targetVoice);
    }
    const targetVoice = voiceId || this.getActiveVoiceId();
    return engine.synthesize(text, targetVoice);
  },

  /**
   * テキストを再生
   * @param {string} text 
   * @param {Object} [options]
   * @param {string} [options.voiceId]
   * @param {string} [options.lang] 'en' | 'ja'
   * @param {number} [options.rate]
   * @param {Function} [options.onStart]
   * @param {Function} [options.onEnd]
   * @param {Function} [options.onError]
   */
  speak(text, options = {}) {
    const isJa =
      options.lang === 'ja' ||
      jaEngine.JA_VOICE_CATALOG[options.voiceId] ||
      (!options.lang && this.isLikelyJapanese(text));

    if (isJa) {
      const voiceId = options.voiceId || this.getActiveJapaneseVoiceId();
      return jaEngine.speakJapanese(text, { ...options, voiceId });
    }

    const voiceId = options.voiceId || this.getActiveVoiceId();
    return engine.speak(text, { ...options, voiceId });
  },

  /** 現在の音声を停止 (英語/日本語両方) */
  stop() {
    engine.stopAudio();
    jaEngine.stopJapaneseAudio();
  },

  /** リソース解放 (英語/日本語両方) */
  dispose() {
    engine.disposeSession();
    jaEngine.disposeJapaneseSession();
  }
};

// グローバルスコープに公開
if (typeof window !== 'undefined') {
  window.PiperTTS = PiperTTS;
}

export default PiperTTS;
