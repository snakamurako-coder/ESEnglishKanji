/**
 * piperJapaneseEngine.js
 * Piper-Plus（日本語ニューラル音声合成）エンジン
 * 
 * OpenJTalk / NAIST-JDIC 形態素解析辞書（Wasm）と VITS-ONNX（つくよみちゃん / CSS10）を統合し、
 * IndexedDB と連携してブラウザ完全ローカル＆オフラインでの高音質日本語音声合成を実現
 */

import initWasm, { WasmPhonemizer } from 'piper-plus/wasm/multilingual';
import { saveBlob, getBlob, hasBlob, deleteBlob } from './piperIndexedDB.js';
import { pcm2wav, splitIntoChunks } from './piperEngine.js';

// 日本語音素解析（OpenJTalk / NAIST-JDIC辞書内蔵）WASMバイナリ (~60MB)
export const PIPER_PLUS_WASM_BIN_URL = 'https://ayutaz.github.io/piper-plus/dist/rust-wasm/piper_plus_wasm_bg.wasm';
export const MIN_VALID_WASM_SIZE = 55 * 1024 * 1024; // 正常時は約60,070,390バイト (57.3MB)

/**
 * 利用可能な日本語音声モデルカタログ
 */
export const JA_VOICE_CATALOG = {
  'ja_JP-tsukuyomi-chan': {
    id: 'ja_JP-tsukuyomi-chan',
    name: '日本語（つくよみちゃん）',
    desc: '自然で明るく親しみやすい発音・アクセント（学習に最適・推奨）',
    lang: 'ja',
    gender: 'female',
    sizeMb: 38,
    repo: 'ayousanz/piper-plus-tsukuyomi-chan',
    onnxFile: 'tsukuyomi-chan-6lang-fp16.onnx',
    configFile: 'config.json',
    recommended: true
  },
  'ja_JP-css10': {
    id: 'ja_JP-css10',
    name: '日本語（CSS10）',
    desc: '落ち着いたトーンの女性アナウンサー風発音',
    lang: 'ja',
    gender: 'female',
    sizeMb: 38,
    repo: 'ayousanz/piper-plus-css10-ja-6lang',
    onnxFile: 'css10-ja-6lang-fp16.onnx',
    configFile: 'config.json',
    recommended: false
  }
};

/**
 * プログレス監視付き fetchBlob
 * @param {string} url
 * @param {Function} [onProgress]
 * @param {number} [expectedTotal]
 */
async function fetchBlobWithProgress(url, onProgress, expectedTotal = 0) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url} の取得に失敗しました。`);

  if (!onProgress) {
    return await res.blob();
  }

  const headerLength = +(res.headers.get('content-length') || 0);
  const total = expectedTotal > 0 ? expectedTotal : (headerLength > 0 ? headerLength : 0);

  if (!res.body || typeof res.body.getReader !== 'function') {
    const blob = await res.blob();
    onProgress({ loaded: blob.size, total: blob.size, percent: 100 });
    return blob;
  }

  const reader = res.body.getReader();
  let received = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        const pct = Math.min(99, Math.round((received / total) * 100));
        onProgress({ loaded: received, total, percent: pct });
      } else {
        const estTotal = 30 * 1024 * 1024;
        const pct = Math.min(99, Math.round((received / estTotal) * 100));
        onProgress({ loaded: received, total: estTotal, percent: pct });
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }

  const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
  onProgress({ loaded: received, total: received, percent: 100 });
  return blob;
}

// 日本語エンジン用シングルトン状態
let activeJaSession_ = null;
let activeJaVoiceId_ = null;
let currentJaAudio_ = null;
let isWasmInitialized_ = false;

/**
 * 日本語音声モデルおよび辞書WASMが IndexedDB に完全な状態で保存済みか確認
 * ※以前の不完全な25MBキャッシュ等が存在する場合は自動破棄します
 * @param {string} voiceId 
 * @returns {Promise<boolean>}
 */
export async function isJapaneseVoiceCached(voiceId) {
  const [hasModel, hasConfig, wasmBlob] = await Promise.all([
    hasBlob(`${voiceId}.onnx`),
    hasBlob(`${voiceId}.onnx.json`),
    getBlob('piper_plus_wasm_bg.wasm')
  ]);

  if (wasmBlob && wasmBlob.size < MIN_VALID_WASM_SIZE) {
    console.warn(`[PiperTTS] 不完全な形態素辞書WASMキャッシュ (${wasmBlob.size} bytes) を検出したため削除します。`);
    try { await deleteBlob('piper_plus_wasm_bg.wasm'); } catch (_) {}
    return false;
  }

  const hasWasm = !!wasmBlob && wasmBlob.size >= MIN_VALID_WASM_SIZE;
  return hasModel && hasConfig && hasWasm;
}

/**
 * 日本語音声モデルおよび日本語辞書WASMをダウンロードして IndexedDB に保存
 * @param {string} voiceId 
 * @param {Function} [onProgress] ({ loaded, total, percent, stage })
 */
export async function downloadJapaneseVoice(voiceId, onProgress) {
  const meta = JA_VOICE_CATALOG[voiceId];
  if (!meta) throw new Error(`未対応の日本語音声モデルIDです: ${voiceId}`);

  const report = (stage, pct, extra = {}) => {
    if (onProgress) onProgress({ stage, percent: pct, ...extra });
  };

  report('日本語音素エンジン辞書 (WASM) 確認中...', 5);

  // 1. piper_plus_wasm_bg.wasm（OpenJTalk / NAIST-JDIC辞書内蔵）が完全な状態で保存されているか
  let wasmBlob = await getBlob('piper_plus_wasm_bg.wasm');
  if (!wasmBlob || wasmBlob.size < MIN_VALID_WASM_SIZE) {
    report('日本語形態素辞書 (WASM ~60MB) ダウンロード中...', 10);
    wasmBlob = await fetchBlobWithProgress(PIPER_PLUS_WASM_BIN_URL, (p) => {
      report('日本語形態素辞書 (WASM) ダウンロード中...', 10 + Math.round(p.percent * 0.45));
    }, 60070390);

    if (wasmBlob.size < MIN_VALID_WASM_SIZE) {
      throw new Error(`ダウンロードした日本語形態素辞書(WASM)のサイズが不完全です (${wasmBlob.size} bytes)。通信環境をご確認の上、再試行してください。`);
    }
    await saveBlob('piper_plus_wasm_bg.wasm', wasmBlob);
  }

  // 2. モデル設定 config.json
  report('モデル設定ファイル取得中...', 60);
  const configUrl = `https://huggingface.co/${meta.repo}/resolve/main/${meta.configFile}`;
  const configBlob = await fetchBlobWithProgress(configUrl);
  await saveBlob(`${voiceId}.onnx.json`, configBlob);

  // 3. ONNX モデル本体 (~38MB)
  report('日本語音声モデル (ONNX ~38MB) ダウンロード中...', 65);
  const onnxUrl = `https://huggingface.co/${meta.repo}/resolve/main/${meta.onnxFile}`;
  const onnxBlob = await fetchBlobWithProgress(onnxUrl, (p) => {
    report('日本語音声モデル (ONNX) ダウンロード中...', 65 + Math.round(p.percent * 0.33));
  });
  await saveBlob(`${voiceId}.onnx`, onnxBlob);

  report('IndexedDB 格納完了！', 100);
  return { success: true, voiceId };
}

/**
 * 日本語音声推論セッションを初期化・ロード（IndexedDB から完全オフライン起動）
 * @param {string} voiceId 
 */
export async function initJapaneseVoiceSession(voiceId) {
  if (activeJaSession_ && activeJaVoiceId_ === voiceId) {
    return activeJaSession_;
  }

  const ort = window.ort;
  if (!ort) {
    throw new Error('ONNX Runtime Web (ort) がロードされていません。');
  }

  // 1. WASM モジュール初期化
  if (!isWasmInitialized_) {
    const wasmBlob = await getBlob('piper_plus_wasm_bg.wasm');
    if (!wasmBlob || wasmBlob.size < MIN_VALID_WASM_SIZE) {
      throw new Error('日本語形態素辞書(WASM)が保存されていないか不完全です。保護者メニューでダウンロードしてください。');
    }
    const buf = await wasmBlob.arrayBuffer();
    await initWasm(buf);
    isWasmInitialized_ = true;
  }

  // 2. IndexedDB からモデルと設定を取得
  const [modelBlob, configBlob] = await Promise.all([
    getBlob(`${voiceId}.onnx`),
    getBlob(`${voiceId}.onnx.json`)
  ]);

  if (!modelBlob || !configBlob) {
    throw new Error(`日本語音声モデル ${voiceId} が IndexedDB に見つかりません。ダウンロードしてください。`);
  }

  const configText = await configBlob.text();
  const modelConfig = JSON.parse(configText);

  // 3. WasmPhonemizer インスタンス化
  const phonemizer = new WasmPhonemizer(configText);

  // 4. ONNX 推論セッション作成 (WASM プロバイダ)
  const modelBuffer = await modelBlob.arrayBuffer();
  const ortSession = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });

  activeJaSession_ = {
    voiceId,
    modelConfig,
    ortSession,
    phonemizer
  };
  activeJaVoiceId_ = voiceId;

  return activeJaSession_;
}

/**
 * 日本語チャンクを推論して PCM Float32Array を生成
 */
async function predictJaChunk_(text, session) {
  const ort = window.ort;
  const config = session.modelConfig;

  // 1. 音素化 (OpenJTalk G2P + prosody features)
  const phonemizeRes = session.phonemizer.phonemize(text, 'ja');
  let phonemeIds = null;
  let flatProsody = null;
  try {
    phonemeIds = Array.from(phonemizeRes.phonemeIds);
    const pFlat = phonemizeRes.prosodyFeatures;
    if (pFlat && pFlat.length > 0) {
      flatProsody = Array.from(pFlat);
    }
  } finally {
    phonemizeRes.free();
  }

  if (!phonemeIds || phonemeIds.length === 0) {
    throw new Error('音素列の生成に失敗しました。');
  }

  // 2. 推論スケール値
  const noiseScale = config.inference?.noise_scale ?? 0.4;
  const lengthScale = config.inference?.length_scale ?? 1.0;
  const noiseW = config.inference?.noise_w ?? 0.5;

  const feeds = {
    input: new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map((id) => BigInt(id))), [1, phonemeIds.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]),
    scales: new ort.Tensor('float32', new Float32Array([noiseScale, lengthScale, noiseW]), [3])
  };

  const inputNames = new Set(session.ortSession.inputNames || []);

  // 言語 ID (ja: 0)
  if (inputNames.has('lid') && config.language_id_map && config.language_id_map.ja !== undefined) {
    const langId = config.language_id_map.ja;
    feeds.lid = new ort.Tensor('int64', BigInt64Array.from([BigInt(langId)]), [1]);
  }

  // 話者 ID (デフォルト 0)
  if (inputNames.has('sid')) {
    feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
  }

  // 韻律・アクセント特徴量 (prosody_features)
  if (inputNames.has('prosody_features') && flatProsody && flatProsody.length > 0) {
    feeds.prosody_features = new ort.Tensor(
      'int64',
      BigInt64Array.from(flatProsody.map((v) => BigInt(v))),
      [1, phonemeIds.length, 3]
    );
  }

  const results = await session.ortSession.run(feeds);
  const outputTensor = results.output || Object.values(results)[0];
  return outputTensor.data;
}

/**
 * 日本語テキストから WAV 音声 Blob を合成
 * @param {string} text 
 * @param {string} [voiceId] 
 * @returns {Promise<Blob>}
 */
export async function synthesizeJapanese(text, voiceId = 'ja_JP-tsukuyomi-chan') {
  const session = await initJapaneseVoiceSession(voiceId);
  const sampleRate = session.modelConfig.audio?.sample_rate || 22050;

  const chunks = splitIntoChunks(text);
  if (chunks.length === 0) throw new Error('音声合成するテキストが空です。');

  const pcms = [];
  for (const chunk of chunks) {
    const pcm = await predictJaChunk_(chunk, session);
    pcms.push(pcm);
  }

  const totalLen = pcms.reduce((acc, cur) => acc + cur.length, 0);
  const merged = new Float32Array(totalLen);
  let offset = 0;
  for (const pcm of pcms) {
    merged.set(pcm, offset);
    offset += pcm.length;
  }

  return pcm2wav(merged, 1, sampleRate);
}

/**
 * 日本語音声を再生
 * @param {string} text 
 * @param {Object} [options]
 * @param {string} [options.voiceId]
 * @param {number} [options.rate]
 * @param {Function} [options.onStart]
 * @param {Function} [options.onEnd]
 * @param {Function} [options.onError]
 * @returns {Promise<void>}
 */
export async function speakJapanese(text, options = {}) {
  stopJapaneseAudio();

  const voiceId = options.voiceId || activeJaVoiceId_ || 'ja_JP-tsukuyomi-chan';
  const wavBlob = await synthesizeJapanese(text, voiceId);
  const audioUrl = URL.createObjectURL(wavBlob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentJaAudio_ = audio;

    if (options.rate && options.rate > 0) {
      audio.playbackRate = options.rate;
    }

    audio.onplay = () => {
      if (options.onStart) options.onStart();
    };

    audio.onended = () => {
      currentJaAudio_ = null;
      URL.revokeObjectURL(audioUrl);
      if (options.onEnd) options.onEnd();
      resolve();
    };

    audio.onerror = (e) => {
      currentJaAudio_ = null;
      URL.revokeObjectURL(audioUrl);
      if (options.onError) options.onError(e);
      reject(e);
    };

    audio.play().catch((err) => {
      currentJaAudio_ = null;
      URL.revokeObjectURL(audioUrl);
      if (options.onError) options.onError(err);
      reject(err);
    });
  });
}

/**
 * 現在再生中の日本語音声を停止
 */
export function stopJapaneseAudio() {
  if (currentJaAudio_) {
    try {
      currentJaAudio_.pause();
      currentJaAudio_.currentTime = 0;
    } catch (_) {}
    currentJaAudio_ = null;
  }
}

/**
 * 日本語セッションを破棄
 */
export function disposeJapaneseSession() {
  stopJapaneseAudio();
  if (activeJaSession_) {
    try {
      activeJaSession_.ortSession?.release?.();
      activeJaSession_.phonemizer?.free?.();
    } catch (_) {}
    activeJaSession_ = null;
    activeJaVoiceId_ = null;
  }
}
