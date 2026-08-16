// ▼ GASのURLを貼り付けてください（※前回と同じURLならそのままで大丈夫） ▼
    const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwzthKF9ZpIXPzaIY6rSXyoSN9XVrPml05KP-f-rTfYnxRqsBBzMpBxYe6NEoNcxdTA_A/exec";
    const LS_PENDING_FINISH_SAVE = "app_pending_finish_quiz_save_v1";
    const LS_FLUSHED_SUBMIT_IDS = "app_flushed_submit_ids_v1";
    const PENDING_FINISH_FLUSH_MAX_ATTEMPTS = 5;

    /** GAS 向け POST（Content-Type 未指定＝text/plain。application/json は CORS プリフライトを誘発しやすい） */
    function gasApiBuildBody(bodyObj) {
      return JSON.stringify(bodyObj == null ? {} : bodyObj);
    }
    function gasApiIsRetryableError(msg) {
      return /Load failed|Failed to fetch|NetworkError|network|fetch|aborted|timeout|timed out|XHR|AbortError|Cancelled|CORS|temporarily unavailable|ECONNRESET|socket|non-JSON|HTML|doGet|HTTP 5\d\d|HTTP 429/i.test(String(msg || ""));
    }
    function gasApiResponseLooksInvalid_(raw) {
      const s = String(raw || "").replace(/^\uFEFF/, "").trim();
      if (!s) return true;
      if (/<!DOCTYPE|<html/i.test(s)) return true;
      if (/^OK:\s*GAS endpoint is running/i.test(s)) return true;
      return false;
    }
    function gasApiBuildNonJsonError_(res) {
      const raw = String((res && res.text) || "").replace(/^\uFEFF/, "").trim();
      if (/<!DOCTYPE|<html/i.test(raw)) {
        return new Error("サーバーが HTML を返しました（Webアプリの公開設定を確認してください）");
      }
      if (/^OK:\s*GAS endpoint is running/i.test(raw)) {
        return new Error("サーバー応答が不正です（通信の再試行に失敗しました。ページを再読み込みしてください）");
      }
      const err = new Error("GAS non-JSON response HTTP " + String((res && res.status) || 0));
      err.httpStatus = res && res.status;
      err.rawText = raw.slice(0, 500);
      return err;
    }
    function gasApiFetchOnce(bodyStr, timeoutMs, useFetch) {
      if (!useFetch && typeof XMLHttpRequest !== "undefined") {
        return new Promise(function (resolve, reject) {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", GAS_API_URL, true);
          xhr.timeout = timeoutMs;
          xhr.onload = function () {
            resolve({ status: xhr.status, text: String(xhr.responseText || "") });
          };
          xhr.onerror = function () { reject(new Error("XHR network error")); };
          xhr.ontimeout = function () { reject(new Error("XHR timeout")); };
          xhr.send(bodyStr);
        });
      }
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      if (controller && timeoutMs > 0) {
        timer = setTimeout(function () {
          try { controller.abort(); } catch (_) {}
        }, timeoutMs);
      }
      const init = {
        method: "POST",
        mode: "cors",
        body: bodyStr,
        cache: "no-store",
        credentials: "omit",
        redirect: "follow"
      };
      if (controller) init.signal = controller.signal;
      return fetch(GAS_API_URL, init)
        .then(function (r) {
          return r.text().then(function (text) {
            return { status: r.status, text: String(text || "") };
          });
        })
        .finally(function () {
          if (timer) clearTimeout(timer);
        });
    }
    function gasApiFetchText(bodyObj, opts) {
      const o = opts || {};
      const retries = typeof o.retries === "number" ? o.retries : 2;
      const timeoutMs = typeof o.timeoutMs === "number" ? o.timeoutMs : 90000;
      const bodyStr = typeof bodyObj === "string" ? bodyObj : gasApiBuildBody(bodyObj);
      const delays = Array.isArray(o.retryDelaysMs) ? o.retryDelaysMs : [600, 1400, 2800];
      const canXhr = typeof XMLHttpRequest !== "undefined";
      function attempt(left, attemptIndex) {
        const useFetch = !canXhr || (o.xhrFirst === false && attemptIndex === 0) || (attemptIndex > 0 && attemptIndex % 2 === 1);
        return gasApiFetchOnce(bodyStr, timeoutMs, useFetch).catch(function (e) {
          const msg = String((e && (e.message || e)) || "");
          if (left <= 0 || !gasApiIsRetryableError(msg)) throw e;
          const delay = delays[Math.min(attemptIndex, delays.length - 1)] || 1000;
          return new Promise(function (resolve) {
            setTimeout(resolve, delay);
          }).then(function () {
            return attempt(left - 1, attemptIndex + 1);
          });
        });
      }
      return attempt(retries, 0);
    }
    function gasApiParseJsonResponse(res) {
      const raw = String((res && res.text) || "").replace(/^\uFEFF/, "").trim();
      if (!raw || gasApiResponseLooksInvalid_(raw)) return null;
      try { return JSON.parse(raw); } catch (_) {}
      return null;
    }
    function savePendingFinishQuizPayload(payload) {
      try {
        localStorage.setItem(LS_PENDING_FINISH_SAVE, JSON.stringify({
          payload: payload,
          savedAt: Date.now(),
          userId: String((payload && payload.userId) || ""),
          sessionSubmitId: String((payload && payload.sessionSubmitId) || "")
        }));
      } catch (_) {}
    }
    function clearPendingFinishQuizPayload() {
      try { localStorage.removeItem(LS_PENDING_FINISH_SAVE); } catch (_) {}
    }
    function getFlushedSubmitIdSet() {
      try {
        const raw = localStorage.getItem(LS_FLUSHED_SUBMIT_IDS);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.map(String) : [];
      } catch (_) {
        return [];
      }
    }
    function rememberFlushedSubmitId(sessionSubmitId) {
      const id = String(sessionSubmitId || "").trim();
      if (!id) return;
      try {
        const list = getFlushedSubmitIdSet().filter(function (x) { return x !== id; });
        list.unshift(id);
        localStorage.setItem(LS_FLUSHED_SUBMIT_IDS, JSON.stringify(list.slice(0, 40)));
      } catch (_) {}
    }
    function isSubmitIdAlreadyFlushedLocally(sessionSubmitId) {
      const id = String(sessionSubmitId || "").trim();
      if (!id) return false;
      return getFlushedSubmitIdSet().indexOf(id) >= 0;
    }
    function applyPendingFinishQuizSuccess(d, expectedUserId) {
      if (!d || d.status !== "success") return;
      try {
        const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
        if (!user || !user.id) return;
        if (expectedUserId && String(user.id) !== String(expectedUserId)) return;
        if (d.newTotal != null) user.points = d.newTotal;
        if (!user.historyJson) user.historyJson = {};
        if (d.historyUnitId && d.historyUnitPatch) {
          mergeHistoryUnitPatchClient(user, d.historyUnitId, d.historyUnitPatch);
        } else if (d.historyJson) {
          user.historyJson = d.historyJson;
        }
        if (d.lastStudyKey && d.lastStudyAt) {
          if (!user.lastStudyJson) user.lastStudyJson = {};
          user.lastStudyJson[d.lastStudyKey] = d.lastStudyAt;
        }
        if (d.dailyPointsJson) user.dailyPointsJson = d.dailyPointsJson;
        if (d.trainingProgressJson) user.trainingProgressJson = d.trainingProgressJson;
        saveAppKidUserToLocal(user);
        const ptsEl = document.getElementById("user-points");
        if (ptsEl && d.newTotal != null) ptsEl.innerText = String(d.newTotal);
      } catch (_) {}
    }
    function flushPendingFinishQuizSave(user) {
      if (window.__pendingFinishFlushPromise) return window.__pendingFinishFlushPromise;
      const currentUserId = user && user.id ? String(user.id) : "";
      if (!currentUserId) return Promise.resolve(false);
      window.__pendingFinishFlushPromise = (function () {
        let raw = null;
        try { raw = localStorage.getItem(LS_PENDING_FINISH_SAVE); } catch (_) {}
        if (!raw) return Promise.resolve(false);
        let rec = null;
        try { rec = JSON.parse(raw); } catch (_) {
          clearPendingFinishQuizPayload();
          return Promise.resolve(false);
        }
        if (!rec || !rec.payload) {
          clearPendingFinishQuizPayload();
          return Promise.resolve(false);
        }
        const payloadUserId = String(rec.userId || (rec.payload && rec.payload.userId) || "");
        if (payloadUserId && payloadUserId !== currentUserId) {
          clearPendingFinishQuizPayload();
          return Promise.resolve(false);
        }
        const submitId = String(rec.sessionSubmitId || (rec.payload && rec.payload.sessionSubmitId) || "");
        if (submitId && isSubmitIdAlreadyFlushedLocally(submitId)) {
          clearPendingFinishQuizPayload();
          return Promise.resolve(false);
        }
        const age = Date.now() - Number(rec.savedAt || 0);
        if (age > 7 * 24 * 60 * 60 * 1000) {
          clearPendingFinishQuizPayload();
          return Promise.resolve(false);
        }
        const flushAttempts = Number(rec.flushAttempts || 0);
        const lastFlushAt = Number(rec.lastFlushAt || 0);
        if (flushAttempts >= PENDING_FINISH_FLUSH_MAX_ATTEMPTS) {
          return Promise.resolve(false);
        }
        if (lastFlushAt && Date.now() - lastFlushAt < 15000) {
          return Promise.resolve(false);
        }
        try {
          rec.flushAttempts = flushAttempts + 1;
          rec.lastFlushAt = Date.now();
          localStorage.setItem(LS_PENDING_FINISH_SAVE, JSON.stringify(rec));
        } catch (_) {}
        return gasApiFetchText(rec.payload, { retries: 1, timeoutMs: 120000, xhrFallback: true })
          .then(function (res) {
            const d = gasApiParseJsonResponse(res);
            if (d && d.status === "success") {
              clearPendingFinishQuizPayload();
              if (submitId) rememberFlushedSubmitId(submitId);
              applyPendingFinishQuizSuccess(d, currentUserId);
              return true;
            }
            return false;
          })
          .catch(function () { return false; });
      })().finally(function () {
        window.__pendingFinishFlushPromise = null;
      });
      return window.__pendingFinishFlushPromise;
    }
    function gasApiFetchJson(bodyObj, opts) {
      const o = opts || {};
      const parseRetries = typeof o.parseRetries === "number" ? o.parseRetries : 2;
      const delays = Array.isArray(o.retryDelaysMs) ? o.retryDelaysMs : [600, 1400, 2800];
      function attemptParse(left, attemptIndex) {
        // 初回は通常のネットワーク再試行。非JSONの再試行では軽めに（回数の掛け算を抑える）。
        const textOpts = Object.assign({}, o, {
          retries: attemptIndex === 0
            ? (typeof o.retries === "number" ? o.retries : 2)
            : 1
        });
        return gasApiFetchText(bodyObj, textOpts).then(function (res) {
          const d = gasApiParseJsonResponse(res);
          if (d) return d;
          const err = gasApiBuildNonJsonError_(res);
          if (left <= 0) throw err;
          const delay = delays[Math.min(attemptIndex, delays.length - 1)] || 1000;
          return new Promise(function (resolve) { setTimeout(resolve, delay); }).then(function () {
            return attemptParse(left - 1, attemptIndex + 1);
          });
        });
      }
      return attemptParse(parseRetries, 0);
    }

    let selectedUserId = null; let currentPin = ""; let isPinResetMode = false;
    let currentModeId = ""; let currentModeName = ""; let currentUnitName = "";
    let currentQuestions = []; let filteredQuestions = []; let currentQuestionIndex = 0; 
    let quizResults = []; let questionStartTime = 0; let currentIsReviewMode = false;
    let englishQuizSessionMeta = null;
    let englishUnitHistoryCache = {};
    let kanjiHistoryCache = {};

    function isEnglishUnitHistoryId(unitId) {
      const id = String(unitId || "");
      return !!id && !id.startsWith("__");
    }

    function getEnglishUnitHistoryCache(unitId) {
      const key = String(unitId || "");
      if (!key || !Object.prototype.hasOwnProperty.call(englishUnitHistoryCache, key)) return null;
      return englishUnitHistoryCache[key];
    }

    function setEnglishUnitHistoryCache(unitId, map) {
      const key = String(unitId || "");
      if (!key) return;
      englishUnitHistoryCache[key] = map || {};
    }

    function mergeEnglishUnitHistoryPatch(unitId, patch) {
      if (!unitId || !patch || typeof patch !== "object") return;
      const key = String(unitId);
      if (!englishUnitHistoryCache[key]) englishUnitHistoryCache[key] = {};
      Object.keys(patch).forEach(function (k) {
        englishUnitHistoryCache[key][k] = patch[k];
      });
    }

    function fetchEnglishUnitHistory(unitId) {
      const uid = String(unitId || "");
      if (!uid) return Promise.resolve({});
      const cached = getEnglishUnitHistoryCache(uid);
      if (cached) return Promise.resolve(cached);
      const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!user || !user.id) return Promise.resolve({});
      return fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_english_unit_history", userId: user.id, unitId: uid })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === "success" && d.historyUnit) {
            setEnglishUnitHistoryCache(uid, d.historyUnit);
            return d.historyUnit;
          }
          return {};
        })
        .catch(function () { return {}; });
    }

    function getKanjiHistoryCacheBucket(bucket) {
      const b = String(bucket || "__kanjiChallenge");
      if (!Object.prototype.hasOwnProperty.call(kanjiHistoryCache, b)) return null;
      return kanjiHistoryCache[b];
    }

    function setKanjiHistoryCacheBucket(bucket, data) {
      kanjiHistoryCache[String(bucket || "__kanjiChallenge")] = data || {};
    }

    function mergeKanjiChallengePatchClient(charKey, patch) {
      const key = String(charKey || "");
      if (!key || !patch) return;
      if (!kanjiHistoryCache["__kanjiChallenge"]) kanjiHistoryCache["__kanjiChallenge"] = {};
      kanjiHistoryCache["__kanjiChallenge"][key] = patch;
    }

    var kanjiChallengeCachePromise = null;
    function ensureKanjiChallengeCacheLoaded() {
      if (getKanjiHistoryCacheBucket("__kanjiChallenge")) {
        return Promise.resolve(kanjiHistoryCache["__kanjiChallenge"]);
      }
      if (kanjiChallengeCachePromise) return kanjiChallengeCachePromise;
      const fetchP = fetchKanjiHistoryBucket("__kanjiChallenge");
      const timeoutP = new Promise(function (resolve) {
        setTimeout(function () { resolve({}); }, 8000);
      });
      kanjiChallengeCachePromise = Promise.race([fetchP, timeoutP]).finally(function () {
        kanjiChallengeCachePromise = null;
      });
      return kanjiChallengeCachePromise;
    }

    function fetchKanjiHistoryBucket(bucket) {
      const b = String(bucket || "__kanjiChallenge");
      const cached = getKanjiHistoryCacheBucket(b);
      if (cached) return Promise.resolve(cached);
      const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!user || !user.id) return Promise.resolve({});
      return gasApiFetchJson(
        { action: "get_kanji_history_bucket", userId: user.id, bucket: b },
        { retries: 1, timeoutMs: 20000, parseRetries: 1, retryDelaysMs: [400] }
      )
        .then(function (d) {
          if (d && d.status === "success" && d.historyBucket) {
            setKanjiHistoryCacheBucket(b, d.historyBucket);
            return d.historyBucket;
          }
          return {};
        })
        .catch(function () { return {}; });
    }

    function stripEnglishUnitKeysFromHistoryJsonClient(historyJson) {
      const root = historyJson || {};
      Object.keys(root).forEach(function (k) {
        if (k && !String(k).startsWith("__")) delete root[k];
      });
      return root;
    }

    function stripKanjiKeysFromHistoryJsonClient(historyJson) {
      const root = historyJson || {};
      delete root.__kanjiChallenge;
      delete root.__kanjiWeak;
      delete root.__kanjiNigatePass;
      return root;
    }

    function stripKanjiAndEnglishFromHistoryJsonClient(historyJson) {
      stripEnglishUnitKeysFromHistoryJsonClient(historyJson);
      stripKanjiKeysFromHistoryJsonClient(historyJson);
      return historyJson;
    }

    let userInventoryData = []; let showAllInventory = false;
    function getUserIdForPref() {
      try {
        const user = JSON.parse(localStorage.getItem('app_kid_user'));
        return user && user.id ? user.id : 'guest';
      } catch(e) { return 'guest'; }
    }
    function getUserPref(key, defaultVal) {
      const uid = getUserIdForPref();
      const val = localStorage.getItem(`${uid}_${key}`);
      return val !== null ? val : defaultVal;
    }
    function setUserPref(key, val) {
      const uid = getUserIdForPref();
      localStorage.setItem(`${uid}_${key}`, val);
    }
    const GAS_API_OPTS_HOME_REFRESH = { retries: 1, timeoutMs: 45000, parseRetries: 1, retryDelaysMs: [400, 900] };

    function applyAppSettingsRefresh_(d) {
      if (typeof __crNormalizeSettings === 'function') d = __crNormalizeSettings(d);
      else if (window.AppNormalizeSettings) d = window.AppNormalizeSettings.normalizeSettingsResponse(d);
      if (!d || d.status !== "success" || !d.settings) return false;
      appSettings = d.settings;
      try { localStorage.setItem("app_cached_settings", JSON.stringify(d)); } catch (_e) {}
      try { persistKanjiHandScoreWeightsFromSettings(d.settings); } catch (_e2) {}
      return true;
    }

    function clearAppCacheAndReload(btn) {
      if (!confirm("最新の学習データと設定を読み込み直します。\nよろしいですか？（画面が再読み込みされます）")) return;
      const orig = btn ? toggleBtnLoading(btn, true) : null;
      const statusEl = document.getElementById("home-materials-sync-status");
      if (statusEl) statusEl.textContent = "キャッシュを消去して最新データを取得しています…";
      Object.keys(localStorage).forEach(function (k) {
        if (k.startsWith("app_cached_")) localStorage.removeItem(k);
      });
      materialsData = [];
      // 設定は待たず best-effort（get_app_settings は GAS 側で遅く・不安定になりやすい）
      gasApiFetchJson({ action: "get_app_settings" }, GAS_API_OPTS_HOME_REFRESH)
        .then(function (d) { applyAppSettingsRefresh_(d); })
        .catch(function () {});
      gasApiFetchJson({ action: "get_materials_list" }, GAS_API_OPTS_HOME_REFRESH)
        .then(function (mats) {
          if (!mats || mats.status !== "success") {
            if (btn) toggleBtnLoading(btn, false, orig);
            if (statusEl) statusEl.textContent = "教材一覧の取得に失敗しました。通信を確認のうえ、もう一度お試しください。";
            return;
          }
          persistMaterialsPayload(mats);
          if (statusEl) statusEl.textContent = "最新データを反映しています…";
          location.reload();
        })
        .catch(function () {
          if (btn) toggleBtnLoading(btn, false, orig);
          if (statusEl) statusEl.textContent = "取得に失敗しました。通信を確認のうえ、もう一度お試しください。";
        });
    }
    let appSettings = {}; let maxDeduction = 0; let autoNextTimer = null; let materialsData = []; let externalMenus = [];
    let kanjiQuizSession = null; let lastKanjiQuizContext = null;
    let __kanjiQuizSubmitInFlight = false;
    let currentMaterialsCategory = "english";
    let stopwatches = {
      home: { timerId: null, startAt: 0, elapsed: 0, running: false },
      external: { timerId: null, startAt: 0, elapsed: 0, running: false }
    };
    const STOPWATCH_MAX_MS_ = 90 * 60 * 1000;
    let stopwatchSyncInFlight_ = { home: false, external: false };
    let activeRewardTicket_ = null;
    let rewardCountdownTimerId_ = null;
    
    // ★ 穴埋め用ステート
    let fillBlanksData = []; 
    let activeFillBlankIndex = 0;
    let voiceFailCount = 0;
    let enFlashAnswerStarted = false;
    let enFlashRevealTimer = null;
    let enFlashCurrentEnglish = "";
    const EN_FLASH_VIEW_PENALTY = 2;
    const EN_FLASH_LISTEN_PENALTY = 1;
    const EN_FLASH_REVEAL_MS = 3000;
    const LS_INPUT_MODE = 'input_method_mode';
    const LS_QUIZ_RECOVERY_DRAFT = 'quiz_recovery_draft_v1';
    const LS_KANJI_QUIZ_RECOVERY_DRAFT = 'kanji_quiz_recovery_draft_v1';
    const LS_PEN_GUIDE_SPREAD = 'pen_guide_line_spread';
    const LS_PEN_GUIDE_SHOW = 'pen_guide_lines_show';
    const LS_PEN_CANVAS_MAX_WIDTH = 'pen_canvas_max_width_px';
    let inputMethodMode = getUserPref(LS_INPUT_MODE, 'keyboard');
    let isPenRecognitionInFlight = false;
    let resumePromptShownToken = "";
    let kanjiResumePromptShownToken = "";
    let handwritingState = {
      isDrawing: false,
      currentStroke: [],
      allStrokes: [],
      strokesBackupBeforeClear: null,
      pointerId: null,
      pointerType: '',
      activePenRect: null,
      lastTapAt: 0,
      penWidth: parseInt(getUserPref('pen_width', '4'), 10),
      penMode: getUserPref('pen_mode', 'pen'),
      guideLineSpread: (() => {
        const v = parseInt(getUserPref(LS_PEN_GUIDE_SPREAD, '50'), 10);
        return isNaN(v) ? 50 : Math.max(0, Math.min(100, v));
      })(),
      showGuideLines: getUserPref(LS_PEN_GUIDE_SHOW, '1') !== '0',
      canvasMaxWidthPx: (() => {
        const w = parseInt(getUserPref(LS_PEN_CANVAS_MAX_WIDTH, '1000'), 10);
        if (!isNaN(w)) return Math.max(400, Math.min(1200, w));
        return 1000;
      })(),
      pendingCandidates: [],
      pendingTempText: ""
    };

    const digitWords1to19 = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
    const digitWordsTens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
    function numberToWordsEn(num) {
      num = Number(num);
      if (!isFinite(num) || num < 0 || num > 9999) return String(num);
      if (num < 20) return digitWords1to19[num];
      if (num < 100) {
        const t = Math.floor(num / 10), r = num % 10;
        return digitWordsTens[t] + (r ? " " + digitWords1to19[r] : "");
      }
      if (num < 1000) {
        const h = Math.floor(num / 100), r = num % 100;
        return digitWords1to19[h] + " hundred" + (r ? " " + numberToWordsEn(r) : "");
      }
      const th = Math.floor(num / 1000), r = num % 1000;
      return digitWords1to19[th] + " thousand" + (r ? " " + numberToWordsEn(r) : "");
    }
    function numberToWordsSplitYear(num) {
      // 1000-9999 を「twenty twenty five」のように 2桁+2桁で読む
      num = Number(num);
      if (!isFinite(num) || num < 1000 || num > 9999) return "";
      const firstTwo = Math.floor(num / 100);
      const lastTwo = num % 100;
      return numberToWordsEn(firstTwo) + (lastTwo ? " " + numberToWordsEn(lastTwo) : "");
    }
    function numberToWordsVariants(numStr) {
      const n = Number(numStr);
      const out = new Set();
      out.add(numStr); // 数字そのもの
      if (!isFinite(n) || n < 0 || n > 9999) return [...out];
      out.add(numberToWordsEn(n)); // 標準
      if (n >= 1000 && n <= 3000) {
        const yearStyle = numberToWordsEn(n);
        out.add(yearStyle);
        const split = numberToWordsSplitYear(n);
        if (split) out.add(split);
      }
      return [...out];
    }
    function expandTextVariants(text) {
      const variants = [""];
      const str = String(text == null ? "" : text);
      let last = 0;
      str.replace(/\d+/g, (m, idx) => {
        const before = str.slice(last, idx);
        const numberForms = numberToWordsVariants(m);
        const next = [];
        variants.forEach(v => {
          numberForms.forEach(form => next.push(v + before + form));
        });
        variants.length = 0;
        variants.push(...next);
        last = idx + m.length;
      });
      if (last < str.length) {
        variants.forEach((v, i) => variants[i] = v + str.slice(last));
      }
      return variants;
    }
    function convertDigitsToWordsInText(text) {
      return String(text == null ? "" : text).replace(/\d+/g, n => numberToWordsEn(n));
    }
    const normalizeText = (text) => String(text == null ? "" : text).toLowerCase().replace(/[.,\-!?。、！？]/g, " ").replace(/\s+/g, ' ').trim();

    /** showQuestion と同じルールで正解文字列を得る（欠損データでも例外にしない） */
    function getCorrectAnswerForQuestion(q, format) {
      if (format === "ja_to_en") return String((q["英単語"] || q["英文"] || "")).trim();
      if (format === "en_to_ja") return String(q["日本語"] || "").trim();
      if (format === "qtext_to_en") return String(q["英文"] || "").trim();
      if (format === "en_audio_to_ja") return String(q["日本語"] || "").trim();
      if (format === "qaudio_to_en") return String(q["英文"] || "").trim();
      if (format === "en_audio_to_en") return String(q["英単語"] || q["英文"] || "").trim();
      if (format === "en_to_en") return String(q["英単語"] || q["英文"] || "").trim();
      if (format === "ja_to_en_sort") return getSortPrimaryCorrectDisplay(q);
      return "";
    }

    /** 日本語→英単語の「文字を隠す」穴埋め（fill_4choice / fill_typing）。sheet_fill_* は別系統。 */
    function isLegacyFillBlankAnswerType(ansType) {
      return ansType === "fill_4choice" || ansType === "fill_typing";
    }
    function applyEnToEnClueQuestionFilters(questions, format, ansType) {
      let list = Array.isArray(questions) ? questions.slice() : [];
      if (format !== "en_to_en") return list;
      if (ansType === "initial_typing" || ansType === "initial_voice") {
        list = list.filter(function (q) { return String(q["イニシャル"] || "").trim(); });
      } else if (ansType === "sheet_fill_typing" || ansType === "sheet_fill_voice") {
        list = list.filter(function (q) { return getSheetFillClueCandidates(q).length > 0; });
        list.forEach(function (q) { q._enClueText = pickRandomSheetFillClue(q); });
      }
      return list;
    }
    function getActiveQuizAnswerType() {
      const formatEl = document.getElementById("setting-format");
      const format = formatEl ? String(formatEl.value || "") : "";
      return syncAnswerTypeWithFormat(format);
    }
    /** セッション中の1問あたり基本点（記録済みなら quizResults と一致させる） */
    function getSessionBasePointPerQuestion(format, ansType, isWord) {
      if (Array.isArray(quizResults) && quizResults.length > 0) {
        const bp0 = Number(quizResults[0].basePoint);
        if (!isNaN(bp0) && bp0 > 0) return bp0;
      }
      return computeQuizBasePoint(format, ansType, isWord);
    }
    function isEnToEnFlashAnswerType(ansType) {
      return ansType === "flash_typing" || ansType === "flash_voice";
    }
    /** 英語→英語：イニシャル／穴埋め列を手がかりに英文を答えるモード */
    function isEnToEnClueAnswerType(ansType) {
      return ansType === "initial_typing" || ansType === "sheet_fill_typing" ||
        ansType === "initial_voice" || ansType === "sheet_fill_voice";
    }
    function isQuizFreeTypingAnswerType(ansType) {
      return ansType === "typing" || ansType === "initial_typing" || ansType === "sheet_fill_typing" ||
        ansType === "flash_typing";
    }
    function isQuizVoiceAnswerType(ansType) {
      return ansType === "voice" || ansType === "initial_voice" || ansType === "sheet_fill_voice" ||
        ansType === "flash_voice";
    }
    function getSheetFillClueCandidates(q) {
      const out = [];
      const a = String(q["穴埋め１"] != null ? q["穴埋め１"] : q["穴埋め1"] || "").trim();
      const b = String(q["穴埋め２"] != null ? q["穴埋め２"] : q["穴埋め2"] || "").trim();
      if (a) out.push(a);
      if (b) out.push(b);
      return out;
    }
    function pickRandomSheetFillClue(q) {
      const opts = getSheetFillClueCandidates(q);
      if (!opts.length) return "";
      return opts[Math.floor(Math.random() * opts.length)];
    }
    function getEnToEnCluePrompt(q, ansType) {
      if (ansType === "initial_typing" || ansType === "initial_voice") {
        return String(q["イニシャル"] || "").trim();
      }
      if (ansType === "sheet_fill_typing" || ansType === "sheet_fill_voice") {
        return String(q._enClueText || pickRandomSheetFillClue(q) || "").trim();
      }
      return "";
    }

    function clearEnFlashReveal_() {
      if (enFlashRevealTimer) {
        clearTimeout(enFlashRevealTimer);
        enFlashRevealTimer = null;
      }
      const slot = document.getElementById("en-flash-text-slot");
      if (slot) {
        slot.style.display = "none";
        slot.innerHTML = "";
      }
    }
    function resetEnFlashQuestionState_() {
      enFlashAnswerStarted = false;
      enFlashCurrentEnglish = "";
      clearEnFlashReveal_();
    }
    function buildEnFlashJaLineHtml_(q) {
      const jaLine = String(q && q["日本語"] != null ? q["日本語"] : "").trim();
      if (!jaLine) return "";
      return `<div class="en-flash-ja-line">${escapeHtml(jaLine)}</div>`;
    }
    function buildEnFlashToolbarHtml_() {
      return `<div id="en-flash-toolbar" class="en-flash-toolbar">
        <div id="en-flash-text-slot" class="en-flash-text-slot" style="display:none;" aria-live="polite"></div>
        <div class="en-flash-btn-row">
          <button type="button" id="en-flash-view-btn" class="hint-btn en-flash-hint-btn" onclick="useEnFlashRevealText()">英文を見る（-2点/一回）</button>
          <button type="button" id="en-flash-listen-btn" class="hint-btn en-flash-hint-btn" onclick="useEnFlashListenAudio()">英文を聞く（-1点/一回）</button>
        </div>
      </div>`;
    }
    function useEnFlashRevealText() {
      if (!enFlashAnswerStarted || !enFlashCurrentEnglish) return;
      maxDeduction += EN_FLASH_VIEW_PENALTY;
      clearEnFlashReveal_();
      const slot = document.getElementById("en-flash-text-slot");
      if (!slot) return;
      slot.innerHTML = `<div class="en-flash-revealed-text">${escapeHtml(enFlashCurrentEnglish)}</div>`;
      slot.style.display = "block";
      enFlashRevealTimer = setTimeout(function () {
        enFlashRevealTimer = null;
        if (slot) slot.style.display = "none";
      }, EN_FLASH_REVEAL_MS);
      updateSessionScoreDisplay();
    }
    function useEnFlashListenAudio() {
      if (!enFlashAnswerStarted || !enFlashCurrentEnglish) return;
      if (quizEnglishAudioPlaying || quizEnglishAudioPending_) return;
      if (shouldQuizAudioVoiceMutex_() && quizVoiceListening) return;
      maxDeduction += EN_FLASH_LISTEN_PENALTY;
      speakQuizEnglishAudio(enFlashCurrentEnglish);
      updateSessionScoreDisplay();
    }
    function mountQuizVoiceAnswerArea_() {
      const answerArea = document.getElementById("quiz-answer-area");
      if (!answerArea) return;
      answerArea.innerHTML = `<input type="text" id="voice-recognized-text" class="large-input" readonly placeholder="ここに聞き取った言葉が出ます"><button id="voice-btn" class="submit-btn btn-blue" style="padding: 20px 40px; font-size: 24px; border-radius: 50px; display: block; margin: 0 auto;" onclick="startVoiceInput()">🎙️ マイクでこたえる</button><div id="voice-feedback" style="margin-top:15px; font-size:18px; color:#ccc;">おうちの静かな場所でやってみてね。</div>`;
      syncQuizAudioVoiceControls_();
    }
    function startEnFlashAnswer() {
      if (enFlashAnswerStarted) return;
      if (!Array.isArray(filteredQuestions) || currentQuestionIndex < 0 || currentQuestionIndex >= filteredQuestions.length) return;
      const q = filteredQuestions[currentQuestionIndex];
      const formatEl = document.getElementById("setting-format");
      const format = formatEl ? String(formatEl.value || "") : "";
      const answerType = syncAnswerTypeWithFormat(format);
      if (!isEnToEnFlashAnswerType(answerType)) return;
      enFlashAnswerStarted = true;
      questionStartTime = Date.now();
      clearEnFlashReveal_();
      const qTextEl = document.getElementById("quiz-q-text");
      if (qTextEl) qTextEl.innerHTML = buildEnFlashJaLineHtml_(q) + buildEnFlashToolbarHtml_();
      const answerArea = document.getElementById("quiz-answer-area");
      if (!answerArea) return;
      if (answerType === "flash_typing") {
        shiftMode = 0;
        isShiftHoldMode = false;
        answerArea.innerHTML = buildTypingInputAreaMarkup(false);
        if (inputMethodMode === "pen") setPenMode("pen");
        mountTypingMethodBody(false);
        placeQuizFeedbackAboveKeyboard(answerArea);
      } else {
        mountQuizVoiceAnswerArea_();
      }
    }

    function parseSortPhraseTokens(q) {
      const list = [];
      for (let i = 1; i <= 40; i++) {
        const key = "並び替え語句" + i;
        if (q[key] != null && String(q[key]).trim() !== "") list.push(String(q[key]).trim());
      }
      return list;
    }

    function getSortCardRawText(card) {
      if (!card) return "";
      if (card.dataset && card.dataset.sortRaw != null) return String(card.dataset.sortRaw).trim();
      return String(card.textContent || "").trim();
    }

    /** 文頭語句用：先頭の英字だけ大文字に（データが小文字でも自然な見え方） */
    function capitalizeSortLeadingToken(raw) {
      const t = String(raw || "");
      if (!t) return t;
      return t.replace(/^(\s*)([a-z])/, function (_m, sp, c) { return sp + c.toUpperCase(); });
    }

    /** 模範解答・ユーザー回答の表示用（文頭を大文字化） */
    function formatSortSentenceForDisplay(text) {
      const t = String(text || "").trim();
      if (!t) return t;
      return capitalizeSortLeadingToken(t);
    }

    function formatSortUserAnswerForDisplay(joined) {
      const parts = String(joined || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "";
      parts[0] = capitalizeSortLeadingToken(parts[0]);
      return parts.join(" ");
    }

    function refreshSortCardDisplays() {
      const pool = document.getElementById("sort-word-pool");
      const trash = document.getElementById("sort-trash-slot");
      if (pool) {
        Array.from(pool.children).forEach(function (c) {
          c.textContent = getSortCardRawText(c);
        });
      }
      if (trash) {
        Array.from(trash.children).forEach(function (c) {
          c.textContent = getSortCardRawText(c);
        });
      }
      const slot = document.getElementById("sort-answer-slot");
      if (slot) {
        Array.from(slot.children).forEach(function (c, idx) {
          const raw = getSortCardRawText(c);
          c.textContent = idx === 0 ? capitalizeSortLeadingToken(raw) : raw;
        });
      }
    }

    function createSortWordCard(rawText) {
      const card = document.createElement("div");
      card.className = "word-card";
      card.dataset.sortRaw = String(rawText || "");
      card.textContent = String(rawText || "");
      return card;
    }

    /** 回答欄の語句を読み上げ用テキストに（表示用の capitalize は使わない） */
    function getSortSpeechTextFromSlot() {
      const slot = document.getElementById("sort-answer-slot");
      if (!slot || slot.children.length === 0) return "";
      return Array.from(slot.children)
        .map(function (c) { return getSortCardRawText(c); })
        .filter(Boolean)
        .join(" ");
    }

    let sortSpeechTimer = null;
    function primeSpeechSynthesis() {
      if (!("speechSynthesis" in window)) return;
      loadVoices();
      try { window.speechSynthesis.resume(); } catch (_) {}
    }
    function scheduleSortSpeech(text, delayMs) {
      if (text == null || (typeof text !== "string" && typeof text !== "number")) return;
      const t = String(text).trim();
      if (!t) return;
      primeSpeechSynthesis();
      if (sortSpeechTimer) clearTimeout(sortSpeechTimer);
      sortSpeechTimer = setTimeout(function () {
        sortSpeechTimer = null;
        speakText(t, 0.88);
      }, delayMs == null ? 0 : delayMs);
    }

    /** 回答欄に並んだカードを順に読み上げ */
    function speakSortAnswerSlotInOrder() {
      const joined = getSortSpeechTextFromSlot();
      if (!joined) return;
      scheduleSortSpeech(joined, 80);
    }

    /** ドラッグ開始時：触ったカードの1語だけ読み上げ（表示用 capitalize は読まない） */
    function speakSortWordCard(card) {
      const raw = getSortCardRawText(card);
      if (!raw) return;
      scheduleSortSpeech(raw, 0);
    }

    function shouldSpeakSortAnswerSlotOnSort(evt) {
      if (!evt || !evt.to || evt.to.id !== "sort-answer-slot") return false;
      if (evt.to.children.length === 0) return false;
      if (evt.from && evt.from.id === "sort-answer-slot" && evt.to.id !== "sort-answer-slot") return false;
      return true;
    }

    function getDummyTokenForSort(q) {
      const raw = String(q["並び替え語句ダミー"] || "").trim();
      if (!raw) return "";
      const parts = raw.split(/[，,]/).map(s => s.trim()).filter(Boolean);
      return parts[0] || "";
    }

    function getSortPrimaryCorrectDisplay(q) {
      return String(q["並び替え箇所"] || q["英文"] || "").trim();
    }

    /** 並び替え出題対象か（語句3未満・模範なしの行はスキップ） */
    function isSortQuestionEligible(q, ansType) {
      const toks = parseSortPhraseTokens(q);
      if (toks.length < 3) return false;
      if (!getSortPrimaryCorrectDisplay(q)) return false;
      if (ansType === "sort_dummy" && !getDummyTokenForSort(q)) return false;
      return true;
    }

    function applyQuizQuestionFilters(questions, format, ansType) {
      let list = Array.isArray(questions) ? questions.slice() : [];
      if (format === "ja_to_en_sort") {
        return list.filter(function (q) { return isSortQuestionEligible(q, ansType); });
      }
      if (isLegacyFillBlankAnswerType(ansType)) {
        const numBlanks = parseInt(document.getElementById("setting-blank-count").value) || 1;
        list = list.filter(function (q) {
          const w = (q["英単語"] || q["英文"] || "").trim();
          return w.length > numBlanks;
        });
      }
      return applyEnToEnClueQuestionFilters(list, format, ansType);
    }

    function getSortAcceptableRawStrings(q) {
      const list = [];
      const add = (s) => { const t = String(s || "").trim(); if (t) list.push(t); };
      add(q["並び替え箇所"]);
      add(q["英文"]);
      for (let i = 1; i <= 5; i++) add(q["別解" + i]);
      return [...new Set(list)];
    }

    function isSortAnswerCorrect(userJoined, q) {
      const u = normalizeText(userJoined);
      if (!u) return false;
      for (const s of getSortAcceptableRawStrings(q)) {
        const variants = expandTextVariants(s).map(t => normalizeText(t));
        if (variants.some(v => v === u)) return true;
      }
      return false;
    }

    function shuffleArrayInPlace(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    let sortQuizState = null;

    function destroySortQuizIfAny() {
      if (sortSpeechTimer) { clearTimeout(sortSpeechTimer); sortSpeechTimer = null; }
      if (sortQuizState && Array.isArray(sortQuizState.sortables)) {
        sortQuizState.sortables.forEach(s => { try { s.destroy(); } catch (e) {} });
      }
      sortQuizState = null;
      window.__sortMissingModeActive = false;
    }

    function checkSortQuizSubmit() {
      const btn = document.getElementById("sort-submit-btn");
      if (!btn || !sortQuizState) return;
      const slot = document.getElementById("sort-answer-slot");
      if (!slot) return;
      const ok = slot.children.length === sortQuizState.expectedCount;
      btn.style.display = ok ? "block" : "none";
    }

    function addSortMissingWordCard() {
      const inp = document.getElementById("sort-missing-input");
      const pool = document.getElementById("sort-word-pool");
      if (!inp || !pool) return;
      const val = inp.value.trim();
      if (!val) return;
      const card = createSortWordCard(val);
      card.dataset.userMade = "1";
      pool.appendChild(card);
      inp.value = "";
      checkSortQuizSubmit();
    }

    function submitSortQuizAnswer() {
      const q = filteredQuestions[currentQuestionIndex];
      const slot = document.getElementById("sort-answer-slot");
      if (!slot || !sortQuizState) return;
      const userJoined = Array.from(slot.children).map(function (c) { return getSortCardRawText(c); }).join(" ");
      checkAnswer(userJoined, sortQuizState.primaryCorrect, q);
    }

    function placeQuizFeedbackAtTopOfAnswerArea(answerAreaEl) {
      const fb = document.getElementById("quiz-feedback");
      if (!fb || !answerAreaEl) return;
      if (answerAreaEl.firstChild !== fb) answerAreaEl.insertBefore(fb, answerAreaEl.firstChild);
    }

    function setupSortQuiz(q, answerType) {
      const variant = answerType === "sort_all" ? "all" : answerType === "sort_dummy" ? "dummy" : "missing";
      const tokens = parseSortPhraseTokens(q);
      const expectedCount = tokens.length;
      let poolTokens = tokens.slice();
      let missingIdx = -1;
      if (variant === "missing") {
        missingIdx = Math.floor(Math.random() * poolTokens.length);
        poolTokens = poolTokens.filter((_, i) => i !== missingIdx);
      }
      const extras = [];
      if (variant === "dummy") {
        const d = getDummyTokenForSort(q);
        if (d) extras.push(d);
      }
      const allCards = poolTokens.concat(extras);
      shuffleArrayInPlace(allCards);
      const primaryDisplay = getSortPrimaryCorrectDisplay(q);
      sortQuizState = {
        expectedCount,
        variant,
        missingIdx,
        primaryCorrect: primaryDisplay,
        sortables: []
      };
      const showMissing = variant === "missing";
      const showTrash = variant === "dummy";
      const answerArea = document.getElementById("quiz-answer-area");
      answerArea.innerHTML =
        `<div id="sort-quiz-root" class="sort-quiz-root">` +
        (showMissing
          ? `<div class="sort-missing-toolbar"><p class="sort-missing-desc">たりないカードはキーボードで入力して「カードにする」で追加できます。</p><input type="text" id="sort-missing-input" class="large-input" readonly placeholder="キーボードで入力"><div id="keyboard-container"></div></div>`
          : "") +
        `<div class="sort-area-header"><span class="sort-area-label">回答欄（ここにカードを並べてください）</span></div>` +
        `<div id="sort-answer-slot" class="sortable-area sort-answer-slot"></div>` +
        `<div class="sort-area-header"><span class="sort-area-label">仮置き場（自由に並べ替え可能）</span>` +
        `<button type="button" id="sort-move-all-btn" class="sort-btn-small">↑ この順で回答欄にいれる</button></div>` +
        `<div id="sort-word-pool" class="sortable-area sort-word-pool"></div>` +
        (showTrash
          ? `<div class="sort-area-header"><span class="sort-area-label">使わないカード（除外置き場）</span></div>` +
            `<div id="sort-trash-slot" class="sortable-area sort-trash-slot"></div>`
          : "") +
        `<button type="button" id="sort-submit-btn" class="submit-btn btn-green" style="display:none;width:100%;max-width:420px;margin:16px auto 0;">これで回答する</button></div>`;
      const pool = document.getElementById("sort-word-pool");
      allCards.forEach(function (w) {
        pool.appendChild(createSortWordCard(w));
      });
      if (showMissing) {
        shiftMode = 0; isShiftHoldMode = false;
        renderCustomKeyboard(false, true);
      }
      const onSortEnd = function (evt) {
        refreshSortCardDisplays();
        checkSortQuizSubmit();
        if (shouldSpeakSortAnswerSlotOnSort(evt)) {
          requestAnimationFrame(function () {
            speakSortAnswerSlotInOrder();
          });
        }
      };
      const opts = {
        group: "sort-shared",
        animation: 150,
        ghostClass: "sortable-ghost",
        onStart: function (evt) {
          if (evt && evt.item) speakSortWordCard(evt.item);
        },
        onEnd: onSortEnd
      };
      const sortAreaIds = ["sort-answer-slot", "sort-word-pool"];
      if (showTrash) sortAreaIds.push("sort-trash-slot");
      sortAreaIds.forEach(function (id) {
        const el = document.getElementById(id);
        if (el && typeof Sortable !== "undefined") sortQuizState.sortables.push(Sortable.create(el, opts));
      });
      const moveBtn = document.getElementById("sort-move-all-btn");
      if (moveBtn) {
        moveBtn.onclick = () => {
          const wp = document.getElementById("sort-word-pool");
          const ans = document.getElementById("sort-answer-slot");
          if (!wp || !ans) return;
          Array.from(wp.children).forEach(function (c) { ans.appendChild(c); });
          refreshSortCardDisplays();
          checkSortQuizSubmit();
          speakSortAnswerSlotInOrder();
        };
      }
      const sub = document.getElementById("sort-submit-btn");
      if (sub) sub.onclick = () => submitSortQuizAnswer();
      placeQuizFeedbackAtTopOfAnswerArea(answerArea);
      const sortRoot = document.getElementById("sort-quiz-root");
      if (sortRoot && !sortRoot.dataset.sortSpeechPrimed) {
        sortRoot.dataset.sortSpeechPrimed = "1";
        sortRoot.addEventListener("pointerdown", function () { primeSpeechSynthesis(); }, { once: true, capture: true });
      }
      primeSpeechSynthesis();
    }

    function computeQuizBasePoint(format, ansType, isWord) {
      const settingKey = `基本Pt_${format}_${ansType}`;

      function configuredPoint(key) {
        const n = getEnglishBasePointFromSettings_(key, isWord);
        return isNaN(n) ? null : n;
      }

      if (isLegacyFillBlankAnswerType(ansType)) {
        const cp = configuredPoint(settingKey);
        if (cp != null) return cp;
        const numBlanks = parseInt(document.getElementById('setting-blank-count').value) || 1;
        return 5 + numBlanks;
      }
      if (format === "ja_to_en_sort") {
        const cp = configuredPoint(settingKey);
        if (cp != null) return cp;
        if (ansType === "sort_all") return 25;
        if (ansType === "sort_dummy") return 28;
        if (ansType === "sort_missing") return 30;
        return 25;
      }
      if (isEnToEnClueAnswerType(ansType)) {
        const cp = configuredPoint(settingKey);
        if (cp != null) return cp;
        const parentKey = isQuizVoiceAnswerType(ansType)
          ? `基本Pt_${format}_voice`
          : `基本Pt_${format}_typing`;
        const parentPt = configuredPoint(parentKey);
        if (parentPt != null) return parentPt;
        return isWord ? 20 : 25;
      }
      if (isEnToEnFlashAnswerType(ansType)) {
        const cp = configuredPoint(settingKey);
        if (cp != null) return cp;
        const parentKey = ansType === "flash_voice"
          ? `基本Pt_${format}_voice`
          : `基本Pt_${format}_typing`;
        const parentPt = configuredPoint(parentKey);
        if (parentPt != null) return parentPt;
        return isWord ? 20 : 25;
      }
      const cp = configuredPoint(settingKey);
      if (cp != null) return cp;
      if (isWord) {
        if (ansType === "4choice") return format.includes("to_en") ? 3 : 2;
        if (isQuizFreeTypingAnswerType(ansType) || isQuizVoiceAnswerType(ansType)) return 20;
      } else {
        if (ansType === "4choice") return format.includes("to_en") ? 3 : 2;
        if (isQuizFreeTypingAnswerType(ansType) || isQuizVoiceAnswerType(ansType)) {
          return (format.includes("qtext") || format.includes("qaudio")) ? 30 : 25;
        }
      }
      return 0;
    }

    /** アプリ設定の英語基本点（3列: 単語/表現）。canonical のみ。 */
    function getEnglishBasePointFromSettings_(settingKey, isWord) {
      const raw = appSettings[settingKey];
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        const v = isWord ? raw.word : raw.expression;
        const n = Number(v);
        if (v != null && String(v).trim() !== "" && !isNaN(n)) return n;
      }
      return NaN;
    }

    /** GAS parseUnitSheetPointPercent_ と同じ（シート名末尾 _数字 ＝得点％） */
    function parseUnitSheetPointPercentClient(sheetName) {
      const s = String(sheetName || "");
      const m = s.match(/_(\d+)$/);
      if (!m) return 100;
      let p = parseInt(m[1], 10);
      if (isNaN(p)) return 100;
      if (p < 0) p = 0;
      if (p > 100) p = 100;
      return p;
    }

    /** 時間減衰のキー用：問題形式を正規化（セット＋形式ごとに独立） */
    function normalizeKanjiQuizFormatModeForScope_(formatMode) {
      const m = String(formatMode || "").trim();
      if (m === "stroke_order" || m === "stroke_order_trace") return "stroke_order";
      if (m === "write_kanji" || m === "ruby_to_kanji" || m === "brush") return "write_kanji";
      if (m === "select_kana" || m === "okurigana_shift") return "select_kana";
      if (m === "type_yomi" || m === "sentence_to_ruby" || m === "reading") return "type_yomi";
      if (m === "jukugo_yomi") return "jukugo_yomi";
      return m || "write_kanji";
    }
    function buildKanjiSetScopeIdLegacy_(modeName, unitName, setId) {
      return "KANJI_" + String(modeName || "") + "_" + String(unitName || "") + "_SET" + String(setId || "");
    }
    function buildKanjiSetScopeId_(modeName, unitName, setId, formatMode) {
      const fmt = normalizeKanjiQuizFormatModeForScope_(formatMode);
      return buildKanjiSetScopeIdLegacy_(modeName, unitName, setId) + "_FMT_" + fmt;
    }
    /** 形式付きキーを優先。write_kanji のみ旧キー（形式なし）へフォールバック */
    function readKanjiSetLastStudyAtClient_(lastStudyJson, modeName, unitName, setId, formatMode) {
      const json = lastStudyJson || {};
      const fmt = normalizeKanjiQuizFormatModeForScope_(formatMode);
      const scoped = buildKanjiSetScopeId_(modeName, unitName, setId, fmt);
      if (json[scoped]) return json[scoped];
      if (fmt === "write_kanji") {
        const legacy = buildKanjiSetScopeIdLegacy_(modeName, unitName, setId);
        if (json[legacy]) return json[legacy];
      }
      return null;
    }
    /** 漢字セット＋問題形式単位の時間経過倍率（GAS handleSaveLearningSession と同様）。 */
    function computeKanjiQuizTimeMultiplierClient(modeName, unitName, setId, formatMode) {
      try {
        const user = JSON.parse(localStorage.getItem("app_kid_user") || "{}");
        const lastStudyTimeStr = readKanjiSetLastStudyAtClient_(
          user.lastStudyJson,
          modeName,
          unitName,
          setId,
          formatMode
        );
        if (!lastStudyTimeStr) return 1.0;
        const lastTime = new Date(lastStudyTimeStr);
        if (isNaN(lastTime.getTime())) return 1.0;
        const diffHours = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
        let basePercent = 10 + Math.floor(diffHours / 2) * 10;
        if (basePercent > 100) basePercent = 100;
        return basePercent / 100;
      } catch (e) {
        return 1.0;
      }
    }

    /**
     * GAS calcKanjiCharRecoveryRate_ と同じ式（クライアント版）。
     * 直近1週間の高得点回数（合格＝score>=60 として記録される highScoreDates）が上限以上のときだけ、
     * 上限到達日から経った日数に応じて 0.1 → 1.0 へ徐々に回復する。アプリ設定が読めないので既定値を使う：
     *   - 高得点回数上限_週: 3
     *   - 回数上限後倍率   : 0.1
     *   - 回復率_日       : 0.15
     *   - 完全回復日数    : 7
     */
    function calcKanjiCharRecoveryRateClient_(highScoreDates, now) {
      const maxHighTimes = 3;
      const overRate = 0.1;
      const recoverPerDay = 0.15;
      const maxDays = 7;
      const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const recent = (Array.isArray(highScoreDates) ? highScoreDates : [])
        .map(function (v) { return new Date(v); })
        .filter(function (d) { return !isNaN(d.getTime()) && d.getTime() >= weekAgoMs; })
        .sort(function (a, b) { return a.getTime() - b.getTime(); });
      if (recent.length < maxHighTimes) return 1.0;
      const triggerDate = recent[maxHighTimes - 1];
      const dateOnly = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
      const days = Math.max(0, Math.floor((dateOnly(now) - dateOnly(triggerDate)) / (24 * 60 * 60 * 1000)));
      if (days >= maxDays) return 1.0;
      return Math.min(1, overRate + recoverPerDay * days);
    }

    /** kanji_history API キャッシュから highScoreDates を取り出す（canonical）。 */
    function readKanjiChallengeHighScoreDatesClient_(kanjiChar) {
      try {
        const cached = getKanjiHistoryCacheBucket("__kanjiChallenge");
        if (cached) {
          const rec = cached[String(kanjiChar || "")];
          return rec && Array.isArray(rec.highScoreDates) ? rec.highScoreDates : [];
        }
        return [];
      } catch (e) {
        return [];
      }
    }

    /**
     * セット全問で満点相当のときの「実際にもらえそうな」獲得ポイント見積り。
     *   各問: 既定の上位帯素点 10 × その漢字の回復率(直近一週間の高得点回数で減衰)
     *   × セット時間経過倍率 × 単元シート%
     * タイプ別Pt変更や次の問題以降の lastStudy 更新は反映できないため「およそ」の値。
     */
    function estimateKanjiQuizPerfectSessionPointsClient(unitName, modeName, setId, questions, formatMode) {
      const sheetPct = parseUnitSheetPointPercentClient(unitName);
      const fmt =
        formatMode != null
          ? formatMode
          : kanjiQuizSession && kanjiQuizSession.formatMode
            ? kanjiQuizSession.formatMode
            : getKanjiQuizFormatMode();
      const timeMult = computeKanjiQuizTimeMultiplierClient(modeName, unitName, setId, fmt);
      const list = Array.isArray(questions) ? questions : [];
      if (!list.length) return 0;
      const defaultTopBandPt = 10;
      const now = new Date();
      let total = 0;
      list.forEach(function (q) {
        const ch = (q && q.kanji) ? String(q.kanji) : "";
        const dates = readKanjiChallengeHighScoreDatesClient_(ch);
        const recRate = calcKanjiCharRecoveryRateClient_(dates, now);
        total += defaultTopBandPt * recRate * timeMult * (sheetPct / 100);
      });
      return Math.round(total * 100) / 100;
    }

    /**
     * 「同じ漢字を週内に何回も高得点で取ると次回以降のもらえる量が減る」回復率による減衰、
     * もしくは単元シート末尾の得点％ < 100 のいずれかが効いていれば確認ダイアログを出す。
     * キャンセルで false（呼び出し側はそこで開始を中止する）。
     */
    function confirmKanjiQuizIfReducedSheetPoints(unitName, modeName, setId, questions, formatMode) {
      const sheetPct = parseUnitSheetPointPercentClient(unitName);
      const list = Array.isArray(questions) ? questions : [];
      const n = list.length;
      const defaultTopBandPt = 10;
      const idealTotal = n * defaultTopBandPt;
      const approx = estimateKanjiQuizPerfectSessionPointsClient(
        unitName,
        modeName,
        setId,
        list,
        formatMode
      );
      // 計算誤差の吸収（おおよそ満額なら確認しない）
      const reduced = sheetPct < 100 || approx + 0.05 < idealTotal;
      if (!reduced) return true;
      const approxStr = formatPointDisplayNum(approx);
      const idealStr = formatPointDisplayNum(idealTotal);
      const reasons = [];
      if (sheetPct < 100) reasons.push("単元シートの獲得 " + sheetPct + "%");
      // 回復率の影響を見やすくするため、実際に減衰している漢字の数を数える
      const now = new Date();
      let decayedChars = 0;
      list.forEach(function (q) {
        const ch = (q && q.kanji) ? String(q.kanji) : "";
        const dates = readKanjiChallengeHighScoreDatesClient_(ch);
        const r = calcKanjiCharRecoveryRateClient_(dates, now);
        if (r < 1) decayedChars += 1;
      });
      if (decayedChars > 0) {
        reasons.push("最近よくできた漢字の回復まちが " + decayedChars + " 字");
      }
      const fmt = normalizeKanjiQuizFormatModeForScope_(formatMode || getKanjiQuizFormatMode());
      const timeMult = computeKanjiQuizTimeMultiplierClient(modeName, unitName, setId, fmt);
      if (timeMult < 0.999) {
        reasons.push("同じセット・同じ問題形式を20時間以内に再挑戦");
      }
      const reasonStr = reasons.length ? "（" + reasons.join(" / ") + "）" : "";
      const msg =
        "もらえるポイントが少なくなっています。\n" +
        "すべて正解でおおよそ " +
        approxStr +
        " ポイントです。\n" +
        "本来の最大は " +
        idealStr +
        " ポイント。\n" +
        reasonStr +
        "\n※ 別の問題形式なら満額になります。同じ形式は20時間経つと回復します。\n\n取り組みますか？";
      return confirm(msg);
    }

    /** handleSaveLearningSession と同じ係数（時間・ニガテ・ランダム） */
    function computePointsMultiplierClient() {
      const user = JSON.parse(localStorage.getItem('app_kid_user') || '{}');
      const meta = getEnglishQuizSessionMeta();
      const unitId = meta.detailedUnitId || getDetailedUnitId();
      let mult = 1.0;
      const lastStudyTimeStr = user.lastStudyJson && user.lastStudyJson[unitId];
      if (lastStudyTimeStr) {
        const lastTime = new Date(lastStudyTimeStr);
        const diffHours = (Date.now() - lastTime) / (1000 * 60 * 60);
        let basePercent = 10 + Math.floor(diffHours / 2) * 10;
        if (basePercent > 100) basePercent = 100;
        mult = basePercent / 100;
      }
      if (meta.isReviewMode) mult += 0.4;
      if (meta.isRandom) mult += 0.1;
      return mult;
    }

    /** GAS と同じ二段階の丸め */
    function applySessionEarnedFromRaw(sessionRawPoints, multiplier, sheetPointPercent) {
      const raw = Number(sessionRawPoints) || 0;
      if (raw <= 0) return 0;
      let earned = Math.round(raw * multiplier * 100) / 100;
      if (sheetPointPercent !== 100) {
        earned = Math.round(earned * (sheetPointPercent / 100) * 100) / 100;
      }
      return Math.max(0, earned);
    }

    /** 1問の素点（ヒント減点後も最低1点。0・マイナスにならない） */
    function computeQuestionRawPoints_(basePoint, maxDeduction) {
      const bp = Number(basePoint) || 2;
      const ded = Math.max(0, Number(maxDeduction) || 0);
      return Math.max(1, bp - ded);
    }

    /** 実際に差し引かれる減点（基本点-1が下限） */
    function computeEffectiveDeduction_(basePoint, maxDeduction) {
      const bp = Math.max(1, Number(basePoint) || 2);
      const ded = Math.max(0, Number(maxDeduction) || 0);
      return Math.min(ded, Math.max(0, bp - 1));
    }

    function rawPointsFromQuizResults(results) {
      let sum = 0;
      (results || []).forEach(res => {
        if (res.isCorrect) {
          sum += computeQuestionRawPoints_(res.basePoint, res.maxDeduction);
        }
      });
      return sum;
    }

    /** 回答中・未採点のヒント減点（確定得点には未反映） */
    function getCurrentQuestionPendingDeduction_() {
      if (!Array.isArray(filteredQuestions) || filteredQuestions.length === 0) return 0;
      if (currentQuestionIndex < 0 || currentQuestionIndex >= filteredQuestions.length) return 0;
      if (!Array.isArray(quizResults) || quizResults.length !== currentQuestionIndex) return 0;
      return Number(maxDeduction) || 0;
    }

    /**
     * 残りをすべて正解したときの素点見込み上限（各問最低1点を反映）。
     */
    function projectedMaxRawForSession_() {
      if (!filteredQuestions || filteredQuestions.length === 0) return 0;
      const meta = getEnglishQuizSessionMeta();
      const format = meta.format || (document.getElementById('setting-format') || {}).value || "";
      const ansType = meta.ansType || getActiveQuizAnswerType();
      const isWord = String(meta.modeName || currentModeName || "").includes("単語");
      const defaultBp = getSessionBasePointPerQuestion(format, ansType, isWord);
      const total = filteredQuestions.length;
      const results = Array.isArray(quizResults) ? quizResults : [];
      let sum = rawPointsFromQuizResults(results);
      const onCurrent = results.length === currentQuestionIndex && currentQuestionIndex < total;
      if (onCurrent) {
        const curBp = computeQuizBasePoint(format, ansType, isWord);
        sum += computeQuestionRawPoints_(curBp, getCurrentQuestionPendingDeduction_());
      }
      const remainingFull = Math.max(0, total - results.length - (onCurrent ? 1 : 0));
      sum += remainingFull * defaultBp;
      return sum;
    }

    /** 英語セット終了の再送で二重計上しないためのセッションID（同一回答なら同じ値） */
    function buildQuizSessionSubmitId(userId, unitId, results) {
      const fp = (results || []).map(function (res) {
        return String(res.questionId != null ? res.questionId : "") + ":" +
          (res.isCorrect ? "1" : "0") + ":" + String(res.timeSec != null ? res.timeSec : 0);
      }).join("|");
      const raw = String(userId || "") + "\x1f" + String(unitId || "") + "\x1f" + fp;
      let h = 0;
      for (let i = 0; i < raw.length; i++) {
        h = ((h << 5) - h) + raw.charCodeAt(i);
        h |= 0;
      }
      return "q_" + (h >>> 0).toString(36);
    }

    /** 英語クイズ終了時：サーバー応答を待たず端末側の集計を先に表示する */
    function buildLocalFinishQuizSummaryHtml(saveStatusHtml) {
      const totalQ = Array.isArray(filteredQuestions) ? filteredQuestions.length : 0;
      const correctCount = (quizResults || []).filter(function (r) { return r && r.isCorrect; }).length;
      const mult = computePointsMultiplierClient();
      const sheetPct = parseUnitSheetPointPercentClient(currentUnitName);
      const curRaw = rawPointsFromQuizResults(quizResults);
      const curEarned = applySessionEarnedFromRaw(curRaw, mult, sheetPct);
      const projectedEarned = applySessionEarnedFromRaw(projectedMaxRawForSession_(), mult, sheetPct);
      const statusLine = saveStatusHtml != null ? String(saveStatusHtml) : "";
      return `<h2 style="color:#4CAF50;">✨ おつかれさま！ ✨</h2>` +
        `<p>正解: <strong>${correctCount}</strong> / ${totalQ} 問</p>` +
        `<p>このセッションの得点: <span style="color:gold;font-size:30px;">${formatPointDisplayNum(curEarned)}</span> / ${formatPointDisplayNum(projectedEarned)} 点</p>` +
        (statusLine ? `<p id="result-save-status" style="font-size:14px;color:#aaa;margin-top:10px;">${statusLine}</p>` : "");
    }

    function sumMaxPossibleRawForSession() {
      if (!filteredQuestions || filteredQuestions.length === 0) return 0;
      const meta = getEnglishQuizSessionMeta();
      const format = meta.format || (document.getElementById('setting-format') || {}).value || "";
      const ansType = meta.ansType || getActiveQuizAnswerType();
      const isWord = String(meta.modeName || currentModeName || "").includes("単語");
      const defaultBp = getSessionBasePointPerQuestion(format, ansType, isWord);
      const results = Array.isArray(quizResults) ? quizResults : [];
      let sum = 0;
      for (let i = 0; i < results.length; i++) {
        const rbp = Number(results[i].basePoint);
        sum += (!isNaN(rbp) && rbp > 0) ? rbp : defaultBp;
      }
      const remaining = Math.max(0, filteredQuestions.length - results.length);
      sum += remaining * defaultBp;
      return sum;
    }

    function formatPointDisplayNum(v) {
      const n = Number(v);
      if (isNaN(n)) return '0';
      if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
      return String(Math.round(n * 100) / 100);
    }

    function updateSessionScoreDisplay() {
      const el = document.getElementById('quiz-score-bar');
      if (!el || !filteredQuestions || filteredQuestions.length === 0) {
        if (el) el.innerHTML = "";
        return;
      }
      const mult = computePointsMultiplierClient();
      const sheetPct = parseUnitSheetPointPercentClient(currentUnitName);
      const curRaw = rawPointsFromQuizResults(quizResults);
      const curEarned = applySessionEarnedFromRaw(curRaw, mult, sheetPct);
      const projectedEarned = applySessionEarnedFromRaw(projectedMaxRawForSession_(), mult, sheetPct);
      const parts = [];
      parts.push(`このセッションの得点 <strong style="color:#FFD54F;font-size:20px;">${formatPointDisplayNum(curEarned)}</strong> / <span style="color:#aaa;">${formatPointDisplayNum(projectedEarned)}</span> 点`);
      parts.push(`<span style="font-size:12px;color:#888;">（残り全問正解時の見込み最大。英文確認・ヒント減点・時間・ニガテ・ランダム・単元シート％を含む）</span>`);
      el.innerHTML = parts.join('<br>');
    }

    let recognition = null;
    let recognitionJa = null;
    let voiceRecognitionGen_ = 0;
    let voiceRecognitionPendingStart_ = null;
    let voiceRecognitionStopFallbackTimer_ = null;

    function createEnglishRecognition_() {
      if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return null;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const r = new SpeechRecognition();
      r.lang = 'en-US';
      r.interimResults = true;
      r.continuous = false;
      return r;
    }
    recognition = createEnglishRecognition_();

    function cancelVoiceRecognitionPendingStart_() {
      if (voiceRecognitionPendingStart_) {
        clearTimeout(voiceRecognitionPendingStart_);
        voiceRecognitionPendingStart_ = null;
      }
    }
    function resetVoiceBtnIdle_(btn, feedback, msg) {
      if (btn) {
        btn.innerText = "🎙️ マイクでこたえる";
        btn.style.background = "#2196F3";
        btn.disabled = false;
      }
      if (feedback && msg != null) feedback.innerText = String(msg);
      syncQuizAudioVoiceControls_();
    }
    function stopEnglishRecognitionSafely_(next) {
      cancelVoiceRecognitionPendingStart_();
      if (voiceRecognitionStopFallbackTimer_) {
        clearTimeout(voiceRecognitionStopFallbackTimer_);
        voiceRecognitionStopFallbackTimer_ = null;
      }
      voiceRecognitionGen_++;
      if (!recognition) {
        stopQuizVoiceListening_();
        if (typeof next === "function") next();
        return;
      }
      let finished = false;
      const finish = function () {
        if (finished) return;
        finished = true;
        if (voiceRecognitionStopFallbackTimer_) {
          clearTimeout(voiceRecognitionStopFallbackTimer_);
          voiceRecognitionStopFallbackTimer_ = null;
        }
        stopQuizVoiceListening_();
        if (typeof next === "function") next();
      };
      recognition.onend = function () { finish(); };
      try { recognition.abort(); } catch (_) {
        try { recognition.stop(); } catch (_2) { finish(); return; }
      }
      voiceRecognitionStopFallbackTimer_ = setTimeout(finish, 450);
    }
    let preferredVoice = null;
    let preferredJapaneseVoice = null;
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      if (englishVoices.length > 0) {
        const premiumKeywords = ['google us english', 'enhanced', 'premium', 'samantha', 'alex'];
        for (const keyword of premiumKeywords) { const match = englishVoices.find(v => v.name.toLowerCase().includes(keyword)); if (match) { preferredVoice = match; break; } }
        if (!preferredVoice) preferredVoice = englishVoices[0];
      }
      const japaneseVoices = voices.filter(v => v.lang.startsWith('ja'));
      if (japaneseVoices.length > 0) {
        preferredJapaneseVoice = null;
        const jaKeywords = ['google 日本語', 'google japanese', 'kyoko', 'otoya', 'enhanced', 'premium'];
        for (const keyword of jaKeywords) {
          const match = japaneseVoices.find(v => v.name.toLowerCase().includes(keyword.toLowerCase()));
          if (match) { preferredJapaneseVoice = match; break; }
        }
        if (!preferredJapaneseVoice) preferredJapaneseVoice = japaneseVoices[0];
      }
    }
    function textLooksJapanese(text) {
      return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(String(text || ""));
    }
    if ('speechSynthesis' in window) { window.speechSynthesis.onvoiceschanged = loadVoices; loadVoices(); }

    let quizEnglishAudioPlaying = false;
    let quizEnglishAudioPending_ = false;
    let quizVoiceListening = false;
    let activeQuizSpeechUtterance = null;
    let quizEnglishAudioSafetyTimer_ = null;

    function clearQuizEnglishAudioSafetyTimer_() {
      if (quizEnglishAudioSafetyTimer_) {
        clearTimeout(quizEnglishAudioSafetyTimer_);
        quizEnglishAudioSafetyTimer_ = null;
      }
    }
    function armQuizEnglishAudioSafetyTimer_(ms) {
      clearQuizEnglishAudioSafetyTimer_();
      quizEnglishAudioSafetyTimer_ = setTimeout(function () {
        quizEnglishAudioSafetyTimer_ = null;
        if (!quizEnglishAudioPlaying && !quizEnglishAudioPending_) return;
        quizEnglishAudioPlaying = false;
        quizEnglishAudioPending_ = false;
        activeQuizSpeechUtterance = null;
        syncQuizAudioVoiceControls_();
      }, ms == null ? 15000 : ms);
    }
    function clearQuizEnglishAudioPending_() {
      quizEnglishAudioPending_ = false;
      syncQuizAudioVoiceControls_();
    }

    function isQuizSectionActive_() {
      const sec = document.getElementById('section-quiz');
      return !!(sec && sec.classList.contains('active'));
    }
    function shouldQuizAudioVoiceMutex_() {
      return isQuizSectionActive_() && isQuizVoiceAnswerType(getActiveQuizAnswerType());
    }
    function setQuizEnglishAudioPlaying_(playing) {
      quizEnglishAudioPlaying = !!playing;
      if (!quizEnglishAudioPlaying) {
        quizEnglishAudioPending_ = false;
        clearQuizEnglishAudioSafetyTimer_();
      }
      syncQuizAudioVoiceControls_();
    }
    function stopQuizVoiceListening_() {
      if (!quizVoiceListening) return;
      quizVoiceListening = false;
      syncQuizAudioVoiceControls_();
    }
    function startQuizVoiceListening_() {
      quizVoiceListening = true;
      syncQuizAudioVoiceControls_();
    }
    function resetQuizAudioVoiceMutex_() {
      quizVoiceListening = false;
      quizEnglishAudioPlaying = false;
      quizEnglishAudioPending_ = false;
      activeQuizSpeechUtterance = null;
      clearQuizEnglishAudioSafetyTimer_();
      syncQuizAudioVoiceControls_();
    }
    function isQuizVoiceMicBlocked_() {
      return quizEnglishAudioPlaying || quizEnglishAudioPending_;
    }
    function releaseStuckQuizVoiceState_() {
      if (quizVoiceListening) {
        stopEnglishRecognitionSafely_(null);
      }
      if (isQuizVoiceMicBlocked_()) {
        const synthSpeaking = ('speechSynthesis' in window) && window.speechSynthesis.speaking;
        if (!synthSpeaking && !activeQuizSpeechUtterance) {
          quizEnglishAudioPlaying = false;
          quizEnglishAudioPending_ = false;
          clearQuizEnglishAudioSafetyTimer_();
          syncQuizAudioVoiceControls_();
        }
      }
    }
    function syncQuizAudioVoiceControls_() {
      const flashListenBtn = document.getElementById('en-flash-listen-btn');
      if (flashListenBtn) {
        const voiceMutex = shouldQuizAudioVoiceMutex_();
        flashListenBtn.disabled = quizEnglishAudioPlaying || quizEnglishAudioPending_ || (voiceMutex && quizVoiceListening);
      }
      if (!shouldQuizAudioVoiceMutex_()) return;
      const listenBtn = document.getElementById('quiz-listen-btn');
      const voiceBtn = document.getElementById('voice-btn');
      if (listenBtn) listenBtn.disabled = quizVoiceListening;
      if (voiceBtn) voiceBtn.disabled = isQuizVoiceMicBlocked_();
    }
    function speakQuizEnglishAudio(text, rate) {
      if (quizVoiceListening) return;
      speakText(text, rate == null ? 0.9 : rate, 'en');
    }

    /** langHint: 'ja' | 'en' | undefined（undefined は文字から自動判定） */
    function speakText(text, rate = 0.9, langHint) {
      if (!('speechSynthesis' in window)) {
        if (shouldQuizAudioVoiceMutex_()) {
          clearQuizEnglishAudioPending_();
          setQuizEnglishAudioPlaying_(false);
        }
        return;
      }
      if (text == null || (typeof text !== 'string' && typeof text !== 'number')) {
        if (shouldQuizAudioVoiceMutex_()) {
          clearQuizEnglishAudioPending_();
          setQuizEnglishAudioPlaying_(false);
        }
        return;
      }
      const t = String(text).trim();
      if (!t) {
        if (shouldQuizAudioVoiceMutex_()) {
          clearQuizEnglishAudioPending_();
          setQuizEnglishAudioPlaying_(false);
        }
        return;
      }
      loadVoices();
      try { window.speechSynthesis.resume(); } catch (_) {}
      const mutex = shouldQuizAudioVoiceMutex_();
      if (mutex) activeQuizSpeechUtterance = null;
      window.speechSynthesis.cancel();
      const uttr = new SpeechSynthesisUtterance(t);
      const useJa = langHint === 'ja' || (langHint !== 'en' && textLooksJapanese(t));
      if (useJa) {
        uttr.lang = 'ja-JP';
        uttr.rate = rate;
        if (preferredJapaneseVoice) uttr.voice = preferredJapaneseVoice;
        else {
          const jaVoice = window.speechSynthesis.getVoices().find(function (v) { return v.lang.startsWith('ja'); });
          if (jaVoice) uttr.voice = jaVoice;
        }
      } else {
        uttr.lang = 'en-US';
        uttr.rate = rate;
        if (preferredVoice) uttr.voice = preferredVoice;
      }
      if (mutex) {
        activeQuizSpeechUtterance = uttr;
        armQuizEnglishAudioSafetyTimer_(15000);
        uttr.onstart = function () {
          clearQuizEnglishAudioPending_();
          setQuizEnglishAudioPlaying_(true);
          armQuizEnglishAudioSafetyTimer_(15000);
        };
        uttr.onend = uttr.onerror = function () {
          if (activeQuizSpeechUtterance === uttr) {
            activeQuizSpeechUtterance = null;
            setQuizEnglishAudioPlaying_(false);
          }
        };
      }
      window.speechSynthesis.speak(uttr);
    }

    function formatStopwatch(ms) {
      const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
      const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(totalSeconds % 60).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    function formatRewardCountdown(ms) {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
      const s = String(totalSeconds % 60).padStart(2, '0');
      return m + ':' + s;
    }
    function getStopwatchElapsedMs_(target) {
      const st = stopwatches[target];
      if (!st) return 0;
      if (st.timerId) return Date.now() - st.startAt;
      return st.elapsed || 0;
    }
    function normalizeStopwatchSlotClient_(slot) {
      const out = { running: false, startAt: 0, elapsed: 0, timerId: null };
      const src = slot || {};
      out.running = !!src.running;
      out.startAt = Number(src.startAt || src.startedAtMs) || 0;
      out.elapsed = Math.max(0, Number(src.elapsed || src.elapsedMs) || 0);
      const now = Date.now();
      if (out.running) {
        if (!out.startAt) out.startAt = now;
        if (now - out.startAt >= STOPWATCH_MAX_MS_) {
          out.running = false;
          out.startAt = 0;
          out.elapsed = 0;
        }
      } else if (out.elapsed >= STOPWATCH_MAX_MS_) {
        out.elapsed = 0;
        out.startAt = 0;
      }
      return out;
    }
    function applyStopwatchState_(target, slot) {
      const st = stopwatches[target];
      if (!st) return;
      if (st.timerId) {
        clearInterval(st.timerId);
        st.timerId = null;
      }
      const norm = normalizeStopwatchSlotClient_(slot);
      st.running = norm.running;
      st.startAt = norm.startAt;
      st.elapsed = norm.elapsed;
      if (norm.running) {
        st.timerId = setInterval(function () {
          enforceStopwatchMaxDuration_(target);
          renderStopwatch(target);
        }, 200);
      }
      renderStopwatch(target);
    }
    function applyStopwatchJson_(json) {
      const src = json || {};
      applyStopwatchState_('home', src.home);
      applyStopwatchState_('external', src.external);
    }
    function buildStopwatchPayload_(target) {
      const st = stopwatches[target];
      if (!st) return { running: false, startedAtMs: 0, elapsedMs: 0 };
      const running = !!st.timerId;
      return {
        running: running,
        startedAtMs: running ? st.startAt : 0,
        elapsedMs: running ? Math.max(0, Date.now() - st.startAt) : Math.max(0, st.elapsed || 0)
      };
    }
    function syncStopwatchToServer(target, opts) {
      opts = opts || {};
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      if (!user || !user.id) return;
      if (stopwatchSyncInFlight_[target]) return;
      stopwatchSyncInFlight_[target] = true;
      const payload = buildStopwatchPayload_(target);
      fetch(GAS_API_URL, {
        method: 'POST',
        keepalive: !!opts.keepalive,
        body: JSON.stringify({
          action: 'save_stopwatch',
          userId: user.id,
          target: target,
          running: payload.running,
          startedAtMs: payload.startedAtMs,
          elapsedMs: payload.elapsedMs
        })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.status === 'success' && d.stopwatch) {
          if (user.stopwatchJson == null) user.stopwatchJson = {};
          user.stopwatchJson[target] = d.stopwatch[target];
          saveAppKidUserToLocal(user);
        }
      }).catch(function () {}).finally(function () {
        stopwatchSyncInFlight_[target] = false;
      });
    }
    function syncAllStopwatchesToServer(keepalive) {
      syncStopwatchToServer('home', { keepalive: keepalive });
      syncStopwatchToServer('external', { keepalive: keepalive });
    }
    function loadStopwatchFromServer(user) {
      if (!user || !user.id) return Promise.resolve();
      if (user.stopwatchJson) {
        applyStopwatchJson_(user.stopwatchJson);
      }
      return fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_stopwatch', userId: user.id })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.status === 'success' && d.stopwatch) {
          user.stopwatchJson = d.stopwatch;
          saveAppKidUserToLocal(user);
          applyStopwatchJson_(d.stopwatch);
        }
      }).catch(function () {});
    }
    function enforceStopwatchMaxDuration_(target) {
      const st = stopwatches[target];
      if (!st || !st.timerId) return;
      if (Date.now() - st.startAt >= STOPWATCH_MAX_MS_) {
        if (st.timerId) clearInterval(st.timerId);
        st.timerId = null;
        st.running = false;
        st.startAt = 0;
        st.elapsed = 0;
        syncStopwatchToServer(target);
      }
    }
    function renderStopwatch(target) {
      const el = document.getElementById(`${target}-sw-display`);
      if (!el) return;
      const st = stopwatches[target];
      const elapsed = getStopwatchElapsedMs_(target);
      el.innerText = formatStopwatch(elapsed);
    }
    function renderHomeStopwatchOrCountdown_() {
      const normal = document.getElementById('home-stopwatch-normal');
      const countdown = document.getElementById('home-reward-countdown');
      if (!normal || !countdown) return;
      if (activeRewardTicket_ && activeRewardTicket_.endsAt) {
        const remain = new Date(activeRewardTicket_.endsAt).getTime() - Date.now();
        if (remain > 0) {
          normal.style.display = 'none';
          countdown.style.display = 'block';
          const nameEl = document.getElementById('home-reward-countdown-name');
          const dispEl = document.getElementById('home-reward-countdown-display');
          if (nameEl) nameEl.innerText = activeRewardTicket_.rewardName || 'ご褒美';
          if (dispEl) dispEl.innerText = formatRewardCountdown(remain);
          return;
        }
        activeRewardTicket_ = null;
      }
      normal.style.display = 'block';
      countdown.style.display = 'none';
      renderStopwatch('home');
    }
    function startRewardCountdownTimer_() {
      if (rewardCountdownTimerId_) clearInterval(rewardCountdownTimerId_);
      rewardCountdownTimerId_ = setInterval(function () {
        renderHomeStopwatchOrCountdown_();
      }, 1000);
    }
    function setActiveRewardTicket_(ticket) {
      activeRewardTicket_ = ticket && ticket.endsAt ? ticket : null;
      try {
        const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
        if (user) {
          user.activeRewardTicket = activeRewardTicket_;
          saveAppKidUserToLocal(user);
        }
      } catch (_) {}
      renderHomeStopwatchOrCountdown_();
      startRewardCountdownTimer_();
    }
    function fetchActiveRewardTicket_(user) {
      if (!user || !user.id) return Promise.resolve();
      if (user.activeRewardTicket && user.activeRewardTicket.endsAt) {
        const remain = new Date(user.activeRewardTicket.endsAt).getTime() - Date.now();
        if (remain > 0) {
          setActiveRewardTicket_(user.activeRewardTicket);
        } else {
          user.activeRewardTicket = null;
          saveAppKidUserToLocal(user);
        }
      }
      return fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_active_reward_ticket', userId: user.id })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.status === 'success') {
          setActiveRewardTicket_(d.activeTicket || null);
        }
      }).catch(function () {});
    }
    function startStopwatch(target) {
      if (target === 'home' && activeRewardTicket_) return;
      const st = stopwatches[target];
      if (!st || st.timerId) return;
      st.startAt = Date.now() - (st.elapsed || 0);
      st.running = true;
      st.timerId = setInterval(function () {
        enforceStopwatchMaxDuration_(target);
        renderStopwatch(target);
      }, 200);
      renderStopwatch(target);
      syncStopwatchToServer(target);
    }
    function stopStopwatch(target) {
      const st = stopwatches[target];
      if (!st) return;
      if (st.timerId) {
        clearInterval(st.timerId);
        st.timerId = null;
        st.elapsed = Date.now() - st.startAt;
      }
      st.running = false;
      renderStopwatch(target);
      syncStopwatchToServer(target);
    }
    function resetStopwatch(target) {
      const st = stopwatches[target];
      if (!st) return;
      if (st.timerId) clearInterval(st.timerId);
      st.timerId = null;
      st.startAt = 0;
      st.elapsed = 0;
      st.running = false;
      renderStopwatch(target);
      syncStopwatchToServer(target);
    }

    function buildEnglishQuizSessionMeta() {
      const formatEl = document.getElementById('setting-format');
      const ansEl = document.getElementById('setting-answer-type');
      const orderEl = document.getElementById('setting-order');
      const blankEl = document.getElementById('setting-blank-count');
      const format = formatEl ? String(formatEl.value || "") : "";
      const ansType = syncAnswerTypeWithFormat(format);
      let detailedUnitId;
      if (isTrainingMode) {
        detailedUnitId = "TrainingRoute_" + currentTrainingStepIndex + "_" + currentUnitName;
      } else {
        detailedUnitId = currentModeName + "_" + currentUnitName + "_" + format + "_" + ansType;
        if (isLegacyFillBlankAnswerType(ansType)) {
          const blankCount = blankEl ? String(blankEl.value || "1") : "1";
          detailedUnitId += "_" + blankCount + "blanks";
        }
      }
      return {
        detailedUnitId: detailedUnitId,
        format: format,
        ansType: ansType,
        isRandom: orderEl ? orderEl.value === "random" : false,
        isReviewMode: !!currentIsReviewMode,
        unitSheetName: currentUnitName,
        modeName: currentModeName,
        isTrainingMode: !!isTrainingMode,
        trainingStepIndex: currentTrainingStepIndex,
        trainingMenuId: currentTrainingMenuId
      };
    }

    function captureEnglishQuizSessionMeta() {
      englishQuizSessionMeta = buildEnglishQuizSessionMeta();
      return englishQuizSessionMeta;
    }

    function getEnglishQuizSessionMeta() {
      return englishQuizSessionMeta || buildEnglishQuizSessionMeta();
    }

    function slimQuizResultsForSave(results) {
      return (results || []).map(function (res) {
        return {
          questionId: res && res.questionId != null ? res.questionId : "",
          isCorrect: !!(res && res.isCorrect),
          timeSec: Number(res && res.timeSec) || 0,
          basePoint: Number(res && res.basePoint) || 0,
          maxDeduction: Number(res && res.maxDeduction) || 0
        };
      });
    }

    function mergeHistoryUnitPatchClient(user, unitId, patch) {
      if (isEnglishUnitHistoryId(unitId)) {
        mergeEnglishUnitHistoryPatch(unitId, patch);
        return;
      }
      if (!user || !unitId || !patch || typeof patch !== "object") return;
      if (!user.historyJson) user.historyJson = {};
      if (!user.historyJson[unitId]) user.historyJson[unitId] = {};
      Object.keys(patch).forEach(function (k) {
        user.historyJson[unitId][k] = patch[k];
      });
    }

    var CLIENT_HISTORY_JSON_MAX_CHARS_ = 45000;
    var CLIENT_UNIT_HISTORY_MAX_Q_KEYS_ = 120;
    var CLIENT_KANJI_CHALLENGE_MAX_CHARS_ = 300;
    var CLIENT_KANJI_NIGATE_PASS_MAX_KEYS_ = 150;
    var CLIENT_DAILY_JSON_MAX_DAYS_ = 14;
    var CLIENT_TRAINING_PROGRESS_MAX_DAYS_ = 2;
    var CLIENT_LAST_STUDY_MAX_KEYS_ = 400;
    var CLIENT_SESSION_SUBMIT_MAX_KEYS_ = 80;
    var CLIENT_KANJI_WEAK_MAX_KEYS_ = 200;

    function clientIsDateKeyString(k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(String(k || ""));
    }

    function clientPruneDateKeyedJson(obj, maxDays) {
      if (!obj || typeof obj !== "object") return;
      const minMs = Date.now() - Math.max(1, maxDays) * 24 * 60 * 60 * 1000;
      Object.keys(obj).forEach(function (k) {
        if (!clientIsDateKeyString(k)) return;
        const d = new Date(k + "T12:00:00");
        if (isNaN(d.getTime()) || d.getTime() < minMs) delete obj[k];
      });
    }

    function clientPruneSessionSubmitLocks(locksRoot) {
      if (!locksRoot || typeof locksRoot !== "object") return;
      const keys = Object.keys(locksRoot);
      if (keys.length <= CLIENT_SESSION_SUBMIT_MAX_KEYS_) return;
      keys.sort(function (a, b) {
        const ta = (locksRoot[a] && locksRoot[a].at) ? String(locksRoot[a].at) : "";
        const tb = (locksRoot[b] && locksRoot[b].at) ? String(locksRoot[b].at) : "";
        return ta.localeCompare(tb);
      });
      const drop = keys.length - CLIENT_SESSION_SUBMIT_MAX_KEYS_;
      for (let i = 0; i < drop; i++) delete locksRoot[keys[i]];
    }

    function clientPruneKanjiWeak(weakRoot) {
      if (!weakRoot || typeof weakRoot !== "object") return;
      const keys = Object.keys(weakRoot);
      if (keys.length <= CLIENT_KANJI_WEAK_MAX_KEYS_) return;
      const scored = keys.map(function (k) {
        return { k: k, t: String((weakRoot[k] || {}).updatedAt || "") };
      });
      scored.sort(function (a, b) { return a.t.localeCompare(b.t); });
      const drop = scored.length - CLIENT_KANJI_WEAK_MAX_KEYS_;
      for (let i = 0; i < drop; i++) delete weakRoot[scored[i].k];
    }

    function clientPruneUnitHistoryQuestions(unitHistory, maxKeys) {
      if (!unitHistory || typeof unitHistory !== "object") return;
      const qKeys = Object.keys(unitHistory);
      if (qKeys.length <= maxKeys) return;
      const scored = qKeys.map(function (k) {
        const h = unitHistory[k] || {};
        const rLen = Array.isArray(h.results) ? h.results.length : 0;
        const tLen = Array.isArray(h.times) ? h.times.length : 0;
        return { k: k, score: rLen + tLen };
      });
      scored.sort(function (a, b) {
        return a.score - b.score || String(a.k).localeCompare(String(b.k));
      });
      const drop = scored.length - maxKeys;
      for (let i = 0; i < drop; i++) delete unitHistory[scored[i].k];
    }

    function clientPruneKanjiChallenge(challengeRoot, maxChars) {
      if (!challengeRoot || typeof challengeRoot !== "object") return;
      const keys = Object.keys(challengeRoot);
      if (keys.length <= maxChars) return;
      const scored = keys.map(function (k) {
        const rec = challengeRoot[k] || {};
        const dates = Array.isArray(rec.highScoreDates) ? rec.highScoreDates : [];
        const latest = dates.length ? String(dates[dates.length - 1]) : "";
        return { k: k, t: latest };
      });
      scored.sort(function (a, b) { return a.t.localeCompare(b.t); });
      const drop = scored.length - maxChars;
      for (let i = 0; i < drop; i++) delete challengeRoot[scored[i].k];
    }

    function clientPruneKanjiNigatePass(passRoot, maxKeys) {
      if (!passRoot || typeof passRoot !== "object") return;
      const keys = Object.keys(passRoot);
      if (keys.length <= maxKeys) return;
      const scored = keys.map(function (k) {
        return { k: k, t: String((passRoot[k] || {}).updatedAt || "") };
      });
      scored.sort(function (a, b) { return a.t.localeCompare(b.t); });
      const drop = scored.length - maxKeys;
      for (let i = 0; i < drop; i++) delete passRoot[scored[i].k];
    }

    function clientPruneLastStudyOrphans(lastStudyJson, historyJson) {
      if (!lastStudyJson || typeof lastStudyJson !== "object") return;
      const hist = historyJson || {};
      Object.keys(lastStudyJson).forEach(function (k) {
        if (!k || String(k).startsWith("__")) return;
        if (!hist[k]) delete lastStudyJson[k];
      });
      const keys = Object.keys(lastStudyJson);
      if (keys.length <= CLIENT_LAST_STUDY_MAX_KEYS_) return;
      keys.sort(function (a, b) {
        return String(lastStudyJson[a] || "").localeCompare(String(lastStudyJson[b] || ""));
      });
      const drop = keys.length - CLIENT_LAST_STUDY_MAX_KEYS_;
      for (let i = 0; i < drop; i++) delete lastStudyJson[keys[i]];
    }

    function clientPruneHistoryJsonStructure(historyJson) {
      const root = historyJson || {};
      Object.keys(root).forEach(function (unitKey) {
        if (!unitKey || String(unitKey).startsWith("__")) return;
        if (root[unitKey] && typeof root[unitKey] === "object") {
          clientPruneUnitHistoryQuestions(root[unitKey], CLIENT_UNIT_HISTORY_MAX_Q_KEYS_);
        }
      });
      if (root.__sessionSubmits) clientPruneSessionSubmitLocks(root.__sessionSubmits);
      return root;
    }

    function clientPruneHistoryJsonToFit(historyJson, lastStudyJson) {
      const max = CLIENT_HISTORY_JSON_MAX_CHARS_;
      const root = historyJson || {};
      clientPruneHistoryJsonStructure(root);
      let serialized = JSON.stringify(root);
      if (serialized.length <= max) return root;
      const unitKeys = Object.keys(root).filter(function (k) {
        return k && !String(k).startsWith("__");
      });
      unitKeys.sort(function (a, b) {
        const ta = (lastStudyJson && lastStudyJson[a]) ? String(lastStudyJson[a]) : "";
        const tb = (lastStudyJson && lastStudyJson[b]) ? String(lastStudyJson[b]) : "";
        return ta.localeCompare(tb);
      });
      for (let i = 0; i < unitKeys.length; i++) {
        delete root[unitKeys[i]];
        serialized = JSON.stringify(root);
        if (serialized.length <= max) return root;
      }
      return root;
    }

    function pruneAppKidUserClient(user) {
      if (!user || typeof user !== "object") return user;
      user.lastStudyJson = user.lastStudyJson || {};
      user.historyJson = user.historyJson || {};
      user.dailyPointsJson = user.dailyPointsJson || {};
      user.trainingProgressJson = user.trainingProgressJson || {};
      stripKanjiAndEnglishFromHistoryJsonClient(user.historyJson);
      clientPruneDateKeyedJson(user.dailyPointsJson, CLIENT_DAILY_JSON_MAX_DAYS_);
      clientPruneDateKeyedJson(user.trainingProgressJson, CLIENT_TRAINING_PROGRESS_MAX_DAYS_);
      user.historyJson = clientPruneHistoryJsonToFit(user.historyJson, user.lastStudyJson);
      clientPruneLastStudyOrphans(user.lastStudyJson, user.historyJson);
      return user;
    }

    function saveAppKidUserToLocal(user) {
      if (!user) return false;
      if (typeof __crNormalizeUserOnVerify === 'function') {
        user = __crNormalizeUserOnVerify(user);
      } else if (window.AppNormalizeUser) {
        user = window.AppNormalizeUser.normalizeUser(user);
      }
      setAppKidUserSession_(user);
      try {
        pruneAppKidUserClient(user);
        localStorage.setItem("app_kid_user", JSON.stringify(user));
        return true;
      } catch (e) {
        console.warn("app_kid_user save failed, retry after aggressive prune:", e);
        try {
          if (user.historyJson) {
            const root = user.historyJson;
            Object.keys(root).filter(function (k) { return k && !String(k).startsWith("__"); }).forEach(function (k) {
              delete root[k];
            });
            clientPruneHistoryJsonStructure(root);
            user.historyJson = clientPruneHistoryJsonToFit(root, user.lastStudyJson || {});
          }
          clientPruneLastStudyOrphans(user.lastStudyJson, user.historyJson);
          localStorage.setItem("app_kid_user", JSON.stringify(user));
          return true;
        } catch (e2) {
          console.error("app_kid_user save failed after aggressive prune:", e2);
          return false;
        }
      }
    }

    function getDetailedUnitId() {
      const meta = getEnglishQuizSessionMeta();
      if (meta && meta.detailedUnitId) return meta.detailedUnitId;
      if (isTrainingMode) {
        return "TrainingRoute_" + currentTrainingStepIndex + "_" + currentUnitName;
      }
      const formatEl = document.getElementById('setting-format');
      const ansEl = document.getElementById('setting-answer-type');
      const blankEl = document.getElementById('setting-blank-count');
      const format = formatEl ? String(formatEl.value || "") : "";
      const ansType = ansEl ? String(ansEl.value || "") : syncAnswerTypeWithFormat(format);
      let unitId = `${currentModeName}_${currentUnitName}_${format}_${ansType}`;
      if (isLegacyFillBlankAnswerType(ansType)) {
        const blankCount = blankEl ? String(blankEl.value || "1") : "1";
        unitId += `_${blankCount}blanks`;
      }
      return unitId;
    }

    function checkIsNigate(historyObj) { if(!historyObj || !historyObj.results || historyObj.results.length === 0) return false; const rMissLimit = Number(appSettings["苦手_直近ミス判定"]) || 1; const timeLimit = Number(appSettings["苦手_時間判定_秒"]) || 15; const rateLimit = Number(appSettings["苦手_全体正答率_未満"]) || 80; const recentResults = historyObj.results.slice(-3); if (recentResults.filter(r => r === 0).length >= rMissLimit) return true; if (((historyObj.results.filter(r => r === 1).length / historyObj.results.length) * 100) < rateLimit) return true; if (historyObj.times && historyObj.times.length > 0 && (historyObj.times.reduce((a,b)=>a+b, 0) / historyObj.times.length) >= timeLimit) return true; return false; }
    
    // ★ 特訓ルート用の変数
    let dailyRouteData = [];
    let currentProgressData = {};
    let trainingRouteReturnTimer = null;
    let currentTrainingStepIndex = null;
    let currentTrainingMenuId = 1;
    let isTrainingMode = false;
    let __appKidUserSession = null;

    function setAppKidUserSession_(user) {
      if (!user || user.id == null) {
        __appKidUserSession = null;
        return null;
      }
      __appKidUserSession = user;
      return user;
    }
    function getAppKidUser_() {
      if (__appKidUserSession && __appKidUserSession.id != null) return __appKidUserSession;
      try {
        if (window.AppState && typeof window.AppState.getKidUser === "function") {
          var fromState = window.AppState.getKidUser();
          if (fromState && fromState.id != null) {
            __appKidUserSession = fromState;
            return fromState;
          }
        }
      } catch (_eSt) {}
      try {
        var raw = localStorage.getItem("app_kid_user");
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.id != null) {
          __appKidUserSession = parsed;
          return parsed;
        }
      } catch (_eLs) {}
      return null;
    }

    window.onload = () => { 
        const saved = localStorage.getItem('app_kid_user'); 
        if (inputMethodMode !== 'pen' && inputMethodMode !== 'keyboard') inputMethodMode = 'keyboard';
        try { initKeyboardAndSoundSettings(); } catch (_eInit) {}
        try { applyKanjiHwDominantHandToBody(); } catch (_eHand) {}
        try { syncKanjiHwHandSwitchUI(); } catch (_eHandUi) {}
        if (saved) {
          try {
            const user = JSON.parse(saved);
            setAppKidUserSession_(user);
            showHome(user);
          } catch (eSaved) {
            console.error("saved user restore failed:", eSaved);
            try { localStorage.removeItem('app_kid_user'); } catch (_eRm) {}
            fetchUsers();
            return;
          }
          try { loadKanjiHandScoreWeightsFromLocalCache(); } catch (_eW) {}
          fetchAppSettings();
        } else {
          fetchUsers();
        }
    };

    function fetchAppSettings() { 
      const cacheKey = 'app_cached_settings';
      return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_app_settings" }) }).then(r=>r.json()).then(d=>{ 
        if(d.status==="success") {
          appSettings = d.settings; 
          localStorage.setItem(cacheKey, JSON.stringify(d));
          /* 管理ブックの手書き配点を毎回反映（旧既定10/20キャッシュが残らないようにする） */
          try { persistKanjiHandScoreWeightsFromSettings(d.settings); } catch (_eW) {}
        }
        return d; 
      }).catch(function () {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const d = JSON.parse(cached);
            appSettings = d.settings;
            try { persistKanjiHandScoreWeightsFromSettings(d.settings); } catch (_eW2) {}
            return d;
          } catch(e) {}
        }
        return { status: "error" };
      }); 
    }

    const LS_KBD_SCALE = 'vk_scale_pct';
    const LS_KBD_FONT = 'vk_key_font_px';
    const LS_KANJI_YOMI_KBD_LAYOUT = 'kanji_yomi_kbd_layout';
    const LS_ANSWER_SOUND = 'answer_sound_enabled';
    const LS_IPAD_STYLUS_OPT = 'ipad_stylus_opt_enabled';
    const LS_PEN_ADVANCED_VISIBLE = 'pen_advanced_visible';

    function initKeyboardAndSoundSettings() {
      if (getUserPref(LS_KBD_SCALE, null) === null) setUserPref(LS_KBD_SCALE, '100');
      if (getUserPref(LS_KBD_FONT, null) === null) setUserPref(LS_KBD_FONT, '18');
      if (getUserPref(LS_ANSWER_SOUND, null) === null) setUserPref(LS_ANSWER_SOUND, '1');
      if (getUserPref(LS_IPAD_STYLUS_OPT, null) === null) setUserPref(LS_IPAD_STYLUS_OPT, '0');
      if (getUserPref(LS_PEN_ADVANCED_VISIBLE, null) === null) setUserPref(LS_PEN_ADVANCED_VISIBLE, '0');
      const sc = document.getElementById('kbd-scale-range');
      const ft = document.getElementById('kbd-font-range');
      if (sc) sc.value = getUserPref(LS_KBD_SCALE, '100');
      if (ft) ft.value = getUserPref(LS_KBD_FONT, '18');
      const qsc = document.getElementById('quiz-kbd-scale-range');
      const qft = document.getElementById('quiz-kbd-font-range');
      if (qsc) qsc.value = getUserPref(LS_KBD_SCALE, '100');
      if (qft) qft.value = getUserPref(LS_KBD_FONT, '18');
      const on = getUserPref(LS_ANSWER_SOUND, '1') !== '0';
      const snd = document.getElementById('answer-sound-enabled');
      const qsnd = document.getElementById('quiz-answer-sound-enabled');
      const ipadStylus = document.getElementById('ipad-stylus-opt-enabled');
      if (snd) snd.checked = on;
      if (qsnd) qsnd.checked = on;
      if (ipadStylus) ipadStylus.checked = getUserPref(LS_IPAD_STYLUS_OPT, '0') === '1';
      applyKeyboardSettingsFromControls('settings');
    }

    function syncAnswerSoundFromCheckbox(el) {
      if (!el) return;
      setUserPref(LS_ANSWER_SOUND, el.checked ? '1' : '0');
      const a = document.getElementById('answer-sound-enabled');
      const q = document.getElementById('quiz-answer-sound-enabled');
      if (a && el !== a) a.checked = el.checked;
      if (q && el !== q) q.checked = el.checked;
    }

    function syncIpadStylusSettingsFromCheckbox(el) {
      if (!el) return;
      const checked = !!el.checked;
      setUserPref(LS_IPAD_STYLUS_OPT, checked ? '1' : '0');
      const panelCheckbox = document.getElementById('pen-ipad-stylus-opt');
      if (panelCheckbox && panelCheckbox !== el) panelCheckbox.checked = checked;
      refreshPenStatusHint();
    }

    function isIpadStylusOptimizationEnabled() {
      return getUserPref(LS_IPAD_STYLUS_OPT, '0') === '1';
    }

    function isPenAdvancedVisible() {
      return getUserPref(LS_PEN_ADVANCED_VISIBLE, '0') === '1';
    }

    function syncPenAdvancedVisibility() {
      const shown = isPenAdvancedVisible();
      const panel = document.getElementById('pen-advanced-controls');
      const btn = document.getElementById('pen-advanced-toggle-btn');
      if (panel) panel.style.display = shown ? 'flex' : 'none';
      if (btn) btn.innerText = shown ? '詳細設定ボタンを非表示' : '詳細設定ボタンを表示';
    }

    function togglePenAdvancedSettings() {
      const next = isPenAdvancedVisible() ? '0' : '1';
      setUserPref(LS_PEN_ADVANCED_VISIBLE, next);
      syncPenAdvancedVisibility();
    }

    function applyKeyboardSettingsFromControls(from) {
      let scalePct = parseInt(getUserPref(LS_KBD_SCALE, '100'), 10);
      let fontPx = parseInt(getUserPref(LS_KBD_FONT, '18'), 10);
      if (from === 'settings' || !from) {
        const sc = document.getElementById('kbd-scale-range');
        const ft = document.getElementById('kbd-font-range');
        if (sc) scalePct = parseInt(sc.value, 10);
        if (ft) fontPx = parseInt(ft.value, 10);
      }
      if (from === 'quiz') {
        const sc = document.getElementById('quiz-kbd-scale-range');
        const ft = document.getElementById('quiz-kbd-font-range');
        if (sc) scalePct = parseInt(sc.value, 10);
        if (ft) fontPx = parseInt(ft.value, 10);
      }
      if (isNaN(scalePct)) scalePct = 100;
      if (isNaN(fontPx)) fontPx = 18;
      setUserPref(LS_KBD_SCALE, String(scalePct));
      setUserPref(LS_KBD_FONT, String(fontPx));
      const scale = scalePct / 100;
      const padPx = Math.max(8, Math.round(fontPx * 0.72));
      document.documentElement.style.setProperty('--vk-font-px', String(fontPx));
      document.documentElement.style.setProperty('--vk-pad-px', String(padPx));
      const syncLabels = () => {
        const l1 = document.getElementById('kbd-scale-label');
        const l2 = document.getElementById('kbd-font-label');
        const q1 = document.getElementById('quiz-kbd-scale-label');
        const q2 = document.getElementById('quiz-kbd-font-label');
        if (l1) l1.innerText = String(scalePct);
        if (l2) l2.innerText = String(fontPx);
        if (q1) q1.innerText = String(scalePct);
        if (q2) q2.innerText = String(fontPx);
      };
      const syncRanges = () => {
        const ids = ['kbd-scale-range', 'kbd-font-range', 'quiz-kbd-scale-range', 'quiz-kbd-font-range'];
        ids.forEach(id => { const el = document.getElementById(id); if (!el) return; if (id.indexOf('scale') >= 0) el.value = scalePct; else el.value = fontPx; });
      };
      syncRanges();
      syncLabels();
      document.querySelectorAll('.keyboard-scale-wrap').forEach(wrap => {
        wrap.style.setProperty('--kb-scale', String(scale));
        wrap.style.setProperty('--vk-font-px', String(fontPx));
        wrap.style.setProperty('--vk-pad-px', String(padPx));
      });
      const quizSec = document.getElementById('section-quiz');
      if (quizSec && quizSec.classList.contains('active')) {
        const at = document.getElementById('setting-answer-type') && document.getElementById('setting-answer-type').value;
        const fmt = document.getElementById('setting-format') && document.getElementById('setting-format').value;
        if (isQuizFreeTypingAnswerType(at)) renderCustomKeyboard(false);
        else if (at === 'fill_typing') renderCustomKeyboard(true);
        else if (fmt === 'ja_to_en_sort' && at === 'sort_missing') renderCustomKeyboard(false, true);
      }
    }

    function toggleQuizKeyboardPanel() {
      const body = document.getElementById('quiz-keyboard-settings-body');
      if (!body) return;
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    }

    let answerAudioCtx = null;
    function playAnswerSound(isCorrect) {
      if (getUserPref(LS_ANSWER_SOUND, '1') === '0') return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!answerAudioCtx) answerAudioCtx = new AC();
        const ctx = answerAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        const g = ctx.createGain();
        g.connect(ctx.destination);
        g.gain.value = 0.2;
        if (isCorrect) {
          [880, 1174].forEach((freq, i) => {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = freq;
            o.connect(g);
            const t0 = ctx.currentTime + i * 0.09;
            o.start(t0);
            o.stop(t0 + 0.1);
          });
        } else {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = 180;
          o.connect(g);
          const t0 = ctx.currentTime;
          o.start(t0);
          o.stop(t0 + 0.22);
        }
      } catch (e) { /* ignore */ }
    }

    function escapeHtml(s) {
      if (s == null) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** materials シート名「単語A_40」→ 一覧・タイトル用「単語A（補正40％）」（API・保存は raw 名のまま） */
    function formatUnitSheetDisplayLabel(sheetName) {
      const s = String(sheetName || "");
      const m = s.match(/^(.*)_(\d+)$/);
      if (!m) return s;
      const pct = parseInt(m[2], 10);
      if (isNaN(pct) || pct < 0 || pct > 100) return s;
      return m[1] + "（補正" + pct + "％）";
    }
    function normalizeUnitNameForCompare(name) {
      const s = String(name || "").trim().replace(/\s+/g, "");
      return s.replace(/_(\d+)$/, "");
    }

    function buildFeedbackContentHtml(userA, resolvedCorrect, isCorrect, isSkip, maxDeduction, fillMode, answerType, pointsPlusHtml) {
      const correctDisp = String(resolvedCorrect != null ? resolvedCorrect : "");
      const isChoiceAnswer = (answerType === "4choice" || answerType === "fill_4choice");

      let userSlotHtml = "";
      if (isSkip) {
        userSlotHtml = `<div class="quiz-feedback-mirror-input quiz-feedback-mirror-skip">スキップしました</div>`;
      } else if (fillMode && fillBlanksData && fillBlanksData.length) {
        const word = String(resolvedCorrect != null ? resolvedCorrect : "");
        const ua = String(userA != null ? userA : "");
        let userLineHtml = "";
        for (let i = 0; i < word.length; i++) {
          const bd = fillBlanksData.find(b => b.originalIndex === i);
          const ch = ua[i] != null ? ua[i] : "";
          if (bd) {
            const ok = normalizeText(String(bd.correctChar)) === normalizeText(String(ch));
            userLineHtml += `<span class="${ok ? "fill-pos-correct" : "fill-pos-wrong"}">${escapeHtml(ch)}</span>`;
          } else {
            userLineHtml += escapeHtml(ch);
          }
        }
        userSlotHtml = `<div class="word-blank-container" style="margin: 8px auto 10px; text-align: center;">${userLineHtml}</div>`;
      } else if (answerType === "4choice") {
        userSlotHtml = `<div class="quiz-feedback-mirror-choice">${escapeHtml(userA)}</div>`;
      } else {
        userSlotHtml = `<div class="quiz-feedback-mirror-input">${escapeHtml(userA)}</div>`;
      }

      let judgeHtml = "";
      if (isSkip) judgeHtml = `<div class="quiz-feedback-judge" style="color:#FF9800;">⏭️</div>`;
      else if (isCorrect) judgeHtml = `<div class="quiz-feedback-judge" style="color:#4CAF50;">⭕</div>`;
      else judgeHtml = `<div class="quiz-feedback-judge" style="color:#F44336;">×</div>`;

      const correctBlock = `<div class="quiz-feedback-correct-label">せいかい</div><div class="quiz-feedback-correct-box">${escapeHtml(correctDisp)}</div>`;
      let correctBlockVariant = correctBlock;
      if (isChoiceAnswer) {
        correctBlockVariant = (!isCorrect || isSkip) ? correctBlock : "";
      }

      let hintHtml = "";
      if (maxDeduction > 0) {
        hintHtml = isEnToEnFlashAnswerType(answerType)
          ? `<span class="quiz-feedback-hint-penalty">英文の確認で -${maxDeduction}Pt されます</span>`
          : `<span class="quiz-feedback-hint-penalty">ヒントをつかったので -${maxDeduction}Pt されます</span>`;
      }

      const plus = pointsPlusHtml ? String(pointsPlusHtml) : "";
      if (isChoiceAnswer) {
        return `<div class="quiz-feedback-panel">
        <div class="quiz-feedback-your-label">あなたのこたえ</div>
        ${userSlotHtml}
        ${judgeHtml}
        ${correctBlockVariant}
        ${hintHtml}
        ${plus}
      </div>`;
      }
      return `<div class="quiz-feedback-panel">
        <div class="quiz-feedback-your-label">あなたのこたえ</div>
        ${userSlotHtml}
        ${correctBlock}
        ${judgeHtml}
        ${hintHtml}
        ${plus}
      </div>`;
    }
    
    const LS_APP_CACHED_MATERIALS = "app_cached_materials";
    const LS_APP_CACHED_KANJI_HAND_SCORE_WEIGHTS = "app_cached_kanji_hand_score_weights";
    let kanjiHandScoreWeightsMem = null;

    function normalizeMaterialsSig(materials) {
      return JSON.stringify((Array.isArray(materials) ? materials : []).map(m => ({
        i: String(m.modeId || ""),
        n: String(m.modeName || ""),
        c: String(m.category || ""),
        u: (Array.isArray(m.units) ? m.units : []).map(x => String(x || "")).sort()
      })).sort((a, b) => a.i.localeCompare(b.i)));
    }

    function getCachedMaterialsFingerprint() {
      try {
        const raw = localStorage.getItem(LS_APP_CACHED_MATERIALS);
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d.materialsFingerprint || null;
      } catch (e) {
        return null;
      }
    }

    function invalidateKanjiPracticeCatalog() {
      try {
        kpCatalogState.materials = [];
        kpCatalogState.sets = [];
        kpCatalogState.setQuestions = [];
        kpCatalogState.filteredChars = [];
        kpCatalogState.loaded = false;
      } catch (_) {}
    }

    function persistMaterialsPayload(d) {
      if (!d || d.status !== "success") return;
      const mats = Array.isArray(d.materials) ? d.materials : [];
      materialsData = mats;
      invalidateKanjiPracticeCatalog();
      const nextNormSig = normalizeMaterialsSig(mats);
      try {
        localStorage.setItem(LS_APP_CACHED_MATERIALS, JSON.stringify({
          status: "success",
          materials: materialsData,
          materialsFingerprint: d.materialsFingerprint || "",
          materialsNormalizedSig: nextNormSig
        }));
      } catch (e) {}
    }

    function fetchMaterialsListFromServer() {
      return gasApiFetchJson({ action: "get_materials_list" }, GAS_API_OPTS_HOME_REFRESH);
    }

    /** サーバのフィンガープリント（または一覧の正規化署名）が変わったときだけ英語・漢字の教材一覧を差し替える。 */
    function applyMaterialsResponseIfChanged(d) {
      if (!d || d.status !== "success") return false;
      const prevFp = getCachedMaterialsFingerprint();
      let prevNormSig = "";
      try {
        const raw = localStorage.getItem(LS_APP_CACHED_MATERIALS);
        if (raw) {
          const c = JSON.parse(raw);
          prevNormSig = c.materialsNormalizedSig || normalizeMaterialsSig(c.materials);
        }
      } catch (e) {}
      const newFp = d.materialsFingerprint || "";
      const nextNormSig = normalizeMaterialsSig(d.materials);
      let changed = false;
      if (newFp) changed = newFp !== prevFp;
      else changed = nextNormSig !== prevNormSig;
      if (!changed && materialsData.length === 0) changed = true;
      if (!changed) return false;
      persistMaterialsPayload(d);
      return true;
    }

    function syncMaterialsListFromServerIfChanged() {
      const statusEl = document.getElementById("home-materials-sync-status");
      return fetchMaterialsListFromServer()
        .then(d => {
          if (applyMaterialsResponseIfChanged(d) && statusEl) {
            statusEl.textContent = "教材一覧を最新にしました（英語・漢字）。";
            setTimeout(() => { if (statusEl.textContent.indexOf("最新にしました") >= 0) statusEl.textContent = ""; }, 6000);
          }
        })
        .catch(() => {});
    }

    function refreshMaterialsManualFromHome(btn) {
      const orig = toggleBtnLoading(btn, true);
      const statusEl = document.getElementById("home-materials-sync-status");
      if (statusEl) statusEl.textContent = "";
      Promise.allSettled([
        fetchMaterialsListFromServer(),
        fetchKanjiHandScoreWeightsFromServer(GAS_API_OPTS_HOME_REFRESH)
      ])
        .then(function (results) {
          const mats = results[0].status === "fulfilled" ? results[0].value : null;
          const weights = results[1].status === "fulfilled" ? results[1].value : null;
          if (!mats || mats.status !== "success") throw new Error((mats && mats.message) || "教材一覧の取得に失敗しました");
          persistMaterialsPayload(mats);
          var msg = "英語・漢字の教材一覧を更新しました。";
          if (weights && weights.status === "success" && weights.updated) msg += " 手書き採点の配点も反映しました。";
          if (statusEl) statusEl.textContent = msg;
          toggleBtnLoading(btn, false, orig);
        })
        .catch(function () {
          if (statusEl) statusEl.textContent = "更新に失敗しました。通信を確認してください。";
          toggleBtnLoading(btn, false, orig);
        });
    }

    /** 教材一覧（英語・漢字共通）。メモリ → localStorage → GAS の順で取得。 */
    function ensureMaterialsListLoaded() {
      if (materialsData.length > 0) return Promise.resolve(materialsData);
      const cached = localStorage.getItem(LS_APP_CACHED_MATERIALS);
      if (cached) {
        try {
          const d = JSON.parse(cached);
          if (d.status === "success" && Array.isArray(d.materials)) {
            materialsData = d.materials;
            return Promise.resolve(materialsData);
          }
        } catch (e) {}
      }
      return fetchMaterialsListFromServer().then(d => {
        if (d.status === "success") persistMaterialsPayload(d);
        return materialsData;
      });
    }
    function prefetchMaterials() {
      return ensureMaterialsListLoaded().catch(() => {});
    }

    function switchSection(id, opts) {
      opts = opts || {};
      abandonKanjiQuizPlayIfLeavingSection(id);
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.innerText = "";
      const kanjiFlowIds = [
        "section-kanji-learning",
        "section-kanji-quiz-sets",
        "section-kanji-quiz-play",
        "section-kanji-nigate",
        "section-kanji-practice"
      ];
      let isKanjiFlow = kanjiFlowIds.includes(id) || ((id === 'section-materials' || id === 'section-settings') && currentMaterialsCategory === 'kanji');
      if (id === 'section-result') {
        if (opts.forceEnglishResult) {
          isKanjiFlow = false;
        } else if (document.body.classList.contains('kanji-study-mode')) {
          isKanjiFlow = true;
        }
      }
      document.body.classList.toggle('kanji-study-mode', isKanjiFlow);
      if (id === 'section-kanji-quiz-sets') {
        syncKanjiQuizFormatSelectFromStorage();
        // クイズをキャンセルして戻ってきた直後（abandonKanjiQuizPlayIfLeavingSection で
        // __kanjiQuizHwFrameReadyP がクリアされた直後）でも、書き取り iframe を再ウォームアップ。
        try { warmupKanjiQuizHandwritingFrame(); } catch (e) {}
      } else {
        try { hideKanjiQuizSetLoadingOverlay_(); } catch (e) {}
      }
      setTimeout(() => syncKanjiVerticalSelects(isKanjiFlow), 10);
    }

    /** ネイティブ select の選択・disabled を縦書きカスタムUIへ反映する */
    function refreshKanjiCustomSelect_(select) {
      if (!select || typeof select._cvsRefresh !== "function") return;
      try { select._cvsRefresh(); } catch (e) {}
    }
    /** 形式プルダウンなど、選択肢の有効/無効が変わったときにカスタムUIを作り直す */
    function rebuildKanjiCustomSelect_(select) {
      if (!select) return;
      try {
        if (select._cvsObserver) {
          select._cvsObserver.disconnect();
          select._cvsObserver = null;
        }
      } catch (e) {}
      select._cvsRefresh = null;
      const wrap = select.parentNode
        ? select.parentNode.querySelector(".cvs-wrapper")
        : null;
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      select.classList.remove("cvs-hidden");
      select.style.display = "";
      if (document.body.classList.contains("kanji-study-mode")) {
        try { syncKanjiVerticalSelects(true); } catch (e2) {}
      }
    }
    function syncKanjiVerticalSelects(enable) {
      if (!enable) {
        document.querySelectorAll('.cvs-wrapper').forEach(w => w.remove());
        document.querySelectorAll('select.cvs-hidden').forEach(s => {
          s.classList.remove('cvs-hidden');
          s.style.display = '';
          if (s._cvsObserver) {
            s._cvsObserver.disconnect();
            s._cvsObserver = null;
          }
          s._cvsRefresh = null;
        });
        return;
      }
      // 漢字練習・設定調整（section-kanji-practice）はすべて横書きにそろえるため、
      // ここの kp-book-select / kp-sheet-select / kp-set-select は縦書きセレクトに変換しない。
      const targetIds = [
        'kanji-quiz-format-select',
        'kn-book-select', 'kn-sheet-select', 'kn-set-select', 'kn-nigate-axis',
        'setting-play-mode', 'setting-format', 'setting-answer-type', 'setting-order', 'setting-blank-count'
      ];
      targetIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        // 既に変換済みなら中身だけ最新化（形式の enabled/disabled 切替を拾う）
        if (select.classList.contains('cvs-hidden') && typeof select._cvsRefresh === "function") {
          select._cvsRefresh();
          return;
        }
        if (select.classList.contains('cvs-hidden')) return;
        select.classList.add('cvs-hidden');
        select.style.display = 'none';
        const wrapper = document.createElement('div');
        wrapper.className = 'cvs-wrapper';
        wrapper.tabIndex = 0;
        const selectedDiv = document.createElement('div');
        selectedDiv.className = 'cvs-selected';
        const menuDiv = document.createElement('div');
        menuDiv.className = 'cvs-menu';
        const ensureEnabledSelection_ = () => {
          const cur = select.options[select.selectedIndex];
          if (cur && !cur.disabled && !cur.hidden) return;
          for (let i = 0; i < select.options.length; i++) {
            if (!select.options[i].disabled && !select.options[i].hidden) {
              select.selectedIndex = i;
              return;
            }
          }
        };
        const updateSelectedText = () => {
          ensureEnabledSelection_();
          const opt = select.options[select.selectedIndex];
          selectedDiv.innerHTML = (opt ? escapeHtml(opt.text) : "") + '<span class="cvs-arrow">▼</span>';
        };
        const buildMenu = () => {
          menuDiv.innerHTML = "";
          Array.from(select.options).forEach((opt, i) => {
            if (opt.disabled || opt.hidden) return; // ブック種で無効な形式は一覧に出さない
            const item = document.createElement('div');
            item.className = 'cvs-item';
            if (select.selectedIndex === i) item.classList.add('selected');
            item.innerText = opt.text;
            item.onclick = (e) => {
              e.stopPropagation();
              select.selectedIndex = i;
              updateSelectedText();
              wrapper.classList.remove('open');
              select.dispatchEvent(new Event('change'));
              buildMenu();
            };
            menuDiv.appendChild(item);
          });
        };
        const refresh = () => {
          updateSelectedText();
          buildMenu();
        };
        select._cvsRefresh = refresh;
        refresh();
        wrapper.appendChild(selectedDiv);
        wrapper.appendChild(menuDiv);
        wrapper.onclick = (e) => {
          e.stopPropagation();
          const wasOpen = wrapper.classList.contains('open');
          document.querySelectorAll('.cvs-wrapper').forEach(w => w.classList.remove('open'));
          if (!wasOpen) {
            buildMenu();
            wrapper.classList.add('open');
          }
        };
        select.parentNode.insertBefore(wrapper, select.nextSibling);
        select._cvsObserver = new MutationObserver(() => {
          refresh();
        });
        select._cvsObserver.observe(select, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['value', 'disabled', 'selected']
        });
        select.addEventListener('change', () => {
          refresh();
        });
      });
    }
    document.addEventListener('click', () => {
      document.querySelectorAll('.cvs-wrapper.open').forEach(w => w.classList.remove('open'));
    });

    function getQuizRecoveryDraft() {
      try {
        const raw = localStorage.getItem(LS_QUIZ_RECOVERY_DRAFT);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    function getRecoveryDraftQuestionCount(draft) {
      if (!draft) return 0;
      if (draft.version >= 2 && Array.isArray(draft.filteredQuestionIds)) return draft.filteredQuestionIds.length;
      if (Array.isArray(draft.filteredQuestions)) return draft.filteredQuestions.length;
      return 0;
    }

    function isRecoveryDraftValidForUser(draft, userId) {
      if (!draft || !userId) return false;
      if (String(draft.userId) !== String(userId)) return false;
      const total = getRecoveryDraftQuestionCount(draft);
      if (total <= 0) return false;
      if (draft.version >= 2) {
        if (!Array.isArray(draft.filteredQuestionIds) || draft.filteredQuestionIds.length === 0) return false;
      } else {
        if (!Array.isArray(draft.filteredQuestions) || draft.filteredQuestions.length === 0) return false;
        if (!Array.isArray(draft.currentQuestions) || draft.currentQuestions.length === 0) return false;
      }
      if (!Array.isArray(draft.quizResults)) return false;
      if (typeof draft.currentQuestionIndex !== 'number') return false;
      if (draft.currentQuestionIndex < 0 || draft.currentQuestionIndex > total) return false;
      return true;
    }

    function pickQuizQuestionsBySerialIds(allQuestions, serialIds) {
      const map = {};
      (allQuestions || []).forEach(function (q) {
        if (q && q["通し番号"] != null) map[String(q["通し番号"])] = q;
      });
      return (serialIds || []).map(function (id) { return map[String(id)]; }).filter(Boolean);
    }

    function loadQuestionsForQuizDraft(draft) {
      const modeId = draft.currentModeId;
      const unitName = draft.currentUnitName;
      const cacheKey = "app_cached_questions_" + modeId + "_" + unitName;
      function resolveFromAll(allQuestions) {
        if (draft.version >= 2 && Array.isArray(draft.filteredQuestionIds)) {
          const picked = pickQuizQuestionsBySerialIds(allQuestions, draft.filteredQuestionIds);
          if (picked.length !== draft.filteredQuestionIds.length) return null;
          return { currentQuestions: allQuestions, filteredQuestions: picked };
        }
        return {
          currentQuestions: Array.isArray(draft.currentQuestions) ? draft.currentQuestions : allQuestions,
          filteredQuestions: Array.isArray(draft.filteredQuestions) ? draft.filteredQuestions : []
        };
      }
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached && cached.status === "success" && Array.isArray(cached.questions)) {
            const resolved = resolveFromAll(cached.questions);
            if (resolved && resolved.filteredQuestions.length > 0) return Promise.resolve(resolved);
          }
        }
      } catch (_) {}
      return fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "get_questions", modeId: modeId, unitName: unitName })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === "success" && Array.isArray(d.questions)) {
            try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch (_) {}
            const resolved = resolveFromAll(d.questions);
            if (resolved && resolved.filteredQuestions.length > 0) return resolved;
          }
          throw new Error((d && d.message) || "問題データの取得に失敗しました");
        });
    }

    function saveQuizRecoveryDraft(nextQuestionIndex) {
      try {
        const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
        if (!user || !user.id) return;
        if (!Array.isArray(filteredQuestions) || filteredQuestions.length === 0) return;
        const idx = typeof nextQuestionIndex === 'number' ? nextQuestionIndex : currentQuestionIndex;
        const draft = {
          version: 2,
          savedAt: Date.now(),
          userId: user.id,
          currentModeId,
          currentModeName,
          currentUnitName,
          currentQuestionIndex: idx,
          quizResults: slimQuizResultsForSave(quizResults),
          filteredQuestionIds: filteredQuestions.map(function (q) { return q["通し番号"]; }),
          currentIsReviewMode: !!currentIsReviewMode,
          isTrainingMode: !!isTrainingMode,
          currentTrainingStepIndex,
          currentTrainingMenuId,
          inputMethodMode,
          settings: {
            format: String((document.getElementById('setting-format') || {}).value || ''),
            answerType: String((document.getElementById('setting-answer-type') || {}).value || ''),
            order: String((document.getElementById('setting-order') || {}).value || 'normal'),
            playMode: String((document.getElementById('setting-play-mode') || {}).value || 'normal'),
            blankCount: String((document.getElementById('setting-blank-count') || {}).value || '')
          }
        };
        localStorage.setItem(LS_QUIZ_RECOVERY_DRAFT, JSON.stringify(draft));
        renderHomeResumePanel();
      } catch (_) {}
    }

    function clearQuizRecoveryDraft() {
      localStorage.removeItem(LS_QUIZ_RECOVERY_DRAFT);
      renderHomeResumePanel();
    }

    function discardQuizRecoveryDraft() {
      if (!confirm("保存された途中の学習データを消します。よろしいですか？")) return;
      clearQuizRecoveryDraft();
      alert("復帰データを消しました。");
    }

    function renderHomeResumePanel() {
      const panel = document.getElementById('home-quiz-resume-panel');
      const textEl = document.getElementById('home-quiz-resume-text');
      if (!panel || !textEl) return;
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      const draft = getQuizRecoveryDraft();
      if (!user || !isRecoveryDraftValidForUser(draft, user.id)) {
        panel.style.display = 'none';
        textEl.innerText = "";
        return;
      }
      const total = getRecoveryDraftQuestionCount(draft);
      const done = Math.max(0, Math.min(total, draft.currentQuestionIndex));
      const savedAt = new Date(draft.savedAt || Date.now());
      const stamp = isNaN(savedAt.getTime()) ? "さきほど" : savedAt.toLocaleString('ja-JP');
      textEl.innerText = `${formatUnitSheetDisplayLabel(draft.currentUnitName || "")} / ${done}問目まで保存（全${total}問）。最終保存: ${stamp}`;
      panel.style.display = 'block';
    }

    function applyQuizDraftSessionState(draft, cQuestions, fQuestions) {
      currentModeId = draft.currentModeId || currentModeId;
      currentModeName = draft.currentModeName || currentModeName;
      currentUnitName = draft.currentUnitName || currentUnitName;
      currentQuestions = Array.isArray(cQuestions) ? cQuestions : [];
      filteredQuestions = Array.isArray(fQuestions) ? fQuestions : [];
      quizResults = Array.isArray(draft.quizResults) ? draft.quizResults : [];
      currentQuestionIndex = Math.max(0, Math.min(filteredQuestions.length, Number(draft.currentQuestionIndex) || 0));
      currentIsReviewMode = !!draft.currentIsReviewMode;
      isTrainingMode = !!draft.isTrainingMode;
      currentTrainingStepIndex = draft.currentTrainingStepIndex == null ? null : draft.currentTrainingStepIndex;
      currentTrainingMenuId = draft.currentTrainingMenuId || currentTrainingMenuId;
      if (draft.inputMethodMode === 'pen' || draft.inputMethodMode === 'keyboard') {
        inputMethodMode = draft.inputMethodMode;
      }

      const safeFormat = String((draft.settings && draft.settings.format) || 'ja_to_en');
      const safeAnsType = String((draft.settings && draft.settings.answerType) || 'typing');
      const safeOrder = String((draft.settings && draft.settings.order) || 'normal');
      const safePlayMode = String((draft.settings && draft.settings.playMode) || 'normal');
      const safeBlank = String((draft.settings && draft.settings.blankCount) || '1');

      const formatEl = document.getElementById('setting-format');
      const ansTypeEl = document.getElementById('setting-answer-type');
      const orderEl = document.getElementById('setting-order');
      const playEl = document.getElementById('setting-play-mode');
      const blankEl = document.getElementById('setting-blank-count');
      if (formatEl) formatEl.innerHTML = `<option value="${escapeHtml(safeFormat)}">${escapeHtml(safeFormat)}</option>`;
      if (ansTypeEl) ansTypeEl.innerHTML = `<option value="${escapeHtml(safeAnsType)}">${escapeHtml(safeAnsType)}</option>`;
      if (orderEl) orderEl.value = safeOrder;
      if (playEl) playEl.value = safePlayMode;
      if (blankEl) blankEl.value = safeBlank;

      captureEnglishQuizSessionMeta();
      switchSection('section-quiz');
      showQuestion();
    }

    function resumeQuizFromDraft(opts = {}) {
      const askConfirm = opts && opts.askConfirm === false ? false : true;
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      const draft = getQuizRecoveryDraft();
      if (!user || !isRecoveryDraftValidForUser(draft, user.id)) {
        alert("復帰できる学習データがありません。");
        renderHomeResumePanel();
        return false;
      }
      if (askConfirm && !confirm("途中の学習がありました。再開しますか？")) return false;

      if (draft.version >= 2 || !(Array.isArray(draft.currentQuestions) && draft.currentQuestions.length && Array.isArray(draft.filteredQuestions) && draft.filteredQuestions.length)) {
        loadQuestionsForQuizDraft(draft)
          .then(function (data) {
            applyQuizDraftSessionState(draft, data.currentQuestions, data.filteredQuestions);
          })
          .catch(function (e) {
            alert("問題データの復元に失敗しました: " + (e && e.message ? e.message : e));
            renderHomeResumePanel();
          });
        return true;
      }

      applyQuizDraftSessionState(draft, draft.currentQuestions, draft.filteredQuestions);
      return true;
    }

    function promptQuizResumeIfNeeded(user) {
      if (!user || !user.id) return;
      const draft = getQuizRecoveryDraft();
      if (!isRecoveryDraftValidForUser(draft, user.id)) return;
      const token = `${user.id}_${draft.savedAt || 0}_${draft.currentQuestionIndex || 0}`;
      if (resumePromptShownToken === token) return;
      resumePromptShownToken = token;
      // iPad Safari: fetch/Promise 直後の confirm は画面フリーズしやすいので遅延する
      setTimeout(function () {
        try {
          if (confirm("途中の学習がありました。再開しますか？")) {
            resumeQuizFromDraft({ askConfirm: false });
          }
        } catch (_eConfirm) {}
      }, 50);
    }

    function getKanjiQuizRecoveryDraft() {
      try {
        const raw = localStorage.getItem(LS_KANJI_QUIZ_RECOVERY_DRAFT);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    function isKanjiRecoveryDraftValidForUser(draft, userId) {
      if (!draft || !userId) return false;
      if (String(draft.userId) !== String(userId)) return false;
      if (!draft.session || typeof draft.session !== "object") return false;
      const s = draft.session;
      if (!Array.isArray(s.questions) || s.questions.length === 0) return false;
      if (!Number.isFinite(Number(s.index))) return false;
      const idx = Number(s.index);
      if (idx < 0 || idx >= s.questions.length) return false;
      return true;
    }

    function buildKanjiSessionDraftPayload() {
      if (!kanjiQuizSession) return null;
      return {
        modeId: kanjiQuizSession.modeId,
        modeName: kanjiQuizSession.modeName,
        unitName: kanjiQuizSession.unitName,
        setId: kanjiQuizSession.setId,
        isTrainingMode: !!kanjiQuizSession.isTrainingMode,
        trainingStepIndex: kanjiQuizSession.trainingStepIndex,
        trainingMenuId: kanjiQuizSession.trainingMenuId,
        questions: Array.isArray(kanjiQuizSession.questions) ? kanjiQuizSession.questions.slice() : [],
        index: Number(kanjiQuizSession.index || 0),
        totalEarned: Number(kanjiQuizSession.totalEarned || 0),
        newTotalPoints: kanjiQuizSession.newTotalPoints == null ? null : Number(kanjiQuizSession.newTotalPoints),
        logs: Array.isArray(kanjiQuizSession.logs) ? kanjiQuizSession.logs.slice() : [],
        pendingScoreItems: Array.isArray(kanjiQuizSession.pendingScoreItems)
          ? kanjiQuizSession.pendingScoreItems.slice()
          : [],
        nigateTraining: !!kanjiQuizSession.nigateTraining,
        nigateAxis: kanjiQuizSession.nigateAxis || null,
        formatMode: kanjiQuizSession.formatMode || getKanjiQuizFormatMode(),
        nigateFeedback: kanjiQuizSession.nigateFeedback ? JSON.parse(JSON.stringify(kanjiQuizSession.nigateFeedback)) : null
      };
    }

    function saveKanjiQuizRecoveryDraft() {
      try {
        const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
        if (!user || !user.id || !kanjiQuizSession) return;
        const draft = {
          version: 1,
          savedAt: Date.now(),
          userId: user.id,
          session: buildKanjiSessionDraftPayload(),
          lastContext: lastKanjiQuizContext ? JSON.parse(JSON.stringify(lastKanjiQuizContext)) : null
        };
        localStorage.setItem(LS_KANJI_QUIZ_RECOVERY_DRAFT, JSON.stringify(draft));
        renderKanjiResumePanel();
      } catch (_) {}
    }

    function clearKanjiQuizRecoveryDraft() {
      localStorage.removeItem(LS_KANJI_QUIZ_RECOVERY_DRAFT);
      renderKanjiResumePanel();
    }

    function discardKanjiQuizRecoveryDraft() {
      if (!confirm("保存された途中の漢字学習データを消します。よろしいですか？")) return;
      clearKanjiQuizRecoveryDraft();
      alert("漢字の復帰データを消しました。");
    }

    function renderKanjiResumePanel() {
      const panel = document.getElementById('kanji-quiz-resume-panel');
      const textEl = document.getElementById('kanji-quiz-resume-text');
      if (!panel || !textEl) return;
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      const draft = getKanjiQuizRecoveryDraft();
      if (!user || !isKanjiRecoveryDraftValidForUser(draft, user.id)) {
        panel.style.display = 'none';
        textEl.innerText = "";
        return;
      }
      const s = draft.session || {};
      const total = Array.isArray(s.questions) ? s.questions.length : 0;
      const done = Math.max(0, Math.min(total, Number(s.index) || 0));
      const savedAt = new Date(draft.savedAt || Date.now());
      const stamp = isNaN(savedAt.getTime()) ? "さきほど" : savedAt.toLocaleString('ja-JP');
      textEl.innerText = `${String(s.modeName || "")} / ${formatUnitSheetDisplayLabel(String(s.unitName || ""))} / セット${String(s.setId || "")} を ${done}問目まで保存（全${total}問）。最終保存: ${stamp}`;
      panel.style.display = 'block';
    }

    function resumeKanjiQuizFromDraft(opts = {}) {
      const askConfirm = opts && opts.askConfirm === false ? false : true;
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      const draft = getKanjiQuizRecoveryDraft();
      if (!user || !isKanjiRecoveryDraftValidForUser(draft, user.id)) {
        alert("復帰できる漢字学習データがありません。");
        renderKanjiResumePanel();
        return false;
      }
      if (askConfirm && !confirm("途中の漢字学習がありました。再開しますか？")) return false;
      const s = draft.session;
      kanjiQuizSession = {
        modeId: s.modeId,
        modeName: s.modeName,
        unitName: s.unitName,
        setId: s.setId,
        isTrainingMode: !!s.isTrainingMode,
        trainingStepIndex: s.trainingStepIndex,
        trainingMenuId: s.trainingMenuId,
        questions: Array.isArray(s.questions) ? s.questions.slice() : [],
        index: Math.max(0, Math.min((Array.isArray(s.questions) ? s.questions.length : 1) - 1, Number(s.index) || 0)),
        totalEarned: Number(s.totalEarned || 0),
        newTotalPoints: s.newTotalPoints == null ? null : Number(s.newTotalPoints),
        logs: Array.isArray(s.logs) ? s.logs.slice() : [],
        pendingScoreItems: Array.isArray(s.pendingScoreItems) ? s.pendingScoreItems.slice() : [],
        selectedChoice: null,
        nigateTraining: !!s.nigateTraining,
        nigateAxis: s.nigateAxis || null,
        formatMode: s.formatMode || getKanjiQuizFormatMode(),
        nigateFeedback: s.nigateFeedback ? JSON.parse(JSON.stringify(s.nigateFeedback)) : (s.nigateTraining ? { strokeOrderClean: true, brushAllClear: true } : null)
      };
      lastKanjiQuizContext = draft.lastContext && typeof draft.lastContext === "object"
        ? JSON.parse(JSON.stringify(draft.lastContext))
        : {
            modeId: s.modeId,
            modeName: s.modeName,
            unitName: s.unitName,
            setId: s.setId,
            questions: Array.isArray(s.questions) ? s.questions.slice() : [],
            allQuestions: Array.isArray(s.questions) ? s.questions.slice() : [],
            isTrainingMode: !!s.isTrainingMode,
            trainingStepIndex: s.trainingStepIndex,
            trainingMenuId: s.trainingMenuId,
            nigateTraining: !!s.nigateTraining,
            nigateAxis: s.nigateAxis || null,
            formatMode: getKanjiQuizFormatMode()
          };
      switchSection("section-kanji-quiz-play");
      renderKanjiQuizQuestion();
      return true;
    }

    function promptKanjiQuizResumeIfNeeded(user) {
      if (!user || !user.id) return;
      const draft = getKanjiQuizRecoveryDraft();
      if (!isKanjiRecoveryDraftValidForUser(draft, user.id)) return;
      const token = `${user.id}_${draft.savedAt || 0}_${(draft.session || {}).index || 0}`;
      if (kanjiResumePromptShownToken === token) return;
      kanjiResumePromptShownToken = token;
      // iPad Safari: 非同期直後の confirm フリーズ対策
      setTimeout(function () {
        try {
          if (confirm("途中の漢字学習がありました。再開しますか？")) {
            resumeKanjiQuizFromDraft({ askConfirm: false });
          }
        } catch (_eConfirm) {}
      }, 50);
    }

    function fetchUsers() {
      const box = document.getElementById('user-container');
      if (box) box.innerHTML = "<p>よみこみ中...</p>";
      const done = function (d) {
        if (d && d.status === "success" && Array.isArray(d.users)) {
          renderUsers(d.users);
          return;
        }
        if (box) {
          box.innerHTML = "<p style='color:#ff8a80;'>ユーザー一覧の取得に失敗しました。<br>画面を再読み込みしてください。</p>";
        }
      };
      const fail = function (err) {
        console.error("fetchUsers failed:", err);
        if (box) {
          box.innerHTML = "<p style='color:#ff8a80;'>通信エラーです。しばらくして再読み込みしてください。</p>";
        }
      };
      if (typeof gasApiFetchJson === "function") {
        gasApiFetchJson({ action: "get_child_users" }, { retries: 2, timeoutMs: 90000 })
          .then(done)
          .catch(fail);
        return;
      }
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_child_users" }) })
        .then(function (r) { return r.json(); })
        .then(done)
        .catch(fail);
    }
    function renderUsers(users) { const c = document.getElementById('user-container'); c.innerHTML = ""; users.forEach(u => { const div = document.createElement('div'); div.className = 'user-card'; div.onclick = () => showPinScreen(u.id, u.name, false); div.innerHTML = `<div class="user-icon">${u.name.charAt(0)}</div><div>${u.name}</div>`; c.appendChild(div); }); }
    function showPinScreen(id, name, isReset) { selectedUserId = id; isPinResetMode = isReset; currentPin = ""; updatePinDisplay(); document.getElementById('selected-user-name').innerText = name; document.getElementById('pin-instruction').innerText = isReset ? "あたらしい暗証番号（4ケタ）" : "あんしょうばんごう（4ケタ）"; switchSection('section-pin'); }
    function addPin(num) { if(currentPin.length<4){ currentPin+=num; updatePinDisplay(); if(currentPin.length===4) { if(isPinResetMode) executePinReset(); else verifyPin(); } } }
    function deletePin() { currentPin = currentPin.slice(0,-1); updatePinDisplay(); }
    function clearPin() { currentPin = ""; updatePinDisplay(); }
    function updatePinDisplay() { let d=""; for(let i=0;i<4;i++) d+=(i<currentPin.length)?"● ":"_ "; document.getElementById('pin-dots').innerText=d.trim(); }
    function cancelPin() { if(isPinResetMode) showHome(JSON.parse(localStorage.getItem('app_kid_user'))); else switchSection('section-users'); }
    function verifyPin() {
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.innerText = "かくにん中...";
      fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "verify_kid_pin", userId: selectedUserId, pin: currentPin })
      })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; }); })
        .then(function (res) {
          var d = null;
          try { d = JSON.parse(res.text); } catch (_eParse) { d = null; }
          if (!d || typeof d !== "object") {
            throw new Error("サーバー応答が不正です (HTTP " + res.status + ")");
          }
          if (d.status === "success" && d.user) {
            setAppKidUserSession_(d.user);
            var __kidSaved = false;
            try { __kidSaved = saveAppKidUserToLocal(d.user); } catch (_eSave) {}
            if (!__kidSaved) {
              console.warn("app_kid_user localStorage save failed; session fallback active");
            }
            // iPad: ログイン直後の UI 更新を fetch コールバックから切り離す
            setTimeout(function () {
              try { showHome(d.user); } catch (eHome) {
                console.error("showHome failed:", eHome);
                if (msgEl) msgEl.innerText = "ホーム表示に失敗しました。ページを再読み込みしてください。";
              }
            }, 0);
            return;
          }
          if (msgEl) msgEl.innerText = d.message || "ログインに失敗しました";
          currentPin = "";
          updatePinDisplay();
        })
        .catch(function (e) {
          console.error("verifyPin failed:", e);
          if (msgEl) {
            msgEl.innerText = "通信エラーです。もういちど試すか、ページを再読み込みしてください。";
          }
          currentPin = "";
          updatePinDisplay();
        });
    }
    function preparePinReset() { const user = JSON.parse(localStorage.getItem('app_kid_user')); showPinScreen(user.id, user.name, true); }
    function executePinReset() {
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.innerText = "へんこう中...";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "change_pin", userId: selectedUserId, newPin: currentPin }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === "success") {
            setTimeout(function () {
              try { alert(d.message); } catch (_eA) {}
              showHome(JSON.parse(localStorage.getItem('app_kid_user')));
            }, 0);
          } else {
            if (msgEl) msgEl.innerText = (d && d.message) || "変更に失敗しました";
            currentPin = "";
            updatePinDisplay();
          }
        })
        .catch(function () {
          if (msgEl) msgEl.innerText = "通信エラーです。もういちど試してください。";
          currentPin = "";
          updatePinDisplay();
        });
    }
    function logout() {
      syncAllStopwatchesToServer(true);
      englishUnitHistoryCache = {};
      kanjiHistoryCache = {};
      setAppKidUserSession_(null);
      localStorage.removeItem('app_kid_user');
      document.body.classList.remove('kanji-study-mode');
      document.getElementById('global-header').style.display = 'none';
      activeRewardTicket_ = null;
      if (rewardCountdownTimerId_) {
        clearInterval(rewardCountdownTimerId_);
        rewardCountdownTimerId_ = null;
      }
      ['home', 'external'].forEach(function (target) {
        const st = stopwatches[target];
        if (!st) return;
        if (st.timerId) {
          clearInterval(st.timerId);
          st.timerId = null;
        }
        st.running = false;
        st.startAt = 0;
        st.elapsed = 0;
      });
      switchSection('section-users');
      fetchUsers();
    }

    // ★ 特訓ルートの読み込み処理を追加
    function showHome(user) {
      if (!user || user.id == null) {
        switchSection('section-users');
        fetchUsers();
        return;
      }
      setAppKidUserSession_(user);
      try { saveAppKidUserToLocal(user); } catch (_eHomeSave) {}
      try {
        cancelTrainingRouteAutoReturn();
        document.body.classList.remove('kanji-study-mode');
        resetResultScreenActionButtons();
        switchSection('section-home');
        const headerInfo = document.getElementById('header-user-info');
        const globalHeader = document.getElementById('global-header');
        const welcome = document.getElementById('welcome-message');
        const pts = document.getElementById('user-points');
        if (headerInfo) headerInfo.innerText = "ID: " + user.id + " / " + user.name;
        if (globalHeader) globalHeader.style.display = 'block';
        if (welcome) welcome.innerText = user.name + " さん";
        if (pts) pts.innerText = user.points != null ? String(user.points) : "0";
        renderHomeResumePanel();
        applyKanjiHwDominantHandToBody();
        syncKanjiHwHandSwitchUI();
        syncMaterialsListFromServerIfChanged();
        flushPendingFinishQuizSave(user);
        loadStopwatchFromServer(user).then(function () {
          return fetchActiveRewardTicket_(user);
        }).then(function () {
          renderHomeStopwatchOrCountdown_();
        }).catch(function () {
          try { renderHomeStopwatchOrCountdown_(); } catch (_eSw) {}
        });
        // confirm 系は最後に遅延実行（ホーム描画を先に完了させる）
        promptQuizResumeIfNeeded(user);
      } catch (eShow) {
        console.error("showHome error:", eShow);
        try {
          switchSection('section-home');
          const globalHeader2 = document.getElementById('global-header');
          if (globalHeader2) globalHeader2.style.display = 'block';
        } catch (_e2) {}
      }
    }

    function toggleBtnLoading(btn, isLoading, originalText = "") { if(!btn) return ""; if(isLoading) { const text = btn.innerHTML; btn.innerHTML = "⏳ よみこみ中..."; btn.classList.add("btn-loading"); return text; } else { btn.innerHTML = originalText; btn.classList.remove("btn-loading"); } }

    // ====== ★ 特訓ルートの取得と表示 ======
    function fetchTrainingRoute(userId) {
        const homeRouteArea = document.getElementById('home-route-area');
        if (homeRouteArea) homeRouteArea.style.display = 'block';
        const routeContainer = document.getElementById('route-container');
        const cacheKey = `app_cached_training_route_${currentTrainingMenuId}`;
        const cached = localStorage.getItem(cacheKey);

        const processData = (d) => {
            if(d.status === "success") {
                dailyRouteData = d.route;
                currentProgressData = d.progress;
                renderTrainingRoute();
            } else if (routeContainer) {
                routeContainer.innerHTML = "<p>ルートの取得に失敗しました。</p>";
            }
        };

        var showedCache = false;
        if (cached) {
           try {
               const d = JSON.parse(cached);
               if (d.status === "success") {
                 processData(d);
                 showedCache = true;
               }
           } catch(e) {}
        }
        if (!showedCache && routeContainer) {
            routeContainer.innerHTML = "<p>ルートを確認中...</p>";
        }

        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_training_route", userId: userId, trainingMenuId: currentTrainingMenuId }) })
        .then(r=>r.json()).then(d=>{
            if(d.status === "success") {
               localStorage.setItem(cacheKey, JSON.stringify(d));
            }
            processData(d);
        }).catch(function () {
            // ホーム以外へ遷移済みなら表示しない（漢字学習へ進んだ直後に一瞬見えるのを防ぐ）
            const homeSec = document.getElementById("section-home");
            const onHome = homeSec && homeSec.classList.contains("active");
            if (!showedCache && onHome && routeContainer) {
              routeContainer.innerHTML = "<p>通信エラーが発生しました。</p>";
            }
        });
    }

    function renderTrainingRoute() {
        const container = document.getElementById('route-container');
        container.innerHTML = "";
        
        if (dailyRouteData.length === 0) {
            container.innerHTML = "<p style='text-align:center;'>今日のミッションはないみたい！<br>いつもの学習をがんばろう。</p>";
            document.getElementById('next-route-btn').style.display = 'none';
            return;
        }

        let isLocked = false;
        let nextAvailableFound = false;

        dailyRouteData.forEach((route, index) => {
            const isCleared = currentProgressData[route.stepIndex] === true;
            
            const div = document.createElement('div');
            div.className = `route-item ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''}`;
            div.setAttribute('data-step-index', String(route.stepIndex));
            
            const checkboxHtml = `<div class="checkbox">${isCleared ? '✔' : ''}</div>`;
            const infoHtml = `<div style="flex-grow:1; margin-left:10px;">
                                <div style="font-weight:bold;">${escapeHtml(formatUnitSheetDisplayLabel(route.unitName))}</div>
                                <div style="font-size:12px; color:#aaa;">${escapeHtml(route.qFormat)} / ${escapeHtml(route.aFormat)}</div>
                              </div>`;
            
            div.innerHTML = checkboxHtml + infoHtml;

            // クリックで直接挑戦（復習 or アンロック済みなら可能）
            if (isCleared || (!isCleared && !isLocked)) {
                div.style.cursor = "pointer";
                div.onclick = () => startRouteStep(route);
            }

            container.appendChild(div);

            // 未クリアを見つけたら、それ以降はロックする
            if (!isCleared) {
                isLocked = true;
                if (!nextAvailableFound) {
                    nextAvailableFound = true;
                }
            }
        });

        // 「次の内容に取り組む」ボタンの制御
        const nextBtn = document.getElementById('next-route-btn');
        if (!nextAvailableFound) {
            nextBtn.style.display = 'none'; // 全てクリア済み
        } else {
            nextBtn.style.display = 'block';
        }
        highlightNextTrainingRouteItem_();
    }

    function highlightNextTrainingRouteItem_() {
        const container = document.getElementById('route-container');
        if (!container) return;
        container.querySelectorAll('.route-item-next').forEach(function (el) {
            el.classList.remove('route-item-next');
        });
        const nextRoute = dailyRouteData.find(function (r) {
            return !currentProgressData[r.stepIndex];
        });
        if (!nextRoute) return;
        const target = container.querySelector('.route-item[data-step-index="' + String(nextRoute.stepIndex) + '"]');
        if (!target || target.classList.contains('locked')) return;
        target.classList.add('route-item-next');
        try {
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {}
    }

    // 「次の内容に取り組む」ボタンを押したとき
    function startNextRoute() {
        // 未クリアで一番上にあるものを探す
        const nextRoute = dailyRouteData.find(r => !currentProgressData[r.stepIndex]);
        if (nextRoute) {
            startRouteStep(nextRoute);
        }
    }

    function openTrainingMenu() {
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      if (!user) { alert("ログインし直してください"); return; }
      cancelTrainingRouteAutoReturn();
      switchSection('section-training');
      document.getElementById('training-menu-picker').style.display = 'block';
      document.getElementById('route-container').style.display = 'none';
      document.getElementById('next-route-btn').style.display = 'none';
      const titleHint = document.querySelector("#section-training > p");
      if (titleHint) titleHint.textContent = "メニューをえらんでね";
      renderTrainingMenuPicker();
    }

    function backToTrainingMenuPicker() {
      cancelTrainingRouteAutoReturn();
      document.getElementById('training-menu-picker').style.display = 'block';
      document.getElementById('route-container').style.display = 'none';
      document.getElementById('next-route-btn').style.display = 'none';
      const titleHint = document.querySelector("#section-training > p");
      if (titleHint) titleHint.textContent = "メニューをえらんでね";
      renderTrainingMenuPicker();
    }

    const TRAINING_MENU_DEFAULT_COLORS = ["#9C27B0", "#2196F3", "#4CAF50", "#FF9800", "#F44336", "#009688", "#E91E63", "#3F51B5", "#795548", "#607D8B", "#00BCD4", "#FFC107"];

    function parseTrainingMenuEnabledClient(value) {
      const v = String(value == null ? "" : value).trim().toLowerCase();
      if (v === "0" || v === "false" || v === "off" || v === "いいえ" || v === "無効" || v === "否") return false;
      return true;
    }

    function getTrainingMenuColor(settings, menuId) {
      const key = "特訓メニュー" + menuId + "_色";
      const c = String((settings && settings[key]) || "").trim();
      if (c) return c;
      return TRAINING_MENU_DEFAULT_COLORS[(menuId - 1) % TRAINING_MENU_DEFAULT_COLORS.length];
    }

    function getTrainingMenuButtonStyle(color) {
      const bg = color || "#9C27B0";
      const light = ["#FFC107", "#FFEB3B", "#CDDC39", "#FFECB3"];
      const textColor = light.indexOf(bg.toUpperCase()) >= 0 ? "#222" : "#fff";
      return "background:" + bg + ";border-color:" + bg + ";color:" + textColor + ";";
    }

    function invalidateAppSettingsCache() {
      try { localStorage.removeItem("app_cached_settings"); } catch (_) {}
      appSettings = appSettings || {};
    }

    function invalidateTrainingRouteCache(menuId) {
      try {
        if (menuId != null && menuId !== "") {
          localStorage.removeItem("app_cached_training_route_" + menuId);
          return;
        }
        Object.keys(localStorage).forEach(function (k) {
          if (k.startsWith("app_cached_training_route_")) localStorage.removeItem(k);
        });
      } catch (_) {}
    }

    function cancelTrainingRouteAutoReturn() {
      if (trainingRouteReturnTimer) {
        clearTimeout(trainingRouteReturnTimer);
        trainingRouteReturnTimer = null;
      }
    }

    function getTodayTrainingProgressBlock(trainingProgressJson, menuId) {
      const json = trainingProgressJson || {};
      const todayStr = new Date().toISOString().split("T")[0];
      const todayBlock = json[todayStr] || {};
      const mid = String(menuId != null ? menuId : currentTrainingMenuId || 1);
      if (todayBlock[mid] && typeof todayBlock[mid] === "object" && !Array.isArray(todayBlock[mid])) {
        return todayBlock[mid];
      }
      if (mid === "1") {
        const out = {};
        let hasLegacy = false;
        Object.keys(todayBlock).forEach(function (k) {
          if (todayBlock[k] === true) {
            hasLegacy = true;
            out[k] = true;
          }
        });
        if (hasLegacy) return out;
      }
      return {};
    }

    function applyLocalTrainingProgress(trainingProgressJson, menuId) {
      currentProgressData = getTodayTrainingProgressBlock(trainingProgressJson, menuId);
      if (dailyRouteData && dailyRouteData.length) renderTrainingRoute();
    }

    function returnToCurrentTrainingMenuRoute(options) {
      options = options || {};
      cancelTrainingRouteAutoReturn();
      const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!user || !user.id) {
        alert("ログインし直してください");
        return;
      }
      let menuId = parseInt(options.menuId != null ? options.menuId : currentTrainingMenuId, 10);
      if (isNaN(menuId) || menuId < 1 || menuId > 12) menuId = 1;
      currentTrainingMenuId = menuId;
      isTrainingMode = false;
      currentTrainingStepIndex = null;
      resetResultScreenActionButtons();
      switchSection("section-training");
      const picker = document.getElementById("training-menu-picker");
      const routeBox = document.getElementById("route-container");
      const nextBtn = document.getElementById("next-route-btn");
      const titleHint = document.querySelector("#section-training > p");
      if (picker) picker.style.display = "none";
      if (routeBox) {
        routeBox.style.display = "block";
        routeBox.innerHTML = "<p>ルートを確認中...</p>";
      }
      if (nextBtn) nextBtn.style.display = "none";
      if (titleHint) titleHint.textContent = "つぎに取り組むセットをえらんでね";
      if (options.invalidateCache !== false) {
        invalidateTrainingRouteCache(menuId);
      }
      if (user.trainingProgressJson) {
        applyLocalTrainingProgress(user.trainingProgressJson, menuId);
      }
      fetchTrainingRoute(user.id);
    }

    function scheduleTrainingRouteAutoReturn(delayMs, menuId) {
      cancelTrainingRouteAutoReturn();
      const mid = menuId != null ? menuId : currentTrainingMenuId;
      if (!mid) return;
      trainingRouteReturnTimer = setTimeout(function () {
        trainingRouteReturnTimer = null;
        returnToCurrentTrainingMenuRoute({ menuId: mid, invalidateCache: false });
      }, delayMs || 2200);
    }

    function renderTrainingMenuPicker() {
      const box = document.getElementById('training-menu-picker');
      if (!box) return;
      box.innerHTML = "<p style='text-align:center;color:#888;'>よみこみ中...</p>";
      fetchAppSettings().then(d => {
        const settings = (d && d.status === 'success' && d.settings) ? d.settings : {};
        let html = "<div class='training-menu-picker-inner'>";
        let shown = 0;
        for (let m = 1; m <= 12; m++) {
          if (!parseTrainingMenuEnabledClient(settings['特訓メニュー' + m + '_有効'])) continue;
          shown++;
          const label = String(settings['特訓メニュー' + m + '_表示名'] || '').trim() || ('特訓メニュー' + m);
          const style = getTrainingMenuButtonStyle(getTrainingMenuColor(settings, m));
          html += `<button type="button" class="submit-btn training-menu-btn-colored" style="min-height:48px;padding:10px;font-size:15px;${style}" onclick="selectTrainingMenu(${m})">${escapeHtml(label)}</button>`;
        }
        html += "</div>";
        if (!shown) {
          box.innerHTML = "<p style='text-align:center;color:#888;'>表示できる特訓メニューがありません。<br>おうちの人に「管理メニュー」で登録してもらってね。</p>";
        } else {
          box.innerHTML = html;
        }
      }).catch(() => { box.innerHTML = "<p style='color:#f88;'>読み込みに失敗しました</p>"; });
    }

    function selectTrainingMenu(menuId) {
      currentTrainingMenuId = menuId;
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      document.getElementById('training-menu-picker').style.display = 'none';
      document.getElementById('route-container').style.display = 'block';
      document.getElementById('route-container').innerHTML = "<p>ルートを確認中...</p>";
      const titleHint = document.querySelector("#section-training > p");
      if (titleHint) titleHint.textContent = "つぎに取り組むセットをえらんでね";
      fetchTrainingRoute(user.id);
    }

    // 指定されたルートステップを開始する準備
    function startRouteStep(route) {
        document.getElementById('route-container').innerHTML = "<p>問題データを準備中...</p>";
        isTrainingMode = true;
        currentTrainingStepIndex = route.stepIndex;

        let mappedFormat = "en_to_ja";
        let mappedAnsType = "4choice";
        let mappedOrder = route.mode ? (route.mode === "ランダム" ? "random" : "normal") : "random";
        let mappedBlank = route.blankCount || "";
        
        if (route.qFormat === "日本語→英単語") mappedFormat = "ja_to_en";
        else if (route.qFormat === "日本語→英語（並び替え）" || route.qFormat === "並び替え（日本語付き）") mappedFormat = "ja_to_en_sort";
        else if (route.qFormat === "英単語→日本語") mappedFormat = "en_to_ja";
        else if (route.qFormat === "音声→日本語") mappedFormat = "en_audio_to_ja";
        else if (route.qFormat === "音声→英単語") mappedFormat = "qaudio_to_en";
        else if (route.qFormat === "疑問文→英語") mappedFormat = "qtext_to_en";
        else if (route.qFormat === "英語読み上げ→英語") mappedFormat = "en_audio_to_en";
        else if (route.qFormat === "英語→英語" || route.qFormat === "英単語→英単語") mappedFormat = "en_to_en";
        
        if (route.aFormat === "タイピング") mappedAnsType = "typing";
        else if (route.aFormat === "タイピング（イニシャル）") mappedAnsType = "initial_typing";
        else if (route.aFormat === "タイピング（穴埋め）") mappedAnsType = "sheet_fill_typing";
        else if (route.aFormat === "音声") mappedAnsType = "voice";
        else if (route.aFormat === "音声入力（イニシャル）") mappedAnsType = "initial_voice";
        else if (route.aFormat === "音声入力（穴埋め）") mappedAnsType = "sheet_fill_voice";
        else if (route.aFormat === "タイピング（フラッシュ）") mappedAnsType = "flash_typing";
        else if (route.aFormat === "音声入力（フラッシュ）") mappedAnsType = "flash_voice";
        else if (route.aFormat === "穴埋め4択") mappedAnsType = "fill_4choice";
        else if (route.aFormat === "穴埋めタイピング") mappedAnsType = "fill_typing";
        else if (route.aFormat === "すべて用いる") mappedAnsType = "sort_all";
        else if (route.aFormat === "不要語混入") mappedAnsType = "sort_dummy";
        else if (route.aFormat === "不足語補足") mappedAnsType = "sort_missing";

        prefetchMaterials().then(() => {
            let foundModeId = null;
            let foundModeName = "";
            let resolvedUnitName = "";
            const isKanjiRoute = isKanjiTrainingQFormat_(route.qFormat) || /採点/.test(String(route.aFormat || ""));
            const routeUnitRaw = String(route.unitName || "");
            const routeUnitNorm = normalizeUnitNameForCompare(routeUnitRaw);
            const preferJukugo = isKanjiJukugoTrainingQFormat_(route.qFormat);
            const preferStandardKanji = isKanjiRoute && !preferJukugo;
            let fallbackMat = null;
            for (let m of materialsData) {
                const units = Array.isArray(m.units) ? m.units : [];
                const exact = units.find(u => String(u) === routeUnitRaw);
                const fuzzy = exact || units.find(u => normalizeUnitNameForCompare(u) === routeUnitNorm);
                if (!fuzzy) continue;
                if (!fallbackMat) {
                  fallbackMat = { modeId: m.modeId, modeName: m.modeName, unit: String(fuzzy), category: m.category };
                }
                const isJuk = /熟語/.test(String(m.modeName || ""));
                if (preferJukugo && isJuk) {
                  foundModeId = m.modeId;
                  foundModeName = m.modeName;
                  resolvedUnitName = String(fuzzy);
                  break;
                }
                if (preferStandardKanji && (m.category === "kanji" || /漢字/.test(String(m.modeName || ""))) && !isJuk) {
                  foundModeId = m.modeId;
                  foundModeName = m.modeName;
                  resolvedUnitName = String(fuzzy);
                  break;
                }
                if (!isKanjiRoute) {
                  foundModeId = m.modeId;
                  foundModeName = m.modeName;
                  resolvedUnitName = String(fuzzy);
                  break;
                }
            }
            if (!foundModeId && fallbackMat) {
              foundModeId = fallbackMat.modeId;
              foundModeName = fallbackMat.modeName;
              resolvedUnitName = fallbackMat.unit;
            }
            if(!foundModeId) {
                alert(`「${formatUnitSheetDisplayLabel(route.unitName)}」のデータが見つかりませんでした。`);
                fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
                return;
            }
            currentUnitName = resolvedUnitName || route.unitName;
            currentModeName = foundModeName;

            if (isKanjiRoute) {
              const mappedKanji = trainingRouteLabelsToInternal(route.qFormat, route.aFormat);
              let kanjiFormatMode = mappedKanji.format || "write_kanji";
              if (kanjiFormatMode === "kanji_hand") kanjiFormatMode = "write_kanji";
              try {
                if (typeof LS_KANJI_QUIZ_FORMAT !== "undefined") {
                  localStorage.setItem(LS_KANJI_QUIZ_FORMAT, kanjiFormatMode);
                } else {
                  localStorage.setItem("app_kanji_quiz_format_v1", kanjiFormatMode);
                }
              } catch (_eFmt) {}
              const quizFetchBody = {
                action: "get_kanji_quiz_questions",
                modeId: foundModeId,
                unitName: currentUnitName,
                setId: "",
                formatMode: kanjiFormatMode,
                choiceCount: 4,
                includeNoneOption: false
              };
              fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_kanji_quiz_sets", modeId: foundModeId, unitName: currentUnitName }) })
              .then(r => r.json()).then(d => {
                if (d.status !== "success") throw new Error(d.message || "漢字セット取得失敗");
                const sets = Array.isArray(d.sets) ? d.sets : [];
                if (!sets.length) throw new Error("セットが見つかりません");
                const first = sets[0];
                quizFetchBody.setId = String(first.setId || "");
                return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify(quizFetchBody) });
              })
              .then(r => r.json()).then(q => {
                if (q.status !== "success") throw new Error(q.message || "漢字問題取得失敗");
                var raw = Array.isArray(q.questions) ? q.questions : [];
                var prep = prepareKanjiQuizQuestionsForPlay(raw, kanjiFormatMode);
                if (!prep) throw new Error("この形式の問題がありません");
                startKanjiQuizPlay({
                  modeId: foundModeId,
                  modeName: foundModeName,
                  unitName: currentUnitName,
                  setId: String((q.setId != null) ? q.setId : quizFetchBody.setId),
                  allQuestions: raw,
                  formatMode: prep.formatMode,
                  isTrainingMode: true,
                  trainingStepIndex: currentTrainingStepIndex,
                  trainingMenuId: currentTrainingMenuId
                });
              })
              .catch(e => {
                alert("特訓用の漢字問題取得に失敗しました: " + (e.message || e));
                fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
              });
              return;
            }

            const cacheKey = `app_cached_questions_${foundModeId}_${currentUnitName}`;
            const cached = localStorage.getItem(cacheKey);

            const processData = (d) => {
                if(d.status==="success"){ 
                    currentQuestions = d.questions;
                    
                    document.getElementById('setting-format').innerHTML = `<option value="${mappedFormat}">${route.qFormat}</option>`;
                    document.getElementById('setting-answer-type').innerHTML = `<option value="${mappedAnsType}">${route.aFormat}</option>`;
                    document.getElementById('setting-order').value = mappedOrder;
                    document.getElementById('setting-play-mode').value = "normal";
                    if (mappedAnsType.startsWith("fill_") && mappedBlank) {
                      const blankSelect = document.getElementById('setting-blank-count');
                      if (blankSelect) {
                        const exists = Array.from(blankSelect.options).some(o => o.value === String(mappedBlank));
                        if (!exists) blankSelect.insertAdjacentHTML('beforeend', `<option value="${mappedBlank}">${mappedBlank} 文字 かくす</option>`);
                        blankSelect.value = String(mappedBlank);
                      }
                    }
                    
                    prepareQuiz();
                } else {
                    alert("取得失敗: " + d.message);
                    fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
                }
            };

            if (cached) {
                try {
                    const d = JSON.parse(cached);
                    processData(d);
                    return;
                } catch(e) {}
            }

            fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_questions", modeId: foundModeId, unitName: currentUnitName }) })
            .then(r=>r.json()).then(d=>{ 
                if (d.status === "success") localStorage.setItem(cacheKey, JSON.stringify(d));
                processData(d);
            }).catch(e => {
                alert("通信エラーが発生しました。");
                fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
            });
        });
    }


    // ====== 景品・もちもの（先に画面表示＋短いキャッシュで待ち時間を短縮） ======
    var __rewardsListCache = null;
    var __rewardsListCacheAt = 0;
    var __inventoryListCache = null;
    var __inventoryListCacheUserId = "";
    var __inventoryListCacheAt = 0;
    var REWARD_LIST_CACHE_MS_ = 120000;

    function invalidateInventoryListCache_() {
      __inventoryListCache = null;
      __inventoryListCacheUserId = "";
      __inventoryListCacheAt = 0;
    }

    function renderRewardsList_(rewards) {
        const c = document.getElementById('rewards-container');
        c.innerHTML = "";
        (rewards || []).forEach(r => {
            const div = document.createElement('div'); div.className = "item-card";
            const limitLine = r.limitMinutes > 0 ? `<div style="font-size:13px;color:#90CAF9;margin-bottom:8px;">制限時間: ${r.limitMinutes} 分</div>` : "";
            const safeId = String(r.id || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            const safeName = String(r.name || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            div.innerHTML = `<div class="item-title">🎁 ${r.name}</div><div style="color: gold; font-weight: bold; margin-bottom: 10px;">必要ポイント: ${r.points} Pt</div>${limitLine}<div style="font-size: 14px; color: #aaa; margin-bottom: 15px;">${r.desc}</div><button class="submit-btn btn-orange" style="width: 100%; padding: 10px; font-size: 18px;" onclick="exchangeReward('${safeId}', '${safeName}', ${Number(r.points) || 0}, this)">交換する</button>`;
            c.appendChild(div);
        });
        if (!(rewards || []).length) c.innerHTML = "<p>いま交換できる景品がありません。</p>";
    }

    function fetchRewardsList_() {
        const apply = function (d) {
          if (d && d.status === "success") {
            __rewardsListCache = d.rewards || [];
            __rewardsListCacheAt = Date.now();
          }
          return d;
        };
        if (typeof gasApiFetchJson === "function") {
          return gasApiFetchJson({ action: "get_rewards" }, { retries: 2, timeoutMs: 60000, retryDelaysMs: [500, 1200] })
            .then(apply);
        }
        return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_rewards" }) })
          .then(r => r.json())
          .then(apply);
    }

    function loadRewards(btn) {
        const origText = toggleBtnLoading(btn, true);
        try { hideKanjiQuizSetLoadingOverlay_(); } catch (_e) {}
        switchSection('section-rewards');
        const box = document.getElementById('rewards-container');
        const now = Date.now();
        const cacheFresh = __rewardsListCache && (now - __rewardsListCacheAt) < REWARD_LIST_CACHE_MS_;
        if (cacheFresh) {
            renderRewardsList_(__rewardsListCache);
            toggleBtnLoading(btn, false, origText);
            fetchRewardsList_().then(d => {
                const sec = document.getElementById('section-rewards');
                if (d && d.status === "success" && sec && sec.classList.contains('active')) {
                    renderRewardsList_(__rewardsListCache);
                }
            }).catch(() => {});
            return;
        }
        if (box) box.innerHTML = "<p>よみこみ中...</p>";
        fetchRewardsList_()
        .then(d => {
            toggleBtnLoading(btn, false, origText);
            if (d && d.status === "success") renderRewardsList_(__rewardsListCache);
            else if (box) box.innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
        }).catch(function (err) {
            console.error("loadRewards failed:", err);
            toggleBtnLoading(btn, false, origText);
            if (box) box.innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
        });
    }

    function exchangeReward(rewardId, rewardName, points, btn) { 
        const user = JSON.parse(localStorage.getItem('app_kid_user')); 
        if(user.points < points) { alert("ポイントが足りないよ！もっと勉強してポイントをためよう！"); return; } 
        if(!confirm(`「${rewardName}」と交換しますか？\n（${points} Ptへります）`)) return; 
        const origText = toggleBtnLoading(btn, true); 
        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "exchange_reward", userId: user.id, rewardId: rewardId }) })
        .then(r=>r.json()).then(d=>{ 
            toggleBtnLoading(btn, false, origText); 
            if(d.status==="success") { 
                alert(d.message); 
                user.points = d.newPoints; saveAppKidUserToLocal(user);
                invalidateInventoryListCache_();
                showHome(user); 
            } else { alert(d.message); } 
        }).catch(e => { alert("通信エラーが発生しました。"); toggleBtnLoading(btn, false, origText); }); 
    }

    function fetchInventoryList_(userId) {
        const apply = function (d) {
          if (d && d.status === "success") {
            __inventoryListCache = d.inventory || [];
            __inventoryListCacheUserId = String(userId);
            __inventoryListCacheAt = Date.now();
          }
          return d;
        };
        if (typeof gasApiFetchJson === "function") {
          return gasApiFetchJson({ action: "get_inventory", userId: userId }, { retries: 2, timeoutMs: 60000, retryDelaysMs: [500, 1200] })
            .then(apply);
        }
        return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_inventory", userId: userId }) })
          .then(r => r.json())
          .then(apply);
    }

    function loadInventory(btn) { 
        const origText = toggleBtnLoading(btn, true);
        try { hideKanjiQuizSetLoadingOverlay_(); } catch (_e) {}
        switchSection('section-inventory');
        const user = JSON.parse(localStorage.getItem('app_kid_user'));
        const now = Date.now();
        const cacheFresh = __inventoryListCache
          && __inventoryListCacheUserId === String(user.id)
          && (now - __inventoryListCacheAt) < REWARD_LIST_CACHE_MS_;
        if (cacheFresh) {
            userInventoryData = __inventoryListCache;
            showAllInventory = false;
            renderInventory();
            toggleBtnLoading(btn, false, origText);
            fetchInventoryList_(user.id).then(d => {
                if (d && d.status === "success") {
                  userInventoryData = __inventoryListCache;
                  const sec = document.getElementById('section-inventory');
                  if (sec && sec.classList.contains('active')) renderInventory();
                }
            }).catch(() => {});
            return;
        }
        document.getElementById('inventory-container').innerHTML = "<p>よみこみ中...</p>";
        fetchInventoryList_(user.id)
        .then(d => {
            toggleBtnLoading(btn, false, origText);
            if (d && d.status === "success") {
                userInventoryData = __inventoryListCache;
                showAllInventory = false;
                renderInventory();
            } else {
                document.getElementById('inventory-container').innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
            }
        }).catch(() => {
            toggleBtnLoading(btn, false, origText);
            document.getElementById('inventory-container').innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
        });
    }

    function renderInventory() { 
        const c = document.getElementById('inventory-container'); 
        c.innerHTML = ""; 
        const btn = document.getElementById('toggle-inventory-btn'); 
        btn.innerText = showAllInventory ? "未消化だけ表示する" : "すべて表示する"; 
        let filtered = userInventoryData; 
        if(!showAllInventory) filtered = filtered.filter(i => i.status !== "使用済み"); 
        if(filtered.length === 0) { c.innerHTML = "<p>表示できるアイテムがありません。</p>"; return; } 
        filtered.forEach(item => { 
            const div = document.createElement('div'); div.className = "item-card"; 
            const isUsed = item.status === "使用済み";
            const limitLine = item.limitMinutes > 0 ? `<div style="font-size:13px;color:#90CAF9;">制限時間: ${item.limitMinutes} 分</div>` : "";
            const usedLine = item.usedAt ? `<div style="font-size:12px;color:#aaa;">使用日時: ${new Date(item.usedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>` : "";
            const btnHtml = isUsed ? `<button class="submit-btn btn-gray" style="width: 100%; padding: 10px; font-size: 18px;" disabled>使用済み</button>` : `<button class="submit-btn btn-green" style="width: 100%; padding: 10px; font-size: 18px;" onclick="consumeReward(${item.rowIdx}, this)">使う！</button>`; 
            div.innerHTML = `<div class="item-title">🎒 ${item.rewardName}</div><div style="font-size: 12px; color: #aaa; margin-bottom: 6px;">交換日: ${new Date(item.date).toLocaleString()}</div>${limitLine}${usedLine}${btnHtml}`; 
            c.appendChild(div); 
        }); 
    }

    function toggleInventoryView() { showAllInventory = !showAllInventory; renderInventory(); }

    function consumeReward(rowIdx, btn) { 
        if(!confirm("本当にこの景品を使いますか？\n※おうちの人に確認してもらってから押してね！")) return; 
        const user = JSON.parse(localStorage.getItem('app_kid_user'));
        const origText = toggleBtnLoading(btn, true); 
        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "consume_reward", rowIdx: rowIdx, userId: user.id }) })
        .then(r=>r.json()).then(d=>{ 
            toggleBtnLoading(btn, false, origText);
            if(d.status==="success") { 
                alert(d.message); 
                const item = userInventoryData.find(i => i.rowIdx === rowIdx);
                if (item) {
                  item.status = "使用済み";
                  item.usedAt = d.activeTicket ? d.activeTicket.usedAt : new Date().toISOString();
                }
                __inventoryListCache = userInventoryData;
                __inventoryListCacheAt = Date.now();
                if (d.activeTicket) setActiveRewardTicket_(d.activeTicket);
                renderInventory(); 
            } else {
                alert(d.message || "使用できませんでした");
            }
        }).catch(e => toggleBtnLoading(btn, false, origText)); 
    }

    // ====== 第2弾：外部学習（申請 → 管理者PIN承認） ======
    function loadExternalLearning(btn) {
      const origText = toggleBtnLoading(btn, true);
      document.getElementById('external-container').innerHTML = "<p>さがしています...</p>";
      document.getElementById('external-my-requests').innerHTML = "";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_external_learning" }) })
      .then(r=>r.json()).then(d=>{
        toggleBtnLoading(btn, false, origText);
        if(d.status === "success") {
          switchSection('section-external');
          externalMenus = d.list || [];
          renderExternalLearningForm();
          refreshMyExternalRequests();
          const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
          if (user && user.stopwatchJson && user.stopwatchJson.external) {
            applyStopwatchState_('external', user.stopwatchJson.external);
          }
          if (user) loadStopwatchFromServer(user);
        }
      }).catch(e => toggleBtnLoading(btn, false, origText));
    }

    function renderExternalLearningForm() {
      const c = document.getElementById('external-container'); 
      c.innerHTML = "";
      if (externalMenus.length === 0) {
        c.innerHTML = "<p>登録されているメニューがありません。</p>";
        return;
      }
      const categories = [...new Set(externalMenus.map(m => m.category || ""))].filter(v => v);
      if (categories.length === 0) { c.innerHTML = "<p>カテゴリが設定されていません。</p>"; return; }
      c.innerHTML = `
        <div class="setting-group">
          <h3>カテゴリ</h3>
          <select id="external-category" class="large-select"></select>
        </div>
        <div class="setting-group">
          <h3>分量</h3>
          <select id="external-volume" class="large-select"></select>
          <p style="margin:6px 0 0; color:gold;">獲得ポイント: <span id="external-points-display">0</span> Pt</p>
        </div>
        <div class="setting-group">
          <h3>こどもメモ（自由記述）</h3>
          <textarea id="external-child-memo" rows="3" style="width:100%; box-sizing:border-box; border-radius:10px; padding:10px; background:#222; color:#fff; border:1px solid #555;" placeholder="がんばった内容やメモを書こう（空欄でもOK）"></textarea>
          <button type="button" class="submit-btn btn-blue" style="margin-top:8px; width:100%;" onclick="startJaSpeechToField('external-child-memo')">🎙️ 日本語で入力（マイク）</button>
        </div>
        <button type="button" class="submit-btn btn-green" style="width:100%;" onclick="submitExternalLearningRequestSelected()">申請する</button>
      `;
      const catSelect = document.getElementById('external-category');
      categories.forEach(cat => { const opt = document.createElement('option'); opt.value = cat; opt.innerText = cat; catSelect.appendChild(opt); });
      catSelect.onchange = () => updateExternalVolumeOptions();
      updateExternalVolumeOptions();
    }

    function updateExternalVolumeOptions() {
      const cat = document.getElementById('external-category').value;
      const volSelect = document.getElementById('external-volume');
      volSelect.innerHTML = "";
      const vols = externalMenus.filter(m => m.category === cat);
      vols.forEach(v => { const opt = document.createElement('option'); opt.value = v.volume; opt.innerText = v.volume; opt.dataset.points = v.points; volSelect.appendChild(opt); });
      const pts = document.getElementById('external-points-display');
      const first = vols[0];
      pts.innerText = first ? first.points : 0;
      volSelect.onchange = () => {
        const selected = vols.find(v => v.volume === volSelect.value);
        pts.innerText = selected ? selected.points : 0;
      };
    }

    function getSelectedExternalMenu() {
      const cat = document.getElementById('external-category').value;
      const vol = document.getElementById('external-volume').value;
      const match = externalMenus.find(m => m.category === cat && m.volume === vol);
      const points = match ? match.points : 0;
      return { category: cat, volume: vol, points };
    }

    function refreshMyExternalRequests() {
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      if (!user) return;
      const box = document.getElementById('external-my-requests');
      box.innerHTML = "<p style='color:#888;'>あなたの申請を読み込み中...</p>";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_my_external_learning_requests", userId: user.id }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success" || !d.list || d.list.length === 0) {
          box.innerHTML = "<p style='color:#888;'>※まだ申請履歴はありません。</p>";
          return;
        }
        const label = { "申請中": "⏳ 申請中", "承認済み": "✅ 承認済み", "却下": "❌ 却下" };
        let html = "<strong style='color:#fff;'>あなたの申請</strong><ul style='margin:8px 0 0;padding-left:18px;'>";
        d.list.forEach(r => {
          const st = label[r.status] || r.status;
          const memoHtml = r.childMemo ? `<br><span style='font-size:12px;color:#ddd;'>メモ: ${r.childMemo}</span>` : "";
          html += `<li style='margin-bottom:8px;'>${r.category} / ${r.volume}（+${r.points} Pt）<br><span style='font-size:12px;color:#aaa;'>${r.requestedAt} — ${st}</span>${memoHtml}</li>`;
        });
        html += "</ul>";
        box.innerHTML = html;
      }).catch(() => { box.innerHTML = ""; });
    }

    function submitExternalLearningRequestSelected() {
      const menu = getSelectedExternalMenu();
      if(!menu.category || !menu.volume) { alert("カテゴリと分量を選んでください。"); return; }
      if(!confirm(`「${menu.category} / ${menu.volume}」を申請する？\n（おうちの人が管理者PINで承認するまでポイントは付きません）`)) return;
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      const childMemo = document.getElementById('external-child-memo').value || "";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "submit_external_learning_request", userId: user.id, category: menu.category, volume: menu.volume, points: menu.points, childMemo: childMemo }) })
      .then(r=>r.json()).then(d=>{
        if(d.status === "success") {
          alert(d.message);
          refreshMyExternalRequests();
        } else {
          alert(d.message || "申請に失敗しました");
        }
      }).catch(() => alert("通信エラーが発生しました。"));
    }

    // ====== 学習形式・こたえ方（学習者UIと特訓管理で共通） ======
    const TRAINING_QFORMAT_TO_INTERNAL = {
      "日本語→英単語": "ja_to_en",
      "日本語→英語（並び替え）": "ja_to_en_sort",
      "並び替え（日本語付き）": "ja_to_en_sort",
      "英単語→日本語": "en_to_ja",
      "音声→日本語": "en_audio_to_ja",
      "音声→英単語": "qaudio_to_en",
      "疑問文→英語": "qtext_to_en",
      "英語→英語": "en_to_en",
      "英単語→英単語": "en_to_en",
      "英語読み上げ→英語": "en_audio_to_en",
      "漢字→よみかな選択": "select_kana",
      "送り仮名選択": "select_kana",
      "漢字→よみかな入力": "type_yomi",
      "読み仮名タイプ": "type_yomi",
      "漢字→書いて答える": "write_kanji",
      "書いて問題に回答": "write_kanji",
      "漢字→書き順なぞる": "stroke_order",
      "書き順チェック": "stroke_order",
      "漢字→採点チャレンジ": "kanji_hand",
      "漢字熟語→読み選択": "jukugo_yomi",
      "熟語読み方選択": "jukugo_yomi"
    };
    const TRAINING_AFORMAT_TO_INTERNAL = {
      "4択": "4choice",
      "タイピング": "typing",
      "音声": "voice",
      "穴埋め4択": "fill_4choice",
      "穴埋めタイピング": "fill_typing",
      "タイピング（イニシャル）": "initial_typing",
      "タイピング（穴埋め）": "sheet_fill_typing",
      "音声入力（イニシャル）": "initial_voice",
      "音声入力（穴埋め）": "sheet_fill_voice",
      "タイピング（フラッシュ）": "flash_typing",
      "音声入力（フラッシュ）": "flash_voice",
      "すべて用いる": "sort_all",
      "不要語混入": "sort_dummy",
      "不足語補足": "sort_missing",
      "採点": "hand_grade",
      "クイズ": "quiz"
    };

    function trainingRouteLabelsToInternal(qFormat, aFormat) {
      const format = TRAINING_QFORMAT_TO_INTERNAL[String(qFormat || "").trim()] || "";
      let ansType = TRAINING_AFORMAT_TO_INTERNAL[String(aFormat || "").trim()] || "";
      if (format === "en_to_ja" || format === "en_audio_to_ja") ansType = "4choice";
      return { format: format, ansType: ansType };
    }

    function isKanjiJukugoTrainingModeName(modeName) {
      return /熟語/.test(String(modeName || ""));
    }

    function isKanjiTrainingQFormat_(qFormat) {
      const q = String(qFormat || "").trim();
      if (!q) return false;
      if (/漢字/.test(q) || /採点/.test(q)) return true;
      return (
        q === "送り仮名選択" ||
        q === "読み仮名タイプ" ||
        q === "書いて問題に回答" ||
        q === "書き順チェック" ||
        q === "熟語読み方選択" ||
        q === "熟語読みタイプ"
      );
    }

    function isKanjiJukugoTrainingQFormat_(qFormat) {
      const q = String(qFormat || "").trim();
      return /漢字熟語/.test(q) || q === "熟語読み方選択" || q === "熟語読みタイプ";
    }

    function findTrainingMaterialForUnit(unitName, materials, qFormat) {
      const unit = String(unitName || "").trim();
      if (!unit) return null;
      const mats = materials || (trainingAdminData && trainingAdminData.materials) || materialsData || [];
      const q = String(qFormat || "");
      const preferJukugo = isKanjiJukugoTrainingQFormat_(q);
      const preferStandardKanji = isKanjiTrainingQFormat_(q) && !preferJukugo;
      let fallback = null;
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if (!(m.units || []).some(function (u) { return String(u) === unit; })) continue;
        if (!fallback) fallback = m;
        const isJuk = isKanjiJukugoTrainingModeName(m.modeName);
        if (preferJukugo && isJuk) return m;
        if (preferStandardKanji && (m.category === "kanji" || /漢字/.test(String(m.modeName || ""))) && !isJuk) return m;
      }
      return fallback;
    }

    function getTrainingModeNameForUnit(unitName, materials) {
      const m = findTrainingMaterialForUnit(unitName, materials);
      return m ? String(m.modeName || "") : "";
    }

    function getTrainingCategoryForUnit(unitName, materials) {
      const m = findTrainingMaterialForUnit(unitName, materials);
      if (!m) return "english";
      if (m.category === "kanji" || /漢字/.test(String(m.modeName || ""))) return "kanji";
      return "english";
    }

    function getLearnerFormatOptions(modeName, category) {
      if (category === "kanji" || /漢字/.test(String(modeName || ""))) {
        if (isKanjiJukugoTrainingModeName(modeName)) {
          return [
            { value: "jukugo_yomi", label: "熟語読み方選択", qFormat: "熟語読み方選択" },
            { value: "jukugo_type_yomi", label: "読み仮名タイプ", qFormat: "熟語読みタイプ" }
          ];
        }
        return [
          { value: "select_kana", label: "送り仮名選択", qFormat: "送り仮名選択" },
          { value: "type_yomi", label: "読み仮名タイプ", qFormat: "読み仮名タイプ" },
          { value: "write_kanji", label: "書いて問題に回答", qFormat: "書いて問題に回答" },
          { value: "stroke_order", label: "書き順チェック", qFormat: "書き順チェック" },
          { value: "kanji_hand", label: "漢字 → 採点チャレンジ", qFormat: "漢字→採点チャレンジ" }
        ];
      }
      const isWord = String(modeName || "").includes("単語");
      if (isWord) {
        return [
          { value: "ja_to_en", label: "日本語 ➔ 英語にする", qFormat: "日本語→英単語" },
          { value: "en_to_ja", label: "英語 ➔ 日本語にする", qFormat: "英単語→日本語" },
          { value: "en_audio_to_ja", label: "英語読み上げ ➔ 日本語にする", qFormat: "音声→日本語" },
          { value: "en_audio_to_en", label: "英語読み上げ ➔ 英語にする", qFormat: "英語読み上げ→英語" },
          { value: "en_to_en", label: "英語 ➔ 英語にする", qFormat: "英語→英語" }
        ];
      }
      return [
        { value: "ja_to_en", label: "日本語 ➔ 英語にする", qFormat: "日本語→英単語" },
        { value: "ja_to_en_sort", label: "並び替え（日本語付き）", qFormat: "日本語→英語（並び替え）" },
        { value: "en_to_ja", label: "英語 ➔ 日本語にする", qFormat: "英単語→日本語" },
        { value: "qtext_to_en", label: "疑問文 ➔ 英語にする", qFormat: "疑問文→英語" },
        { value: "qaudio_to_en", label: "疑問文(読み上げ) ➔ 英語にする", qFormat: "音声→英単語" },
        { value: "en_audio_to_en", label: "英語読み上げ ➔ 英語にする", qFormat: "英語読み上げ→英語" },
        { value: "en_to_en", label: "英語 ➔ 英語にする", qFormat: "英語→英語" }
      ];
    }

    function getLearnerAnswerOptions(format, modeName) {
      const isWord = String(modeName || "").includes("単語");
      const opts = [];
      function add(value, label, aFormat) { opts.push({ value: value, label: label, aFormat: aFormat }); }
      if (format === "kanji_hand") {
        add("hand_grade", "採点", "採点");
        return opts;
      }
      if (
        format === "select_kana" ||
        format === "type_yomi" ||
        format === "write_kanji" ||
        format === "stroke_order" ||
        format === "jukugo_yomi" ||
        format === "jukugo_type_yomi"
      ) {
        add("quiz", "クイズ", "クイズ");
        return opts;
      }
      if (format === "ja_to_en_sort") {
        add("sort_all", "すべて用いる", "すべて用いる");
        add("sort_dummy", "不要語混入", "不要語混入");
        add("sort_missing", "不足語補足", "不足語補足");
        return opts;
      }
      if (format === "ja_to_en") {
        add("4choice", "４択（えらぶ）", "4択");
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        if (isWord) {
          add("fill_4choice", "🔠 穴埋め（４択）", "穴埋め4択");
          add("fill_typing", "⌨️ 穴埋め（タイピング）", "穴埋めタイピング");
        }
        return opts;
      }
      if (format === "qtext_to_en" || format === "qaudio_to_en") {
        if (format !== "qaudio_to_en") add("4choice", "４択（えらぶ）", "4択");
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        return opts;
      }
      if (format === "en_to_ja" || format === "en_audio_to_ja") {
        add("4choice", "４択（えらぶ）", "4択");
        return opts;
      }
      if (format === "en_audio_to_en") {
        add("4choice", "４択（えらぶ）", "4択");
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        if (isWord) {
          add("fill_4choice", "🔠 穴埋め（４択）", "穴埋め4択");
          add("fill_typing", "⌨️ 穴埋め（タイピング）", "穴埋めタイピング");
        }
        return opts;
      }
      if (format === "en_to_en") {
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        add("flash_typing", "タイピング（フラッシュ）", "タイピング（フラッシュ）");
        add("flash_voice", "🎙️ 音声入力（フラッシュ）", "音声入力（フラッシュ）");
        if (!isWord) {
          add("initial_typing", "タイピング（イニシャル）", "タイピング（イニシャル）");
          add("sheet_fill_typing", "タイピング（穴埋め）", "タイピング（穴埋め）");
          add("initial_voice", "🎙️ 音声入力（イニシャル）", "音声入力（イニシャル）");
          add("sheet_fill_voice", "🎙️ 音声入力（穴埋め）", "音声入力（穴埋め）");
        }
        return opts;
      }
      return opts;
    }

    function isValidTrainingRouteCombo(unitName, qFormat, aFormat, materials) {
      const parsed = trainingRouteLabelsToInternal(qFormat, aFormat);
      if (!parsed.format || !parsed.ansType) return false;
      const mat = findTrainingMaterialForUnit(unitName, materials, qFormat);
      const modeName = mat ? String(mat.modeName || "") : getTrainingModeNameForUnit(unitName, materials);
      const category = mat
        ? ((mat.category === "kanji" || /漢字/.test(modeName)) ? "kanji" : "english")
        : getTrainingCategoryForUnit(unitName, materials);
      if (!modeName && category !== "kanji") return false;
      const formats = getLearnerFormatOptions(modeName, category);
      const fmt = formats.find(function (f) { return f.qFormat === String(qFormat || "").trim(); });
      if (!fmt) return false;
      const answers = getLearnerAnswerOptions(fmt.value, modeName);
      return answers.some(function (a) { return a.aFormat === String(aFormat || "").trim(); });
    }

    function getAllEnglishBasePointCombos() {
      const out = [];
      ["単語モード", "表現モード"].forEach(function (modeName) {
        const modeCategory = modeName.includes("単語") ? "word" : "expression";
        getLearnerFormatOptions(modeName, "english").forEach(function (f) {
          getLearnerAnswerOptions(f.value, modeName).forEach(function (a) {
            out.push({
              format: f.value,
              formatLabel: f.label,
              ansType: a.value,
              ansLabel: a.label,
              settingKey: "基本Pt_" + f.value + "_" + a.value,
              modeCategory: modeCategory,
              modeLabel: modeName
            });
          });
        });
      });
      return out;
    }

    // ====== おうちの人：統合管理メニュー ======
    let parentAdminPinSession = "";

    function syncAdminPinInputs(pin) {
      const p = String(pin || "");
      const ext = document.getElementById('external-admin-pin-input');
      const train = document.getElementById('training-admin-pin-input');
      if (ext) ext.value = p;
      if (train) train.value = p;
    }

    function openParentAdminMenu() {
      parentAdminPinSession = "";
      syncAdminPinInputs("");
      const pinPanel = document.getElementById('parent-admin-pin-panel');
      const hubPanel = document.getElementById('parent-admin-hub-panel');
      const msg = document.getElementById('parent-admin-message');
      const pinInput = document.getElementById('parent-admin-pin-input');
      if (pinInput) pinInput.value = "";
      if (pinPanel) pinPanel.style.display = "block";
      if (hubPanel) hubPanel.style.display = "none";
      if (msg) msg.innerText = "";
      switchSection('section-parent-admin');
    }

    function showParentAdminHub() {
      const pinPanel = document.getElementById('parent-admin-pin-panel');
      const hubPanel = document.getElementById('parent-admin-hub-panel');
      const msg = document.getElementById('parent-admin-message');
      if (pinPanel) pinPanel.style.display = "none";
      if (hubPanel) hubPanel.style.display = "flex";
      if (msg) msg.innerText = "";
    }

    function loginParentAdmin() {
      const pinInput = document.getElementById('parent-admin-pin-input');
      const msg = document.getElementById('parent-admin-message');
      const pin = pinInput ? String(pinInput.value || "").trim() : "";
      if (!pin) {
        if (msg) msg.innerText = "PINを入力してください。";
        return;
      }
      if (msg) { msg.innerText = "確認中..."; msg.style.color = "#aaa"; }
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          if (msg) { msg.innerText = d.message || "PINが正しくありません"; msg.style.color = "#ff8a80"; }
          return;
        }
        parentAdminPinSession = pin;
        syncAdminPinInputs(pin);
        showParentAdminHub();
      }).catch(function () {
        if (msg) { msg.innerText = "通信エラー"; msg.style.color = "#ff8a80"; }
      });
    }

    function backToParentAdminHub() {
      if (!parentAdminPinSession) {
        openParentAdminMenu();
        return;
      }
      logoutTrainingMenuAdmin(true);
      document.getElementById('external-admin-message').innerText = "";
      document.getElementById('external-admin-list').style.display = "none";
      document.getElementById('external-admin-list').innerHTML = "";
      document.getElementById('external-admin-pin-panel').style.display = "none";
      switchSection('section-parent-admin');
      showParentAdminHub();
    }

    function logoutParentAdmin() {
      parentAdminPinSession = "";
      syncAdminPinInputs("");
      logoutTrainingMenuAdmin(true);
      document.getElementById('external-admin-message').innerText = "";
      document.getElementById('external-admin-list').style.display = "none";
      document.getElementById('external-admin-list').innerHTML = "";
      const pinInput = document.getElementById('parent-admin-pin-input');
      if (pinInput) pinInput.value = "";
      openParentAdminMenu();
    }

    function enterParentAdminExternal() {
      if (!parentAdminPinSession) { openParentAdminMenu(); return; }
      syncAdminPinInputs(parentAdminPinSession);
      document.getElementById('external-admin-pin-panel').style.display = "none";
      document.getElementById('external-admin-message').innerText = "";
      document.getElementById('external-admin-list').style.display = "none";
      document.getElementById('external-admin-list').innerHTML = "";
      switchSection('section-external-admin');
      loadExternalAdminPending();
    }

    function enterParentAdminTraining() {
      if (!parentAdminPinSession) { openParentAdminMenu(); return; }
      syncAdminPinInputs(parentAdminPinSession);
      document.getElementById('training-admin-pin-panel').style.display = "none";
      document.getElementById('training-admin-main').style.display = "none";
      closeTrainingAdminRoutePanel();
      switchSection('section-training-admin');
      loadTrainingMenuAdmin();
    }

    function enterParentAdminNotify() {
      if (!parentAdminPinSession) { openParentAdminMenu(); return; }
      switchSection('section-parent-admin-notify');
      loadParentNotifyEmails();
    }

    function loadParentNotifyEmails() {
      const msg = document.getElementById('parent-notify-message');
      if (msg) { msg.innerText = "読み込み中..."; msg.style.color = "#aaa"; }
      fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_parent_notify_emails', adminPin: parentAdminPinSession })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.status !== 'success') {
          if (msg) { msg.innerText = d.message || '読み込みに失敗しました'; msg.style.color = '#ff8a80'; }
          return;
        }
        const emails = d.emails || [];
        for (let i = 1; i <= 4; i++) {
          const el = document.getElementById('parent-notify-email-' + i);
          if (el) el.value = emails[i - 1] || '';
        }
        if (msg) msg.innerText = '';
      }).catch(function () {
        if (msg) { msg.innerText = '通信エラー'; msg.style.color = '#ff8a80'; }
      });
    }

    function saveParentNotifyEmails() {
      const msg = document.getElementById('parent-notify-message');
      const emails = [];
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('parent-notify-email-' + i);
        emails.push(el ? String(el.value || '').trim() : '');
      }
      if (msg) { msg.innerText = '保存中...'; msg.style.color = '#aaa'; }
      fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_parent_notify_emails', adminPin: parentAdminPinSession, emails: emails })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.status === 'success') {
          if (msg) { msg.innerText = d.message || '保存しました'; msg.style.color = '#81C784'; }
        } else {
          if (msg) { msg.innerText = d.message || '保存に失敗しました'; msg.style.color = '#ff8a80'; }
        }
      }).catch(function () {
        if (msg) { msg.innerText = '通信エラー'; msg.style.color = '#ff8a80'; }
      });
    }

    function openExternalAdminApproval() { openParentAdminMenu(); }
    function openTrainingMenuAdmin() { openParentAdminMenu(); }

    // ====== 特訓メニュー管理（管理者） ======
    let trainingAdminData = null;
    let trainingAdminEditingMenuId = null;
    let trainingAdminDraftRoutes = [];
    let trainingAdminEditingDraftIdx = null;
    let trainingAdminRoutesDirty = false;

    function getTrainingAdminPin() {
      const el = document.getElementById('training-admin-pin-input');
      const v = el ? String(el.value || "").trim() : "";
      return v || parentAdminPinSession || "";
    }

    function logoutTrainingMenuAdmin(skipPinPanel) {
      trainingAdminData = null;
      trainingAdminEditingMenuId = null;
      trainingAdminDraftRoutes = [];
      trainingAdminEditingDraftIdx = null;
      trainingAdminRoutesDirty = false;
      document.getElementById('training-admin-main').style.display = "none";
      if (!skipPinPanel) {
        document.getElementById('training-admin-pin-panel').style.display = "block";
        document.getElementById('training-admin-pin-input').value = "";
      } else {
        document.getElementById('training-admin-pin-panel').style.display = "none";
      }
      closeTrainingAdminRoutePanel();
    }

    function setTrainingAdminMessage(text, isOk) {
      const el = document.getElementById('training-admin-message');
      if (!el) return;
      el.innerText = text || "";
      el.style.color = isOk ? "#8bc34a" : "#ff8a80";
    }

    function loadTrainingMenuAdmin() {
      const pin = getTrainingAdminPin();
      setTrainingAdminMessage("読み込み中...", true);
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          setTrainingAdminMessage(d.message || "エラー", false);
          return;
        }
        trainingAdminData = d;
        document.getElementById('training-admin-pin-panel').style.display = "none";
        document.getElementById('training-admin-main').style.display = "block";
        switchTrainingAdminTab('menus');
        renderTrainingAdminMenuGrid();
        setTrainingAdminMessage("", true);
      }).catch(() => setTrainingAdminMessage("通信エラー", false));
    }

    function switchTrainingAdminTab(tab) {
      const isMenus = tab === "menus";
      const tabMenus = document.getElementById('training-admin-tab-menus');
      const tabPoints = document.getElementById('training-admin-tab-points');
      const panelMenus = document.getElementById('training-admin-panel-menus');
      const panelPoints = document.getElementById('training-admin-panel-points');
      if (tabMenus) tabMenus.classList.toggle('active', isMenus);
      if (tabPoints) tabPoints.classList.toggle('active', !isMenus);
      if (panelMenus) panelMenus.style.display = isMenus ? "block" : "none";
      if (panelPoints) panelPoints.style.display = isMenus ? "none" : "block";
      if (!isMenus) renderTrainingAdminPointsForm();
    }

    function renderTrainingAdminMenuGrid() {
      const grid = document.getElementById('training-admin-menu-grid');
      if (!grid || !trainingAdminData || !Array.isArray(trainingAdminData.menus)) return;
      const colors = trainingAdminData.colorPresets || TRAINING_MENU_DEFAULT_COLORS.map(function (c, i) { return { id: "c" + i, color: c }; });
      grid.innerHTML = trainingAdminData.menus.map(function (menu) {
        const colorOpts = colors.map(function (p) {
          const sel = p.color === menu.color ? " selected" : "";
          return `<option value="${escapeHtml(p.color)}"${sel}>${escapeHtml(p.color)}</option>`;
        }).join("");
        const routeCount = Array.isArray(menu.routes) ? menu.routes.length : 0;
        const sampleBadge = menu.isKanjiSample
          ? `<span style="margin-left:6px;font-size:11px;color:#CE93D8;border:1px solid #7B1FA2;border-radius:4px;padding:1px 6px;">漢字サンプル</span>`
          : (menu.isEnglishSample
            ? `<span style="margin-left:6px;font-size:11px;color:#90CAF9;border:1px solid #1976D2;border-radius:4px;padding:1px 6px;">英語サンプル</span>`
            : "");
        return `<div class="training-admin-card" style="border-left:4px solid ${escapeHtml(menu.color)};">
          <div class="training-admin-card-head">
            <span class="training-admin-color-dot" style="background:${escapeHtml(menu.color)};"></span>
            <span>メニュー ${menu.id}</span>${sampleBadge}
            <span style="margin-left:auto;font-size:12px;color:#888;">${routeCount} ステップ</span>
          </div>
          <div class="training-admin-field">
            <label>表示名</label>
            <input type="text" id="train-admin-name-${menu.id}" value="${escapeHtml(menu.displayName || "")}" placeholder="特訓メニュー${menu.id}">
          </div>
          <div class="training-admin-field">
            <label>ボタンの色</label>
            <select id="train-admin-color-${menu.id}">${colorOpts}</select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#ccc;margin:8px 0;">
            <input type="checkbox" id="train-admin-enabled-${menu.id}" ${menu.enabled ? "checked" : ""}> 表示する（子ども画面に出す）
          </label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            <button type="button" class="submit-btn btn-green" style="margin:0;padding:8px 10px;font-size:13px;" onclick="saveTrainingAdminMenuMeta(${menu.id}, this)">設定を保存</button>
            <button type="button" class="submit-btn btn-blue" style="margin:0;padding:8px 10px;font-size:13px;" onclick="openTrainingAdminRouteEditor(${menu.id})">ルート編集</button>
          </div>
        </div>`;
      }).join("");
    }

    function saveTrainingAdminMenuMeta(menuId, btn) {
      const pin = getTrainingAdminPin();
      const nameEl = document.getElementById('train-admin-name-' + menuId);
      const colorEl = document.getElementById('train-admin-color-' + menuId);
      const enabledEl = document.getElementById('train-admin-enabled-' + menuId);
      const orig = btn ? toggleBtnLoading(btn, true) : null;
      const stopLoading = function () {
        if (btn && btn.isConnected) toggleBtnLoading(btn, false, orig);
      };
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({
        action: "save_training_menu_meta",
        adminPin: pin,
        menuId: menuId,
        displayName: nameEl ? nameEl.value : "",
        color: colorEl ? colorEl.value : "",
        enabled: !!(enabledEl && enabledEl.checked)
      }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          setTrainingAdminMessage(d.message || "保存に失敗しました", false);
          stopLoading();
          return;
        }
        invalidateAppSettingsCache();
        return fetchAppSettings().then(function () {
          return reloadTrainingAdminData(null, "メニュー" + menuId + " の設定を保存しました");
        });
      }).catch(function () {
        setTrainingAdminMessage("通信エラー", false);
        stopLoading();
      });
    }

    function closeTrainingAdminRoutePanel() {
      trainingAdminEditingMenuId = null;
      trainingAdminDraftRoutes = [];
      trainingAdminEditingDraftIdx = null;
      trainingAdminRoutesDirty = false;
      const panel = document.getElementById('training-admin-route-panel');
      if (panel) panel.style.display = "none";
    }

    function cloneTrainingAdminDraftRoutes(routes) {
      return (routes || []).map(function (r) {
        return {
          targetUsers: String(r.targetUsers || "全員"),
          unitName: String(r.unitName || ""),
          qFormat: String(r.qFormat || ""),
          aFormat: String(r.aFormat || ""),
          mode: String(r.mode || "ランダム"),
          blankCount: r.blankCount != null ? r.blankCount : ""
        };
      });
    }

    function updateTrainingAdminAddButtonLabel() {
      const btn = document.getElementById('training-admin-route-add-btn');
      if (!btn) return;
      btn.innerText = trainingAdminEditingDraftIdx != null ? "リストに反映" : "リストに追加";
    }

    function updateTrainingAdminDraftHint() {
      const el = document.getElementById('training-admin-route-draft-hint');
      if (!el) return;
      const n = trainingAdminDraftRoutes.length;
      if (n === 0) {
        el.style.display = "none";
        el.innerText = "";
        return;
      }
      el.style.display = "block";
      el.innerText = trainingAdminRoutesDirty
        ? (n + " 件のルート（未保存の変更あり →「ルートを保存」でスプレッドシートに反映）")
        : (n + " 件のルート");
    }

    function getTrainingAdminMenuById(menuId) {
      if (!trainingAdminData || !Array.isArray(trainingAdminData.menus)) return null;
      return trainingAdminData.menus.find(function (m) { return m.id === menuId; }) || null;
    }

    function buildTrainingAdminUnitOptionsHtml(selected) {
      const sel = String(selected || "");
      let html = `<option value="">（単元を選択）</option>`;
      const mats = (trainingAdminData && trainingAdminData.materials) || [];
      mats.forEach(function (m) {
        (m.units || []).forEach(function (u) {
          const label = (m.modeName || "") + " / " + u;
          const val = String(u);
          html += `<option value="${escapeHtml(val)}"${val === sel ? " selected" : ""}>${escapeHtml(label)}</option>`;
        });
      });
      if (sel && html.indexOf('value="' + sel.replace(/"/g, "&quot;") + '"') < 0) {
        html += `<option value="${escapeHtml(sel)}" selected>${escapeHtml(sel)}（手入力）</option>`;
      }
      return html;
    }

    function renderTrainingAdminRouteList() {
      const listEl = document.getElementById('training-admin-route-list');
      if (!listEl) return;
      const routes = trainingAdminDraftRoutes || [];
      updateTrainingAdminDraftHint();
      if (!routes.length) {
        listEl.innerHTML = "<p style='color:#888;font-size:14px;margin:8px 0 0;'>ルートがまだありません。下のフォームから「リストに追加」してください。</p>";
        return;
      }
      const menuId = trainingAdminEditingMenuId;
      let rows = routes.map(function (r, idx) {
        const editingMark = trainingAdminEditingDraftIdx === idx ? " style='background:#2a1a32;'" : "";
        return `<tr${editingMark}>
          <td>${idx + 1}</td>
          <td>${escapeHtml(r.targetUsers || "全員")}</td>
          <td>${escapeHtml(r.unitName || "")}</td>
          <td>${escapeHtml(r.qFormat || "")}</td>
          <td>${escapeHtml(r.aFormat || "")}</td>
          <td>${escapeHtml(r.mode || "")}${(function () {
            const p = trainingRouteLabelsToInternal(r.qFormat, r.aFormat);
            return isLegacyFillBlankAnswerType(p.ansType) && r.blankCount !== "" && r.blankCount != null ? "<br>隠す:" + escapeHtml(String(r.blankCount)) : "";
          })()}</td>
          <td style="white-space:nowrap;">
            <button type="button" class="submit-btn btn-blue" style="margin:0 4px 4px 0;padding:4px 8px;font-size:12px;" onclick="editTrainingAdminRoute(${menuId}, ${idx})">編集</button>
            <button type="button" class="cancel-btn" style="margin:0;padding:4px 8px;font-size:12px;" onclick="deleteTrainingAdminRoute(${menuId}, ${idx})">削除</button>
          </td>
        </tr>`;
      }).join("");
      listEl.innerHTML = `<table class="training-admin-route-table"><thead><tr><th>#</th><th>対象</th><th>単元</th><th>形式</th><th>こたえ方</th><th>出し方</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderTrainingAdminRouteForm(route) {
      const form = document.getElementById('training-admin-route-form');
      if (!form || !trainingAdminData) return;
      const r = route || {};
      const parsed = trainingRouteLabelsToInternal(r.qFormat, r.aFormat);
      const isFillBlankRoute = isLegacyFillBlankAnswerType(parsed.ansType);
      const blankDefault = isFillBlankRoute
        ? (r.blankCount != null && String(r.blankCount).trim() !== "" ? String(r.blankCount) : "1")
        : "";
      const mOpts = (trainingAdminData.modes || ["ランダム", "順番"]).map(function (m) {
        return `<option value="${escapeHtml(m)}"${m === (r.mode || "ランダム") ? " selected" : ""}>${escapeHtml(m)}</option>`;
      }).join("");
      const userOpts = [`<option value="全員"${(!r.targetUsers || r.targetUsers === "全員") ? " selected" : ""}>全員</option>`]
        .concat((trainingAdminData.childUsers || []).map(function (u) {
          const val = String(u.id);
          return `<option value="${escapeHtml(val)}"${val === String(r.targetUsers || "") ? " selected" : ""}>${escapeHtml(u.name || u.id)}</option>`;
        })).join("");
      form.innerHTML =
        `<div class="training-admin-field"><label>対象ユーザー</label><select id="train-admin-route-users">${userOpts}</select></div>` +
        `<div class="training-admin-field"><label>単元</label><select id="train-admin-route-unit">${buildTrainingAdminUnitOptionsHtml(r.unitName)}</select></div>` +
        `<div class="training-admin-route-steps">` +
        `<div class="training-admin-step-group training-admin-step-format"><h4>1. もんだいの形式</h4><select id="train-admin-route-format" class="training-admin-select"></select></div>` +
        `<div class="training-admin-step-group training-admin-step-answer"><h4>2. こたえ方</h4><select id="train-admin-route-a" class="training-admin-select"><option value="">（先に単元と形式を選んでください）</option></select><p id="train-admin-route-a-hint" class="training-admin-step-hint">単元を選ぶと、こたえ方の選択肢が表示されます。</p></div>` +
        `<div class="training-admin-step-group training-admin-step-mode"><h4>3. 出し方</h4><select id="train-admin-route-mode" class="training-admin-select">${mOpts}</select></div>` +
        `<div class="training-admin-step-group training-admin-step-mode" id="train-admin-route-blank-wrap" style="display:none;"><h4>4. 隠す文字数（穴埋め）</h4><input type="number" id="train-admin-route-blank" class="training-admin-select" min="1" max="20" value="${escapeHtml(blankDefault)}" placeholder="1以上"></div>` +
        `</div>`;
      bindTrainingAdminRouteFormEvents(parsed.format, parsed.ansType);
    }

    function bindTrainingAdminRouteFormEvents(initialFormat, initialAnsType) {
      const unitEl = document.getElementById('train-admin-route-unit');
      const formatEl = document.getElementById('train-admin-route-format');
      const ansEl = document.getElementById('train-admin-route-a');
      const blankWrap = document.getElementById('train-admin-route-blank-wrap');
      const blankEl = document.getElementById('train-admin-route-blank');
      const ansHintEl = document.getElementById('train-admin-route-a-hint');
      if (!unitEl || !formatEl || !ansEl) return;

      function setAnswerHint(text) {
        if (ansHintEl) ansHintEl.innerText = text || "";
      }

      function refreshFormatOptions(preferredFormat, preferredAns) {
        const unit = unitEl.value;
        const modeName = getTrainingModeNameForUnit(unit, trainingAdminData.materials);
        const category = getTrainingCategoryForUnit(unit, trainingAdminData.materials);
        const formats = unit ? getLearnerFormatOptions(modeName, category) : [];
        if (!formats.length) {
          formatEl.innerHTML = `<option value="">（先に単元を選んでください）</option>`;
          ansEl.innerHTML = `<option value="">（先に単元と形式を選んでください）</option>`;
          setAnswerHint("単元を選ぶと、形式とこたえ方の選択肢が表示されます。");
          if (blankWrap) blankWrap.style.display = "none";
          return;
        }
        let selFormat = preferredFormat || formatEl.value;
        if (!formats.some(function (f) { return f.value === selFormat; })) selFormat = formats[0].value;
        formatEl.innerHTML = formats.map(function (f) {
          const sel = f.value === selFormat ? " selected" : "";
          return `<option value="${escapeHtml(f.value)}" data-qformat="${escapeHtml(f.qFormat)}"${sel}>${escapeHtml(f.label)}</option>`;
        }).join("");
        refreshAnswerOptions(preferredAns || "");
      }

      function refreshAnswerOptions(preferredAns) {
        const unit = unitEl.value;
        const format = formatEl.value;
        const modeName = getTrainingModeNameForUnit(unit, trainingAdminData.materials);
        const answers = format ? getLearnerAnswerOptions(format, modeName) : [];
        if (!format) {
          ansEl.innerHTML = `<option value="">（先に問題形式を選んでください）</option>`;
          setAnswerHint("問題形式を選ぶと、こたえ方の選択肢が表示されます。");
          updateBlankFieldVisibility();
          return;
        }
        if (!answers.length) {
          ansEl.innerHTML = `<option value="">（この形式ではこたえ方がありません）</option>`;
          setAnswerHint("この問題形式に対応するこたえ方がありません。形式を変えてください。");
          updateBlankFieldVisibility();
          return;
        }
        let selAns = preferredAns || ansEl.value;
        if (!answers.some(function (a) { return a.value === selAns; })) selAns = answers[0].value;
        ansEl.innerHTML = answers.map(function (a) {
          const sel = a.value === selAns ? " selected" : "";
          return `<option value="${escapeHtml(a.value)}" data-aformat="${escapeHtml(a.aFormat)}"${sel}>${escapeHtml(a.label)}</option>`;
        }).join("");
        setAnswerHint(answers.length + " 種類から選べます。");
        updateBlankFieldVisibility();
      }

      function updateBlankFieldVisibility() {
        const ansType = ansEl.value;
        const show = isLegacyFillBlankAnswerType(ansType);
        if (blankWrap) blankWrap.style.display = show ? "block" : "none";
        if (blankEl) {
          if (!show) blankEl.value = "";
          else if (!String(blankEl.value || "").trim()) blankEl.value = "1";
        }
      }

      unitEl.onchange = function () { refreshFormatOptions("", ""); };
      formatEl.onchange = function () { refreshAnswerOptions(""); };
      ansEl.onchange = updateBlankFieldVisibility;
      refreshFormatOptions(initialFormat || "", initialAnsType || "");
    }

    function renderTrainingAdminPointsForm() {
      const form = document.getElementById('training-admin-points-form');
      if (!form) return;
      const combos = getAllEnglishBasePointCombos();
      const formatMap = {};
      combos.forEach(function (c) {
        if (!formatMap[c.format]) formatMap[c.format] = c.formatLabel;
      });
      const formatItems = Object.keys(formatMap).map(function (k) { return { value: k, label: formatMap[k] }; });
      form.innerHTML =
        `<div class="training-admin-field"><label>1. もんだいの形式</label><select id="train-admin-point-format" class="large-select"></select></div>` +
        `<div class="training-admin-field"><label>2. こたえ方</label><select id="train-admin-point-answer" class="large-select"></select></div>` +
        `<div class="training-admin-field"><label>3. モード</label><select id="train-admin-point-mode" class="large-select"><option value="word">単語モード（単語列）</option><option value="expression">表現モード（表現列）</option></select></div>` +
        `<div class="training-admin-field"><label>基本ポイント（1問あたり）</label><input type="number" id="train-admin-point-value" min="0" max="999" step="1" value="20"></div>` +
        `<div id="train-admin-point-key" class="training-admin-points-key"></div>`;
      const formatEl = document.getElementById('train-admin-point-format');
      const ansEl = document.getElementById('train-admin-point-answer');
      const modeEl = document.getElementById('train-admin-point-mode');
      const valueEl = document.getElementById('train-admin-point-value');
      const keyEl = document.getElementById('train-admin-point-key');
      const settings = (trainingAdminData && trainingAdminData.basePointSettings) || {};

      function readPointForSelection(key, modeCategory) {
        if (!key) return null;
        const raw = settings[key];
        if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
          const v = modeCategory === "expression" ? raw.expression : raw.word;
          if (v != null && String(v).trim() !== "") return String(v);
        } else if (raw != null && String(raw).trim() !== "") {
          return String(raw);
        }
        return null;
      }

      function refreshAnswerOptions() {
        const format = formatEl.value;
        const modeCategory = modeEl ? modeEl.value : "word";
        const answers = combos.filter(function (c) {
          return c.format === format && c.modeCategory === modeCategory;
        });
        ansEl.innerHTML = answers.map(function (a, idx) {
          return `<option value="${escapeHtml(a.ansType)}" data-key="${escapeHtml(a.settingKey)}" data-mode="${escapeHtml(a.modeCategory)}"${idx === 0 ? " selected" : ""}>${escapeHtml(a.ansLabel)}</option>`;
        }).join("");
        syncPointValueFromSelection();
      }

      function syncPointValueFromSelection() {
        const opt = ansEl.options[ansEl.selectedIndex];
        const key = opt ? opt.getAttribute('data-key') : "";
        const modeCategory = modeEl ? modeEl.value : "word";
        const modeLabel = modeCategory === "expression" ? "表現列" : "単語列";
        if (keyEl) keyEl.innerText = key ? ("設定キー: " + key + " / " + modeLabel) : "";
        const stored = readPointForSelection(key, modeCategory);
        if (stored != null && valueEl) valueEl.value = stored;
      }

      formatEl.innerHTML = formatItems.map(function (f, idx) {
        return `<option value="${escapeHtml(f.value)}"${idx === 0 ? " selected" : ""}>${escapeHtml(f.label)}</option>`;
      }).join("");
      formatEl.onchange = refreshAnswerOptions;
      if (modeEl) modeEl.onchange = refreshAnswerOptions;
      ansEl.onchange = syncPointValueFromSelection;
      refreshAnswerOptions();
    }

    function saveTrainingAdminBasePoint(btn) {
      const formatEl = document.getElementById('train-admin-point-format');
      const ansEl = document.getElementById('train-admin-point-answer');
      const modeEl = document.getElementById('train-admin-point-mode');
      const valueEl = document.getElementById('train-admin-point-value');
      if (!formatEl || !ansEl || !valueEl) return;
      const opt = ansEl.options[ansEl.selectedIndex];
      const settingKey = opt ? opt.getAttribute('data-key') : "";
      const modeCategory = modeEl ? modeEl.value : "word";
      const pointValue = valueEl.value;
      if (!settingKey) {
        setTrainingAdminMessage("形式とこたえ方を選んでください", false);
        return;
      }
      const pin = getTrainingAdminPin();
      const saveBtn = btn || document.getElementById('training-admin-point-save-btn');
      const orig = saveBtn ? toggleBtnLoading(saveBtn, true) : null;
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({
        action: "save_training_base_point",
        adminPin: pin,
        settingKey: settingKey,
        modeCategory: modeCategory,
        value: pointValue
      }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          setTrainingAdminMessage(d.message || "保存に失敗しました", false);
          return;
        }
        if (!trainingAdminData.basePointSettings) trainingAdminData.basePointSettings = {};
        const prev = trainingAdminData.basePointSettings[settingKey];
        if (prev != null && typeof prev === "object" && !Array.isArray(prev)) {
          if (modeCategory === "expression") prev.expression = pointValue;
          else prev.word = pointValue;
        } else {
          trainingAdminData.basePointSettings[settingKey] = modeCategory === "expression"
            ? { word: prev != null ? prev : "", expression: pointValue }
            : { word: pointValue, expression: "" };
        }
        invalidateAppSettingsCache();
        const modeLabel = modeCategory === "expression" ? "表現" : "単語";
        setTrainingAdminMessage("点数を保存しました（" + settingKey + " / " + modeLabel + " = " + pointValue + "）", true);
      }).catch(function () { setTrainingAdminMessage("通信エラー", false); })
      .finally(function () {
        if (saveBtn && saveBtn.isConnected) toggleBtnLoading(saveBtn, false, orig);
      });
    }

    function openTrainingAdminRouteEditor(menuId) {
      const menu = getTrainingAdminMenuById(menuId);
      if (!menu) return;
      trainingAdminEditingMenuId = menuId;
      trainingAdminDraftRoutes = cloneTrainingAdminDraftRoutes(menu.routes);
      trainingAdminEditingDraftIdx = null;
      trainingAdminRoutesDirty = false;
      const panel = document.getElementById('training-admin-route-panel');
      const title = document.getElementById('training-admin-route-title');
      if (title) title.innerText = "メニュー" + menuId + " のルート編集";
      renderTrainingAdminRouteList();
      renderTrainingAdminRouteForm(null);
      updateTrainingAdminAddButtonLabel();
      if (panel) {
        panel.style.display = "block";
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    function editTrainingAdminRoute(menuId, draftIdx) {
      if (trainingAdminEditingMenuId !== menuId) return;
      const route = trainingAdminDraftRoutes[draftIdx];
      if (!route) return;
      trainingAdminEditingDraftIdx = draftIdx;
      renderTrainingAdminRouteForm(route);
      updateTrainingAdminAddButtonLabel();
      renderTrainingAdminRouteList();
      setTrainingAdminMessage("リスト " + (draftIdx + 1) + " 番を編集しています（反映するには「リストに反映」）", true);
    }

    function resetTrainingAdminRouteForm() {
      trainingAdminEditingDraftIdx = null;
      renderTrainingAdminRouteForm(null);
      updateTrainingAdminAddButtonLabel();
      renderTrainingAdminRouteList();
      setTrainingAdminMessage("入力をクリアしました", true);
    }

    function readTrainingAdminRouteFormPayload() {
      const unitName = (document.getElementById('train-admin-route-unit') || {}).value || "";
      const formatEl = document.getElementById('train-admin-route-format');
      const ansEl = document.getElementById('train-admin-route-a');
      const formatOpt = formatEl && formatEl.options[formatEl.selectedIndex];
      const ansOpt = ansEl && ansEl.options[ansEl.selectedIndex];
      const qFormat = formatOpt ? (formatOpt.getAttribute('data-qformat') || "") : "";
      const aFormat = ansOpt ? (ansOpt.getAttribute('data-aformat') || "") : "";
      const ansType = ansEl ? ansEl.value : "";
      const blankEl = document.getElementById('train-admin-route-blank');
      const payload = {
        targetUsers: (document.getElementById('train-admin-route-users') || {}).value || "全員",
        unitName: unitName,
        qFormat: qFormat,
        aFormat: aFormat,
        mode: (document.getElementById('train-admin-route-mode') || {}).value || "ランダム",
        blankCount: isLegacyFillBlankAnswerType(ansType) && blankEl ? (blankEl.value || "") : ""
      };
      if (!payload.unitName || !payload.qFormat || !payload.aFormat) {
        setTrainingAdminMessage("単元・問題形式・こたえ方を選んでください", false);
        return null;
      }
      if (!isValidTrainingRouteCombo(payload.unitName, payload.qFormat, payload.aFormat, trainingAdminData.materials)) {
        setTrainingAdminMessage("選んだ組み合わせはこの単元では使えません。形式とこたえ方を確認してください", false);
        return null;
      }
      if (isLegacyFillBlankAnswerType(ansType) && (!payload.blankCount || Number(payload.blankCount) < 1)) {
        setTrainingAdminMessage("穴埋めのときは「隠す文字数」を1以上で入力してください", false);
        return null;
      }
      return payload;
    }

    function addTrainingAdminRouteToDraft() {
      if (!trainingAdminEditingMenuId) return;
      const payload = readTrainingAdminRouteFormPayload();
      if (!payload) return;
      if (trainingAdminEditingDraftIdx != null) {
        trainingAdminDraftRoutes[trainingAdminEditingDraftIdx] = payload;
        setTrainingAdminMessage("リスト " + (trainingAdminEditingDraftIdx + 1) + " 番を更新しました（まだ未保存）", true);
        trainingAdminEditingDraftIdx = null;
      } else {
        trainingAdminDraftRoutes.push(payload);
        setTrainingAdminMessage("リストに追加しました（あと " + (trainingAdminDraftRoutes.length) + " 件・「ルートを保存」で反映）", true);
      }
      trainingAdminRoutesDirty = true;
      updateTrainingAdminAddButtonLabel();
      renderTrainingAdminRouteList();
    }

    function reloadTrainingAdminData(menuIdToReopen, successMsg, keepForm) {
      const pin = getTrainingAdminPin();
      return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") throw new Error(d.message || "再読み込み失敗");
        trainingAdminData = d;
        renderTrainingAdminMenuGrid();
        if (menuIdToReopen) {
          const menu = getTrainingAdminMenuById(menuIdToReopen);
          trainingAdminEditingMenuId = menuIdToReopen;
          trainingAdminDraftRoutes = cloneTrainingAdminDraftRoutes(menu ? menu.routes : []);
          trainingAdminEditingDraftIdx = null;
          trainingAdminRoutesDirty = false;
          const panel = document.getElementById('training-admin-route-panel');
          const title = document.getElementById('training-admin-route-title');
          if (title) title.innerText = "メニュー" + menuIdToReopen + " のルート編集";
          if (panel) panel.style.display = "block";
          renderTrainingAdminRouteList();
          updateTrainingAdminAddButtonLabel();
          if (!keepForm) {
            renderTrainingAdminRouteForm(null);
          }
        }
        if (successMsg) setTrainingAdminMessage(successMsg, true);
        return d;
      });
    }

    function saveTrainingAdminRoutesBatch() {
      if (!trainingAdminEditingMenuId) return;
      const menuId = trainingAdminEditingMenuId;
      const pin = getTrainingAdminPin();
      const btn = document.getElementById('training-admin-route-save-btn');
      const orig = btn ? toggleBtnLoading(btn, true) : null;
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({
        action: "save_training_menu_routes_batch",
        adminPin: pin,
        menuId: menuId,
        routes: trainingAdminDraftRoutes
      }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          setTrainingAdminMessage(d.message || "保存に失敗しました", false);
          return;
        }
        invalidateTrainingRouteCache(menuId);
        return reloadTrainingAdminData(menuId, d.message || "ルートを保存しました", true);
      }).catch(function (e) { setTrainingAdminMessage(e.message || "通信エラー", false); })
      .finally(function () {
        if (btn && btn.isConnected) toggleBtnLoading(btn, false, orig);
      });
    }

    function deleteTrainingAdminRoute(menuId, draftIdx) {
      if (trainingAdminEditingMenuId !== menuId) return;
      if (!confirm("リスト " + (draftIdx + 1) + " 番を削除しますか？（「ルートを保存」するまでスプレッドシートは変わりません）")) return;
      trainingAdminDraftRoutes.splice(draftIdx, 1);
      if (trainingAdminEditingDraftIdx === draftIdx) {
        trainingAdminEditingDraftIdx = null;
        updateTrainingAdminAddButtonLabel();
      } else if (trainingAdminEditingDraftIdx != null && trainingAdminEditingDraftIdx > draftIdx) {
        trainingAdminEditingDraftIdx -= 1;
      }
      trainingAdminRoutesDirty = true;
      renderTrainingAdminRouteList();
      setTrainingAdminMessage("リストから削除しました（「ルートを保存」で反映）", true);
    }

    function getExternalAdminPin() {
      const el = document.getElementById('external-admin-pin-input');
      const v = el ? String(el.value || "").trim() : "";
      return v || parentAdminPinSession || "";
    }

    function loadExternalAdminPending() {
      const pin = getExternalAdminPin();
      const msg = document.getElementById('external-admin-message');
      const listEl = document.getElementById('external-admin-list');
      msg.innerText = "";
      if (!pin) {
        msg.innerText = "PINを入力してください。";
        return;
      }
      listEl.style.display = "none";
      listEl.innerHTML = "<p>よみこみ中...</p>";
      listEl.style.display = "flex";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_pending_external_requests", adminPin: pin }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          listEl.style.display = "none";
          msg.innerText = d.message || "エラー";
          return;
        }
        document.getElementById('external-admin-pin-panel').style.display = "none";
        msg.innerText = "";
        renderExternalAdminList(d.list || [], pin);
      }).catch(() => {
        listEl.style.display = "none";
        msg.innerText = "通信エラーが発生しました。";
      });
    }

    function renderExternalAdminList(list, pin) {
      const listEl = document.getElementById('external-admin-list');
      listEl.style.display = "flex";
      if (list.length === 0) {
        listEl.innerHTML = "<p style='text-align:center;color:#888;'>申請中のものはありません。</p>";
        const retry = document.createElement('button');
        retry.type = "button";
        retry.className = "submit-btn btn-gray";
        retry.innerText = "管理メニューにもどる";
        retry.onclick = () => { backToParentAdminHub(); };
        listEl.appendChild(retry);
        return;
      }
      listEl.innerHTML = "";
      
      const bulkApproveBtn = document.createElement('button');
      bulkApproveBtn.type = "button";
      bulkApproveBtn.className = "submit-btn btn-orange";
      bulkApproveBtn.style.marginBottom = "12px";
      bulkApproveBtn.innerText = "☑の申請を一括で承認";
      bulkApproveBtn.onclick = () => bulkApproveExternalRequests(pin);
      listEl.appendChild(bulkApproveBtn);

      list.forEach(item => {
        const card = document.createElement('div');
        card.className = "external-admin-card";
        card.dataset.rowIdx = item.rowIdx;
        card.style.cssText = "background:#2a2a2a;border-radius:12px;padding:14px;border:1px solid #444;position:relative;";
        card.innerHTML = `<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
            <input type="checkbox" class="external-bulk-check" style="transform:scale(1.5);margin-top:4px;" checked>
            <div style="flex:1;">
              <div style="font-weight:bold;margin-bottom:6px;">${item.userName} <span style="font-size:12px;color:#aaa;">(${item.userId})</span></div>
              <div style="font-size:15px;margin-bottom:4px;">${item.category || ""} / ${item.volume || ""}</div>
              <div style="color:gold;margin-bottom:8px;">+${item.points} Pt</div>
              <div style="font-size:12px;color:#888;margin-bottom:6px;">${item.requestedAt}</div>
              ${item.childMemo ? `<div style="font-size:13px;color:#ddd;margin-bottom:8px;">こどもメモ: ${item.childMemo}</div>` : ""}
            </div>
          </label>
          <textarea class="external-admin-memo" rows="2" placeholder="おとなメモ（任意）" style="width:100%;box-sizing:border-box;border-radius:8px;padding:8px;background:#222;color:#fff;border:1px solid #555;margin-bottom:8px;margin-top:8px;"></textarea>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="submit-btn btn-green" style="flex:1;min-width:100px;">承認する</button>
            <button type="button" class="cancel-btn" style="flex:1;min-width:100px;background:#663333;color:#fcc;">却下</button>
          </div>`;
        const btns = card.querySelectorAll('button');
        const memoField = card.querySelector('.external-admin-memo');
        btns[0].onclick = () => decideExternalRequest(item.rowIdx, pin, true, memoField ? memoField.value : "");
        btns[1].onclick = () => decideExternalRequest(item.rowIdx, pin, false, memoField ? memoField.value : "");
        listEl.appendChild(card);
      });
      const back = document.createElement('button');
      back.type = "button";
      back.className = "submit-btn btn-gray";
      back.style.marginTop = "8px";
      back.innerText = "管理メニューにもどる";
      back.onclick = () => { backToParentAdminHub(); };
      listEl.appendChild(back);
    }

    function decideExternalRequest(rowIdx, pin, approve, memo = "") {
      if (!confirm(approve ? "この申請を承認してポイントを付与しますか？" : "この申請を却下しますか？")) return;
      const action = approve ? "approve_external_request" : "reject_external_request";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, adminPin: pin, rowIdx: rowIdx, adminMemo: memo }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          alert(d.message || "エラー");
          return;
        }
        alert(d.message);
        const user = JSON.parse(localStorage.getItem('app_kid_user') || "{}");
        if (approve && d.userId && user.id === d.userId && typeof d.newTotal === "number") {
          user.points = d.newTotal;
          saveAppKidUserToLocal(user);
          const pts = document.getElementById('user-points');
          if (pts) pts.innerText = user.points;
        }
        loadExternalAdminPendingAfterPin(pin);
      }).catch(() => alert("通信エラーが発生しました。"));
    }

    function bulkApproveExternalRequests(pin) {
      const listEl = document.getElementById('external-admin-list');
      const cards = Array.from(listEl.querySelectorAll('.external-admin-card'));
      const requestsToApprove = [];
      
      cards.forEach(card => {
        const checkbox = card.querySelector('.external-bulk-check');
        if (checkbox && checkbox.checked) {
          const rowIdx = card.dataset.rowIdx;
          const memoField = card.querySelector('.external-admin-memo');
          requestsToApprove.push({
            rowIdx: rowIdx,
            adminMemo: memoField ? memoField.value : ""
          });
        }
      });

      if (requestsToApprove.length === 0) {
        alert("選択された申請がありません。");
        return;
      }

      if (!confirm(`選択された ${requestsToApprove.length} 件の申請を一括で承認してポイントを付与しますか？`)) return;

      const action = "bulk_approve_external_requests";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, adminPin: pin, requests: requestsToApprove }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          alert(d.message || "エラー");
          return;
        }
        alert(d.message);
        const user = JSON.parse(localStorage.getItem('app_kid_user') || "{}");
        if (d.userPointsUpdates && user.id && typeof d.userPointsUpdates[user.id] === "number") {
          user.points = d.userPointsUpdates[user.id];
          saveAppKidUserToLocal(user);
          const pts = document.getElementById('user-points');
          if (pts) pts.innerText = user.points;
        }
        loadExternalAdminPendingAfterPin(pin);
      }).catch(() => alert("通信エラーが発生しました。"));
    }

    function loadExternalAdminPendingAfterPin(pin) {
      const msg = document.getElementById('external-admin-message');
      const listEl = document.getElementById('external-admin-list');
      msg.innerText = "";
      listEl.innerHTML = "<p>更新中...</p>";
      listEl.style.display = "flex";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_pending_external_requests", adminPin: pin }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          msg.innerText = d.message || "エラー";
          listEl.innerHTML = "";
          return;
        }
        renderExternalAdminList(d.list || [], pin);
      }).catch(() => { msg.innerText = "通信エラー"; });
    }

    const USER_PREF_KANJI_HW_DOMINANT = 'kanji_quiz_hw_dominant_hand';
    function getKanjiHwDominantHand() {
      const v = getUserPref(USER_PREF_KANJI_HW_DOMINANT, null);
      return v === 'left' ? 'left' : 'right';
    }
    function applyKanjiHwDominantHandToBody() {
      document.body.classList.toggle('kanji-hw-dominant-left', getKanjiHwDominantHand() === 'left');
    }
    function syncKanjiHwHandSwitchUI() {
      const lefty = getKanjiHwDominantHand() === 'left';
      const bR = document.getElementById('kanji-hw-hand-right');
      const bL = document.getElementById('kanji-hw-hand-left');
      if (bR) {
        bR.classList.toggle('active', !lefty);
        bR.setAttribute('aria-pressed', !lefty ? 'true' : 'false');
      }
      if (bL) {
        bL.classList.toggle('active', lefty);
        bL.setAttribute('aria-pressed', lefty ? 'true' : 'false');
      }
    }
    function setKanjiHwDominantHand(which) {
      setUserPref(USER_PREF_KANJI_HW_DOMINANT, which === 'left' ? 'left' : 'right');
      applyKanjiHwDominantHandToBody();
      syncKanjiHwHandSwitchUI();
    }

    // （いつもの学習のロード関連）
    function openKanjiLearningMenu() {
      switchSection('section-kanji-learning');
      applyKanjiHwDominantHandToBody();
      syncKanjiHwHandSwitchUI();
      renderKanjiResumePanel();
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      promptKanjiQuizResumeIfNeeded(user);
    }
    function loadEnglishMaterials(btn) {
      currentMaterialsCategory = "english";
      loadMaterialsByFilter(btn, "english");
    }
    function loadKanjiMaterials(btn) {
      currentMaterialsCategory = "kanji";
      loadMaterialsByFilter(btn, "kanji");
    }
    function backFromMaterials() {
      if (currentMaterialsCategory === "kanji") {
        openKanjiLearningMenu();
        return;
      }
      showHome(JSON.parse(localStorage.getItem('app_kid_user')));
    }
    let kpCatalogState = {
      materials: [],
      sets: [],
      setQuestions: [],
      filteredChars: [],
      loaded: false
    };
    function kpCacheKeySets(modeId, unitName) {
      return `app_cached_kp_sets_${modeId}_${unitName}`;
    }
    function kpCacheKeyQuestions(modeId, unitName, setId) {
      return `app_cached_kp_questions_${modeId}_${unitName}_${setId}`;
    }
    function kpGetCachedJson(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }
    function kpSetCachedJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    }
    let __knKpSyncLock = false;
    function syncKnSelectorsFromKp() {
      if (__knKpSyncLock) return;
      const knb = document.getElementById("kn-book-select");
      if (!knb) return;
      __knKpSyncLock = true;
      try {
        const kpb = document.getElementById("kp-book-select");
        const kpsh = document.getElementById("kp-sheet-select");
        const kpst = document.getElementById("kp-set-select");
        const knsh = document.getElementById("kn-sheet-select");
        const knst = document.getElementById("kn-set-select");
        if (kpb && knb) {
          knb.innerHTML = kpb.innerHTML;
          knb.value = kpb.value;
        }
        if (kpsh && knsh) {
          const prevSheet = knsh.value === "__ALL__" ? "__ALL__" : knsh.value;
          knsh.innerHTML =
            '<option value="__ALL__">すべてのシート</option>' + kpsh.innerHTML;
          if (!prevSheet || prevSheet === "__ALL__") {
            knsh.value = "__ALL__";
          } else if (Array.from(knsh.options).some(function (o) { return o.value === prevSheet; })) {
            knsh.value = prevSheet;
          } else {
            knsh.value = "__ALL__";
          }
        }
        if (kpst && knst) {
          const prev = knst.value === "__ALL__" ? "__ALL__" : knst.value;
          knst.innerHTML =
            '<option value="__ALL__">このシートの全セット</option>' + kpst.innerHTML;
          if (prev === "__ALL__") knst.value = "__ALL__";
          else if (Array.from(knst.options).some(function (o) { return o.value === prev; })) knst.value = prev;
          else knst.value = kpst.value || "__ALL__";
        }
      } finally {
        __knKpSyncLock = false;
      }
    }
    function knOnBookChange() {
      const bsel = document.getElementById("kn-book-select");
      const ssel = document.getElementById("kn-sheet-select");
      if (!bsel || !ssel) return;
      const modeId = bsel.value;
      const mat = kpCatalogState.materials.find(function (m) { return String(m.modeId) === String(modeId); });
      const units = mat && Array.isArray(mat.units) ? mat.units : [];
      if (!units.length) {
        ssel.innerHTML = '<option value="">シートなし</option>';
        return;
      }
      ssel.innerHTML =
        '<option value="__ALL__">すべてのシート</option>' +
        units.map(function (u) {
          return `<option value="${escapeHtml(u)}">${escapeHtml(formatUnitSheetDisplayLabel(u))}</option>`;
        }).join("");
      ssel.value = "__ALL__";
      knOnSheetChange();
    }
    function knOnSheetChange() {
      const bsel = document.getElementById("kn-book-select");
      const ssel = document.getElementById("kn-sheet-select");
      const setSel = document.getElementById("kn-set-select");
      if (!bsel || !ssel || !setSel) return;
      const modeId = bsel.value;
      const unitName = ssel.value;
      if (unitName === "__ALL__") {
        setSel.innerHTML = '<option value="__ALL__">すべてのセット</option>';
        setSel.value = "__ALL__";
        return;
      }
      setSel.innerHTML = '<option value="">セット読み込み中...</option>';
      const setsKey = kpCacheKeySets(modeId, unitName);
      const cachedSets = kpGetCachedJson(setsKey);
      if (cachedSets && cachedSets.status === "success" && Array.isArray(cachedSets.sets)) {
        if (!cachedSets.sets.length) {
          setSel.innerHTML = '<option value="">セットなし</option>';
          return;
        }
        setSel.innerHTML =
          '<option value="__ALL__">このシートの全セット</option>' +
          cachedSets.sets.map(function (s) {
            return `<option value="${escapeHtml(String(s.setId || ""))}">セット ${escapeHtml(String(s.setId || ""))}（${escapeHtml(String(s.count || 0))}字）</option>`;
          }).join("");
        setSel.value = "__ALL__";
        return;
      }
      fetch(GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "get_kanji_quiz_sets", modeId: modeId, unitName: unitName }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status !== "success") throw new Error(d.message || "セット取得失敗");
          const sets = Array.isArray(d.sets) ? d.sets : [];
          if (!sets.length) {
            setSel.innerHTML = '<option value="">セットなし</option>';
            return;
          }
          setSel.innerHTML =
            '<option value="__ALL__">このシートの全セット</option>' +
            sets.map(function (s) {
              return `<option value="${escapeHtml(String(s.setId || ""))}">セット ${escapeHtml(String(s.setId || ""))}（${escapeHtml(String(s.count || 0))}字）</option>`;
            }).join("");
          setSel.value = "__ALL__";
        })
        .catch(function () {
          setSel.innerHTML = '<option value="">セット取得失敗</option>';
        });
    }
    function knOnSetChange() {}
    function openKanjiNigateSection() {
      initKanjiPracticeCatalog();
      initKanjiHandAnalyticsBridge();
      initKanjiParentKanjiQuizScoredBridge();
      setTimeout(function () {
        syncKnSelectorsFromKp();
        const knsh = document.getElementById("kn-sheet-select");
        if (knsh && Array.from(knsh.options).some(function (o) { return o.value === "__ALL__"; })) {
          knsh.value = "__ALL__";
          knOnSheetChange();
        }
        const kna = document.getElementById("kn-nigate-axis");
        if (kna) {
          const fmt = getKanjiQuizFormatMode();
          if (Array.from(kna.options).some(function (o) { return o.value === fmt; })) {
            kna.value = fmt;
          }
        }
        switchSection("section-kanji-nigate");
      }, 120);
    }
    function mapNigateAxisToKanjiQuizFormatMode(axis) {
      const m = String(axis || "");
      if (m === "write_kanji" || m === "ruby_to_kanji" || m === "brush") return "write_kanji";
      if (m === "select_kana" || m === "okurigana_shift") return "select_kana";
      if (m === "type_yomi" || m === "sentence_to_ruby" || m === "reading") return "type_yomi";
      if (m === "stroke_order" || m === "stroke_order_trace") return "stroke_order";
      if (m === "jukugo_yomi") return "jukugo_yomi";
      return "write_kanji";
    }
    var KANJI_NIGATE_PASS_REQUIRED = 1;
    function startKanjiNigateReviewFromUi() {
      const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!user || !user.id) {
        alert("ログインしてください。");
        return;
      }
      const b = document.getElementById("kn-book-select");
      const u = document.getElementById("kn-sheet-select");
      const s = document.getElementById("kn-set-select");
      const ax = document.getElementById("kn-nigate-axis");
      if (!b || !u || !s || !ax) return;
      const modeId = b.value;
      const unitName = u.value;
      const allSheets = unitName === "__ALL__";
      if (!modeId || (!allSheets && !unitName)) {
        alert("ブックとシートをえらんでください。");
        return;
      }
      const setVal = s.value;
      if (!setVal) {
        alert("セットをえらんでください。");
        return;
      }
      var setIds = setVal === "__ALL__" ? [] : [setVal];
      const nigateAxis = ax.value;
      fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "get_kanji_weak_review_plan",
          userId: user.id,
          modeId: modeId,
          unitName: allSheets ? "__ALL__" : unitName,
          allSheets: allSheets,
          setIds: setIds,
          nigateAxis: nigateAxis,
          passRequired: KANJI_NIGATE_PASS_REQUIRED,
          limit: 12
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || d.status !== "success") {
            alert((d && d.message) || "取得に失敗しました。");
            return;
          }
          if (!d.questions || !d.questions.length) {
            alert(
              d.message ||
                "この条件ではもんだいがありません。先に通常のクイズ・練習で学習して、よわみデータをためましょう。"
            );
            return;
          }
          const mat = kpCatalogState.materials.find(function (m) { return String(m.modeId) === String(modeId); });
          const quizFormat = mapNigateAxisToKanjiQuizFormatMode(d.trainMode || nigateAxis);
          startKanjiQuizPlay({
            modeId: modeId,
            modeName: mat ? mat.modeName || modeId : modeId,
            unitName: allSheets ? "すべてのシート" : unitName,
            setId: setVal === "__ALL__" ? "ALL" : setVal,
            questions: d.questions,
            nigateBypassFilter: true,
            nigateTraining: true,
            nigateAxis: d.trainMode || nigateAxis,
            nigatePassRequired: d.passRequired || KANJI_NIGATE_PASS_REQUIRED,
            formatMode: quizFormat
          });
        })
        .catch(function () {
          alert("通信エラーが発生しました。");
        });
    }
    function initKanjiHandAnalyticsBridge() {
      if (window.__kanjiHandAnalyticsBridgeBound) return;
      window.__kanjiHandAnalyticsBridgeBound = true;
      var t = null;
      var pending = null;
      function flush() {
        if (!pending) return;
        var sig = pending;
        pending = null;
        var kid = JSON.parse(localStorage.getItem("app_kid_user") || "null");
        if (!kid || !kid.id) return;
        var q =
          kanjiQuizSession && kanjiQuizSession.questions
            ? kanjiQuizSession.questions[kanjiQuizSession.index]
            : null;
        var quizSec = document.getElementById("section-kanji-quiz-play");
        if (quizSec && quizSec.classList.contains("active") && kanjiQuizSession) {
          sig.modeId = kanjiQuizSession.modeId;
          sig.unitName = kanjiQuizSession.unitName;
          sig.setId = q && q.nigateSourceSetId ? String(q.nigateSourceSetId) : String(kanjiQuizSession.setId || "");
          if (sig.setId === "ALL") sig.setId = q && q.nigateSourceSetId ? String(q.nigateSourceSetId) : "";
          sig.questionId = q && q.questionId ? q.questionId : undefined;
        } else {
          var prac = document.getElementById("section-kanji-practice");
          if (prac && prac.classList.contains("active")) {
            var bEl = document.getElementById("kp-book-select");
            var uEl = document.getElementById("kp-sheet-select");
            var sEl = document.getElementById("kp-set-select");
            sig.modeId = (bEl && bEl.value) || "";
            sig.unitName = (uEl && uEl.value) || "";
            sig.setId = (sEl && sEl.value) || "";
            sig.questionId = undefined;
          }
        }
        if (!sig.modeId || !sig.unitName || !sig.setId || !sig.kanjiChar) return;
        if (kanjiQuizSession && kanjiQuizSession.nigateTraining) {
          if (!kanjiQuizSession.nigateFeedback) {
            kanjiQuizSession.nigateFeedback = { strokeOrderClean: true, brushAllClear: true };
          }
          if (sig.hasStrokeOrderIssue) kanjiQuizSession.nigateFeedback.strokeOrderClean = false;
          if (sig.brushEndingAllOk === false) kanjiQuizSession.nigateFeedback.brushAllClear = false;
        }
        fetch(GAS_API_URL, {
          method: "POST",
          body: JSON.stringify({ action: "append_kanji_weak_signals", userId: kid.id, signals: [sig] })
        }).catch(function () {});
      }
      window.addEventListener("message", function (ev) {
        if (!ev || !ev.data || ev.data.type !== "kanjiQuizHandAnalytics") return;
        if (!isKanjiQuizScoreFramePostMessage_(ev)) return;
        var d = ev.data;
        try {
          if (d.breakdown) renderKanjiHwScoreStatus_(d.breakdown, d.handScore);
        } catch (_eAn) {}
        pending = {
          at: new Date().toISOString(),
          kanjiChar: String(d.kanjiChar || ""),
          hasStrokeOrderIssue: !!d.hasStrokeOrderIssue,
          brushEndingAllOk: d.brushEndingAllOk !== false,
          strokeCountMismatch: !!d.strokeCountMismatch,
          readingMistake: false,
          handScore: typeof d.handScore === "number" ? d.handScore : undefined,
          passedThreshold: !!d.passedThreshold
        };
        if (t) clearTimeout(t);
        t = setTimeout(flush, 420);
      });
    }
    function queueKanjiStrokeCountWeakSignal() {
      if (!kanjiQuizSession) return;
      var kid = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!kid || !kid.id) return;
      var q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q) return;
      var setId = q.nigateSourceSetId ? String(q.nigateSourceSetId) : String(kanjiQuizSession.setId || "");
      if (!setId || setId === "ALL") return;
      fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "append_kanji_weak_signals",
          userId: kid.id,
          signals: [
            {
              at: new Date().toISOString(),
              modeId: kanjiQuizSession.modeId,
              unitName: kanjiQuizSession.unitName,
              setId: setId,
              kanjiChar: String(q.kanji || ""),
              questionId: q.questionId,
              strokeCountQuizWrong: true,
              hasStrokeOrderIssue: false,
              brushEndingAllOk: true,
              strokeCountMismatch: false,
              readingMistake: false
            }
          ]
        })
      }).catch(function () {});
    }
    function queueKanjiReadingWeakSignal() {
      if (!kanjiQuizSession) return;
      var kid = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!kid || !kid.id) return;
      var q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q) return;
      var setId = q.nigateSourceSetId ? String(q.nigateSourceSetId) : String(kanjiQuizSession.setId || "");
      if (!setId || setId === "ALL") return;
      fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "append_kanji_weak_signals",
          userId: kid.id,
          signals: [
            {
              at: new Date().toISOString(),
              modeId: kanjiQuizSession.modeId,
              unitName: kanjiQuizSession.unitName,
              setId: setId,
              kanjiChar: String(q.kanji || ""),
              questionId: q.questionId,
              readingMistake: true,
              hasStrokeOrderIssue: false,
              brushEndingAllOk: true,
              strokeCountMismatch: false
            }
          ]
        })
      }).catch(function () {});
    }
    function isKanjiQuizHandwritingQuestionType_(type) {
      return type === "ruby_to_kanji" || type === "stroke_order_trace";
    }
    /** 判定パネル＋4秒自動「次へ」対象（手書き・書き順を除く） */
    function isKanjiQuizVerdictRailType_(type) {
      return !isKanjiQuizHandwritingQuestionType_(type);
    }
    function isJukugoYomiQuizCorrect_(q, userRaw) {
      if (!q || userRaw == null || userRaw === "") return false;
      const choice = String(userRaw);
      if (choice === JUKUGO_NONE_ANSWER_) {
        return q.correctAnswer === JUKUGO_NONE_ANSWER_ || !!q.noneIsCorrect;
      }
      const normUser = normalizeKanjiQuizInput(choice);
      if (normalizeKanjiQuizInput(q.correctAnswer) === normUser) return true;
      if (Array.isArray(q.correctReadings)) {
        return q.correctReadings.some(function (r) {
          return normalizeKanjiQuizInput(r) === normUser;
        });
      }
      return false;
    }
    function queueKanjiHandwritingWeakSignalForQuestion(q, handScore) {
      if (!kanjiQuizSession || !q) return;
      if (!isKanjiQuizHandwritingQuestionType_(q.type)) return;
      var kid = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!kid || !kid.id) return;
      var setId = q.nigateSourceSetId ? String(q.nigateSourceSetId) : String(kanjiQuizSession.setId || "");
      if (!setId || setId === "ALL") return;
      fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "append_kanji_weak_signals",
          userId: kid.id,
          signals: [{
            at: new Date().toISOString(),
            modeId: kanjiQuizSession.modeId,
            unitName: kanjiQuizSession.unitName,
            setId: setId,
            kanjiChar: String(q.kanji || ""),
            questionId: q.questionId,
            handwritingFail: true,
            questionType: q.type || "ruby_to_kanji",
            handScore: handScore,
            hasStrokeOrderIssue: false,
            brushEndingAllOk: true,
            strokeCountMismatch: false,
            readingMistake: false
          }]
        })
      }).catch(function () {});
    }
    function kanjiQuizCloneQuestionForNigate(q) {
      if (!q) return null;
      try {
        return JSON.parse(JSON.stringify(q));
      } catch (e) {
        return null;
      }
    }
    function kanjiQuizRequeueForNigate(q, passCount, passRequired) {
      if (!kanjiQuizSession || !q) return;
      const need = passRequired || kanjiQuizSession.nigatePassRequired || KANJI_NIGATE_PASS_REQUIRED;
      const cnt = passCount != null ? Number(passCount) : 0;
      if (cnt >= need) return;
      const clone = kanjiQuizCloneQuestionForNigate(q);
      if (!clone) return;
      clone.nigatePassCount = cnt;
      clone.nigatePassRequired = need;
      kanjiQuizSession.questions.push(clone);
    }
    function recordKanjiNigatePassRemote(q, onDone) {
      const kid = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!kid || !kid.id || !kanjiQuizSession || !q) {
        if (onDone) onDone(null);
        return;
      }
      const setId = q.nigateSourceSetId ? String(q.nigateSourceSetId) : String(kanjiQuizSession.setId || "");
      if (!setId || setId === "ALL") {
        if (onDone) onDone(null);
        return;
      }
      fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_kanji_nigate_pass",
          userId: kid.id,
          modeId: kanjiQuizSession.modeId,
          unitName: kanjiQuizSession.unitName,
          setId: setId,
          kanji: String(q.kanji || ""),
          trainMode: kanjiQuizSession.nigateAxis || "ruby_to_kanji",
          nigateAxis: kanjiQuizSession.nigateAxis || "ruby_to_kanji",
          passRequired: kanjiQuizSession.nigatePassRequired || KANJI_NIGATE_PASS_REQUIRED
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (onDone) onDone(d); })
        .catch(function () { if (onDone) onDone(null); });
    }
    function kanjiQuizHandleNigateAfterScore(q, isCorrect, scoreForServer, advanceCallback) {
      if (!kanjiQuizSession || !kanjiQuizSession.nigateTraining) {
        advanceCallback();
        return;
      }
      const passRequired = kanjiQuizSession.nigatePassRequired || KANJI_NIGATE_PASS_REQUIRED;
      const passed = isCorrect && Number(scoreForServer) >= KANJI_QUIZ_HAND_PASS;
      if (!passed) {
        if (q && isKanjiQuizHandwritingQuestionType_(q.type)) {
          queueKanjiHandwritingWeakSignalForQuestion(q, scoreForServer);
        }
        kanjiQuizRequeueForNigate(q, q && q.nigatePassCount != null ? q.nigatePassCount : 0, passRequired);
        advanceCallback();
        return;
      }
      recordKanjiNigatePassRemote(q, function (d) {
        let passCount = (q && q.nigatePassCount != null) ? Number(q.nigatePassCount) : 0;
        if (d && d.status === "success" && d.passCount != null) {
          passCount = Number(d.passCount);
          if (q) q.nigatePassCount = passCount;
        } else {
          passCount += 1;
          if (q) q.nigatePassCount = passCount;
        }
        if (passCount < passRequired) {
          kanjiQuizRequeueForNigate(q, passCount, passRequired);
        }
        advanceCallback();
      });
    }
    function openKanjiPractice() {
      switchSection('section-kanji-practice');
      openKanjiPracticePro();
      initKanjiPracticeScoreListener();
      initKanjiPracticeCatalog();
      try {
        const warmed = kpWarmSearchIndexFromCache_();
        if (warmed) kpSetSearchStatus_("セットキャッシュから検索準備（" + warmed + " 字）");
      } catch (_eWarm) {}
      try { kpScheduleSearchIndexPrefetch_(); } catch (_ePref) {}
      try { kpEnsureKanjiVgMap_(); } catch (_eVg) {}
    }
    /** 漢字練習画面用: iframe 採点メッセージの受け口は initKanjiParentKanjiQuizScoredBridge と共有 */
    function initKanjiPracticeScoreListener() {
      initKanjiParentKanjiQuizScoredBridge();
      initKanjiHandAnalyticsBridge();
    }
    function getKanjiQuizScoreFrame() {
      return document.getElementById("kp-pro-frame");
    }
    function getKanjiQuizWrongModelFrame() {
      return document.getElementById("kp-pro-frame-wrong");
    }
    function isKanjiQuizScoreFramePostMessage_(ev) {
      if (!ev) return false;
      var wrongFrame = getKanjiQuizWrongModelFrame();
      if (wrongFrame && wrongFrame.contentWindow && ev.source === wrongFrame.contentWindow) return false;
      var scoreFrame = getKanjiQuizScoreFrame();
      if (!scoreFrame || !scoreFrame.contentWindow) return false;
      return ev.source === scoreFrame.contentWindow;
    }
    function openKanjiKpEmbedFrame_(frame, opts) {
      opts = opts || {};
      if (!frame) {
        if (opts.alertOnMissing !== false) {
          try { alert("高機能モードの読み込みに失敗しました。"); } catch (_e) {}
        }
        return;
      }
      const KP_EMBED_VER = opts.embedVer || "13";
      const KP_SRC = opts.src || "assets/kp-practice.html";
      const onReady =
        typeof opts.onReady === "function"
          ? opts.onReady
          : function () {
              syncKanjiHandScoreWeightsToFrame(frame);
              patchKanjiFrameForQuizPostMessage(frame);
              kpResizeFrameToContent(frame);
            };
      if (frame.dataset.kpEmbedVer !== KP_EMBED_VER) {
        frame.dataset.kpLoaded = "";
        frame.dataset.kpEmbedVer = KP_EMBED_VER;
      }
      if (frame.dataset.kpLoaded === "1") {
        onReady();
        return;
      }
      if (frame.dataset.kpLoading === "1") return;
      frame.dataset.kpLoading = "1";
      delete frame.dataset.kanjiQuizPatched;
      let settled = false;
      function markFailed(detail) {
        if (settled) return;
        settled = true;
        frame.dataset.kpLoading = "";
        frame.dataset.kpLoaded = "";
        if (opts.alertOnMissing !== false) {
          try {
            alert("高機能モードの読み込みに失敗しました。" + (detail ? "\n（" + detail + "）" : ""));
          } catch (_eA) {}
        }
      }
      function markReady() {
        if (settled) return;
        settled = true;
        frame.dataset.kpLoading = "";
        frame.dataset.kpLoaded = "1";
        onReady();
      }
      function onKpEmbedLoad() {
        frame.removeEventListener("load", onKpEmbedLoad);
        try {
          const doc = frame.contentDocument;
          const href = String((frame.contentWindow && frame.contentWindow.location && frame.contentWindow.location.href) || "");
          if (!doc || !doc.body || href.indexOf("kp-practice.html") < 0) {
            markFailed("練習画面ファイルを開けませんでした");
            return;
          }
          markReady();
        } catch (_eLoad) {
          markReady();
        }
      }
      frame.addEventListener("load", onKpEmbedLoad);
      frame.addEventListener("error", function onKpEmbedErr() {
        frame.removeEventListener("error", onKpEmbedErr);
        markFailed(KP_SRC + " の取得に失敗");
      });
      setTimeout(function () {
        if (!settled && frame.dataset.kpLoading === "1") {
          markFailed("読み込みがタイムアウトしました。ページを再読み込みしてください。");
        }
      }, 15000);
      try {
        frame.src = KP_SRC + "?v=" + encodeURIComponent(KP_EMBED_VER);
      } catch (_eSrc) {
        markFailed(String(_eSrc && _eSrc.message ? _eSrc.message : _eSrc));
      }
      setTimeout(function () {
        if (frame.dataset.kpLoaded === "1") onReady();
      }, 700);
    }
    function openKanjiPracticePro() {
      openKanjiKpEmbedFrame_(getKanjiQuizScoreFrame());
    }
    function openKanjiWrongModelFramePro() {
      openKanjiKpEmbedFrame_(getKanjiQuizWrongModelFrame(), {
        alertOnMissing: false,
        onReady: function () {
          patchKanjiWrongModelFramePostMessage(getKanjiQuizWrongModelFrame());
          kpResizeFrameToContent(getKanjiQuizWrongModelFrame());
        }
      });
    }
    function kpFrameInWrongModelWrap_(frame) {
      return frame && frame.parentElement && frame.parentElement.id === "kanji-quiz-wrong-model-wrap";
    }
    /** お手本覗き窓：iframe を wrap 高に固定し、スクロールは iframe 内 document のみ */
    function kpApplyWrongModelFrameFill_(frame) {
      if (!frame || !kpFrameInWrongModelWrap_(frame)) return;
      frame.style.width = "100%";
      frame.style.maxWidth = "100%";
      frame.style.height = "100%";
      frame.style.minHeight = "0";
      frame.style.maxHeight = "100%";
      frame.style.overflow = "hidden";
      frame.setAttribute("scrolling", "no");
    }
    /** お手本覗き窓の目標高さ（潰れた clientHeight を信じない） */
    function kpWrongModelWrapTargetHeight_(wrap) {
      var minH = Math.max(400, Math.min(500, Math.floor(window.innerHeight * 0.52)));
      var maxH = Math.max(minH, Math.floor(window.innerHeight * 0.68));
      var w = 0;
      var measured = 0;
      try {
        if (wrap) {
          w = wrap.clientWidth || 0;
          measured = wrap.clientHeight || 0;
        }
      } catch (_e) {}
      /* 幅＋ボタン帯を見込んだ高さ。計測値が下限未満なら無視（2問目以降の潰れた値対策） */
      var byWidth = w > 40 ? Math.max(minH, Math.min(maxH, w + 210)) : minH;
      var byMeasured = measured >= minH ? Math.min(maxH, measured) : 0;
      return Math.max(minH, byWidth, byMeasured);
    }
    function kpForceWrongPanelCanvasSquare_(frame) {
      try {
        if (!frame || !frame.contentDocument) return;
        var canvas = frame.contentDocument.getElementById("canvas");
        if (!canvas) return;
        var wrap = frame.parentElement;
        var wrapW = wrap && wrap.clientWidth ? wrap.clientWidth : 320;
        var side = Math.max(180, Math.min(260, Math.floor(wrapW * 0.82)));
        canvas.style.setProperty("width", side + "px", "important");
        canvas.style.setProperty("height", side + "px", "important");
        canvas.style.setProperty("max-width", side + "px", "important");
        canvas.style.setProperty("max-height", side + "px", "important");
        canvas.style.setProperty("min-width", side + "px", "important");
        canvas.style.setProperty("min-height", side + "px", "important");
        canvas.style.setProperty("aspect-ratio", "1 / 1", "important");
        canvas.style.setProperty("box-sizing", "border-box", "important");
      } catch (_e) {}
    }
    function kpFrameInStrokeOrderPlaySlot_(frame) {
      return frame && frame.parentElement && frame.parentElement.id === "kanji-stroke-order-play-slot";
    }
    function kpFrameInPracticeSlot_(frame) {
      return !!(frame && frame.parentElement && frame.parentElement.id === "kp-iframe-slot-practice");
    }
    function kpMeasurePracticeContentHeight_(frame) {
      try {
        const doc = frame.contentWindow && frame.contentWindow.document;
        if (!doc || !doc.body) return 0;
        let maxBottom = 0;
        Array.prototype.forEach.call(doc.body.children, function (el) {
          if (!el || !el.getBoundingClientRect) return;
          const id = el.id || "";
          if (id === "loading-overlay" || id === "settings-modal" || id === "wizard-modal") return;
          let hidden = false;
          try {
            const st = frame.contentWindow.getComputedStyle(el);
            if (st && (st.display === "none" || st.visibility === "hidden")) hidden = true;
          } catch (_eSt) {}
          if (hidden) return;
          const top = Number(el.offsetTop) || 0;
          const h = Number(el.offsetHeight) || 0;
          maxBottom = Math.max(maxBottom, top + h);
        });
        return maxBottom > 80 ? maxBottom + 28 : 0;
      } catch (_e) {
        return 0;
      }
    }
    function kpComputeFrameHeight_(frame, bodyH, htmlH) {
      if (kpFrameInStrokeOrderPlaySlot_(frame)) {
        const slot = frame.parentElement;
        const slotH = slot ? slot.clientHeight || 0 : 0;
        if (slotH > 0) return slotH;
        return Math.min(Math.max(bodyH, htmlH, 280), 360);
      }
      if (kpFrameInWrongModelWrap_(frame)) {
        return kpWrongModelWrapTargetHeight_(frame.parentElement);
      }
      if (kpFrameInPracticeSlot_(frame)) {
        const measured = kpMeasurePracticeContentHeight_(frame);
        const raw = Math.max(measured, bodyH || 0, htmlH || 0, 520);
        const viewportCap = Math.max(520, Math.floor(window.innerHeight * 0.88));
        return Math.min(raw, viewportCap);
      }
      return Math.max(bodyH, htmlH, 620) + 8;
    }
    function kpPinStrokePlayCanvasOnly_(frame) {
      try {
        if (!frame) return false;
        const doc = frame.contentDocument;
        if (!doc || !doc.body || !doc.documentElement) return false;
        const canvas = doc.getElementById("canvas");
        if (!canvas) return false;
        doc.documentElement.style.setProperty("margin", "0", "important");
        doc.documentElement.style.setProperty("padding", "0", "important");
        doc.documentElement.style.setProperty("overflow", "hidden", "important");
        doc.documentElement.style.setProperty("width", "100%", "important");
        doc.documentElement.style.setProperty("height", "100%", "important");
        doc.body.style.setProperty("margin", "0", "important");
        doc.body.style.setProperty("margin-top", "0", "important");
        doc.body.style.setProperty("padding", "0", "important");
        doc.body.style.setProperty("overflow", "hidden", "important");
        doc.body.style.setProperty("width", "100%", "important");
        doc.body.style.setProperty("height", "100%", "important");
        doc.body.style.setProperty("transform", "none", "important");
        doc.body.style.setProperty("display", "block", "important");
        doc.body.style.setProperty("position", "relative", "important");
        doc.body.style.setProperty("background", "#fff", "important");
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        Array.prototype.forEach.call(doc.body.children, function (el) {
          if (el === canvas) return;
          el.setAttribute("data-kp-stroke-hidden", "1");
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
          el.style.setProperty("pointer-events", "none", "important");
          el.style.setProperty("height", "0", "important");
          el.style.setProperty("max-height", "0", "important");
          el.style.setProperty("margin", "0", "important");
          el.style.setProperty("padding", "0", "important");
          el.style.setProperty("overflow", "hidden", "important");
          el.style.setProperty("position", "absolute", "important");
          el.style.setProperty("left", "-9999px", "important");
        });
        canvas.style.setProperty("display", "block", "important");
        canvas.style.setProperty("visibility", "visible", "important");
        canvas.style.setProperty("pointer-events", "auto", "important");
        canvas.style.setProperty("position", "absolute", "important");
        canvas.style.setProperty("left", "0", "important");
        canvas.style.setProperty("top", "0", "important");
        canvas.style.setProperty("right", "0", "important");
        canvas.style.setProperty("bottom", "0", "important");
        canvas.style.setProperty("width", "100%", "important");
        canvas.style.setProperty("height", "100%", "important");
        canvas.style.setProperty("max-width", "100%", "important");
        canvas.style.setProperty("max-height", "100%", "important");
        canvas.style.setProperty("margin", "0", "important");
        canvas.style.setProperty("padding", "0", "important");
        canvas.style.setProperty("border", "none", "important");
        canvas.style.setProperty("border-radius", "0", "important");
        canvas.style.setProperty("box-shadow", "none", "important");
        canvas.style.setProperty("box-sizing", "border-box", "important");
        return true;
      } catch (_e) {
        return false;
      }
    }
    function kpUnpinStrokePlayCanvasOnly_(frame) {
      try {
        if (!frame) return;
        const doc = frame.contentDocument;
        if (!doc || !doc.body) return;
        Array.prototype.forEach.call(doc.body.querySelectorAll("[data-kp-stroke-hidden]"), function (el) {
          el.removeAttribute("data-kp-stroke-hidden");
          [
            "display", "visibility", "pointer-events", "height", "max-height",
            "margin", "padding", "overflow", "position", "left", "top", "right", "bottom"
          ].forEach(function (p) {
            try { el.style.removeProperty(p); } catch (_eP) {}
          });
        });
        const canvas = doc.getElementById("canvas");
        if (canvas) {
          [
            "display", "visibility", "pointer-events", "position", "left", "top", "right", "bottom",
            "width", "height", "max-width", "max-height", "margin", "padding", "border",
            "border-radius", "box-shadow", "box-sizing"
          ].forEach(function (p) {
            try { canvas.style.removeProperty(p); } catch (_eC) {}
          });
        }
        doc.body.style.marginTop = "";
        doc.body.style.transform = "";
      } catch (_e) {}
    }
    function applyKpStrokeOrderPlayCompactMode_(frame, isOn) {
      try {
        if (!frame) return;
        const doc = frame.contentDocument;
        if (!doc || !doc.body || !doc.documentElement) return;
        const css =
          "html,body{" +
          "margin:0!important;padding:0!important;border:0!important;" +
          "overflow:hidden!important;background:#fff!important;" +
          "width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;" +
          "}" +
          "body[data-kp-stroke-play='1']{" +
          "display:block!important;position:relative!important;" +
          "}" +
          "body[data-kp-stroke-play='1'] #canvas{" +
          "display:block!important;position:absolute!important;" +
          "left:0!important;top:0!important;right:0!important;bottom:0!important;" +
          "width:100%!important;height:100%!important;" +
          "border:none!important;border-radius:0!important;box-shadow:none!important;" +
          "box-sizing:border-box!important;margin:0!important;padding:0!important;" +
          "}";
        let style = doc.getElementById("kp-stroke-order-play-compact-style");
        if (!style) {
          style = doc.createElement("style");
          style.id = "kp-stroke-order-play-compact-style";
          doc.documentElement.appendChild(style);
        }
        style.textContent = css;
        if (isOn) {
          doc.body.setAttribute("data-kp-stroke-play", "1");
          frame.setAttribute("scrolling", "no");
          frame.style.border = "none";
          kpPinStrokePlayCanvasOnly_(frame);
        } else {
          doc.body.removeAttribute("data-kp-stroke-play");
          try {
            style.textContent = "";
          } catch (_eClr) {}
          kpUnpinStrokePlayCanvasOnly_(frame);
        }
      } catch (_e) {}
    }
    function kpPinWrongPanelViewToModeButtons_(frame) {
      try {
        if (!frame) return false;
        const doc = frame.contentDocument;
        if (!doc || !doc.body) return false;
        const anchor =
          doc.getElementById("mode-msg") ||
          doc.querySelector('button[onclick*="switchMode(\'demo\')"]') ||
          doc.querySelector('button[onclick*="switchMode"]') ||
          null;
        if (!anchor) return false;
        const wrap = frame.parentElement;
        const pad = 4;
        doc.documentElement.style.scrollBehavior = "auto";
        doc.body.style.scrollBehavior = "auto";
        doc.body.style.transition = "none";
        doc.body.style.marginTop = "0px";
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        if (wrap && wrap.id === "kanji-quiz-wrong-model-wrap") {
          wrap.style.scrollBehavior = "auto";
          wrap.scrollTop = 0;
        }
        void doc.body.offsetHeight;
        const y = anchor.getBoundingClientRect().top - doc.body.getBoundingClientRect().top;
        const shift = Math.max(0, Math.round(y - pad));
        doc.body.style.marginTop = "-" + shift + "px";
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        if (wrap && wrap.id === "kanji-quiz-wrong-model-wrap") wrap.scrollTop = 0;
        return true;
      } catch (_e) {
        return false;
      }
    }
    function kpRevealWrongModelWrap_(frame) {
      try {
        const wrap = frame && frame.parentElement;
        if (wrap && wrap.id === "kanji-quiz-wrong-model-wrap") {
          wrap.classList.remove("is-kp-view-pending");
        }
      } catch (_e) {}
    }
    /** お手本 iframe 内でモード切替後、なぞり練習・採点ボタンが見えるよう再レイアウト */
    function kpRefreshWrongPanelLayout_(frame) {
      try {
        if (!frame || !kpFrameInWrongModelWrap_(frame)) return;
        const wrap = frame.parentElement;
        kpForceWrongPanelCanvasSquare_(frame);
        var targetH = kpWrongModelWrapTargetHeight_(wrap);
        try {
          wrap.style.minHeight = targetH + "px";
          wrap.style.height = targetH + "px";
        } catch (_eW) {}
        kpApplyWrongModelFrameFill_(frame);
        kpPinWrongPanelViewToModeButtons_(frame);
        kpResizeFrameToContent();
        kpForceWrongPanelCanvasSquare_(frame);
        kpRevealWrongModelWrap_(frame);
      } catch (_e) {}
    }
    function applyKpQuizWrongPanelCompactMode(frame, isOn) {
      try {
        if (!frame) return;
        const doc = frame.contentDocument;
        if (!doc || !doc.body || !doc.documentElement) return;
        if (doc.documentElement.dataset.kpWrongCompactTagged !== "1") {
          try {
            const syncBtn = doc.querySelector('button[onclick*="syncData"]');
            if (syncBtn && syncBtn.closest(".controls")) {
              syncBtn.closest(".controls").setAttribute("data-kp-section", "tools");
            }
            const strictCb = doc.getElementById("cb-strict-mode");
            if (strictCb && strictCb.closest(".controls")) {
              strictCb.closest(".controls").setAttribute("data-kp-section", "strict");
            }
          } catch (_eTag) {}
          doc.documentElement.dataset.kpWrongCompactTagged = "1";
        }
        const compactCss =
          "html,body{scroll-behavior:auto!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;}" +
          "body[data-kp-quiz-wrong='1']{padding:12px 10px 12px!important;transition:none!important;}" +
          "body[data-kp-quiz-wrong='1'] h2{font-size:15px!important;font-weight:700!important;margin:0 0 8px!important;padding:4px 8px!important;color:#1a73e8!important;background:#f0f6ff!important;border-bottom:1px solid #d4e3ff!important;border-radius:6px!important;width:auto!important;text-align:center!important;box-sizing:border-box!important;}" +
          "body[data-kp-quiz-wrong='1'] #kanji-selector-area{display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] [data-kp-section='tools']{display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] [data-kp-section='strict']{display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] .controls:not(#score-controls):not(#trace-controls):not(#demo-controls){display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] .controls{pointer-events:auto!important;}" +
          "body[data-kp-quiz-wrong='1'] .controls button{pointer-events:auto!important;cursor:pointer!important;}" +
          "body[data-kp-quiz-wrong='1'] #mode-msg{margin:4px 0 6px!important;font-size:12px!important;line-height:1.35!important;}" +
          "body[data-kp-quiz-wrong='1'] #canvas{" +
          "display:block!important;margin:4px auto!important;" +
          "width:min(200px,78%)!important;height:min(200px,78%)!important;" +
          "max-width:min(200px,78%)!important;max-height:min(200px,78%)!important;" +
          "min-width:min(160px,65%)!important;min-height:min(160px,65%)!important;" +
          "aspect-ratio:1/1!important;box-sizing:border-box!important;" +
          "object-fit:contain!important;" +
          "}" +
          "body[data-kp-quiz-wrong='1'] #score-controls{display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] #trace-controls.hidden{display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] #trace-controls:not(.hidden){" +
          "display:flex!important;flex-wrap:wrap!important;gap:6px!important;" +
          "justify-content:center!important;margin:6px 0!important;" +
          "visibility:visible!important;pointer-events:auto!important;opacity:1!important;}" +
          "body[data-kp-quiz-wrong='1'] #demo-controls.hidden{display:none!important;}" +
          "body[data-kp-quiz-wrong='1'] #demo-controls:not(.hidden){" +
          "display:flex!important;flex-wrap:wrap!important;gap:6px!important;" +
          "justify-content:center!important;margin:6px 0!important;" +
          "visibility:visible!important;pointer-events:auto!important;opacity:1!important;}" +
          "body[data-kp-quiz-wrong='1'] #result-box{margin-top:6px!important;padding:8px 12px!important;}" +
          "body[data-kp-quiz-wrong='1'] #result-box .score{font-size:32px!important;line-height:1.1!important;}" +
          "body[data-kp-quiz-wrong='1'] #result-box .msg{font-size:12px!important;margin-top:6px!important;line-height:1.4!important;}";
        let style = doc.getElementById("kp-wrong-panel-compact-style");
        if (!style) {
          style = doc.createElement("style");
          style.id = "kp-wrong-panel-compact-style";
          doc.documentElement.appendChild(style);
        }
        style.textContent = compactCss;
        const wrap = frame.parentElement;
        if (isOn) {
          doc.body.setAttribute("data-kp-quiz-wrong", "1");
          kpApplyWrongModelFrameFill_(frame);
          if (wrap && wrap.id === "kanji-quiz-wrong-model-wrap") {
            wrap.classList.add("is-kp-view-pending");
          }
          delete frame.dataset.kpWrongViewPinned;
          void doc.body.offsetHeight;
          if (kpPinWrongPanelViewToModeButtons_(frame)) {
            frame.dataset.kpWrongViewPinned = "1";
          }
          kpRevealWrongModelWrap_(frame);
        } else {
          doc.body.removeAttribute("data-kp-quiz-wrong");
          try {
            doc.body.style.marginTop = "";
            doc.body.style.transition = "";
            doc.documentElement.scrollTop = 0;
            doc.body.scrollTop = 0;
            if (wrap && wrap.id === "kanji-quiz-wrong-model-wrap") {
              wrap.scrollTop = 0;
              wrap.classList.remove("is-kp-view-pending");
            }
          } catch (_eReset) {}
          delete frame.dataset.kpWrongViewPinned;
        }
      } catch (_e) {}
    }
    function kpResizeFrameToContent(optFrame) {
      const frame = optFrame || getKanjiQuizScoreFrame();
      if (!frame || !frame.contentWindow || !frame.contentWindow.document) return;
      try {
        /* 書き順記入スロット内は親にぴったり合わせ、中身の scrollHeight でずらさない */
        if (kpFrameInStrokeOrderPlaySlot_(frame)) {
          frame.style.width = "100%";
          frame.style.height = "100%";
          frame.style.minHeight = "0";
          applyKpStrokeOrderPlayCompactMode_(frame, true);
          return;
        }
        if (kpFrameInWrongModelWrap_(frame)) {
          const wrap = frame.parentElement;
          const targetH = kpWrongModelWrapTargetHeight_(wrap);
          try {
            wrap.style.minHeight = targetH + "px";
            wrap.style.height = targetH + "px";
          } catch (_eW) {}
          kpApplyWrongModelFrameFill_(frame);
          kpForceWrongPanelCanvasSquare_(frame);
          if (frame.dataset.kpWrongViewPinned !== "1") {
            if (kpPinWrongPanelViewToModeButtons_(frame)) {
              frame.dataset.kpWrongViewPinned = "1";
            }
            kpRevealWrongModelWrap_(frame);
          }
          return;
        }
        const doc = frame.contentWindow.document;
        const bodyH = doc.body ? doc.body.scrollHeight : 0;
        const htmlH = doc.documentElement ? doc.documentElement.scrollHeight : 0;
        const h = kpComputeFrameHeight_(frame, bodyH, htmlH);
        frame.style.height = `${h}px`;
        if (kpFrameInPracticeSlot_(frame)) {
          frame.style.maxHeight = Math.max(520, Math.floor(window.innerHeight * 0.88)) + "px";
          frame.style.overflow = "auto";
        }
        if (!frame.dataset.kpObserved) {
          const ro = new ResizeObserver(() => {
            if (kpFrameInStrokeOrderPlaySlot_(frame)) {
              frame.style.width = "100%";
              frame.style.height = "100%";
              frame.style.minHeight = "0";
              return;
            }
            const bH = doc.body ? doc.body.scrollHeight : 0;
            const dH = doc.documentElement ? doc.documentElement.scrollHeight : 0;
            if (kpFrameInWrongModelWrap_(frame)) {
              kpApplyWrongModelFrameFill_(frame);
              kpForceWrongPanelCanvasSquare_(frame);
              return;
            }
            const nextH = kpComputeFrameHeight_(frame, bH, dH);
            frame.style.height = `${nextH}px`;
            if (kpFrameInPracticeSlot_(frame)) {
              frame.style.maxHeight = Math.max(520, Math.floor(window.innerHeight * 0.88)) + "px";
              frame.style.overflow = "auto";
            }
            /* 覗き窓は RO 連打で動かさない（初期ピンのみ） */
          });
          if (doc.body) ro.observe(doc.body);
          if (doc.documentElement) ro.observe(doc.documentElement);
          frame.dataset.kpObserved = "1";
        }
        if (kpFrameInWrongModelWrap_(frame) && frame.dataset.kpWrongViewPinned !== "1") {
          if (kpPinWrongPanelViewToModeButtons_(frame)) {
            frame.dataset.kpWrongViewPinned = "1";
            kpRevealWrongModelWrap_(frame);
          }
        }
      } catch (_) {}
    }
    function setKpStatus(text) {
      const el = document.getElementById('kp-practice-status');
      if (el) el.innerText = text || "";
    }
    function initKanjiPracticeCatalog() {
      if (kpCatalogState.loaded && kpCatalogState.materials.length) return;
      setKpStatus("教材を取得中...");
      const fromMaterialsCache = (() => {
        const d = kpGetCachedJson(LS_APP_CACHED_MATERIALS);
        if (!d || d.status !== "success" || !Array.isArray(d.materials)) return null;
        return d.materials;
      })();
      const pickKanjiMaterials = (all) => {
        return (Array.isArray(all) ? all : []).filter(m => {
          const cat = String(m.category || "").toLowerCase();
          const modeName = String(m.modeName || "");
          const modeId = String(m.modeId || "");
          const joined = `${modeName} ${modeId}`;
          return (cat === "kanji") || /漢字|かんじ|kanji/i.test(joined);
        });
      };
      const applyMaterials = (all) => {
        kpCatalogState.materials = pickKanjiMaterials(all);
        kpCatalogState.loaded = true;
        __kpSearchIndexMem = null;
        kpRenderBookSelect();
        try { kpWarmSearchIndexFromCache_(); } catch (_eW) {}
        try { kpScheduleSearchIndexPrefetch_(); } catch (_e) {}
      };
      const fetchMaterialsFresh = () => {
        fetchMaterialsListFromServer()
        .then(d=>{
          if (d.status !== "success") throw new Error(d.message || "教材取得失敗");
          persistMaterialsPayload(d);
          applyMaterials(materialsData);
          if (!kpCatalogState.materials.length) {
            setKpStatus("漢字教材が0件です（設定または分類を確認してください）。");
          }
        }).catch(_ => {
          setKpStatus("教材の取得に失敗しました。");
        });
      };
      if (fromMaterialsCache) {
        const cachedKanji = pickKanjiMaterials(fromMaterialsCache);
        if (cachedKanji.length) {
          applyMaterials(fromMaterialsCache);
          setKpStatus("教材キャッシュを使用しました。");
          return;
        }
        // キャッシュが古く漢字教材が含まれない場合は自動で再取得
        setKpStatus("漢字教材キャッシュを更新中...");
        fetchMaterialsFresh();
        return;
      }
      fetchMaterialsFresh();
    }
    function kpRenderBookSelect() {
      const sel = document.getElementById('kp-book-select');
      if (!sel) return;
      const mats = kpCatalogState.materials;
      if (!mats.length) {
        sel.innerHTML = '<option value="">ブックなし</option>';
        setKpStatus("漢字教材が見つかりません。");
        syncKnSelectorsFromKp();
        return;
      }
      sel.innerHTML = mats.map(m => `<option value="${escapeHtml(m.modeId)}">${escapeHtml(m.modeName || m.modeId)}</option>`).join('');
      kpOnBookChange();
    }
    function kpOnBookChange() {
      const bsel = document.getElementById('kp-book-select');
      const ssel = document.getElementById('kp-sheet-select');
      if (!bsel || !ssel) return;
      const modeId = bsel.value;
      const mat = kpCatalogState.materials.find(m => String(m.modeId) === String(modeId));
      const units = mat && Array.isArray(mat.units) ? mat.units : [];
      if (!units.length) {
        ssel.innerHTML = '<option value="">シートなし</option>';
        setKpStatus("シートがありません。");
        syncKnSelectorsFromKp();
        return;
      }
      ssel.innerHTML = units.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(formatUnitSheetDisplayLabel(u))}</option>`).join('');
      kpOnSheetChange();
    }
    function kpOnSheetChange() {
      const bsel = document.getElementById('kp-book-select');
      const ssel = document.getElementById('kp-sheet-select');
      const setSel = document.getElementById('kp-set-select');
      if (!bsel || !ssel || !setSel) return;
      const modeId = bsel.value;
      const unitName = ssel.value;
      kpCatalogState.sets = [];
      kpCatalogState.setQuestions = [];
      setSel.innerHTML = '<option value="">セット読み込み中...</option>';
      setKpStatus(`セットを取得中: ${formatUnitSheetDisplayLabel(unitName)}`);
      const setsKey = kpCacheKeySets(modeId, unitName);
      const cachedSets = kpGetCachedJson(setsKey);
      if (cachedSets && cachedSets.status === "success" && Array.isArray(cachedSets.sets)) {
        kpCatalogState.sets = cachedSets.sets;
        if (!kpCatalogState.sets.length) {
          setSel.innerHTML = '<option value="">セットなし</option>';
          setKpStatus("このシートにセットがありません。");
          kpRenderTiles([]);
          syncKnSelectorsFromKp();
          return;
        }
        setSel.innerHTML = kpCatalogState.sets.map(s => `<option value="${escapeHtml(String(s.setId || ''))}">セット ${escapeHtml(String(s.setId || ''))}（${escapeHtml(String(s.count || 0))}字）</option>`).join('');
        setKpStatus(`セットをキャッシュから読み込みました: ${formatUnitSheetDisplayLabel(unitName)}`);
        kpOnSetChange();
        syncKnSelectorsFromKp();
        return;
      }
      gasApiFetchJson({ action: "get_kanji_quiz_sets", modeId: modeId, unitName: unitName }, { retries: 3, timeoutMs: 90000, xhrFallback: true })
      .then(function (d) {
        if (d.status !== "success") throw new Error(d.message || "セット取得失敗");
        kpCatalogState.sets = Array.isArray(d.sets) ? d.sets : [];
        kpSetCachedJson(setsKey, { status: "success", sets: kpCatalogState.sets, sheetKind: d.sheetKind || "" });
        if (!kpCatalogState.sets.length) {
          setSel.innerHTML = '<option value="">セットなし</option>';
          setKpStatus("このシートにセットがありません。");
          kpRenderTiles([]);
          syncKnSelectorsFromKp();
          return;
        }
        setSel.innerHTML = kpCatalogState.sets.map(s => `<option value="${escapeHtml(String(s.setId || ''))}">セット ${escapeHtml(String(s.setId || ''))}（${escapeHtml(String(s.count || 0))}字）</option>`).join('');
        // 初回のみシート内セット問題を先読みして、以後の切替を高速化
        kpCatalogState.sets.forEach(s => {
          const sid = String(s.setId || "");
          if (!sid) return;
          const qKey = kpCacheKeyQuestions(modeId, unitName, sid);
          if (kpGetCachedJson(qKey)) return;
          gasApiFetchJson({ action: "get_kanji_quiz_questions", modeId: modeId, unitName: unitName, setId: sid }, { retries: 2, timeoutMs: 90000, xhrFallback: true })
            .then(function (q) {
              if (q && q.status === "success" && Array.isArray(q.questions)) {
                kpSetCachedJson(qKey, { status: "success", questions: q.questions });
              }
            })
            .catch(function () {});
        });
        kpOnSetChange();
        syncKnSelectorsFromKp();
      }).catch(function () {
        setSel.innerHTML = '<option value="">セット取得失敗</option>';
        setKpStatus("セットの取得に失敗しました。");
        kpRenderTiles([]);
        syncKnSelectorsFromKp();
      });
    }
    function kpOnSetChange() {
      const bsel = document.getElementById('kp-book-select');
      const ssel = document.getElementById('kp-sheet-select');
      const setSel = document.getElementById('kp-set-select');
      if (!bsel || !ssel || !setSel) return;
      const modeId = bsel.value;
      const unitName = ssel.value;
      const setId = setSel.value;
      if (!setId) {
        kpCatalogState.setQuestions = [];
        kpRenderTiles([]);
        syncKnSelectorsFromKp();
        return;
      }
      setKpStatus(`セット ${setId} を読み込み中...`);
      const qKey = kpCacheKeyQuestions(modeId, unitName, setId);
      const cachedQ = kpGetCachedJson(qKey);
      if (cachedQ && cachedQ.status === "success" && Array.isArray(cachedQ.questions)) {
        kpCatalogState.setQuestions = cachedQ.questions;
        kpApplyFilterAndRender();
        setKpStatus(`セット ${setId} をキャッシュから表示中`);
        syncKnSelectorsFromKp();
        return;
      }
      gasApiFetchJson({ action: "get_kanji_quiz_questions", modeId: modeId, unitName: unitName, setId: setId }, { retries: 3, timeoutMs: 90000, xhrFallback: true })
      .then(function (d) {
        if (d.status !== "success") throw new Error(d.message || "問題取得失敗");
        kpCatalogState.setQuestions = Array.isArray(d.questions) ? d.questions : [];
        kpSetCachedJson(qKey, { status: "success", questions: kpCatalogState.setQuestions });
        kpApplyFilterAndRender();
        syncKnSelectorsFromKp();
      }).catch(function () {
        kpCatalogState.setQuestions = [];
        kpRenderTiles([]);
        setKpStatus("セット問題の取得に失敗しました。");
        syncKnSelectorsFromKp();
      });
    }
    function kpApplyFilterAndRender() {
      /* セット内タイルは教材セット選択のみ（検索は独立パネル） */
      const list = (kpCatalogState.setQuestions || [])
        .map(function (item) { return String(item.kanji || ""); })
        .filter(Boolean);
      kpCatalogState.filteredChars = list;
      kpRenderTiles(list);
      setKpStatus(list.length
        ? (list.length + " 件表示中 / セット内 " + (kpCatalogState.setQuestions || []).length + " 問")
        : "このセットに漢字がありません");
    }
    function kpRenderTiles(chars) {
      const grid = document.getElementById('kp-tile-grid');
      if (!grid) return;
      grid.innerHTML = "";
      if (!chars || !chars.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;color:#999;text-align:center;padding:18px;">候補なし</div>';
        return;
      }
      const uniq = Array.from(new Set(chars));
      uniq.forEach(ch => {
        const b = document.createElement('button');
        b.type = "button";
        b.className = "menu-btn btn-gray";
        b.style.margin = "0";
        b.style.width = "100%";
        b.style.padding = "14px 8px";
        b.style.fontSize = "52px";
        b.style.lineHeight = "1";
        b.style.color = "#111";
        b.style.border = "1px solid #cfd8dc";
        b.style.background = "#ffffff";
        b.style.boxShadow = "none";
        b.innerText = ch;
        b.title = `${ch} を練習`;
        b.onclick = () => kpSelectPracticeChar(ch);
        grid.appendChild(b);
      });
    }
    let __kpSearchTimer = null;
    let __kpSearchPrefetchStarted = false;
    let __kpSearchPrefetchBusy = false;
    let __kpKanjiVgMap = null;
    let __kpKanjiVgInflight = null;
    /** 検索索引はセット問題キャッシュ（app_cached_kp_sets_* / questions_*）だけを正とする。二重保存しない。 */
    let __kpSearchIndexMem = null;
    const LS_KP_SEARCH_INDEX_LEGACY = "app_cached_kp_search_index_v2";

    function kpSetSearchStatus_(text) {
      const el = document.getElementById("kp-search-status");
      if (el) el.textContent = text || "";
    }
    /** 検索文字列から漢字（CJK 統合漢字）を抽出 */
    function kpExtractIdeographs_(s) {
      const out = [];
      const seen = Object.create(null);
      const str = String(s || "").normalize("NFC");
      for (let i = 0; i < str.length; ) {
        const cp = str.codePointAt(i);
        i += cp > 0xffff ? 2 : 1;
        if (
          (cp >= 0x4e00 && cp <= 0x9fff) ||
          (cp >= 0x3400 && cp <= 0x4dbf) ||
          (cp >= 0xf900 && cp <= 0xfaff)
        ) {
          const ch = String.fromCodePoint(cp);
          if (!seen[ch]) {
            seen[ch] = true;
            out.push(ch);
          }
        }
      }
      return out;
    }
    /** KanjiVG マップ（親側）。iframe の KANJI_DATA があればそれを優先 */
    function kpEnsureKanjiVgMap_() {
      if (__kpKanjiVgMap && typeof __kpKanjiVgMap === "object") {
        return Promise.resolve(__kpKanjiVgMap);
      }
      if (__kpKanjiVgInflight) return __kpKanjiVgInflight;
      try {
        const frame = document.getElementById("kp-pro-frame");
        const kd = frame && frame.contentWindow && frame.contentWindow.KANJI_DATA;
        if (kd && typeof kd === "object" && Object.keys(kd).length > 50) {
          __kpKanjiVgMap = kd;
          return Promise.resolve(__kpKanjiVgMap);
        }
      } catch (_eFrame) {}
      const finish = function (map) {
        __kpKanjiVgMap = map && typeof map === "object" ? map : {};
        __kpKanjiVgInflight = null;
        return __kpKanjiVgMap;
      };
      if (window.KanjiVg && typeof window.KanjiVg.fetchMap === "function") {
        __kpKanjiVgInflight = window.KanjiVg.fetchMap()
          .then(function (m) { return finish(m); })
          .catch(function () { return finish({}); });
        return __kpKanjiVgInflight;
      }
      __kpKanjiVgInflight = fetch("KanjiVG.txt")
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then(function (text) {
          if (window.KanjiVg && typeof window.KanjiVg.parseTsv === "function") {
            return finish(window.KanjiVg.parseTsv(text));
          }
          return finish({});
        })
        .catch(function () { return finish({}); });
      return __kpKanjiVgInflight;
    }
    function kpNormalizeReadingForSearch_(s) {
      return String(s || "")
        .normalize("NFC")
        .replace(/[\u30a1-\u30f6]/g, function (ch) {
          return String.fromCharCode(ch.charCodeAt(0) - 0x60);
        })
        .toLowerCase();
    }
    /** 検索用テキスト：漢字本体＋音読み・訓読みのみ（例文・searchText は含めない） */
    function kpItemSearchHay_(item) {
      const parts = [];
      const k = String(item.kanji || "").trim();
      if (k) parts.push(k);
      const pushReading = function (raw) {
        const r = String(raw || "").trim();
        if (!r) return;
        parts.push(r);
        const norm = kpNormalizeReadingForSearch_(r);
        if (norm && norm !== r.toLowerCase()) parts.push(norm);
      };
      (Array.isArray(item.readings) ? item.readings : []).forEach(function (r) {
        if (!r) return;
        pushReading(r.reading);
      });
      /* 一部クイズ形式は readings 配列ではなく単一フィールド */
      pushReading(item.readingHint);
      pushReading(item.readingDisplay);
      pushReading(item.reading);
      return kpNormalizeReadingForSearch_(parts.join(" "));
    }
    /** キャッシュ済み問題から検索索引を組み立てる（学年×セット付き） */
    function kpBuildGlobalSearchIndex_() {
      const map = Object.create(null);
      (kpCatalogState.materials || []).forEach(function (mat) {
        const modeId = String(mat.modeId || "");
        const modeName = String(mat.modeName || modeId);
        (mat.units || []).forEach(function (unitName) {
          const unit = String(unitName || "");
          const setsCached = kpGetCachedJson(kpCacheKeySets(modeId, unit));
          const sets = setsCached && Array.isArray(setsCached.sets) ? setsCached.sets : [];
          sets.forEach(function (s) {
            const setId = String(s.setId || "");
            if (!setId) return;
            const qCached = kpGetCachedJson(kpCacheKeyQuestions(modeId, unit, setId));
            if (!qCached || !Array.isArray(qCached.questions)) return;
            qCached.questions.forEach(function (item) {
              const kanji = String(item.kanji || "");
              if (!kanji) return;
              const key = modeId + "\t" + unit + "\t" + kanji;
              if (!map[key]) {
                map[key] = {
                  kanji: kanji,
                  hay: kpItemSearchHay_(item),
                  modeId: modeId,
                  modeName: modeName,
                  unitName: unit,
                  setIds: []
                };
              } else {
                map[key].hay = (map[key].hay + " " + kpItemSearchHay_(item)).trim();
              }
              if (map[key].setIds.indexOf(setId) < 0) map[key].setIds.push(setId);
            });
          });
        });
      });
      return Object.keys(map).map(function (k) { return map[k]; });
    }
    function kpClearLegacySearchIndexBlob_() {
      try { localStorage.removeItem(LS_KP_SEARCH_INDEX_LEGACY); } catch (_e) {}
      try { localStorage.removeItem("app_cached_kp_search_index_v1"); } catch (_e2) {}
    }
    /** セット／問題のローカルキャッシュだけから索引を組み立て（別キーへ二重保存しない） */
    function kpGetSearchIndex_() {
      if (__kpSearchIndexMem && __kpSearchIndexMem.length) return __kpSearchIndexMem;
      const built = kpBuildGlobalSearchIndex_();
      if (built.length) __kpSearchIndexMem = built;
      return built;
    }
    function kpRebuildSearchIndexFromSetCaches_() {
      const built = kpBuildGlobalSearchIndex_();
      __kpSearchIndexMem = built.length ? built : null;
      return built;
    }
    /** 既に端末にあるセット問題キャッシュから索引を温める（ネットワーク不要） */
    function kpWarmSearchIndexFromCache_() {
      try {
        kpClearLegacySearchIndexBlob_();
        const built = kpRebuildSearchIndexFromSetCaches_();
        return built.length;
      } catch (_e) {
        return 0;
      }
    }
    function kpCountCachedQuestionSets_() {
      let n = 0;
      (kpCatalogState.materials || []).forEach(function (mat) {
        const modeId = String(mat.modeId || "");
        (mat.units || []).forEach(function (unitName) {
          const setsCached = kpGetCachedJson(kpCacheKeySets(modeId, unitName));
          const sets = setsCached && Array.isArray(setsCached.sets) ? setsCached.sets : [];
          sets.forEach(function (s) {
            const sid = String(s.setId || "");
            if (sid && kpGetCachedJson(kpCacheKeyQuestions(modeId, unitName, sid))) n++;
          });
        });
      });
      return n;
    }
    function kpScheduleSearchIndexPrefetch_() {
      if (__kpSearchPrefetchStarted) return;
      __kpSearchPrefetchStarted = true;
      const start = function () {
        try { kpPrefetchAllForSearch_(); } catch (_e) {}
      };
      try {
        if (typeof requestIdleCallback === "function") requestIdleCallback(start, { timeout: 4000 });
        else setTimeout(start, 600);
      } catch (_e2) {
        setTimeout(start, 600);
      }
    }
    function kpPrefetchAllForSearch_() {
      if (__kpSearchPrefetchBusy) return;
      const mats = kpCatalogState.materials || [];
      if (!mats.length) {
        __kpSearchPrefetchStarted = false;
        return;
      }
      __kpSearchPrefetchBusy = true;
      const jobs = [];
      mats.forEach(function (mat) {
        const modeId = String(mat.modeId || "");
        (mat.units || []).forEach(function (unitName) {
          jobs.push({ modeId: modeId, unitName: String(unitName || "") });
        });
      });
      let i = 0;
      const CONCURRENCY = 2;
      const runNext = function () {
        if (i >= jobs.length) {
          __kpSearchPrefetchBusy = false;
          try { kpRebuildSearchIndexFromSetCaches_(); } catch (_eSave) {}
          const q = ((document.getElementById("kp-search-input") || {}).value || "").trim();
          if (q) runKpGlobalSearch_(q);
          else {
            const n = (__kpSearchIndexMem && __kpSearchIndexMem.length) || 0;
            if (n) kpSetSearchStatus_("検索準備完了（" + n + " 字・セットキャッシュ共用）");
          }
          return;
        }
        const batch = [];
        while (batch.length < CONCURRENCY && i < jobs.length) batch.push(jobs[i++]);
        Promise.all(batch.map(function (job) {
          return kpEnsureSheetCachedForSearch_(job.modeId, job.unitName);
        })).then(runNext).catch(runNext);
      };
      kpSetSearchStatus_(__kpSearchIndexMem && __kpSearchIndexMem.length
        ? "セットキャッシュを確認・更新中…"
        : "検索用データを準備中…（初回のみ時間がかかることがあります）");
      runNext();
    }
    function kpEnsureSheetCachedForSearch_(modeId, unitName) {
      const setsKey = kpCacheKeySets(modeId, unitName);
      const ensureSets = function () {
        const cached = kpGetCachedJson(setsKey);
        if (cached && cached.status === "success" && Array.isArray(cached.sets)) {
          return Promise.resolve(cached.sets);
        }
        return gasApiFetchJson(
          { action: "get_kanji_quiz_sets", modeId: modeId, unitName: unitName },
          { retries: 2, timeoutMs: 60000, xhrFallback: true }
        ).then(function (d) {
          const sets = d && d.status === "success" && Array.isArray(d.sets) ? d.sets : [];
          kpSetCachedJson(setsKey, { status: "success", sets: sets, sheetKind: (d && d.sheetKind) || "" });
          return sets;
        }).catch(function () { return []; });
      };
      return ensureSets().then(function (sets) {
        const targets = (sets || []).slice(0, 10);
        let p = Promise.resolve();
        targets.forEach(function (s) {
          p = p.then(function () {
            const sid = String(s.setId || "");
            if (!sid) return null;
            const qKey = kpCacheKeyQuestions(modeId, unitName, sid);
            if (kpGetCachedJson(qKey)) return null;
            return gasApiFetchJson(
              { action: "get_kanji_quiz_questions", modeId: modeId, unitName: unitName, setId: sid },
              { retries: 1, timeoutMs: 60000, xhrFallback: true }
            ).then(function (q) {
              if (q && q.status === "success" && Array.isArray(q.questions)) {
                kpSetCachedJson(qKey, { status: "success", questions: q.questions });
              }
            }).catch(function () {});
          });
        });
        return p;
      });
    }
    function onKpGlobalSearchInput() {
      const el = document.getElementById("kp-search-input");
      const q = ((el && el.value) || "").trim();
      if (__kpSearchTimer) clearTimeout(__kpSearchTimer);
      if (!q) {
        clearKpGlobalSearchResults_();
        return;
      }
      kpSetSearchStatus_("検索中…");
      __kpSearchTimer = setTimeout(function () {
        if (!__kpSearchPrefetchStarted) kpScheduleSearchIndexPrefetch_();
        runKpGlobalSearch_(q);
      }, 280);
    }
    function clearKpGlobalSearch() {
      const el = document.getElementById("kp-search-input");
      if (el) el.value = "";
      clearKpGlobalSearchResults_();
    }
    function clearKpGlobalSearchResults_() {
      const box = document.getElementById("kp-search-results");
      if (box) box.innerHTML = "";
      kpSetSearchStatus_("");
    }
    function runKpGlobalSearch_(rawQ) {
      const raw = String(rawQ || "").trim();
      const q = raw.toLowerCase();
      const qReading = kpNormalizeReadingForSearch_(raw);
      const box = document.getElementById("kp-search-results");
      if (!box) return;
      if (!q) {
        clearKpGlobalSearchResults_();
        return;
      }
      const index = kpGetSearchIndex_();
      const cachedSets = kpCountCachedQuestionSets_();
      const hits = index.filter(function (row) {
        const kanji = String(row.kanji || "");
        const hay = String(row.hay || "");
        return kanji.toLowerCase().indexOf(q) >= 0 ||
          (qReading && hay.indexOf(qReading) >= 0);
      });
      const allBookKanji = Object.create(null);
      index.forEach(function (row) {
        const k = String(row.kanji || "");
        if (k) allBookKanji[k] = true;
      });
      const fromCache = !!(__kpSearchIndexMem && __kpSearchIndexMem.length);
      const renderAll = function (vgHits) {
        const vgList = Array.isArray(vgHits) ? vgHits : [];
        if (!hits.length && !vgList.length) {
          box.innerHTML = '<div style="color:#999;text-align:center;padding:16px;">該当なし' +
            (cachedSets < 3 && !fromCache ? "（データ準備中の可能性があります。少し待って再検索してください）" : "") +
            "</div>";
          kpSetSearchStatus_(__kpSearchPrefetchBusy
            ? "索引更新中… いま見つかった件数: 0"
            : "0 件");
          return;
        }
        /* 学年（シート）ごとにまとめる */
        const bySheet = Object.create(null);
        hits.forEach(function (row) {
          const sk = row.modeId + "\t" + row.unitName;
          if (!bySheet[sk]) {
            bySheet[sk] = {
              modeId: row.modeId,
              modeName: row.modeName,
              unitName: row.unitName,
              rows: []
            };
          }
          bySheet[sk].rows.push(row);
        });
        const sheetKeys = Object.keys(bySheet).sort(function (a, b) {
          return String(bySheet[a].unitName).localeCompare(String(bySheet[b].unitName), "ja");
        });
        box.innerHTML = "";
        sheetKeys.forEach(function (sk) {
          const group = bySheet[sk];
          const sec = document.createElement("section");
          sec.className = "kp-search-sheet-group";
          const title = document.createElement("h3");
          title.className = "kp-search-sheet-title";
          title.textContent = "📄 " + formatUnitSheetDisplayLabel(group.unitName) +
            (group.modeName ? "（" + group.modeName + "）" : "");
          sec.appendChild(title);
          const grid = document.createElement("div");
          grid.className = "kp-search-hit-grid";
          group.rows
            .sort(function (a, b) { return String(a.kanji).localeCompare(String(b.kanji), "ja"); })
            .forEach(function (row) {
              const setLabel = (row.setIds || []).slice().sort(function (a, b) {
                return Number(a) - Number(b);
              }).map(function (id) { return "セット" + id; }).join("・");
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "kp-search-hit";
              btn.innerHTML = '<span class="kp-search-hit-kanji">' + escapeHtml(row.kanji) + "</span>" +
                '<span class="kp-search-hit-meta">' + escapeHtml(setLabel || "セット不明") + "</span>";
              btn.title = row.kanji + " を練習（" + formatUnitSheetDisplayLabel(row.unitName) + " / " + setLabel + "）";
              btn.onclick = function () {
                kpSelectPracticeFromSearchHit_(row);
              };
              grid.appendChild(btn);
            });
          sec.appendChild(grid);
          box.appendChild(sec);
        });
        if (vgList.length) {
          const secVg = document.createElement("section");
          secVg.className = "kp-search-sheet-group is-kanjivg";
          const titleVg = document.createElement("h3");
          titleVg.className = "kp-search-sheet-title";
          titleVg.textContent = "✏️ KanjiVG（教材にない漢字）";
          secVg.appendChild(titleVg);
          const gridVg = document.createElement("div");
          gridVg.className = "kp-search-hit-grid";
          vgList
            .sort(function (a, b) { return String(a.kanji).localeCompare(String(b.kanji), "ja"); })
            .forEach(function (row) {
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "kp-search-hit is-kanjivg";
              btn.innerHTML = '<span class="kp-search-hit-kanji">' + escapeHtml(row.kanji) + "</span>" +
                '<span class="kp-search-hit-meta">書いて練習</span>';
              btn.title = row.kanji + " を KanjiVG の筆順で練習";
              btn.onclick = function () {
                kpSelectPracticeFromSearchHit_(row);
              };
              gridVg.appendChild(btn);
            });
          secVg.appendChild(gridVg);
          box.appendChild(secVg);
        }
        const total = hits.length + vgList.length;
        const sheetPart = sheetKeys.length
          ? sheetKeys.length + " 学年"
          : (vgList.length ? "KanjiVG" : "0 学年");
        kpSetSearchStatus_(total + " 件 / " + sheetPart +
          (vgList.length && hits.length ? " + KanjiVG " + vgList.length + " 字" : "") +
          (__kpSearchPrefetchBusy ? "（セット更新中）" : (fromCache ? "（セットキャッシュ）" : "")));
      };
      kpEnsureKanjiVgMap_().then(function (vgMap) {
        const vgHits = [];
        const seen = Object.create(null);
        kpExtractIdeographs_(raw).forEach(function (ch) {
          if (seen[ch] || !vgMap || !vgMap[ch]) return;
          if (allBookKanji[ch]) return;
          seen[ch] = true;
          vgHits.push({ kanji: ch, source: "kanjivg" });
        });
        renderAll(vgHits);
      }).catch(function () {
        renderAll([]);
      });
    }
    function kpSelectPracticeFromSearchHit_(row) {
      if (!row || !row.kanji) return;
      if (row.source === "kanjivg") {
        kpSelectPracticeChar(row.kanji);
        setKpStatus("「" + row.kanji + "」を練習（KanjiVG・教材外）");
        try {
          const frame = document.getElementById("kp-pro-frame");
          if (frame) frame.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (_e) {}
        return;
      }
      const bsel = document.getElementById("kp-book-select");
      const ssel = document.getElementById("kp-sheet-select");
      const setSel = document.getElementById("kp-set-select");
      const preferSet = (row.setIds && row.setIds.length) ? String(row.setIds[0]) : "";
      const finish = function () {
        kpSelectPracticeChar(row.kanji);
        setKpStatus("「" + row.kanji + "」を練習（" +
          formatUnitSheetDisplayLabel(row.unitName) +
          (preferSet ? " / セット" + preferSet : "") + "）");
        try {
          const frame = document.getElementById("kp-pro-frame");
          if (frame) frame.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (_e) {}
      };
      if (bsel && row.modeId) bsel.value = row.modeId;
      const mat = (kpCatalogState.materials || []).find(function (m) {
        return String(m.modeId) === String(row.modeId);
      });
      if (ssel && mat) {
        const units = Array.isArray(mat.units) ? mat.units : [];
        ssel.innerHTML = units.map(function (u) {
          return '<option value="' + escapeHtml(u) + '">' + escapeHtml(formatUnitSheetDisplayLabel(u)) + "</option>";
        }).join("");
        ssel.value = row.unitName;
      }
      const modeId = row.modeId;
      const unitName = row.unitName;
      const applySetAndQuestions = function (sets) {
        if (setSel) {
          setSel.innerHTML = (sets || []).map(function (s) {
            return '<option value="' + escapeHtml(String(s.setId || "")) + '">セット ' +
              escapeHtml(String(s.setId || "")) + "（" + escapeHtml(String(s.count || 0)) + "字）</option>";
          }).join("");
          if (preferSet) setSel.value = preferSet;
        }
        const sid = preferSet || (setSel && setSel.value) || "";
        if (!sid) {
          finish();
          return;
        }
        const qKey = kpCacheKeyQuestions(modeId, unitName, sid);
        const cachedQ = kpGetCachedJson(qKey);
        if (cachedQ && Array.isArray(cachedQ.questions)) {
          kpCatalogState.sets = sets || [];
          kpCatalogState.setQuestions = cachedQ.questions;
          kpApplyFilterAndRender();
          finish();
          return;
        }
        gasApiFetchJson(
          { action: "get_kanji_quiz_questions", modeId: modeId, unitName: unitName, setId: sid },
          { retries: 2, timeoutMs: 60000, xhrFallback: true }
        ).then(function (d) {
          kpCatalogState.sets = sets || [];
          kpCatalogState.setQuestions = d && Array.isArray(d.questions) ? d.questions : [];
          if (d && d.status === "success") {
            kpSetCachedJson(qKey, { status: "success", questions: kpCatalogState.setQuestions });
          }
          kpApplyFilterAndRender();
          finish();
        }).catch(function () {
          finish();
        });
      };
      const setsKey = kpCacheKeySets(modeId, unitName);
      const cachedSets = kpGetCachedJson(setsKey);
      if (cachedSets && Array.isArray(cachedSets.sets)) {
        applySetAndQuestions(cachedSets.sets);
        return;
      }
      gasApiFetchJson(
        { action: "get_kanji_quiz_sets", modeId: modeId, unitName: unitName },
        { retries: 2, timeoutMs: 60000, xhrFallback: true }
      ).then(function (d) {
        const sets = d && Array.isArray(d.sets) ? d.sets : [];
        kpSetCachedJson(setsKey, { status: "success", sets: sets, sheetKind: (d && d.sheetKind) || "" });
        applySetAndQuestions(sets);
      }).catch(function () {
        finish();
      });
    }
    function kpSelectPracticeChar(ch) {
      const frame = document.getElementById('kp-pro-frame');
      if (!frame || !frame.contentWindow) return;
      const target = String(ch || "");
      if (!target) return;
      const applySelect = function () {
        try {
          const win = frame.contentWindow;
          const doc = win.document;
          const sel = doc.getElementById('target-kanji');
          if (!sel) return false;
          try { win.__kpPendingKanjiSelect = target; } catch (_ePend) {}
          let has = Array.from(sel.options || []).some(function (o) {
            return String(o.value) === target;
          });
          if (!has) {
            let paths = null;
            try {
              if (win.KANJI_DATA && win.KANJI_DATA[target]) paths = win.KANJI_DATA[target];
            } catch (_eKd) {}
            if (!paths && __kpKanjiVgMap && __kpKanjiVgMap[target]) {
              paths = __kpKanjiVgMap[target];
              try {
                if (!win.KANJI_DATA || typeof win.KANJI_DATA !== "object") win.KANJI_DATA = {};
                win.KANJI_DATA[target] = paths;
              } catch (_eSet) {}
            }
            if (paths) {
              const opt = doc.createElement("option");
              opt.value = target;
              opt.textContent = target;
              sel.appendChild(opt);
              has = true;
            }
          }
          if (!has) return false;
          sel.value = target;
          if (typeof win.initTargetKanji === "function") win.initTargetKanji();
          if (typeof win.switchMode === "function") win.switchMode("score");
          kpResizeFrameToContent();
          setKpStatus("練習対象を「" + target + "」に切替えました。");
          return true;
        } catch (_e) {
          return false;
        }
      };
      if (applySelect()) return;
      kpEnsureKanjiVgMap_().then(function (vgMap) {
        if (!vgMap || !vgMap[target]) {
          setKpStatus("「" + target + "」は筆順データ（KanjiVG）未登録です。");
          return;
        }
        if (applySelect()) return;
        try {
          frame.contentWindow.__kpPendingKanjiSelect = target;
        } catch (_e2) {}
        setKpStatus("「" + target + "」の筆順データを読み込み中… 少し待ってから再タップしてください。");
        if (typeof frame.contentWindow.loadKanjiData === "function") {
          Promise.resolve(frame.contentWindow.loadKanjiData()).then(function () {
            applySelect();
          }).catch(function () {});
        }
      });
    }
    function kpShowModelDemo() {
      const frame = document.getElementById('kp-pro-frame');
      if (!frame || !frame.contentWindow) return;
      try {
        if (typeof frame.contentWindow.switchMode === "function") {
          frame.contentWindow.switchMode("demo");
          kpResizeFrameToContent();
          setKpStatus("お手本表示モードに切り替えました。");
        } else {
          setKpStatus("お手本表示機能の呼び出しに失敗しました。");
        }
      } catch (_) {
        setKpStatus("お手本表示機能の呼び出しに失敗しました。");
      }
    }
    function kpReplayModelDemo() {
      const frame = document.getElementById('kp-pro-frame');
      if (!frame || !frame.contentWindow) return;
      try {
        if (typeof frame.contentWindow.switchMode === "function") frame.contentWindow.switchMode("demo");
        if (typeof frame.contentWindow.playAnimation === "function") {
          frame.contentWindow.playAnimation();
          kpResizeFrameToContent();
          setKpStatus("書き順デモを再生しました。");
        } else {
          setKpStatus("デモ再生機能の呼び出しに失敗しました。");
        }
      } catch (_) {
        setKpStatus("デモ再生機能の呼び出しに失敗しました。");
      }
    }
    function loadMaterialsByFilter(btn, category) {
      const origText = toggleBtnLoading(btn, true);
      document.getElementById('materials-container').innerHTML = "<p>よみこみ中...</p>";
      const formatFirstEl = document.getElementById("kanji-quiz-format-first");
      if (formatFirstEl) {
        formatFirstEl.style.display = "none";
        formatFirstEl.hidden = true;
      }
      ensureMaterialsListLoaded()
        .then(() => {
          toggleBtnLoading(btn, false, origText);
          switchSection('section-materials');
          const title = document.getElementById('materials-title');
          if (title) title.innerText = category === "kanji" ? "漢字クイズに挑戦" : "英語の自由学習";
          const c = document.getElementById('materials-container');
          c.innerHTML = "";
          const all = Array.isArray(materialsData) ? materialsData : [];
          const list = all.filter(m => {
            const cat = String(m.category || "").toLowerCase();
            const name = String(m.modeName || "");
            const isKanji = (cat === "kanji") || /漢字|かんじ|kanji/i.test(name);
            return category === "kanji" ? isKanji : !isKanji;
          });
          if (list.length === 0) {
            c.innerHTML = "<p>表示できる教材がありません。</p>";
            __kanjiQuizMaterialsIndex_ = { standard: [], jukugo: [] };
            return;
          }
          if (category === "kanji") {
            const standardBooks = list.filter(function (m) { return !/熟語/.test(String(m.modeName || "")); });
            const jukugoBooks = list.filter(function (m) { return /熟語/.test(String(m.modeName || "")); });
            __kanjiQuizMaterialsIndex_ = { standard: standardBooks, jukugo: jukugoBooks };
            function appendSheetButtons_(books) {
              books.forEach(function (m) {
                (m.units || []).forEach(function (u) {
                  const b = document.createElement("button");
                  b.className = "menu-btn btn-gray";
                  b.innerText = "📄 " + formatUnitSheetDisplayLabel(u);
                  b.onclick = function () { loadQuestionsForSettings(b, m.modeId, m.modeName, u, category); };
                  c.appendChild(b);
                });
              });
            }
            if (standardBooks.length) {
              const hStd = document.createElement("h2");
              hStd.className = "kanji-materials-book-heading";
              hStd.innerText = "📚 単一漢字";
              c.appendChild(hStd);
              appendSheetButtons_(standardBooks);
            }
            if (jukugoBooks.length) {
              const hJuk = document.createElement("h2");
              hJuk.className = "kanji-materials-book-heading";
              hJuk.style.marginTop = standardBooks.length ? "18px" : "0";
              hJuk.innerText = "📚 漢字熟語";
              c.appendChild(hJuk);
              appendSheetButtons_(jukugoBooks);
            }
            showKanjiQuizFormatFirstPanel_();
          } else {
            __kanjiQuizMaterialsIndex_ = { standard: [], jukugo: [] };
            list.forEach(function (m) {
              const t = document.createElement("h2");
              t.innerText = "📁 " + m.modeName;
              c.appendChild(t);
              m.units.forEach(function (u) {
                const b = document.createElement("button");
                b.className = "menu-btn btn-gray";
                b.innerText = "📄 " + formatUnitSheetDisplayLabel(u);
                b.onclick = function () { loadQuestionsForSettings(b, m.modeId, m.modeName, u, category); };
                c.appendChild(b);
              });
            });
          }
        })
        .catch(() => {
          toggleBtnLoading(btn, false, origText);
          document.getElementById('materials-container').innerHTML = "<p>よみこみに失敗しました。</p>";
        });
    }
    let __kanjiQuizMaterialsIndex_ = { standard: [], jukugo: [] };

    function encodeKanjiFfSheetValue_(modeId, modeName, unitName) {
      return JSON.stringify({
        modeId: String(modeId || ""),
        modeName: String(modeName || ""),
        unitName: String(unitName || "")
      });
    }
    function decodeKanjiFfSheetValue_(raw) {
      try {
        const o = JSON.parse(String(raw || ""));
        if (o && o.modeId && o.unitName) return o;
      } catch (e) {}
      return null;
    }
    function showKanjiQuizFormatFirstPanel_() {
      const el = document.getElementById("kanji-quiz-format-first");
      if (!el) return;
      el.hidden = false;
      el.style.display = "flex";
      const fmt = document.getElementById("kq-ff-format");
      if (fmt) {
        try {
          const v = localStorage.getItem(LS_KANJI_QUIZ_FORMAT);
          if (v && Array.from(fmt.options).some(function (o) { return o.value === v; })) fmt.value = v;
        } catch (e) {}
      }
      syncKanjiQuizFormatFirstJukugoOptsFromStorage_();
      onKanjiQuizFormatFirstFormatChange();
    }
    function syncKanjiQuizFormatFirstJukugoOptsFromStorage_() {
      try {
        const cc = localStorage.getItem(LS_KANJI_JUKUGO_CHOICE_COUNT);
        const inc = localStorage.getItem(LS_KANJI_JUKUGO_INCLUDE_NONE);
        const sel = document.getElementById("kq-ff-jukugo-choice-count");
        if (sel && cc) sel.value = cc;
        const chk = document.getElementById("kq-ff-jukugo-include-none");
        if (chk) chk.checked = inc === "1";
      } catch (e) {}
    }
    function onKanjiQuizFormatFirstJukugoOptsChange() {
      const ccEl = document.getElementById("kq-ff-jukugo-choice-count");
      const incEl = document.getElementById("kq-ff-jukugo-include-none");
      try {
        if (ccEl) localStorage.setItem(LS_KANJI_JUKUGO_CHOICE_COUNT, String(ccEl.value || "4"));
        if (incEl) localStorage.setItem(LS_KANJI_JUKUGO_INCLUDE_NONE, incEl.checked ? "1" : "0");
      } catch (e) {}
      /* セット画面の同行オプションも同期 */
      const mainCc = document.getElementById("jukugo-choice-count");
      const mainInc = document.getElementById("jukugo-include-none");
      if (mainCc && ccEl) mainCc.value = ccEl.value;
      if (mainInc && incEl) mainInc.checked = !!incEl.checked;
    }
    function onKanjiQuizFormatFirstFormatChange() {
      const fmt = document.getElementById("kq-ff-format");
      const mode = fmt ? fmt.value : "write_kanji";
      try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, mode); } catch (e) {}
      const jukugoOpts = document.getElementById("kq-ff-jukugo-opts");
      if (jukugoOpts) jukugoOpts.style.display = mode === "jukugo_yomi" ? "block" : "none";
      const sheetSel = document.getElementById("kq-ff-sheet");
      const setSel = document.getElementById("kq-ff-set");
      if (!sheetSel) return;
      const books = mode === "jukugo_yomi"
        ? (__kanjiQuizMaterialsIndex_.jukugo || [])
        : (__kanjiQuizMaterialsIndex_.standard || []);
      sheetSel.innerHTML = "";
      if (!books.length) {
        sheetSel.innerHTML = '<option value="">この形式の学年がありません</option>';
        if (setSel) setSel.innerHTML = '<option value="">—</option>';
        return;
      }
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "学年をえらんでね";
      sheetSel.appendChild(ph);
      books.forEach(function (m) {
        (m.units || []).forEach(function (u) {
          const opt = document.createElement("option");
          opt.value = encodeKanjiFfSheetValue_(m.modeId, m.modeName, u);
          opt.textContent = formatUnitSheetDisplayLabel(u);
          sheetSel.appendChild(opt);
        });
      });
      if (setSel) setSel.innerHTML = '<option value="">先に学年をえらんでね</option>';
    }
    function fetchKanjiQuizSetsForFormatFirst_(modeId, unitName) {
      const setsCacheKey = kanjiQuizDrillCacheKeySets(modeId, unitName);
      if (__kanjiQuizSetsSessionCache[setsCacheKey] && __kanjiQuizSetsSessionCache[setsCacheKey].sheetKind) {
        return Promise.resolve(__kanjiQuizSetsSessionCache[setsCacheKey]);
      }
      try {
        const cachedSets = localStorage.getItem(setsCacheKey);
        if (cachedSets) {
          const d = JSON.parse(cachedSets);
          if (d && d.status === "success" && d.sheetKind) {
            __kanjiQuizSetsSessionCache[setsCacheKey] = d;
            return Promise.resolve(d);
          }
        }
      } catch (e) {}
      return gasApiFetchJson({ action: "get_kanji_quiz_sets", modeId: modeId, unitName: unitName }, {
        retries: 2,
        timeoutMs: 60000,
        xhrFallback: true,
        retryDelaysMs: [800, 1800]
      }).then(function (d) {
        if (d && d.status === "success") {
          try { localStorage.setItem(setsCacheKey, JSON.stringify(d)); } catch (e2) {}
          __kanjiQuizSetsSessionCache[setsCacheKey] = d;
        }
        return d || { status: "error", message: "セット取得に失敗しました" };
      });
    }
    function onKanjiQuizFormatFirstSheetChange() {
      const sheetSel = document.getElementById("kq-ff-sheet");
      const setSel = document.getElementById("kq-ff-set");
      if (!sheetSel || !setSel) return;
      const info = decodeKanjiFfSheetValue_(sheetSel.value);
      if (!info) {
        setSel.innerHTML = '<option value="">先に学年をえらんでね</option>';
        return;
      }
      setSel.innerHTML = '<option value="">セットをよみこみ中…</option>';
      fetchKanjiQuizSetsForFormatFirst_(info.modeId, info.unitName)
        .then(function (d) {
          if (!d || d.status !== "success") {
            setSel.innerHTML = '<option value="">セット取得失敗</option>';
            return;
          }
          const sets = Array.isArray(d.sets) ? d.sets : [];
          if (!sets.length) {
            setSel.innerHTML = '<option value="">セットなし</option>';
            return;
          }
          setSel.innerHTML = sets.map(function (s) {
            return '<option value="' + escapeHtml(String(s.setId || "")) + '">セット ' +
              escapeHtml(String(s.setId || "")) + '（' + escapeHtml(String(s.count || 0)) + '字）</option>';
          }).join("");
        })
        .catch(function () {
          setSel.innerHTML = '<option value="">セット取得失敗</option>';
        });
    }
    function applyFormatFirstChoicesToMainQuizUi_() {
      const fmt = document.getElementById("kq-ff-format");
      const mode = fmt ? fmt.value : "write_kanji";
      try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, mode); } catch (e) {}
      onKanjiQuizFormatFirstJukugoOptsChange();
      kanjiQuizCurrentSheetKind_ = mode === "jukugo_yomi" ? "jukugo" : "standard";
      const mainFmt = document.getElementById("kanji-quiz-format-select");
      if (mainFmt) {
        applyKanjiQuizSheetKind_(kanjiQuizCurrentSheetKind_);
        if (mode === "jukugo_yomi" || kanjiQuizCurrentSheetKind_ !== "jukugo") {
          try { mainFmt.value = mode; } catch (e2) {}
        }
        syncKanjiQuizFormatSelectFromStorage();
        updateKanjiQuizFormatOptionVisibility_();
      }
    }
    function openKanjiQuizSetsFromFormatFirst(btn) {
      const sheetSel = document.getElementById("kq-ff-sheet");
      const info = sheetSel ? decodeKanjiFfSheetValue_(sheetSel.value) : null;
      if (!info) {
        alert("先に学年（シート）をえらんでね。");
        return;
      }
      applyFormatFirstChoicesToMainQuizUi_();
      const orig = toggleBtnLoading(btn, true);
      openKanjiQuizSets(info.modeId, info.modeName, info.unitName, btn, orig);
    }
    function startKanjiQuizFromFormatFirst(btn) {
      const sheetSel = document.getElementById("kq-ff-sheet");
      const setSel = document.getElementById("kq-ff-set");
      const info = sheetSel ? decodeKanjiFfSheetValue_(sheetSel.value) : null;
      const setId = setSel ? String(setSel.value || "").trim() : "";
      if (!info) {
        alert("先に学年（シート）をえらんでね。");
        return;
      }
      if (!setId) {
        alert("セット番号をえらんでね。");
        return;
      }
      applyFormatFirstChoicesToMainQuizUi_();
      const orig = toggleBtnLoading(btn, true);
      showKanjiQuizSetLoadingOverlay_("セット " + setId);
      const qKey = kanjiQuizDrillCacheKeyQuestions(info.modeId, info.unitName, setId);
      const finishErr = function (msg) {
        toggleBtnLoading(btn, false, orig);
        hideKanjiQuizSetLoadingOverlay_();
        alert(msg || "はじめられませんでした。");
      };
      const startFromQ = function (q) {
        toggleBtnLoading(btn, false, orig);
        if (!q || q.status !== "success") {
          hideKanjiQuizSetLoadingOverlay_();
          alert("取得失敗: " + ((q && q.message) || "エラー"));
          return;
        }
        var raw = Array.isArray(q.questions) ? q.questions : [];
        var prep = prepareKanjiQuizQuestionsForPlay(raw);
        if (!prep) {
          hideKanjiQuizSetLoadingOverlay_();
          return;
        }
        startKanjiQuizPlay({
          modeId: info.modeId,
          modeName: info.modeName,
          unitName: info.unitName,
          setId: String(q.setId != null ? q.setId : setId),
          allQuestions: raw,
          formatMode: prep.formatMode
        });
      };
      pauseKanjiQuizQuestionsPrefetch_();
      const cachedQ = readKanjiQuizQuestionsCache_(qKey);
      if (cachedQ) {
        startFromQ(cachedQ);
        resumeKanjiQuizQuestionsPrefetch_();
        return;
      }
      fetchKanjiQuizQuestionsForSetStart_(info.modeId, info.unitName, setId)
        .then(function (q) {
          if (q && q.status === "success") rememberKanjiQuizQuestionsCache_(qKey, q);
          startFromQ(q || { status: "error", message: "応答を解釈できませんでした。" });
        })
        .catch(function (err) {
          var detail = err && err.message ? String(err.message) : "";
          finishErr("通信エラーが発生しました。" + (detail ? "\n（" + detail.slice(0, 120) + "）" : ""));
        })
        .then(function () {
          resumeKanjiQuizQuestionsPrefetch_();
        });
    }
    const LS_KANJI_QUIZ_FORMAT = 'app_kanji_quiz_format_v1';
    const LS_KANJI_JUKUGO_CHOICE_COUNT = 'app_kanji_jukugo_choice_count_v1';
    const LS_KANJI_JUKUGO_INCLUDE_NONE = 'app_kanji_jukugo_include_none_v1';
    const JUKUGO_NONE_ANSWER_ = '__NONE__';
    let kanjiQuizCurrentSheetKind_ = 'standard';
    function getKanjiQuizJukugoChoiceCount() {
      const el = document.getElementById('jukugo-choice-count');
      const n = el ? parseInt(el.value, 10) : 4;
      return Math.min(8, Math.max(3, isNaN(n) ? 4 : n));
    }
    function getKanjiQuizJukugoIncludeNone() {
      const el = document.getElementById('jukugo-include-none');
      return !!(el && el.checked);
    }
    function onKanjiQuizJukugoOptsChange() {
      try {
        localStorage.setItem(LS_KANJI_JUKUGO_CHOICE_COUNT, String(getKanjiQuizJukugoChoiceCount()));
        localStorage.setItem(LS_KANJI_JUKUGO_INCLUDE_NONE, getKanjiQuizJukugoIncludeNone() ? '1' : '0');
      } catch (e) {}
    }
    function syncKanjiQuizJukugoOptsFromStorage() {
      try {
        const cc = localStorage.getItem(LS_KANJI_JUKUGO_CHOICE_COUNT);
        const inc = localStorage.getItem(LS_KANJI_JUKUGO_INCLUDE_NONE);
        const sel = document.getElementById('jukugo-choice-count');
        if (sel && cc) sel.value = cc;
        const chk = document.getElementById('jukugo-include-none');
        if (chk) chk.checked = inc === '1';
      } catch (e) {}
    }
    function updateKanjiQuizFormatOptionVisibility_() {
      const mode = getKanjiQuizFormatMode();
      const jukugoWrap = document.getElementById('kanji-quiz-jukugo-opts');
      if (jukugoWrap) jukugoWrap.style.display = mode === 'jukugo_yomi' ? 'block' : 'none';
    }
    function applyKanjiQuizSheetKind_(sheetKind) {
      kanjiQuizCurrentSheetKind_ = sheetKind || 'standard';
      const sel = document.getElementById('kanji-quiz-format-select');
      if (!sel) return;
      // 単漢字ブック向け形式（熟語読み以外）
      const standardFormats = ['select_kana', 'type_yomi', 'write_kanji', 'stroke_order'];
      if (kanjiQuizCurrentSheetKind_ === 'jukugo') {
        // 熟語ブック → 熟語読みモードのみ
        const jukugoFormats = ['jukugo_yomi', 'jukugo_type_yomi'];
        Array.from(sel.options).forEach(function (opt) {
          const on = jukugoFormats.indexOf(opt.value) >= 0;
          opt.disabled = !on;
          opt.hidden = !on;
        });
        // 現在選択値が熟語系でなければ jukugo_yomi に戻す
        if (jukugoFormats.indexOf(sel.value) < 0) {
          sel.value = 'jukugo_yomi';
          try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, 'jukugo_yomi'); } catch (e) {}
        }
      } else {
        // 通常の単漢字ブック → 熟語読み以外をすべて用意
        Array.from(sel.options).forEach(function (opt) {
          const on = standardFormats.indexOf(opt.value) >= 0;
          opt.disabled = !on;
          opt.hidden = !on;
        });
        if (sel.value === 'jukugo_yomi' || sel.value === 'mixed' || !sel.value || (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].disabled)) {
          let fallback = 'write_kanji';
          try {
            const v = localStorage.getItem(LS_KANJI_QUIZ_FORMAT);
            if (v && v !== 'mixed' && standardFormats.indexOf(v) >= 0) fallback = v;
          } catch (e) {}
          sel.value = fallback;
          try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, fallback); } catch (e2) {}
        }
      }
      updateKanjiQuizFormatOptionVisibility_();
      // 有効選択肢がブック種で変わるので、縦書きUIは作り直して一覧を取りこぼさない
      rebuildKanjiCustomSelect_(sel);
    }
    function getKanjiQuizFormatMode() {
      const sel = document.getElementById('kanji-quiz-format-select');
      if (sel && sel.value) {
        if (sel.value === 'mixed') {
          sel.value = 'write_kanji';
          try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, 'write_kanji'); } catch (e0) {}
          return 'write_kanji';
        }
        return sel.value;
      }
      try {
        const v = localStorage.getItem(LS_KANJI_QUIZ_FORMAT);
        if (v === 'mixed') {
          try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, 'write_kanji'); } catch (e1) {}
          return 'write_kanji';
        }
        if (v && ['write_kanji', 'select_kana', 'type_yomi', 'stroke_order', 'jukugo_yomi', 'jukugo_type_yomi'].indexOf(v) >= 0) return v;
      } catch (e) {}
      return 'write_kanji';
    }
    function onKanjiQuizFormatChange() {
      const sel = document.getElementById('kanji-quiz-format-select');
      if (sel) {
        try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, sel.value); } catch (e) {}
      }
      updateKanjiQuizFormatOptionVisibility_();
    }
    function syncKanjiQuizFormatSelectFromStorage() {
      const sel = document.getElementById('kanji-quiz-format-select');
      if (!sel) return;
      if (kanjiQuizCurrentSheetKind_ === 'jukugo') {
        sel.value = 'jukugo_yomi';
      } else {
        const v = getKanjiQuizFormatMode();
        if (v && v !== 'jukugo_yomi') sel.value = v;
      }
      syncKanjiQuizJukugoOptsFromStorage();
      updateKanjiQuizFormatOptionVisibility_();
      refreshKanjiCustomSelect_(sel);
    }
    function filterKanjiQuizQuestionsByFormat(questions, mode) {
      const arr = Array.isArray(questions) ? questions : [];
      var m = mode || 'write_kanji';
      if (m === 'mixed') m = 'write_kanji';
      var typeMap = {
        write_kanji: 'ruby_to_kanji',
        select_kana: 'okurigana_shift',
        type_yomi: 'sentence_to_ruby',
        stroke_order: 'stroke_order_trace',
        jukugo_yomi: 'jukugo_yomi',
        jukugo_type_yomi: 'jukugo_sentence_to_ruby'
      };
      var t = typeMap[m];
      if (!t) return arr.filter(function (q) { return q.type === 'ruby_to_kanji'; });
      return arr.filter(function (q) { return q.type === t; });
    }
    function shuffleKanjiQuizQuestionsArray(arr) {
      const a = Array.isArray(arr) ? arr.slice() : [];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    }
    function shuffleKanjiQuizChoicesArray(arr) {
      const a = Array.isArray(arr) ? arr.slice() : [];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    }
    /** 熟語よみ：「この中に回答はない」は常に末尾（右→左並びでは左端＝最後） */
    function shuffleKanjiQuizChoicesKeepingNoneLast_(arr) {
      const list = Array.isArray(arr) ? arr.slice() : [];
      const rest = [];
      const none = [];
      list.forEach(function (c) {
        if (c === JUKUGO_NONE_ANSWER_) none.push(c);
        else rest.push(c);
      });
      return shuffleKanjiQuizChoicesArray(rest).concat(none);
    }
    function isHiraganaChar_(ch) {
      if (!ch) return false;
      const cp = ch.codePointAt(0);
      if (cp >= 0x3041 && cp <= 0x3096) return true;
      if (cp === 0x3099 || cp === 0x309a) return true;
      if (cp === 0x30fc) return true;
      return false;
    }
    function shuffleInPlaceWithRng_(arr, rng) {
      const randomFn = typeof rng === "function" ? rng : Math.random;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }
    /**
     * 送り仮名境界クイズを自動生成する。
     * 入力: { kanji, reading, sentence }
     * 出力: { question_sentence, target_kanji, options, correct_option } | null
     */
    function generate_okurigana_quiz(input, rng) {
      try {
        const src = input && typeof input === "object" ? input : {};
        const kanji = String(src.kanji || "").trim();
        const reading = String(src.reading || "").trim();
        const sentence = String(src.sentence || "");
        if (!kanji || !reading || !sentence) return null;

        // Step1: 読み2文字以上、かつ例文中に対象漢字があるもののみ対象
        if (Array.from(reading).length < 2) return null;
        const idx = sentence.indexOf(kanji);
        if (idx < 0) return null;
        const afterIdx = idx + kanji.length;
        if (afterIdx >= sentence.length) return null;

        // Step2: 対象漢字の直後に連続するひらがな（送り仮名）を抽出
        let okurigana = "";
        for (let i = afterIdx; i < sentence.length; i++) {
          const ch = sentence.charAt(i);
          if (!isHiraganaChar_(ch)) break;
          okurigana += ch;
        }
        // 直後にひらがながないデータは対象外
        if (!okurigana) return null;

        // 抽出結果（例: 下る）
        const extractedBlock = kanji + okurigana;
        if (!extractedBlock) return null;

        // Step3: フルカナ = 読み + 送り仮名
        const fullKana = reading + okurigana;
        const fullLen = Array.from(fullKana).length;
        if (fullLen < 2) return null;

        // Step4: 分割位置 k=1..N-1 で選択肢生成
        const readingLen = Array.from(reading).length;
        const optionsRaw = [];
        let correctOption = "";
        const fullChars = Array.from(fullKana);
        for (let k = 1; k <= fullLen - 1; k++) {
          const opt = kanji + fullChars.slice(k).join("");
          if (!opt) continue;
          optionsRaw.push(opt);
          if (k === readingLen) correctOption = opt;
        }
        if (!correctOption) return null;

        // Step5: 重複除去 + 最大5択（正解は必ず残す）+ シャッフル
        let uniqueOptions = Array.from(new Set(optionsRaw));
        if (!uniqueOptions.includes(correctOption)) uniqueOptions.push(correctOption);
        if (uniqueOptions.length > 5) {
          const wrongs = uniqueOptions.filter(o => o !== correctOption);
          shuffleInPlaceWithRng_(wrongs, rng);
          uniqueOptions = [correctOption].concat(wrongs.slice(0, 4));
        }
        shuffleInPlaceWithRng_(uniqueOptions, rng);

        const qSentence =
          sentence.slice(0, idx) + "【" + kanji + "】" + sentence.slice(afterIdx);
        return {
          question_sentence: qSentence,
          target_kanji: kanji,
          options: uniqueOptions,
          correct_option: correctOption
        };
      } catch (e) {
        console.warn("generate_okurigana_quiz failed:", e);
        return null;
      }
    }
    function rebuildOkuriganaQuestionByAlgorithm_(q) {
      const src = q && typeof q === "object" ? q : {};
      const srcSentence =
        src.sentence ||
        src.exampleSentence ||
        src.exampleSentenceRaw ||
        src.contextSentenceReading ||
        "";
      const generated = generate_okurigana_quiz({
        kanji: src.kanji,
        reading: src.readingDisplay || src.reading || src.readingHint || "",
        sentence: srcSentence
      });
      if (!generated) return ensureOkuriganaExampleFields_(src);
      const out = Object.assign({}, src);
      out.kanji = generated.target_kanji;
      out.correctAnswer = generated.correct_option;
      out.choices = generated.options.slice();
      out.questionSentence = generated.question_sentence;
      // 例文表示用フィールドを必ず埋める
      const plainEx = String(generated.question_sentence || "")
        .replace(/[【】]/g, "")
        .trim();
      if (plainEx) {
        if (!out.exampleSentenceRaw) out.exampleSentenceRaw = plainEx;
        if (!out.sentence) out.sentence = plainEx;
        if (!out.contextSentenceReading) {
          // 出題用は読み置換文があればそれを、無ければ漢字入り例文
          out.contextSentenceReading = String(src.contextSentenceReading || "").trim() || plainEx;
        }
      }
      return ensureOkuriganaExampleFields_(out);
    }
    /** 送り仮名選択：表示用例文フィールドが空なら取りうる値から埋める */
    function ensureOkuriganaExampleFields_(q) {
      if (!q || typeof q !== "object") return q;
      var raw = String(q.exampleSentenceRaw || q.sentence || q.exampleSentence || "").trim();
      var readingSent = String(q.contextSentenceReading || "").trim();
      if (!raw && q.choicesDisplayMap && typeof q.choicesDisplayMap === "object") {
        var ans = String(q.correctAnswer || "");
        if (ans && q.choicesDisplayMap[ans]) {
          raw = String(q.choicesDisplayMap[ans] || "").trim();
        }
        if (!raw) {
          var keys = Object.keys(q.choicesDisplayMap);
          for (var i = 0; i < keys.length; i++) {
            var v = String(q.choicesDisplayMap[keys[i]] || "").trim();
            if (v) {
              raw = v;
              break;
            }
          }
        }
      }
      if (!raw && q.questionSentence) {
        raw = String(q.questionSentence || "")
          .replace(/[【】]/g, "")
          .trim();
      }
      if (raw && !q.exampleSentenceRaw) q.exampleSentenceRaw = raw;
      if (raw && !q.sentence) q.sentence = raw;
      if (!readingSent && raw) q.contextSentenceReading = raw;
      return q;
    }
    function prepareKanjiQuizQuestionsForPlay(rawList, formatModeOverride) {
      var mode = formatModeOverride || getKanjiQuizFormatMode();
      var normalized = (Array.isArray(rawList) ? rawList : []).map(function (q) {
        if (!q || q.type !== "okurigana_shift") return q;
        return rebuildOkuriganaQuestionByAlgorithm_(q);
      });
      var filtered = filterKanjiQuizQuestionsByFormat(normalized, mode);
      if (!filtered.length) {
        alert('この しかた では もんだいがありません。\nほかの しかたを えらんでください。');
        return null;
      }
      // 出題順のシャッフルは startKanjiQuizPlay 内で1回だけ行う（二重シャッフル防止）
      return { questions: filtered, formatMode: mode };
    }
    function kanjiQuizDrillCacheKeySets(modeId, unitName) {
      // v2: sheetKind（jukugo/standard）を必須とし、形式プルダウンの出し分けを正しくする
      return "app_cached_kanji_quiz_sets_v2_" + String(modeId || "") + "_" + String(unitName || "");
    }
    function kanjiQuizDrillCacheKeyQuestions(modeId, unitName, setId) {
      const fmt = getKanjiQuizFormatMode();
      let suffix = "";
      if (fmt === "jukugo_yomi") {
        // v2: 行ごとに熟語ABCのいずれか1問だけ出題
        suffix = "_v2_c" + getKanjiQuizJukugoChoiceCount() + "_n" + (getKanjiQuizJukugoIncludeNone() ? "1" : "0");
      } else if (fmt === "stroke_order") {
        suffix = "_stroke";
      } else if (fmt === "select_kana") {
        // 例文付き送り仮名選択のキャッシュ更新用
        suffix = "_okuri_ex2";
      }
      return (
        "app_cached_kanji_quiz_questions_" +
        String(modeId || "") +
        "_" +
        String(unitName || "") +
        "_" +
        String(setId || "") +
        suffix
      );
    }
    function buildKanjiQuizQuestionsFetchBody_(modeId, unitName, setId) {
      return {
        action: "get_kanji_quiz_questions",
        modeId: modeId,
        unitName: unitName,
        setId: setId,
        formatMode: getKanjiQuizFormatMode(),
        choiceCount: getKanjiQuizJukugoChoiceCount(),
        includeNoneOption: getKanjiQuizJukugoIncludeNone()
      };
    }
    const __kanjiQuizSetsSessionCache = Object.create(null);
    /** localStorage 失敗時でも同一セッション内はセット問題を再利用する */
    const __kanjiQuizQuestionsSessionCache = Object.create(null);
    function rememberKanjiQuizQuestionsCache_(qKey, payload) {
      if (!qKey || !payload || payload.status !== "success") return;
      __kanjiQuizQuestionsSessionCache[qKey] = payload;
      try { localStorage.setItem(qKey, JSON.stringify(payload)); } catch (_) {}
    }
    function readKanjiQuizQuestionsCache_(qKey) {
      if (!qKey) return null;
      if (__kanjiQuizQuestionsSessionCache[qKey]) return __kanjiQuizQuestionsSessionCache[qKey];
      try {
        const raw = localStorage.getItem(qKey);
        if (!raw) return null;
        const q = JSON.parse(raw);
        if (q && q.status === "success") {
          __kanjiQuizQuestionsSessionCache[qKey] = q;
          return q;
        }
      } catch (e) {}
      return null;
    }
    /** 漢字ドリル問題の先読みキュー（並列禁止。GAS 同時実行・タイムアウト対策） */
    var __kanjiQuizPrefetchGen = 0;
    var __kanjiQuizPrefetchPaused = false;
    var __kanjiQuizPrefetchRunning = false;
    var __kanjiQuizPrefetchQueue = [];
    var __kanjiQuizPrefetchGapMs = 350;
    function pauseKanjiQuizQuestionsPrefetch_() {
      __kanjiQuizPrefetchPaused = true;
    }
    function resumeKanjiQuizQuestionsPrefetch_() {
      __kanjiQuizPrefetchPaused = false;
      pumpKanjiQuizQuestionsPrefetch_();
    }
    function cancelKanjiQuizQuestionsPrefetch_() {
      __kanjiQuizPrefetchGen += 1;
      __kanjiQuizPrefetchQueue = [];
      __kanjiQuizPrefetchRunning = false;
      __kanjiQuizPrefetchPaused = false;
    }
    function fetchKanjiQuizQuestionsPayload_(modeId, unitName, setId, opts) {
      const o = opts || {};
      return gasApiFetchJson(buildKanjiQuizQuestionsFetchBody_(modeId, unitName, setId), {
        retries: typeof o.retries === "number" ? o.retries : 2,
        timeoutMs: typeof o.timeoutMs === "number" ? o.timeoutMs : 45000,
        parseRetries: typeof o.parseRetries === "number" ? o.parseRetries : 1,
        xhrFallback: o.xhrFallback !== false,
        retryDelaysMs: o.retryDelaysMs || [600, 1400]
      });
    }
    function fetchKanjiQuizQuestionsForSetStart_(modeId, unitName, setId) {
      return fetchKanjiQuizQuestionsPayload_(modeId, unitName, setId, {
        retries: 1,
        timeoutMs: 45000,
        parseRetries: 1,
        retryDelaysMs: [500, 1200]
      });
    }
    function pumpKanjiQuizQuestionsPrefetch_() {
      if (__kanjiQuizPrefetchPaused || __kanjiQuizPrefetchRunning) return;
      var job = __kanjiQuizPrefetchQueue.shift();
      if (!job) return;
      __kanjiQuizPrefetchRunning = true;
      var gen = __kanjiQuizPrefetchGen;
      fetchKanjiQuizQuestionsPayload_(job.modeId, job.unitName, job.setId, { retries: 2, timeoutMs: 75000 })
        .then(function (q) {
          if (gen !== __kanjiQuizPrefetchGen) return;
          if (q && q.status === "success") {
            rememberKanjiQuizQuestionsCache_(job.qKey, q);
          }
        })
        .catch(function () {})
        .then(function () {
          if (gen !== __kanjiQuizPrefetchGen) return;
          __kanjiQuizPrefetchRunning = false;
          if (!__kanjiQuizPrefetchPaused) {
            setTimeout(pumpKanjiQuizQuestionsPrefetch_, __kanjiQuizPrefetchGapMs);
          }
        });
    }
    /**
     * セット一覧表示時に、各セットの問題JSONを idle 時間で先読みしてキャッシュする。
     * GAS 負荷回避のため直列1本。ユーザーがセットを押したら一時停止する。
     * 既にキャッシュ済みのセットはスキップ。失敗は無視（押下時に再試行）。
     * 熟語シートはペイロードが大きく GAS 負荷も高いので先頭数セットだけ先読みする。
     */
    function prefetchKanjiQuizQuestionsForSets(modeId, unitName, sets, opts) {
      if (!Array.isArray(sets) || !sets.length) return;
      cancelKanjiQuizQuestionsPrefetch_();
      const o = opts || {};
      const isJukugo = o.sheetKind === "jukugo" || getKanjiQuizFormatMode() === "jukugo_yomi" || getKanjiQuizFormatMode() === "jukugo_type_yomi";
      const maxPrefetch = typeof o.maxPrefetch === "number"
        ? o.maxPrefetch
        : (isJukugo ? 2 : sets.length);
      __kanjiQuizPrefetchGapMs = isJukugo ? 700 : 350;
      var startPrefetch = function () {
        var queued = 0;
        sets.forEach(function (s) {
          if (queued >= maxPrefetch) return;
          var sid = String((s && s.setId) != null ? s.setId : "");
          if (!sid) return;
          var qKey = kanjiQuizDrillCacheKeyQuestions(modeId, unitName, sid);
          if (readKanjiQuizQuestionsCache_(qKey)) return;
          __kanjiQuizPrefetchQueue.push({
            modeId: modeId,
            unitName: unitName,
            setId: sid,
            qKey: qKey
          });
          queued += 1;
        });
        pumpKanjiQuizQuestionsPrefetch_();
      };
      try {
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(startPrefetch, { timeout: isJukugo ? 5000 : 3000 });
        } else {
          setTimeout(startPrefetch, isJukugo ? 400 : 200);
        }
      } catch (e) {
        try { setTimeout(startPrefetch, isJukugo ? 400 : 200); } catch (_) {}
      }
    }
    /**
     * 「漢字を書いてこたえる」用の iframe（#kp-pro-frame）を先行ロードしてキャッシュする。
     * セット一覧表示や、クイズキャンセル後のセット再入場でも呼び出すことで、
     * 「セット ○」を押してから「さいてんようの データを じゅんびしています…」の待ち時間を消す。
     * ensureKanjiHwFrameReadyOnce() を介して __kanjiQuizHwFrameReadyP に Promise を保持する点が重要。
     * 直接 ensureKanjiPracticeFrameReady() を呼ぶと毎回新しい Promise が作られ、
     * polling 1サイクル分のラグが残ってしまう。
     */
    function warmupKanjiQuizHandwritingFrame() {
      try {
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(function () {
            try { ensureKanjiHwFrameReadyOnce(); } catch (_) {}
            try { ensureKanjiWrongModelFrameReadyOnce(); } catch (_) {}
          }, { timeout: 2500 });
        } else {
          setTimeout(function () {
            try { ensureKanjiHwFrameReadyOnce(); } catch (_) {}
            try { ensureKanjiWrongModelFrameReadyOnce(); } catch (_) {}
          }, 120);
        }
      } catch (e) {}
    }
    function openKanjiQuizSets(modeId, modeName, unitName, btn, origText) {
      const title = document.getElementById('kanji-quiz-title');
      if (title) title.innerText = `【${modeName}】${formatUnitSheetDisplayLabel(unitName)}`;
      const box = document.getElementById('kanji-quiz-sets-container');
      if (box) box.innerHTML = "<p>セットを読み込み中...</p>";
      const setsCacheKey = kanjiQuizDrillCacheKeySets(modeId, unitName);
      const renderSetsButtons = function (d) {
        toggleBtnLoading(btn, false, origText);
        if (d.status !== "success") {
          alert("取得失敗: " + (d.message || "エラー"));
          return;
        }
        switchSection('section-kanji-quiz-sets');
        applyKanjiQuizSheetKind_(d.sheetKind || 'standard');
        syncKanjiQuizFormatSelectFromStorage();
        if (!box) return;
        box.innerHTML = "";
        const sets = Array.isArray(d.sets) ? d.sets : [];
        if (!sets.length) {
          box.innerHTML = "<p>セットが見つかりません。</p>";
          return;
        }
        const startFromQuestionsPayload = function (q, sid) {
          if (q.status !== "success") {
            hideKanjiQuizSetLoadingOverlay_();
            alert("取得失敗: " + (q.message || "エラー"));
            return;
          }
          var raw = Array.isArray(q.questions) ? q.questions : [];
          var prep = prepareKanjiQuizQuestionsForPlay(raw);
          if (!prep) {
            hideKanjiQuizSetLoadingOverlay_();
            return;
          }
          startKanjiQuizPlay({
            modeId: modeId,
            modeName: modeName,
            unitName: unitName,
            setId: String(sid != null ? sid : ""),
            allQuestions: raw,
            formatMode: prep.formatMode
          });
        };
        // この回で生成したセットボタン群（多重タップ抑止のため、押された時に他のボタンも一時無効化する）
        var __setBtnGroup = [];
        sets.forEach(s => {
          const b = document.createElement('button');
          b.className = "menu-btn btn-gray";
          b.innerText = `セット ${s.setId}（${s.count}字）`;
          __setBtnGroup.push(b);
          b.onclick = () => {
            // 既に押下中（自分自身がビジー）なら何もしない。
            if (b.dataset.kjBusyOriginalLabel != null) return;
            showKanjiQuizSetLoadingOverlay_("セット " + String(s.setId || ""));
            startKanjiActionBusy(b, "じゅんびちゅう");
            disableKanjiButtonGroupExcept(__setBtnGroup, b);
            /** 必ず startKanjiQuizPlay（confirm キャンセル可）より前にビジー解除する */
            const releaseBusyThenStartFromQuestions = function (q, sid) {
              stopKanjiActionBusy(b);
              restoreKanjiButtonGroup(__setBtnGroup);
              try {
                startFromQuestionsPayload(q, sid);
              } catch (err) {
                hideKanjiQuizSetLoadingOverlay_();
                console.error("セット開始処理で例外:", err);
              }
            };
            const qKey = kanjiQuizDrillCacheKeyQuestions(modeId, unitName, s.setId);
            // 先読みと競合しないよう、押下中は prefetch を止める（完了/失敗後に再開）
            pauseKanjiQuizQuestionsPrefetch_();
            const cachedQ = readKanjiQuizQuestionsCache_(qKey);
            if (cachedQ) {
              // キャッシュヒットでも、startKanjiQuizPlay は同期処理だが
              // 内部の警告ダイアログ等で時間がかかる可能性がある。
              // ボタン状態は switchSection で本セクションが非表示になることで自然解消されるが、
              // 万一 startKanjiQuizPlay がキャンセル（ユーザーが警告を閉じる）された場合に戻れるよう、
              // ここで一度復元してから呼ぶ。
              releaseBusyThenStartFromQuestions(cachedQ, cachedQ.setId != null ? cachedQ.setId : s.setId);
              resumeKanjiQuizQuestionsPrefetch_();
              return;
            }
            fetchKanjiQuizQuestionsForSetStart_(modeId, unitName, s.setId)
              .then(function (q) {
                if (q && q.status === "success") {
                  rememberKanjiQuizQuestionsCache_(qKey, q);
                }
                releaseBusyThenStartFromQuestions(q || { status: "error", message: "応答を解釈できませんでした。" }, s.setId);
              })
              .catch(function (err) {
                stopKanjiActionBusy(b);
                restoreKanjiButtonGroup(__setBtnGroup);
                hideKanjiQuizSetLoadingOverlay_();
                var detail = err && err.message ? String(err.message) : "";
                alert("通信エラーが発生しました。" + (detail ? "\n（" + detail.slice(0, 120) + "）" : "") + "\nもういちど「セット」を押してください。");
              })
              .then(function () {
                resumeKanjiQuizQuestionsPrefetch_();
              });
          };
          box.appendChild(b);
        });
        const sheetKind = d.sheetKind || kanjiQuizCurrentSheetKind_ || "standard";
        // 熟語読みは手書き iframe 不要。標準教材だけ先行ウォームアップする
        if (sheetKind !== "jukugo") {
          warmupKanjiQuizHandwritingFrame();
        }
        // 問題JSONを idle 時間に先読み（熟語は先頭2セットのみ。GAS負荷・容量対策）
        prefetchKanjiQuizQuestionsForSets(modeId, unitName, sets, { sheetKind: sheetKind });
      };
      if (__kanjiQuizSetsSessionCache[setsCacheKey] && __kanjiQuizSetsSessionCache[setsCacheKey].sheetKind) {
        renderSetsButtons(__kanjiQuizSetsSessionCache[setsCacheKey]);
        return;
      }
      const cachedSets = localStorage.getItem(setsCacheKey);
      if (cachedSets) {
        try {
          const d = JSON.parse(cachedSets);
          // sheetKind が無い古いキャッシュは使わず再取得（熟語なのに書き取り一択になる事故防止）
          if (d.status === "success" && d.sheetKind) {
            __kanjiQuizSetsSessionCache[setsCacheKey] = d;
            renderSetsButtons(d);
            return;
          }
        } catch (e) {}
      }
      gasApiFetchJson({ action: "get_kanji_quiz_sets", modeId: modeId, unitName: unitName }, {
        retries: 3,
        timeoutMs: 90000,
        xhrFallback: true,
        retryDelaysMs: [800, 1800, 3200]
      })
      .then(function (d) {
        if (d && d.status === "success") {
          try { localStorage.setItem(setsCacheKey, JSON.stringify(d)); } catch (e) {}
          __kanjiQuizSetsSessionCache[setsCacheKey] = d;
        }
        renderSetsButtons(d || { status: "error", message: "応答を解釈できませんでした。" });
      }).catch(function (e) {
        toggleBtnLoading(btn, false, origText);
        var detail = e && e.message ? String(e.message) : "";
        alert("通信エラーが発生しました。" + (detail ? "\n（" + detail.slice(0, 120) + "）" : "") + "\nもういちど試してください。");
      });
    }
    const KANJI_QUIZ_HAND_PASS = 60;
    /**
     * 手書き採点配点（管理ブック指定）は6項目とも100点満点中の絶対点。
     * 既定合計: 画数10 + 画順20 + 軌道28 + 始点終点10 + 構造14 + 大きさ18 = 100
     */
    const KANJI_HW_ABS_POINT_DEFAULTS = {
      strokeCount: 10,
      strokeOrder: 20,
      trajectory: 28,
      startEnd: 10,
      structure: 14,
      size: 18
    };
    const KANJI_HW_SCORE_WEIGHT_KEYS = ["trajectory", "startEnd", "structure", "size", "strokeCount", "strokeOrder"];
    /** 絶対点（0〜100）。比率(≦1)なら×100。空なら fallback */
    function parseKanjiHandScoreAbsolutePoints_(val, fallbackPts) {
      if (val === undefined || val === null || String(val).trim() === "") return fallbackPts;
      const n = Number(val);
      if (isNaN(n) || n < 0) return fallbackPts;
      const pts = n <= 1 ? n * 100 : n;
      return Math.max(0, Math.min(100, pts));
    }
    /** 整数配点に丸め、合計を total に合わせる（最大剰余法） */
    function roundKanjiHandAbsPointsToTotal_(ptsArr, total) {
      const src = (ptsArr || []).map(function (p) {
        return Math.max(0, Number(p) || 0);
      });
      const n = src.length;
      if (!n) return [];
      const sum = src.reduce(function (a, b) {
        return a + b;
      }, 0);
      if (sum <= 0) {
        const even = Math.floor(total / n);
        const out = Array(n).fill(even);
        out[0] += total - even * n;
        return out;
      }
      const scaled = src.map(function (p) {
        return (p * total) / sum;
      });
      const floors = scaled.map(function (p) {
        return Math.floor(p);
      });
      let used = floors.reduce(function (a, b) {
        return a + b;
      }, 0);
      let remain = total - used;
      const order = scaled
        .map(function (p, i) {
          return { i: i, frac: p - floors[i] };
        })
        .sort(function (a, b) {
          return b.frac - a.frac;
        });
      for (let k = 0; k < order.length && remain > 0; k++) {
        floors[order[k].i] += 1;
        remain -= 1;
      }
      return floors;
    }
    function normalizeKanjiHandScoreWeights_(raw) {
      raw = raw && typeof raw === "object" ? raw : {};
      function pickPts_(ptsKey, altKey, fallback) {
        if (raw[ptsKey] != null && String(raw[ptsKey]).trim() !== "" && !isNaN(Number(raw[ptsKey]))) {
          const n = Number(raw[ptsKey]);
          /* 旧キャッシュの比率(0〜1)は絶対点へ換算しない（legacy 分岐で扱う） */
          if (n > 1 || ptsKey.indexOf("Pts") >= 0) return Math.max(0, Math.min(100, n));
        }
        if (raw[altKey] != null && String(raw[altKey]).trim() !== "") {
          return parseKanjiHandScoreAbsolutePoints_(raw[altKey], fallback);
        }
        return fallback;
      }

      let countPts;
      let orderPts;
      let trajPts;
      let sePts;
      let strPts;
      let sizePts;

      const legacyRatio =
        typeof raw.shapeBudget === "number" &&
        raw.shapeBudget >= 0 &&
        typeof raw.trajectory === "number" &&
        raw.trajectory > 0 &&
        raw.trajectory <= 1 &&
        typeof raw.strokeCountPts === "number" &&
        raw.trajectoryPts == null;

      if (legacyRatio) {
        countPts = Math.max(0, Number(raw.strokeCountPts) || 0);
        orderPts = Math.max(0, Number(raw.strokeOrderPts) || 0);
        const budget = Math.max(0, Number(raw.shapeBudget) || 0);
        trajPts = budget * (Number(raw.trajectory) || 0);
        sePts = budget * (Number(raw.startEnd) || 0);
        strPts = budget * (Number(raw.structure) || 0);
        sizePts = budget * (Number(raw.size) || 0);
      } else {
        countPts = pickPts_("strokeCountPts", "strokeCount", KANJI_HW_ABS_POINT_DEFAULTS.strokeCount);
        orderPts = pickPts_("strokeOrderPts", "strokeOrder", KANJI_HW_ABS_POINT_DEFAULTS.strokeOrder);
        trajPts = pickPts_("trajectoryPts", "trajectory", KANJI_HW_ABS_POINT_DEFAULTS.trajectory);
        sePts = pickPts_("startEndPts", "startEnd", KANJI_HW_ABS_POINT_DEFAULTS.startEnd);
        strPts = pickPts_("structurePts", "structure", KANJI_HW_ABS_POINT_DEFAULTS.structure);
        sizePts = pickPts_("sizePts", "size", KANJI_HW_ABS_POINT_DEFAULTS.size);

        /* 旧管理ブック: 形4項目が比率％合計≈100で、ゲートと足すと100超 → 残り枠へ換算 */
        const shapeSum = trajPts + sePts + strPts + sizePts;
        const gateSum = countPts + orderPts;
        const allSum = gateSum + shapeSum;
        if (allSum > 100.5 && shapeSum >= 95 && shapeSum <= 105.5 && gateSum < 100) {
          const budget = Math.max(0, 100 - gateSum);
          trajPts = budget * (trajPts / shapeSum);
          sePts = budget * (sePts / shapeSum);
          strPts = budget * (strPts / shapeSum);
          sizePts = budget * (sizePts / shapeSum);
        }
      }

      const rounded = roundKanjiHandAbsPointsToTotal_(
        [countPts, orderPts, trajPts, sePts, strPts, sizePts],
        100
      );
      const shapeBudget = rounded[2] + rounded[3] + rounded[4] + rounded[5];
      return {
        strokeCountPts: rounded[0],
        strokeOrderPts: rounded[1],
        trajectoryPts: rounded[2],
        startEndPts: rounded[3],
        structurePts: rounded[4],
        sizePts: rounded[5],
        totalMax: 100,
        /* 互換: 旧iframeが shapeBudget + 比率を読んでも同等になるよう残す */
        shapeBudget: shapeBudget,
        trajectory: shapeBudget > 0 ? rounded[2] / shapeBudget : 0,
        startEnd: shapeBudget > 0 ? rounded[3] / shapeBudget : 0,
        structure: shapeBudget > 0 ? rounded[4] / shapeBudget : 0,
        size: shapeBudget > 0 ? rounded[5] / shapeBudget : 0
      };
    }
    function buildKanjiHandScoreWeightsFromSettings_(settings) {
      const src = settings && typeof settings === "object" ? settings : {};
      const raw = {
        strokeCountPts: parseKanjiHandScoreAbsolutePoints_(
          src.strokeCount,
          KANJI_HW_ABS_POINT_DEFAULTS.strokeCount
        ),
        strokeOrderPts: parseKanjiHandScoreAbsolutePoints_(
          src.strokeOrder,
          KANJI_HW_ABS_POINT_DEFAULTS.strokeOrder
        ),
        trajectoryPts: parseKanjiHandScoreAbsolutePoints_(
          src.trajectory,
          KANJI_HW_ABS_POINT_DEFAULTS.trajectory
        ),
        startEndPts: parseKanjiHandScoreAbsolutePoints_(src.startEnd, KANJI_HW_ABS_POINT_DEFAULTS.startEnd),
        structurePts: parseKanjiHandScoreAbsolutePoints_(
          src.structure,
          KANJI_HW_ABS_POINT_DEFAULTS.structure
        ),
        sizePts: parseKanjiHandScoreAbsolutePoints_(src.size, KANJI_HW_ABS_POINT_DEFAULTS.size)
      };
      return normalizeKanjiHandScoreWeights_(raw);
    }
    function persistKanjiHandScoreWeightsFromSettings(settings) {
      const normalized = buildKanjiHandScoreWeightsFromSettings_(settings);
      kanjiHandScoreWeightsMem = normalized;
      try {
        localStorage.setItem(LS_APP_CACHED_KANJI_HAND_SCORE_WEIGHTS, JSON.stringify({
          status: "success",
          sourceSettings: KANJI_HW_SCORE_WEIGHT_KEYS.reduce(function (acc, k) {
            acc[k] = settings && settings[k] !== undefined ? settings[k] : "";
            return acc;
          }, {}),
          weightsNormalized: normalized,
          updatedAt: Date.now()
        }));
      } catch (e) {}
      syncKanjiHandScoreWeightsToFrame(document.getElementById("kp-pro-frame"));
      return normalized;
    }
    function loadKanjiHandScoreWeightsFromLocalCache() {
      if (kanjiHandScoreWeightsMem) return kanjiHandScoreWeightsMem;
      /* 1) 配点専用キャッシュ: sourceSettings があれば管理ブック値から再構築（旧正規化の stale を避ける） */
      try {
        const raw = localStorage.getItem(LS_APP_CACHED_KANJI_HAND_SCORE_WEIGHTS);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.sourceSettings && typeof d.sourceSettings === "object") {
            const hasAny = KANJI_HW_SCORE_WEIGHT_KEYS.some(function (k) {
              return d.sourceSettings[k] !== undefined && d.sourceSettings[k] !== null && String(d.sourceSettings[k]).trim() !== "";
            });
            if (hasAny) {
              kanjiHandScoreWeightsMem = buildKanjiHandScoreWeightsFromSettings_(d.sourceSettings);
              return kanjiHandScoreWeightsMem;
            }
          }
          if (
            d &&
            d.weightsNormalized &&
            (typeof d.weightsNormalized.trajectoryPts === "number" ||
              typeof d.weightsNormalized.trajectory === "number" ||
              typeof d.weightsNormalized.strokeCountPts === "number")
          ) {
            kanjiHandScoreWeightsMem = normalizeKanjiHandScoreWeights_(d.weightsNormalized);
            return kanjiHandScoreWeightsMem;
          }
        }
      } catch (e) {}
      /* 2) アプリ設定キャッシュから配点を復元 */
      try {
        const legacy = localStorage.getItem("app_cached_settings");
        if (legacy) {
          const d = JSON.parse(legacy);
          if (d && d.settings) {
            kanjiHandScoreWeightsMem = buildKanjiHandScoreWeightsFromSettings_(d.settings);
            try { persistKanjiHandScoreWeightsFromSettings(d.settings); } catch (_eP) {}
            return kanjiHandScoreWeightsMem;
          }
        }
      } catch (e2) {}
      kanjiHandScoreWeightsMem = normalizeKanjiHandScoreWeights_({
        strokeCountPts: KANJI_HW_ABS_POINT_DEFAULTS.strokeCount,
        strokeOrderPts: KANJI_HW_ABS_POINT_DEFAULTS.strokeOrder,
        trajectoryPts: KANJI_HW_ABS_POINT_DEFAULTS.trajectory,
        startEndPts: KANJI_HW_ABS_POINT_DEFAULTS.startEnd,
        structurePts: KANJI_HW_ABS_POINT_DEFAULTS.structure,
        sizePts: KANJI_HW_ABS_POINT_DEFAULTS.size
      });
      return kanjiHandScoreWeightsMem;
    }
    function getKanjiHandScoreWeights() {
      return loadKanjiHandScoreWeightsFromLocalCache();
    }
    function fetchKanjiHandScoreWeightsFromServer(opts) {
      const apiOpts = opts || GAS_API_OPTS_HOME_REFRESH;
      return gasApiFetchJson({ action: "get_app_settings" }, apiOpts)
        .then(function (d) {
          if (!d || d.status !== "success" || !d.settings) {
            return { status: "error", message: (d && d.message) || "手書き配点の取得に失敗しました", updated: false };
          }
          var prevSig = "";
          try {
            const cached = localStorage.getItem(LS_APP_CACHED_KANJI_HAND_SCORE_WEIGHTS);
            if (cached) prevSig = JSON.stringify(JSON.parse(cached).sourceSettings || {});
          } catch (e) {}
          const nextSig = JSON.stringify(KANJI_HW_SCORE_WEIGHT_KEYS.reduce(function (acc, k) {
            acc[k] = d.settings[k] !== undefined ? d.settings[k] : "";
            return acc;
          }, {}));
          persistKanjiHandScoreWeightsFromSettings(d.settings);
          return { status: "success", updated: nextSig !== prevSig, settings: d.settings };
        });
    }
    function syncKanjiHandScoreWeightsToFrame(frame) {
      if (!frame) return;
      try {
        const win = frame.contentWindow;
        if (!win) return;
        win.__kpHandScoreWeights = getKanjiHandScoreWeights();
      } catch (e) {}
    }
    const kanjiQuizWriteLogicalSize = 300;
    let kanjiQuizParentStrokes = [];
    /** 書き順クイズ：記述欄に常時出すなぞり軌道（練習 trace の #f0f0f0 ガイド相当） */
    let kanjiQuizTraceGuideStrokes = [];
    let kanjiQuizCurrentStrokePoints = [];
    let kanjiQuizIsDrawing = false;
    let kanjiQuizPenW = 8;
    let kanjiQuizStrokeStartTime = 0;
    let kanjiQuizScrollLockUntil = 0;
    let __kanjiQuizWriteCanvasBound = false;
    let __kanjiQuizWriteReflowListenersBound = false;
    let __kanjiQuizHwFrameReadyP = null;
    let __kanjiQuizWrongFrameReadyP = null;
    let __kanjiQuizScrollGuardBound = false;
    let __kanjiQuizPalmGuardBound = false;
    let __kanjiQuizTouchLockLastBump = 0;
    let __kanjiPracticeLastSubmitAt = 0;
    let __kanjiPracticeLastSubmitKey = "";
    function clearKanjiHwFrameReadyCache() {
      __kanjiQuizHwFrameReadyP = null;
      __kanjiQuizWrongFrameReadyP = null;
    }
    function kanjiQuizTouchScrollLockActive() {
      return Date.now() < kanjiQuizScrollLockUntil;
    }
    function markKanjiQuizTouchDrawActivity(lockMs) {
      const dur = Math.max(0, Number(lockMs) || 0);
      kanjiQuizScrollLockUntil = Date.now() + dur;
    }
    function isKanjiQuizHandwritingPlayActive_() {
      const sec = document.getElementById("section-kanji-quiz-play");
      if (!sec || !sec.classList.contains("active")) return false;
      return (
        sec.classList.contains("kanji-quiz-hw-active") ||
        sec.classList.contains("kanji-quiz-stroke-order-active")
      );
    }
    /** 手書き中のテキスト選択・長押しコールアウト・ドラッグ開始を止める */
    function bindKanjiQuizPalmRejectionGuard() {
      if (__kanjiQuizPalmGuardBound) return;
      __kanjiQuizPalmGuardBound = true;
      const CARD_SEL =
        "#kanji-quiz-drill-handwriting, .kanji-drill-hw-row, .kanji-drill-hw-canvas-panel, .kanji-quiz-wrong-model-wrap, #kanji-quiz-hw-wrong-panel, .kanji-drill-hw-prefix-col, .kanji-drill-hw-suffix-col, #kanji-play-char-handwriting, #kanji-play-prompt, .kanji-quiz-title-rail-wrap, #kanji-hw-score-status, #kanji-stroke-order-readings, .kanji-stroke-order-readings";
      const isInHwCard_ = function (t) {
        return !!(t && t.closest && t.closest(CARD_SEL));
      };
      const clearSel_ = function () {
        try {
          const sel = window.getSelection && window.getSelection();
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
        } catch (_e) {}
      };
      const shouldBlock = function (e) {
        if (!isKanjiQuizHandwritingPlayActive_()) return false;
        const t = e && e.target;
        if (!t || !t.closest) return true;
        if (t.closest("button, a, input, textarea, select, label, [contenteditable='true']")) return false;
        return true;
      };
      const block = function (e) {
        if (!shouldBlock(e)) return;
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        clearSel_();
      };
      document.addEventListener("selectstart", block, true);
      document.addEventListener("dragstart", block, true);
      document.addEventListener("contextmenu", block, true);
      document.addEventListener(
        "selectionchange",
        function () {
          if (!isKanjiQuizHandwritingPlayActive_()) return;
          clearSel_();
        },
        true
      );
      /* カード内の pointer 開始で選択を即クリア（掌・ペン先の擦れ対策） */
      document.addEventListener(
        "pointerdown",
        function (e) {
          if (!isKanjiQuizHandwritingPlayActive_()) return;
          if (!isInHwCard_(e.target)) return;
          clearSel_();
        },
        true
      );
      /* iOS 等: 表示文字上の長押しで選択ハンドルが出るのを抑止 */
      document.addEventListener(
        "touchstart",
        function (e) {
          if (!shouldBlock(e)) return;
          const t = e.target;
          if (!t || !t.closest) return;
          if (!isInHwCard_(t)) return;
          /* canvas 自身の描画は別リスナが preventDefault する */
          if (t.id === "kanji-quiz-write-canvas" || (t.closest && t.closest("#kanji-quiz-write-canvas"))) {
            clearSel_();
            return;
          }
          if (t.closest && t.closest("button, a, input, textarea, select, label")) return;
          if (typeof e.preventDefault === "function") e.preventDefault();
          clearSel_();
        },
        { capture: true, passive: false }
      );
    }
    /** お手本 iframe 内でも選択不可にする */
    function injectKanjiFrameNoSelectStyle_(frame) {
      try {
        const doc = frame && frame.contentDocument;
        if (!doc || !doc.head) return;
        if (doc.getElementById("kj-embed-no-select")) return;
        const st = doc.createElement("style");
        st.id = "kj-embed-no-select";
        st.textContent =
          "html,body,body *,body *::before,body *::after{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent;-webkit-user-drag:none!important;}" +
          "input,textarea,select,[contenteditable='true']{-webkit-user-select:text!important;user-select:text!important;}" +
          "#canvas{-webkit-user-drag:none;touch-action:none;}";
        doc.head.appendChild(st);
        if (!doc.documentElement.dataset.kjNoSelectBound) {
          doc.documentElement.dataset.kjNoSelectBound = "1";
          const clear = function () {
            try {
              const s = doc.getSelection && doc.getSelection();
              if (s && s.removeAllRanges) s.removeAllRanges();
            } catch (_e) {}
          };
          const block = function (ev) {
            const t = ev && ev.target;
            if (t && t.closest && t.closest("input,textarea,select,button,[contenteditable='true']")) return;
            if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
            clear();
          };
          doc.addEventListener("selectstart", block, true);
          doc.addEventListener("dragstart", block, true);
          doc.addEventListener("contextmenu", block, true);
          doc.addEventListener("selectionchange", clear, true);
        }
      } catch (_eInj) {}
    }
    function bindKanjiQuizScrollGuard() {
      if (__kanjiQuizScrollGuardBound) return;
      __kanjiQuizScrollGuardBound = true;
      bindKanjiQuizPalmRejectionGuard();
      const stopIfLocked = function (e) {
        if (!kanjiQuizTouchScrollLockActive()) return;
        const sec = document.getElementById("section-kanji-quiz-play");
        if (!sec || !sec.classList.contains("active")) return;
        if (e && typeof e.preventDefault === "function") e.preventDefault();
      };
      document.addEventListener("touchmove", stopIfLocked, { passive: false });
      document.addEventListener("wheel", stopIfLocked, { passive: false });
    }
    function ensureKanjiHwFrameReadyOnce() {
      if (!__kanjiQuizHwFrameReadyP) {
        __kanjiQuizHwFrameReadyP = ensureKanjiPracticeFrameReady().catch(function (err) {
          console.warn("ensureKanjiPracticeFrameReady failed:", err);
          __kanjiQuizHwFrameReadyP = null;
          return null;
        });
      }
      return __kanjiQuizHwFrameReadyP;
    }
    function ensureKanjiWrongModelFrameReadyOnce() {
      if (!__kanjiQuizWrongFrameReadyP) {
        __kanjiQuizWrongFrameReadyP = ensureKanjiWrongModelFrameReady().catch(function (err) {
          console.warn("ensureKanjiWrongModelFrameReady failed:", err);
          __kanjiQuizWrongFrameReadyP = null;
          return null;
        });
      }
      return __kanjiQuizWrongFrameReadyP;
    }
    function abandonKanjiQuizPlayIfLeavingSection(newSectionId) {
      const quizPlayEl = document.getElementById("section-kanji-quiz-play");
      const wasPlay = quizPlayEl && quizPlayEl.classList.contains("active");
      if (!wasPlay || newSectionId === "section-kanji-quiz-play" || !kanjiQuizSession) return;
      kanjiQuizSession = null;
      lastKanjiQuizContext = null;
      clearKanjiHwFrameReadyCache();
      try {
        kanjiQuizClearWritePad(true);
      } catch (e) {}
      restoreKanjiPracticeFrameIfMoved();
      resetKanjiQuizDrillPlayShell();
      setKanjiQuizPlayHwFooterActive(false);
    }
    function parseMaskedForDrill(s) {
      const str = String(s || "");
      const idx = str.search(/[＿_〼]/);
      if (idx < 0) return { before: str, after: "" };
      let rest = str.slice(idx + 1);
      rest = rest.replace(/^[＿_〼]+/, "");
      return { before: str.slice(0, idx), after: rest };
    }
    function kanjiQuizCircledQuestionNum(n) {
      const i = Math.max(1, Number(n) || 1);
      if (i <= 20) return String.fromCodePoint(0x245f + i);
      return "(" + i + ")";
    }
    function kanjiQuizCanvasXY(e, canvas) {
      const r = canvas.getBoundingClientRect();
      const L = kanjiQuizWriteLogicalSize;
      return { x: (e.clientX - r.left) * (L / Math.max(1, r.width)), y: (e.clientY - r.top) * (L / Math.max(1, r.height)) };
    }
    function getKanjiQuizStrokeParams() {
      const DEFAULT_PARAMS = {
        baseWidth: 11.0,
        tomeStart: 0.9,
        tomeScale: 1.3,
        haneStart: 0.9,
        haneSharp: 0.55,
        haraiStart: 0.65,
        haraiSharp: 0.8
      };
      try {
        const saved = localStorage.getItem("kanjiStrokeParamsV2");
        if (saved) {
          const o = JSON.parse(saved);
          return Object.assign({}, DEFAULT_PARAMS, o);
        }
      } catch (e) {}
      return Object.assign({}, DEFAULT_PARAMS);
    }
    function kanjiQuizEffectiveBaseWidth() {
      const p = getKanjiQuizStrokeParams();
      const bw = typeof p.baseWidth === "number" ? p.baseWidth : 11;
      return Math.max(4, Math.min(18, bw));
    }
    function kanjiQuizFillBetween(ctx, start, end, width) {
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      const steps = Math.max(1, Math.ceil(dist * 2.5));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.beginPath();
        ctx.arc(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t, width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function kanjiQuizRenderStrokeWithEffect(ctx, points, type, color) {
      const P = getKanjiQuizStrokeParams();
      const bW = typeof P.baseWidth === "number" ? Math.max(4, Math.min(18, P.baseWidth)) : 11;
      const strokeType = type === "none" ? "tome" : type;
      ctx.fillStyle = color || "#333";
      if (!points || !points.length) return;
      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, Math.max(0.5, bW / 2), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const n = points.length;
      for (let i = 0; i < n - 1; i++) {
        const ratio = i / (n - 1);
        let w = bW;
        if (strokeType === "harai" && ratio > P.haraiStart) {
          const denom = 1 - P.haraiStart || 0.001;
          w *= Math.max(0.1, 1 - P.haraiSharp * ((ratio - P.haraiStart) / denom));
        } else if (strokeType === "hane" && ratio > P.haneStart) {
          const denom = 1 - P.haneStart || 0.001;
          w *= Math.max(0.1, 1 - P.haneSharp * ((ratio - P.haneStart) / denom));
        } else if (strokeType === "tome" && ratio > P.tomeStart) {
          const denom = 1 - P.tomeStart || 0.001;
          w *= 1 + (P.tomeScale - 1) * ((ratio - P.tomeStart) / denom);
        }
        kanjiQuizFillBetween(ctx, points[i], points[i + 1], Math.max(0.5, w));
      }
    }
    function kanjiQuizDrawLiveStrokeSegments(ctx, points) {
      const w = kanjiQuizEffectiveBaseWidth();
      ctx.fillStyle = "#333";
      if (!points || !points.length) return;
      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, Math.max(0.5, w / 2), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (let i = 0; i < points.length - 1; i++) {
        kanjiQuizFillBetween(ctx, points[i], points[i + 1], w);
      }
    }
    function kanjiQuizWebKitCanvasPaintNudge_(canvas) {
      if (!canvas) return;
      try {
        canvas.style.transform = "translateZ(0)";
        canvas.style.webkitTransform = "translateZ(0)";
        void canvas.offsetWidth;
      } catch (e) {}
    }
    function kanjiQuizDrillHandwritingDisplayed() {
      const el = document.getElementById("kanji-quiz-drill-handwriting");
      if (!el) return false;
      try {
        return window.getComputedStyle(el).display !== "none";
      } catch (e) {
        return el.style.display !== "none";
      }
    }
    function kanjiQuizRedrawParentCanvas(livePts) {
      const canvas = document.getElementById("kanji-quiz-write-canvas");
      if (!canvas || !canvas.getContext) return;
      const L = kanjiQuizWriteLogicalSize;
      const dpr = window.devicePixelRatio || 1;
      var ctx;
      try {
        ctx = canvas.getContext("2d", { alpha: true });
      } catch (eCtx) {
        ctx = canvas.getContext("2d");
      }
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      /* 背景のグリッドは CSS（漢字練習 iframe と同じ）に任せ、白矩形は塗らない */
      /* 書き順：なぞるべき軌道を先に薄く描く（漢字練習 drawTraceGuide と同じ色） */
      if (kanjiQuizTraceGuideStrokes && kanjiQuizTraceGuideStrokes.length) {
        kanjiQuizTraceGuideStrokes.forEach(function (s) {
          if (!s || !s.points || !s.points.length) return;
          kanjiQuizRenderStrokeWithEffect(ctx, s.points, s.type || "tome", "#f0f0f0");
        });
      }
      kanjiQuizParentStrokes.forEach(function (s) {
        if (!s.points || !s.points.length) return;
        kanjiQuizRenderStrokeWithEffect(ctx, s.points, s.type, "#333");
      });
      if (livePts && livePts.length) {
        kanjiQuizDrawLiveStrokeSegments(ctx, livePts);
      }
      kanjiQuizWebKitCanvasPaintNudge_(canvas);
    }
    function kanjiQuizSetupWriteCanvas() {
      const canvas = document.getElementById("kanji-quiz-write-canvas");
      if (!canvas) return;
      const L = kanjiQuizWriteLogicalSize;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = L * dpr;
      canvas.height = L * dpr;
      canvas.style.width = L + "px";
      canvas.style.height = L + "px";
      if (!__kanjiQuizWriteCanvasBound) {
        __kanjiQuizWriteCanvasBound = true;
        bindKanjiQuizScrollGuard();
        function canStartKanjiQuizDraw() {
          if (!kanjiQuizSession || !document.getElementById("section-kanji-quiz-play") || !document.getElementById("section-kanji-quiz-play").classList.contains("active")) return;
          const q = kanjiQuizSession.questions[kanjiQuizSession.index];
          if (!q || !isKanjiQuizHandwritingQuestionType_(q.type)) return;
          if (kanjiQuizHwAnswerSubmitted_()) return;
          if (typeof kanjiQuizSession.hwPassPendingAdvance === "function") return;
          return true;
        }
        function beginStrokeAt(clientX, clientY) {
          const r = canvas.getBoundingClientRect();
          const px = (clientX - r.left) * (kanjiQuizWriteLogicalSize / Math.max(1, r.width));
          const py = (clientY - r.top) * (kanjiQuizWriteLogicalSize / Math.max(1, r.height));
          kanjiQuizIsDrawing = true;
          kanjiQuizStrokeStartTime = Date.now();
          __kanjiQuizTouchLockLastBump = Date.now();
          markKanjiQuizTouchDrawActivity(700);
          kanjiQuizCurrentStrokePoints = [];
          kanjiQuizCurrentStrokePoints.push({ x: px, y: py });
          kanjiQuizRedrawParentCanvas(kanjiQuizCurrentStrokePoints);
        }
        function moveStrokeAt(clientX, clientY) {
          if (!kanjiQuizIsDrawing) return;
          const r = canvas.getBoundingClientRect();
          const px = (clientX - r.left) * (kanjiQuizWriteLogicalSize / Math.max(1, r.width));
          const py = (clientY - r.top) * (kanjiQuizWriteLogicalSize / Math.max(1, r.height));
          kanjiQuizCurrentStrokePoints.push({ x: px, y: py });
          const now = Date.now();
          if (now - __kanjiQuizTouchLockLastBump >= 260) {
            __kanjiQuizTouchLockLastBump = now;
            markKanjiQuizTouchDrawActivity(700);
          }
          kanjiQuizRedrawParentCanvas(kanjiQuizCurrentStrokePoints);
        }
        function endStroke() {
          if (!kanjiQuizIsDrawing) return;
          kanjiQuizIsDrawing = false;
          markKanjiQuizTouchDrawActivity(420);
          const pts = kanjiQuizCurrentStrokePoints.map(function (p) {
            return { x: p.x, y: p.y };
          });
          if (pts.length) {
            const typ = kanjiQuizClassifyStroke(pts, kanjiQuizStrokeStartTime);
            kanjiQuizParentStrokes.push({ type: typ, points: pts });
            kanjiQuizMaybeRealtimeStrokeOrderJudge_();
          }
          kanjiQuizCurrentStrokePoints = [];
          kanjiQuizRedrawParentCanvas();
        }
        canvas.addEventListener("pointerdown", function (e) {
          if (!canStartKanjiQuizDraw()) return;
          e.preventDefault();
          canvas.setPointerCapture(e.pointerId);
          beginStrokeAt(e.clientX, e.clientY);
        });
        canvas.addEventListener("pointermove", function (e) {
          if (kanjiQuizIsDrawing) e.preventDefault();
          moveStrokeAt(e.clientX, e.clientY);
        });
        canvas.addEventListener("pointerup", function (e) {
          if (kanjiQuizIsDrawing) e.preventDefault();
          endStroke();
        });
        canvas.addEventListener("pointercancel", function (e) {
          if (kanjiQuizIsDrawing) e.preventDefault();
          kanjiQuizIsDrawing = false;
          kanjiQuizCurrentStrokePoints = [];
          kanjiQuizRedrawParentCanvas();
        });
        canvas.addEventListener("mousedown", function (e) {
          if (!canStartKanjiQuizDraw()) return;
          e.preventDefault();
          beginStrokeAt(e.clientX, e.clientY);
        });
        window.addEventListener("mousemove", function (e) {
          if (!kanjiQuizIsDrawing) return;
          moveStrokeAt(e.clientX, e.clientY);
        });
        window.addEventListener("mouseup", function () {
          endStroke();
        });
        canvas.addEventListener("touchstart", function (e) {
          if (!canStartKanjiQuizDraw()) return;
          if (!e.touches || !e.touches.length) return;
          e.preventDefault();
          beginStrokeAt(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        canvas.addEventListener("touchmove", function (e) {
          if (!kanjiQuizIsDrawing || !e.touches || !e.touches.length) return;
          e.preventDefault();
          moveStrokeAt(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        canvas.addEventListener("touchend", function () {
          endStroke();
        });
      }
      bindKanjiQuizWriteCanvasReflowListeners();
      kanjiQuizRedrawParentCanvas();
    }
    /** レイアウト確定後にキャンバス解像度・スケールを取り直す（回転・リサイズと同じ経路） */
    function kanjiQuizReflowWriteCanvasForCurrentLayout() {
      const sec = document.getElementById("section-kanji-quiz-play");
      if (!sec || !sec.classList.contains("active")) return;
      if (!kanjiQuizSession) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || !isKanjiQuizHandwritingQuestionType_(q.type)) return;
      if (!kanjiQuizDrillHandwritingDisplayed()) return;
      kanjiQuizSetupWriteCanvas();
      /* リサイズでバッファが消えるので、なぞり軌道＋手書きを描き直す */
      kanjiQuizRedrawParentCanvas();
    }
    function kanjiQuizScheduleWriteCanvasReflow() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          kanjiQuizReflowWriteCanvasForCurrentLayout();
        });
      });
    }
    /** 手書きクイズ：iframe の高さ・親キャンバスを取り直す（表示ずれ対策の手動トリガー） */
    function kanjiQuizRefreshHandwritingLayout() {
      try {
        window.scrollBy(0, 0);
      } catch (eScroll) {}
      try {
        kanjiQuizReflowWriteCanvasForCurrentLayout();
      } catch (e0) {}
      try {
        kpResizeFrameToContent();
      } catch (e1) {}
      try {
        kanjiQuizScheduleWriteCanvasReflow();
      } catch (e2) {}
      try {
        var c = document.getElementById("kanji-quiz-write-canvas");
        kanjiQuizWebKitCanvasPaintNudge_(c);
      } catch (eNudge) {}
      try {
        kanjiQuizResetHwViewportScroll_();
      } catch (eScrHw) {}
      setTimeout(function () {
        try {
          kpResizeFrameToContent();
        } catch (e3) {}
      }, 120);
      setTimeout(function () {
        try {
          kanjiQuizReflowWriteCanvasForCurrentLayout();
        } catch (e4) {}
      }, 240);
      setTimeout(function () {
        try {
          var cv = document.getElementById("kanji-quiz-write-canvas");
          kanjiQuizWebKitCanvasPaintNudge_(cv);
        } catch (e5) {}
      }, 400);
    }
    function bindKanjiQuizWriteCanvasReflowListeners() {
      if (__kanjiQuizWriteReflowListenersBound) return;
      __kanjiQuizWriteReflowListenersBound = true;
      let debounceTimer = 0;
      function onLayoutChange() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          debounceTimer = 0;
          kanjiQuizReflowWriteCanvasForCurrentLayout();
        }, 100);
      }
      window.addEventListener("resize", onLayoutChange);
      window.addEventListener("orientationchange", onLayoutChange);
      try {
        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", onLayoutChange);
          window.visualViewport.addEventListener("scroll", onLayoutChange);
        }
      } catch (eVv) {}
    }
    function getKanjiQuizStrokeThresholds() {
      const def = { minVelocity: 1.2, hookAngleDiff: 0.6 };
      try {
        const raw = localStorage.getItem("kanjiPenProfiles");
        if (!raw) return def;
        const parsed = JSON.parse(raw);
        const id = parsed.activeId !== undefined ? parsed.activeId : 0;
        const prof = (parsed.profiles || [])[id];
        if (prof && prof.thresholds && typeof prof.thresholds === "object") {
          return {
            minVelocity: Number(prof.thresholds.minVelocity) || def.minVelocity,
            hookAngleDiff: Number(prof.thresholds.hookAngleDiff) || def.hookAngleDiff
          };
        }
      } catch (e) {}
      return def;
    }
    /* iframe メインキャンバス: pointerup で 3 点未満は即「とめ」で積む。detectStrokeType(..., true, terminalInfo) は 5 点未満を「とめ」固定。親も同じ順序・同じ式で揃える。 */
    const KANJI_QUIZ_MIN_STROKE_POINTS = 5;
    function kanjiQuizClassifyStroke(points, drawStartTime) {
      if (!points || points.length < 3) return "tome";
      if (points.length < KANJI_QUIZ_MIN_STROKE_POINTS) return "tome";
      const n = points.length;
      const pStart = points[Math.max(0, n - 6)], pEnd = points[n - 1];
      const tStart = Number.isFinite(drawStartTime) ? drawStartTime : Date.now();
      const velocity =
        Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) / ((Date.now() - tStart) || 1) * 10;
      const dy = pEnd.y - pStart.y;
      const pMid = points[Math.floor(n * 0.5)], pPre = points[Math.floor(n * 0.85)];
      const angleMain = Math.atan2(pPre.y - pMid.y, pPre.x - pMid.x);
      const angleTip = Math.atan2(pEnd.y - pPre.y, pEnd.x - pPre.x);
      let angleDiff = Math.abs(angleTip - angleMain);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      const thr = getKanjiQuizStrokeThresholds();
      if (velocity < thr.minVelocity) return "tome";
      if (dy < 0 || angleDiff > thr.hookAngleDiff) return "hane";
      return "harai";
    }
    /* ==== リアルタイム書き順判定（書き順クイズ専用・kanjiEvaluator.js と同一ロジック） ==== */
    function kanjiQuizRealtimeOrderEnabled_() {
      const cb = document.getElementById("kanji-quiz-rt-order-toggle");
      return !!(cb && cb.checked);
    }
    function setKanjiQuizRtOrderFeedback_(msg, kind) {
      const el = document.getElementById("kanji-quiz-rt-order-feedback");
      if (!el) return;
      el.textContent = msg || "";
      el.classList.toggle("is-ok", kind === "ok");
      el.classList.toggle("is-ng", kind === "ng");
    }
    function kanjiQuizOnRtOrderToggleChanged() {
      if (kanjiQuizRealtimeOrderEnabled_()) {
        setKanjiQuizRtOrderFeedback_("かきはじめると、1画ごとに判定するよ", "ok");
      } else {
        setKanjiQuizRtOrderFeedback_("");
      }
    }
    /** リアルタイム書き順ON時：自動で「これで採点」と同じ postMessage 採点を1回だけ起動 */
    function kanjiQuizRtOrderTryAutoHandAnswer_() {
      if (!kanjiQuizRealtimeOrderEnabled_()) return;
      if (!kanjiQuizSession) return;
      if (kanjiQuizHandSubmitBusy || kanjiQuizHwAnswerSubmitted_()) return;
      if (kanjiQuizSession.rtOrderAutoTriggered) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || q.type !== "stroke_order_trace") return;
      kanjiQuizSession.rtOrderAutoTriggered = true;
      kanjiQuizRunHandwritingAnswer({ fromRtOrderAuto: true });
    }
    /** 直前に書き終えた1画をお手本の同じ画と照合し、間違えた瞬間に何画目かを知らせる */
    function kanjiQuizMaybeRealtimeStrokeOrderJudge_() {
      try {
        if (!kanjiQuizRealtimeOrderEnabled_()) return;
        if (!kanjiQuizSession) return;
        const q = kanjiQuizSession.questions[kanjiQuizSession.index];
        if (!q || q.type !== "stroke_order_trace") return;
        if (kanjiQuizHandSubmitBusy || kanjiQuizHwAnswerSubmitted_()) return;
        const refs = kanjiQuizTraceGuideStrokes;
        if (!refs || !refs.length) return;
        const idx = kanjiQuizParentStrokes.length - 1;
        if (idx < 0) return;
        const strokeNo = idx + 1;
        if (idx >= refs.length) {
          setKanjiQuizRtOrderFeedback_("✕ " + strokeNo + "画目：お手本（" + refs.length + "画）より多いよ", "ng");
          kanjiQuizRtOrderTryAutoHandAnswer_();
          return;
        }
        const ev = kjOrderEvaluateStrokePair(
          kanjiQuizParentStrokes[idx].points,
          refs[idx].points,
          kanjiQuizWriteLogicalSize,
          {
            strokeIndex: idx,
            prevUserPoints: idx > 0 ? kanjiQuizParentStrokes[idx - 1].points : null,
            prevRefPoints: idx > 0 ? refs[idx - 1].points : null
          }
        );
        if (ev.pass) {
          setKanjiQuizRtOrderFeedback_("○ " + strokeNo + "画目まで正しいかきじゅん！", "ok");
          if (strokeNo >= refs.length) {
            kanjiQuizRtOrderTryAutoHandAnswer_();
          }
        } else {
          var why = "";
          if (ev.details && ev.details.failReason === "direction") why = "（書き方）";
          else if (ev.details && ev.details.failReason === "relStart") why = "（つなぎ）";
          else if (ev.details && ev.details.failReason === "shape") why = "（形）";
          setKanjiQuizRtOrderFeedback_("✕ いま " + strokeNo + "画目をまちがえたよ" + why, "ng");
          kanjiQuizRtOrderTryAutoHandAnswer_();
        }
        try {
          console.log("[kjOrderEval rt]", strokeNo, ev);
        } catch (_eLogRt) {}
      } catch (_eRt) {}
    }
    function kanjiQuizMergeKanjiStrokeParams(partial) {
      const def = {
        baseWidth: 11.0,
        tomeStart: 0.9,
        tomeScale: 1.3,
        haneStart: 0.9,
        haneSharp: 0.55,
        haraiStart: 0.65,
        haraiSharp: 0.8
      };
      let cur = { ...def };
      try {
        const saved = localStorage.getItem("kanjiStrokeParamsV2");
        if (saved) cur = { ...def, ...JSON.parse(saved) };
      } catch (e) {}
      cur = { ...cur, ...partial };
      try {
        localStorage.setItem("kanjiStrokeParamsV2", JSON.stringify(cur));
      } catch (e) {}
      return cur;
    }
    /** 漢字練習の「🖋 設定」と共有する baseWidth（中間 11 を基準に 4/8/14 でスケール） */
    function kanjiQuizSetPenWidth(w) {
      kanjiQuizPenW = w;
      const midRef = 11.0;
      kanjiQuizMergeKanjiStrokeParams({
        baseWidth: Math.max(4, Math.min(18, midRef * (w / 8)))
      });
      [["kanji-pen-fine", 4], ["kanji-pen-mid", 8], ["kanji-pen-thick", 14]].forEach(function (t) {
        const el = document.getElementById(t[0]);
        if (el) el.classList.toggle("is-active-prior", t[1] === w);
      });
      kanjiQuizRedrawParentCanvas();
    }
    /** 保存済み kanjiStrokeParamsV2 に合わせてボタン表示のみ同期（設定を上書きしない） */
    function kanjiQuizSyncPenUiFromStrokeParams() {
      const midRef = 11.0;
      let baseW = midRef;
      try {
        const saved = localStorage.getItem("kanjiStrokeParamsV2");
        if (saved) {
          const o = JSON.parse(saved);
          if (typeof o.baseWidth === "number") baseW = o.baseWidth;
        }
      } catch (e) {}
      const presets = [4, 8, 14];
      let bestI = 1;
      let bestD = Infinity;
      for (let i = 0; i < presets.length; i++) {
        const expected = midRef * (presets[i] / 8);
        const d = Math.abs(baseW - expected);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      kanjiQuizPenW = presets[bestI];
      [["kanji-pen-fine", 4], ["kanji-pen-mid", 8], ["kanji-pen-thick", 14]].forEach(function (t) {
        const el = document.getElementById(t[0]);
        if (el) el.classList.toggle("is-active-prior", t[1] === kanjiQuizPenW);
      });
    }
    function kanjiQuizClearWritePad(clearIframe) {
      kanjiQuizParentStrokes = [];
      kanjiQuizCurrentStrokePoints = [];
      kanjiQuizIsDrawing = false;
      kanjiQuizRedrawParentCanvas();
      try {
        clearKanjiHwScoreStatus_();
      } catch (_eSt) {}
      try {
        setKanjiQuizRtOrderFeedback_("");
      } catch (_eRtFb) {}
      if (clearIframe) {
        try {
          const frame = document.getElementById("kp-pro-frame");
          if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: "quizClearDrawing" }, "*");
        } catch (e) {}
      }
    }
    function kanjiQuizClearTraceGuide_() {
      kanjiQuizTraceGuideStrokes = [];
    }
    /** iframe 側 getScaledRefs（なぞりガイド）を親の記述欄用にコピー */
    function kanjiQuizLoadTraceGuideFromFrame_(ch) {
      kanjiQuizTraceGuideStrokes = [];
      const frame = document.getElementById("kp-pro-frame");
      const win = frame && frame.contentWindow;
      if (!win || !ch) return false;
      if (!selectKanjiCharInQuizFrame(ch)) return false;
      try {
        let refs = null;
        if (typeof win.__kpGetScaledRefs === "function") {
          refs = win.__kpGetScaledRefs();
        } else if (typeof win.getScaledRefs === "function") {
          refs = win.getScaledRefs();
        }
        if (!refs || !refs.length) return false;
        kanjiQuizTraceGuideStrokes = refs.map(function (s) {
          return {
            type: (s && s.type) || "tome",
            points: Array.isArray(s && s.points)
              ? s.points.map(function (p) {
                  return { x: +p.x, y: +p.y };
                })
              : []
          };
        }).filter(function (s) {
          return s.points && s.points.length;
        });
        return kanjiQuizTraceGuideStrokes.length > 0;
      } catch (_e) {
        kanjiQuizTraceGuideStrokes = [];
        return false;
      }
    }
    function kanjiQuizRemoveLastStrokeDecoration() {
      if (!kanjiQuizParentStrokes.length) return;
      kanjiQuizParentStrokes[kanjiQuizParentStrokes.length - 1].type = "none";
      kanjiQuizRedrawParentCanvas();
    }
    /**
     * 漢字クイズ系ボタンの汎用「ローディング中」化。
     * - 多重タップを防ぐため pointer-events:none + disabled を付与
     * - 元のラベル・disabled 状態を data 属性に退避し、stopKanjiActionBusy で完全復元
     * - ラベル末尾を ".  ・・  ・・・" でアニメーションさせる
     * - 同じボタンを2度 start すると {alreadyBusy:true} を返すので、呼び出し側は
     *   2回目以降のタップを安全に無視できる（処理を二重起動しない保険）
     * 戻り値: {alreadyBusy: boolean}（null は引数不正）
     */
    function showKanjiQuizSetLoadingOverlay_(setLabel) {
      var el = document.getElementById("kanji-quiz-set-loading-overlay");
      if (!el) return;
      var sub = document.getElementById("kanji-quiz-set-loading-sub");
      if (sub) {
        var label = String(setLabel || "").trim();
        sub.textContent = label
          ? (label + " を よみこんでいます")
          : "そのまま まってね";
      }
      el.classList.add("is-visible");
      el.setAttribute("aria-hidden", "false");
      el.style.display = "flex";
      el.style.pointerEvents = "auto";
      try { clearTimeout(window.__kanjiQuizSetLoadingWatchdog); } catch (_wd) {}
      window.__kanjiQuizSetLoadingWatchdog = setTimeout(function () {
        var ov = document.getElementById("kanji-quiz-set-loading-overlay");
        if (!ov || !ov.classList.contains("is-visible")) return;
        hideKanjiQuizSetLoadingOverlay_();
        alert("読み込みがタイムアウトしました。\n通信を確認して、もう一度「セット」を押してください。");
      }, 70000);
    }
    function hideKanjiQuizSetLoadingOverlay_() {
      var el = document.getElementById("kanji-quiz-set-loading-overlay");
      if (!el) return;
      try { clearTimeout(window.__kanjiQuizSetLoadingWatchdog); } catch (_wd2) {}
      window.__kanjiQuizSetLoadingWatchdog = null;
      el.classList.remove("is-visible");
      el.setAttribute("aria-hidden", "true");
      el.style.display = "none";
      el.style.pointerEvents = "none";
    }
    function startKanjiActionBusy(btn, label) {
      if (!btn) return null;
      if (btn.dataset.kjBusyOriginalLabel != null) {
        return { alreadyBusy: true };
      }
      btn.dataset.kjBusyOriginalLabel = btn.innerHTML;
      btn.dataset.kjBusyOriginalDisabled = btn.disabled ? "1" : "";
      btn.disabled = true;
      btn.classList.add("kj-busy");
      btn.setAttribute("aria-busy", "true");
      var lbl = String(label || "よみこみ中");
      var tick = 0;
      btn.innerHTML = lbl + ".";
      var timer = setInterval(function () {
        if (btn.dataset.kjBusyOriginalLabel == null) {
          clearInterval(timer);
          return;
        }
        tick = (tick + 1) % 3;
        btn.innerHTML = lbl + ".".repeat(tick + 1);
      }, 320);
      btn.dataset.kjBusyAnim = String(timer);
      return { alreadyBusy: false };
    }
    function stopKanjiActionBusy(btn) {
      if (!btn) return;
      if (btn.dataset.kjBusyOriginalLabel == null) return;
      var t = parseInt(btn.dataset.kjBusyAnim || "0", 10);
      if (t) { try { clearInterval(t); } catch (_) {} }
      btn.innerHTML = btn.dataset.kjBusyOriginalLabel;
      btn.disabled = btn.dataset.kjBusyOriginalDisabled === "1";
      btn.classList.remove("kj-busy");
      btn.removeAttribute("aria-busy");
      delete btn.dataset.kjBusyOriginalLabel;
      delete btn.dataset.kjBusyOriginalDisabled;
      delete btn.dataset.kjBusyAnim;
    }
    /** 与えた配列のすべてのボタンを一括で disabled にする（タップ済みボタン以外を即時無効化）。
     *  ローディングのアニメは1個だけに付け、他は単に押せなくする。 */
    function disableKanjiButtonGroupExcept(buttons, exceptBtn) {
      if (!buttons || !buttons.length) return;
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (!b || b === exceptBtn) continue;
        if (b.dataset.kjGroupOriginalDisabled == null) {
          b.dataset.kjGroupOriginalDisabled = b.disabled ? "1" : "";
        }
        b.disabled = true;
        b.style.opacity = "0.55";
      }
    }
    function restoreKanjiButtonGroup(buttons) {
      if (!buttons || !buttons.length) return;
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (!b) continue;
        try { stopKanjiActionBusy(b); } catch (_) {}
        if (b.dataset.kjGroupOriginalDisabled != null) {
          b.disabled = b.dataset.kjGroupOriginalDisabled === "1";
          delete b.dataset.kjGroupOriginalDisabled;
        }
        b.style.opacity = "";
      }
    }
    function getResultScreenActionButtons() {
      return [
        document.getElementById("result-retry-btn"),
        document.getElementById("result-settings-btn"),
        document.getElementById("result-home-btn"),
        document.getElementById("result-kanji-same-book-btn"),
        document.getElementById("result-kanji-other-book-btn")
      ].filter(function (b) { return !!b; });
    }
    /** 漢字リザルトの kj-busy が残ると英語の集計画面ボタンも押せなくなるため、必ず解除する */
    function resetResultScreenActionButtons() {
      var btns = getResultScreenActionButtons();
      for (var i = 0; i < btns.length; i++) {
        try { stopKanjiActionBusy(btns[i]); } catch (_) {}
      }
      try { restoreKanjiButtonGroup(btns); } catch (_) {}
    }
    function bindEnglishResultButtonHandlers(opts) {
      opts = opts || {};
      var retryBtn = document.getElementById("result-retry-btn");
      var settingsBtn = document.getElementById("result-settings-btn");
      var homeBtn = document.getElementById("result-home-btn");
      if (retryBtn && opts.retryOnclick !== null) {
        retryBtn.onclick = opts.retryOnclick || function () { prepareQuiz(); };
      }
      if (settingsBtn) {
        settingsBtn.onclick = opts.settingsOnclick || function () { openSettingsScreen(); };
      }
      if (homeBtn) {
        homeBtn.onclick = opts.homeOnclick || function () {
          cancelTrainingRouteAutoReturn();
          showHome(JSON.parse(localStorage.getItem("app_kid_user")));
        };
      }
    }
    let kanjiQuizHandSubmitBusy = false;
    let kanjiQuizHandSubmitAnimTimer = null;
    let kanjiQuizHandEvalWatchdogTimer_ = null;
    function clearKanjiQuizHandEvalWatchdog_() {
      if (kanjiQuizHandEvalWatchdogTimer_ != null) {
        clearTimeout(kanjiQuizHandEvalWatchdogTimer_);
        kanjiQuizHandEvalWatchdogTimer_ = null;
      }
    }
    function startKanjiQuizHandEvalWatchdog_() {
      clearKanjiQuizHandEvalWatchdog_();
      kanjiQuizHandEvalWatchdogTimer_ = setTimeout(function () {
        kanjiQuizHandEvalWatchdogTimer_ = null;
        if (!kanjiQuizHandSubmitBusy) return;
        setKanjiQuizHandSubmitBusy(false);
        try {
          alert("さいてんが おわりませんでした。もういちどためしてください。");
        } catch (_eWd) {}
      }, 15000);
    }
    function kanjiQuizHwAnswerSubmitted_() {
      return !!(kanjiQuizSession && kanjiQuizSession.hwAnswerSubmitted);
    }
    function setKanjiQuizHwCardControlsLocked(locked) {
      const isLocked = !!locked;
      const sec = document.getElementById("section-kanji-quiz-play");
      if (sec) sec.classList.toggle("kanji-quiz-hw-card-locked", isLocked);
      const submitted = kanjiQuizHwAnswerSubmitted_();
      const actions = document.getElementById("kanji-hw-canvas-actions");
      if (actions) {
        Array.from(actions.querySelectorAll("button")).forEach(function (btn) {
          if (btn.id === "kanji-hw-submit-btn") {
            btn.disabled = isLocked || submitted;
          } else {
            btn.disabled = isLocked;
          }
        });
      }
      const penCtrls = document.getElementById("kanji-drill-pen-controls");
      if (penCtrls) {
        Array.from(penCtrls.querySelectorAll("button")).forEach(function (btn) {
          btn.disabled = isLocked;
        });
      }
      const refreshBtn = document.getElementById("kanji-quiz-layout-refresh-btn");
      if (refreshBtn) refreshBtn.disabled = isLocked;
    }
    function resetKanjiQuizHandAnswerState_() {
      if (kanjiQuizSession) {
        kanjiQuizSession.hwAnswerSubmitted = false;
        kanjiQuizSession.rtOrderAutoTriggered = false;
      }
      setKanjiQuizHwCardControlsLocked(false);
    }
    function markKanjiQuizHandAnswerSubmitted_() {
      if (kanjiQuizSession) kanjiQuizSession.hwAnswerSubmitted = true;
      setKanjiQuizHandSubmitBusy(false);
    }
    function setKanjiQuizHandSubmitBusy(isBusy, opts) {
      opts = opts || {};
      const qBusy =
        kanjiQuizSession &&
        kanjiQuizSession.questions &&
        kanjiQuizSession.questions[kanjiQuizSession.index];
      const isStrokeBusy = qBusy && qBusy.type === "stroke_order_trace";
      const btn = document.getElementById("kanji-hw-submit-btn");
      const idleLabel = isStrokeBusy ? "これで採点" : "これでかいとう";
      const submitted = kanjiQuizHwAnswerSubmitted_();
      kanjiQuizHandSubmitBusy = !!isBusy;
      if (!isBusy) clearKanjiQuizHandEvalWatchdog_();
      if (kanjiQuizHandSubmitAnimTimer) {
        clearInterval(kanjiQuizHandSubmitAnimTimer);
        kanjiQuizHandSubmitAnimTimer = null;
      }
      if (opts.silentBusy) {
        if (btn) btn.disabled = !!isBusy || submitted;
        return;
      }
      if (!btn) return;
      btn.disabled = !!isBusy || submitted;
      btn.classList.toggle("is-loading", !!isBusy);
      btn.setAttribute("aria-busy", isBusy ? "true" : "false");
      if (isBusy) {
        let tick = 0;
        btn.textContent = "さいてん中.";
        kanjiQuizHandSubmitAnimTimer = setInterval(function () {
          tick = (tick + 1) % 3;
          btn.textContent = "さいてん中" + ".".repeat(tick + 1);
        }, 280);
      } else {
        btn.textContent = idleLabel;
        if (!submitted && kanjiQuizSession) kanjiQuizSession.rtOrderAutoTriggered = false;
      }
    }
    function ensureKanjiCharSelectedInQuizFrame_(ch) {
      const target = String(ch || "");
      if (!target) return Promise.resolve(false);
      const delays = [0, 40, 90, 160, 280, 450, 700, 1100, 1600];
      return new Promise(function (resolve) {
        let attempt = 0;
        function tryOnce() {
          if (selectKanjiCharInQuizFrame(target)) {
            resolve(true);
            return;
          }
          attempt++;
          if (attempt >= delays.length) {
            resolve(false);
            return;
          }
          setTimeout(tryOnce, delays[attempt]);
        }
        tryOnce();
      });
    }
    function kanjiQuizRunHandwritingAnswer(opts) {
      opts = opts || {};
      const fromRtOrderAuto = !!opts.fromRtOrderAuto;
      if (kanjiQuizHandSubmitBusy || kanjiQuizHwAnswerSubmitted_()) return;
      if (!kanjiQuizParentStrokes.length) {
        if (!fromRtOrderAuto) alert("かんじを かいてください。");
        return;
      }
      if (!kanjiQuizSession) return;
      setKanjiQuizHandSubmitBusy(true, fromRtOrderAuto ? { silentBusy: true } : null);
      startKanjiQuizHandEvalWatchdog_();
      function postEvalToFrame() {
        const frame = getKanjiQuizScoreFrame();
        if (!frame || !frame.contentWindow) return Promise.resolve(false);
        const targets = kanjiQuizSession ? kanjiQuizSession.rubyHandTargets || [] : [];
        const slot = kanjiQuizSession ? kanjiQuizSession.rubyHandSlot || 0 : 0;
        const q = kanjiQuizSession ? kanjiQuizSession.questions[kanjiQuizSession.index] : null;
        const fallbackTargets = kanjiQuizHanOnlyChars((q && (q.correctAnswer || q.kanji)) || "");
        const qKanjiTargets = kanjiQuizHanOnlyChars((q && q.kanji) || "");
        const expectedChar =
          targets[slot] ||
          qKanjiTargets[slot] ||
          qKanjiTargets[0] ||
          fallbackTargets[slot] ||
          fallbackTargets[0] ||
          "";
        if (expectedChar && (!targets.length || targets[slot] !== expectedChar)) {
          kanjiQuizSession.rubyHandTargets = qKanjiTargets.length
            ? qKanjiTargets
            : fallbackTargets.length
              ? fallbackTargets
              : [expectedChar];
          kanjiQuizSession.rubyHandSlot = Math.max(0, Math.min(slot, kanjiQuizSession.rubyHandTargets.length - 1));
        }
        const payload = {
          type: "quizEvalParentStrokes",
          expectedChar: expectedChar,
          scoreWeights: getKanjiHandScoreWeights(),
          strokes: kanjiQuizParentStrokes.map(function (s) {
            return { type: s.type, points: s.points.map(function (p) { return { x: +p.x, y: +p.y }; }) };
          })
        };
        return ensureKanjiCharSelectedInQuizFrame_(expectedChar).then(function (ok) {
          if (!ok) return false;
          return new Promise(function (resolve) {
            setTimeout(function () {
              try {
                frame.contentWindow.postMessage(payload, "*");
                resolve(true);
              } catch (e) {
                resolve(false);
              }
            }, 50);
          });
        });
      }
      /* iframe は問題間・再採点時に移動させず、同じ contentWindow を使い続ける。 */
      ensureKanjiHwFrameReadyOnce().then(function () {
        const frame = getKanjiQuizScoreFrame();
        if (frame) patchKanjiFrameForQuizPostMessage(frame);
        return postEvalToFrame();
      }).then(function (sent) {
        if (!sent) {
          setKanjiQuizHandSubmitBusy(false);
          alert("さいてんのじゅんびに しっぱいしました。もういちどためしてください。");
        }
      }).catch(function () {
        setKanjiQuizHandSubmitBusy(false);
        alert("さいてんのじゅんびに しっぱいしました。もういちどためしてください。");
      });
    }
    function kanjiQuizOnHandwritingScored(sc) {
      if (!kanjiQuizSession) return;
      const secHand = document.getElementById("section-kanji-quiz-play");
      if (!secHand || !secHand.classList.contains("active")) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || !isKanjiQuizHandwritingQuestionType_(q.type)) return;
      /* 採点済み後の二重 postMessage は無視（さいてんステータス表示後の再採点ループ防止） */
      if (kanjiQuizHwAnswerSubmitted_()) {
        setKanjiQuizHandSubmitBusy(false);
        return;
      }
      // 書き順は合格確定後の二重採点を無視（自動で次字へ移るまでの間）
      if (
        q.type === "stroke_order_trace" &&
        (kanjiQuizSession.rubyHandComplete || kanjiQuizSession.strokeOrderPendingAdvance)
      ) {
        setKanjiQuizHandSubmitBusy(false);
        return;
      }
      /* 書いて答える：合格待機中の再採点は無視 */
      if (q.type === "ruby_to_kanji" && typeof kanjiQuizSession.hwPassPendingAdvance === "function") {
        setKanjiQuizHandSubmitBusy(false);
        return;
      }
      if (sc == null || sc < KANJI_QUIZ_HAND_PASS) {
        queueKanjiHandwritingWeakSignalForQuestion(q, sc);
        if (q.type === "stroke_order_trace") {
          kanjiQuizSession.strokeOrderFailedOnce = true;
          updateStrokeOrderHint_("practice", sc);
          kanjiQuizShowHandwritingWrongFeedback(sc, { keepCanvasUnlocked: true });
          setKanjiQuizHandSubmitBusy(false);
          return;
        }
        markKanjiQuizHandAnswerSubmitted_();
        kanjiQuizShowHandwritingWrongFeedback(sc);
        setKanjiQuizHwCardControlsLocked(true);
        setKanjiQuizHandSubmitBusy(false);
        return;
      }
      markKanjiQuizHandAnswerSubmitted_();
      const scNum = Number(sc);
      if (!isNaN(scNum)) {
        const pm = kanjiQuizSession.rubyHandMinScore;
        kanjiQuizSession.rubyHandMinScore = pm == null || isNaN(pm) ? scNum : Math.min(pm, scNum);
      }
      if (q.type === "stroke_order_trace") {
        kanjiQuizSession.rubyHandComplete = true;
        kanjiQuizSession.rubyHandKanjiVgPass = true;
        updateStrokeOrderHint_("pass", sc);
        kanjiQuizHideWrongFeedback();
        submitKanjiQuizScore();
        setKanjiQuizHandSubmitBusy(false);
        return;
      }
      /* 書いて答える：採点ステータスを見せ、「次へ」操作でのみ進行 */
      kanjiQuizHideWrongFeedback();
      setKanjiQuizHwCardControlsLocked(true);
      showKanjiHwPassNextControls_(function () {
        advanceKanjiHwRubyAfterPass_();
      });
    }
    /** 書いて答える：合格後のスロット進行／問題確定 */
    function advanceKanjiHwRubyAfterPass_() {
      if (!kanjiQuizSession) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || q.type !== "ruby_to_kanji") return;
      const targets = kanjiQuizSession.rubyHandTargets || [];
      const slot = kanjiQuizSession.rubyHandSlot || 0;
      if (slot + 1 >= targets.length) {
        kanjiQuizSession.rubyHandComplete = true;
        kanjiQuizSession.rubyHandKanjiVgPass = true;
        submitKanjiQuizScore();
        return;
      }
      kanjiQuizSession.rubyHandSlot = slot + 1;
      kanjiQuizSession.lastHandScore = null;
      resetKanjiQuizHandAnswerState_();
      const nextCh = targets[slot + 1];
      if (!selectKanjiCharInQuizFrame(nextCh)) return;
      const sum = document.getElementById("kanji-play-summary");
      if (sum) sum.innerHTML = "";
      kanjiQuizClearWritePad(true);
      kanjiQuizSetupWriteCanvas();
      kanjiQuizScheduleWriteCanvasReflow();
      const skipHwBtn = document.getElementById("kanji-quiz-skip-hw-btn");
      if (skipHwBtn) skipHwBtn.textContent = "次へ";
    }
    let kanjiHwPassAutoNextTimer_ = null;
    function clearKanjiHwPassAutoNext_() {
      if (kanjiHwPassAutoNextTimer_ != null) {
        clearTimeout(kanjiHwPassAutoNextTimer_);
        kanjiHwPassAutoNextTimer_ = null;
      }
    }
    /** 書いて答える合格時：ステータス表示のまま「次へ」操作でのみ進む（自動遷移なし） */
    function showKanjiHwPassNextControls_(advanceFn) {
      if (!kanjiQuizSession) return;
      clearKanjiHwPassAutoNext_();
      var advanced = false;
      function goNext() {
        if (advanced) return;
        advanced = true;
        clearKanjiHwPassAutoNext_();
        if (kanjiQuizSession) kanjiQuizSession.hwPassPendingAdvance = null;
        if (typeof advanceFn === "function") advanceFn();
      }
      kanjiQuizSession.hwPassPendingAdvance = goNext;
      setKanjiQuizHandSubmitBusy(false);
      const skipBtn = document.getElementById("kanji-quiz-skip-hw-btn");
      if (skipBtn) {
        skipBtn.textContent = "次へ";
        skipBtn.disabled = false;
        stopKanjiActionBusy(skipBtn);
      }
    }
    function kanjiQuizSkipHandwritingQuestion(btn) {
      if (!kanjiQuizSession) return;
      const secHand = document.getElementById("section-kanji-quiz-play");
      if (!secHand || !secHand.classList.contains("active")) return;
      /* 書き順：採点済み待機中の「次へ（ふせいかい）」で次問題へ */
      if (typeof kanjiQuizSession.strokeOrderPendingAdvance === "function") {
        kanjiQuizSession.strokeOrderPendingAdvance();
        return;
      }
      /* 合格待機中の「次へ」はスキップ（不正解確定）ではなく進行 */
      if (typeof kanjiQuizSession.hwPassPendingAdvance === "function") {
        kanjiQuizSession.hwPassPendingAdvance();
        return;
      }
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || !isKanjiQuizHandwritingQuestionType_(q.type)) return;

      // 多重タップ防止（保存往復が完了するまでロック）。次の問題で renderKanjiQuizQuestion が
      // パネル全体を作り直すため、明示的に解除しなくても次画面では正常に押せる状態に戻る。
      var skipBtn = btn || document.getElementById("kanji-quiz-skip-hw-btn");
      if (skipBtn) {
        if (skipBtn.dataset.kjBusyOriginalLabel != null) return;
        startKanjiActionBusy(skipBtn, "おくっています");
      }

      // 不正解として確定し、保存して次の問題へ進む。
      kanjiQuizSession.rubyHandComplete = true;
      kanjiQuizSession.rubyHandKanjiVgPass = false;
      kanjiQuizSession.lastHandScore = 0;
      kanjiQuizSession.rubyHandMinScore = 0;
      kanjiQuizHideWrongFeedback();
      submitKanjiQuizScore();
      if (
        kanjiQuizSession &&
        typeof kanjiQuizSession.strokeOrderPendingAdvance === "function"
      ) {
        kanjiQuizSession.strokeOrderPendingAdvance();
      }
    }
    function isKanjiQuizHanChar(ch) {
      if (!ch || ch.length === 0) return false;
      const cp = ch.codePointAt(0);
      if (cp >= 0x4e00 && cp <= 0x9fff) return true;
      if (cp >= 0x3400 && cp <= 0x4dbf) return true;
      if (cp >= 0xf900 && cp <= 0xfaff) return true;
      return false;
    }
    function kanjiQuizHanOnlyChars(str) {
      return Array.from(String(str || "")).filter(isKanjiQuizHanChar);
    }
    function patchKanjiFrameForQuizPostMessage(frame) {
      try {
        injectKanjiFrameNoSelectStyle_(frame);
        const win = frame.contentWindow;
        if (!win) return;
        syncKanjiHandScoreWeightsToFrame(frame);
        const doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        const hookVer = String(doc.documentElement.dataset.kanjiQuizParentHook || "");
        if (hookVer === "7") {
          try {
            if (win.__kjEvalWrappedV4 && win.__kjQPatchInnerV6) return;
          } catch (_eHookOk) {}
          try {
            delete doc.documentElement.dataset.kanjiQuizParentHook;
          } catch (_eHookClr) {}
        }
        // v7: kanjiQuizScored は breakdown.total を score に使う
        try {
          win.__kjQPatchInner = false;
          win.__kjEvalWrapped = false;
          win.__kjQPatchInnerV2 = false;
          win.__kjQPatchInnerV3 = false;
          win.__kjQPatchInnerV4 = false;
          win.__kjQPatchInnerV5 = false;
          win.__kjQPatchInnerV6 = false;
          win.__kjQPatchInnerV7 = false;
        } catch (_eHook) {}
        const s = doc.createElement("script");
        s.textContent =
          "(function(){" +
          "if(window.__kjQPatchInnerV7)return;" +
          "window.__kjQPatchInnerV7=true;" +
          "window.__kjQPatchInnerV6=true;" +
          "window.__kjQPatchInnerV5=true;" +
          "window.__kjQPatchInnerV4=true;" +
          "window.__kjQPatchInnerV3=true;" +
          "window.__kjQPatchInnerV2=true;" +
          "window.__kjQPatchInner=true;" +
          "window.__kpGetScaledRefs=function(){" +
          "try{" +
          "if(typeof getScaledRefs===\"function\")return getScaledRefs();" +
          "}catch(e){}" +
          "return[];" +
          "};" +
          "function _kjEnsureExpectedChar(exp){" +
          "if(!exp)return true;" +
          "var _ksel=document.getElementById(\"target-kanji\");" +
          "if(!_ksel)return false;" +
          "if(String(_ksel.value)===String(exp))return true;" +
          "var ok=Array.from(_ksel.options||[]).some(function(o){return String(o.value)===String(exp);});" +
          "if(!ok&&window.KANJI_DATA&&window.KANJI_DATA[exp]){" +
          "var op=document.createElement(\"option\");op.value=exp;op.textContent=exp;_ksel.appendChild(op);ok=true;" +
          "}" +
          "if(!ok)return false;" +
          "_ksel.value=exp;" +
          "if(String(_ksel.value)!==String(exp))return false;" +
          "if(typeof initTargetKanji===\"function\")initTargetKanji();" +
          "return String(_ksel.value)===String(exp);" +
          "}" +
          "window.addEventListener(\"message\",function(ev){" +
          "if(!ev||!ev.data)return;var d=ev.data;" +
          "try{" +
          "if(d.type===\"quizEvalParentStrokes\"&&Array.isArray(d.strokes)){" +
          "if(d.scoreWeights&&typeof d.scoreWeights===\"object\")window.__kpHandScoreWeights=d.scoreWeights;" +
          "if(d.expectedChar&&!_kjEnsureExpectedChar(String(d.expectedChar))){return;}" +
          "userStrokes=d.strokes.map(function(s){return{type:(s&&s.type)||\"tome\",points:Array.isArray(s&&s.points)?s.points.map(function(p){return{x:+p.x,y:+p.y}}):[]};});" +
          "if(typeof redrawAllUserStrokes===\"function\")redrawAllUserStrokes();" +
          "if(typeof evaluateKanji===\"function\")evaluateKanji(false);" +
          "}" +
          "if(d.type===\"quizClearDrawing\"&&typeof clearCanvas===\"function\")clearCanvas();" +
          "if(d.type===\"quizRemoveLastDecoration\"&&typeof removeLastEffect===\"function\")removeLastEffect();" +
          "if(d.type===\"quizSwitchMode\"&&typeof switchMode===\"function\"){switchMode(d.mode||\"score\");}" +
          "if(d.type===\"quizRunEvaluate\"&&typeof evaluateKanji===\"function\"){evaluateKanji(!!d.trace);}" +
          "if(d.type===\"quizPlayStrokeOrderDemo\"){" +
          "if(typeof switchMode===\"function\")switchMode(\"demo\");" +
          "setTimeout(function(){if(typeof playAnimation===\"function\")playAnimation();},450);" +
          "}" +
          "}catch(e){}" +
          "});" +
          "function _kjWrapSwitchMode(){" +
          "if(typeof switchMode!==\"function\"||window.__kjSwitchModeWrappedV5)return;" +
          "window.__kjSwitchModeWrappedV5=true;" +
          "var _sm=switchMode;" +
          "switchMode=function(m){" +
          "var r=_sm.apply(this,arguments);" +
          "try{if(window.parent)window.parent.postMessage({type:\"kpWrongPanelModeChanged\",mode:m},\"*\");}catch(e){}" +
          "return r;" +
          "};" +
          "}" +
          "_kjWrapSwitchMode();" +
          "function _kjWrapEval(){" +
          "if(typeof window.evaluateKanji!==\"function\"){requestAnimationFrame(_kjWrapEval);return;}" +
          "if(window.__kjEvalWrappedV4)return;" +
          "window.__kjEvalWrappedV4=true;" +
          "window.__kjEvalWrapped=true;" +
          "var _o=window.evaluateKanji;" +
          "window.evaluateKanji=function(t){" +
          "_o.apply(this,arguments);" +
          "setTimeout(function(){try{var bd=window.__kpLastHandBreakdown||null;var n=bd&&bd.total!=null?Math.round(Number(bd.total)):NaN;if(isNaN(n)){var e=document.getElementById(\"score\"),m=e&&e.innerText&&e.innerText.match(/(\\d+)/);n=m?parseInt(m[1],10):0;if(isNaN(n))n=0;}var s=document.getElementById(\"target-kanji\"),k=s&&s.value?String(s.value):\"\";if(window.parent)window.parent.postMessage({type:\"kanjiQuizScored\",score:n,kanjiChar:k,breakdown:bd},\"*\");}catch(x){}},120);" +
          "};" +
          "}" +
          "_kjWrapEval();" +
          "})();";
        doc.documentElement.appendChild(s);
        doc.documentElement.dataset.kanjiQuizParentHook = "7";
      } catch (e) {}
    }
    /** お手本専用 iframe：デモ＋なぞり練習採点（練習得点は親が付与） */
    function patchKanjiWrongModelFramePostMessage(frame) {
      try {
        injectKanjiFrameNoSelectStyle_(frame);
        const win = frame.contentWindow;
        if (!win) return;
        const doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        const hookVer = String(doc.documentElement.dataset.kanjiQuizWrongHook || "");
        if (hookVer === "2") {
          try {
            if (win.__kjWrongQPatchV2 && win.__kjWrongEvalWrapped) return;
          } catch (_eHookOk) {}
        }
        const s = doc.createElement("script");
        s.textContent =
          "(function(){" +
          "if(window.__kjWrongQPatchV2)return;" +
          "window.__kjWrongQPatchV2=true;" +
          "window.__kjWrongQPatchV1=true;" +
          "window.addEventListener(\"message\",function(ev){" +
          "if(!ev||!ev.data)return;var d=ev.data;" +
          "try{" +
          "if(d.type===\"quizSwitchMode\"&&typeof switchMode===\"function\"){switchMode(d.mode||\"demo\");}" +
          "if(d.type===\"quizPlayStrokeOrderDemo\"){" +
          "if(typeof switchMode===\"function\")switchMode(\"demo\");" +
          "setTimeout(function(){if(typeof playAnimation===\"function\")playAnimation();},450);" +
          "}" +
          "}catch(e){}" +
          "});" +
          "function _kjWrapSwitchMode(){" +
          "if(typeof switchMode!==\"function\"||window.__kjSwitchModeWrappedWrong)return;" +
          "window.__kjSwitchModeWrappedWrong=true;" +
          "var _sm=switchMode;" +
          "switchMode=function(m){" +
          "var r=_sm.apply(this,arguments);" +
          "try{if(window.parent)window.parent.postMessage({type:\"kpWrongPanelModeChanged\",mode:m},\"*\");}catch(e){}" +
          "return r;" +
          "};" +
          "}" +
          "_kjWrapSwitchMode();" +
          "function _kjWrapWrongEval(){" +
          "if(typeof window.evaluateKanji!==\"function\"){requestAnimationFrame(_kjWrapWrongEval);return;}" +
          "if(window.__kjWrongEvalWrapped)return;" +
          "window.__kjWrongEvalWrapped=true;" +
          "var _o=window.evaluateKanji;" +
          "window.evaluateKanji=function(t){" +
          "_o.apply(this,arguments);" +
          "setTimeout(function(){try{var bd=window.__kpLastHandBreakdown||null;var n=bd&&bd.total!=null?Math.round(Number(bd.total)):NaN;if(isNaN(n)){var e=document.getElementById(\"score\"),m=e&&e.innerText&&e.innerText.match(/(\\d+)/);n=m?parseInt(m[1],10):0;if(isNaN(n))n=0;}var s=document.getElementById(\"target-kanji\"),k=s&&s.value?String(s.value):\"\";if(window.parent)window.parent.postMessage({type:\"kanjiQuizScored\",score:n,kanjiChar:k,breakdown:bd,wrongPanelPractice:true},\"*\");}catch(x){}},120);" +
          "};" +
          "}" +
          "_kjWrapWrongEval();" +
          "})();";
        doc.documentElement.appendChild(s);
        doc.documentElement.dataset.kanjiQuizWrongHook = "2";
      } catch (e) {}
    }
    function ensureKanjiPracticeFrameReady() {
      return new Promise(function (resolve) {
        openKanjiPracticePro();
        kanjiQuizEnsureScoreListener();
        const frame = document.getElementById("kp-pro-frame");
        if (!frame) {
          resolve();
          return;
        }
        let settled = false;
        let pollId = null;
        let hardTimer = null;

        function cleanup() {
          window.removeEventListener("message", onKpKanjiReady);
          if (pollId != null) {
            clearInterval(pollId);
            pollId = null;
          }
          if (hardTimer != null) {
            clearTimeout(hardTimer);
            hardTimer = null;
          }
        }

        function finish() {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        }

        function onKpKanjiReady(ev) {
          if (!ev.data || ev.data.type !== "kpKanjiDataReady") return;
          if (ev.source !== frame.contentWindow) return;
          finish();
        }
        window.addEventListener("message", onKpKanjiReady);
        // load イベント取りこぼし・KANJI_DATA 空でも止まらないよう上限を設ける
        hardTimer = setTimeout(finish, 10000);

        function tryPoll() {
          patchKanjiFrameForQuizPostMessage(frame);
          const win = frame.contentWindow;
          if (!win) {
            finish();
            return;
          }

          function check() {
            patchKanjiFrameForQuizPostMessage(frame);
            const kd = win.KANJI_DATA;
            return !!(kd && typeof kd === "object" && Object.keys(kd).length > 0);
          }

          if (check()) {
            finish();
            return;
          }

          let n = 0;
          pollId = setInterval(function () {
            n++;
            if (check()) {
              finish();
              return;
            }
            if (n >= 80) finish();
          }, 80);
        }

        function startWhenReady() {
          try {
            if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
              setTimeout(tryPoll, 0);
              return;
            }
          } catch (_eDoc) {}
          var loadHandled = false;
          function onLf() {
            if (loadHandled) return;
            loadHandled = true;
            frame.removeEventListener("load", onLf);
            setTimeout(tryPoll, 0);
          }
          frame.addEventListener("load", onLf);
          // すでに load 済みの場合の取りこぼし救済
          setTimeout(function () {
            if (settled || loadHandled) return;
            try {
              if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
                onLf();
              }
            } catch (_e2) {
              tryPoll();
            }
          }, 200);
        }

        startWhenReady();
      });
    }
    function ensureKanjiWrongModelFrameReady() {
      return new Promise(function (resolve) {
        openKanjiWrongModelFramePro();
        const frame = getKanjiQuizWrongModelFrame();
        if (!frame) {
          resolve();
          return;
        }
        let settled = false;
        let pollId = null;
        let hardTimer = null;

        function cleanup() {
          window.removeEventListener("message", onKpKanjiReady);
          if (pollId != null) {
            clearInterval(pollId);
            pollId = null;
          }
          if (hardTimer != null) {
            clearTimeout(hardTimer);
            hardTimer = null;
          }
        }

        function finish() {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        }

        function onKpKanjiReady(ev) {
          if (!ev.data || ev.data.type !== "kpKanjiDataReady") return;
          if (ev.source !== frame.contentWindow) return;
          finish();
        }
        window.addEventListener("message", onKpKanjiReady);
        hardTimer = setTimeout(finish, 10000);

        function tryPoll() {
          patchKanjiWrongModelFramePostMessage(frame);
          const win = frame.contentWindow;
          if (!win) {
            finish();
            return;
          }

          function check() {
            patchKanjiWrongModelFramePostMessage(frame);
            const kd = win.KANJI_DATA;
            return !!(kd && typeof kd === "object" && Object.keys(kd).length > 0);
          }

          if (check()) {
            finish();
            return;
          }

          let n = 0;
          pollId = setInterval(function () {
            n++;
            if (check()) {
              finish();
              return;
            }
            if (n >= 80) finish();
          }, 80);
        }

        function startWhenReady() {
          try {
            if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
              setTimeout(tryPoll, 0);
              return;
            }
          } catch (_eDoc) {}
          var loadHandled = false;
          function onLf() {
            if (loadHandled) return;
            loadHandled = true;
            frame.removeEventListener("load", onLf);
            setTimeout(tryPoll, 0);
          }
          frame.addEventListener("load", onLf);
          setTimeout(function () {
            if (settled || loadHandled) return;
            try {
              if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
                onLf();
              }
            } catch (_e2) {
              tryPoll();
            }
          }, 200);
        }

        startWhenReady();
      });
    }
    function ensureKanjiFrameForQuizEval() {
      /* 採点用 iframe は練習スロットに固定。お手本は #kp-pro-frame-wrong が担当。 */
      const frame = getKanjiQuizScoreFrame();
      if (frame) patchKanjiFrameForQuizPostMessage(frame);
    }
    function restoreKanjiPracticeFrameIfMoved() {
      const slot = document.getElementById("kp-iframe-slot-practice");
      const frame = getKanjiQuizScoreFrame();
      if (!frame || !slot) return;
      try {
        applyKpStrokeOrderPlayCompactMode_(frame, false);
        applyKpQuizWrongPanelCompactMode(frame, false);
      } catch (_eRk) {}
      /* 旧実装で採点 iframe が誤答パネルへ移っていた場合の救済 */
      if (frame.parentElement !== slot) {
        slot.appendChild(frame);
      }
      frame.style.width = "";
      frame.style.maxWidth = "";
      frame.style.height = "";
      frame.style.minHeight = "";
      setTimeout(kpResizeFrameToContent, 80);
    }
    function unmountStrokeOrderQuizPlayFrame_() {
      /* 書き順も書いて答えると同じUI。iframe は採点用に隠し領域へ戻すだけ */
      kanjiQuizClearTraceGuide_();
      try {
        ensureKanjiFrameForQuizEval();
      } catch (_eUm) {}
      const host = document.getElementById("kanji-stroke-order-play-host");
      if (host) host.style.display = "none";
    }
    /** 互換：記述欄へなぞり軌道を載せる */
    function mountStrokeOrderQuizPlayFrame_(ch) {
      ensureKanjiFrameForQuizEval();
      const frame = document.getElementById("kp-pro-frame");
      if (frame) patchKanjiFrameForQuizPostMessage(frame);
      const ok = kanjiQuizLoadTraceGuideFromFrame_(ch);
      kanjiQuizRedrawParentCanvas();
      updateStrokeOrderHint_("ready");
      if (kanjiQuizSession) kanjiQuizSession.strokeOtehonAppliedForIndex = kanjiQuizSession.index;
      return ok;
    }
    function postStrokeOrderQuizFrameMessage_(payload) {
      try {
        const frame = document.getElementById("kp-pro-frame");
        if (!frame || !frame.contentWindow) return false;
        frame.contentWindow.postMessage(payload, "*");
        return true;
      } catch (_e) {
        return false;
      }
    }
    function kanjiStrokeOrderRunEvaluate() {
      /* 手書きキャンバス採点に統一 */
      kanjiQuizRunHandwritingAnswer();
    }
    function kanjiStrokeOrderClearDrawing() {
      try {
        kanjiQuizClearWritePad(true);
      } catch (_e) {}
    }
    function updateStrokeOrderHint_(mode, sc) {
      /* ヒント要素は非表示プレースホルダ。プロンプト文言は render 側で設定 */
      const hint = document.getElementById("kanji-stroke-order-hint");
      if (!hint) return;
      if (mode === "practice") {
        const pts = getKanjiQuizSettingNumber_("漢字書き順_練習点", 5);
        hint.textContent =
          "ざんねん" +
          (sc != null && !isNaN(Number(sc)) ? "（" + sc + "てん）" : "") +
          "。うすい線をなぞって、もういちど60点以上で練習点 " +
          pts +
          "点ゲット！";
        return;
      }
      if (mode === "pass") {
        hint.textContent = "せいかい！「次へ（ふせいかい）」を おして つぎへ";
        return;
      }
      hint.textContent = "うすい線をなぞって書いて、60点以上をめざそう。";
    }
    function strokeOrderReadingKindLabel_(kind) {
      return kind === "on" ? "音読み" : "訓読み";
    }
    function strokeOrderReadingSlotLabel_(label) {
      const m = String(label || "").match(/[A-DＡ-Ｄ]$/);
      return m ? m[0] : String(label || "");
    }
    function strokeOrderReadingDisplayText_(reading, kind) {
      return kanjiYomiHiraganaToAnswerScript(String(reading || ""), kind === "on" ? "on" : "kun");
    }
    /** 例文の先頭・末尾の「。」等を除き、先頭に箇条書き「●」を付ける */
    function normalizeStrokeOrderExampleText_(ex) {
      const body = String(ex || "")
        .replace(/^[\s　]*[。．\.・•●◦‧]+/, "")
        .replace(/[。．\.・•●◦‧]+[\s　]*$/, "")
        .replace(/^[\s　]+|[\s　]+$/g, "")
        .trim();
      return body ? "●" + body : "";
    }
    function clearStrokeOrderReadings_() {
      const el = document.getElementById("kanji-stroke-order-readings");
      if (!el) return;
      el.innerHTML = "";
      el.classList.remove("is-visible");
      el.style.display = "none";
      stopStrokeOrderReadingTTS_();
    }
    function stopStrokeOrderReadingTTS_() {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
    function playStrokeOrderReadingTTS_(phrases) {
      if (!window.speechSynthesis) return;
      stopStrokeOrderReadingTTS_();
      const isEnabled = getUserPref("kanji_quiz_stroke_tts_enabled", "1") === "1";
      if (!isEnabled) return;
      phrases.forEach(function (text) {
        if (!text) return;
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = "ja-JP";
        ut.rate = 1.15;
        window.speechSynthesis.speak(ut);
      });
    }
    function renderStrokeOrderReadings_(q) {
      const el = document.getElementById("kanji-stroke-order-readings");
      if (!el) return;
      if (!q || q.type !== "stroke_order_trace") {
        clearStrokeOrderReadings_();
        stopStrokeOrderReadingTTS_();
        return;
      }
      const readings = Array.isArray(q.readings) ? q.readings : [];
      if (!readings.length) {
        clearStrokeOrderReadings_();
        stopStrokeOrderReadingTTS_();
        return;
      }
      let html = "";
      const ttsPhrases = [];
      const ttsEnabled = getUserPref("kanji_quiz_stroke_tts_enabled", "1") === "1";
      html += '<label class="kanji-so-reading-group kanji-stroke-tts-area" style="pointer-events:auto;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:8px 4px;background:rgba(255,255,255,0.5);border-radius:6px;border:1px dashed #ccc;">';
      html += '<input type="checkbox" class="kanji-stroke-tts-check" style="pointer-events:auto;transform:scale(1.3);margin:0;" ' + (ttsEnabled ? "checked" : "") + ">";
      html += '<span style="writing-mode:vertical-rl;text-orientation:upright;font-size:13px;color:#555;font-weight:bold;letter-spacing:1px;pointer-events:auto;">読み上げ機能をオン</span>';
      html += "</label>";
      readings.forEach(function (r) {
        if (!r || !r.reading) return;
        const kind = r.kind === "on" ? "on" : "kun";
        const kindLabel = strokeOrderReadingKindLabel_(kind);
        const examples = Array.isArray(r.examples) ? r.examples.filter(Boolean) : [];
        const readTextForVoice = r.reading;
        const readTextForDisplay = strokeOrderReadingDisplayText_(r.reading, kind);
        ttsPhrases.push(kindLabel);
        ttsPhrases.push(readTextForVoice);
        /* DOM順: 種別→スロット→よみ→例文。CSS direction:rtl で右から 訓読み|A|いぬ|例文 */
        html += '<div class="kanji-so-reading-group">';
        html +=
          '<span class="kanji-so-reading-kind">' +
          escapeHtml(kindLabel) +
          "</span>";
        html +=
          '<span class="kanji-so-reading-slot">' +
          escapeHtml(strokeOrderReadingSlotLabel_(r.label)) +
          "</span>";
        html +=
          '<span class="kanji-so-reading-text">' +
          escapeHtml(readTextForDisplay) +
          "</span>";
        if (examples.length) {
          examples.forEach(function (ex) {
            const exText = normalizeStrokeOrderExampleText_(ex);
            if (!exText) return;
            ttsPhrases.push(exText);
            html +=
              '<span class="kanji-so-reading-example">' + escapeHtml(exText) + "</span>";
          });
        }
        html += "</div>";
      });
      if (!html) {
        clearStrokeOrderReadings_();
        stopStrokeOrderReadingTTS_();
        return;
      }
      el.innerHTML = html;
      const chk = el.querySelector(".kanji-stroke-tts-check");
      if (chk) {
        chk.addEventListener("change", function () {
          setUserPref("kanji_quiz_stroke_tts_enabled", chk.checked ? "1" : "0");
          if (!chk.checked) {
            stopStrokeOrderReadingTTS_();
          } else {
            playStrokeOrderReadingTTS_(ttsPhrases);
          }
        });
      }
      el.classList.add("is-visible");
      el.style.display = "flex";
      playStrokeOrderReadingTTS_(ttsPhrases);
    }
    var __kanjiHandScoreToastTimer = null;
    var __kanjiEarnedPtsToastTimer = null;
    /**
     * 今回の問題／採点で加算されたポイントを画面上部に約2秒表示。
     * pointer-events: none・固定レイヤのため操作や fetch の続行を阻害しない。
     */
    function showKanjiEarnedPointsToast(earnedRaw) {
      var earned = Number(earnedRaw);
      if (isNaN(earned)) earned = 0;
      var el = document.getElementById("kanji-earned-pts-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "kanji-earned-pts-toast";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        el.style.cssText =
          "position:fixed;left:50%;top:max(12px,env(safe-area-inset-top,12px));transform:translateX(-50%);" +
          "z-index:10051;padding:10px 20px;border-radius:14px;background:rgba(20,35,25,0.92);color:#e8f5e9;" +
          "font-size:clamp(15px,3.8vw,19px);font-weight:800;box-shadow:0 4px 20px rgba(0,0,0,0.25);" +
          "pointer-events:none;opacity:0;transition:opacity 0.22s ease;text-align:center;line-height:1.35;" +
          "max-width:min(92vw,320px);border:1px solid rgba(129,199,132,0.45);";
        document.body.appendChild(el);
      }
      var showNum = (earned >= 0 ? "+" : "") + earned.toFixed(2);
      el.textContent = "ポイント " + showNum + " Pt";
      el.style.opacity = "1";
      if (__kanjiEarnedPtsToastTimer) clearTimeout(__kanjiEarnedPtsToastTimer);
      __kanjiEarnedPtsToastTimer = setTimeout(function () {
        el.style.opacity = "0";
        __kanjiEarnedPtsToastTimer = null;
      }, 2000);
    }
    /** 手書き採点の点数（＋任意で獲得ポイント）を画面下部に約2秒表示 */
    function showKanjiHandScoreToast(scoreRaw, kanjiOpt, earnedPtsOpt) {
      var n = Math.max(0, Math.min(100, Math.round(Number(scoreRaw) || 0)));
      var ch = kanjiOpt != null ? String(kanjiOpt).trim() : "";
      var el = document.getElementById("kanji-hand-score-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "kanji-hand-score-toast";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        el.style.cssText =
          "position:fixed;left:50%;bottom:max(20px,env(safe-area-inset-bottom,12px));transform:translateX(-50%);" +
          "z-index:10050;padding:10px 18px;border-radius:12px;background:rgba(30,30,30,0.92);color:#fff;" +
          "font-size:clamp(16px,4vw,20px);font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.22);" +
          "pointer-events:none;opacity:0;transition:opacity 0.2s ease;text-align:center;line-height:1.35;" +
          "max-width:min(92vw,320px);";
        document.body.appendChild(el);
      }
      var scoreLine = ch ? "「" + ch + "」 " + n + " てん" : n + " てん";
      if (earnedPtsOpt !== undefined && earnedPtsOpt !== null) {
        var earned = Number(earnedPtsOpt);
        if (isNaN(earned)) earned = 0;
        var ptSign = earned >= 0 ? "+" : "";
        el.innerHTML =
          scoreLine +
          '<div style="margin-top:6px;color:#FFD54F;font-size:clamp(14px,3.5vw,18px);font-weight:800;">ポイント ' +
          ptSign +
          formatPointDisplayNum(earned) +
          " Pt</div>";
      } else {
        el.textContent = scoreLine;
      }
      el.style.opacity = "1";
      if (__kanjiHandScoreToastTimer) clearTimeout(__kanjiHandScoreToastTimer);
      __kanjiHandScoreToastTimer = setTimeout(function () {
        el.style.opacity = "0";
        __kanjiHandScoreToastTimer = null;
      }, 2000);
    }
    var __kanjiDailyLimitToastTimer = null;
    /**
     * 1日のポイント取得上限（同一漢字 2 回/日）に達したことを通知するトースト。
     * 採点自体は引き続きできるが、ポイント加算が翌日 0 時（JST）まで無い旨を表示する。
     */
    function showKanjiDailyLimitToast(kanjiChar) {
      var ch = kanjiChar ? "「" + String(kanjiChar) + "」" : "この漢字";
      var el = document.getElementById("kanji-daily-limit-toast");
      if (!el) {
        el = document.createElement("div");
        el.id = "kanji-daily-limit-toast";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        el.style.cssText =
          "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);" +
          "z-index:10052;padding:14px 22px;border-radius:14px;background:rgba(40,20,10,0.94);color:#FFD54F;" +
          "font-size:clamp(14px,3.5vw,17px);font-weight:700;box-shadow:0 6px 28px rgba(0,0,0,0.35);" +
          "pointer-events:none;opacity:0;transition:opacity 0.25s ease;text-align:center;line-height:1.5;" +
          "max-width:min(90vw,340px);border:1.5px solid rgba(255,213,79,0.5);";
        document.body.appendChild(el);
      }
      el.innerHTML =
        "📋 " + ch + " は<br>きょうのポイント上限（2 回）に<br>たっしました。" +
        '<div style="margin-top:6px;font-size:clamp(12px,3vw,14px);color:#FFAB91;">あす 0 じにリセットされます</div>';
      el.style.opacity = "1";
      if (__kanjiDailyLimitToastTimer) clearTimeout(__kanjiDailyLimitToastTimer);
      __kanjiDailyLimitToastTimer = setTimeout(function () {
        el.style.opacity = "0";
        __kanjiDailyLimitToastTimer = null;
      }, 3500);
    }
    var __kanjiWrongPracticeLastSubmitKey = "";
    var __kanjiWrongPracticeLastSubmitAt = 0;
    function isKanjiQuizWrongPanelVisible_() {
      const panel = document.getElementById("kanji-quiz-hw-wrong-panel");
      return !!(panel && panel.style.display !== "none");
    }
    function isKanjiQuizWrongFramePostMessage_(ev) {
      if (!ev) return false;
      var wrongFrame = getKanjiQuizWrongModelFrame();
      if (!wrongFrame || !wrongFrame.contentWindow) return false;
      return ev.source === wrongFrame.contentWindow;
    }
    function computeWrongPanelPracticeEarned_(score) {
      const s = Number(score) || 0;
      return s >= KANJI_QUIZ_HAND_PASS ? 5 : 3;
    }
    function refreshKanjiPlayPracticePtsBadge_(flashEarned) {
      const badge = document.getElementById("kanji-play-practice-pts");
      if (!badge) return;
      const total = kanjiQuizSession ? Number(kanjiQuizSession.wrongPracticePtsEarned) || 0 : 0;
      if (total <= 0) {
        badge.hidden = true;
        badge.textContent = "";
        return;
      }
      badge.hidden = false;
      badge.textContent = "+" + formatPointDisplayNum(total) + "Pt";
      if (flashEarned != null && !isNaN(Number(flashEarned))) {
        badge.textContent = "+" + formatPointDisplayNum(Number(flashEarned)) + "Pt";
        clearTimeout(badge.__flashTimer);
        badge.__flashTimer = setTimeout(function () {
          badge.textContent = "+" + formatPointDisplayNum(total) + "Pt";
        }, 1800);
      }
    }
    function awardKanjiWrongPanelPracticeScore_(score, kanjiChar) {
      if (!kanjiQuizSession || !isKanjiQuizWrongPanelVisible_()) return;
      const user = getAppKidUser_();
      if (!user || !user.id) return;
      const authScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
      const earned = computeWrongPanelPracticeEarned_(authScore);
      const nowMs = Date.now();
      const dedupeKey = String(kanjiChar || "") + ":" + authScore + ":practice";
      if (dedupeKey === __kanjiWrongPracticeLastSubmitKey && nowMs - __kanjiWrongPracticeLastSubmitAt < 950) return;
      __kanjiWrongPracticeLastSubmitKey = dedupeKey;
      __kanjiWrongPracticeLastSubmitAt = nowMs;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      const kanjiSetScopeId = buildKanjiSetScopeId_(
        kanjiQuizSession.modeName,
        kanjiQuizSession.unitName,
        kanjiQuizSession.setId,
        kanjiQuizSession.formatMode || getKanjiQuizFormatMode()
      );
      const unitId =
        kanjiSetScopeId +
        "_WRONG_PRACTICE_" +
        String(kanjiChar || (q && q.kanji) || "") +
        "_" +
        nowMs;
      fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "save_learning_session",
          userId: user.id,
          unitId: unitId,
          unitSheetName: kanjiQuizSession.unitName,
          isReviewMode: false,
          isRandom: true,
          results: [],
          learningCategory: "kanji",
          challengeType: "score",
          kanjiChar: String(kanjiChar || (q && q.kanji) || ""),
          score: authScore,
          earnedOverride: earned,
          questionId: unitId,
          questionCorrect: authScore >= KANJI_QUIZ_HAND_PASS,
          kanjiSetScopeId: kanjiSetScopeId,
          kanjiSetContinuation: true,
          kanjiQuestionType: "wrong_panel_practice"
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || d.status !== "success") return;
          const got = Number(d.earnedPoints);
          const applied = !isNaN(got) && got > 0 ? got : earned;
          kanjiQuizSession.wrongPracticePtsEarned =
            (Number(kanjiQuizSession.wrongPracticePtsEarned) || 0) + applied;
          refreshKanjiPlayPracticePtsBadge_(applied);
          if (typeof d.newTotal === "number") {
            user.points = d.newTotal;
            saveAppKidUserToLocal(user);
            const ptsEl = document.getElementById("user-points");
            if (ptsEl) ptsEl.innerText = String(d.newTotal);
          }
        })
        .catch(function () {});
    }
    function clearKanjiHwScoreStatus_() {
      const el = document.getElementById("kanji-hw-score-status");
      if (!el) return;
      el.innerHTML = "";
      el.style.display = "none";
      el.hidden = true;
      el.classList.remove("is-visible", "is-pass", "is-fail", "is-great");
    }
    function kanjiHwScoreStatusHexPoints_(cx, cy, r, rates) {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const rr = r * Math.max(0, Math.min(1, Number(rates[i]) || 0));
        pts.push((cx + rr * Math.cos(ang)).toFixed(1) + "," + (cy + rr * Math.sin(ang)).toFixed(1));
      }
      return pts.join(" ");
    }
    function kanjiHwScoreStatusGridHex_(cx, cy, r) {
      return kanjiHwScoreStatusHexPoints_(cx, cy, r, [1, 1, 1, 1, 1, 1]);
    }
    /** 項目別の小学生向け定型文（賞賛／助言） */
    var KANJI_HW_SCORE_FEEDBACK_TMPL_ = {
      strokeCount: {
        praise: "画数がぴったりだね！",
        tip: "もう一度、画の数をかぞえてみよう。"
      },
      strokeOrder: {
        praise: "かきじゅんがじょうず！",
        tip: "お手本のかきじゅんをよく見てみよう。"
      },
      trajectory: {
        praise: "線のながれがきれいだね！",
        tip: "線をゆっくり、まっすぐ書いてみよう。"
      },
      startEnd: {
        praise: "はじまりとおわりがうまくいったね！",
        tip: "はじめる位置と終わる位置を意識してみよう。"
      },
      structure: {
        praise: "字のかたちがよくそろっているよ！",
        tip: "バランスを見ながら、パーツの位置を整えよう。"
      },
      size: {
        praise: "大きさがちょうどいいね！",
        tip: "マスいっぱいに、大きすぎず書いてみよう。"
      }
    };
    function kanjiHwScoreFeedbackTmpl_(key) {
      return (
        KANJI_HW_SCORE_FEEDBACK_TMPL_[key] || {
          praise: "とてもよく書けているよ！",
          tip: "お手本を見て、もう一度書いてみよう。"
        }
      );
    }
    /** rate 上位2を賞賛、下位2を助言（key 重複なし） */
    function pickKanjiHwScoreFeedbackItems_(items, rates) {
      const ranked = items
        .map(function (it, i) {
          return {
            key: String(it.key || ""),
            label: String(it.label || ""),
            rate: rates[i],
            idx: i
          };
        })
        .filter(function (x) {
          return x.key && x.label && x.label !== "—" && x.key.indexOf("pad") !== 0;
        });
      const byHigh = ranked.slice().sort(function (a, b) {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return a.idx - b.idx;
      });
      const praise = byHigh.slice(0, 2);
      const praiseKeys = {};
      praise.forEach(function (p) {
        praiseKeys[p.key] = true;
      });
      const byLow = ranked.slice().sort(function (a, b) {
        if (a.rate !== b.rate) return a.rate - b.rate;
        return a.idx - b.idx;
      });
      const tips = [];
      byLow.forEach(function (t) {
        if (tips.length >= 2) return;
        if (praiseKeys[t.key]) return;
        tips.push(t);
      });
      /* 賞賛と重なって足りない場合は残りから補完 */
      if (tips.length < 2) {
        byLow.forEach(function (t) {
          if (tips.length >= 2) return;
          const already = tips.some(function (x) {
            return x.key === t.key;
          });
          if (already) return;
          tips.push(t);
        });
      }
      return { praise: praise, tips: tips.slice(0, 2) };
    }
    function buildKanjiHwScoreFeedbackHtml_(items, rates) {
      const picked = pickKanjiHwScoreFeedbackItems_(items, rates);
      if (!picked.praise.length && !picked.tips.length) return "";
      let html = '<div class="kanji-hw-score-feedback" aria-label="さいてんのアドバイス">';
      picked.praise.forEach(function (p) {
        const tmpl = kanjiHwScoreFeedbackTmpl_(p.key);
        html +=
          '<p class="is-praise"><span class="kanji-hw-score-fb-label">よくできた：' +
          escapeHtml(p.label) +
          "</span>" +
          escapeHtml(tmpl.praise) +
          "</p>";
      });
      picked.tips.forEach(function (t) {
        const tmpl = kanjiHwScoreFeedbackTmpl_(t.key);
        html +=
          '<p class="is-tip"><span class="kanji-hw-score-fb-label">がんばろう：' +
          escapeHtml(t.label) +
          "</span>" +
          escapeHtml(tmpl.tip) +
          "</p>";
      });
      html += "</div>";
      return html;
    }
    /** 記述カード横：横長レーダー＋ゲージ＋賞賛／助言 */
    function renderKanjiHwScoreStatus_(breakdown, scoreFallback) {
      const el = document.getElementById("kanji-hw-score-status");
      if (!el) return;
      const sec = document.getElementById("section-kanji-quiz-play");
      const hwMode =
        sec &&
        (sec.classList.contains("kanji-quiz-hw-active") ||
          sec.classList.contains("kanji-quiz-stroke-order-active"));
      if (!hwMode) {
        clearKanjiHwScoreStatus_();
        return;
      }
      let bd = breakdown && typeof breakdown === "object" ? breakdown : null;
      let items = bd && Array.isArray(bd.items) ? bd.items.slice(0, 6) : null;
      const totalMax = bd && bd.totalMax != null ? Number(bd.totalMax) : 100;
      let total = bd && bd.total != null ? Number(bd.total) : Number(scoreFallback);
      if (isNaN(total)) total = 0;
      total = Math.max(0, Math.min(totalMax || 100, Math.round(total)));
      if (!items || !items.length) {
        /* 内訳なしでも総点だけ表示 */
        items = [
          { key: "strokeCount", label: "画数", score: 0, max: 10, rate: 0 },
          { key: "strokeOrder", label: "画順", score: 0, max: 20, rate: 0 },
          { key: "trajectory", label: "軌道", score: 0, max: 28, rate: 0 },
          { key: "startEnd", label: "始点終点", score: 0, max: 10, rate: 0 },
          { key: "structure", label: "構造", score: 0, max: 14, rate: 0 },
          { key: "size", label: "大きさ", score: 0, max: 18, rate: 0 }
        ];
      }
      while (items.length < 6) {
        items.push({ key: "pad" + items.length, label: "—", score: 0, max: 0, rate: 0 });
      }
      const rates = items.map(function (it) {
        if (typeof it.rate === "number") return Math.max(0, Math.min(1, it.rate));
        const mx = Number(it.max) || 0;
        return mx > 0 ? Math.max(0, Math.min(1, Number(it.score) / mx)) : 0;
      });
      const cx = 110;
      const cy = 110;
      const R = 78;
      let grid = "";
      [0.25, 0.5, 0.75, 1].forEach(function (f) {
        grid +=
          '<polygon class="kanji-hw-score-hex-grid" points="' +
          kanjiHwScoreStatusGridHex_(cx, cy, R * f) +
          '"></polygon>';
      });
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const x2 = (cx + R * Math.cos(ang)).toFixed(1);
        const y2 = (cy + R * Math.sin(ang)).toFixed(1);
        grid +=
          '<line class="kanji-hw-score-hex-spoke" x1="' +
          cx +
          '" y1="' +
          cy +
          '" x2="' +
          x2 +
          '" y2="' +
          y2 +
          '"></line>';
      }
      const fillPts = kanjiHwScoreStatusHexPoints_(cx, cy, R, rates);
      let labelSvg = "";
      items.forEach(function (it, i) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const lx = cx + (R + 22) * Math.cos(ang);
        const ly = cy + (R + 22) * Math.sin(ang);
        const anchor = Math.abs(Math.cos(ang)) < 0.2 ? "middle" : Math.cos(ang) > 0 ? "start" : "end";
        labelSvg +=
          '<text class="kanji-hw-score-hex-label" x="' +
          lx.toFixed(1) +
          '" y="' +
          ly.toFixed(1) +
          '" text-anchor="' +
          anchor +
          '" dominant-baseline="middle">' +
          escapeHtml(String(it.label || "")) +
          "</text>";
      });
      let rows = "";
      items.forEach(function (it, i) {
        const sc = Math.max(0, Math.round(Number(it.score) || 0));
        const mx = Math.max(0, Math.round(Number(it.max) || 0));
        const pct = Math.round(rates[i] * 100);
        rows +=
          '<li class="kanji-hw-score-row" data-key="' +
          escapeHtml(String(it.key || "")) +
          '">' +
          '<span class="kanji-hw-score-row-label">' +
          escapeHtml(String(it.label || "")) +
          "</span>" +
          '<span class="kanji-hw-score-row-bar" aria-hidden="true"><span class="kanji-hw-score-row-fill" style="width:' +
          pct +
          '%"></span></span>' +
          '<span class="kanji-hw-score-row-pts">' +
          sc +
          '<span class="kanji-hw-score-row-max">/' +
          mx +
          "</span></span>" +
          '<span class="kanji-hw-score-row-pct">' +
          pct +
          "%</span>" +
          "</li>";
      });
      const feedbackHtml = buildKanjiHwScoreFeedbackHtml_(items, rates);
      /* 書き順判定（点列距離＋方向ペナルティ方式）が返す「最初に間違えた画」 */
      const firstWrong = bd ? Math.max(0, Math.round(Number(bd.firstWrongStroke) || 0)) : 0;
      const orderFailHint = (function () {
        if (!firstWrong || !bd || !Array.isArray(bd.orderEvalDetails)) return "";
        const row = bd.orderEvalDetails[firstWrong - 1];
        if (!row || !row.details) return "";
        if (row.details.failReason === "direction") return "（書き方）";
        if (row.details.failReason === "relStart") return "（つなぎ）";
        if (row.details.failReason === "shape") return "（形）";
        return "";
      })();
      const orderNote = firstWrong
        ? '<p class="kanji-hw-score-note kanji-hw-score-order-note">かきじゅん：' +
          firstWrong +
          "画目でまちがえたよ" +
          escapeHtml(orderFailHint) +
          "</p>"
        : "";
      const sizeNote =
        bd && bd.sizeLabel
          ? '<p class="kanji-hw-score-note">' + escapeHtml(String(bd.sizeLabel)) + "</p>"
          : "";
      const gradeClass = total >= 85 ? "is-great" : total >= 60 ? "is-pass" : "is-fail";
      el.className = "kanji-hw-score-status is-visible " + gradeClass;
      el.hidden = false;
      el.style.display = "block";
      el.innerHTML =
        '<div class="kanji-hw-score-status-inner">' +
        '<div class="kanji-hw-score-status-head">' +
        '<span class="kanji-hw-score-status-title">さいてんステータス</span>' +
        '<span class="kanji-hw-score-total">' +
        '<span class="kanji-hw-score-total-val">' +
        total +
        "</span>" +
        '<span class="kanji-hw-score-total-max"> / ' +
        (totalMax || 100) +
        " てん</span>" +
        "</span>" +
        "</div>" +
        '<div class="kanji-hw-score-status-body">' +
        '<div class="kanji-hw-score-radar-wrap">' +
        '<svg class="kanji-hw-score-radar" viewBox="0 0 220 220" width="220" height="220" aria-hidden="true">' +
        grid +
        '<polygon class="kanji-hw-score-hex-fill" points="' +
        fillPts +
        '"></polygon>' +
        '<polygon class="kanji-hw-score-hex-outline" points="' +
        fillPts +
        '"></polygon>' +
        labelSvg +
        "</svg>" +
        "</div>" +
        '<ul class="kanji-hw-score-list">' +
        rows +
        "</ul>" +
        "</div>" +
        feedbackHtml +
        orderNote +
        sizeNote +
        "</div>";
    }
    /** breakdown.total を正とする手書き得点（DOM #score 読み取りとのズレ防止） */
    function kanjiQuizResolveHandScoreFromEval_(score, breakdown) {
      if (breakdown && breakdown.total != null && !isNaN(Number(breakdown.total))) {
        return Math.max(0, Math.min(100, Math.round(Number(breakdown.total))));
      }
      var sc = Number(score);
      if (isNaN(sc)) return null;
      return Math.max(0, Math.min(100, Math.round(sc)));
    }
    function isKanjiQuizAuthoritativeHandEval_(breakdown) {
      return !!(breakdown && typeof breakdown === "object" && breakdown.total != null && !isNaN(Number(breakdown.total)));
    }
    function kanjiQuizShouldSkipHandScoreReapply_(authScore) {
      if (!kanjiQuizSession) return false;
      var prev = kanjiQuizSession.hwLastAppliedAuthScore;
      if (prev == null || isNaN(Number(prev))) return false;
      var p = Number(prev);
      var a = Number(authScore);
      if (p >= KANJI_QUIZ_HAND_PASS && a >= KANJI_QUIZ_HAND_PASS) return true;
      if (p === a && kanjiQuizHwAnswerSubmitted_()) return true;
      return false;
    }
    function kanjiQuizApplyAuthoritativeHandScore_(authScore, breakdown, meta) {
      meta = meta || {};
      if (!kanjiQuizSession) return;
      var quizSec = document.getElementById("section-kanji-quiz-play");
      if (!quizSec || !quizSec.classList.contains("active")) return;
      var q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || !isKanjiQuizHandwritingQuestionType_(q.type)) return;
      if (!isKanjiQuizAuthoritativeHandEval_(breakdown)) return;
      if (authScore == null || isNaN(authScore)) return;
      if (kanjiQuizShouldSkipHandScoreReapply_(authScore)) {
        kanjiQuizSession.lastHandScore = authScore;
        try { renderKanjiHwScoreStatus_(breakdown, authScore); } catch (_eUp) {}
        return;
      }
      if (kanjiQuizHwAnswerSubmitted_()) {
        if (authScore >= KANJI_QUIZ_HAND_PASS) {
          var wrongPanel = document.getElementById("kanji-quiz-hw-wrong-panel");
          var wrongVisible = wrongPanel && wrongPanel.style.display !== "none";
          if (!wrongVisible && (kanjiQuizSession.hwPassPendingAdvance || kanjiQuizSession.rubyHandComplete)) {
            kanjiQuizSession.lastHandScore = authScore;
            try { renderKanjiHwScoreStatus_(breakdown, authScore); } catch (_eUp2) {}
            return;
          }
          resetKanjiQuizHandAnswerState_();
          try { kanjiQuizHideWrongFeedback(); } catch (_eRec) {}
        } else {
          return;
        }
      }
      kanjiQuizSession.hwLastAppliedAuthScore = authScore;
      kanjiQuizSession.lastHandScore = authScore;
      kanjiQuizSession.lastHandScoreHadBreakdown = true;
      var kToast = String((meta && meta.kanjiChar) || (q && q.kanji) || "").trim();
      if (meta.showToast === true) showKanjiHandScoreToast(authScore, kToast);
      try {
        renderKanjiHwScoreStatus_(breakdown, authScore);
        try { kanjiQuizResetHwViewportScroll_(); } catch (_eScr) {}
      } catch (_eBd) {}
      try {
        kanjiQuizOnHandwritingScored(authScore);
      } finally {
        clearKanjiQuizHandEvalWatchdog_();
        setKanjiQuizHandSubmitBusy(false);
      }
    }
    /** 漢字未選択レース等で iframe が返す breakdown のない 0 点（本採点ではない） */


    function isKanjiQuizSpuriousZeroScoreMessage_(ev) {
      if (!ev || !ev.data || ev.data.type !== "kanjiQuizScored") return false;
      if (isKanjiQuizAuthoritativeHandEval_(ev.data.breakdown)) return false;
      var sc = Number(ev.data.score);
      return sc === 0 || !ev.data.breakdown;
    }
    /** KP iframe の kanjiQuizScored を1リスナで処理（クイズ優先、その後のみ練習の GAS 保存） */
    function initKanjiParentKanjiQuizScoredBridge() {
      if (window.__kanjiParentKanjiQuizScoredBridgeBound) return;
      window.__kanjiParentKanjiQuizScoredBridgeBound = true;
      window.addEventListener("message", function (ev) {
        if (!ev || !ev.data || ev.data.type !== "kanjiQuizScored") return;

        if (isKanjiQuizWrongFramePostMessage_(ev)) {
          var quizSecWrong = document.getElementById("section-kanji-quiz-play");
          if (!quizSecWrong || !quizSecWrong.classList.contains("active") || !kanjiQuizSession) return;
          if (!isKanjiQuizWrongPanelVisible_()) return;
          if (isKanjiQuizSpuriousZeroScoreMessage_(ev)) return;
          if (!isKanjiQuizAuthoritativeHandEval_(ev.data.breakdown)) return;
          var wrongAuthScore = kanjiQuizResolveHandScoreFromEval_(ev.data.score, ev.data.breakdown);
          if (wrongAuthScore == null) return;
          awardKanjiWrongPanelPracticeScore_(wrongAuthScore, ev.data.kanjiChar);
          return;
        }

        if (!isKanjiQuizScoreFramePostMessage_(ev)) return;

        var quizSec = document.getElementById("section-kanji-quiz-play");
        if (quizSec && quizSec.classList.contains("active") && kanjiQuizSession) {
          var qNow = kanjiQuizSession.questions[kanjiQuizSession.index];
          if (qNow && isKanjiQuizHandwritingQuestionType_(qNow.type)) {
            if (isKanjiQuizSpuriousZeroScoreMessage_(ev)) return;
            if (!isKanjiQuizAuthoritativeHandEval_(ev.data.breakdown)) return;
            var authScore = kanjiQuizResolveHandScoreFromEval_(ev.data.score, ev.data.breakdown);
            kanjiQuizApplyAuthoritativeHandScore_(authScore, ev.data.breakdown, {
              kanjiChar: ev.data.kanjiChar,
              showToast: false
            });
            return;
          }
          kanjiQuizSession.lastHandScore = ev.data.score;
          kanjiQuizSession.lastHandScoreHadBreakdown = !!ev.data.breakdown;
          return;
        }

        var pracSec = document.getElementById("section-kanji-practice");
        if (!pracSec || !pracSec.classList.contains("active")) return;

        var score = kanjiQuizResolveHandScoreFromEval_(ev.data.score, ev.data.breakdown);
        if (score == null) score = Math.max(0, Math.min(100, Number(ev.data.score) || 0));
        var kanjiChar = String(ev.data.kanjiChar || "");
        showKanjiHandScoreToast(score, kanjiChar);
        if (!kanjiChar) return;

        var nowMs = Date.now();
        var dedupeKey = kanjiChar + ":" + score;
        if (dedupeKey === __kanjiPracticeLastSubmitKey && nowMs - __kanjiPracticeLastSubmitAt < 950) return;
        __kanjiPracticeLastSubmitKey = dedupeKey;
        __kanjiPracticeLastSubmitAt = nowMs;

        var kidUser = JSON.parse(localStorage.getItem("app_kid_user") || "null");
        if (!kidUser || !kidUser.id) return;

        var bEl = document.getElementById("kp-book-select");
        var uEl = document.getElementById("kp-sheet-select");
        var sEl = document.getElementById("kp-set-select");
        var mid = (bEl && bEl.value) || "KANJI_PRACTICE";
        var unm = (uEl && uEl.value) || "KANJI_PRACTICE";
        var sid = (sEl && sEl.value) || "PRACTICE";
        var unitScope = "KP_" + mid + "_" + unm + "_" + sid;

        fetch(GAS_API_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "save_learning_session",
            userId: kidUser.id,
            unitId: unitScope + "_" + kanjiChar + "_" + nowMs,
            unitSheetName: unm,
            isReviewMode: false,
            isRandom: true,
            results: [],
            learningCategory: "kanji",
            challengeType: "score",
            kanjiChar: kanjiChar,
            score: score,
            questionId: unitScope + "_" + kanjiChar,
            questionCorrect: score >= KANJI_QUIZ_HAND_PASS,
            kanjiSetScopeId: unitScope,
            kanjiSetContinuation: true,
            kanjiQuestionType: "ruby_to_kanji"
          })
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (!d || d.status !== "success") return;
            try {
              showKanjiHandScoreToast(score, kanjiChar, d.earnedPoints);
            } catch (ePt) {}
            // ── 1日の上限に達した場合、追加トーストで通知 ──
            if (d.dailyLimitChars && d.dailyLimitChars.length > 0) {
              try { showKanjiDailyLimitToast(kanjiChar); } catch (_dl) {}
            }
            if (typeof d.newTotal === "number") {
              if (d.kanjiChallengeChar && d.kanjiChallengePatch) {
                mergeKanjiChallengePatchClient(d.kanjiChallengeChar, d.kanjiChallengePatch);
              }
              kidUser.points = d.newTotal;
              saveAppKidUserToLocal(kidUser);
              var pts = document.getElementById("user-points");
              if (pts) pts.innerText = String(d.newTotal);
            }
          })
          .catch(function () {});
      });
    }
    function kanjiQuizEnsureScoreListener() {
      initKanjiParentKanjiQuizScoredBridge();
      initKanjiHandAnalyticsBridge();
      initKanjiQuizWrongModelKpReselectBridge();
      initKanjiQuizWrongPanelLayoutBridge_();
    }
    function initKanjiQuizWrongPanelLayoutBridge_() {
      if (window.__kanjiQuizWrongPanelLayoutBound) return;
      window.__kanjiQuizWrongPanelLayoutBound = true;
      window.addEventListener("message", function (ev) {
        if (!ev || !ev.data || ev.data.type !== "kpWrongPanelModeChanged") return;
        const frame = getKanjiQuizWrongModelFrame();
        if (!frame || ev.source !== frame.contentWindow) return;
        setTimeout(function () {
          kpRefreshWrongPanelLayout_(frame);
        }, 40);
      });
    }
    /** KanjiVG 再読込で target-kanji が先頭に戻る場合に、不正解モデル用の字を取り直す */
    function initKanjiQuizWrongModelKpReselectBridge() {
      if (window.__kanjiQuizWrongModelKpReselectBound) return;
      window.__kanjiQuizWrongModelKpReselectBound = true;
      window.addEventListener("message", function (ev) {
        if (!ev || !ev.data || ev.data.type !== "kpKanjiDataReady") return;
        const fr = getKanjiQuizWrongModelFrame();
        if (!fr || ev.source !== fr.contentWindow) return;
        if (!kanjiQuizSession || !kanjiQuizSession.wrongModelKanjiChar) return;
        const panel = document.getElementById("kanji-quiz-hw-wrong-panel");
        if (!panel || panel.style.display === "none") return;
        const target = kanjiQuizSession.wrongModelKanjiChar;
        if (!selectKanjiCharInWrongModelFrame(target)) return;
        setTimeout(function () {
          const frame = getKanjiQuizWrongModelFrame();
          const wrap = document.getElementById("kanji-quiz-wrong-model-wrap");
          const activePanel = document.getElementById("kanji-quiz-hw-wrong-panel");
          if (
            frame &&
            wrap &&
            frame.parentElement === wrap &&
            activePanel &&
            activePanel.style.display !== "none" &&
            kanjiQuizSession &&
            kanjiQuizSession.wrongModelKanjiChar === target
          ) {
            applyKpQuizWrongPanelCompactMode(frame, true);
            if (frame.contentWindow) {
              frame.contentWindow.postMessage({ type: "quizPlayStrokeOrderDemo" }, "*");
            }
          }
        }, 80);
      });
    }
    function selectKanjiCharInQuizFrame(ch) {
      const frame = getKanjiQuizScoreFrame();
      const win = frame && frame.contentWindow;
      if (!win) return false;
      try {
        const doc = win.document;
        const sel = doc.getElementById("target-kanji");
        if (!sel) return false;
        const target = String(ch || "");
        if (!target) return false;
        let ok = Array.from(sel.options || []).some(function (o) { return String(o.value) === target; });
        if (!ok && win.KANJI_DATA && typeof win.KANJI_DATA === "object" && win.KANJI_DATA[target]) {
          const op = doc.createElement("option");
          op.value = target;
          op.textContent = target;
          sel.appendChild(op);
          ok = true;
        }
        if (!ok) {
          alert("「" + target + "」は KanjiVG.txt にないため、手書きできません。");
          return false;
        }
        sel.value = target;
        if (String(sel.value) !== target) {
          return false;
        }
        if (typeof win.initTargetKanji === "function") win.initTargetKanji();
        if (typeof win.switchMode === "function") win.switchMode("score");
        return true;
      } catch (e) {
        return false;
      }
    }
    function selectKanjiCharInWrongModelFrame(ch) {
      const frame = getKanjiQuizWrongModelFrame();
      const win = frame && frame.contentWindow;
      if (!win) return false;
      try {
        const doc = win.document;
        const sel = doc.getElementById("target-kanji");
        if (!sel) return false;
        const target = String(ch || "");
        if (!target) return false;
        try {
          win.__kpPendingKanjiSelect = target;
        } catch (e0) {}
        let ok = Array.from(sel.options || []).some(function (o) { return String(o.value) === target; });
        if (!ok && win.KANJI_DATA && typeof win.KANJI_DATA === "object" && win.KANJI_DATA[target]) {
          const op = doc.createElement("option");
          op.value = target;
          op.textContent = target;
          sel.appendChild(op);
          ok = true;
        }
        if (!ok) return false;
        sel.value = target;
        if (String(sel.value) !== target) return false;
        if (typeof win.initTargetKanji === "function") win.initTargetKanji();
        if (typeof win.switchMode === "function") win.switchMode("demo");
        return true;
      } catch (e) {
        return false;
      }
    }
    /** 現在マスの漢字だけ KanjiVG を初期化（全文字ループは省略して初回表示を高速化） */
    function preloadKanjiQuizTargetsInFrame(targets, activeChar) {
      const frame = getKanjiQuizScoreFrame();
      const win = frame && frame.contentWindow;
      if (!win || !Array.isArray(targets) || !targets.length) return false;
      try {
        const sel = win.document.getElementById("target-kanji");
        if (!sel) return false;
        for (let i = 0; i < targets.length; i++) {
          const ch = targets[i];
          const ok = Array.from(sel.options || []).some(function (o) { return String(o.value) === String(ch); });
          if (!ok) {
            alert("「" + ch + "」は KanjiVG.txt にないため、手書きできません。");
            return false;
          }
        }
        const tActive = activeChar || targets[0];
        sel.value = tActive;
        if (typeof win.initTargetKanji === "function") win.initTargetKanji();
        if (typeof win.switchMode === "function") win.switchMode("score");
        return true;
      } catch (e) {
        return false;
      }
    }
    function kanjiQuizBumpWrongModelMountGen_() {
      if (!kanjiQuizSession) return 0;
      kanjiQuizSession.wrongModelMountGen = (kanjiQuizSession.wrongModelMountGen || 0) + 1;
      return kanjiQuizSession.wrongModelMountGen;
    }
    function kanjiQuizHideWrongFeedback() {
      kanjiQuizBumpWrongModelMountGen_();
      const panel = document.getElementById("kanji-quiz-hw-wrong-panel");
      const sec = document.getElementById("section-kanji-quiz-play");
      if (sec) sec.classList.remove("kanji-quiz-wrong-visible");
      if (!kanjiQuizHwAnswerSubmitted_()) {
        setKanjiQuizHwCardControlsLocked(false);
      }
      if (panel) panel.style.display = "none";
      try {
        if (kanjiQuizSession) delete kanjiQuizSession.wrongModelKanjiChar;
        const frClear = getKanjiQuizWrongModelFrame();
        const wClear = frClear && frClear.contentWindow;
        if (wClear) {
          try {
            delete wClear.__kpPendingKanjiSelect;
          } catch (eClr) {
            wClear.__kpPendingKanjiSelect = "";
          }
        }
      } catch (eH) {}
      const wrap = document.getElementById("kanji-quiz-wrong-model-wrap");
      const frame = getKanjiQuizWrongModelFrame();
      if (frame && wrap && frame.parentElement === wrap) {
        applyKpQuizWrongPanelCompactMode(frame, false);
        try {
          wrap.style.minHeight = "";
          wrap.style.height = "";
          wrap.classList.remove("is-kp-view-pending");
        } catch (_eClrW) {}
      }
      /* 書き順：誤答パネルを閉じたら記述欄のなぞり軌道を描き直す */
      try {
        if (kanjiQuizTraceGuideStrokes && kanjiQuizTraceGuideStrokes.length) {
          kanjiQuizRedrawParentCanvas();
        }
      } catch (_eRem) {}
    }
    function kanjiQuizMountWrongModelFrameForChar(ch) {
      const modelWrap = document.getElementById("kanji-quiz-wrong-model-wrap");
      const frame = getKanjiQuizWrongModelFrame();
      if (!modelWrap || !frame || !ch) return;
      const mountGen = kanjiQuizBumpWrongModelMountGen_();
      function isMountStale_() {
        return !kanjiQuizSession || kanjiQuizSession.wrongModelMountGen !== mountGen;
      }
      function mountAndPlayDemo() {
        if (isMountStale_()) return;
        if (frame.parentElement !== modelWrap) {
          modelWrap.appendChild(frame);
        }
        modelWrap.classList.add("is-kp-view-pending");
        delete frame.dataset.kpWrongViewPinned;
        applyKpQuizWrongPanelCompactMode(frame, true);
        frame.style.width = "100%";
        frame.style.maxWidth = "100%";
        frame.style.pointerEvents = "auto";
        var initH = kpWrongModelWrapTargetHeight_(modelWrap);
        try {
          modelWrap.style.minHeight = initH + "px";
          modelWrap.style.height = initH + "px";
        } catch (_eWrap) {}
        kpApplyWrongModelFrameFill_(frame);
        try { patchKanjiWrongModelFramePostMessage(frame); } catch (_ePatch) {}
        setTimeout(function () {
          try {
            if (isMountStale_()) return;
            delete frame.dataset.kpWrongViewPinned;
            var targetH = kpWrongModelWrapTargetHeight_(modelWrap);
            try {
              modelWrap.style.minHeight = targetH + "px";
              modelWrap.style.height = targetH + "px";
            } catch (_eW2) {}
            kpApplyWrongModelFrameFill_(frame);
            kpForceWrongPanelCanvasSquare_(frame);
            kpResizeFrameToContent(frame);
            kpForceWrongPanelCanvasSquare_(frame);
            if (kpPinWrongPanelViewToModeButtons_(frame)) {
              frame.dataset.kpWrongViewPinned = "1";
            }
            kpRevealWrongModelWrap_(frame);
          } catch (e) {
            kpRevealWrongModelWrap_(frame);
          }
        }, 60);
        setTimeout(function () {
          try {
            if (isMountStale_()) return;
            kpForceWrongPanelCanvasSquare_(frame);
            if (frame.contentWindow) {
              frame.contentWindow.postMessage({ type: "quizPlayStrokeOrderDemo" }, "*");
            }
          } catch (e) {}
        }, 180);
      }
      function trySelectWithRetry() {
        let mountDone = false;
        let attempts = 0;
        const retryDelays = [0, 140, 360, 700, 1200, 2000, 3200];
        function finishMount() {
          if (mountDone || isMountStale_()) return;
          mountDone = true;
          mountAndPlayDemo();
        }
        function trySelectOnce() {
          if (mountDone || isMountStale_()) return;
          attempts++;
          if (selectKanjiCharInWrongModelFrame(ch)) {
            finishMount();
            return;
          }
          if (attempts >= retryDelays.length) {
            finishMount();
          }
        }
        retryDelays.forEach(function (delayMs) {
          setTimeout(trySelectOnce, delayMs);
        });
        function onDataReady(ev) {
          if (mountDone || isMountStale_()) return;
          if (!ev || !ev.data || ev.data.type !== "kpKanjiDataReady") return;
          const fr = getKanjiQuizWrongModelFrame();
          if (!fr || ev.source !== fr.contentWindow) return;
          window.removeEventListener("message", onDataReady);
          setTimeout(trySelectOnce, 40);
        }
        window.addEventListener("message", onDataReady);
        setTimeout(function () {
          window.removeEventListener("message", onDataReady);
        }, 5000);
      }
      ensureKanjiWrongModelFrameReadyOnce().then(trySelectWithRetry);
    }
    /** 誤答パネル：お手本（完成形）を表示（iframe 内ボタンと同じ経路） */
    function kanjiQuizWrongShowOtehon() {
      const frame = getKanjiQuizWrongModelFrame();
      if (!frame) return;
      try {
        const ch = (kanjiQuizSession && kanjiQuizSession.wrongModelKanjiChar) || "";
        if (ch && !selectKanjiCharInWrongModelFrame(ch)) {
          kanjiQuizMountWrongModelFrameForChar(ch);
          return;
        }
        /* 再マウントや高さ再計算はせず、埋め込み側のボタンと同じ操作だけ行う */
        const doc = frame.contentDocument;
        const btn =
          doc &&
          Array.prototype.find.call(doc.querySelectorAll(".controls button") || [], function (b) {
            const oc = String(b.getAttribute("onclick") || "");
            return oc.indexOf("switchMode('demo')") >= 0 && oc.indexOf("playAnimation") < 0;
          });
        if (btn) {
          btn.click();
        } else if (frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "quizSwitchMode", mode: "demo" }, "*");
          if (typeof frame.contentWindow.switchMode === "function") {
            frame.contentWindow.switchMode("demo");
          }
        }
        setTimeout(function () {
          try {
            applyKpQuizWrongPanelCompactMode(frame, true);
            kpApplyWrongModelFrameFill_(frame);
            kpPinWrongPanelViewToModeButtons_(frame);
          } catch (_e) {}
        }, 80);
      } catch (_e2) {}
    }
    /** 誤答パネル：書き順デモを再生（iframe 内ボタンと同じ経路） */
    function kanjiQuizWrongPlayStrokeDemo() {
      const frame = getKanjiQuizWrongModelFrame();
      if (!frame) return;
      try {
        const ch = (kanjiQuizSession && kanjiQuizSession.wrongModelKanjiChar) || "";
        if (ch && !selectKanjiCharInWrongModelFrame(ch)) {
          kanjiQuizMountWrongModelFrameForChar(ch);
          return;
        }
        const doc = frame.contentDocument;
        const btn =
          doc &&
          Array.prototype.find.call(doc.querySelectorAll(".controls button") || [], function (b) {
            const oc = String(b.getAttribute("onclick") || "");
            return oc.indexOf("playAnimation") >= 0;
          });
        if (btn) {
          btn.click();
        } else if (frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "quizPlayStrokeOrderDemo" }, "*");
          if (typeof frame.contentWindow.switchMode === "function") {
            frame.contentWindow.switchMode("demo");
          }
          setTimeout(function () {
            try {
              if (typeof frame.contentWindow.playAnimation === "function") {
                frame.contentWindow.playAnimation();
              }
            } catch (_ePlay) {}
          }, 40);
        }
        setTimeout(function () {
          try {
            applyKpQuizWrongPanelCompactMode(frame, true);
            kpApplyWrongModelFrameFill_(frame);
            kpPinWrongPanelViewToModeButtons_(frame);
          } catch (_e) {}
        }, 120);
      } catch (_e2) {}
    }
    function kanjiQuizShowHandwritingWrongFeedback(sc, opts) {
      opts = opts || {};
      const panel = document.getElementById("kanji-quiz-hw-wrong-panel");
      const redWrap = document.getElementById("kanji-quiz-wrong-red-chars");
      if (!kanjiQuizSession || !panel || !redWrap) return;
      const headEl = document.getElementById("kanji-quiz-hw-wrong-heading");
      if (headEl) {
        headEl.textContent =
          sc != null && !isNaN(Number(sc))
            ? "ざんねん（" + sc + "てん・60点みまん）"
            : "ざんねん（60点みまん）";
      }
      const targets = kanjiQuizSession.rubyHandTargets || [];
      const slot = kanjiQuizSession.rubyHandSlot || 0;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      const wordKanjiTargets = kanjiQuizHanOnlyChars((q && (q.correctAnswer || q.kanji)) || "");
      const ch =
        targets[slot] || wordKanjiTargets[slot] || wordKanjiTargets[0] || "";
      if (ch) {
        kanjiQuizSession.rubyHandTargets = wordKanjiTargets.length
          ? wordKanjiTargets
          : targets.length
            ? targets
            : [ch];
        kanjiQuizSession.rubyHandSlot = Math.max(
          0,
          Math.min(slot, kanjiQuizSession.rubyHandTargets.length - 1)
        );
      }
      if (ch) kanjiQuizSession.wrongModelKanjiChar = ch;
      else delete kanjiQuizSession.wrongModelKanjiChar;
      const fullStr = q && q.correctAnswer != null ? String(q.correctAnswer) : "";
      const fullKanji = kanjiQuizHanOnlyChars(fullStr).join("");
      const tlen = (kanjiQuizSession.rubyHandTargets || []).length;
      let html = "";
      if (ch) {
        html += "<span class=\"kanji-quiz-wrong-char-main\">" + escapeHtml(ch) + "</span>";
        if (tlen > 1) {
          html += "<span class=\"kanji-quiz-wrong-sub\">いまのマスにかくかんじ</span>";
        }
      }
      if (fullKanji && tlen > 1) {
        html += "<div class=\"kanji-quiz-wrong-full-line\">ぜんたい：" + escapeHtml(fullKanji) + "</div>";
      } else if (fullKanji && !ch) {
        html += "<span class=\"kanji-quiz-wrong-char-main\">" + escapeHtml(fullKanji) + "</span>";
      }
      redWrap.innerHTML = html || "<span class=\"kanji-quiz-wrong-char-main\">（データなし）</span>";
      panel.style.display = "flex";
      const sec = document.getElementById("section-kanji-quiz-play");
      if (sec) sec.classList.add("kanji-quiz-wrong-visible");
      if (!opts.keepCanvasUnlocked) {
        setKanjiQuizHwCardControlsLocked(true);
      }
      if (ch) kanjiQuizMountWrongModelFrameForChar(ch);
      /* 左右並びのため scrollIntoView はしない（片方だけ見えるのを防ぐ） */
      try {
        const hw = document.getElementById("kanji-quiz-drill-handwriting");
        if (hw) {
          hw.style.display = "flex";
        }
      } catch (eShowHw) {}
      kanjiQuizResetHwViewportScroll_();
    }
    function normalizeKanjiQuizInput(str) {
      try {
        return String(str || "").trim().normalize("NFKC");
      } catch (e) {
        return String(str || "").trim();
      }
    }
    /** れいぶん→よみ：原文を縦書きで表示し、対象かんじを赤字で強調（伏字ではなく漢字をそのまま）。 */
    function kanjiYomiMountTypingRailLayout_() {
      var rail = document.getElementById("kanji-yomi-typing-rail");
      var prompt = document.getElementById("kanji-play-prompt");
      var submit = document.getElementById("kanji-play-submit-btn");
      var typeRoot = document.getElementById("kanji-yomi-type-root");
      if (!rail || !prompt || !submit || !typeRoot) return;
      prompt.dataset.kanjiTypingInRail = "1";
      submit.dataset.kanjiTypingInRail = "1";
      rail.insertBefore(submit, typeRoot);
      rail.insertBefore(prompt, typeRoot);
    }
    function kanjiYomiUnmountTypingRailLayout_() {
      var qBlock = document.querySelector(".kanji-quiz-play-question-block");
      var prompt = document.getElementById("kanji-play-prompt");
      var submit = document.getElementById("kanji-play-submit-btn");
      var charEl = document.getElementById("kanji-play-char");
      if (!qBlock || !prompt || !submit) return;
      if (prompt.dataset.kanjiTypingInRail === "1") {
        delete prompt.dataset.kanjiTypingInRail;
        var promptRef = charEl && charEl.parentElement === qBlock ? charEl.nextSibling : qBlock.firstChild;
        qBlock.insertBefore(prompt, promptRef);
      }
      if (submit.dataset.kanjiTypingInRail === "1") {
        delete submit.dataset.kanjiTypingInRail;
        qBlock.insertBefore(submit, prompt.nextSibling);
      }
    }
    /** 手書き共通：出題指示を記述カード（canvas-panel）内の右端へ移す */
    function kanjiHwMountPromptInCard_() {
      var prompt = document.getElementById("kanji-play-prompt");
      var panel = document.querySelector(
        "#kanji-quiz-drill-handwriting .kanji-drill-hw-canvas-panel"
      );
      if (!prompt || !panel) return;
      if (prompt.parentElement === panel && prompt.dataset.kanjiSoInCard === "1") return;
      prompt.dataset.kanjiSoInCard = "1";
      panel.appendChild(prompt);
    }
    /**
     * カード内縦書き指示文：原則2列（改行1回）に収める。
     * 中ほど付近の句読点を優先し、どちらかの列が長すぎる場合はほぼ半分で割る。
     */
    function splitKanjiHwPromptLines_(text) {
      const s = String(text || "").replace(/\s+/g, " ").trim();
      if (!s) return [];
      const chars = Array.from(s);
      const n = chars.length;
      /* 1列で収まる短文はそのまま */
      if (n <= 18) return [s];

      const mid = Math.ceil(n / 2);
      let breakAt = mid;
      let bestDist = n + 1;
      for (let i = 0; i < n; i++) {
        if (!/[、。！？!?]/.test(chars[i])) continue;
        const after = i + 1;
        /* 先頭・末尾すぎる切れ目は避ける */
        if (after < Math.max(6, Math.floor(n * 0.28)) || after > Math.min(n - 4, Math.ceil(n * 0.78))) {
          continue;
        }
        const dist = Math.abs(after - mid);
        if (dist < bestDist) {
          bestDist = dist;
          breakAt = after;
        }
      }
      /* 句読点割れで一方が長すぎるとカードに収まらない → 半分へ */
      const MAX_COL = 20;
      if (bestDist > n || breakAt > MAX_COL || n - breakAt > MAX_COL) {
        breakAt = mid;
      }
      const line1 = chars.slice(0, breakAt).join("").trim();
      const line2 = chars.slice(breakAt).join("").trim();
      if (!line1) return line2 ? [line2] : [];
      if (!line2) return [line1];
      return [line1, line2];
    }
    function setKanjiHwCardPromptText_(text) {
      const promptEl = document.getElementById("kanji-play-prompt");
      if (!promptEl) return;
      const lines = splitKanjiHwPromptLines_(text);
      if (!lines.length) {
        promptEl.textContent = "";
        return;
      }
      promptEl.innerHTML = lines
        .map(function (line) {
          const withTcy = escapeHtml(line).replace(
            /([0-9０-９]+(?:点)?)/g,
            '<span class="kanji-hw-prompt-tcy">$1</span>'
          );
          return '<span class="kanji-hw-prompt-line">' + withTcy + "</span>";
        })
        .join("");
    }
    function kanjiHwUnmountPromptFromCard_() {
      var prompt = document.getElementById("kanji-play-prompt");
      var qBlock = document.querySelector(".kanji-quiz-play-question-block");
      if (!prompt || !qBlock) return;
      if (prompt.dataset.kanjiSoInCard !== "1") return;
      delete prompt.dataset.kanjiSoInCard;
      var charEl = document.getElementById("kanji-play-char");
      var ref =
        charEl && charEl.parentElement === qBlock ? charEl.nextSibling : qBlock.firstChild;
      qBlock.insertBefore(prompt, ref);
    }
    /* 互換エイリアス */
    function kanjiStrokeOrderMountPromptInCard_() {
      kanjiHwMountPromptInCard_();
    }
    function kanjiStrokeOrderUnmountPromptFromCard_() {
      kanjiHwUnmountPromptFromCard_();
    }
    var __kanjiYomiKbdFitRo = null;
    /** よみキーボード：正方形キーのまま、領域内に収まるよう幅を調整して拡大・縮小 */
    function fitKanjiYomiKeyboardInCol_() {
      var sec = document.getElementById("section-kanji-quiz-play");
      if (!sec || !sec.classList.contains("kanji-quiz-typing-active")) return;
      var col = sec.querySelector(".kanji-yomi-kbd-col");
      var wrap = document.querySelector(
        "#kanji-yomi-keyboard-container .keyboard-scale-wrap"
      );
      if (!col || !wrap) return;
      var availW = col.clientWidth;
      var availH = col.clientHeight;
      if (availW < 80 || availH < 80) return;
      /* 正方形キー想定の概形比（列≈10・行≈5）で高さ優先の目標幅 */
      var idealW = Math.min(availW, Math.floor(availH * 2.15));
      wrap.style.width = idealW + "px";
      wrap.style.maxWidth = "100%";
      /* はみ出したら幅を縮めて縦も比例縮小 */
      var h = wrap.scrollHeight;
      if (h > availH && h > 0) {
        var shrunk = Math.max(160, Math.floor(idealW * (availH / h) * 0.98));
        wrap.style.width = Math.min(shrunk, availW) + "px";
      }
    }
    function ensureKanjiYomiKeyboardFitObserver_() {
      fitKanjiYomiKeyboardInCol_();
      var col = document.querySelector(
        "#section-kanji-quiz-play.kanji-quiz-typing-active .kanji-yomi-kbd-col"
      );
      if (!col || typeof ResizeObserver === "undefined") return;
      if (__kanjiYomiKbdFitRo) {
        try {
          __kanjiYomiKbdFitRo.disconnect();
        } catch (_e) {}
      }
      __kanjiYomiKbdFitRo = new ResizeObserver(function () {
        fitKanjiYomiKeyboardInCol_();
      });
      __kanjiYomiKbdFitRo.observe(col);
    }
    function kanjiYomiFormatSentenceBlockHtml(q) {
      if (!q) return "";
      // 熟語読みタイプは熟語ワード全体を赤字ハイライトする
      if (q.type === "jukugo_sentence_to_ruby") {
        const word = String(q.jukugoWord || "");
        const ex = String(q.fullExample || "");
        if (!word || !ex) return ex ? '<div class="kanji-yomi-sentence-block">' + escapeHtml(ex) + "</div>" : "";
        const widx = ex.indexOf(word);
        if (widx < 0) return '<div class="kanji-yomi-sentence-block">' + escapeHtml(ex) + "</div>";
        return '<div class="kanji-yomi-sentence-block">' +
          escapeHtml(ex.slice(0, widx)) +
          '<span class="kanji-yomi-target-char">' + escapeHtml(word) + "</span>" +
          escapeHtml(ex.slice(widx + word.length)) +
          "</div>";
      }
      let s = String(q.fullExample || "");
      const k = String(q.kanji || "");
      if (!s && k) {
        const base = String(q.sentence || "");
        if (base && /[〼＿_]/.test(base)) {
          const i = base.search(/[〼＿_]/);
          if (i >= 0) {
            s = base.slice(0, i) + k + base.slice(i + 1).replace(/^[〼＿_]+/, "");
          }
        }
      }
      if (!s) s = String(q.sentence || "");
      if (!s) return "";
      const idx = k && s.indexOf(k) >= 0 ? s.indexOf(k) : -1;
      if (idx < 0) {
        return '<div class="kanji-yomi-sentence-block">' + escapeHtml(s) + "</div>";
      }
      const before = escapeHtml(s.slice(0, idx));
      const mid = '<span class="kanji-yomi-target-char">' + escapeHtml(k) + "</span>";
      const after = escapeHtml(s.slice(idx + k.length));
      return '<div class="kanji-yomi-sentence-block">' + before + mid + after + "</div>";
    }
    /**
     * おくりがな選択：例文中のターゲット語を読み（訓）に置き換えた文を縦書き表示。
     * 読み部分に下線は付けない（下線があると答えの範囲がばれるため）。
     * GAS から contextSentenceReading が来ていない（旧版互換）場合のみ exampleSentenceRaw から再構成する。
     * 再構成時は GAS 側 replaceKanjiWithReadingInExample_ と同じ規則：
     *   - surfaceForm（correctAnswer）が文中にある  → 全長を reading に置換
     *   - surfaceForm が漢字単独（送り仮名なし）    → 漢字 1 文字を reading に置換
     *   - 漢字直後が surfaceForm の送り仮名と一致   → 漢字＋送り仮名の範囲を reading に置換
     *   - いずれでもない（漢字が別用法で使われている）→ 何も生成しない（呼び出し側で空表示にフォールバック）
     */
    function kanjiOkuriganaFormatSentenceBlockHtml(q) {
      if (!q) return "";
      ensureOkuriganaExampleFields_(q);
      let s = String(q.contextSentenceReading || "").trim();
      if (!s && q.exampleSentenceRaw && q.kanji && q.readingHint) {
        const raw = String(q.exampleSentenceRaw || "");
        const k = String(q.kanji || "");
        const rd = String(q.readingHint || "").trim();
        const surf = String(q.correctAnswer || "").trim();
        if (raw && rd && k) {
          if (surf && surf.length > k.length && raw.indexOf(surf) >= 0) {
            const p = raw.indexOf(surf);
            s = raw.slice(0, p) + rd + raw.slice(p + surf.length);
          } else if (raw.indexOf(k) >= 0) {
            const idx = raw.indexOf(k);
            if (!surf || surf.length === k.length) {
              s = raw.slice(0, idx) + rd + raw.slice(idx + k.length);
            } else if (surf.indexOf(k) === 0) {
              const okuri = surf.slice(k.length);
              if (okuri && raw.slice(idx + k.length).startsWith(okuri)) {
                s = raw.slice(0, idx) + rd + raw.slice(idx + k.length + okuri.length);
              } else {
                // 送り仮名が一致しなくても例文は出す（漢字入り原文）
                s = raw;
              }
            } else {
              s = raw;
            }
          } else {
            s = raw;
          }
        }
      }
      // 読み置換が取れない場合でも、例文があれば漢字入りのまま表示する
      if (!s) {
        s = String(q.exampleSentenceRaw || q.sentence || q.exampleSentence || "").trim();
      }
      if (!s && q.choicesDisplayMap && typeof q.choicesDisplayMap === "object") {
        var ansKey = String(q.correctAnswer || "");
        if (ansKey && q.choicesDisplayMap[ansKey]) {
          s = String(q.choicesDisplayMap[ansKey] || "").trim();
        }
        if (!s) {
          var mapKeys = Object.keys(q.choicesDisplayMap);
          for (var mi = 0; mi < mapKeys.length; mi++) {
            var mv = String(q.choicesDisplayMap[mapKeys[mi]] || "").trim();
            if (mv) {
              s = mv;
              break;
            }
          }
        }
      }
      if (!s && q.questionSentence) {
        s = String(q.questionSentence || "")
          .replace(/[【】]/g, "")
          .trim();
      }
      if (!s) return "";
      // 例文全体をそのまま表示（読み部分への下線・強調はしない）
      return (
        '<div class="kanji-okurigana-example">' +
        '<span class="kanji-okurigana-example-label">例文</span>' +
        '<div class="kanji-yomi-sentence-block">' +
        escapeHtml(s) +
        "</div></div>"
      );
    }
    function kanjiYomiBindTypingInputOnce() {
      const el = document.getElementById("kanji-play-yomi-input");
      if (!el || el.dataset.kanjiYomiBound === "1") return;
      el.dataset.kanjiYomiBound = "1";
      /** 英語タイピング同様：readonly で IME・予測変換を出さず、物理キーは document 側でソフトキー相当として処理 */
      el.readOnly = true;
      el.setAttribute("readonly", "readonly");
      el.setAttribute("inputmode", "none");
      el.setAttribute("autocomplete", "off");
      el.setAttribute("autocorrect", "off");
      el.setAttribute("spellcheck", "false");
      el.setAttribute("aria-readonly", "true");
      function blockDirectEdit(ev) {
        ev.preventDefault();
      }
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Tab" || ev.key === "Escape") return;
        ev.preventDefault();
      });
      el.addEventListener("keypress", blockDirectEdit);
      el.addEventListener("paste", blockDirectEdit);
      el.addEventListener("drop", blockDirectEdit);
      el.addEventListener("cut", blockDirectEdit);
      el.addEventListener("beforeinput", function (ev) {
        if (ev.isTrusted) ev.preventDefault();
      });
      el.addEventListener("compositionstart", blockDirectEdit);
      el.addEventListener("compositionupdate", blockDirectEdit);
      el.addEventListener("compositionend", blockDirectEdit);
      el.addEventListener("input", function () {
        const v = el.value;
        try {
          if (kanjiQuizSession) kanjiQuizSession.sentenceYomiRecognized = v;
        } catch (e) {}
        const hid = document.getElementById("kanji-play-input");
        if (hid) hid.value = v;
      });
    }
    function focusKanjiYomiTypingInput_() {
      const inp = document.getElementById("kanji-play-yomi-input");
      if (!inp) return;
      try {
        inp.focus({ preventScroll: true });
      } catch (_e) {
        inp.focus();
      }
    }
    function isKanjiYomiTypingKeyboardActive_() {
      const sec = document.getElementById("section-kanji-quiz-play");
      if (!sec || !sec.classList.contains("active")) return false;
      if (!sec.classList.contains("kanji-quiz-typing-active")) return false;
      const act = window.__kanjiYomiKbdActions;
      return !!(act && typeof act.applyChar === "function");
    }
    function handleKanjiYomiPhysicalKeydown_(e) {
      if (!isKanjiYomiTypingKeyboardActive_()) return false;
      if (__kanjiQuizSubmitInFlight) return true;
      if (e.isComposing || e.key === "Process") {
        e.preventDefault();
        return true;
      }
      const act = window.__kanjiYomiKbdActions;
      const key = e.key;
      if (key === "Enter") {
        e.preventDefault();
        act.enter();
        return true;
      }
      if (key === "Backspace") {
        e.preventDefault();
        act.backspace();
        return true;
      }
      if (key === "-" || key === "Minus") {
        e.preventDefault();
        act.applyChar("-");
        return true;
      }
      if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        act.applyChar(key.toLowerCase());
        return true;
      }
      if (key === "Dead" || (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
      }
      return true;
    }
    function kanjiQuizIsAllHiraganaScript_(str) {
      const s = normalizeKanjiQuizInput(str);
      if (!s) return false;
      for (const ch of s) {
        const c = ch.codePointAt(0);
        if (c >= 0x3041 && c <= 0x3096) continue;
        if (c === 0x3099 || c === 0x309a) continue;
        if (c === 0x30fc) continue;
        return false;
      }
      return true;
    }
    function kanjiQuizIsAllKatakanaScript_(str) {
      const s = normalizeKanjiQuizInput(str);
      if (!s) return false;
      for (const ch of s) {
        const c = ch.codePointAt(0);
        if (c >= 0x30a1 && c <= 0x30f6) continue;
        if (c === 0x30fc || c === 0x30fd || c === 0x30fe) continue;
        return false;
      }
      return true;
    }
    /**
     * 訓読みは「ひらがな」、音読みは「カタカナ」で答えるのが原則。
     * スクリプトが合致していれば 1（満点）、合致していなければ 0.5（半分点）を返す。
     * 旧仕様（合致で2倍ボーナス）からの方針転換：誤スクリプトは減点扱い。
     */
    function kanjiQuizSentenceYomiScriptBonusMultiplier(userAnswerNorm, readingKind) {
      const k = String(readingKind || "");
      if (k === "kun") return kanjiQuizIsAllHiraganaScript_(userAnswerNorm) ? 1 : 0.5;
      if (k === "on") return kanjiQuizIsAllKatakanaScript_(userAnswerNorm) ? 1 : 0.5;
      return 1;
    }
    function getSentenceYomiScriptMismatchHint_(readingKind) {
      const k = String(readingKind || "");
      if (k === "on") return "おしい！音読みなのでカタカナで答えましょう。";
      if (k === "kun") return "おしい！訓読みなのでひらがなで答えましょう。";
      return "";
    }
    /**
     * れいぶん→よみ：◎＝想定どおり完全一致、△＝読みは合うがかな⇔カナのみ不一致、×＝それ以外。
     * 別読み（例：明日＝あす／あした）は exactTargets に複数ある場合のみ ◎ 対象。表記反転だけでは別読み一致にしない。
     */
    function evaluateSentenceToRubyAnswer_(q, userRaw) {
      const userNorm = normalizeKanjiQuizInput(userRaw);
      if (!userNorm) {
        return { isCorrect: false, isPartial: false, scriptBonusMult: 0 };
      }
      const exactTargets = [];
      const primary = normalizeKanjiQuizInput(q && q.correctAnswer);
      if (primary) exactTargets.push(primary);
      if (q && Array.isArray(q.correctReadings)) {
        q.correctReadings.forEach(function (r) {
          const n = normalizeKanjiQuizInput(r);
          if (n && exactTargets.indexOf(n) < 0) exactTargets.push(n);
        });
      }
      if (!exactTargets.length) {
        return { isCorrect: false, isPartial: false, scriptBonusMult: 0 };
      }
      for (let i = 0; i < exactTargets.length; i++) {
        if (userNorm === exactTargets[i]) {
          return { isCorrect: true, isPartial: false, scriptBonusMult: 1 };
        }
      }
      const userSwapped = normalizeKanjiQuizInput(kanjiYomiSwapHiraKataString_(userNorm));
      for (let j = 0; j < exactTargets.length; j++) {
        if (userSwapped === exactTargets[j]) {
          // 熟語タイプは音訓（カタカナ/ひらがな）を厳密に区別しないため◎扱いにする
          if (q && q.type === "jukugo_sentence_to_ruby") {
            return { isCorrect: true, isPartial: false, scriptBonusMult: 1 };
          }
          return { isCorrect: true, isPartial: true, scriptBonusMult: 0.5 };
        }
      }
      return { isCorrect: false, isPartial: false, scriptBonusMult: 0 };
    }
    function kanjiQuizTypeBadgeText(type) {
      if (type === "okurigana_shift") return "問題タイプ: 送り仮名選択";
      if (type === "ruby_to_kanji") return "問題タイプ: 書いて問題に回答";
      if (type === "sentence_to_ruby") return "問題タイプ: 読み仮名タイプ";
      if (type === "stroke_count") return "問題タイプ: かくすう";
      if (type === "stroke_order_trace") return "問題タイプ: 書き順チェック";
      if (type === "jukugo_yomi") return "問題タイプ: 熟語読み方選択";
      return "";
    }
    function roundKanjiPtOneDecimal_(n) {
      return Math.round(Number(n) * 10) / 10;
    }
    function getKanjiQuizSettingNumber_(key, fallback) {
      const src = appSettings && typeof appSettings === "object" ? appSettings : {};
      const v = src[key];
      if (v === undefined || v === null || String(v).trim() === "") return fallback;
      const n = Number(v);
      return isNaN(n) ? fallback : n;
    }
    function getKanjiStrokeCountClient_(kanji) {
      const ch = String(kanji || "");
      if (!ch) return 1;
      try {
        const frame = document.getElementById("kp-pro-frame");
        const win = frame && frame.contentWindow;
        const kd = win && win.KANJI_DATA;
        if (kd && kd[ch] && Array.isArray(kd[ch])) return Math.max(1, kd[ch].length);
      } catch (e) {}
      return 5;
    }
    function computeStrokeOrderEarnedOverride_(q, isRetry) {
      if (isRetry) return roundKanjiPtOneDecimal_(getKanjiQuizSettingNumber_("漢字書き順_練習点", 5));
      const mult = getKanjiQuizSettingNumber_("漢字書き順_画数倍率", 1);
      const strokes = getKanjiStrokeCountClient_(q && q.kanji);
      return roundKanjiPtOneDecimal_(strokes * mult);
    }
    function computeJukugoYomiEarnedOverride_(q) {
      const base = getKanjiQuizSettingNumber_("漢字熟語読み_基礎点", 1);
      const perChoice = getKanjiQuizSettingNumber_("漢字熟語読み_選択肢倍率", 1);
      const bonus = q && q.includeNoneOption ? getKanjiQuizSettingNumber_("漢字熟語読み_無し選択肢ボーナス", 2) : 0;
      const n = q && q.choiceCount ? Number(q.choiceCount) : 4;
      return roundKanjiPtOneDecimal_(base + n * perChoice + bonus);
    }
    /** 熟語読みタイプ：管理ブック設定「漢字熟語読みタイプ_基礎点」（デフォルト 15）を取得 */
    function computeJukugoSentenceToRubyEarnedOverride_() {
      return roundKanjiPtOneDecimal_(getKanjiQuizSettingNumber_("漢字熟語読みタイプ_基礎点", 15));
    }
    function renderJukugoExampleHtml_(example, jukugoWord) {
      const text = String(example || "");
      const word = String(jukugoWord || "");
      if (!text || !word) return escapeHtml(text);
      const idx = text.indexOf(word);
      if (idx < 0) return escapeHtml(text);
      return escapeHtml(text.slice(0, idx)) +
        '<span style="text-decoration:underline;text-decoration-color:#e53935;text-decoration-thickness:3px;text-underline-offset:4px;font-weight:bold;">' +
        escapeHtml(word) +
        "</span>" +
        escapeHtml(text.slice(idx + word.length));
    }
    function updateStrokeOrderDemoButton_() {
      /* デモ再生ボタンは廃止。誤答時のみ書いて答えると同じお手本パネルを出す */
      const btn = document.getElementById("kanji-stroke-order-demo-btn");
      if (btn) btn.style.display = "none";
    }
    /** 書き順：お手本／書き順確認カードを誤答パネル経由で表示 */
    function runStrokeOrderOtehonButtonAction_() {
      if (!kanjiQuizSession) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || q.type !== "stroke_order_trace") return;
      const ch = String(q.kanji || "");
      if (!ch) return;
      kanjiQuizSession.wrongModelKanjiChar = ch;
      kanjiQuizShowHandwritingWrongFeedback(null, { keepCanvasUnlocked: true });
    }
    /** 互換：解答欄お手本を再表示 */
    function kanjiQuizShowStrokeOrderModel() {
      runStrokeOrderOtehonButtonAction_();
    }
    /** 誤答時など内部用：書き順アニメ再生（誤答パネル経由） */
    function kanjiQuizPlayStrokeOrderDemo() {
      if (!kanjiQuizSession) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || q.type !== "stroke_order_trace") return;
      const ch = String(q.kanji || "");
      if (ch) kanjiQuizMountWrongModelFrameForChar(ch);
    }
    /**
     * 書いて答える／書き順：フッター以外のビュー（.kanji-quiz-drill-main）を
     * 初期位置＝右上（scrollTop=0 / 右端が見える横位置）へ戻す。
     */
    function kanjiQuizResetHwViewportScroll_() {
      const sec = document.getElementById("section-kanji-quiz-play");
      if (!sec) return;
      if (
        !sec.classList.contains("kanji-quiz-hw-active") &&
        !sec.classList.contains("kanji-quiz-stroke-order-active")
      ) {
        return;
      }
      const main = sec.querySelector(".kanji-quiz-drill-main");
      const wrap = sec.querySelector(".kanji-quiz-drill-wrap");
      const stack = sec.querySelector(".kanji-quiz-hw-stack");
      const readings = document.getElementById("kanji-stroke-order-readings");
      const apply = function () {
        try {
          if (wrap) {
            wrap.scrollLeft = 0;
            wrap.scrollTop = 0;
          }
          if (main) {
            main.scrollTop = 0;
            /* 横：右端を初期表示（縦書きドリルの「右上」） */
            const maxL = Math.max(0, main.scrollWidth - main.clientWidth);
            main.scrollLeft = maxL;
          }
          /* 書き順：カード帯・よみ帯は direction:rtl のため scrollLeft=0 が右端（開始側） */
          if (sec.classList.contains("kanji-quiz-stroke-order-active")) {
            if (stack) {
              stack.scrollLeft = 0;
              stack.scrollTop = 0;
            }
            if (readings) {
              readings.scrollLeft = 0;
              readings.scrollTop = 0;
            }
          }
        } catch (_e) {}
      };
      apply();
      requestAnimationFrame(function () {
        apply();
        requestAnimationFrame(apply);
      });
      setTimeout(apply, 80);
      setTimeout(apply, 220);
    }
    function setKanjiQuizPlayHwFooterActive(on) {
      const sec = document.getElementById("section-kanji-quiz-play");
      if (sec) sec.classList.toggle("kanji-quiz-hw-active", !!on);
      const refreshLayoutBtn = document.getElementById("kanji-quiz-layout-refresh-btn");
      const penCtrls = document.getElementById("kanji-drill-pen-controls");
      const typingWrap = document.getElementById("kanji-play-typing-wrap");
      if (on) {
        try {
          applyKanjiHwDominantHandToBody();
        } catch (eHand) {}
        /* 手書き時のみ CSS（.kanji-quiz-hw-active）に任せるためインライン display を外す */
        if (refreshLayoutBtn) refreshLayoutBtn.style.removeProperty("display");
        if (penCtrls) penCtrls.style.removeProperty("display");
        /* よみUI（テキストボックス含む）が横長CSSで強制表示されないよう、手書き中は必ず畳む */
        if (typingWrap) {
          typingWrap.style.display = "none";
          typingWrap.setAttribute("aria-hidden", "true");
        }
        kanjiQuizResetHwViewportScroll_();
      } else {
        /* 非手書き時は display:"" だと既定表示に戻って見えてしまうため none を明示 */
        if (refreshLayoutBtn) refreshLayoutBtn.style.display = "none";
        if (penCtrls) penCtrls.style.display = "none";
      }
    }
    function kanjiQuizPlayGoHome() {
      if (kanjiQuizSession && !confirm("クイズをやめてホームに戻りますか？")) return;
      kanjiQuizSession = null;
      lastKanjiQuizContext = null;
      clearKanjiHwFrameReadyCache();
      try {
        kanjiQuizClearWritePad(true);
      } catch (eHw) {}
      restoreKanjiPracticeFrameIfMoved();
      resetKanjiQuizDrillPlayShell();
      setKanjiQuizPlayHwFooterActive(false);
      try {
        showHome(JSON.parse(localStorage.getItem("app_kid_user")));
      } catch (eHome) {
        showHome(null);
      }
    }
    function resetKanjiQuizDrillPlayShell() {
      resetKanjiQuizHandAnswerState_();
      setKanjiQuizHandSubmitBusy(false);
      setKanjiQuizPlayHwFooterActive(false);
      try {
        clearKanjiHwPassAutoNext_();
      } catch (_ePassT) {}
      try {
        clearKanjiHwScoreStatus_();
      } catch (_eSt2) {}
      const secShell = document.getElementById("section-kanji-quiz-play");
      if (secShell) {
        secShell.classList.remove("kanji-quiz-jukugo-active");
        secShell.classList.remove("kanji-quiz-choices-active");
        secShell.classList.remove("kanji-quiz-typing-active");
        secShell.classList.remove("kanji-choice-feedback-active");
        secShell.classList.remove("kanji-quiz-stroke-order-active");
      }
      try {
        hideChoiceQuizVerdict_();
      } catch (_eVerdict) {}
      const charEl = document.getElementById("kanji-play-char");
      if (charEl) {
        charEl.classList.remove("kanji-choice-stem-host");
        charEl.style.display = "";
        charEl.style.fontSize = "";
        charEl.innerText = "";
      }
      const promptEl = document.getElementById("kanji-play-prompt");
      if (promptEl) promptEl.innerText = "";
      const detail = document.getElementById("kanji-play-detail");
      if (detail) detail.innerHTML = "";
      const choicesBox = document.getElementById("kanji-play-choices");
      if (choicesBox) {
        choicesBox.innerHTML = "";
        choicesBox.style.display = "none";
        choicesBox.classList.remove("jukugo-yomi-choices");
      }
      const typingWrap = document.getElementById("kanji-play-typing-wrap");
      if (typingWrap) {
        typingWrap.style.display = "none";
        typingWrap.setAttribute("aria-hidden", "true");
      }
      kanjiYomiUnmountTypingRailLayout_();
      try {
        kanjiHwUnmountPromptFromCard_();
      } catch (_eSoP) {}
      const inp = document.getElementById("kanji-play-input");
      if (inp) inp.value = "";
      const yomiInp = document.getElementById("kanji-play-yomi-input");
      if (yomiInp) yomiInp.value = "";
      try {
        kanjiQuizClearWritePad(true);
      } catch (eHw) {}
      try {
        if (kanjiQuizSession) kanjiQuizSession.sentenceYomiRecognized = "";
      } catch (eY2) {}
      try {
        window.__kanjiYomiRomajiTail = "";
        window.__kanjiYomiKbdActions = null;
      } catch (eRm) {}
      const subBtn = document.getElementById("kanji-play-submit-btn");
      if (subBtn) subBtn.style.display = "none";
      const summary = document.getElementById("kanji-play-summary");
      if (summary) summary.innerHTML = "";
      try {
        kanjiQuizHideWrongFeedback();
      } catch (e) {}
      try {
        const skipHw = document.getElementById("kanji-quiz-skip-hw-btn");
        stopKanjiActionBusy(skipHw);
      } catch (eSk) {}
      const drillHand = document.getElementById("kanji-quiz-drill-handwriting");
      if (drillHand) drillHand.style.display = "none";
      try {
        unmountStrokeOrderQuizPlayFrame_();
      } catch (_eSo) {}
      kanjiQuizClearTraceGuide_();
      clearStrokeOrderReadings_();
      const cvsActions = document.getElementById("kanji-hw-canvas-actions");
      if (cvsActions) cvsActions.style.display = "none";
      const markerEl = document.getElementById("kanji-drill-q-marker");
      if (markerEl) markerEl.textContent = "";
      const prefixEl = document.getElementById("kanji-drill-ctx-prefix");
      if (prefixEl) prefixEl.textContent = "";
      const suffixEl = document.getElementById("kanji-drill-ctx-suffix");
      if (suffixEl) suffixEl.textContent = "";
      const charHand = document.getElementById("kanji-play-char-handwriting");
      if (charHand) charHand.textContent = "";
      const badge = document.getElementById("kanji-play-type-badge");
      if (badge) badge.innerText = "";
      try {
        kanjiQuizSyncPenUiFromStrokeParams();
      } catch (e) {}
    }
    function renderKanjiQuizQuestion() {
      if (!kanjiQuizSession) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q) return;
      if (!q.type) {
        alert("問題形式が不明です。やり直してください。");
        return;
      }
      if (
        (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === "") &&
        q.type !== "ruby_to_kanji" &&
        q.type !== "stroke_order_trace"
      ) {
        alert("問題データの形式が古い可能性があります。セット一覧から開き直してください。");
        return;
      }
      clearKanjiJukugoAutoNext_();
      clearKanjiStrokeOrderAutoNext_();
      clearKanjiHwPassAutoNext_();
      kanjiQuizSession.selectedChoice = null;
      kanjiQuizSession.jukugoAnswerLocked = false;
      kanjiQuizSession.jukugoPendingAdvance = null;
      kanjiQuizSession.strokeOrderPendingAdvance = null;
      kanjiQuizSession.hwPassPendingAdvance = null;
      kanjiQuizSession.strokeOrderFailedOnce = false;
      kanjiQuizSession.rtOrderAutoTriggered = false;
      updateStrokeOrderDemoButton_();
      resetKanjiQuizDrillPlayShell();
      const secPlay = document.getElementById("section-kanji-quiz-play");
      if (secPlay) {
        const isChoiceQ = q.type === "jukugo_yomi" || q.type === "okurigana_shift" || q.type === "stroke_count";
        secPlay.classList.toggle("kanji-quiz-jukugo-active", q.type === "jukugo_yomi");
        secPlay.classList.toggle("kanji-quiz-choices-active", isChoiceQ);
        secPlay.classList.toggle("kanji-quiz-typing-active",
          q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby");
      }
      const subBtnReset = document.getElementById("kanji-play-submit-btn");
      if (subBtnReset) {
        subBtnReset.textContent = "こたえを決定";
        subBtnReset.onclick = function (e) {
          if (e) e.preventDefault();
          if (kanjiQuizSession && typeof kanjiQuizSession.jukugoPendingAdvance === "function") {
            kanjiQuizSession.jukugoPendingAdvance();
            return;
          }
          submitKanjiQuizScore();
        };
      }
      const drillHand = document.getElementById("kanji-quiz-drill-handwriting");
      const markerEl = document.getElementById("kanji-drill-q-marker");
      const prefixEl = document.getElementById("kanji-drill-ctx-prefix");
      const suffixEl = document.getElementById("kanji-drill-ctx-suffix");
      const charHand = document.getElementById("kanji-play-char-handwriting");
      const total = kanjiQuizSession.questions.length;
      const progress = document.getElementById('kanji-play-progress');
      if (progress) progress.innerText = `${kanjiQuizSession.index + 1} / ${total}`;
      refreshKanjiPlayPracticePtsBadge_();
      const title = document.getElementById('kanji-play-title');
      if (title) title.innerText = `【${kanjiQuizSession.modeName}】${formatUnitSheetDisplayLabel(kanjiQuizSession.unitName)} / セット ${kanjiQuizSession.setId}`;
      const badge = document.getElementById('kanji-play-type-badge');
      if (badge) {
        badge.innerText = "";
        badge.style.display = "none";
      }
      const charEl = document.getElementById('kanji-play-char');
      if (charEl) {
        charEl.style.fontSize = "";
        charEl.style.display = "";
        charEl.style.fontWeight = "";
        charEl.style.color = "";
        charEl.classList.remove("kanji-choice-stem-host");
        if (q.type === "okurigana_shift" || q.type === "stroke_count") {
          charEl.style.whiteSpace = "";
          charEl.style.lineHeight = "";
          charEl.style.maxWidth = "";
          charEl.style.marginLeft = "";
          charEl.style.marginRight = "";
          charEl.style.textAlign = "";
          if (q.type === "okurigana_shift") {
            charEl.classList.add("kanji-choice-stem-host");
            charEl.innerHTML =
              '<span class="kanji-choice-stem-head">' +
              escapeHtml(q.kanji || "？") +
              "</span>";
          } else {
            charEl.innerText = q.kanji || "？";
            charEl.style.fontSize = "clamp(72px,18vw,120px)";
          }
        } else if (q.type === "ruby_to_kanji" || q.type === "stroke_order_trace") {
          charEl.innerText = "";
          charEl.style.display = "none";
        } else if (q.type === "jukugo_yomi" || q.type === "jukugo_sentence_to_ruby") {
          charEl.innerText = "";
          charEl.style.display = "none";
        } else if (q.type === "sentence_to_ruby") {
          charEl.innerText = "";
          charEl.style.display = "none";
        } else {
          charEl.innerText = "かな";
        }
      }
      const promptEl = document.getElementById('kanji-play-prompt');
      if (promptEl) {
        if (q.type === "stroke_order_trace") {
          setKanjiHwCardPromptText_("うすい線をなぞって書いて、60点以上をめざそう。");
        } else if (q.type === "ruby_to_kanji") {
          setKanjiHwCardPromptText_(q.prompt || "読みと例文の空欄の漢字を書いて、60点以上をめざそう。");
        } else if (q.type === "okurigana_shift") promptEl.innerText = "正しい送り仮名を選びましょう。";
        else if (q.type === "jukugo_yomi") promptEl.innerText = q.prompt || "例文の下線の熟語の読み方を選びましょう。";
        else if (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby") {
          promptEl.innerText = q.prompt || "赤字のよみを 入力しましょう。";
        } else promptEl.innerText = q.prompt || "";
      }
      const detail = document.getElementById('kanji-play-detail');
      const choicesBox = document.getElementById('kanji-play-choices');
      const typingWrap = document.getElementById('kanji-play-typing-wrap');
      const subBtn = document.getElementById('kanji-play-submit-btn');
      const summary = document.getElementById('kanji-play-summary');
      if (summary) {
        if (kanjiQuizSession && kanjiQuizSession.nigateTraining) {
          const pc = q.nigatePassCount != null ? Number(q.nigatePassCount) : 0;
          const pr = q.nigatePassRequired || kanjiQuizSession.nigatePassRequired || 3;
          summary.innerHTML =
            '<span style="color:#CE93D8;font-size:14px;">ニガテ特訓: 合格 <strong>' +
            pc + "</strong> / " + pr + " 回（この漢字）</span>";
        } else {
          summary.innerHTML = "";
        }
      }
      if (q.type === "stroke_order_trace" || q.type === "ruby_to_kanji") {
        const isStrokeOrderQ = q.type === "stroke_order_trace";
        try {
          kanjiQuizHideWrongFeedback();
        } catch (e) {}
        if (!isStrokeOrderQ) {
          try {
            unmountStrokeOrderQuizPlayFrame_();
          } catch (_eSo2) {}
        }
        if (secPlay) {
          secPlay.classList.toggle("kanji-quiz-stroke-order-active", isStrokeOrderQ);
        }
        if (isStrokeOrderQ) {
          renderStrokeOrderReadings_(q);
        } else {
          clearStrokeOrderReadings_();
        }
        kanjiHwMountPromptInCard_();
        if (drillHand) drillHand.style.display = "flex";
        setKanjiQuizPlayHwFooterActive(true);
        const cvsActions = document.getElementById("kanji-hw-canvas-actions");
        if (cvsActions) cvsActions.style.display = "flex";
        const skipHwBtn = document.getElementById("kanji-quiz-skip-hw-btn");
        if (skipHwBtn) skipHwBtn.textContent = isStrokeOrderQ ? "次へ（ふせいかい）" : "次へ";
        updateStrokeOrderDemoButton_();
        resetKanjiQuizHandAnswerState_();
        setKanjiQuizHandSubmitBusy(false);
        kanjiQuizEnsureScoreListener();
        const idxAtRender = kanjiQuizSession.index;
        const targets = isStrokeOrderQ
          ? [String(q.kanji || "")].filter(Boolean)
          : kanjiQuizHanOnlyChars(q.correctAnswer || q.kanji);
        kanjiQuizSession.rubyHandTargets = targets;
        kanjiQuizSession.rubyHandSlot = 0;
        kanjiQuizSession.rubyHandComplete = false;
        kanjiQuizSession.rubyHandKanjiVgPass = false;
        kanjiQuizSession.lastHandScore = null;
        kanjiQuizSession.rubyHandMinScore = null;
        delete kanjiQuizSession.hwLastAppliedAuthScore;
        if (!targets.length) {
          alert("手書き対象の漢字が見つかりません。");
          return;
        }
        const qn = kanjiQuizCircledQuestionNum(kanjiQuizSession.index + 1);
        if (markerEl) markerEl.textContent = qn;
        if (isStrokeOrderQ) {
          if (prefixEl) prefixEl.textContent = "";
          if (suffixEl) suffixEl.textContent = "";
          if (charHand) {
            /* 書いて答えるのルビ欄と同じ位置にターゲット漢字を出す */
            charHand.textContent = targets[0] || "";
            charHand.style.opacity = "";
            charHand.style.fontSize = "";
          }
        } else {
          const ctxDrill = parseMaskedForDrill(q.maskedSentence);
          if (prefixEl) prefixEl.textContent = ctxDrill.before || "";
          if (suffixEl) suffixEl.textContent = ctxDrill.after || "";
          if (charHand) {
            charHand.textContent = q.readingDisplay || "";
            charHand.style.opacity = "";
            charHand.style.fontSize = "";
          }
        }
        const t0 = targets[0];
        if (!isStrokeOrderQ) kanjiQuizClearTraceGuide_();
        kanjiQuizSyncPenUiFromStrokeParams();
        kanjiQuizClearWritePad(false);
        kanjiQuizSetupWriteCanvas();
        kanjiQuizScheduleWriteCanvasReflow();
        kanjiQuizResetHwViewportScroll_();
        clearKanjiHwScoreStatus_();
        if (summary) summary.innerHTML = "";
        ensureKanjiHwFrameReadyOnce()
          .then(function () {
            const sec = document.getElementById("section-kanji-quiz-play");
            if (!sec || !sec.classList.contains("active")) {
              if (summary) summary.innerHTML = "";
              return;
            }
            if (!kanjiQuizSession || kanjiQuizSession.index !== idxAtRender) {
              if (summary) summary.innerHTML = "";
              return;
            }
            const qNow = kanjiQuizSession.questions[kanjiQuizSession.index];
            if (!qNow || qNow.type !== q.type) {
              if (summary) summary.innerHTML = "";
              return;
            }
            ensureKanjiFrameForQuizEval();
            const frameReady = document.getElementById("kp-pro-frame");
            if (frameReady) patchKanjiFrameForQuizPostMessage(frameReady);
            if (isStrokeOrderQ) {
              /* 唯一の差分：記述欄になぞり軌道を載せる */
              if (!kanjiQuizLoadTraceGuideFromFrame_(t0)) {
                /* なぞり線がなくても記述欄で採点可能 */
              }
              [200, 520].forEach(function (delayMs) {
                setTimeout(function () {
                  if (!kanjiQuizSession || kanjiQuizSession.index !== idxAtRender) return;
                  const qLate = kanjiQuizSession.questions[kanjiQuizSession.index];
                  if (!qLate || qLate.type !== "stroke_order_trace") return;
                  const secLate = document.getElementById("section-kanji-quiz-play");
                  if (secLate && secLate.classList.contains("kanji-quiz-wrong-visible")) return;
                  const frLate = document.getElementById("kp-pro-frame");
                  if (frLate) patchKanjiFrameForQuizPostMessage(frLate);
                  kanjiQuizLoadTraceGuideFromFrame_(t0);
                  kanjiQuizRedrawParentCanvas();
                }, delayMs);
              });
            } else {
              if (!preloadKanjiQuizTargetsInFrame(targets, t0)) {
                if (summary) summary.innerHTML = "";
                return;
              }
              const reassertCh =
                (kanjiQuizSession.rubyHandTargets || [])[kanjiQuizSession.rubyHandSlot || 0] || t0;
              [200, 520].forEach(function (delayMs) {
                setTimeout(function () {
                  if (!kanjiQuizSession || kanjiQuizSession.index !== idxAtRender) return;
                  const qLate = kanjiQuizSession.questions[kanjiQuizSession.index];
                  if (!qLate || qLate.type !== "ruby_to_kanji") return;
                  const secLate = document.getElementById("section-kanji-quiz-play");
                  if (secLate && secLate.classList.contains("kanji-quiz-wrong-visible")) return;
                  const frLate = document.getElementById("kp-pro-frame");
                  if (frLate) patchKanjiFrameForQuizPostMessage(frLate);
                  selectKanjiCharInQuizFrame(reassertCh);
                }, delayMs);
              });
              if (charHand) {
                charHand.textContent = qNow.readingDisplay || "";
                charHand.style.opacity = "";
              }
            }
            kanjiQuizSyncPenUiFromStrokeParams();
            kanjiQuizClearWritePad(true);
            kanjiQuizSetupWriteCanvas();
            /* setup で canvas バッファが消えるため、なぞり軌道を含む再描画 */
            kanjiQuizRedrawParentCanvas();
            kanjiQuizScheduleWriteCanvasReflow();
            if (isStrokeOrderQ) renderStrokeOrderReadings_(qNow);
            if (summary) {
              if (isStrokeOrderQ && !kanjiQuizTraceGuideStrokes.length && summary.innerHTML.indexOf("なぞり線") >= 0) {
                /* 失敗メッセージを残す */
              } else {
                summary.innerHTML = "";
              }
            }
          })
          .catch(function () {
            if (summary) {
              summary.innerHTML =
                '<span style="color:#FF8A80;font-size:clamp(12px,3vw,14px);">さいてんデータのじゅんびに失敗しました。</span>';
            }
          });
      } else {
        clearStrokeOrderReadings_();
        try {
          unmountStrokeOrderQuizPlayFrame_();
        } catch (_eSo3) {}
        restoreKanjiPracticeFrameIfMoved();
        setKanjiQuizPlayHwFooterActive(false);
        if (drillHand) drillHand.style.display = "none";
        if (markerEl) markerEl.textContent = "";
        if (prefixEl) prefixEl.textContent = "";
        if (suffixEl) suffixEl.textContent = "";
        if (charHand) charHand.textContent = "";
      }
      if (detail) {
        if (q.type === "okurigana_shift") {
          var okuriBoxHtml = kanjiOkuriganaFormatSentenceBlockHtml(q);
          // width:100% は横フレックス内で画面幅まで膨らみ例文が視界外へ飛ぶため付けない
          detail.innerHTML = okuriBoxHtml
            ? '<div class="kanji-okurigana-vertical-wrap">' + okuriBoxHtml + "</div>"
            : "";
        } else if (q.type === "ruby_to_kanji" || q.type === "stroke_order_trace") {
          detail.innerHTML = "";
        } else if (q.type === "jukugo_yomi") {
          // 出題行はDBのターゲット漢字（単漢字）。例文側の下線は熟語に付ける
          const targetKanji = String(q.kanji || "");
          detail.innerHTML =
            '<div class="jukugo-yomi-qpair">' +
            '<div class="jukugo-yomi-stem"><span class="jukugo-yomi-stem-head"><span class="jukugo-yomi-label">出題</span>' +
            escapeHtml(targetKanji) +
            "</span></div>" +
            '<div class="jukugo-yomi-example"><span class="jukugo-yomi-label">例文</span>' +
            renderJukugoExampleHtml_(q.exampleSentence, q.jukugoWord) +
            "</div></div>";
        } else if (q.type === "stroke_count") {
          detail.innerHTML =
            '<div style="color:#333;font-size:clamp(15px,3.2vw,20px);line-height:1.5;">教材の字体に基づく<strong>画数</strong>です。教育字体とちがう場合があります。</div>';
        } else if (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby") {
          detail.innerHTML = "";
        } else {
          detail.innerHTML = q.sentence
            ? `<div style="color:#222;font-size:clamp(20px,4.5vw,28px);line-height:1.5;">${escapeHtml(q.sentence || "")}</div>`
            : "";
        }
      }
      if (choicesBox) {
        choicesBox.innerHTML = "";
        choicesBox.classList.toggle("jukugo-yomi-choices", q.type === "jukugo_yomi");
        if (q.type === "okurigana_shift" || q.type === "stroke_count" || q.type === "jukugo_yomi") {
          choicesBox.style.display = "flex";
          choicesBox.style.visibility = "visible";
          choicesBox.style.opacity = "1";
          /* HTML の inline flex 指定を外し、CSS（縦書き・右→左）に任せる */
          choicesBox.style.removeProperty("flex-direction");
          choicesBox.style.removeProperty("flex-wrap");
          choicesBox.style.removeProperty("align-items");
          choicesBox.style.removeProperty("justify-content");
          choicesBox.style.removeProperty("width");
          choicesBox.style.removeProperty("height");
          choicesBox.style.removeProperty("max-width");
          choicesBox.style.removeProperty("min-width");
          choicesBox.style.removeProperty("max-height");
          choicesBox.style.removeProperty("min-height");
          const arr =
            q.type === "jukugo_yomi"
              ? shuffleKanjiQuizChoicesKeepingNoneLast_(q.choices)
              : shuffleKanjiQuizChoicesArray(q.choices);
          let dispMap =
            q.type === "okurigana_shift" && q.choicesDisplayMap && typeof q.choicesDisplayMap === "object"
              ? q.choicesDisplayMap
              : null;
          const jukugoDisplayByChoice = {};
          if (q.type === "jukugo_yomi" && Array.isArray(q.choices) && Array.isArray(q.choicesDisplay)) {
            q.choices.forEach(function (cv, ii) {
              jukugoDisplayByChoice[cv] = q.choicesDisplay[ii];
            });
          }
          if (
            !dispMap &&
            q.type === "okurigana_shift" &&
            q.exampleSentenceRaw &&
            q.kanji &&
            q.correctAnswer &&
            Array.isArray(q.choices)
          ) {
            const exRaw = String(q.exampleSentenceRaw || "");
            const kk = String(q.kanji || "");
            const surf = String(q.correctAnswer || "");
            const fallback = {};
            const surfPos = surf && exRaw.indexOf(surf) >= 0 ? exRaw.indexOf(surf) : -1;
            /**
             * 漢字単独でのフォールバック挿入は、surfaceForm（correctAnswer）と漢字の長さが等しい
             * （= 送り仮名なしの読み）か、surfaceForm が全く未指定の場合だけ許可する。
             * surfaceForm が漢字＋送り仮名で、しかも例文中に surfaceForm が含まれない場合に
             * 漢字位置へ候補を挿入すると、例: 例文 "上を見る" / 候補 "上と" → "上とを見る"
             * のような不自然な選択肢が生成されてしまうため、そのケースは候補そのままを返す。
             */
            const kAllowAsSingleChar = !surf || surf.length === kk.length;
            const kPos =
              surfPos < 0 && kAllowAsSingleChar && kk && exRaw.indexOf(kk) >= 0
                ? exRaw.indexOf(kk)
                : -1;
            q.choices.forEach(function (c) {
              if (surfPos >= 0) {
                fallback[c] = exRaw.slice(0, surfPos) + c + exRaw.slice(surfPos + surf.length);
              } else if (kPos >= 0) {
                fallback[c] = exRaw.slice(0, kPos) + c + exRaw.slice(kPos + kk.length);
              } else {
                fallback[c] = c;
              }
            });
            dispMap = fallback;
          }
          arr.forEach(function (c) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "kanji-drill-choice-btn";
            let labelText = dispMap && dispMap[c] ? String(dispMap[c]) : c;
            if (q.type === "jukugo_yomi") {
              if (c === JUKUGO_NONE_ANSWER_) labelText = "この中に回答はない";
              else if (jukugoDisplayByChoice[c]) labelText = String(jukugoDisplayByChoice[c]);
            }
            b.innerText = labelText;
            b.dataset.choiceValue = String(c);
            b.setAttribute("aria-label", "選択肢 " + labelText);
            b.onclick = function (e) {
              e.preventDefault();
              if (!kanjiQuizSession) return;
              if (q.type === "jukugo_yomi" || q.type === "okurigana_shift") {
                if (kanjiQuizSession.jukugoAnswerLocked) return;
                kanjiQuizSession.jukugoAnswerLocked = true;
                kanjiQuizSession.selectedChoice = c;
                submitKanjiQuizScore();
                return;
              }
              kanjiQuizSession.selectedChoice = c;
              submitKanjiQuizScore();
            };
            choicesBox.appendChild(b);
          });
          // 問題文＋選択肢を右端基準で見せる（左に飛ばすスクロールはしない）
          try {
            const wrapEl = secPlay && secPlay.querySelector(".kanji-quiz-drill-wrap");
            if (wrapEl) {
              requestAnimationFrame(function () {
                try {
                  wrapEl.scrollLeft = 0;
                  wrapEl.scrollTop = 0;
                } catch (eScr2) {}
              });
            }
          } catch (eScr) {}
        } else {
          choicesBox.style.display = "none";
        }
      }
      if (typingWrap) {
        if (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby") {
          typingWrap.style.display = "flex";
          typingWrap.removeAttribute("aria-hidden");
          kanjiYomiMountTypingRailLayout_();
          kanjiYomiBindTypingInputOnce();
          kanjiQuizSession.sentenceYomiRecognized = "";
          const hidInp = document.getElementById("kanji-play-input");
          if (hidInp) hidInp.value = "";
          const yomiInp = document.getElementById("kanji-play-yomi-input");
          if (yomiInp) yomiInp.value = "";
          const sentenceBox = document.getElementById("kanji-yomi-sentence-box");
          if (sentenceBox) sentenceBox.innerHTML = kanjiYomiFormatSentenceBlockHtml(q);
          renderKanjiYomiRomajiKeyboard("kanji-yomi-keyboard-container", "kanji-play-yomi-input", function () {
            if (!kanjiQuizSession) return;
            const yomiInputNow = document.getElementById("kanji-play-yomi-input");
            const val = yomiInputNow ? String(yomiInputNow.value || "") : "";
            kanjiQuizSession.sentenceYomiRecognized = val;
            const hidNow = document.getElementById("kanji-play-input");
            if (hidNow) hidNow.value = val;
            submitKanjiQuizScore();
          });
          requestAnimationFrame(function () {
            ensureKanjiYomiKeyboardFitObserver_();
          });
          focusKanjiYomiTypingInput_();
          /* vertical-rl 時代の横スクロール残があると例文が視界外に残る */
          try {
            const wrapEl = secPlay && secPlay.querySelector(".kanji-quiz-drill-wrap");
            if (wrapEl) {
              requestAnimationFrame(function () {
                try {
                  wrapEl.scrollLeft = 0;
                  wrapEl.scrollTop = 0;
                } catch (eScrY) {}
              });
            }
          } catch (eScrY2) {}
        } else {
          typingWrap.style.display = "none";
          typingWrap.setAttribute("aria-hidden", "true");
          kanjiYomiUnmountTypingRailLayout_();
        }
      }
      if (subBtn) {
        // よみタイピングは出題列内の「こたえを決定」を CSS で表示
        if (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby") {
          subBtn.style.display = "";
        } else {
          subBtn.style.display = "none";
        }
      }
      updateStrokeOrderDemoButton_();
    }
    function startKanjiQuizPlay(ctx) {
      const mode = ctx.formatMode != null ? ctx.formatMode : getKanjiQuizFormatMode();
      let questions;
      let allQuestionsStored;
      if (ctx.nigateBypassFilter && Array.isArray(ctx.questions) && ctx.questions.length) {
        questions = shuffleKanjiQuizQuestionsArray(ctx.questions.slice());
        allQuestionsStored = questions.slice();
      } else if (Array.isArray(ctx.allQuestions) && ctx.allQuestions.length) {
        const filtered = filterKanjiQuizQuestionsByFormat(ctx.allQuestions, mode);
        if (!filtered.length) {
          hideKanjiQuizSetLoadingOverlay_();
          alert("この しかた では もんだいがありません。\nほかの しかたを えらんでください。");
          return;
        }
        allQuestionsStored = filtered.slice();
        questions = shuffleKanjiQuizQuestionsArray(filtered.slice());
      } else {
        const base = Array.isArray(ctx.questions) ? ctx.questions.slice() : [];
        if (!base.length) {
          hideKanjiQuizSetLoadingOverlay_();
          alert("このセットには問題がありません。");
          return;
        }
        questions = shuffleKanjiQuizQuestionsArray(base);
        allQuestionsStored = questions.slice();
      }
      if (!questions.length) {
        hideKanjiQuizSetLoadingOverlay_();
        alert("このセットには問題がありません。");
        return;
      }
      ensureKanjiChallengeCacheLoaded().then(function () {
        // 読み込み自体は完了。確認ダイアログの裏にオーバーレイを残さない
        hideKanjiQuizSetLoadingOverlay_();
        if (
          !confirmKanjiQuizIfReducedSheetPoints(
            ctx.unitName,
            ctx.modeName,
            ctx.setId,
            questions,
            mode
          )
        ) {
          return;
        }
        startKanjiQuizPlayAfterConfirm(ctx, questions, allQuestionsStored, mode);
      }).catch(function () {
        hideKanjiQuizSetLoadingOverlay_();
        alert("学習データの読み込みに失敗しました。もういちど「セット」を押してください。");
      });
    }
    function startKanjiQuizPlayAfterConfirm(ctx, questions, allQuestionsStored, mode) {
      kanjiQuizSession = {
          modeId: ctx.modeId,
          modeName: ctx.modeName,
          unitName: ctx.unitName,
          setId: ctx.setId,
          isTrainingMode: !!ctx.isTrainingMode,
          trainingStepIndex: ctx.trainingStepIndex,
          trainingMenuId: ctx.trainingMenuId,
          questions,
          index: 0,
          totalEarned: 0,
          newTotalPoints: null,
          logs: [],
          pendingScoreItems: [],
          selectedChoice: null,
          wrongPracticePtsEarned: 0,
          nigateTraining: !!ctx.nigateTraining,
          nigateAxis: ctx.nigateAxis || null,
          nigatePassRequired: ctx.nigatePassRequired || KANJI_NIGATE_PASS_REQUIRED,
          formatMode: mode,
          nigateFeedback: ctx.nigateTraining ? { strokeOrderClean: true, brushAllClear: true } : null
        };
        lastKanjiQuizContext = {
          modeId: ctx.modeId,
          modeName: ctx.modeName,
          unitName: ctx.unitName,
          setId: ctx.setId,
          allQuestions: allQuestionsStored,
          questions: questions,
          isTrainingMode: !!ctx.isTrainingMode,
          trainingStepIndex: ctx.trainingStepIndex,
          trainingMenuId: ctx.trainingMenuId,
          formatMode: mode,
          nigateBypassFilter: !!ctx.nigateBypassFilter,
          nigateTraining: !!ctx.nigateTraining,
          nigateAxis: ctx.nigateAxis || null
        };
        hideKanjiQuizSetLoadingOverlay_();
        switchSection("section-kanji-quiz-play");
        try {
          bindKanjiQuizCancelBtnOnce_();
        } catch (_eBind2) {}
        saveKanjiQuizRecoveryDraft();
        renderKanjiQuizQuestion();
    }
    function restartLastKanjiQuizSet() {
      const ctx = lastKanjiQuizContext;
      if (!ctx) {
        openKanjiLearningMenu();
        return;
      }
      if (ctx.nigateBypassFilter && Array.isArray(ctx.questions) && ctx.questions.length) {
        startKanjiQuizPlay({
          modeId: ctx.modeId,
          modeName: ctx.modeName,
          unitName: ctx.unitName,
          setId: ctx.setId,
          questions: ctx.questions,
          nigateBypassFilter: true,
          nigateTraining: !!ctx.nigateTraining,
          nigateAxis: ctx.nigateAxis,
          formatMode: ctx.formatMode || "write_kanji"
        });
        return;
      }
      const mode = ctx.formatMode != null ? ctx.formatMode : getKanjiQuizFormatMode();
      if (Array.isArray(ctx.questions) && ctx.questions.length) {
        startKanjiQuizPlay({
          modeId: ctx.modeId,
          modeName: ctx.modeName,
          unitName: ctx.unitName,
          setId: ctx.setId,
          questions: ctx.questions.slice(),
          formatMode: mode,
          isTrainingMode: !!ctx.isTrainingMode,
          trainingStepIndex: ctx.trainingStepIndex,
          trainingMenuId: ctx.trainingMenuId
        });
        return;
      }
      if (Array.isArray(ctx.allQuestions) && ctx.allQuestions.length) {
        const filtered = filterKanjiQuizQuestionsByFormat(ctx.allQuestions, mode);
        if (!filtered.length) {
          alert(
            "この しかた では もんだいがありません。\nほかの しかたを えらんでください。"
          );
          return;
        }
        startKanjiQuizPlay({
          modeId: ctx.modeId,
          modeName: ctx.modeName,
          unitName: ctx.unitName,
          setId: ctx.setId,
          allQuestions: ctx.allQuestions,
          formatMode: mode,
          isTrainingMode: !!ctx.isTrainingMode,
          trainingStepIndex: ctx.trainingStepIndex,
          trainingMenuId: ctx.trainingMenuId
        });
        return;
      }
      openKanjiLearningMenu();
    }
    function showKanjiQuizResult(totalEarned, logs, isTrainingMode, newTotalPoints, batchMeta) {
      restoreKanjiPracticeFrameIfMoved();
      document.body.classList.add('kanji-study-mode');
      try {
        resetResultScreenActionButtons();
      } catch (_eResetRes) {}
      switchSection('section-result');
      const rc = document.getElementById('result-content');
      const retryBtn = document.getElementById('result-retry-btn');
      const settingsBtn = document.getElementById('result-settings-btn');
      const homeBtn = document.getElementById('result-home-btn');
      const sameBookBtn = document.getElementById('result-kanji-same-book-btn');
      const otherBookBtn = document.getElementById('result-kanji-other-book-btn');
      if (!rc || !retryBtn || !settingsBtn || !homeBtn) return;
      function buildKanjiResultRowsHtml_(logRows) {
        return (Array.isArray(logRows) ? logRows : []).map(function (v, idx) {
          const mark = v.isCorrect ? "◎" : "×";
          const rowClass = v.isCorrect ? "is-ok" : "is-ng";
          const label = v.jukugoWord
            ? (escapeHtml(v.kanji || "") + "／" + escapeHtml(v.jukugoWord))
            : escapeHtml(v.kanji || "");
          const qNo = idx + 1;
          return (
            '<div class="kanji-result-log-row ' + rowClass + '">' +
            '<span class="kanji-result-log-mark">' + mark + "</span>" +
            '<span class="kanji-result-log-label">' + qNo + ". 「" + label + "」</span>" +
            '<span class="kanji-result-log-meta">' +
            Number(v.score || 0) +
            "点 → +" +
            Number(v.earned || 0).toFixed(2) +
            "Pt</span></div>"
          );
        }).join("");
      }
      function renderKanjiResultBody_(earned, logRows, totalPts, saveNoteHtml) {
        const rows = buildKanjiResultRowsHtml_(logRows);
        const logArr = Array.isArray(logRows) ? logRows : [];
        const okCount = logArr.filter(function (r) {
          return r && r.isCorrect;
        }).length;
        const totalCount = logArr.length;
        const totalLine =
          typeof totalPts === "number" && !isNaN(totalPts)
            ? '<p style="margin-top:12px;text-align:center;font-weight:700;">合計ポイント: ' +
              Number(totalPts).toFixed(2) +
              "</p>"
            : "";
        var nigateBlock = "";
        var ctxR = lastKanjiQuizContext;
        if (ctxR && ctxR.nigateFeedbackSnapshot && ctxR.nigateTraining) {
          var f = ctxR.nigateFeedbackSnapshot;
          var p1 = f.strokeOrderClean
            ? "手書きでは、かきじゅんの指摘はありませんでした。"
            : "手書きで、かきじゅんに注意が出た回があります。";
          var p2 = f.brushAllClear
            ? "とめ・はね・はらいは、すべて問題なしと判定された手書きがありました（厳密モード時のみ有効です）。"
            : "とめ・はね・はらいに注意が出た手書きがあります（厳密モード時）。";
          nigateBlock =
            '<div style="margin-top:14px;padding:12px;background:#f3e5f5;border-radius:8px;text-align:left;font-size:14px;line-height:1.5;color:#4a148c;"><strong>ニガテ特訓のまとめ</strong><br>' +
            escapeHtml(p1) +
            "<br>" +
            escapeHtml(p2) +
            "</div>";
        }
        rc.innerHTML =
          '<h2 class="kanji-result-title">✨ 漢字セット完了！ ✨</h2>' +
          '<div class="kanji-result-scorebox">' +
          '<p class="kanji-result-summary-line">正解 ' +
          okCount +
          " / " +
          totalCount +
          " もん</p>" +
          '<p class="kanji-result-pts">かくとくポイント: <span class="kanji-result-pts-val">+' +
          Number(earned || 0).toFixed(2) +
          "</span></p>" +
          '<hr class="kanji-result-hr">' +
          '<div class="kanji-result-logs">' +
          (rows || '<p style="margin:0;color:#666;">結果なし</p>') +
          "</div>" +
          totalLine +
          (saveNoteHtml || "") +
          "</div>" +
          nigateBlock;
      }
      renderKanjiResultBody_(
        totalEarned,
        logs,
        newTotalPoints,
        '<p id="kanji-result-save-note" class="kanji-result-save-note">結果を保存しています…</p>'
      );
      const pendingMeta = batchMeta && typeof batchMeta === "object" ? batchMeta : null;
      if (pendingMeta && Array.isArray(pendingMeta.pendingScoreItems) && pendingMeta.pendingScoreItems.length) {
        flushKanjiQuizBatchScores_(pendingMeta)
          .then(function (d) {
            const itemEarned = Array.isArray(d.itemEarned) ? d.itemEarned : [];
            const nextLogs = (Array.isArray(logs) ? logs : []).map(function (row, i) {
              const copy = Object.assign({}, row);
              if (itemEarned[i] != null && !isNaN(Number(itemEarned[i]))) {
                copy.earned = Number(itemEarned[i]);
              }
              return copy;
            });
            var batchSaveNote = '<p class="kanji-result-save-note" style="color:#2e7d32;">結果を保存しました。</p>';
            if (d.dailyLimitChars && d.dailyLimitChars.length > 0) {
              var dlChars = d.dailyLimitChars.map(function (c) { return "「" + escapeHtml(c) + "」"; }).join(" ");
              batchSaveNote += '<p style="color:#FFD54F;font-size:13px;margin:6px 0;">📋 ' + dlChars + ' は今日のポイント上限（2 回/日）に達しました。あす 0 時にリセットされます。</p>';
            }
            renderKanjiResultBody_(
              Number(d.earnedPoints || 0),
              nextLogs,
              Number(d.newTotal),
              batchSaveNote
            );
            if (isTrainingMode) {
              const trainMenuId =
                (pendingMeta && pendingMeta.trainingMenuId) ||
                (lastKanjiQuizContext && lastKanjiQuizContext.trainingMenuId) ||
                currentTrainingMenuId;
              if (trainMenuId) currentTrainingMenuId = trainMenuId;
              const userNow = JSON.parse(localStorage.getItem("app_kid_user") || "null");
              if (userNow && userNow.id) fetchTrainingRoute(userNow.id);
              scheduleTrainingRouteAutoReturn(1200, trainMenuId);
            }
          })
          .catch(function (e) {
            console.warn("kanji batch save failed:", e);
            const note = document.getElementById("kanji-result-save-note");
            if (note) {
              note.style.color = "#c62828";
              note.textContent = "結果の保存に失敗しました。通信を確認して、同じセットをもう一度試してください。";
            }
          });
      } else {
        const note = document.getElementById("kanji-result-save-note");
        if (note) note.remove();
        if (isTrainingMode) {
          scheduleTrainingRouteAutoReturn(
            2200,
            (lastKanjiQuizContext && lastKanjiQuizContext.trainingMenuId) || currentTrainingMenuId
          );
        }
      }
      // 結果ページのボタンは、後続処理（再フェッチ・セクション切替・ホーム描画）が走るので
      // 多重タップで二重起動しないよう、押した瞬間にビジー化する。元画面に戻る場合は
      // それぞれの handler が switchSection を呼ぶため、ボタン要素は一旦非表示になる。
      var __resultBtnGroup = [retryBtn, settingsBtn, homeBtn];
      if (sameBookBtn) __resultBtnGroup.push(sameBookBtn);
      if (otherBookBtn) __resultBtnGroup.push(otherBookBtn);
      function wrapResultBtnAction(busyLabel, fn) {
        return function () {
          if (__resultBtnGroup.some(function (b) {
            return b && b.dataset.kjBusyOriginalLabel != null;
          })) {
            return; // どれか1つでも押下中なら無視
          }
          var self = this;
          startKanjiActionBusy(self, busyLabel);
          disableKanjiButtonGroupExcept(__resultBtnGroup, self);
          // 同期処理でも UI 反映のため次フレームで実行（押下フィードバックを見せる）
          setTimeout(function () {
            try {
              fn.call(self);
            } catch (e) {
              console.error("結果ページ操作で例外:", e);
            } finally {
              try { stopKanjiActionBusy(self); } catch (_) {}
              try { restoreKanjiButtonGroup(__resultBtnGroup); } catch (_) {}
            }
          }, 0);
        };
      }
      retryBtn.style.display = "block";
      retryBtn.innerText = "🔄 同じセットでもう一度";
      retryBtn.onclick = wrapResultBtnAction("じゅんびちゅう", function () {
        restartLastKanjiQuizSet();
      });
      if (isTrainingMode) {
        if (lastKanjiQuizContext && lastKanjiQuizContext.trainingMenuId) {
          currentTrainingMenuId = lastKanjiQuizContext.trainingMenuId;
        }
        settingsBtn.style.display = "block";
        settingsBtn.innerText = "🎯 特訓ルートにもどる";
        settingsBtn.onclick = wrapResultBtnAction("ひらいています", function () {
          returnToCurrentTrainingMenuRoute({
            menuId: (lastKanjiQuizContext && lastKanjiQuizContext.trainingMenuId) || currentTrainingMenuId,
            invalidateCache: false
          });
        });
        // 自動復帰は一括保存完了後（flushKanjiQuizBatchScores_ 成功時）に行う
      } else if (lastKanjiQuizContext && lastKanjiQuizContext.nigateTraining) {
        settingsBtn.style.display = "block";
        settingsBtn.innerText = "🎯 ニガテ特訓にもどる";
        settingsBtn.onclick = wrapResultBtnAction("ひらいています", function () { switchSection("section-kanji-nigate"); });
      } else {
        settingsBtn.style.display = "block";
        settingsBtn.innerText = "📚 セット一覧にもどる";
        settingsBtn.onclick = wrapResultBtnAction("ひらいています", function () { switchSection('section-kanji-quiz-sets'); });
      }
      homeBtn.style.display = "block";
      homeBtn.innerText = "🏠 ホームにもどる";
      homeBtn.onclick = wrapResultBtnAction("もどっています", function () {
        cancelTrainingRouteAutoReturn();
        showHome(JSON.parse(localStorage.getItem('app_kid_user')));
      });
      var ctxNav = lastKanjiQuizContext;
      var canSameBookNav =
        ctxNav &&
        ctxNav.modeId != null &&
        ctxNav.modeId !== "" &&
        String(ctxNav.unitName || "").trim() !== "";
      if (sameBookBtn) {
        if (canSameBookNav) {
          sameBookBtn.style.display = "block";
          sameBookBtn.onclick = wrapResultBtnAction("ひらいています", function () {
            openKanjiQuizSets(ctxNav.modeId, ctxNav.modeName || "", ctxNav.unitName, null, null);
          });
        } else {
          sameBookBtn.style.display = "none";
          sameBookBtn.onclick = null;
        }
      }
      if (otherBookBtn) {
        otherBookBtn.style.display = "block";
        otherBookBtn.onclick = wrapResultBtnAction("ひらいています", function () {
          loadKanjiMaterials(null);
        });
      }
    }
    function cancelKanjiQuizPlay() {
      try {
        hideKanjiQuizSetLoadingOverlay_();
      } catch (_eHide) {}
      // 確認ダイアログ中に自動「次へ」が進まないよう先に止める
      try {
        clearKanjiJukugoAutoNext_();
        clearKanjiStrokeOrderAutoNext_();
        clearKanjiHwPassAutoNext_();
      } catch (_eT) {}
      if (kanjiQuizSession) {
        kanjiQuizSession.jukugoPendingAdvance = null;
        kanjiQuizSession.strokeOrderPendingAdvance = null;
        kanjiQuizSession.hwPassPendingAdvance = null;
      }
      var goNigate = !!(lastKanjiQuizContext && lastKanjiQuizContext.nigateTraining);
      if (!kanjiQuizSession) {
        restoreKanjiPracticeFrameIfMoved();
        resetKanjiQuizDrillPlayShell();
        setKanjiQuizPlayHwFooterActive(false);
        switchSection(goNigate ? "section-kanji-nigate" : "section-kanji-quiz-sets");
        return;
      }
      if (!confirm("このセットを中断しますか？")) return;
      kanjiQuizSession = null;
      lastKanjiQuizContext = null;
      clearKanjiHwFrameReadyCache();
      try {
        kanjiQuizClearWritePad(true);
      } catch (e) {}
      restoreKanjiPracticeFrameIfMoved();
      resetKanjiQuizDrillPlayShell();
      setKanjiQuizPlayHwFooterActive(false);
      switchSection(goNigate ? "section-kanji-nigate" : "section-kanji-quiz-sets");
    }
    window.cancelKanjiQuizPlay = cancelKanjiQuizPlay;
    function bindKanjiQuizCancelBtnOnce_() {
      var btn = document.getElementById("kanji-quiz-cancel-btn");
      if (!btn || btn.dataset.boundCancel === "1") return;
      btn.dataset.boundCancel = "1";
      btn.addEventListener(
        "click",
        function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          cancelKanjiQuizPlay();
        },
        true
      );
    }
    try {
      bindKanjiQuizCancelBtnOnce_();
    } catch (_eBindCancel) {}
    let kanjiJukugoAutoNextTimer_ = null;
    function clearKanjiJukugoAutoNext_() {
      if (kanjiJukugoAutoNextTimer_ != null) {
        clearTimeout(kanjiJukugoAutoNextTimer_);
        kanjiJukugoAutoNextTimer_ = null;
      }
    }
    let kanjiStrokeOrderAutoNextTimer_ = null;
    function clearKanjiStrokeOrderAutoNext_() {
      if (kanjiStrokeOrderAutoNextTimer_ != null) {
        clearTimeout(kanjiStrokeOrderAutoNextTimer_);
        kanjiStrokeOrderAutoNextTimer_ = null;
      }
    }
    function showStrokeOrderManualNext_(advanceFn) {
      if (!kanjiQuizSession) return;
      clearKanjiStrokeOrderAutoNext_();
      var advanced = false;
      function goNext() {
        if (advanced) return;
        advanced = true;
        clearKanjiStrokeOrderAutoNext_();
        if (kanjiQuizSession) kanjiQuizSession.strokeOrderPendingAdvance = null;
        advanceFn();
      }
      kanjiQuizSession.strokeOrderPendingAdvance = goNext;
      const skipBtn = document.getElementById("kanji-quiz-skip-hw-btn");
      if (skipBtn) {
        skipBtn.textContent = "次へ（ふせいかい）";
        skipBtn.disabled = false;
        stopKanjiActionBusy(skipBtn);
      }
    }
    function applyJukugoYomiChoiceFeedback_(q, selected, isCorrect) {
      const box = document.getElementById("kanji-play-choices");
      if (!box) return;
      const selectedVal = String(selected || "");
      const correctVal = String((q && q.correctAnswer) || "");
      const correctSet = {};
      const noneIsAns =
        q &&
        q.type === "jukugo_yomi" &&
        (q.noneIsCorrect || correctVal === JUKUGO_NONE_ANSWER_);
      if (noneIsAns) {
        // 「この中に回答はない」が正答のときは、その選択肢だけを緑にする
        correctSet[JUKUGO_NONE_ANSWER_] = true;
      } else {
        if (correctVal) correctSet[correctVal] = true;
        if (q && q.type === "jukugo_yomi" && Array.isArray(q.correctReadings)) {
          q.correctReadings.forEach(function (r) {
            const s = String(r || "");
            if (s) correctSet[s] = true;
          });
        }
      }
      Array.from(box.querySelectorAll(".kanji-drill-choice-btn")).forEach(function (btn) {
        const val = String(btn.dataset.choiceValue || "");
        btn.classList.add("is-choice-disabled");
        btn.classList.remove("is-selected-choice", "is-correct-choice", "is-wrong-choice");
        if (correctSet[val]) {
          btn.classList.add("is-correct-choice");
        } else if (val === selectedVal && !isCorrect) {
          btn.classList.add("is-wrong-choice");
        }
        btn.disabled = true;
      });
    }
    function formatChoiceQuizCorrectReadingLabel_(q) {
      if (!q) return "";
      if (q.type === "jukugo_yomi") {
        if (Array.isArray(q.correctReadings) && q.correctReadings.length) {
          return q.correctReadings
            .map(function (r) {
              return String(r || "").trim();
            })
            .filter(Boolean)
            .join("・");
        }
        const ans = String(q.correctAnswer || "");
        if (ans && ans !== JUKUGO_NONE_ANSWER_) {
          if (Array.isArray(q.choices) && Array.isArray(q.choicesDisplay)) {
            const idx = q.choices.indexOf(ans);
            if (idx >= 0 && q.choicesDisplay[idx]) return String(q.choicesDisplay[idx]);
          }
          return ans;
        }
        return "この中に回答はない";
      }
      if (q.type === "okurigana_shift") {
        return String(q.correctAnswer || "");
      }
      if (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby") {
        return String(q.correctAnswer || "");
      }
      if (q.type === "stroke_count") {
        const n = String(q.correctAnswer || "");
        return n ? n + "画" : "";
      }
      if (q.type === "ruby_to_kanji") {
        return String(q.correctAnswer || q.kanji || "");
      }
      if (q.type === "stroke_order_trace") {
        return String(q.kanji || q.correctAnswer || "");
      }
      return "";
    }
    function mountKanjiQuizVerdictNodes_(q, verdict, nextBtn) {
      if (!verdict) return;
      var placed = false;
      if (q && (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby")) {
        var rail = document.getElementById("kanji-yomi-typing-rail");
        var submit = document.getElementById("kanji-play-submit-btn");
        if (rail) {
          if (submit && submit.parentElement === rail && submit.nextSibling) {
            rail.insertBefore(verdict, submit.nextSibling);
          } else {
            rail.insertBefore(verdict, rail.firstChild);
          }
          if (nextBtn) {
            if (verdict.nextSibling) rail.insertBefore(nextBtn, verdict.nextSibling);
            else rail.appendChild(nextBtn);
          }
          placed = true;
        }
      } else if (q && (q.type === "ruby_to_kanji" || q.type === "stroke_order_trace")) {
        var hwStack = document.querySelector(".kanji-drill-hw-write-stack");
        if (hwStack) {
          hwStack.appendChild(verdict);
          if (nextBtn) hwStack.appendChild(nextBtn);
          placed = true;
        }
      } else {
        var stemHost = null;
        if (q && q.type === "jukugo_yomi") {
          stemHost = document.querySelector("#kanji-play-detail .jukugo-yomi-stem");
        } else if (q && (q.type === "okurigana_shift" || q.type === "stroke_count")) {
          stemHost = document.getElementById("kanji-play-char");
          if (stemHost) stemHost.classList.add("kanji-choice-stem-host");
        }
        if (stemHost) {
          stemHost.appendChild(verdict);
          if (nextBtn) stemHost.appendChild(nextBtn);
          placed = true;
        }
      }
      if (!placed) restoreChoiceQuizFeedbackNodes_();
    }
    function restoreChoiceQuizFeedbackNodes_() {
      const verdict = document.getElementById("kanji-choice-verdict");
      const nextBtn = document.getElementById("kanji-choice-next-btn");
      const choices = document.getElementById("kanji-play-choices");
      const host = choices && choices.parentNode;
      if (!host) return;
      if (verdict && verdict.parentNode !== host) {
        host.insertBefore(verdict, choices);
      }
      if (nextBtn && nextBtn.parentNode !== host) {
        host.insertBefore(nextBtn, choices);
      }
    }
    function hideChoiceQuizVerdict_() {
      restoreChoiceQuizFeedbackNodes_();
      const verdict = document.getElementById("kanji-choice-verdict");
      const mark = document.getElementById("kanji-choice-verdict-mark");
      const answer = document.getElementById("kanji-choice-verdict-answer");
      const nextBtn = document.getElementById("kanji-choice-next-btn");
      const sec = document.getElementById("section-kanji-quiz-play");
      if (verdict) {
        verdict.classList.remove("is-visible", "is-correct", "is-wrong", "is-partial");
        verdict.style.display = "none";
      }
      if (mark) {
        mark.textContent = "";
        mark.style.color = "";
      }
      if (answer) answer.textContent = "";
      if (nextBtn) {
        nextBtn.classList.remove("is-visible");
        nextBtn.style.display = "none";
        nextBtn.onclick = null;
      }
      if (sec) sec.classList.remove("kanji-choice-feedback-active");
    }
    function showChoiceQuizVerdict_(q, isCorrect, opts) {
      opts = opts && typeof opts === "object" ? opts : {};
      const verdict = document.getElementById("kanji-choice-verdict");
      const mark = document.getElementById("kanji-choice-verdict-mark");
      const answer = document.getElementById("kanji-choice-verdict-answer");
      const nextBtn = document.getElementById("kanji-choice-next-btn");
      if (!verdict || !mark || !answer) return;
      // 中身が外側へ持ち出されていた場合は verdict 内へ戻す
      if (mark.parentNode !== verdict) verdict.appendChild(mark);
      if (answer.parentNode !== verdict) verdict.appendChild(answer);
      var isPartial = !!opts.partial;
      var answerText = formatChoiceQuizCorrectReadingLabel_(q);
      var correctLabel = answerText ? "正解：" + answerText : "正解：—";
      if (isPartial) {
        mark.textContent = "△";
        mark.style.color = "#ff9800";
        var partialHint = String(opts.partialHint || "").trim();
        answer.textContent = partialHint ? partialHint + " " + correctLabel : correctLabel;
        verdict.classList.remove("is-correct", "is-wrong");
        verdict.classList.add("is-partial");
      } else {
        mark.textContent = isCorrect ? "◎" : "×";
        mark.style.color = isCorrect ? "#e53935" : "#1565c0";
        answer.textContent = correctLabel;
        verdict.classList.remove("is-partial");
        verdict.classList.toggle("is-correct", !!isCorrect);
        verdict.classList.toggle("is-wrong", !isCorrect);
      }
      verdict.classList.add("is-visible");
      verdict.style.display = "flex";
      mountKanjiQuizVerdictNodes_(q, verdict, nextBtn);
      var sec = document.getElementById("section-kanji-quiz-play");
      if (sec) sec.classList.add("kanji-choice-feedback-active");
    }
    function showKanjiQuizVerdictNextControls_(advanceFn, autoDelayMs) {
      const subBtn = document.getElementById("kanji-play-submit-btn");
      const nextBtn = document.getElementById("kanji-choice-next-btn");
      const sec = document.getElementById("section-kanji-quiz-play");
      if (!kanjiQuizSession) return;
      clearKanjiJukugoAutoNext_();
      clearKanjiStrokeOrderAutoNext_();
      var advanced = false;
      var delayMs = typeof autoDelayMs === "number" && autoDelayMs > 0 ? autoDelayMs : 4000;
      function goNext() {
        if (advanced) return;
        advanced = true;
        clearKanjiJukugoAutoNext_();
        clearKanjiStrokeOrderAutoNext_();
        if (kanjiQuizSession) {
          kanjiQuizSession.jukugoPendingAdvance = null;
          kanjiQuizSession.strokeOrderPendingAdvance = null;
        }
        if (subBtn) {
          subBtn.style.display = "none";
          subBtn.textContent = "こたえを決定";
        }
        if (nextBtn) {
          nextBtn.classList.remove("is-visible");
          nextBtn.style.display = "none";
          nextBtn.onclick = null;
        }
        if (sec) sec.classList.remove("kanji-choice-feedback-active");
        hideChoiceQuizVerdict_();
        advanceFn();
      }
      kanjiQuizSession.jukugoPendingAdvance = goNext;
      kanjiQuizSession.strokeOrderPendingAdvance = goNext;
      if (sec) sec.classList.add("kanji-choice-feedback-active");
      if (subBtn) {
        subBtn.style.display = "none";
        subBtn.textContent = "こたえを決定";
        stopKanjiActionBusy(subBtn);
      }
      if (nextBtn) {
        nextBtn.textContent = "次へ";
        nextBtn.classList.add("is-visible");
        nextBtn.style.display = "inline-flex";
        nextBtn.onclick = function (e) {
          if (e) e.preventDefault();
          goNext();
        };
      }
      kanjiJukugoAutoNextTimer_ = setTimeout(goNext, delayMs);
    }
    function showJukugoYomiNextControls_(advanceFn) {
      showKanjiQuizVerdictNextControls_(advanceFn, 4000);
    }
    function estimateKanjiQuizProvisionalEarned_(scoreForServer, qType, earnedOverrideVal) {
      if (earnedOverrideVal != null && !isNaN(Number(earnedOverrideVal))) {
        return roundKanjiPtOneDecimal_(earnedOverrideVal);
      }
      // 熟語読みタイプ：管理ブック設定のデフォルト値で詳細表示
      if (qType === "jukugo_sentence_to_ruby") return getKanjiQuizSettingNumber_("漢字熟語読みタイプ_基礎点", 15);
      const s = Number(scoreForServer) || 0;
      if (s >= 90) return 10;
      if (s >= 80) return 5;
      if (s >= 70) return 4;
      if (s >= 60) return 3;
      if (s >= 50) return 1;
      return 0;
    }
    function flushKanjiQuizBatchScores_(meta) {
      const user = getAppKidUser_();
      if (!user || !user.id) {
        return Promise.resolve({ status: "error", message: "ログイン情報が見つかりません。" });
      }
      const items = Array.isArray(meta && meta.pendingScoreItems) ? meta.pendingScoreItems : [];
      if (!items.length) {
        return Promise.resolve({ status: "success", earnedPoints: 0, newTotal: user.points, itemEarned: [] });
      }
      const kanjiSetScopeId = buildKanjiSetScopeId_(
        meta.modeName,
        meta.unitName,
        meta.setId,
        meta.formatMode || getKanjiQuizFormatMode()
      );
      const payload = {
        action: "save_learning_session",
        userId: user.id,
        unitId: kanjiSetScopeId,
        unitSheetName: meta.unitName,
        isReviewMode: false,
        isRandom: false,
        results: [],
        learningCategory: "kanji",
        challengeType: "score",
        kanjiSetScopeId: kanjiSetScopeId,
        kanjiScoreBatch: items,
        sessionSubmitId: "kj_batch_" + kanjiSetScopeId + "_" + Date.now()
      };
      if (meta.isTrainingMode) {
        payload.trainingStepIndex = meta.trainingStepIndex;
        payload.trainingMenuId = meta.trainingMenuId;
      }
      function postBatch(retryCount) {
        return fetch(GAS_API_URL, { method: "POST", body: JSON.stringify(payload) })
          .then(function (r) { return r.json(); })
          .catch(function (e) {
            const msg = String((e && (e.message || e)) || "");
            const canRetry = retryCount > 0 && /Load failed|Failed to fetch|NetworkError|fetch/i.test(msg);
            if (!canRetry) throw e;
            return new Promise(function (resolve) { setTimeout(resolve, 450); }).then(function () {
              return postBatch(retryCount - 1);
            });
          });
      }
      return postBatch(1).then(function (d) {
        if (!d || d.status !== "success") throw new Error((d && d.message) || "一括保存に失敗");
        if (d.kanjiChallengePatches && typeof d.kanjiChallengePatches === "object") {
          Object.keys(d.kanjiChallengePatches).forEach(function (ch) {
            mergeKanjiChallengePatchClient(ch, d.kanjiChallengePatches[ch]);
          });
        } else if (d.kanjiChallengeChar && d.kanjiChallengePatch) {
          mergeKanjiChallengePatchClient(d.kanjiChallengeChar, d.kanjiChallengePatch);
        }
        if (d.trainingProgressJson) {
          user.trainingProgressJson = d.trainingProgressJson;
          const trainMenuId = meta.trainingMenuId || currentTrainingMenuId;
          invalidateTrainingRouteCache(trainMenuId);
          applyLocalTrainingProgress(d.trainingProgressJson, trainMenuId);
        }
        user.points = d.newTotal;
        saveAppKidUserToLocal(user);
        const ptsEl = document.getElementById("user-points");
        if (ptsEl) ptsEl.innerText = String(d.newTotal);
        try { showKanjiEarnedPointsToast(d.earnedPoints); } catch (ePt) {}
        return d;
      });
    }
    function submitKanjiQuizScore() {
      if (!kanjiQuizSession) return;
      if (__kanjiQuizSubmitInFlight) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q) return;
      if (!q.type) {
        alert("問題形式が不明です。やり直してください。");
        return;
      }
      let userRaw = "";
      let isCorrect = false;
      var scriptBonusMult = 1;
      var sentenceYomiPartial = false;
      if (q.type === "okurigana_shift") {
        userRaw = kanjiQuizSession.selectedChoice != null ? String(kanjiQuizSession.selectedChoice) : "";
        if (!userRaw) {
          alert("選択肢を選んでください。");
          kanjiQuizSession.jukugoAnswerLocked = false;
          return;
        }
        isCorrect = normalizeKanjiQuizInput(userRaw) === normalizeKanjiQuizInput(q.correctAnswer);
      } else if (q.type === "ruby_to_kanji" || q.type === "stroke_order_trace") {
        if (!kanjiQuizSession.rubyHandComplete) {
          alert(
            q.type === "stroke_order_trace"
              ? "うすい線をなぞって書いて、「これで採点」でこたえてください。"
              : "かくかんじを マスにかき、「これでかいとう」で こたえてください。"
          );
          return;
        }
        isCorrect = !!kanjiQuizSession.rubyHandKanjiVgPass;
      } else if (q.type === "jukugo_yomi") {
        userRaw = kanjiQuizSession.selectedChoice != null ? String(kanjiQuizSession.selectedChoice) : "";
        if (!userRaw) {
          alert("選択肢を選んでください。");
          kanjiQuizSession.jukugoAnswerLocked = false;
          return;
        }
        isCorrect = isJukugoYomiQuizCorrect_(q, userRaw);
      } else if (q.type === "sentence_to_ruby" || q.type === "jukugo_sentence_to_ruby") {
        userRaw =
          kanjiQuizSession && kanjiQuizSession.sentenceYomiRecognized != null
            ? String(kanjiQuizSession.sentenceYomiRecognized || "")
            : "";
        const hidInp = document.getElementById("kanji-play-input");
        if (!normalizeKanjiQuizInput(userRaw) && hidInp) {
          userRaw = String(hidInp.value || "");
        }
        if (!normalizeKanjiQuizInput(userRaw)) {
          alert("よみを入力してから、「こたえを決定」を おしてください。");
          return;
        }
        var yomiEval = evaluateSentenceToRubyAnswer_(q, userRaw);
        isCorrect = !!yomiEval.isCorrect;
        sentenceYomiPartial = !!yomiEval.isPartial;
        scriptBonusMult = yomiEval.scriptBonusMult;
      } else if (q.type === "stroke_count") {
        userRaw = kanjiQuizSession.selectedChoice != null ? String(kanjiQuizSession.selectedChoice) : "";
        if (!userRaw) {
          alert("かくすうを選んでください。");
          return;
        }
        isCorrect = userRaw === String(q.correctAnswer);
      }
      if (
        !isCorrect &&
        kanjiQuizSession &&
        (q.type === "sentence_to_ruby" || q.type === "okurigana_shift" || q.type === "jukugo_yomi" || q.type === "jukugo_sentence_to_ruby")
      ) {
        queueKanjiReadingWeakSignal();
      }
      if (!isCorrect && kanjiQuizSession && q.type === "stroke_count") {
        queueKanjiStrokeCountWeakSignal();
      }
      if (!isCorrect && kanjiQuizSession && isKanjiQuizHandwritingQuestionType_(q.type)) {
        queueKanjiHandwritingWeakSignalForQuestion(q, 0);
      }
      var scoreForServer = 0;
      var earnedOverrideVal = null;
      if (isCorrect) {
        if (isKanjiQuizHandwritingQuestionType_(q.type)) {
          const m = kanjiQuizSession.rubyHandMinScore;
          const fall = Number(kanjiQuizSession.lastHandScore);
          var v = m != null && !isNaN(m) ? m : (!isNaN(fall) && fall > 0 ? fall : 100);
          scoreForServer = Math.max(0, Math.min(100, Math.round(v)));
          if (q.type === "stroke_order_trace") {
            earnedOverrideVal = computeStrokeOrderEarnedOverride_(q, !!kanjiQuizSession.strokeOrderFailedOnce);
          }
        } else if (q.type === "sentence_to_ruby") {
          scoreForServer = Math.max(0, Math.min(100, Math.round(100 * scriptBonusMult)));
        } else {
          scoreForServer = 100;
          if (q.type === "jukugo_yomi") {
            earnedOverrideVal = computeJukugoYomiEarnedOverride_(q);
          } else if (q.type === "jukugo_sentence_to_ruby") {
            earnedOverrideVal = computeJukugoSentenceToRubyEarnedOverride_();
          }
        }
      }
      const selectedForFeedback =
        (q.type === "jukugo_yomi" || q.type === "okurigana_shift" || q.type === "stroke_count") && userRaw
          ? String(userRaw)
          : "";
      kanjiQuizSession.selectedChoice = null;
      const user = getAppKidUser_();
      if (!user || !user.id) {
        alert("ログイン情報が見つかりません。");
        if (q.type === "jukugo_yomi" || q.type === "okurigana_shift") {
          kanjiQuizSession.jukugoAnswerLocked = false;
        }
        try {
          stopKanjiActionBusy(document.getElementById("kanji-quiz-skip-hw-btn"));
        } catch (_eSkip) {}
        return;
      }
      __kanjiQuizSubmitInFlight = true;
      var __kjSubmitBtn = document.getElementById("kanji-play-submit-btn");
      var __isChoiceFeedbackQ = isKanjiQuizVerdictRailType_(q.type);
      if (__kjSubmitBtn && !isKanjiQuizHandwritingQuestionType_(q.type) && !__isChoiceFeedbackQ) {
        startKanjiActionBusy(__kjSubmitBtn, "つぎへ");
      }
      const qid = q.questionId || (q.kanji + "_" + kanjiQuizSession.index + "_" + q.type);
      const unitId =
        "KANJI_" +
        kanjiQuizSession.modeName +
        "_" +
        kanjiQuizSession.unitName +
        "_SET" +
        kanjiQuizSession.setId +
        "_" +
        qid;
      const provisionalEarned = estimateKanjiQuizProvisionalEarned_(
        scoreForServer,
        q.type,
        earnedOverrideVal
      );
      const pendingItem = {
        unitId: unitId,
        kanjiChar: q.kanji,
        score: scoreForServer,
        questionId: qid,
        questionCorrect: isCorrect,
        kanjiQuestionType: q.type || "",
        kanjiScriptBonusMult: scriptBonusMult
      };
      if (earnedOverrideVal != null && !isNaN(Number(earnedOverrideVal))) {
        pendingItem.earnedOverride = earnedOverrideVal;
      }
      if (!Array.isArray(kanjiQuizSession.pendingScoreItems)) kanjiQuizSession.pendingScoreItems = [];
      kanjiQuizSession.pendingScoreItems.push(pendingItem);
      kanjiQuizSession.totalEarned += provisionalEarned;
      kanjiQuizSession.logs.push({
        kanji: q.kanji,
        jukugoWord: q.jukugoWord || "",
        score: scoreForServer,
        earned: provisionalEarned,
        isCorrect: isCorrect,
        qType: q.type
      });
      const summary = document.getElementById("kanji-play-summary");
      const useVerdictRail = isKanjiQuizVerdictRailType_(q.type);
      if (useVerdictRail) {
        if (summary) summary.innerHTML = "";
        if (q.type === "jukugo_yomi" || q.type === "okurigana_shift" || q.type === "stroke_count") {
          applyJukugoYomiChoiceFeedback_(q, selectedForFeedback, isCorrect);
        }
        var verdictOpts = null;
        if (isCorrect && q.type === "sentence_to_ruby" && sentenceYomiPartial) {
          verdictOpts = {
            partial: true,
            partialHint: getSentenceYomiScriptMismatchHint_(q.readingKind)
          };
        }
        showChoiceQuizVerdict_(q, isCorrect, verdictOpts);
      } else if (summary) {
        if (q.type === "stroke_order_trace" || q.type === "ruby_to_kanji") {
          /* 採点結果は #kanji-hw-score-status（手書き共通） */
          summary.innerHTML = "";
        } else if (isCorrect) {
          summary.innerHTML = '<span style="color:#69F0AE;">せいかい！</span>';
        } else {
          summary.innerHTML = '<span style="color:#FF8A80;">ざんねん… 次はがんばろう</span>';
        }
      }
      function advanceKanjiQuizAfterScore() {
        try {
          kanjiQuizClearWritePad(true);
          kanjiQuizSetupWriteCanvas();
        } catch (ePreAdv) {}
        if (!kanjiQuizSession) return;
        kanjiQuizSession.index += 1;
        if (kanjiQuizSession.index >= kanjiQuizSession.questions.length) {
          const finished = {
            totalEarned: kanjiQuizSession.totalEarned,
            logs: kanjiQuizSession.logs.slice(),
            isTrainingMode: !!kanjiQuizSession.isTrainingMode,
            newTotalPoints: Number(kanjiQuizSession.newTotalPoints),
            pendingScoreItems: (kanjiQuizSession.pendingScoreItems || []).slice(),
            modeName: kanjiQuizSession.modeName,
            unitName: kanjiQuizSession.unitName,
            setId: kanjiQuizSession.setId,
            formatMode: kanjiQuizSession.formatMode || getKanjiQuizFormatMode(),
            trainingStepIndex: kanjiQuizSession.trainingStepIndex,
            trainingMenuId: kanjiQuizSession.trainingMenuId
          };
          const nFb = kanjiQuizSession.nigateTraining ? kanjiQuizSession.nigateFeedback : null;
          if (lastKanjiQuizContext && nFb) {
            lastKanjiQuizContext.nigateFeedbackSnapshot = nFb;
          }
          if (kanjiQuizSession.isTrainingMode) {
            const trainMenuId = kanjiQuizSession.trainingMenuId || currentTrainingMenuId;
            if (trainMenuId) currentTrainingMenuId = trainMenuId;
          }
          kanjiQuizSession = null;
          clearKanjiQuizRecoveryDraft();
          showKanjiQuizResult(
            finished.totalEarned,
            finished.logs,
            finished.isTrainingMode,
            finished.newTotalPoints,
            finished
          );
          return;
        }
        saveKanjiQuizRecoveryDraft();
        renderKanjiQuizQuestion();
      }
      function runAdvanceAfterScore_() {
        kanjiQuizHandleNigateAfterScore(q, isCorrect, scoreForServer, advanceKanjiQuizAfterScore);
      }
      try {
        if (useVerdictRail) {
          showKanjiQuizVerdictNextControls_(runAdvanceAfterScore_, 4000);
        } else if (q.type === "stroke_order_trace") {
          showStrokeOrderManualNext_(runAdvanceAfterScore_);
        } else {
          runAdvanceAfterScore_();
        }
      } finally {
        __kanjiQuizSubmitInFlight = false;
        try {
          if (__kjSubmitBtn) {
            stopKanjiActionBusy(__kjSubmitBtn);
          }
        } catch (_eRestoreBtn) {}
        try {
          stopKanjiActionBusy(document.getElementById("kanji-quiz-skip-hw-btn"));
        } catch (_eSkipHw) {}
      }
    }
    function loadQuestionsForSettings(btn, mId, mName, uName, categoryHint) { 
      const origText = toggleBtnLoading(btn, true); 
      const isKanjiMaterial = String(categoryHint || "").toLowerCase() === "kanji" || /漢字|かんじ|kanji/i.test(String(mName || ""));
      if (isKanjiMaterial) {
        openKanjiQuizSets(mId, mName, uName, btn, origText);
        return;
      }
      const cacheKey = `app_cached_questions_${mId}_${uName}`;
      const cached = localStorage.getItem(cacheKey);
      
      const processData = (d) => {
        toggleBtnLoading(btn, false, origText); 
        if(d.status==="success"){ 
          currentQuestions = d.questions; currentModeId = mId; currentModeName = mName; currentUnitName = uName; 
          // 特訓モードフラグをリセットしておく（いつもの学習から入った場合）
          isTrainingMode = false;
          openSettingsScreen(); 
        } else {
          alert("取得失敗: " + (d.message || "エラー"));
        }
      };

      if (cached) {
        try {
          const d = JSON.parse(cached);
          processData(d);
          return;
        } catch(e) {}
      }

      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_questions", modeId: mId, unitName: uName }) })
      .then(r=>r.json()).then(d=>{ 
        if(d.status === "success") {
          localStorage.setItem(cacheKey, JSON.stringify(d));
        }
        processData(d);
      }).catch(e => toggleBtnLoading(btn, false, origText)); 
    }

    function openSettingsScreen() {
      initKeyboardAndSoundSettings();
      switchSection('section-settings'); 
      document.getElementById('settings-title').innerText=`【${currentModeName}】${formatUnitSheetDisplayLabel(currentUnitName)}`;
      const fSelect = document.getElementById('setting-format');
      const category = getTrainingCategoryForUnit(currentUnitName, materialsData);
      const formats = getLearnerFormatOptions(currentModeName, category);
      fSelect.innerHTML = formats.map(function (f) {
        return `<option value="${f.value}">${f.label}</option>`;
      }).join('');
      updateAnswerTypeUI();
    }

    function updateAnswerTypeUI() {
      const format = document.getElementById('setting-format').value;
      const aSelect = document.getElementById('setting-answer-type');
      const answers = getLearnerAnswerOptions(format, currentModeName);
      aSelect.innerHTML = answers.map(function (a) {
        return `<option value="${a.value}">${a.label}</option>`;
      }).join('');
      const defaultAns = {
        ja_to_en_sort: "sort_all",
        ja_to_en: "typing",
        qtext_to_en: "typing",
        qaudio_to_en: "typing",
        en_to_ja: "4choice",
        en_audio_to_ja: "4choice",
        en_audio_to_en: "typing",
        en_to_en: "typing"
      }[format] || (answers[0] ? answers[0].value : "");
      if (defaultAns && Array.from(aSelect.options).some(function (o) { return o.value === defaultAns; })) {
        aSelect.value = defaultAns;
      }
      toggleBlankSetting();
    }

    function toggleBlankSetting() {
      const aSelect = document.getElementById('setting-answer-type').value;
      const blankGroup = document.getElementById('setting-group-blanks');
      const blankSelect = document.getElementById('setting-blank-count');
      
      if (isLegacyFillBlankAnswerType(aSelect)) {
        let maxLen = 0;
        currentQuestions.forEach(q => {
          let word = (q["英単語"] || "").trim();
          if(word.length > maxLen) maxLen = word.length;
        });
        
        let maxBlanks = maxLen > 1 ? maxLen - 1 : 1; 
        
        blankSelect.innerHTML = "";
        for(let i = 1; i <= maxBlanks; i++) {
          blankSelect.innerHTML += `<option value="${i}">${i} 文字 かくす</option>`;
        }
        blankGroup.style.display = "block";
      } else {
        blankGroup.style.display = "none";
      }
    }
    function normalizeAnswerTypeForFormat(format, answerType) {
      const f = String(format || "").trim();
      const a = String(answerType || "").trim();
      if (f === "en_to_ja" || f === "en_audio_to_ja") return "4choice";
      return a;
    }
    function syncAnswerTypeWithFormat(format) {
      const ansTypeEl = document.getElementById('setting-answer-type');
      if (!ansTypeEl) return "";
      const current = String(ansTypeEl.value || "").trim();
      const normalized = normalizeAnswerTypeForFormat(format, current);
      if (normalized !== current) {
        const hasOption = Array.from(ansTypeEl.options || []).some(opt => String(opt.value) === normalized);
        if (!hasOption) {
          if (normalized === "4choice") {
            ansTypeEl.innerHTML = `<option value="4choice" selected>４択（えらぶ）</option>`;
          } else {
            ansTypeEl.innerHTML = `<option value="${normalized}" selected>${normalized}</option>`;
          }
        }
        ansTypeEl.value = normalized;
      }
      return String(ansTypeEl.value || "").trim();
    }

    function kanjiYomiHiraganaToAnswerScript(hira, readingKind) {
      if (readingKind === "on") {
        return Array.from(String(hira || ""))
          .map(function (ch) {
            const c = ch.codePointAt(0);
            if (c >= 0x3041 && c <= 0x3096) return String.fromCodePoint(c + 0x60);
            return ch;
          })
          .join("");
      }
      return String(hira || "");
    }
    function kanjiYomiEnsureRomajiTable() {
      if (window.__kanjiYomiRomajiPairs) return window.__kanjiYomiRomajiPairs;
      const M = {};
      const V = ["a", "i", "u", "e", "o"];
      const VA = ["あ", "い", "う", "え", "お"];
      V.forEach(function (v, i) {
        M[v] = VA[i];
      });
      function row(prefix, chars) {
        const arr = chars.split("");
        V.forEach(function (v, i) {
          if (arr[i]) M[prefix + v] = arr[i];
        });
      }
      row("k", "かきくけこ");
      row("g", "がぎぐげご");
      row("s", "さしすせそ");
      row("z", "ざじずぜぞ");
      row("t", "たちつてと");
      row("d", "だぢづでど");
      row("n", "なにぬねの");
      row("h", "はひふへほ");
      row("b", "ばびぶべぼ");
      row("p", "ぱぴぷぺぽ");
      row("m", "まみむめも");
      row("r", "らりるれろ");
      M["ya"] = "や";
      M["yi"] = "い";
      M["yu"] = "ゆ";
      M["ye"] = "いぇ";
      M["yo"] = "よ";
      M["wa"] = "わ";
      M["wi"] = "うぃ";
      M["we"] = "うぇ";
      M["wo"] = "を";
      M["wu"] = "う";
      M["shi"] = "し";
      M["si"] = "し";
      M["chi"] = "ち";
      M["ti"] = "ち";
      M["tsu"] = "つ";
      M["tu"] = "つ";
      M["fu"] = "ふ";
      M["hu"] = "ふ";
      M["ji"] = "じ";
      M["zi"] = "じ";
      const yoGo = [
        ["ky", "きゃ", "きゅ", "きょ"],
        ["gy", "ぎゃ", "ぎゅ", "ぎょ"],
        ["sh", "しゃ", "しゅ", "しょ"],
        ["ch", "ちゃ", "ちゅ", "ちょ"],
        ["ny", "にゃ", "にゅ", "にょ"],
        ["hy", "ひゃ", "ひゅ", "ひょ"],
        ["by", "びゃ", "びゅ", "びょ"],
        ["py", "ぴゃ", "ぴゅ", "ぴょ"],
        ["my", "みゃ", "みゅ", "みょ"],
        ["ry", "りゃ", "りゅ", "りょ"],
        ["jy", "じゃ", "じゅ", "じょ"]
      ];
      yoGo.forEach(function (rowY) {
        const p = rowY[0];
        M[p + "a"] = rowY[1];
        M[p + "u"] = rowY[2];
        M[p + "o"] = rowY[3];
      });
      M["nn"] = "ん";
      M["xn"] = "ん";
      M["vu"] = "ゔ";
      M["va"] = "ゔぁ";
      M["vi"] = "ゔぃ";
      M["ve"] = "ゔぇ";
      M["vo"] = "ゔぉ";
      M["xtu"] = "っ";
      M["xtsu"] = "っ";
      M["ltu"] = "っ";
      M["ltsu"] = "っ";
      M["xa"] = "ぁ";
      M["xi"] = "ぃ";
      M["xu"] = "ぅ";
      M["xe"] = "ぇ";
      M["xo"] = "ぉ";
      M["la"] = "ぁ";
      M["li"] = "ぃ";
      M["lu"] = "ぅ";
      M["le"] = "ぇ";
      M["lo"] = "ぉ";
      M["xya"] = "ゃ";
      M["xyu"] = "ゅ";
      M["xyo"] = "ょ";
      M["lya"] = "ゃ";
      M["lyu"] = "ゅ";
      M["lyo"] = "ょ";
      ["k", "s", "t", "p", "g", "b", "z"].forEach(function (c) {
        V.forEach(function (v) {
          const one = M[c + v];
          if (one) M[c + c + v] = "っ" + one;
        });
      });
      M["ssa"] = "っさ";
      M["ssi"] = "っし";
      M["ssu"] = "っす";
      M["sse"] = "っせ";
      M["sso"] = "っそ";
      M["tta"] = "った";
      M["tti"] = "っち";
      M["ttu"] = "っつ";
      M["tte"] = "って";
      M["tto"] = "っと";
      M["hha"] = "っは";
      M["hhi"] = "っひ";
      M["hhu"] = "っふ";
      M["hhe"] = "っへ";
      M["hho"] = "っほ";
      M["aa"] = "ああ";
      M["ii"] = "いい";
      M["uu"] = "うう";
      M["ee"] = "ええ";
      M["ei"] = "えい";
      M["oo"] = "おお";
      M["ou"] = "おう";
      const pairs = Object.keys(M).map(function (k) {
        return [k, M[k]];
      });
      pairs.sort(function (a, b) {
        return b[0].length - a[0].length;
      });
      window.__kanjiYomiRomajiPairs = pairs;
      return pairs;
    }
    function kanjiYomiFlushRomajiBuffer(buffer, pairs) {
      let outHira = "";
      let rest = String(buffer || "")
        .toLowerCase()
        .replace(/[^a-z\-]/g, "");
      while (rest.length) {
        let matched = false;
        for (let i = 0; i < pairs.length; i++) {
          const pat = pairs[i][0];
          const hira = pairs[i][1];
          if (rest.startsWith(pat)) {
            outHira += hira;
            rest = rest.slice(pat.length);
            matched = true;
            break;
          }
        }
        if (matched) continue;
        if (rest.length >= 2 && rest.charAt(0) === "n") {
          const c2 = rest.charAt(1);
          if ("aeiouy".indexOf(c2) < 0 && c2 !== "n") {
            outHira += "ん";
            rest = rest.slice(1);
            continue;
          }
        }
        break;
      }
      return { kana: outHira, rest: rest };
    }
    /** 入力済み文字列のひらがな⇔カタカナを文字単位で反転する（句読点・長音符は保持）。 */
    function kanjiYomiSwapHiraKataString_(str) {
      return Array.from(String(str || ""))
        .map(function (ch) {
          const c = ch.codePointAt(0);
          if (c >= 0x3041 && c <= 0x3096) return String.fromCodePoint(c + 0x60);
          if (c >= 0x30a1 && c <= 0x30f6) return String.fromCodePoint(c - 0x60);
          return ch;
        })
        .join("");
    }
    function kanjiYomiKbdLayout_() {
      return getUserPref(LS_KANJI_YOMI_KBD_LAYOUT, "qwerty") === "jis" ? "jis" : "qwerty";
    }
    function kanjiYomiQwertyKbdRows_() {
      return [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m", "-"]
      ];
    }
    /**
     * JIS かな配列（106/109 キーボード準拠・QWERTY 行とは独立）
     * sub: 同位置の英数・記号（薄字表示）。kana: タップで入力するひらがな
     */
    function kanjiYomiJisKbdLayout_() {
      return [
        [
          { kana: "ぬ", sub: "1" }, { kana: "ふ", sub: "2" }, { kana: "あ", sub: "3" },
          { kana: "う", sub: "4" }, { kana: "え", sub: "5" }, { kana: "お", sub: "6" },
          { kana: "や", sub: "7" }, { kana: "ゆ", sub: "8" }, { kana: "よ", sub: "9" },
          { kana: "わ", sub: "0" }, { kana: "ほ", sub: "-" }, { kana: "へ", sub: "^" }
        ],
        [
          { kana: "た", sub: "Q" }, { kana: "て", sub: "W" }, { kana: "い", sub: "E" },
          { kana: "す", sub: "R" }, { kana: "か", sub: "T" }, { kana: "ん", sub: "Y" },
          { kana: "な", sub: "U" }, { kana: "に", sub: "I" }, { kana: "ら", sub: "O" },
          { kana: "せ", sub: "P" }
        ],
        [
          { kana: "ち", sub: "A" }, { kana: "と", sub: "S" }, { kana: "し", sub: "D" },
          { kana: "は", sub: "F" }, { kana: "き", sub: "G" }, { kana: "く", sub: "H" },
          { kana: "ま", sub: "J" }, { kana: "の", sub: "K" }, { kana: "り", sub: "L" },
          { kana: "れ", sub: ";" }
        ],
        [
          { kana: "つ", sub: "Z" }, { kana: "さ", sub: "X" }, { kana: "そ", sub: "C" },
          { kana: "ひ", sub: "V" }, { kana: "こ", sub: "B" }, { kana: "み", sub: "N" },
          { kana: "も", sub: "M" }, { kana: "ね", sub: "," }, { kana: "る", sub: "." },
          { kana: "め", sub: "/" }
        ],
        [
          { kana: "ろ", sub: "\\" }, { kana: "ゃ", sub: "" }, { kana: "ゅ", sub: "" },
          { kana: "ょ", sub: "" }, { kana: "っ", sub: "" }, { kana: "゛", sub: "@" },
          { kana: "゜", sub: "[" }, { kana: "ー", sub: "−" }, { kana: "、", sub: "、" },
          { kana: "。", sub: "。" }
        ]
      ];
    }
    function kanjiYomiApplyDakutenToLast_(inp, mark) {
      if (!inp || !inp.value) return false;
      const dakuten = {
        か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご",
        さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ",
        た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど",
        は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ",
        う: "ゔ"
      };
      const handakuten = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
      const map = mark === "゜" ? handakuten : dakuten;
      const chars = Array.from(inp.value);
      const last = chars[chars.length - 1];
      if (map[last]) {
        chars[chars.length - 1] = map[last];
        inp.value = chars.join("");
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      return false;
    }
    function renderKanjiYomiRomajiKeyboard(containerId, targetInputId, onEnterSubmit) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = "";
      window.__kanjiYomiRomajiTail = "";
      const pairs = kanjiYomiEnsureRomajiTable();
      const kbdLayout = kanjiYomiKbdLayout_();
      /**
       * 入力スクリプトの現在状態。常に「ひらがな（kun）」で開始する。
       * 訓読み／音読みに応じた自動的な誘導（kun→ひらがな・on→カタカナ）は意図的に行わない：
       * 「どちらで答えるべきか」をユーザー自身が判断する学習機会を残すため、
       * 必要なら「かな⇔カナ」ボタンで明示的に切替してもらう。
       * 読みの種類と一致しないまま「けってい」した場合は、採点側で半分点になる。
       */
      let currentScriptKind = "kun";
      const scalePct = parseInt(getUserPref(LS_KBD_SCALE, "100"), 10);
      const fontPx = parseInt(getUserPref(LS_KBD_FONT, "18"), 10);
      const padPx = Math.max(8, Math.round(fontPx * 0.72));
      const wrap = document.createElement("div");
      wrap.className = "keyboard-scale-wrap";
      wrap.style.setProperty("--kb-scale", String(Math.max(0.5, Math.min(2.5, scalePct / 100))));
      wrap.style.setProperty("--vk-font-px", String(fontPx));
      wrap.style.setProperty("--vk-pad-px", String(padPx));
      const layoutRow = document.createElement("div");
      layoutRow.className = "kanji-yomi-kbd-layout-row";
      layoutRow.setAttribute("role", "group");
      layoutRow.setAttribute("aria-label", "キーボード配列");
      function makeLayoutBtn(label, mode, active) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kanji-yomi-kbd-layout-btn" + (active ? " is-active" : "");
        b.textContent = label;
        b.setAttribute("aria-pressed", active ? "true" : "false");
        b.addEventListener("click", function (ev) {
          ev.preventDefault();
          if (kanjiYomiKbdLayout_() === mode) return;
          setUserPref(LS_KANJI_YOMI_KBD_LAYOUT, mode);
          renderKanjiYomiRomajiKeyboard(containerId, targetInputId, onEnterSubmit);
        });
        return b;
      }
      layoutRow.appendChild(makeLayoutBtn("QWERTY（ローマ字）", "qwerty", kbdLayout === "qwerty"));
      layoutRow.appendChild(makeLayoutBtn("JIS ひらがな", "jis", kbdLayout === "jis"));
      wrap.appendChild(layoutRow);
      const hint = document.createElement("div");
      hint.className = "kanji-yomi-kbd-hint";
      hint.textContent =
        kbdLayout === "jis"
          ? "JIS 配列：キーをタップしてひらがなを入力。左上の薄い文字は QWERTY 上の位置です。"
          : "ローマ字 → ひらがな で入力されます。カタカナで答える場合は「かな⇔カナ」ボタンで切替を。";
      wrap.appendChild(hint);
      const tailHint = document.createElement("div");
      tailHint.className = "kanji-yomi-kbd-tail-hint";
      tailHint.style.display = kbdLayout === "jis" ? "none" : "";
      tailHint.innerHTML = '<span style="color:#666;">入力中:</span> <span id="kanji-yomi-romaji-tail-text">―</span>';
      wrap.appendChild(tailHint);
      function updateTailDisplay() {
        const t = String(window.__kanjiYomiRomajiTail || "");
        const tEl = document.getElementById("kanji-yomi-romaji-tail-text");
        if (tEl) tEl.textContent = t ? t : "―";
      }
      const board = document.createElement("div");
      board.className = "keyboard" + (kbdLayout === "jis" ? " kbd-jis" : " kbd-qwerty");
      function applyChar(lower) {
        const inp = document.getElementById(targetInputId);
        if (!inp) return;
        let tail = String(window.__kanjiYomiRomajiTail || "");
        if (lower === "-") {
          if (currentScriptKind === "on") {
            inp.value += "ー";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          updateTailDisplay();
          return;
        }
        if (!/^[a-z]$/.test(lower)) return;
        tail += lower;
        const fl = kanjiYomiFlushRomajiBuffer(tail, pairs);
        const piece = kanjiYomiHiraganaToAnswerScript(fl.kana, currentScriptKind);
        window.__kanjiYomiRomajiTail = fl.rest;
        if (piece) inp.value += piece;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        updateTailDisplay();
      }
      function applyJisKana(kana) {
        const inp = document.getElementById(targetInputId);
        if (!inp || !kana) return;
        inp.value += kanjiYomiHiraganaToAnswerScript(kana, currentScriptKind);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
      function applyJisKey_(keyDef) {
        const inp = document.getElementById(targetInputId);
        if (!inp || !keyDef) return;
        const kana = String(keyDef.kana || "");
        if (kana === "゛") {
          if (!kanjiYomiApplyDakutenToLast_(inp, "゛")) applyJisKana("゛");
          return;
        }
        if (kana === "゜") {
          if (!kanjiYomiApplyDakutenToLast_(inp, "゜")) applyJisKana("゜");
          return;
        }
        applyJisKana(kana);
      }
      function appendJisKeyBtn_(rowDiv, keyDef) {
        const keyBtn = document.createElement("button");
        keyBtn.type = "button";
        keyBtn.className = "key key-dual-label";
        const sub = String(keyDef.sub || "").trim();
        if (sub) {
          keyBtn.innerHTML =
            '<span class="kj-kbd-sub">' +
            escapeHtml(sub) +
            '</span><span class="kj-kbd-main">' +
            escapeHtml(keyDef.kana) +
            "</span>";
        } else {
          keyBtn.innerHTML =
            '<span class="kj-kbd-main kj-kbd-main-only">' + escapeHtml(keyDef.kana) + "</span>";
        }
        bindKeyHandler(keyBtn, function () {
          applyJisKey_(keyDef);
        });
        rowDiv.appendChild(keyBtn);
      }
      function backspaceKey_() {
        const inp = document.getElementById(targetInputId);
        if (!inp) return;
        const tail = String(window.__kanjiYomiRomajiTail || "");
        if (tail.length) {
          window.__kanjiYomiRomajiTail = tail.slice(0, -1);
          updateTailDisplay();
          return;
        }
        if (inp.value.length) {
          inp.value = inp.value.slice(0, -1);
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      function finalizeN() {
        const inp = document.getElementById(targetInputId);
        if (!inp) return;
        let tail = String(window.__kanjiYomiRomajiTail || "");
        if (tail === "n") {
          inp.value += kanjiYomiHiraganaToAnswerScript("ん", currentScriptKind);
          window.__kanjiYomiRomajiTail = "";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          updateTailDisplay();
        }
      }
      function enterKey_() {
        finalizeN();
        if (typeof onEnterSubmit === "function") onEnterSubmit();
      }
      function toggleScriptKind_() {
        const inp = document.getElementById(targetInputId);
        if (!inp) return;
        inp.value = kanjiYomiSwapHiraKataString_(String(inp.value || ""));
        currentScriptKind = currentScriptKind === "on" ? "kun" : "on";
        refreshScriptBtnLabel();
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        updateTailDisplay();
      }
      /**
       * タッチ環境では click だけだと 300ms 遅延・二重発火・直前要素のフォーカス取り合いで
       * 入力をロスすることがある。pointerdown で即座に処理し、click は no-op にして重複を防ぐ。
       */
      function bindKeyHandler(btn, handler) {
        btn.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          handler();
        });
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
        });
      }
      if (kbdLayout === "jis") {
        kanjiYomiJisKbdLayout_().forEach(function (row, ri) {
          const rowDiv = document.createElement("div");
          rowDiv.className = "key-row key-row-jis key-row-jis-" + ri;
          row.forEach(function (keyDef) {
            appendJisKeyBtn_(rowDiv, keyDef);
          });
          board.appendChild(rowDiv);
        });
      } else {
        kanjiYomiQwertyKbdRows_().forEach(function (row) {
          const rowDiv = document.createElement("div");
          rowDiv.className = "key-row";
          row.forEach(function (ch) {
            const keyBtn = document.createElement("button");
            keyBtn.type = "button";
            keyBtn.className = "key key-single-label";
            keyBtn.textContent = ch;
            bindKeyHandler(keyBtn, function () {
              if (/^[a-z]$/i.test(ch)) applyChar(ch.toLowerCase());
              else if (ch === "-") applyChar("-");
            });
            rowDiv.appendChild(keyBtn);
          });
          board.appendChild(rowDiv);
        });
      }
      const rowBs = document.createElement("div");
      rowBs.className = "key-row";
      /**
       * 「かな⇔カナ」トグル：
       *   - 既に入力済みの文字列を一括でひらがな⇔カタカナに反転
       *   - 以降のローマ字確定文字も切り替え後のスクリプトに従う
       *   - ボタンは現在の入力スクリプトを示す（押すと「次に切り替わる側」がラベルに）
       * 訓読み問題でカタカナ／音読み問題でひらがなのまま提出すると採点が半分点になる。
       */
      const scriptBtn = document.createElement("button");
      scriptBtn.type = "button";
      scriptBtn.className = "key key-wide";
      /**
       * --vk-font-px / --vk-pad-px は数値（px 単位なし）で渡る運用。
       * フォールバックも単位なしに揃え、calc() で *1px して長さに変換する。
       * （旧コードは "12px" を渡し、--vk-pad-px が設定済みのときに calc(数値*係数) が
       *  単位なしになり padding が無効化される問題があった）
       */
      scriptBtn.style.fontSize = "calc(var(--vk-font-px, 16) * 1px * 0.9)";
      scriptBtn.style.lineHeight = "1.15";
      scriptBtn.style.padding = "calc(var(--vk-pad-px, 12) * 1px * 2.5) 6px";
      function refreshScriptBtnLabel() {
        if (currentScriptKind === "on") {
          scriptBtn.innerHTML = '<span style="font-size:0.85em;color:#fff;opacity:0.95;">いま:カナ</span><br>かな ⇔ カナ';
          scriptBtn.style.background = "#ff8a65";
          scriptBtn.style.color = "#fff";
          scriptBtn.title = "現在カタカナ入力。タップでひらがなに切替（既入力も反転）";
        } else {
          scriptBtn.innerHTML = '<span style="font-size:0.85em;color:#fff;opacity:0.95;">いま:かな</span><br>かな ⇔ カナ';
          scriptBtn.style.background = "#42a5f5";
          scriptBtn.style.color = "#fff";
          scriptBtn.title = "現在ひらがな入力。タップでカタカナに切替（既入力も反転）";
        }
      }
      refreshScriptBtnLabel();
      bindKeyHandler(scriptBtn, toggleScriptKind_);
      rowBs.appendChild(scriptBtn);
      const bsBtn = document.createElement("button");
      bsBtn.type = "button";
      bsBtn.className = "key key-wide";
      bsBtn.style.padding = "calc(var(--vk-pad-px, 14) * 1px * 2.5) 0";
      bsBtn.textContent = "⌫";
      bindKeyHandler(bsBtn, backspaceKey_);
      rowBs.appendChild(bsBtn);
      board.appendChild(rowBs);
      const bottomRow = document.createElement("div");
      bottomRow.className = "key-row";
      const enterBtn = document.createElement("button");
      enterBtn.type = "button";
      enterBtn.className = "key key-action";
      enterBtn.style.flex = "1";
      enterBtn.style.padding = "calc(var(--vk-pad-px, 14) * 1px * 2.5) 0";
      enterBtn.textContent = "けってい";
      bindKeyHandler(enterBtn, enterKey_);
      bottomRow.appendChild(enterBtn);
      board.appendChild(bottomRow);
      wrap.appendChild(board);
      container.appendChild(wrap);
      updateTailDisplay();
      window.__kanjiYomiKbdActions = {
        applyChar: applyChar,
        backspace: backspaceKey_,
        enter: enterKey_,
        toggleScript: toggleScriptKind_
      };
      requestAnimationFrame(function () {
        fitKanjiYomiKeyboardInCol_();
      });
    }

    let shiftMode = 0; let isShiftHoldMode = false; let shiftPressStartTime = 0; let shiftTimer1s = null; let shiftTimer2s = null;
    function updateKeyboardDisplay() { const isUpper = shiftMode > 0 || isShiftHoldMode; const shiftBtn = document.getElementById('shift-btn'); if (shiftBtn) { if (shiftMode === 2) { shiftBtn.innerText = '⇪'; shiftBtn.style.background = '#FF9800'; } else if (shiftMode === 1 || isShiftHoldMode) { shiftBtn.innerText = '⇧'; shiftBtn.style.background = '#e50914'; } else { shiftBtn.innerText = '⇧'; shiftBtn.style.background = '#444'; } } document.querySelectorAll('.key-char').forEach(btn => { const baseChar = btn.getAttribute('data-char'); if (/[a-z]/.test(baseChar)) btn.innerText = isUpper ? baseChar.toUpperCase() : baseChar; }); }
    function isQuizAnswerSubmitting() {
      return document.body.classList.contains('quiz-answer-submitting');
    }
    function isQuizEnglishTypingKeyboardActive() {
      const quizSection = document.getElementById('section-quiz');
      if (!quizSection || !quizSection.classList.contains('active')) return false;
      if (inputMethodMode === 'pen') return false;
      return true;
    }
    /**
     * 英語クイズのソフトキーボード用。タッチ環境では click だけだと 300ms 遅延・二重発火・
     * 直前要素のフォーカス取り合いで入力をロスすることがあるため pointerdown で即処理する。
     */
    function bindQuizKeyHandler(btn, handler) {
      btn.addEventListener('pointerdown', function (ev) {
        if (btn.disabled || isQuizAnswerSubmitting()) return;
        ev.preventDefault();
        handler();
      });
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
      });
    }
    function appendEnglishQuizKeyChar(inputChar, opts) {
      opts = opts || {};
      if (isQuizAnswerSubmitting()) return;
      if (opts.sortMissingMode) {
        const inp = document.getElementById('sort-missing-input');
        if (inp) inp.value += inputChar;
        return;
      }
      if (opts.isFillMode) {
        handleFillInput(inputChar);
        return;
      }
      if (!isQuizEnglishTypingKeyboardActive()) return;
      const targetInput = document.getElementById(opts.targetInputId || 'type-answer');
      if (targetInput) targetInput.value += inputChar;
    }
    function backspaceEnglishQuizKey(opts) {
      opts = opts || {};
      if (isQuizAnswerSubmitting()) return;
      if (opts.sortMissingMode) {
        const inp = document.getElementById('sort-missing-input');
        if (inp) inp.value = inp.value.slice(0, -1);
        return;
      }
      if (opts.isFillMode) {
        handleFillBackspace();
        return;
      }
      if (!isQuizEnglishTypingKeyboardActive()) return;
      const targetInput = document.getElementById(opts.targetInputId || 'type-answer');
      if (targetInput) targetInput.value = targetInput.value.slice(0, -1);
    }
    function focusQuizTypeAnswerInput() {
      if (inputMethodMode !== 'keyboard') return;
      const inp = document.getElementById('type-answer');
      if (!inp) return;
      try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); }
    }
    function renderCustomKeyboard(isFillMode = false, sortMissingMode = false, containerId = 'keyboard-container', targetInputId = 'type-answer', onEnterSubmit = null) {
      const container = document.getElementById(containerId); if(!container) return; container.innerHTML = "";
      window.__sortMissingModeActive = !!sortMissingMode;
      const keyOpts = { isFillMode: isFillMode, sortMissingMode: sortMissingMode, targetInputId: targetInputId };
      const scalePct = parseInt(getUserPref(LS_KBD_SCALE, '100'), 10);
      const fontPx = parseInt(getUserPref(LS_KBD_FONT, '18'), 10);
      const padPx = Math.max(8, Math.round(fontPx * 0.72));
      const wrap = document.createElement('div');
      wrap.className = 'keyboard-scale-wrap';
      wrap.style.setProperty('--kb-scale', String(Math.max(0.5, Math.min(2.5, scalePct / 100))));
      wrap.style.setProperty('--vk-font-px', String(fontPx));
      wrap.style.setProperty('--vk-pad-px', String(padPx));
      const rows = [ ['!', '"', '$', '%', '&', "'", '(', ')', '-', '¥'], ['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['z','x','c','v','b','n','m',',','.','?'] ];
      const board = document.createElement('div'); board.className = 'keyboard';
      
      rows.forEach((row, rIdx) => {
        const rowDiv = document.createElement('div'); rowDiv.className = 'key-row';
        if(rIdx === 3) {
          const shiftBtn = document.createElement('button'); shiftBtn.type = 'button'; shiftBtn.className = 'key key-wide'; shiftBtn.id = 'shift-btn'; shiftBtn.style.touchAction = 'none'; 
          shiftBtn.onpointerdown = (e) => { e.preventDefault(); if(e.button !== 0 && e.pointerType === 'mouse') return; if (shiftPressStartTime > 0) return; shiftPressStartTime = Date.now(); shiftTimer1s = setTimeout(() => { if (shiftBtn && !isShiftHoldMode) { shiftBtn.style.background = '#FF9800'; shiftBtn.innerText = '⇪'; } }, 1000); shiftTimer2s = setTimeout(() => { isShiftHoldMode = true; shiftMode = 0; updateKeyboardDisplay(); }, 2000); };
          const handlePointerUp = (e) => { e.preventDefault(); if (shiftPressStartTime === 0) return; clearTimeout(shiftTimer1s); clearTimeout(shiftTimer2s); const duration = Date.now() - shiftPressStartTime; shiftPressStartTime = 0; if (isShiftHoldMode) { isShiftHoldMode = false; shiftMode = 0; } else if (duration >= 1000) { shiftMode = (shiftMode === 2) ? 0 : 2; } else if (duration > 0 && duration < 1000) { shiftMode = (shiftMode === 1 || shiftMode === 2) ? 0 : 1; } updateKeyboardDisplay(); };
          shiftBtn.onpointerup = handlePointerUp; shiftBtn.onpointerleave = handlePointerUp; shiftBtn.onpointercancel = handlePointerUp; shiftBtn.oncontextmenu = (e) => { e.preventDefault(); return false; }; 
          rowDiv.appendChild(shiftBtn);
        }
        
        row.forEach(char => {
          const keyBtn = document.createElement('button'); keyBtn.type = 'button'; keyBtn.innerText = char;
          if (/[a-z]/.test(char)) { keyBtn.className = 'key key-char'; keyBtn.setAttribute('data-char', char); } else { keyBtn.className = 'key'; }
          bindQuizKeyHandler(keyBtn, function () {
            const isUpper = shiftMode > 0 || isShiftHoldMode;
            let inputChar = char;
            if (/[a-z]/.test(char) && isUpper) inputChar = char.toUpperCase();
            appendEnglishQuizKeyChar(inputChar, keyOpts);
            if (shiftMode === 1) { shiftMode = 0; updateKeyboardDisplay(); }
          });
          rowDiv.appendChild(keyBtn);
        });
        
        if(rIdx === 3) {
          const bsBtn = document.createElement('button'); bsBtn.type = 'button'; bsBtn.className = 'key key-wide'; bsBtn.innerText = '⌫';
          bindQuizKeyHandler(bsBtn, function () { backspaceEnglishQuizKey(keyOpts); });
          rowDiv.appendChild(bsBtn);
        }
        board.appendChild(rowDiv);
      });
      
      const bottomRow = document.createElement('div'); bottomRow.className = 'key-row';
      const spaceBtn = document.createElement('button'); spaceBtn.type = 'button'; spaceBtn.className = 'key'; spaceBtn.style.flex = "3"; spaceBtn.innerText = "Space";
      bindQuizKeyHandler(spaceBtn, function () { appendEnglishQuizKeyChar(" ", keyOpts); });
      
      if (sortMissingMode) {
        const cardBtn = document.createElement('button'); cardBtn.type = 'button'; cardBtn.className = 'key key-action'; cardBtn.innerText = "カードにする";
        bindQuizKeyHandler(cardBtn, function () { addSortMissingWordCard(); });
        bottomRow.appendChild(spaceBtn); bottomRow.appendChild(cardBtn);
      } else if (!isFillMode) {
        const enterBtn = document.createElement('button'); enterBtn.type = 'button'; enterBtn.className = 'key key-action'; enterBtn.innerText = "けってい";
        bindQuizKeyHandler(enterBtn, function () {
          if (isQuizAnswerSubmitting()) return;
          if (typeof onEnterSubmit === "function") {
            onEnterSubmit();
            return;
          }
          submitTypingAnswer();
        });
        bottomRow.appendChild(spaceBtn); bottomRow.appendChild(enterBtn);
      } else {
        const fillSubmitBtn = document.createElement('button'); fillSubmitBtn.type = 'button'; fillSubmitBtn.className = 'key key-action'; fillSubmitBtn.id = "fill-submit-btn"; fillSubmitBtn.innerText = "✨ これで回答する"; fillSubmitBtn.disabled = true;
        bindQuizKeyHandler(fillSubmitBtn, function () { if (!fillSubmitBtn.disabled) submitFillAnswer(); });
        bottomRow.appendChild(spaceBtn); bottomRow.appendChild(fillSubmitBtn);
      }
      
      board.appendChild(bottomRow);
      wrap.appendChild(board);
      container.appendChild(wrap);
      updateKeyboardDisplay();
    }

    function getPenTargetInput() {
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? ansTypeEl.value : '';
      if (isQuizFreeTypingAnswerType(ansType)) {
        return document.getElementById('type-answer');
      }
      if (ansType === "fill_typing") {
        return null;
      }
      return null;
    }

    function scrollPenTypeAnswerPreview_() {
      const target = getPenTargetInput();
      if (!target || target.tagName !== 'TEXTAREA') return;
      try { target.scrollTop = target.scrollHeight; } catch (_) {}
    }

    function composeWithAutoSpace(baseText, appendText) {
      const base = String(baseText || "");
      const add = String(appendText || "");
      if (!add) return base;
      if (!base) return add;
      const last = base.slice(-1);
      const first = add.charAt(0);
      if (last !== ' ' && first !== ' ') return base + ' ' + add;
      return base + add;
    }

    function appendTypeAnswerText(text) {
      const target = getPenTargetInput();
      if (target) {
        target.value = composeWithAutoSpace(target.value, text);
        target.classList.remove('type-answer-temp');
        handwritingState.pendingTempText = "";
        scrollPenTypeAnswerPreview_();
        return;
      }
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? String(ansTypeEl.value || '').trim() : '';
      if (ansType === 'fill_typing') {
        const chars = String(text || '').replace(/\s/g, '').split('');
        chars.forEach(ch => {
          if (/^[a-zA-Z]$/.test(ch)) handleFillInput(ch);
        });
      }
    }

    function setTypeAnswerTemporary(text) {
      const target = getPenTargetInput();
      if (!target) return;
      const before = target.value;
      target.value = composeWithAutoSpace(before, text);
      target.classList.add('type-answer-temp');
      handwritingState.pendingTempText = target.value.slice(before.length);
      scrollPenTypeAnswerPreview_();
    }

    function confirmTemporaryTypingInput() {
      const target = getPenTargetInput();
      if (!target || !handwritingState.pendingTempText) return;
      target.classList.remove('type-answer-temp');
      handwritingState.pendingTempText = "";
      handwritingState.pendingCandidates = [];
      clearPenCanvas();
      renderPenConfirmBox();
    }

    function removeTemporaryTypingInput() {
      const target = getPenTargetInput();
      if (!target || !handwritingState.pendingTempText) return;
      if (target.value.endsWith(handwritingState.pendingTempText)) {
        target.value = target.value.slice(0, -handwritingState.pendingTempText.length);
      }
      target.classList.remove('type-answer-temp');
      handwritingState.pendingTempText = "";
    }

    function renderPenConfirmBox() {
      const wrap = document.getElementById('pen-confirm-box');
      if (!wrap) return;
      const hasTemp = !!handwritingState.pendingTempText;
      const cands = handwritingState.pendingCandidates || [];
      if (!hasTemp && cands.length === 0) {
        wrap.style.display = 'none';
        wrap.innerHTML = '';
        return;
      }
      wrap.style.display = 'block';
      if (hasTemp) {
        wrap.innerHTML = `
          <div style="font-size:14px;color:#ddd;">うまく変換されましたか？</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button type="button" class="submit-btn btn-green" style="margin-top:0;padding:8px 14px;font-size:14px;" onclick="confirmTemporaryTypingInput()">はい</button>
            <button type="button" class="submit-btn btn-gray" style="margin-top:0;padding:8px 14px;font-size:14px;" onclick="showAlternativeCandidates()">いいえ</button>
          </div>
        `;
        return;
      }
      const htmlCand = cands.map(c => `<button type="button" class="pen-candidate-btn" onclick="chooseAlternativeCandidate('${String(c).replace(/'/g, "\\'")}')">${escapeHtml(String(c))}</button>`).join('');
      wrap.innerHTML = `
        <div style="font-size:14px;color:#ddd;">次の候補にありますか？</div>
        <div class="pen-candidates">${htmlCand || '<span style="color:#999;">候補なし</span>'}</div>
        <div style="margin-top:8px;">
          <button type="button" class="submit-btn btn-gray" style="margin-top:0;padding:8px 14px;font-size:14px;" onclick="retryPenInput()">入力をやり直す</button>
        </div>
      `;
    }

    function showAlternativeCandidates() {
      removeTemporaryTypingInput();
      renderPenConfirmBox();
    }

    function chooseAlternativeCandidate(text) {
      appendTypeAnswerText(text);
      handwritingState.pendingCandidates = [];
      clearPenCanvas();
      renderPenConfirmBox();
    }

    function retryPenInput() {
      handwritingState.pendingCandidates = [];
      removeTemporaryTypingInput();
      clearPenCanvas();
      renderPenConfirmBox();
      setPenStatus('手書きをやり直してください。');
    }

    function clearTypingInput() {
      const target = getPenTargetInput();
      if (!target) return;
      target.value = "";
      target.classList.remove('type-answer-temp');
      handwritingState.pendingTempText = "";
      handwritingState.pendingCandidates = [];
      renderPenConfirmBox();
    }

    function resetHandwritingInputState() {
      handwritingState.pendingCandidates = [];
      handwritingState.pendingTempText = "";
      handwritingState.currentStroke = [];
      handwritingState.allStrokes = [];
      handwritingState.strokesBackupBeforeClear = null;
      handwritingState.isDrawing = false;
      handwritingState.pointerId = null;
      clearTypingInput();
      clearPenCanvas();
    }

    function setPenMode(mode) {
      handwritingState.penMode = mode;
      setUserPref('pen_mode', mode);
      const btnPen = document.getElementById('btn-pen-mode');
      const btnEraser = document.getElementById('btn-eraser-mode');
      if (btnPen) btnPen.classList.toggle('active', mode === 'pen');
      if (btnEraser) btnEraser.classList.toggle('active', mode === 'eraser');
    }

    function setPenWidth(width) {
      const w = parseInt(width, 10);
      handwritingState.penWidth = w;
      setUserPref('pen_width', w);
      const label = document.getElementById('pen-width-label');
      if (label) label.innerText = w;
      const canvas = document.getElementById('pen-canvas');
      if (canvas && canvas.dataset.ready === "1") {
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = w;
      }
    }

    function setPenGuideSpread(val) {
      const n = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
      handwritingState.guideLineSpread = n;
      setUserPref(LS_PEN_GUIDE_SPREAD, String(n));
      const label = document.getElementById('pen-guide-spread-label');
      if (label) label.textContent = n;
      redrawAllStrokes();
    }

    function setPenGuideShow(checked) {
      handwritingState.showGuideLines = !!checked;
      setUserPref(LS_PEN_GUIDE_SHOW, checked ? '1' : '0');
      redrawAllStrokes();
    }

    function scalePenStrokes(oldW, oldH, newW, newH) {
      if (!oldW || !oldH) return;
      if (oldW === newW && oldH === newH) return;
      const sx = newW / oldW, sy = newH / oldH;
      const mapStroke = (st) => { st.forEach(p => { p.x *= sx; p.y *= sy; }); };
      handwritingState.allStrokes.forEach(mapStroke);
      if (handwritingState.strokesBackupBeforeClear) {
        handwritingState.strokesBackupBeforeClear.forEach(mapStroke);
      }
      if (handwritingState.currentStroke && handwritingState.currentStroke.length) {
        mapStroke(handwritingState.currentStroke);
      }
    }

    function relayoutPenCanvas() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas || canvas.dataset.ready !== '1') return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = handwritingState.penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#202124';
      canvas.dataset.logW = String(w);
      canvas.dataset.logH = String(h);
      redrawAllStrokes();
    }

    function setPenCanvasMaxWidth(val) {
      const px = Math.max(400, Math.min(1200, parseInt(val, 10) || 1000));
      handwritingState.canvasMaxWidthPx = px;
      setUserPref(LS_PEN_CANVAS_MAX_WIDTH, String(px));
      const wLabel = document.getElementById('pen-canvas-width-label');
      if (wLabel) wLabel.textContent = px;
      const wrap = document.getElementById('pen-canvas-wrap');
      if (wrap) wrap.style.maxWidth = px + 'px';
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      const oldW = parseFloat(canvas.dataset.logW) || 0;
      const oldH = parseFloat(canvas.dataset.logH) || 0;
      if (canvas.dataset.ready === '1' && oldW > 0 && oldH > 0) {
        const rect = canvas.getBoundingClientRect();
        scalePenStrokes(oldW, oldH, rect.width, rect.height);
      }
      relayoutPenCanvas();
    }

    function undoPenStroke() {
      if (handwritingState.strokesBackupBeforeClear != null) {
        const bak = handwritingState.strokesBackupBeforeClear;
        handwritingState.strokesBackupBeforeClear = null;
        handwritingState.allStrokes = Array.isArray(bak) ? bak.map(s => s.map(p => ({ x: p.x, y: p.y, t: p.t }))) : [];
        redrawAllStrokes();
        return;
      }
      if (handwritingState.allStrokes.length > 0) {
        handwritingState.allStrokes.pop();
        redrawAllStrokes();
      }
    }

    function redrawAllStrokes() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawEnglishGuideLines();
      
      handwritingState.allStrokes.forEach(stroke => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
    }

    function getGuideLineYs() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return null;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const s = typeof handwritingState.guideLineSpread === 'number' ? handwritingState.guideLineSpread : 50;
      /* 最下位（0）付近で狭い間隔、最上位（100）で広い帯。従来の最低幅 0.45 相当はスライダー約 55 付近 */
      const span = 0.14 + (s / 100) * 0.56;
      const mid = 0.5;
      const y0 = h * (mid - span / 2);
      const y3 = h * (mid + span / 2);
      const step = (y3 - y0) / 3;
      return { w, ys: [y0, y0 + step, y0 + 2 * step, y3] };
    }

    function drawEnglishGuideLines() {
      if (!handwritingState.showGuideLines) return;
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const pack = getGuideLineYs();
      if (!pack) return;
      const { w, ys } = pack;
      ctx.save();
      ys.forEach((y, idx) => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.lineWidth = idx === 2 ? 2.2 : 1;
        ctx.strokeStyle = idx === 2 ? 'rgba(120,120,120,0.55)' : 'rgba(160,160,160,0.3)';
        ctx.stroke();
      });
      ctx.restore();
    }

    function distSqToSegment(p1, p2, pt) {
      const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
      if (l2 === 0) return (pt.x - p1.x)**2 + (pt.y - p1.y)**2;
      let t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return (pt.x - (p1.x + t * (p2.x - p1.x)))**2 + (pt.y - (p1.y + t * (p2.y - p1.y)))**2;
    }

    function checkEraserCollision(pt) {
      const ERASER_RADIUS = 20;
      const ERASER_RADIUS_SQ = ERASER_RADIUS * ERASER_RADIUS;
      let hitIdx = -1;
      
      for (let i = handwritingState.allStrokes.length - 1; i >= 0; i--) {
        const stroke = handwritingState.allStrokes[i];
        let hit = false;
        for (let j = 0; j < stroke.length - 1; j++) {
          if (distSqToSegment(stroke[j], stroke[j+1], pt) <= ERASER_RADIUS_SQ) {
            hit = true;
            break;
          }
        }
        if (!hit && stroke.length === 1) {
          if ((stroke[0].x - pt.x)**2 + (stroke[0].y - pt.y)**2 <= ERASER_RADIUS_SQ) {
            hit = true;
          }
        }
        if (hit) {
          hitIdx = i;
          break;
        }
      }
      
      if (hitIdx !== -1) {
        handwritingState.allStrokes.splice(hitIdx, 1);
        redrawAllStrokes();
      }
    }

    function clearPenCanvas() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      if (handwritingState.allStrokes.length > 0) {
        handwritingState.strokesBackupBeforeClear = handwritingState.allStrokes.map(s => s.map(p => ({ x: p.x, y: p.y, t: p.t })));
      }
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawEnglishGuideLines();
      handwritingState.currentStroke = [];
      handwritingState.allStrokes = [];
      handwritingState.isDrawing = false;
      handwritingState.pointerId = null;
      const status = document.getElementById('pen-status');
      if (status) status.innerText = "";
    }

    function setPenStatus(msg) {
      const status = document.getElementById('pen-status');
      if (status) status.innerText = msg || "";
    }

    function refreshPenStatusHint() {
      const status = document.getElementById('pen-status');
      if (!status) return;
      if (status.innerText && status.innerText !== '手書き入力の準備OK') return;
      status.innerText = isIpadStylusOptimizationEnabled()
        ? "iPad書きやすさ優先モード（誤タッチ防止を弱めています）"
        : "手書きペンのみ入力可（パームリジェクション有効）";
    }

    function shouldAcceptPenPointer(e) {
      if (!e) return false;
      if (e.pointerType === 'pen') return true;
      if (!isIpadStylusOptimizationEnabled()) return false;
      if (e.pointerType !== 'touch') return false;
      if (e.isPrimary === false) return false;
      const w = Number(e.width) || 0;
      const h = Number(e.height) || 0;
      const area = w * h;
      const pressure = Number(e.pressure) || 0;
      // iPad書き味優先: 細い接触面・圧力あり・サイズ不明は許容
      if (area === 0) return true;
      if (area <= 260) return true;
      if (pressure >= 0.15) return true;
      return false;
    }

    function getPenCoords(e, canvas) {
      const rect = handwritingState.activePenRect || canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: Date.now()
      };
    }

    function initializePenCanvas() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas || canvas.dataset.ready === "1") return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      
      ctx.lineWidth = handwritingState.penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#202124';
      drawEnglishGuideLines();

      canvas.addEventListener('pointerdown', (e) => {
        if (!shouldAcceptPenPointer(e)) {
          setPenStatus(isIpadStylusOptimizationEnabled() ? 'iPad書きやすさ優先モード: 大きい接触の誤タッチは無効です' : '手書きペンで入力してください（手・マウスは無効）');
          return;
        }
        e.preventDefault();
        const useIpadOpt = isIpadStylusOptimizationEnabled();
        handwritingState.activePenRect = useIpadOpt ? canvas.getBoundingClientRect() : null;
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }
        const pt = getPenCoords(e, canvas);

        if (handwritingState.penMode === 'eraser') {
          checkEraserCollision(pt);
          handwritingState.isDrawing = true;
          handwritingState.pointerId = e.pointerId;
          return;
        }

        handwritingState.isDrawing = true;
        handwritingState.currentStroke = [];
        handwritingState.pointerId = e.pointerId;
        handwritingState.pointerType = e.pointerType;
        handwritingState.currentStroke.push(pt);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!handwritingState.isDrawing || handwritingState.pointerId !== e.pointerId) return;
        if (!shouldAcceptPenPointer(e)) return;
        e.preventDefault();
        const pt = getPenCoords(e, canvas);

        if (handwritingState.penMode === 'eraser') {
          checkEraserCollision(pt);
          return;
        }

        handwritingState.currentStroke.push(pt);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      });

      const stopPenStroke = (e) => {
        if (!handwritingState.isDrawing || handwritingState.pointerId !== e.pointerId) return;
        if (handwritingState.penMode === 'pen' && handwritingState.currentStroke.length > 1) {
          handwritingState.allStrokes.push(handwritingState.currentStroke);
          handwritingState.strokesBackupBeforeClear = null;
        }
        if (canvas.releasePointerCapture) {
          try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        handwritingState.isDrawing = false;
        handwritingState.currentStroke = [];
        handwritingState.pointerId = null;
        handwritingState.activePenRect = null;
      };
      canvas.addEventListener('pointerup', stopPenStroke);
      canvas.addEventListener('pointercancel', stopPenStroke);
      canvas.addEventListener('pointerleave', (e) => {
        if (!handwritingState.isDrawing || handwritingState.pointerId !== e.pointerId) return;
        // iPad では高速筆記時に pointerleave が先に飛ぶことがあるため、
        // ペンがまだ接地中（buttons !== 0）は描画を継続する。
        if (e.buttons !== 0) return;
        stopPenStroke(e);
      });
      canvas.dataset.ready = "1";
      const r0 = canvas.getBoundingClientRect();
      canvas.dataset.logW = String(r0.width);
      canvas.dataset.logH = String(r0.height);
      setPenStatus('手書き入力の準備OK');
      refreshPenStatusHint();
    }

    function renderInputModeUi(targetMode) {
      const area = document.getElementById('quiz-answer-area');
      if (!area) return;
      const panel = area.querySelector('#answer-input-mode-switch');
      if (!panel) return;
      panel.querySelectorAll('.answer-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === targetMode);
      });
    }

    function buildTypingInputAreaMarkup(useFillMode) {
      return `
        <div id="answer-input-mode-switch" class="answer-input-mode-switch">
          <button type="button" class="answer-mode-btn" data-mode="keyboard" onclick="switchInputMethod('keyboard')">⌨️ キーボード</button>
          <button type="button" class="answer-mode-btn" data-mode="pen" onclick="switchInputMethod('pen')">✍️ 手書き</button>
        </div>
        <div id="input-method-body"></div>
      `;
    }

    function mountTypingMethodBody(useFillMode) {
      const body = document.getElementById('input-method-body');
      if (!body) return;
      if (inputMethodMode === 'pen') {
        const submitBtnHtml = useFillMode
          ? `<button type="button" id="fill-submit-btn" class="submit-btn btn-green" style="margin-top:0;padding:10px 20px;font-size:16px;" onclick="submitFillAnswer()" disabled>これで回答</button>`
          : '';
        const typingPreviewHtml = useFillMode
          ? `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
              <button type="button" id="pen-recognize-btn" class="submit-btn btn-blue pen-recognize-btn" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="recognizePenStrokes()">文字起こし</button>
              <span style="color:#bbb;font-size:13px;line-height:1.4;">かいたあと「文字起こし」でマスに入ります（サーバーへ送ります）</span>
            </div>
          `
          : `
            <div class="pen-typing-preview-row">
              <button type="button" id="pen-recognize-btn" class="submit-btn btn-blue pen-recognize-btn" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="recognizePenStrokes()">文字起こし</button>
              <button type="button" class="submit-btn btn-gray" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="appendTypeAnswerText(' ')">間をあける</button>
              <button type="button" id="pen-typing-submit-btn" class="submit-btn btn-green" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="submitTypingAnswer()">答えを送信</button>
            </div>
            <div class="pen-typing-preview-area">
              <textarea id="type-answer" class="large-input type-answer-pen-preview" readonly rows="2" placeholder="認識結果が入ります" aria-label="手書きの認識結果"></textarea>
            </div>
          `;
        const activePen = handwritingState.penMode === 'pen' ? 'active' : '';
        const activeEraser = handwritingState.penMode === 'eraser' ? 'active' : '';
        const wMax = handwritingState.canvasMaxWidthPx;
        body.innerHTML = `
          <div class="pen-panel">
            <div class="pen-settings pen-tool-row">
              <div class="pen-toggle-switch">
                <button type="button" id="btn-pen-mode" class="${activePen}" onclick="setPenMode('pen')">手書き</button>
                <button type="button" id="btn-eraser-mode" class="${activeEraser}" onclick="setPenMode('eraser')">線消しゴム</button>
              </div>
              <button type="button" id="pen-advanced-toggle-btn" class="cancel-btn" onclick="togglePenAdvancedSettings()" style="padding:4px 10px; font-size:14px; background:#1E88E5; color:#fff; border-radius:20px; border:1px solid #1565C0;">詳細設定ボタンを表示</button>
              <button type="button" class="cancel-btn" onclick="undoPenStroke()" style="padding:4px 10px; font-size:14px; background:#444; color:#fff; border-radius:20px; border:1px solid #555;">↩️ 1つ戻す</button>
              <button type="button" class="cancel-btn" onclick="clearPenCanvas()" style="padding:4px 10px; font-size:14px; background:#444; color:#fff; border-radius:20px; border:1px solid #555;">手書きを全部消す</button>
              <button type="button" class="cancel-btn" onclick="clearTypingInput()" style="padding:4px 10px; font-size:14px; background:#444; color:#fff; border-radius:20px; border:1px solid #555;">テキスト入力を全部消す</button>
            </div>
            <div id="pen-advanced-controls" class="pen-canvas-width-row" style="display:none; justify-content:center; align-items:center; flex-wrap:wrap; gap:10px;">
              <label style="color:#ccc; font-size:14px; display:flex; align-items:center; gap:5px; background:#222; padding:4px 8px; border-radius:20px;">
                太さ: <input type="range" id="pen-width-range" min="1" max="10" value="${handwritingState.penWidth}" onchange="setPenWidth(this.value)">
                <span id="pen-width-label" style="display:inline-block; width:16px; text-align:center;">${handwritingState.penWidth}</span>px
              </label>
              <label style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">手書きの幅
                <input type="range" id="pen-canvas-width-range" min="400" max="1200" step="20" value="${wMax}" oninput="setPenCanvasMaxWidth(this.value)" style="width:min(240px,50vw);">
                <span id="pen-canvas-width-label">${wMax}</span> px
              </label>
              <label style="color:#ccc;font-size:13px;display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:100%;">目印の間隔
                <input type="range" id="pen-guide-spread" class="pen-guide-hslider" min="0" max="100" value="${handwritingState.guideLineSpread}" oninput="setPenGuideSpread(this.value)" title="4本の目印の線の間隔">
                <span id="pen-guide-spread-label" style="min-width:22px;">${handwritingState.guideLineSpread}</span>
              </label>
              <label style="color:#ccc; font-size:13px; display:flex; align-items:center; gap:6px; background:#222; padding:4px 10px; border-radius:20px; cursor:pointer;">
                <input type="checkbox" id="pen-guide-show" ${handwritingState.showGuideLines ? 'checked' : ''} onchange="setPenGuideShow(this.checked)"> 目印の線を表示する
              </label>
              <label style="color:#ccc; font-size:13px; display:flex; align-items:center; gap:6px; background:#222; padding:4px 10px; border-radius:20px; cursor:pointer;">
                <input type="checkbox" id="pen-ipad-stylus-opt" ${isIpadStylusOptimizationEnabled() ? 'checked' : ''} onchange="syncIpadStylusSettingsFromCheckbox(this)"> iPad用のスタイラスペン設定にする
              </label>
            </div>
            ${typingPreviewHtml}
            <div id="pen-confirm-box" class="pen-confirm-box" style="display:none;"></div>
            <div class="pen-canvas-wrap" id="pen-canvas-wrap" style="max-width:${wMax}px;margin:0 auto;">
              <canvas id="pen-canvas" class="pen-canvas" oncontextmenu="event.preventDefault();return false" style="width:100%;height:min(50vh, 520px);max-height:85vh;touch-action:none;"></canvas>
            </div>
            ${useFillMode ? `<div class="pen-panel-controls" style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;justify-content:center;">${submitBtnHtml}</div>` : ``}
            <div id="pen-status" class="pen-status">手書きペンのみ入力可（パームリジェクション有効）</div>
          </div>
        `;
        initializePenCanvas();
        renderPenConfirmBox();
        syncPenAdvancedVisibility();
      } else {
        if (useFillMode) {
          body.innerHTML = `<div id="keyboard-container"></div>`;
          renderCustomKeyboard(true);
        } else {
          body.innerHTML = `
            <div class="keyboard-typing-top-row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;margin-bottom:8px;">
              <button type="button" id="keyboard-typing-submit-btn" class="submit-btn btn-green" style="margin-top:0;padding:10px 20px;font-size:16px;" onclick="submitTypingAnswer()">答えを送信</button>
            </div>
            <input type="text" id="type-answer" class="large-input" readonly inputmode="none" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="下のキーボードで入力">
            <div id="keyboard-container"></div>`;
          renderCustomKeyboard(false);
          focusQuizTypeAnswerInput();
        }
      }
      renderInputModeUi(inputMethodMode);
      syncQuizAnswerAreaPenModeClass();
    }

    function syncQuizAnswerAreaPenModeClass() {
      const a = document.getElementById('quiz-answer-area');
      const sec = document.getElementById('section-quiz');
      const isPen = inputMethodMode === 'pen';
      if (a) a.classList.toggle('pen-mode-active', isPen);
      if (sec) sec.classList.toggle('pen-mode-active', isPen);
    }

    let isPenTypingSubmitInFlight = false;
    function setPenTypingSubmitBusy(isBusy) {
      isPenTypingSubmitInFlight = !!isBusy;
      ['pen-typing-submit-btn', 'keyboard-typing-submit-btn'].forEach(function (id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !!isBusy;
        btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
        btn.innerText = isBusy ? '送信中...' : '答えを送信';
      });
    }
    function submitTypingAnswer() {
      if (isPenTypingSubmitInFlight || isQuizAnswerSubmitting()) return;
      if (inputMethodMode === 'pen' && handwritingState.pendingTempText) confirmTemporaryTypingInput();
      const target = document.getElementById('type-answer');
      const userA = target ? String(target.value || "") : "";
      if (!normalizeText(userA)) {
        if (inputMethodMode === 'pen') setPenStatus('先に文字起こしして入力してください。');
        return;
      }
      if (!Array.isArray(filteredQuestions) || currentQuestionIndex < 0 || currentQuestionIndex >= filteredQuestions.length) {
        if (inputMethodMode === 'pen') setPenStatus('問題データの読み込み待ちです。少し待って再度お試しください。');
        return;
      }
      const q = filteredQuestions[currentQuestionIndex];
      if (!q) {
        if (inputMethodMode === 'pen') setPenStatus('問題の取得に失敗しました。次の問題に進んでください。');
        return;
      }
      const formatEl = document.getElementById('setting-format');
      const format = formatEl ? String(formatEl.value || "") : "";
      const correctA = (format.includes("qtext") || format.includes("qaudio")) ? q["英文"] : (q["英単語"] || q["英文"]);
      setPenTypingSubmitBusy(true);
      checkAnswer(userA, correctA, q);
    }
    function submitTypingFromPen() {
      submitTypingAnswer();
    }

    function switchInputMethod(mode) {
      inputMethodMode = mode === 'pen' ? 'pen' : 'keyboard';
      setUserPref(LS_INPUT_MODE, inputMethodMode);
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? String(ansTypeEl.value || '').trim() : '';
      if (!isQuizFreeTypingAnswerType(ansType) && ansType !== "fill_typing") return;
      mountTypingMethodBody(ansType === "fill_typing");
      const answerArea = document.getElementById('quiz-answer-area');
      if (answerArea) placeQuizFeedbackAboveKeyboard(answerArea);
      if (inputMethodMode === 'keyboard') focusQuizTypeAnswerInput();
    }

    function getPenWritingGuideForApi() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return { width: 1000, height: 400 };
      const w = parseFloat(canvas.dataset.logW) || canvas.getBoundingClientRect().width || 1000;
      const h = parseFloat(canvas.dataset.logH) || canvas.getBoundingClientRect().height || 400;
      return {
        width: Math.round(Math.max(200, Math.min(2400, w))),
        height: Math.round(Math.max(200, Math.min(2400, h)))
      };
    }

    function collectInkForApi() {
      const apiInk = [];
      const MAX_POINTS_PER_STROKE = 180;
      handwritingState.allStrokes.forEach(stroke => {
        if (!stroke || stroke.length < 1) return;
        let strokeForApi = stroke;
        if (stroke.length === 1) {
          const p0 = stroke[0];
          strokeForApi = [p0, { x: p0.x, y: p0.y, t: (p0.t != null ? p0.t : Date.now()) + 1 }];
        }
        let sampled = strokeForApi;
        if (strokeForApi.length > MAX_POINTS_PER_STROKE) {
          const step = Math.ceil(strokeForApi.length / MAX_POINTS_PER_STROKE);
          sampled = strokeForApi.filter((_, idx) => idx % step === 0);
          if (sampled[sampled.length - 1] !== strokeForApi[strokeForApi.length - 1]) {
            sampled.push(strokeForApi[strokeForApi.length - 1]);
          }
        }
        const xArr = [];
        const yArr = [];
        const tArr = [];
        const t0 = (typeof sampled[0].t === 'number' && !isNaN(sampled[0].t)) ? sampled[0].t : 0;
        sampled.forEach((p, i) => {
          xArr.push(p.x);
          yArr.push(p.y);
          const t = (typeof p.t === 'number' && !isNaN(p.t)) ? p.t : t0 + i * 16;
          tArr.push(Math.max(0, t - t0));
        });
        apiInk.push([xArr, yArr, tArr]);
      });
      return apiInk;
    }

    function setPenRecognizeButtonState(isBusy) {
      const btn = document.getElementById('pen-recognize-btn');
      if (!btn) return;
      btn.classList.toggle('is-busy', !!isBusy);
      btn.disabled = !!isBusy;
      btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
      btn.innerText = isBusy ? '⏳ 文字起こし中...' : '文字起こし';
    }

    function recognizePenStrokes() {
      if (inputMethodMode !== 'pen') return;
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? String(ansTypeEl.value || '').trim() : '';
      if (!isQuizFreeTypingAnswerType(ansType) && ansType !== "fill_typing") return;
      if (isPenRecognitionInFlight) {
        setPenStatus('文字起こし中です。少し待ってください。');
        return;
      }
      const apiInk = collectInkForApi();
      if (apiInk.length === 0) {
        setPenStatus('先に手書きで文字を書いてください。');
        return;
      }
      const writingGuide = getPenWritingGuideForApi();
      isPenRecognitionInFlight = true;
      setPenRecognizeButtonState(true);
      setPenStatus('文字起こし中（サーバーと通信）… 画数: ' + String(apiInk.length));
      const ac = new AbortController();
      const PEN_RECOGNIZE_TIMEOUT_MS = 38000;
      const timeoutId = setTimeout(() => ac.abort(), PEN_RECOGNIZE_TIMEOUT_MS);
      function postRecognizeWithRetry(retryCount) {
        return fetch(GAS_API_URL, {
          method: 'POST',
          body: JSON.stringify({ action: "recognize_handwriting", ink: apiInk, writingGuide: writingGuide }),
          signal: ac.signal
        })
        .then(r => {
          if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
          return r.json();
        })
        .catch(err => {
          if (err && err.name === 'AbortError') throw err;
          const msg = String((err && (err.message || err)) || "");
          const canRetry = retryCount > 0 && /Load failed|Failed to fetch|NetworkError|fetch/i.test(msg);
          if (!canRetry) throw err;
          setPenStatus('通信が不安定です。文字起こしを再試行中…');
          return new Promise(resolve => setTimeout(resolve, 450)).then(() => postRecognizeWithRetry(retryCount - 1));
        });
      }
      postRecognizeWithRetry(1)
      .then(d => {
        if (d.status !== "success") {
          setPenStatus(d.message || "認識に失敗しました。");
          return;
        }
        const text = String(
          d.text != null ? d.text :
          d.result != null ? d.result :
          d.recognizedText != null ? d.recognizedText :
          d.bestCandidate != null ? d.bestCandidate :
          d.candidate != null ? d.candidate :
          ""
        ).trim();
        if (!text) {
          const keys = d && typeof d === "object" ? Object.keys(d).slice(0, 8).join(", ") : "";
          setPenStatus("認識結果なし。もう一度書いてください。返却キー: " + (keys || "なし"));
          return;
        }
        const rawCandidates =
          Array.isArray(d.candidates) ? d.candidates :
          Array.isArray(d.alternatives) ? d.alternatives :
          Array.isArray(d.results) ? d.results :
          [];
        const candidates = rawCandidates.map(v => String(v || '').trim()).filter(v => v);
        handwritingState.pendingCandidates = candidates.filter(v => v !== text);
        const target = getPenTargetInput();
        if (target) {
          removeTemporaryTypingInput();
          setTypeAnswerTemporary(text);
          renderPenConfirmBox();
        } else {
          const chars = text.replace(/\s/g, '').split('');
          chars.forEach(ch => {
            if (/^[a-zA-Z]$/.test(ch)) handleFillInput(ch);
          });
        }
        setPenStatus(`仮入力: ${text}`);
      })
      .catch(err => {
        if (err && err.name === 'AbortError') {
          setPenStatus('時間がかかりすぎて止めました。通信やGASの状態を確認し、もう一度「文字起こし」を押してください。');
        } else {
          const msg = String((err && (err.message || err)) || "");
          setPenStatus('通信エラー（' + (msg || '応答を読めませんでした') + '）。ネットワークを確認して再度お試しください。');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        isPenRecognitionInFlight = false;
        setPenRecognizeButtonState(false);
      });
    }

    function startVoiceInput() {
      if (!recognition) recognition = createEnglishRecognition_();
      if (!recognition) { alert("お使いのブラウザは音声入力に対応していません。SafariかChromeを使ってね！"); return; }
      if (voiceRecognitionPendingStart_) return;
      releaseStuckQuizVoiceState_();
      if (isQuizVoiceMicBlocked_()) return;
      if (quizVoiceListening) return;
      const feedback = document.getElementById('voice-feedback');
      const btn = document.getElementById('voice-btn');
      const displayField = document.getElementById('voice-recognized-text');
      if (!feedback || !btn || !displayField) return;

      const beginListening = function () {
        voiceRecognitionPendingStart_ = null;
        if (isQuizVoiceMicBlocked_() || quizVoiceListening) return;
        if (!recognition) recognition = createEnglishRecognition_();
        if (!recognition) return;
        const sessionGen = ++voiceRecognitionGen_;
        displayField.value = "";
        btn.innerText = "🎙️ 聞き取り中...";
        btn.style.background = "#e50914";
        btn.disabled = false;
        feedback.innerHTML = "英語ではなしてください...";
        startQuizVoiceListening_();

        recognition.onresult = (event) => {
          if (sessionGen !== voiceRecognitionGen_) return;
          let interimTranscript = ''; let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; else interimTranscript += event.results[i][0].transcript; }
          let rawTranscript = finalTranscript || interimTranscript;
          const displayText = convertDigitsToWordsInText(rawTranscript);
          displayField.value = displayText;
          if (displayText) {
            const q = filteredQuestions[currentQuestionIndex]; const format = document.getElementById('setting-format').value; let correctA = (format.includes("qtext") || format.includes("qaudio")) ? q["英文"] : (q["英単語"] || q["英文"]);
            if(normalizeText(displayText) === normalizeText(correctA)) {
              stopEnglishRecognitionSafely_(null);
              displayField.value = displayText;
              checkAnswer(displayText, correctA, q);
            }
            else if (finalTranscript) {
              voiceFailCount++;
              stopEnglishRecognitionSafely_(function () {
                if (sessionGen !== voiceRecognitionGen_) return;
                if (voiceFailCount >= 5) {
                  displayField.value = displayText;
                  checkAnswer(displayText, correctA, q);
                } else {
                  displayField.value = displayText;
                  feedback.innerHTML = `聞き取った言葉：<br><b style='color:#FF9800;'>「${displayText}」</b><br>ちがうみたい！もう一度🎙️をおしてね。<br><span style="font-size:14px; color:#F44336;">（まちがい: ${voiceFailCount}回 / 5回で不正解）</span>`;
                  resetVoiceBtnIdle_(btn);
                }
              });
            }
          }
        };
        recognition.onerror = (event) => {
          if (sessionGen !== voiceRecognitionGen_) return;
          const errCode = event && event.error ? String(event.error) : "";
          stopEnglishRecognitionSafely_(function () {
            if (sessionGen !== voiceRecognitionGen_) return;
            recognition = createEnglishRecognition_();
            resetVoiceBtnIdle_(btn, feedback, errCode === "not-allowed"
              ? "マイクの使用が許可されていません。ブラウザの設定を確認してください。"
              : "聞き取れませんでした。もう一度おしてね。");
          });
        };
        recognition.onend = function () {
          if (sessionGen !== voiceRecognitionGen_) return;
          stopQuizVoiceListening_();
          if (btn.innerText.includes("聞き取り中")) resetVoiceBtnIdle_(btn);
        };
        try {
          recognition.start();
        } catch (err) {
          stopQuizVoiceListening_();
          recognition = createEnglishRecognition_();
          resetVoiceBtnIdle_(btn, feedback, "マイクを起動できませんでした。少し待ってからもう一度お試しください。");
          console.warn("recognition.start failed", err);
        }
      };

      stopEnglishRecognitionSafely_(function () {
        voiceRecognitionPendingStart_ = setTimeout(beginListening, 220);
      });
    }

    function startJaSpeechToField(fieldId) {
      const target = document.getElementById(fieldId);
      if (!target) return;
      if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) { alert("お使いのブラウザは日本語音声入力に対応していません。Chrome/Edgeを使ってね。"); return; }
      if (!recognitionJa) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionJa = new SpeechRecognition();
        recognitionJa.lang = 'ja-JP';
        recognitionJa.interimResults = false;
        recognitionJa.continuous = false;
      }
      const btnText = target.dataset && target.dataset.listeningLabel ? target.dataset.listeningLabel : "🎙️ 日本語で入力";
      recognitionJa.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; }
        if (finalTranscript) {
          target.value = (target.value ? target.value + " " : "") + finalTranscript;
        }
      };
      recognitionJa.onerror = () => { alert("聞き取れませんでした。もう一度試してください。"); };
      recognitionJa.onend = () => {};
      recognitionJa.start();
    }

    function startQuizAfterFilters(order) {
      if (order === 'random') filteredQuestions.sort(() => Math.random() - 0.5);
      currentQuestionIndex = 0; quizResults = [];
      captureEnglishQuizSessionMeta();
      switchSection('section-quiz'); saveQuizRecoveryDraft(0); showQuestion();
    }

    function prepareQuiz() {
      currentIsReviewMode = document.getElementById('setting-play-mode').value === 'review';
      const order = document.getElementById('setting-order').value; 
      const format = document.getElementById('setting-format').value;
      const ansType = syncAnswerTypeWithFormat(format);

      filteredQuestions = applyQuizQuestionFilters(currentQuestions, format, ansType);

      if (format === "ja_to_en_sort" && filteredQuestions.length === 0) {
        alert("並び替えの出題データがありません。\n並び替え語句が3語以上の行だけ出題します（1〜2語の行はスキップ）。\n「並び替え箇所」または「英文」と語句列を確認してください。\n不要語混入の場合は「並び替え語句ダミー」も必要です。");
        return;
      }

      if (isLegacyFillBlankAnswerType(ansType) && filteredQuestions.length === 0) {
        alert("選択した文字数を隠せる単語がありません！隠す数を減らしてください。");
        return;
      }

      if (isEnToEnClueAnswerType(ansType) && filteredQuestions.length === 0) {
        if (ansType === "initial_typing" || ansType === "initial_voice") {
          alert("イニシャル列にデータがある問題がありません。学習セットの「イニシャル」列を確認してください。");
        } else {
          alert("穴埋め１／穴埋め２列にデータがある問題がありません。学習セットを確認してください。");
        }
        return;
      }

      if (currentIsReviewMode) {
        const unitKey = getDetailedUnitId();
        fetchEnglishUnitHistory(unitKey).then(function (history) {
          filteredQuestions = filteredQuestions.filter(function (q) {
            return checkIsNigate(history[q["通し番号"]]);
          });
          if (filteredQuestions.length === 0) {
            alert("ニガテな問題はありません！通常モードでスタートします。");
            currentIsReviewMode = false;
            document.getElementById('setting-play-mode').value = 'normal';
            filteredQuestions = applyQuizQuestionFilters([...currentQuestions], format, ansType);
          }
          startQuizAfterFilters(order);
        });
        return;
      }
      startQuizAfterFilters(order);
    }

    /** 正誤表示を「つぎへ」ボタンの直前の定位置へ戻す（answerArea を空にする前に必須） */
    function restoreQuizFeedbackLocation() {
      const fb = document.getElementById('quiz-feedback');
      const nextBtn = document.getElementById('quiz-next-btn');
      if (!fb || !nextBtn || !nextBtn.parentNode) return;
      if (fb.nextElementSibling !== nextBtn) {
        nextBtn.parentNode.insertBefore(fb, nextBtn);
      }
    }

    /** 正誤表示は常に「入力欄の直下」優先で配置する（手書き/キーボード両対応） */
    function placeQuizFeedbackAboveKeyboard(answerAreaEl) {
      const fb = document.getElementById('quiz-feedback');
      if (!fb || !answerAreaEl) return;

      const typeInput = answerAreaEl.querySelector('#type-answer');
      if (typeInput) {
        const hostRow = typeInput.closest('div');
        const hostParent = hostRow && hostRow.parentNode ? hostRow.parentNode : typeInput.parentNode;
        if (hostParent) {
          hostParent.insertBefore(fb, hostRow ? hostRow.nextSibling : typeInput.nextSibling);
          return;
        }
      }

      const kbd = answerAreaEl.querySelector('#keyboard-container');
      if (kbd) {
        answerAreaEl.insertBefore(fb, kbd);
        return;
      }

      answerAreaEl.appendChild(fb);
    }

    function showQuestion() {
      if (currentQuestionIndex >= filteredQuestions.length) { finishQuiz(); return; }
      document.body.classList.remove('quiz-answer-submitting');
      setPenTypingSubmitBusy(false);
      maxDeduction = 0;
      voiceFailCount = 0;
      cancelVoiceRecognitionPendingStart_();
      stopEnglishRecognitionSafely_(null);
      resetQuizAudioVoiceMutex_();
      resetEnFlashQuestionState_();
      clearTimeout(autoNextTimer);
      destroySortQuizIfAny();
      
      const q = filteredQuestions[currentQuestionIndex]; 
      const format = document.getElementById('setting-format').value; 
      const answerType = syncAnswerTypeWithFormat(format);
      const isWord = currentModeName.includes("単語");

      const kbdPanel = document.getElementById('quiz-keyboard-settings-panel');
      if (kbdPanel) {
        kbdPanel.style.display = (isQuizFreeTypingAnswerType(answerType) || answerType === 'fill_typing' || (format === 'ja_to_en_sort' && answerType === 'sort_missing')) ? 'block' : 'none';
        const kbdBody = document.getElementById('quiz-keyboard-settings-body');
        if (kbdBody) kbdBody.style.display = 'none';
      }
      
      document.getElementById('quiz-progress').innerText = (isTrainingMode?"🎯 特訓ルート: ":"") + (currentIsReviewMode?"🔥特訓中! ":"") + `第 ${currentQuestionIndex + 1} 問 / 全 ${filteredQuestions.length} 問`;
      
      let qText = "", correctA = "", engTextForAudio = "";
      if (format === "ja_to_en") { qText = q["日本語"]; correctA = (q["英単語"] || q["英文"]).trim(); } 
      else if (format === "en_to_ja") { qText = (q["英単語"] || q["英文"]).trim(); correctA = q["日本語"]; }
      else if (format === "qtext_to_en") { qText = q["疑問文"]; correctA = q["英文"].trim(); }
      else if (format === "en_audio_to_ja") { engTextForAudio = q["英単語"] || q["英文"]; correctA = q["日本語"]; }
      else if (format === "qaudio_to_en") { engTextForAudio = q["疑問文"]; correctA = q["英文"]; }
      else if (format === "en_audio_to_en") { engTextForAudio = q["英単語"] || q["英文"]; correctA = (q["英単語"] || q["英文"]).trim(); }
      else if (format === "en_to_en") {
        correctA = (q["英単語"] || q["英文"]).trim();
        engTextForAudio = correctA;
        if (isEnToEnClueAnswerType(answerType)) {
          qText = getEnToEnCluePrompt(q, answerType);
        } else if (!isEnToEnFlashAnswerType(answerType)) {
          qText = correctA;
        }
      }

      if (format === "ja_to_en_sort") {
        const ja = String(q["日本語"] || "");
        const refEn = String(q["並び替え用英文"] || "").trim();
        document.getElementById('quiz-q-text').innerHTML = `<div style="font-size:36px;font-weight:bold;margin-bottom:8px;">${escapeHtml(ja)}</div>${refEn ? `<div style="font-size:22px;color:#aaa;line-height:1.4;">${escapeHtml(refEn)}</div>` : ''}`;
      } else if (format.includes("audio")) {
        document.getElementById('quiz-q-text').innerHTML = `<button id="quiz-listen-btn" onclick="speakQuizEnglishAudio('${engTextForAudio.replace(/'/g, "\\'")}')" class="submit-btn btn-blue" style="border-radius:50px;">🔊 英語をきく</button>`;
        if (isQuizVoiceAnswerType(answerType) && ('speechSynthesis' in window)) {
          quizEnglishAudioPending_ = true;
          armQuizEnglishAudioSafetyTimer_(20000);
          syncQuizAudioVoiceControls_();
        }
        setTimeout(() => speakText(engTextForAudio), 500);
      } else if (format === "en_to_en") {
        const safeText = qText || "";
        const clueLabel = (answerType === "initial_typing" || answerType === "initial_voice")
          ? "イニシャル"
          : (answerType === "sheet_fill_typing" || answerType === "sheet_fill_voice")
            ? "穴埋め"
            : "";
        if (isEnToEnClueAnswerType(answerType)) {
          const jaLine = String(q["日本語"] || "").trim();
          const clueBadge = clueLabel
            ? `<div style="font-size:14px;color:#90A4AE;margin-bottom:6px;">手がかり（${clueLabel}）</div>`
            : "";
          document.getElementById('quiz-q-text').innerHTML =
            (jaLine ? `<div style="font-size:clamp(26px,5.5vw,38px);font-weight:bold;margin-bottom:12px;line-height:1.45;">${escapeHtml(jaLine)}</div>` : "") +
            clueBadge +
            `<div style="font-size:clamp(22px,5vw,36px);font-weight:bold;letter-spacing:0.06em;line-height:1.45;color:#e8eaf0;">${escapeHtml(safeText)}</div>`;
        } else if (isEnToEnFlashAnswerType(answerType)) {
          enFlashCurrentEnglish = correctA;
          document.getElementById('quiz-q-text').innerHTML =
            buildEnFlashJaLineHtml_(q) +
            `<div id="en-flash-preview-text" class="en-flash-preview-text">${escapeHtml(correctA)}</div>`;
        } else {
          const clueBadge = clueLabel
            ? `<div style="font-size:14px;color:#90A4AE;margin-bottom:6px;">手がかり（${clueLabel}）</div>`
            : "";
          document.getElementById('quiz-q-text').innerHTML = clueBadge +
            `<div style="margin-bottom:8px;font-size:clamp(22px,5vw,36px);font-weight:bold;letter-spacing:0.06em;line-height:1.45;">${escapeHtml(safeText)}</div>` +
            `<button id="quiz-listen-btn" onclick="speakQuizEnglishAudio('${(correctA || "").replace(/'/g, "\\'")}')" class="submit-btn btn-blue" style="border-radius:50px;">🔊 英語をきく</button>`;
        }
      } else {
        document.getElementById('quiz-q-text').innerText = qText; 
      }

      document.getElementById('quiz-feedback').innerHTML = ""; 
      document.getElementById('quiz-next-btn').style.display = "none";
      
      const hintArea = document.getElementById('quiz-hint-area');
      const hintTextDisplay = document.getElementById('hint-display-text');
      const wordBlankArea = document.getElementById('quiz-word-blank-area');
      hintTextDisplay.style.display = "none"; hintTextDisplay.innerText = "";
      wordBlankArea.style.display = "none"; wordBlankArea.innerHTML = "";
      
      document.getElementById('hint-btn-2').innerText = isWord ? "💡 イニシャルと文字数を見る（-7 Pt）" : "💡 ヒントを見る（-7 Pt）";

      if (answerType === "4choice" || format.includes("en_to_ja") || format === "en_audio_to_ja" || isLegacyFillBlankAnswerType(answerType) || isEnToEnClueAnswerType(answerType) || isEnToEnFlashAnswerType(answerType)) {
        hintArea.style.display = "none";
      } else {
        hintArea.style.display = "flex";
        document.getElementById('hint-btn-1').disabled = false;
        document.getElementById('hint-btn-2').disabled = false;
        document.getElementById('hint-btn-3').disabled = false;
      }

      restoreQuizFeedbackLocation();
      const answerArea = document.getElementById('quiz-answer-area');
      answerArea.classList.remove('pen-mode-active');
      const quizSec = document.getElementById('section-quiz');
      if (quizSec) quizSec.classList.remove('pen-mode-active');
      answerArea.innerHTML = "";
      resetHandwritingInputState();
      if (!isEnToEnFlashAnswerType(answerType)) questionStartTime = Date.now();
      saveQuizRecoveryDraft(currentQuestionIndex);
      
      if (format === "ja_to_en_sort" && (answerType === "sort_all" || answerType === "sort_dummy" || answerType === "sort_missing")) {
        setupSortQuiz(q, answerType);
      }
      else if (answerType === "4choice") {
        let choices = [correctA]; 
        let others = currentQuestions.filter(item => { if(format === "ja_to_en" || format === "qtext_to_en" || format === "qaudio_to_en" || format === "en_audio_to_en" || format === "en_to_en") return (item["英単語"] || item["英文"]) !== correctA; else return item["日本語"] !== correctA; }).sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3 && i < others.length; i++) { choices.push((format === "ja_to_en" || format.includes("to_en")) ? (others[i]["英単語"] || others[i]["英文"]) : others[i]["日本語"]); }
        choices.sort(() => Math.random() - 0.5);
        choices.forEach(c => { const btn = document.createElement('button'); btn.innerText = c; btn.className = "choice-btn"; btn.onclick = () => checkAnswer(c, correctA, q); answerArea.appendChild(btn); });
      } 
      else if (isQuizFreeTypingAnswerType(answerType)) {
        if (isEnToEnFlashAnswerType(answerType)) {
          answerArea.innerHTML = `<button type="button" id="en-flash-start-btn" class="submit-btn btn-green en-flash-start-btn" onclick="startEnFlashAnswer()">回答を始める</button>`;
        } else {
          shiftMode = 0; isShiftHoldMode = false;
          answerArea.innerHTML = buildTypingInputAreaMarkup(false);
          if (inputMethodMode === 'pen') setPenMode('pen');
          mountTypingMethodBody(false);
          placeQuizFeedbackAboveKeyboard(answerArea);
        }
      }
      else if (isQuizVoiceAnswerType(answerType)) {
        if (isEnToEnFlashAnswerType(answerType)) {
          answerArea.innerHTML = `<button type="button" id="en-flash-start-btn" class="submit-btn btn-green en-flash-start-btn" onclick="startEnFlashAnswer()">回答を始める</button>`;
        } else {
          mountQuizVoiceAnswerArea_();
        }
      }
      else if (isLegacyFillBlankAnswerType(answerType)) {
        setupFillBlankQuiz(correctA, answerType);
      }
      syncQuizAudioVoiceControls_();
      updateSessionScoreDisplay();
    }

    function setupFillBlankQuiz(word, ansType) {
      const numBlanks = parseInt(document.getElementById('setting-blank-count').value) || 1;
      const wordBlankArea = document.getElementById('quiz-word-blank-area');
      const answerArea = document.getElementById('quiz-answer-area');
      
      wordBlankArea.style.display = "block";
      fillBlanksData = [];
      activeFillBlankIndex = 0;

      let availableIndices = [];
      for(let i=1; i<word.length; i++) {
        if(/[a-zA-Z]/.test(word[i])) availableIndices.push(i);
      }
      availableIndices.sort(() => Math.random() - 0.5);
      let hiddenIndices = availableIndices.slice(0, numBlanks).sort((a,b)=>a-b);

      let displayHtml = "";
      let blankCount = 0;

      for (let i=0; i<word.length; i++) {
        if (hiddenIndices.includes(i)) {
          displayHtml += `<span class="blank-box ${blankCount === 0 ? 'active' : ''}" id="fill-blank-${blankCount}" onclick="selectFillBlank(${blankCount})">_</span>`;
          fillBlanksData.push({ originalIndex: i, correctChar: word[i], userInput: '', uiIndex: blankCount });
          blankCount++;
        } else {
          displayHtml += `<span>${word[i]}</span>`;
        }
      }
      wordBlankArea.innerHTML = displayHtml;

      if (ansType === "fill_typing") {
        shiftMode = 0; isShiftHoldMode = false;
        answerArea.innerHTML = buildTypingInputAreaMarkup(true);
        if (inputMethodMode === 'pen') setPenMode('pen');
        mountTypingMethodBody(true);
        placeQuizFeedbackAboveKeyboard(answerArea);
      } else if (ansType === "fill_4choice") {
        answerArea.innerHTML = `
          <div id="fill-4choice-container" class="fill-choices"></div>
          <button id="fill-submit-btn" class="submit-btn btn-green" style="display:none; margin: 20px auto 0;" onclick="submitFillAnswer()">✨ これで回答する</button>
        `;
        renderFill4ChoiceButtons();
      }
    }

    function selectFillBlank(index) {
      document.querySelectorAll('.blank-box').forEach(b => b.classList.remove('active'));
      activeFillBlankIndex = index;
      document.getElementById(`fill-blank-${index}`).classList.add('active');
      
      const ansType = document.getElementById('setting-answer-type').value;
      if (ansType === "fill_4choice") {
        renderFill4ChoiceButtons();
      }
    }

    function renderFill4ChoiceButtons() {
      const container = document.getElementById('fill-4choice-container');
      container.innerHTML = "";
      
      let correctChar = fillBlanksData[activeFillBlankIndex].correctChar;
      let letters = "abcdefghijklmnopqrstuvwxyz";
      if (correctChar === correctChar.toUpperCase()) letters = letters.toUpperCase();
      
      let choices = [correctChar];
      while(choices.length < 4) {
        let r = letters[Math.floor(Math.random() * letters.length)];
        if(!choices.includes(r)) choices.push(r);
      }
      choices.sort(() => Math.random() - 0.5);

      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = "fill-choice-btn";
        btn.innerText = c;
        btn.onclick = () => { handleFillInput(c); };
        container.appendChild(btn);
      });
    }

    function handleFillInput(char) {
      fillBlanksData[activeFillBlankIndex].userInput = char;
      document.getElementById(`fill-blank-${activeFillBlankIndex}`).innerText = char;
      
      let nextIndex = fillBlanksData.findIndex(b => b.userInput === '');
      if (nextIndex !== -1) {
        selectFillBlank(nextIndex);
      } else {
        checkFillCompletion();
      }
    }

    function handleFillBackspace() {
      fillBlanksData[activeFillBlankIndex].userInput = '';
      document.getElementById(`fill-blank-${activeFillBlankIndex}`).innerText = "_";
      checkFillCompletion();
    }

    function checkFillCompletion() {
      const allFilled = fillBlanksData.every(b => b.userInput !== '');
      const submitBtn = document.getElementById('fill-submit-btn');
      if (submitBtn) {
        if (allFilled) {
          submitBtn.disabled = false;
          submitBtn.style.display = "block";
          submitBtn.classList.remove('btn-gray');
        } else {
          submitBtn.disabled = true;
          if (document.getElementById('setting-answer-type').value === "fill_4choice") {
            submitBtn.style.display = "none";
          }
        }
      }
    }

    function submitFillAnswer() {
      const q = filteredQuestions[currentQuestionIndex];
      let correctA = (q["英単語"] || q["英文"]).trim();
      
      let constructedAnswer = "";
      let fillIdx = 0;
      for(let i=0; i<correctA.length; i++) {
        let blankData = fillBlanksData.find(b => b.originalIndex === i);
        if (blankData) constructedAnswer += blankData.userInput;
        else constructedAnswer += correctA[i];
      }
      
      checkAnswer(constructedAnswer, correctA, q);
    }

    function useHint(type, penalty) {
      const q = filteredQuestions[currentQuestionIndex];
      const hintTextDisplay = document.getElementById('hint-display-text');
      const format = document.getElementById('setting-format').value;
      const isWord = currentModeName.includes("単語");
      maxDeduction = Math.max(maxDeduction, penalty);
      if (type !== 3) document.getElementById(`hint-btn-${type}`).disabled = true;
      if (type === 1 || type === 2) {
        let hintStr = "";
        if (type === 1) hintStr = q["イニシャル"] || "ヒントなし";
        else if (type === 2) hintStr = isWord ? (q["イニシャルと文字数"] || "ヒントなし") : (q["ヒント"] || q["イニシャルと文字数"] || "ヒントなし");
        hintTextDisplay.innerText = hintStr;
        hintTextDisplay.style.display = "block";
      } else if (type === 3) {
        let speakSrc = "";
        if (format === "ja_to_en_sort") speakSrc = q["英文"] || q["並び替え箇所"] || "";
        else if (format.includes("qtext") || format.includes("qaudio")) speakSrc = q["英文"];
        else speakSrc = q["英単語"] || q["英文"];
        speakText(speakSrc, 0.8);
      }
      updateSessionScoreDisplay();
    }
    function skipQuestion() {
      const q = filteredQuestions[currentQuestionIndex];
      const format = document.getElementById('setting-format').value;
      checkAnswer("[スキップしました]", getCorrectAnswerForQuestion(q, format), q);
    }

    function checkAnswer(userA, correctA, q) {
      document.body.classList.add('quiz-answer-submitting');
      document.querySelectorAll('#section-quiz button').forEach(function (b) {
        if (b.closest('#keyboard-container') && !b.classList.contains('key-action')) return;
        b.disabled = true;
      });
      let advanceScheduled = false;
      let resultRecorded = false;
      try {
        const format = document.getElementById('setting-format').value;
        const ansType = getActiveQuizAnswerType();
        const isWord = currentModeName.includes("単語");

        let resolvedCorrect = correctA;
        if (resolvedCorrect == null || (typeof resolvedCorrect === "string" && resolvedCorrect.trim() === "")) {
          resolvedCorrect = getCorrectAnswerForQuestion(q, format);
        }

        let isCorrect = false;
        if (format === "ja_to_en_sort") {
          resolvedCorrect = getSortPrimaryCorrectDisplay(q);
          isCorrect = isSortAnswerCorrect(userA, q);
        } else {
          const userVariants = expandTextVariants(userA).map(t => normalizeText(t));
          const correctVariants = expandTextVariants(resolvedCorrect).map(t => normalizeText(t));
          const correctSet = new Set(correctVariants);
          isCorrect = userVariants.some(u => correctSet.has(u));
        }
        const basePoint = computeQuizBasePoint(format, ansType, isWord);

        quizResults.push({ questionId: q["通し番号"], isCorrect: isCorrect, timeSec: Math.round((Date.now() - questionStartTime) / 1000), basePoint: basePoint, maxDeduction: maxDeduction });
        resultRecorded = true;
        saveQuizRecoveryDraft(currentQuestionIndex + 1);
        const feedback = document.getElementById('quiz-feedback');

        document.getElementById('quiz-word-blank-area').style.display = "none";

        const isSkip = userA === "[スキップしました]";
        const fillFeedback = isLegacyFillBlankAnswerType(ansType);
        if (!isSkip) playAnswerSound(isCorrect);
        let plusLine = "";
        if (isCorrect && !isSkip) {
          const mult = computePointsMultiplierClient();
          const sheetPct = parseUnitSheetPointPercentClient(currentUnitName);
          const rawBefore = rawPointsFromQuizResults(quizResults.slice(0, -1));
          const rawAfter = rawPointsFromQuizResults(quizResults);
          const eBefore = applySessionEarnedFromRaw(rawBefore, mult, sheetPct);
          const eAfter = applySessionEarnedFromRaw(rawAfter, mult, sheetPct);
          const d = Math.round((eAfter - eBefore) * 100) / 100;
          if (d > 0) plusLine = `<p class="quiz-feedback-points-plus">＋${formatPointDisplayNum(d)}点</p>`;
        }
        let feedbackUserA = userA;
        let feedbackCorrect = resolvedCorrect;
        if (format === "ja_to_en_sort" && !isSkip) {
          feedbackUserA = formatSortUserAnswerForDisplay(userA);
          feedbackCorrect = formatSortSentenceForDisplay(resolvedCorrect);
        }
        feedback.innerHTML = buildFeedbackContentHtml(feedbackUserA, feedbackCorrect, isCorrect, isSkip, computeEffectiveDeduction_(basePoint, maxDeduction), fillFeedback && !isSkip, ansType, plusLine);
        updateSessionScoreDisplay();
        if (isQuizFreeTypingAnswerType(ansType) || ansType === "fill_typing" || format === "ja_to_en_sort") {
          requestAnimationFrame(() => {
            try { feedback.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
          });
        }

        if (format === "ja_to_en_sort") destroySortQuizIfAny();
        const speakLine = (format === "ja_to_en_sort" && q["英文"]) ? q["英文"] : String(resolvedCorrect ?? "");
        const speakLang = (format === "en_to_ja" || format === "en_audio_to_ja") ? "ja" : "en";
        speakText(String(speakLine), 0.9, speakLang);
        advanceScheduled = true;
      } catch (e) {
        console.error(e);
        try { if (document.getElementById('setting-format') && document.getElementById('setting-format').value === 'ja_to_en_sort') destroySortQuizIfAny(); } catch (_) {}
        const feedback = document.getElementById('quiz-feedback');
        try { document.getElementById('quiz-word-blank-area').style.display = "none"; } catch (_) {}
        if (feedback) {
          feedback.innerHTML = `<span style='color:#F44336;font-size:30px;font-weight:bold;'>⚠️ エラー</span><br><span style="font-size:18px;">「つぎへ」でつづけてね。</span>`;
        }
        if (!resultRecorded) {
          try {
            const format = document.getElementById('setting-format').value;
            const ansType = getActiveQuizAnswerType();
            const isWord = currentModeName.includes("単語");
            const basePoint = computeQuizBasePoint(format, ansType, isWord);
            quizResults.push({ questionId: q["通し番号"], isCorrect: false, timeSec: Math.round((Date.now() - questionStartTime) / 1000), basePoint: basePoint, maxDeduction: maxDeduction });
            saveQuizRecoveryDraft(currentQuestionIndex + 1);
          } catch (_) {
            quizResults.push({ questionId: q["通し番号"] || 0, isCorrect: false, timeSec: 0, basePoint: 0, maxDeduction: 0 });
            saveQuizRecoveryDraft(currentQuestionIndex + 1);
          }
        }
        updateSessionScoreDisplay();
        advanceScheduled = true;
      } finally {
        setPenTypingSubmitBusy(false);
        const nextBtn = document.getElementById('quiz-next-btn');
        nextBtn.disabled = false;
        nextBtn.style.display = "block";
        document.querySelectorAll('#section-quiz .cancel-btn').forEach(btn => btn.disabled = false);
        if (advanceScheduled) {
          clearTimeout(autoNextTimer);
          autoNextTimer = setTimeout(() => { nextQuestion(); }, 3000);
        }
      }
    }

    function nextQuestion() {
      clearTimeout(autoNextTimer);
      cancelVoiceRecognitionPendingStart_();
      stopEnglishRecognitionSafely_(null);
      window.speechSynthesis.cancel();
      resetQuizAudioVoiceMutex_();
      resetEnFlashQuestionState_();
      resetHandwritingInputState();
      currentQuestionIndex++;
      showQuestion();
    }
    function quitQuiz() {
      clearTimeout(autoNextTimer);
      if (recognition) { try { recognition.stop(); } catch (_) {} }
      window.speechSynthesis.cancel();
      resetQuizAudioVoiceMutex_();
      resetEnFlashQuestionState_();
      resetHandwritingInputState();
      document.body.classList.remove('quiz-answer-submitting');
      const secQuizReset = document.getElementById('section-quiz');
      const ansAreaReset = document.getElementById('quiz-answer-area');
      if (secQuizReset) secQuizReset.classList.remove('pen-mode-active');
      if (ansAreaReset) ansAreaReset.classList.remove('pen-mode-active');
      openSettingsScreen();
    }
    
    function finishQuiz() {
      resetResultScreenActionButtons();
      document.body.classList.remove('kanji-study-mode');
      const secQuizFinish = document.getElementById('section-quiz');
      const ansAreaFinish = document.getElementById('quiz-answer-area');
      if (secQuizFinish) secQuizFinish.classList.remove('pen-mode-active');
      if (ansAreaFinish) ansAreaFinish.classList.remove('pen-mode-active');
      switchSection('section-result', { forceEnglishResult: true });
      document.getElementById('result-content').innerHTML = buildLocalFinishQuizSummaryHtml("結果を保存しています…");
      document.getElementById('result-retry-btn').style.display = "none"; document.getElementById('result-settings-btn').style.display = "none"; document.getElementById('result-home-btn').style.display = "none";
      (function () {
        var __kb = document.getElementById('result-kanji-same-book-btn');
        var __ko = document.getElementById('result-kanji-other-book-btn');
        if (__kb) __kb.style.display = "none";
        if (__ko) __ko.style.display = "none";
      })();

      const user = getAppKidUser_();
      if (!user || !user.id) {
        document.getElementById('result-content').innerHTML = `<h2 style="color:#F44336;">ログイン情報が見つかりません</h2><p>ホームにもどってから再ログインしてください。</p>`;
        bindEnglishResultButtonHandlers();
        document.getElementById('result-home-btn').style.display = "block";
        return;
      }
      const meta = getEnglishQuizSessionMeta();
      const orderEl = document.getElementById('setting-order');
      const isRandom = meta.isRandom != null ? meta.isRandom : (orderEl ? orderEl.value === 'random' : false);
      const isReviewMode = meta.isReviewMode != null ? meta.isReviewMode : currentIsReviewMode;
      const detailedUnitId = meta.detailedUnitId || getDetailedUnitId();
      const unitSheetName = meta.unitSheetName || currentUnitName;
      const expectedCount = Array.isArray(filteredQuestions) ? filteredQuestions.length : 0;
      let resultsToSend = slimQuizResultsForSave(Array.isArray(quizResults) ? quizResults.slice() : []);
      if (expectedCount > 0 && resultsToSend.length > expectedCount) {
        console.warn("quizResults が問題数を超えています。集計用に先頭", expectedCount, "件に切り詰めます。", resultsToSend.length);
        resultsToSend = resultsToSend.slice(0, expectedCount);
      }
      const sessionSubmitId = buildQuizSessionSubmitId(user.id, detailedUnitId, resultsToSend);

      let payload = {
        action: "save_learning_session",
        userId: user.id,
        unitId: detailedUnitId,
        unitSheetName: unitSheetName,
        isReviewMode: isReviewMode,
        isRandom: isRandom,
        results: resultsToSend,
        sessionSubmitId: sessionSubmitId
      };
      if (isTrainingMode) {
        payload.trainingStepIndex = currentTrainingStepIndex;
        payload.trainingMenuId = currentTrainingMenuId;
      }

      let submitInFlight = false;
      let submitSucceeded = false;
      let lastSuccessData = null;

      // 失敗時に同じペイロードで再送できるよう、ボタンから呼ぶ用のリトライ関数。
      window.__retryFinishQuizSubmit = function () {
        if (submitSucceeded && lastSuccessData) {
          applySuccessResult(lastSuccessData);
          return;
        }
        if (submitInFlight) return;
        document.getElementById('result-content').innerHTML = buildLocalFinishQuizSummaryHtml("結果を保存しています…（再送）");
        document.getElementById('result-retry-btn').style.display = "none";
        document.getElementById('result-settings-btn').style.display = "none";
        document.getElementById('result-home-btn').style.display = "none";
        (function () {
          var __kb = document.getElementById('result-kanji-same-book-btn');
          var __ko = document.getElementById('result-kanji-other-book-btn');
          if (__kb) __kb.style.display = "none";
          if (__ko) __ko.style.display = "none";
        })();
        doSubmit();
      };

      function showSubmitError(title, detailHtml, allowRetry) {
        const safeTitle = escapeHtml(String(title || "エラー"));
        document.getElementById('result-content').innerHTML =
          buildLocalFinishQuizSummaryHtml("") +
          `<h2 style="color:#F44336;margin-top:14px;">⚠️ ${safeTitle}</h2>` +
          (detailHtml || "") +
          `<p style="margin-top:8px;">上の得点はこの端末での計算です。サーバー保存が完了していない場合は「もういちど結果を送る」をお試しください（同じ内容なら二重付与されません）。</p>` +
          `<p style="margin-top:8px;font-size:13px;color:#888;">回答ログは <strong>「ホームにもどる」</strong> 後の復帰データに保存されています。ホームを開くと未送信の結果を自動で再送します。</p>`;
        bindEnglishResultButtonHandlers({
          retryOnclick: allowRetry ? function () { window.__retryFinishQuizSubmit(); } : undefined
        });
        document.getElementById('result-home-btn').style.display = "block";
        if (allowRetry) {
          const retryBtn = document.getElementById('result-retry-btn');
          if (retryBtn) {
            retryBtn.style.display = "block";
            retryBtn.innerText = "🔁 もういちど結果を送る";
          }
        }
      }

      function renderFinishQuizSuccessHtml(d) {
        let bonusMsg = "";
        if (currentIsReviewMode) bonusMsg += `<p style="color:#FF9800;font-weight:bold;margin:5px 0;">🔥 ニガテ特訓ボーナス適用</p>`;
        if (d.bonusApplied) bonusMsg += `<p style="color:#e50914;font-weight:bold;margin:5px 0;">🎲 ランダム出題ボーナス（10%UP）</p>`;
        if (isTrainingMode) bonusMsg += `<p style="color:#9C27B0;font-weight:bold;margin:5px 0;">🎯 特訓ルートクリア！</p>`;
        if (d.sheetPointPercent != null && Number(d.sheetPointPercent) < 100) {
          var labelTry = "";
          try { labelTry = formatUnitSheetDisplayLabel(currentUnitName) || ""; } catch (_) { labelTry = String(currentUnitName || ""); }
          bonusMsg += `<p style="color:#90CAF9;font-size:15px;margin:6px 0;">📎 ${escapeHtml(labelTry)} のため、かくとくポイントは <strong>${d.sheetPointPercent}%</strong> になっています。</p>`;
        }
        if (d.alreadyProcessed) {
          bonusMsg += `<p style="color:#FF9800;font-size:13px;margin:6px 0;">※ すでに保存済みの結果を表示しています（ポイントの二重付与はしていません）。</p>`;
        }
        if (d.dailyLimitChars && d.dailyLimitChars.length > 0) {
          var dlChars = d.dailyLimitChars.map(function (c) { return "「" + escapeHtml(c) + "」"; }).join(" ");
          bonusMsg += `<p style="color:#FFD54F;font-size:13px;margin:6px 0;">📋 ${dlChars} は今日のポイント上限（2 回/日）に達しました。あす 0 時にリセットされます。</p>`;
        }
        const correctCount = resultsToSend.filter(function (r) { return r && r.isCorrect; }).length;
        const totalCount = expectedCount || resultsToSend.length;
        const earnedTxt = escapeHtml(String(d.earnedPoints != null ? d.earnedPoints : 0));
        const totalTxt = escapeHtml(String(d.newTotal != null ? d.newTotal : user.points || 0));
        const scoreSummary = `<p style="font-size:15px;color:#bbb;margin:8px 0;">正解 ${correctCount} / ${totalCount} 問</p>`;
        return `<h2 style="color:#4CAF50;">✨ おつかれさま！ ✨</h2>` + bonusMsg + scoreSummary +
          `<p>かくとくポイント: <span style="color:gold;font-size:30px;">+${earnedTxt}</span></p>` +
          `<hr style="border-color:#444;"><p>合計ポイント: ${totalTxt}</p>`;
      }

      function mergeFinishQuizUserCache(d) {
        if (d.newTotal != null) user.points = d.newTotal;
        if (!user.historyJson) user.historyJson = {};
        if (d.historyUnitId && d.historyUnitPatch) {
          mergeHistoryUnitPatchClient(user, d.historyUnitId, d.historyUnitPatch);
        } else if (d.historyJson) {
          user.historyJson = d.historyJson;
        }
        if (d.kanjiChallengeChar && d.kanjiChallengePatch) {
          mergeKanjiChallengePatchClient(d.kanjiChallengeChar, d.kanjiChallengePatch);
          if (user.historyJson && user.historyJson.__kanjiChallenge) {
            delete user.historyJson.__kanjiChallenge[d.kanjiChallengeChar];
            if (Object.keys(user.historyJson.__kanjiChallenge).length === 0) {
              delete user.historyJson.__kanjiChallenge;
            }
          }
        }
        if (d.lastStudyKey && d.lastStudyAt) {
          if (!user.lastStudyJson) user.lastStudyJson = {};
          user.lastStudyJson[d.lastStudyKey] = d.lastStudyAt;
        }
        if (d.dailyPointsJson) user.dailyPointsJson = d.dailyPointsJson;
        if (d.trainingProgressJson) {
          user.trainingProgressJson = d.trainingProgressJson;
          if (isTrainingMode || currentTrainingMenuId) {
            invalidateTrainingRouteCache(currentTrainingMenuId);
            applyLocalTrainingProgress(d.trainingProgressJson, currentTrainingMenuId);
          }
        }
        try {
          saveAppKidUserToLocal(user);
        } catch (eUserSave) {
          console.warn("user info update failed (points were saved on server):", eUserSave);
        }
        const ptsEl = document.getElementById('user-points');
        if (ptsEl && d.newTotal != null) ptsEl.innerText = String(d.newTotal);
      }

      function applySuccessResult(d) {
        submitSucceeded = true;
        lastSuccessData = d;
        const wasTrainingMode = isTrainingMode;
        const trainingReturnMenuId = currentTrainingMenuId;
        const resultEl = document.getElementById('result-content');
        if (resultEl) resultEl.innerHTML = renderFinishQuizSuccessHtml(d);
        mergeFinishQuizUserCache(d);
        clearQuizRecoveryDraft();

        (function () {
          var __kb = document.getElementById('result-kanji-same-book-btn');
          var __ko = document.getElementById('result-kanji-other-book-btn');
          if (__kb) __kb.style.display = "none";
          if (__ko) __ko.style.display = "none";
        })();

        const retryBtn = document.getElementById('result-retry-btn');
        const settingsBtn = document.getElementById('result-settings-btn');
        if (!wasTrainingMode) {
          if (retryBtn) {
            retryBtn.style.display = "block";
            retryBtn.innerText = "🔄 もう一度やる";
          }
          if (settingsBtn) settingsBtn.style.display = "block";
          bindEnglishResultButtonHandlers();
        } else {
          if (retryBtn) retryBtn.style.display = "none";
          if (settingsBtn) {
            settingsBtn.style.display = "block";
            settingsBtn.innerText = "🎯 特訓ルートにもどる";
          }
          bindEnglishResultButtonHandlers({
            retryOnclick: null,
            settingsOnclick: function () {
              returnToCurrentTrainingMenuRoute({ menuId: trainingReturnMenuId, invalidateCache: false });
            },
            homeOnclick: function () {
              cancelTrainingRouteAutoReturn();
              showHome(JSON.parse(localStorage.getItem("app_kid_user")));
            }
          });
          scheduleTrainingRouteAutoReturn(2200, trainingReturnMenuId);
        }
        const homeBtn = document.getElementById('result-home-btn');
        if (homeBtn) homeBtn.style.display = "block";
      }

      function doSubmit() {
        if (submitSucceeded && lastSuccessData) {
          applySuccessResult(lastSuccessData);
          return;
        }
        if (submitInFlight) return;
        submitInFlight = true;

        gasApiFetchText(payload, { retries: 4, timeoutMs: 120000, xhrFallback: true })
          .then(function (res) {
            try {
              const httpStatus = res.status;
              const rawText = String(res.text || "");
              const d = gasApiParseJsonResponse(res);
              if (!d) {
                console.error("save_learning_session: 非JSON応答 status=" + httpStatus, rawText.slice(0, 500));
                savePendingFinishQuizPayload(payload);
                showSubmitError(
                  "サーバー応答が読めませんでした",
                  `<p style="font-size:13px;color:#666;">HTTP ${httpStatus}。<br>結果は端末に一時保存しました。ホームを開くと自動で再送します。</p>`,
                  true
                );
                return;
              }
              if (d.status === "success") {
                clearPendingFinishQuizPayload();
                if (sessionSubmitId) rememberFlushedSubmitId(sessionSubmitId);
                try {
                  applySuccessResult(d);
                } catch (eApply) {
                  console.error("結果表示中にエラー（保存自体は成功）:", eApply);
                  submitSucceeded = true;
                  lastSuccessData = d;
                  clearQuizRecoveryDraft();
                  const resultEl = document.getElementById('result-content');
                  if (resultEl) {
                    resultEl.innerHTML = renderFinishQuizSuccessHtml(d) +
                      `<p style="color:#FF9800;font-size:12px;">（表示の途中で軽微なエラーがありましたが、保存は完了しました。）</p>`;
                  }
                  try { mergeFinishQuizUserCache(d); } catch (_) {}
                  bindEnglishResultButtonHandlers();
                  const homeBtn = document.getElementById('result-home-btn');
                  if (homeBtn) homeBtn.style.display = "block";
                  (function () {
                    var __kb = document.getElementById('result-kanji-same-book-btn');
                    var __ko = document.getElementById('result-kanji-other-book-btn');
                    if (__kb) __kb.style.display = "none";
                    if (__ko) __ko.style.display = "none";
                  })();
                }
                return;
              }
              console.error("save_learning_session error:", d);
              savePendingFinishQuizPayload(payload);
              const detail = `<p style="font-size:13px;color:#666;">${escapeHtml(String(d.message || "サーバーが error を返しました。"))}<br>ホームを開くと自動で再送します。</p>`;
              showSubmitError("結果の保存に失敗しました", detail, true);
            } catch (eHandler) {
              console.error("save_learning_session handler error:", eHandler);
              savePendingFinishQuizPayload(payload);
              showSubmitError(
                "結果の表示中にエラーが発生しました",
                `<p style="font-size:13px;color:#666;">${escapeHtml(String((eHandler && eHandler.message) || eHandler || ""))}<br>保存処理は続行できます。「もういちど結果を送る」をお試しください。</p>`,
                true
              );
            }
          })
          .catch(function (e) {
            console.error("save_learning_session network/parse error:", e);
            savePendingFinishQuizPayload(payload);
            const netMsg = String((e && (e.message || e)) || "");
            let netHint;
            if (/non-JSON|Unexpected token|JSON/i.test(netMsg)) {
              netHint = "サーバーから想定外の応答が返りました。ページを再読み込みしてから「もういちど結果を送る」をお試しください。";
            } else if (/timeout|aborted|AbortError/i.test(netMsg)) {
              netHint = "サーバーへの応答が時間切れになりました。回線が遅いときやサーバーが混み合っているときに起きます。ページを再読み込みしてから「もういちど結果を送る」をお試しください。";
            } else if (/Load failed|Failed to fetch|NetworkError|XHR|CORS|socket/i.test(netMsg)) {
              netHint = "ブラウザがサーバーへ接続できませんでした。ページを再読み込み（スーパーリロード）してから、もう一度「もういちど結果を送る」をお試しください。";
            } else {
              netHint = "結果の送信が完了しなかった可能性があります。（" + netMsg + "）";
            }
            showSubmitError(
              "通信エラー",
              `<p>${escapeHtml(netHint)}<br>結果は端末に一時保存しました。ホームを開くと自動で再送します。</p>`,
              true
            );
          })
          .finally(function () {
            submitInFlight = false;
          });
      }

      doSubmit();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') syncAllStopwatchesToServer(true);
    });
    window.addEventListener('pagehide', function () {
      syncAllStopwatchesToServer(true);
    });

    document.addEventListener('keydown', (e) => {
      if (handleKanjiYomiPhysicalKeydown_(e)) return;

      const answerInput = document.getElementById('type-answer');
      const quizSection = document.getElementById('section-quiz');
      if (!quizSection || !quizSection.classList.contains('active')) return;
      if (isQuizAnswerSubmitting()) return;
      if (e.isComposing || e.key === 'Process') return;

      const ansType = getActiveQuizAnswerType();

      if (isQuizFreeTypingAnswerType(ansType) && answerInput) {
        if (inputMethodMode === 'pen') return;
        if (['Enter', 'Backspace', ' ', 'Shift'].includes(e.key) || (e.key.length === 1 && /^[\x20-\x7E¥]$/.test(e.key))) { e.preventDefault(); }
        if (e.key === 'Enter') { const enterBtn = Array.from(document.querySelectorAll('.key-action')).find(btn => btn.innerText === "けってい"); if (enterBtn && !enterBtn.disabled) enterBtn.click(); } 
        else if (e.key === 'Backspace') { answerInput.value = answerInput.value.slice(0, -1); } 
        else if (e.key === ' ') { answerInput.value += ' '; } 
        else if (e.key.length === 1 && /^[\x20-\x7E¥]$/.test(e.key)) { answerInput.value += e.key; }
      }
      else if (ansType === "fill_typing") {
        if (inputMethodMode === 'pen') return;
        if (['Enter', 'Backspace', ' ', 'Shift'].includes(e.key) || (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key))) { e.preventDefault(); }
        if (e.key === 'Enter') { const enterBtn = document.getElementById('fill-submit-btn'); if (enterBtn && !enterBtn.disabled) enterBtn.click(); }
        else if (e.key === 'Backspace') { handleFillBackspace(); }
        else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) { handleFillInput(e.key); }
      }
    });