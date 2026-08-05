// ▼ GASのURLを貼り付けてください（※前回と同じURLならそのままで大丈夫） ▼
    const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyfD4P7uj4MhlTkBe0RlazHG40eHerBMkj6EmJpe3dcMraNKg-rekdJ0rcyZ4aOUYfIqA/exec";
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
      if (!d || d.status !== "success" || !d.settings) return false;
      appSettings = d.settings;
      try { localStorage.setItem("app_cached_settings", JSON.stringify(d)); } catch (_e) {}
      try { persistKanjiHandScoreWeightsFromSettings(d.settings); } catch (_e2) {}
      return true;
    }
