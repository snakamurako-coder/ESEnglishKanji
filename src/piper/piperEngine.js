/**
 * piperEngine.js
 * Piper TTS の推論・音声合成・ダウンロード・再生エンジン
 * IndexedDB と連携し、完全オフラインでのモデル即時起動を実現
 */

import { saveBlob, getBlob, isVoiceCached, deleteVoice, clearCache, getStorageStats, listCachedVoices } from './piperIndexedDB.js';
import { createPiperPhonemize } from '../../node_modules/@mintplex-labs/piper-tts-web/dist/piper-o91UDS6e.js';

export const HF_BASE = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';
export const WASM_URL = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm';
export const DATA_URL = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data';

/**
 * 利用可能な音声モデルカタログ
 */
export const VOICE_CATALOG = {
  'en_US-lessac-medium': {
    id: 'en_US-lessac-medium',
    name: 'アメリカ英語（Lessac）',
    desc: '明瞭・標準的で聞き取りやすい発音（学習に最適・推奨）',
    lang: 'en',
    gender: 'female',
    sizeMb: 34,
    path: 'en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    recommended: true
  },
  'en_US-amy-medium': {
    id: 'en_US-amy-medium',
    name: 'アメリカ英語（Amy）',
    desc: '自然で親しみやすい女性の声',
    lang: 'en',
    gender: 'female',
    sizeMb: 33,
    path: 'en/en_US/amy/medium/en_US-amy-medium.onnx',
    recommended: false
  },
  'en_GB-alan-medium': {
    id: 'en_GB-alan-medium',
    name: 'イギリス英語（Alan）',
    desc: '落ち着いた英国紳士風の発音',
    lang: 'en',
    gender: 'male',
    sizeMb: 32,
    path: 'en/en_GB/alan/medium/en_GB-alan-medium.onnx',
    recommended: false
  }
};

/**
 * PCM Float32Array を WAV Blob に変換するユーティリティ
 */
export function pcm2wav(buffer, numChannels, sampleRate) {
  const bufferLength = buffer.length;
  const headerLength = 44;
  const view = new DataView(new ArrayBuffer(bufferLength * numChannels * 2 + headerLength));

  // "RIFF" チャンク
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, view.buffer.byteLength - 8, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " サブチャンク
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // サブチャンクサイズ (16 for PCM)
  view.setUint16(20, 1, true);           // 音声フォーマット (1 for PCM)
  view.setUint16(22, numChannels, true); // チャンネル数
  view.setUint32(24, sampleRate, true);  // サンプリング周波数
  view.setUint32(28, numChannels * 2 * sampleRate, true); // バイトレート
  view.setUint16(32, numChannels * 2, true);              // ブロックアライン
  view.setUint16(34, 16, true);          // ビット深度 (16-bit)

  // "data" サブチャンク
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, 2 * bufferLength, true);

  let p = headerLength;
  for (let i = 0; i < bufferLength; i++) {
    const v = buffer[i];
    if (v >= 1) view.setInt16(p, 32767, true);
    else if (v <= -1) view.setInt16(p, -32768, true);
    else view.setInt16(p, (v * 32768) | 0, true);
    p += 2;
  }

  return new Blob([view.buffer], { type: 'audio/wav' });
}

/**
 * テキストを指定文字数ごとに分割
 */
export function splitIntoChunks(text, maxLength = 250) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLength) return [trimmed];
  const sentences = trimmed.match(/[^.!?…\n]+[.!?…]*\s*/g) || [trimmed];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength) {
      if (current.trim()) chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * プログレス監視付き fetchBlob
 */
async function fetchBlobWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url} の取得に失敗しました。`);

  // プログレス監視が不要なファイルはネイティブ blob() で高速取得
  if (!onProgress) {
    return await res.blob();
  }

  const contentLength = +(res.headers.get('content-length') || 0);
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
      if (contentLength > 0) {
        const pct = Math.min(100, Math.round((received / contentLength) * 100));
        onProgress({ loaded: received, total: contentLength, percent: pct });
      } else {
        onProgress({ loaded: received, total: received, percent: 50 });
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }

  const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
  onProgress({ loaded: received, total: received, percent: 100 });
  return blob;
}

// エンジン内シングルトン状態
let activeSession_ = null;
let activeVoiceId_ = null;
let currentAudio_ = null;
let phonemizeBlobUrls_ = null;

/**
 * 音素化 WASM/データの URL を取得（IndexedDB キャッシュ優先）
 */
async function getPhonemizeUrls_() {
  if (phonemizeBlobUrls_) return phonemizeBlobUrls_;

  const [wasmBlob, dataBlob] = await Promise.all([
    getBlob('piper_phonemize.wasm'),
    getBlob('piper_phonemize.data')
  ]);

  phonemizeBlobUrls_ = {
    wasm: wasmBlob ? URL.createObjectURL(wasmBlob) : WASM_URL,
    data: dataBlob ? URL.createObjectURL(dataBlob) : DATA_URL
  };
  return phonemizeBlobUrls_;
}

/**
 * 指定モデルをダウンロードして IndexedDB に保存
 * @param {string} voiceId 
 * @param {Function} [onProgress] ({ loaded, total, percent, stage, filename })
 */
export async function downloadVoice(voiceId, onProgress) {
  const meta = VOICE_CATALOG[voiceId];
  if (!meta) throw new Error(`未対応の音声モデルIDです: ${voiceId}`);

  const report = (stage, pct, extra = {}) => {
    if (onProgress) onProgress({ stage, percent: pct, ...extra });
  };

  report('音素エンジン確認中...', 5);

  // 1. phonemize wasm & data が未保存なら一緒に保存（完全オフライン化）
  const hasWasm = await getBlob('piper_phonemize.wasm');
  if (!hasWasm) {
    report('音素エンジン (WASM) ダウンロード中...', 10);
    const wasmBlob = await fetchBlobWithProgress(WASM_URL);
    await saveBlob('piper_phonemize.wasm', wasmBlob);
  }

  const hasData = await getBlob('piper_phonemize.data');
  if (!hasData) {
    report('音素辞書データ ダウンロード中...', 20);
    const dataBlob = await fetchBlobWithProgress(DATA_URL, (p) => {
      report('音素辞書データ ダウンロード中...', 20 + Math.round(p.percent * 0.25));
    });
    await saveBlob('piper_phonemize.data', dataBlob);
  }

  // 2. モデル設定 JSON
  report('モデル設定取得中...', 50);
  const jsonUrl = `${HF_BASE}/${meta.path}.json`;
  const jsonBlob = await fetchBlobWithProgress(jsonUrl);
  await saveBlob(`${voiceId}.onnx.json`, jsonBlob);

  // 3. ONNX モデル本体 (~30MB)
  report('音声モデル (ONNX) ダウンロード中...', 55);
  const onnxUrl = `${HF_BASE}/${meta.path}`;
  const onnxBlob = await fetchBlobWithProgress(onnxUrl, (p) => {
    report('音声モデル (ONNX) ダウンロード中...', 55 + Math.round(p.percent * 0.42));
  });
  await saveBlob(`${voiceId}.onnx`, onnxBlob);

  report('IndexedDB 格納完了！', 100);
  return { success: true, voiceId };
}

/**
 * Piper TTS 推論セッションを初期化・ロード（IndexedDB から直接起動）
 * @param {string} voiceId 
 */
export async function initVoiceSession(voiceId) {
  if (activeSession_ && activeVoiceId_ === voiceId) {
    return activeSession_;
  }

  const ort = window.ort;
  if (!ort) {
    throw new Error('ONNX Runtime Web (ort) がロードされていません。ort.min.js を確認してください。');
  }

  // ONNX Runtime の設定
  if (ort.env) {
    if ('allowLocalModels' in ort.env) ort.env.allowLocalModels = false;
    if (ort.env.wasm) {
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
    }
  }

  // IndexedDB からモデルと設定を取得
  const [modelBlob, configBlob] = await Promise.all([
    getBlob(`${voiceId}.onnx`),
    getBlob(`${voiceId}.onnx.json`)
  ]);

  if (!modelBlob || !configBlob) {
    throw new Error(`音声モデル ${voiceId} が IndexedDB に見つかりません。ダウンロードしてください。`);
  }

  const configText = await configBlob.text();
  const modelConfig = JSON.parse(configText);

  // ONNX 推論セッションを作成 (WASM プロバイダ)
  const modelBuffer = await modelBlob.arrayBuffer();
  const ortSession = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });

  const phonemizeUrls = await getPhonemizeUrls_();

  activeSession_ = {
    voiceId,
    modelConfig,
    ortSession,
    phonemizeUrls
  };
  activeVoiceId_ = voiceId;

  return activeSession_;
}

/**
 * テキストから音素ID列を生成（WASM phonemizer 呼び出し）
 */
async function textToPhonemeIds_(text, espeakVoice, phonemizeUrls) {
  const input = JSON.stringify([{ text: text.trim() }]);
  return new Promise(async (resolve, reject) => {
    try {
      const module = await createPiperPhonemize({
        print: (data) => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.phoneme_ids);
          } catch (e) {
            reject(new Error(`音素パースエラー: ${e.message}`));
          }
        },
        printErr: (msg) => {
          console.warn('[PiperPhonemize warn]', msg);
        },
        locateFile: (url) => {
          if (url.endsWith('.wasm')) return phonemizeUrls.wasm;
          if (url.endsWith('.data')) return phonemizeUrls.data;
          return url;
        }
      });

      module.callMain([
        '-l',
        espeakVoice || 'en-us',
        '--input',
        input,
        '--espeak_data',
        '/espeak-ng-data'
      ]);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 指定チャンクの音声を推論して PCM Float32Array を生成
 */
async function predictChunk_(text, session) {
  const ort = window.ort;
  const espeakVoice = session.modelConfig.espeak?.voice || 'en-us';
  const phonemeIds = await textToPhonemeIds_(text, espeakVoice, session.phonemizeUrls);

  const noiseScale = session.modelConfig.inference?.noise_scale ?? 0.667;
  const lengthScale = session.modelConfig.inference?.length_scale ?? 1.0;
  const noiseW = session.modelConfig.inference?.noise_w ?? 0.8;

  const feeds = {
    input: new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)])),
    scales: new ort.Tensor('float32', new Float32Array([noiseScale, lengthScale, noiseW]))
  };

  const speakerIdMap = session.modelConfig.speaker_id_map || {};
  if (Object.keys(speakerIdMap).length > 0) {
    feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]));
  }

  const results = await session.ortSession.run(feeds);
  const outputTensor = results.output || Object.values(results)[0];
  return outputTensor.data;
}

/**
 * テキストから WAV 音声 Blob を合成
 * @param {string} text 
 * @param {string} [voiceId] 
 * @returns {Promise<Blob>}
 */
export async function synthesize(text, voiceId = 'en_US-lessac-medium') {
  const session = await initVoiceSession(voiceId);
  const sampleRate = session.modelConfig.audio?.sample_rate || 22050;

  const chunks = splitIntoChunks(text);
  if (chunks.length === 0) throw new Error('音声合成するテキストが空です。');

  const pcms = [];
  for (const chunk of chunks) {
    const pcm = await predictChunk_(chunk, session);
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
 * 音声を再生
 * @param {string} text 
 * @param {Object} [options]
 * @param {string} [options.voiceId]
 * @param {number} [options.rate] 再生速度 (0.5 ~ 2.0, デフォルト 1.0)
 * @param {Function} [options.onStart]
 * @param {Function} [options.onEnd]
 * @param {Function} [options.onError]
 * @returns {Promise<void>}
 */
export async function speak(text, options = {}) {
  stopAudio();

  const voiceId = options.voiceId || activeVoiceId_ || 'en_US-lessac-medium';
  const wavBlob = await synthesize(text, voiceId);
  const audioUrl = URL.createObjectURL(wavBlob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio_ = audio;

    if (options.rate && options.rate > 0) {
      audio.playbackRate = options.rate;
    }

    audio.onplay = () => {
      if (options.onStart) options.onStart();
    };

    audio.onended = () => {
      currentAudio_ = null;
      URL.revokeObjectURL(audioUrl);
      if (options.onEnd) options.onEnd();
      resolve();
    };

    audio.onerror = (e) => {
      currentAudio_ = null;
      URL.revokeObjectURL(audioUrl);
      if (options.onError) options.onError(e);
      reject(e);
    };

    audio.play().catch((err) => {
      currentAudio_ = null;
      URL.revokeObjectURL(audioUrl);
      if (options.onError) options.onError(err);
      reject(err);
    });
  });
}

/**
 * 現在再生中の音声を停止
 */
export function stopAudio() {
  if (currentAudio_) {
    try {
      currentAudio_.pause();
      currentAudio_.currentTime = 0;
    } catch (_) {}
    currentAudio_ = null;
  }
}

/**
 * セッションを破棄
 */
export function disposeSession() {
  stopAudio();
  if (activeSession_) {
    try {
      activeSession_.ortSession?.release?.();
    } catch (_) {}
    activeSession_ = null;
    activeVoiceId_ = null;
  }
  if (phonemizeBlobUrls_) {
    if (phonemizeBlobUrls_.wasm?.startsWith('blob:')) URL.revokeObjectURL(phonemizeBlobUrls_.wasm);
    if (phonemizeBlobUrls_.data?.startsWith('blob:')) URL.revokeObjectURL(phonemizeBlobUrls_.data);
    phonemizeBlobUrls_ = null;
  }
}
