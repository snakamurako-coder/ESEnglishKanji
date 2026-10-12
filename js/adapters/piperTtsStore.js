/**
 * js/adapters/piperTtsStore.js
 * Piper TTS のアプリ連携・UI状態管理・音声再生アダプター
 * 英語（Piper）および 日本語（Piper-Plus）のハイブリッド統合
 * IndexedDB への格納・即時起動・標準 SpeechSynthesis への自動フォールバックを統括
 */

(function (global) {
  'use strict';

  const PiperStore = {
    _isDownloading: false,

    /**
     * Piper TTS の動作状態を取得（英語・日本語両方）
     */
    async getStatus() {
      const piper = global.PiperTTS;
      if (!piper || !piper.isSupported()) {
        return {
          supported: false,
          enabled: false,
          jaEnabled: false,
          activeVoiceId: '',
          activeJaVoiceId: '',
          isCached: false,
          isJaCached: false,
          storageStats: { totalBytes: 0, formatted: '0 MB', fileCount: 0, voices: [] },
          voices: {},
          jaVoices: {}
        };
      }

      const activeVoiceId = piper.getActiveVoiceId();
      const activeJaVoiceId = piper.getActiveJapaneseVoiceId();

      const [isCached, isJaCached, storageStats, downloadedVoices] = await Promise.all([
        piper.isModelDownloaded(activeVoiceId),
        piper.isModelDownloaded(activeJaVoiceId),
        piper.getStorageStats(),
        piper.listDownloadedVoices()
      ]);

      return {
        supported: true,
        enabled: piper.isEnabled(),
        jaEnabled: piper.isJapaneseEnabled(),
        activeVoiceId,
        activeJaVoiceId,
        isCached,
        isJaCached,
        storageStats,
        downloadedVoices,
        voices: piper.VOICES || {},
        jaVoices: piper.JA_VOICES || {}
      };
    },

    /**
     * 音声の再生
     * 該当言語の Piper が利用可能（IndexedDB 保存済み ＆ 有効）なら Piper で高音質再生
     * 未ダウンロードまたはエラー時は false を返し、呼び出し元の SpeechSynthesis にフォールバック
     * 
     * @param {string} text 再生テキスト
     * @param {Object} [options]
     * @param {string} [options.lang] 'en' | 'ja'
     * @param {number} [options.rate] 速度 (0.5 ~ 2.0)
     * @param {Function} [options.onStart]
     * @param {Function} [options.onEnd]
     * @param {Function} [options.onError]
     * @returns {Promise<boolean>} Piper で再生成功した場合は true、フォールバックが必要な場合は false
     */
    async speak(text, options = {}) {
      const piper = global.PiperTTS;
      if (!piper || !piper.isSupported()) return false;

      const lang = options.lang || (this.isLikelyEnglish(text) ? 'en' : 'ja');

      // 1. 日本語音声の再生処理
      if (lang === 'ja') {
        if (!piper.isJapaneseEnabled()) return false;
        const activeJaVoiceId = piper.getActiveJapaneseVoiceId();
        const cached = await piper.isModelDownloaded(activeJaVoiceId);
        if (!cached) return false;

        try {
          await piper.speak(text, {
            voiceId: activeJaVoiceId,
            lang: 'ja',
            rate: options.rate || 1.0,
            onStart: options.onStart,
            onEnd: options.onEnd,
            onError: options.onError
          });
          return true;
        } catch (err) {
          console.warn('[PiperTtsStore] 日本語 Piper 再生エラー。標準 TTS にフォールバックします:', err);
          if (options.onError) {
            try { options.onError(err); } catch (_) {}
          }
          return false;
        }
      }

      // 2. 英語音声の再生処理
      if (!piper.isEnabled()) return false;
      const activeVoiceId = piper.getActiveVoiceId();
      const cached = await piper.isModelDownloaded(activeVoiceId);
      if (!cached) return false;

      try {
        await piper.speak(text, {
          voiceId: activeVoiceId,
          lang: 'en',
          rate: options.rate || 1.0,
          onStart: options.onStart,
          onEnd: options.onEnd,
          onError: options.onError
        });
        return true;
      } catch (err) {
        console.warn('[PiperTtsStore] 英語 Piper 再生エラー。標準 TTS にフォールバックします:', err);
        if (options.onError) {
          try { options.onError(err); } catch (_) {}
        }
        return false;
      }
    },

    /**
     * 音声停止
     */
    stop() {
      if (global.PiperTTS) {
        global.PiperTTS.stop();
      }
    },

    /**
     * 英語テキストかどうかの簡易判定
     */
    isLikelyEnglish(text) {
      if (!text || typeof text !== 'string') return false;
      return !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
    },

    /**
     * 指定音声モデルのダウンロード（IndexedDB に永続化）
     */
    async downloadVoice(voiceId, onProgress) {
      const piper = global.PiperTTS;
      if (!piper) throw new Error('Piper TTS が初期化されていません。');
      if (this._isDownloading) throw new Error('既にダウンロードが進行中です。');

      this._isDownloading = true;
      try {
        const result = await piper.downloadVoice(voiceId, onProgress);
        return result;
      } finally {
        this._isDownloading = false;
      }
    },

    /**
     * 指定モデルを IndexedDB から削除
     */
    async deleteVoice(voiceId) {
      const piper = global.PiperTTS;
      if (!piper) return;
      await piper.deleteVoice(voiceId);
    },

    /**
     * 全ての IndexedDB キャッシュを消去
     */
    async clearAllStorage() {
      const piper = global.PiperTTS;
      if (!piper) return;
      await piper.clearAllStorage();
    },

    /**
     * おうちの人管理メニュー画面の Piper TTS UI バインド
     */
    async bindParentAdminUI() {
      const piper = global.PiperTTS;
      const container = document.getElementById('piper-tts-admin-container');
      if (!container) return;

      // 共通ストレージ表示
      const storageInfo = document.getElementById('piper-storage-info');

      // 英語 UI 要素
      const enToggle = document.getElementById('piper-enable-toggle');
      const enVoiceSelect = document.getElementById('piper-voice-select');
      const enBtnDownload = document.getElementById('piper-btn-download');
      const enBtnTest = document.getElementById('piper-btn-test');
      const enBtnDelete = document.getElementById('piper-btn-delete');
      const enStatusBadge = document.getElementById('piper-status-badge');
      const enProgressWrap = document.getElementById('piper-progress-wrap');
      const enProgressBar = document.getElementById('piper-progress-bar');
      const enProgressText = document.getElementById('piper-progress-text');

      // 日本語 UI 要素
      const jaToggle = document.getElementById('piper-ja-enable-toggle');
      const jaVoiceSelect = document.getElementById('piper-ja-voice-select');
      const jaBtnDownload = document.getElementById('piper-ja-btn-download');
      const jaBtnTest = document.getElementById('piper-ja-btn-test');
      const jaBtnDelete = document.getElementById('piper-ja-btn-delete');
      const jaStatusBadge = document.getElementById('piper-ja-status-badge');
      const jaProgressWrap = document.getElementById('piper-ja-progress-wrap');
      const jaProgressBar = document.getElementById('piper-ja-progress-bar');
      const jaProgressText = document.getElementById('piper-ja-progress-text');

      const refreshUI = async () => {
        const status = await this.getStatus();

        if (!status.supported) {
          if (enStatusBadge) {
            enStatusBadge.className = 'piper-badge piper-badge-danger';
            enStatusBadge.textContent = '❌ 非対応ブラウザ';
          }
          if (jaStatusBadge) {
            jaStatusBadge.className = 'piper-badge piper-badge-danger';
            jaStatusBadge.textContent = '❌ 非対応ブラウザ';
          }
          if (enBtnDownload) enBtnDownload.disabled = true;
          if (enBtnTest) enBtnTest.disabled = true;
          if (jaBtnDownload) jaBtnDownload.disabled = true;
          if (jaBtnTest) jaBtnTest.disabled = true;
          return;
        }

        // --- 英語 UI 更新 ---
        if (enToggle) enToggle.checked = status.enabled;

        if (enVoiceSelect && enVoiceSelect.options.length === 0) {
          enVoiceSelect.innerHTML = '';
          Object.values(status.voices).forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name} (${v.sizeMb}MB) ${v.recommended ? '★推奨' : ''}`;
            enVoiceSelect.appendChild(opt);
          });
        }
        if (enVoiceSelect) enVoiceSelect.value = status.activeVoiceId;

        if (status.isCached) {
          if (enStatusBadge) {
            enStatusBadge.className = 'piper-badge piper-badge-success';
            enStatusBadge.innerHTML = '🟢 <b>IndexedDB 保存済み</b>（オフライン即時起動可能）';
          }
          if (enBtnDownload) {
            enBtnDownload.textContent = '🔄 英語モデルを再ダウンロード';
            enBtnDownload.disabled = false;
          }
          if (enBtnTest) enBtnTest.disabled = false;
          if (enBtnDelete) enBtnDelete.style.display = 'inline-block';
        } else {
          if (enStatusBadge) {
            enStatusBadge.className = 'piper-badge piper-badge-warning';
            enStatusBadge.innerHTML = '🟡 <b>未ダウンロード</b>（標準音声で発音中）';
          }
          if (enBtnDownload) {
            enBtnDownload.textContent = '⬇️ 英語モデルをダウンロード（保存）';
            enBtnDownload.disabled = false;
          }
          if (enBtnTest) enBtnTest.disabled = true;
          if (enBtnDelete) enBtnDelete.style.display = 'none';
        }

        // --- 日本語 UI 更新 ---
        if (jaToggle) jaToggle.checked = status.jaEnabled;

        if (jaVoiceSelect && jaVoiceSelect.options.length === 0) {
          jaVoiceSelect.innerHTML = '';
          Object.values(status.jaVoices).forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name} (${v.sizeMb}MB) ${v.recommended ? '★推奨' : ''}`;
            jaVoiceSelect.appendChild(opt);
          });
        }
        if (jaVoiceSelect) jaVoiceSelect.value = status.activeJaVoiceId;

        if (status.isJaCached) {
          if (jaStatusBadge) {
            jaStatusBadge.className = 'piper-badge piper-badge-success';
            jaStatusBadge.innerHTML = '🟢 <b>IndexedDB 保存済み</b>（オフライン即時起動可能）';
          }
          if (jaBtnDownload) {
            jaBtnDownload.textContent = '🔄 日本語モデルを再ダウンロード';
            jaBtnDownload.disabled = false;
          }
          if (jaBtnTest) jaBtnTest.disabled = false;
          if (jaBtnDelete) jaBtnDelete.style.display = 'inline-block';
        } else {
          if (jaStatusBadge) {
            jaStatusBadge.className = 'piper-badge piper-badge-warning';
            jaStatusBadge.innerHTML = '🟡 <b>未ダウンロード</b>（標準音声で発音中）';
          }
          if (jaBtnDownload) {
            jaBtnDownload.textContent = '⬇️ 日本語モデルをダウンロード（保存）';
            jaBtnDownload.disabled = false;
          }
          if (jaBtnTest) jaBtnTest.disabled = true;
          if (jaBtnDelete) jaBtnDelete.style.display = 'none';
        }

        // --- ストレージ情報 ---
        if (storageInfo) {
          storageInfo.textContent = `IndexedDB 保存容量: ${status.storageStats.formatted} (${status.downloadedVoices.length} 件のモデル)`;
        }
      };

      await refreshUI();

      // 多重登録防止
      if (!container._bound) {
        container._bound = true;

        // 英語 トグル & 選択
        if (enToggle) {
          enToggle.addEventListener('change', () => {
            piper.setEnabled(enToggle.checked);
            refreshUI();
          });
        }
        if (enVoiceSelect) {
          enVoiceSelect.addEventListener('change', () => {
            piper.setActiveVoiceId(enVoiceSelect.value);
            refreshUI();
          });
        }

        // 英語 ダウンロード
        if (enBtnDownload) {
          enBtnDownload.addEventListener('click', async () => {
            const voiceId = enVoiceSelect ? enVoiceSelect.value : piper.getActiveVoiceId();
            enBtnDownload.disabled = true;
            if (enBtnTest) enBtnTest.disabled = true;
            if (enProgressWrap) enProgressWrap.style.display = 'block';

            try {
              await this.downloadVoice(voiceId, (p) => {
                if (enProgressBar) enProgressBar.style.width = `${p.percent}%`;
                if (enProgressText) enProgressText.textContent = `${p.stage} (${p.percent}%)`;
              });

              if (enProgressText) enProgressText.textContent = '✨ ダウンロード完了！IndexedDBに格納されました。';
              setTimeout(() => {
                if (enProgressWrap) enProgressWrap.style.display = 'none';
              }, 2500);
            } catch (err) {
              alert(`英語モデルのダウンロード中にエラーが発生しました: ${err.message}`);
              if (enProgressText) enProgressText.textContent = `エラー: ${err.message}`;
            } finally {
              await refreshUI();
            }
          });
        }

        // 英語 テスト発音
        if (enBtnTest) {
          enBtnTest.addEventListener('click', async () => {
            enBtnTest.disabled = true;
            const originalText = enBtnTest.textContent;
            enBtnTest.textContent = '🔊 再生中...';

            const testPhrases = [
              "Welcome! Let's enjoy English and Kanji together!",
              'Great job! Practice makes perfect.',
              'Good morning! Have a wonderful day.'
            ];
            const phrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];

            try {
              await piper.speak(phrase, {
                voiceId: enVoiceSelect ? enVoiceSelect.value : piper.getActiveVoiceId(),
                rate: 1.0,
                lang: 'en'
              });
            } catch (err) {
              alert(`英語テスト再生エラー: ${err.message}`);
            } finally {
              enBtnTest.disabled = false;
              enBtnTest.textContent = originalText;
            }
          });
        }

        // 英語 削除
        if (enBtnDelete) {
          enBtnDelete.addEventListener('click', async () => {
            const voiceId = enVoiceSelect ? enVoiceSelect.value : piper.getActiveVoiceId();
            if (!confirm(`保存済みの英語音声モデル（${voiceId}）を削除しますか？`)) {
              return;
            }
            await this.deleteVoice(voiceId);
            await refreshUI();
          });
        }

        // 日本語 トグル & 選択
        if (jaToggle) {
          jaToggle.addEventListener('change', () => {
            piper.setJapaneseEnabled(jaToggle.checked);
            refreshUI();
          });
        }
        if (jaVoiceSelect) {
          jaVoiceSelect.addEventListener('change', () => {
            piper.setActiveJapaneseVoiceId(jaVoiceSelect.value);
            refreshUI();
          });
        }

        // 日本語 ダウンロード
        if (jaBtnDownload) {
          jaBtnDownload.addEventListener('click', async () => {
            const voiceId = jaVoiceSelect ? jaVoiceSelect.value : piper.getActiveJapaneseVoiceId();
            jaBtnDownload.disabled = true;
            if (jaBtnTest) jaBtnTest.disabled = true;
            if (jaProgressWrap) jaProgressWrap.style.display = 'block';

            try {
              await this.downloadVoice(voiceId, (p) => {
                if (jaProgressBar) jaProgressBar.style.width = `${p.percent}%`;
                if (jaProgressText) jaProgressText.textContent = `${p.stage} (${p.percent}%)`;
              });

              if (jaProgressText) jaProgressText.textContent = '✨ ダウンロード完了！IndexedDBに格納されました。';
              setTimeout(() => {
                if (jaProgressWrap) jaProgressWrap.style.display = 'none';
              }, 2500);
            } catch (err) {
              alert(`日本語モデルのダウンロード中にエラーが発生しました: ${err.message}`);
              if (jaProgressText) jaProgressText.textContent = `エラー: ${err.message}`;
            } finally {
              await refreshUI();
            }
          });
        }

        // 日本語 テスト発音
        if (jaBtnTest) {
          jaBtnTest.addEventListener('click', async () => {
            jaBtnTest.disabled = true;
            const originalText = jaBtnTest.textContent;
            jaBtnTest.textContent = '🔊 再生中...';

            const testPhrases = [
              'こんにちは！漢字の学習をがんばりましょう！',
              'すばらしい！よくできましたね。',
              '今日も一日、楽しくべんきょうしましょう！'
            ];
            const phrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];

            try {
              await piper.speak(phrase, {
                voiceId: jaVoiceSelect ? jaVoiceSelect.value : piper.getActiveJapaneseVoiceId(),
                rate: 1.0,
                lang: 'ja'
              });
            } catch (err) {
              alert(`日本語テスト再生エラー: ${err.message}`);
            } finally {
              jaBtnTest.disabled = false;
              jaBtnTest.textContent = originalText;
            }
          });
        }

        // 日本語 削除
        if (jaBtnDelete) {
          jaBtnDelete.addEventListener('click', async () => {
            const voiceId = jaVoiceSelect ? jaVoiceSelect.value : piper.getActiveJapaneseVoiceId();
            if (!confirm(`保存済みの日本語音声モデル（${voiceId}）を削除しますか？`)) {
              return;
            }
            await this.deleteVoice(voiceId);
            await refreshUI();
          });
        }
      }
    }
  };

  global.PiperTtsStore = PiperStore;
})(typeof window !== 'undefined' ? window : this);
