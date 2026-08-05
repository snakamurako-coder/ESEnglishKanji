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

    window.onload = () => { 
        const saved = localStorage.getItem('app_kid_user'); 
        if (inputMethodMode !== 'pen' && inputMethodMode !== 'keyboard') inputMethodMode = 'keyboard';
        try { initKeyboardAndSoundSettings(); } catch (_eInit) {}
        try { applyKanjiHwDominantHandToBody(); } catch (_eHand) {}
        try { syncKanjiHwHandSwitchUI(); } catch (_eHandUi) {}
        if (saved) {
          try {
            const user = JSON.parse(saved);
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
        }
        return d; 
      }).catch(function () {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const d = JSON.parse(cached);
            appSettings = d.settings;
            return d;
          } catch(e) {}
        }
        return { status: "error" };
      }); 
    }

    const LS_KBD_SCALE = 'vk_scale_pct';
    const LS_KBD_FONT = 'vk_key_font_px';
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
