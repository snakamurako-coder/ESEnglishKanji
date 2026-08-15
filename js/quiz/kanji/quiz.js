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

    function openKanjiNigateSection() {
      initKanjiPracticeCatalog();
      initKanjiHandAnalyticsBridge();
      initKanjiParentKanjiQuizScoredBridge();
      setTimeout(function () {
        syncKnSelectorsFromKp();
        const kna = document.getElementById("kn-nigate-axis");
        if (kna) {
          const fmt = getKanjiQuizFormatMode();
          if (fmt === "write_kanji") kna.value = "ruby_to_kanji";
          else if (fmt === "select_kana") kna.value = "okurigana_shift";
          else if (fmt === "type_yomi") kna.value = "sentence_to_ruby";
          else kna.value = "ruby_to_kanji";
        }
        switchSection("section-kanji-nigate");
      }, 120);
    }
    function mapNigateAxisToKanjiQuizFormatMode(axis) {
      const m = String(axis || "");
      if (m === "ruby_to_kanji" || m === "stroke_order" || m === "brush") return "write_kanji";
      if (m === "okurigana_shift" || m === "select_kana") return "select_kana";
      if (m === "sentence_to_ruby" || m === "reading" || m === "type_yomi") return "type_yomi";
      return "write_kanji";
    }
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
      if (!modeId || !unitName) {
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
          unitName: unitName,
          setIds: setIds,
          nigateAxis: nigateAxis,
          passRequired: 3,
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
            unitName: unitName,
            setId: setVal === "__ALL__" ? "ALL" : setVal,
            questions: d.questions,
            nigateBypassFilter: true,
            nigateTraining: true,
            nigateAxis: d.trainMode || nigateAxis,
            nigatePassRequired: d.passRequired || 3,
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
        var d = ev.data;
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
      const need = passRequired || kanjiQuizSession.nigatePassRequired || 3;
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
          passRequired: kanjiQuizSession.nigatePassRequired || 3
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
      const passRequired = kanjiQuizSession.nigatePassRequired || 3;
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
    }
    /** 漢字練習画面用: iframe 採点メッセージの受け口は initKanjiParentKanjiQuizScoredBridge と共有 */
    function initKanjiPracticeScoreListener() {
      initKanjiParentKanjiQuizScoredBridge();
      initKanjiHandAnalyticsBridge();
    }
    function openKanjiPracticePro() {
      const frame = document.getElementById('kp-pro-frame');
      if (!frame) {
        try { alert("高機能モードの読み込みに失敗しました。"); } catch (_e) {}
        return;
      }
      const KP_EMBED_VER = "8";
      const KP_SRC = "assets/kp-practice.html";
      if (frame.dataset.kpEmbedVer !== KP_EMBED_VER) {
        frame.dataset.kpLoaded = "";
        frame.dataset.kpEmbedVer = KP_EMBED_VER;
      }
      if (frame.dataset.kpLoaded === "1") {
        syncKanjiHandScoreWeightsToFrame(frame);
        patchKanjiFrameForQuizPostMessage(frame);
        kpResizeFrameToContent();
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
        try {
          alert("高機能モードの読み込みに失敗しました。" + (detail ? "\n（" + detail + "）" : ""));
        } catch (_eA) {}
      }
      function markReady() {
        if (settled) return;
        settled = true;
        frame.dataset.kpLoading = "";
        frame.dataset.kpLoaded = "1";
        syncKanjiHandScoreWeightsToFrame(frame);
        patchKanjiFrameForQuizPostMessage(frame);
        kpResizeFrameToContent();
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
        if (frame.dataset.kpLoaded === "1") kpResizeFrameToContent();
      }, 700);
    }
    function kpResizeFrameToContent() {
      const frame = document.getElementById('kp-pro-frame');
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
        const doc = frame.contentWindow.document;
        const bodyH = doc.body ? doc.body.scrollHeight : 0;
        const htmlH = doc.documentElement ? doc.documentElement.scrollHeight : 0;
        const h = kpComputeFrameHeight_(frame, bodyH, htmlH);
        frame.style.height = `${h}px`;
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
            const nextH = kpComputeFrameHeight_(frame, bH, dH);
            frame.style.height = `${nextH}px`;
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
        kpRenderBookSelect();
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
      const kpSearchEl = document.getElementById('kp-search-input');
      const q = ((kpSearchEl && kpSearchEl.value) || "").trim().toLowerCase();
      const list = (kpCatalogState.setQuestions || []).filter(item => {
        const k = String(item.kanji || "");
        const fromNew = String(item.searchText || "").toLowerCase();
        const readings = (Array.isArray(item.readings) ? item.readings : [])
          .map(r => `${r.reading || ""} ${(Array.isArray(r.examples) ? r.examples.join(" ") : "")}`)
          .join(" ")
          .toLowerCase();
        const hay = fromNew || `${k} ${readings}`;
        if (!q) return true;
        return k.toLowerCase().includes(q) || hay.includes(q);
      }).map(item => String(item.kanji || "")).filter(Boolean);
      kpCatalogState.filteredChars = list;
      kpRenderTiles(list);
      setKpStatus(`${list.length} 件表示中 / セット内 ${(kpCatalogState.setQuestions || []).length} 問`);
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
    function kpSelectPracticeChar(ch) {
      const frame = document.getElementById('kp-pro-frame');
      if (!frame || !frame.contentWindow) return;
      try {
        const doc = frame.contentWindow.document;
        const sel = doc.getElementById('target-kanji');
        if (!sel) return;
        const has = Array.from(sel.options || []).some(o => String(o.value) === String(ch));
        if (!has) {
          setKpStatus(`「${ch}」は筆順データ（KanjiVG）未登録です。`);
          return;
        }
        sel.value = ch;
        if (typeof frame.contentWindow.initTargetKanji === "function") frame.contentWindow.initTargetKanji();
        if (typeof frame.contentWindow.switchMode === "function") frame.contentWindow.switchMode("score");
        kpResizeFrameToContent();
        setKpStatus(`練習対象を「${ch}」に切替えました。`);
      } catch (_) {
        setKpStatus("練習対象の切替に失敗しました。");
      }
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
      const isJukugo = o.sheetKind === "jukugo" || getKanjiQuizFormatMode() === "jukugo_yomi";
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
          }, { timeout: 2500 });
        } else {
          setTimeout(function () {
            try { ensureKanjiHwFrameReadyOnce(); } catch (_) {}
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
    /** 形4項目は shapeBudget 内の比率。strokeCount/strokeOrder は100点中の絶対点 */
    const KANJI_HW_SHAPE_WEIGHT_DEFAULTS = {
      trajectory: 0.4,
      startEnd: 0.15,
      structure: 0.2,
      size: 0.25
    };
    const KANJI_HW_SHAPE_WEIGHT_KEYS = ["trajectory", "startEnd", "structure", "size"];
    const KANJI_HW_GATE_WEIGHT_DEFAULTS = { strokeCount: 10, strokeOrder: 20 };
    const KANJI_HW_SCORE_WEIGHT_KEYS = ["trajectory", "startEnd", "structure", "size", "strokeCount", "strokeOrder"];
    const KANJI_HW_SCORE_WEIGHT_DEFAULTS = Object.assign({}, KANJI_HW_SHAPE_WEIGHT_DEFAULTS, KANJI_HW_GATE_WEIGHT_DEFAULTS);
    function parseKanjiHandScoreWeightSetting_(val, fallbackRatio) {
      if (val === undefined || val === null || String(val).trim() === "") return fallbackRatio;
      const n = Number(val);
      if (isNaN(n) || n < 0) return fallbackRatio;
      return n > 1 ? n / 100 : n;
    }
    /** ゲート点（0〜100の絶対点）。設定が比率(≦1)なら×100 */
    function parseKanjiHandScoreGatePoints_(val, fallbackPts) {
      if (val === undefined || val === null || String(val).trim() === "") return fallbackPts;
      const n = Number(val);
      if (isNaN(n) || n < 0) return fallbackPts;
      const pts = n <= 1 ? n * 100 : n;
      return Math.max(0, Math.min(100, pts));
    }
    function normalizeKanjiHandScoreWeights_(raw) {
      function gateFromRaw_(ptsKey, altKey, fallback) {
        if (raw[ptsKey] != null && String(raw[ptsKey]).trim() !== "" && !isNaN(Number(raw[ptsKey]))) {
          return Math.max(0, Math.min(100, Number(raw[ptsKey])));
        }
        if (raw[altKey] != null && String(raw[altKey]).trim() !== "") {
          return parseKanjiHandScoreGatePoints_(raw[altKey], fallback);
        }
        return fallback;
      }
      const countPts = gateFromRaw_("strokeCountPts", "strokeCount", KANJI_HW_GATE_WEIGHT_DEFAULTS.strokeCount);
      const orderPts = Math.min(
        100 - countPts,
        gateFromRaw_("strokeOrderPts", "strokeOrder", KANJI_HW_GATE_WEIGHT_DEFAULTS.strokeOrder)
      );
      const shapeBudget = Math.max(0, 100 - countPts - orderPts);
      let t = Number(raw.trajectory) || 0;
      let se = Number(raw.startEnd) || 0;
      let st = Number(raw.structure) || 0;
      let sz = Number(raw.size) || 0;
      let sum = t + se + st + sz;
      if (sum <= 0) {
        t = KANJI_HW_SHAPE_WEIGHT_DEFAULTS.trajectory;
        se = KANJI_HW_SHAPE_WEIGHT_DEFAULTS.startEnd;
        st = KANJI_HW_SHAPE_WEIGHT_DEFAULTS.structure;
        sz = KANJI_HW_SHAPE_WEIGHT_DEFAULTS.size;
        sum = t + se + st + sz;
      }
      return {
        strokeCountPts: countPts,
        strokeOrderPts: orderPts,
        shapeBudget: shapeBudget,
        trajectory: t / sum,
        startEnd: se / sum,
        structure: st / sum,
        size: sz / sum
      };
    }
    function buildKanjiHandScoreWeightsFromSettings_(settings) {
      const src = settings && typeof settings === "object" ? settings : {};
      const raw = {
        trajectory: parseKanjiHandScoreWeightSetting_(src.trajectory, KANJI_HW_SHAPE_WEIGHT_DEFAULTS.trajectory),
        startEnd: parseKanjiHandScoreWeightSetting_(src.startEnd, KANJI_HW_SHAPE_WEIGHT_DEFAULTS.startEnd),
        structure: parseKanjiHandScoreWeightSetting_(src.structure, KANJI_HW_SHAPE_WEIGHT_DEFAULTS.structure),
        size: parseKanjiHandScoreWeightSetting_(src.size, KANJI_HW_SHAPE_WEIGHT_DEFAULTS.size),
        strokeCountPts: parseKanjiHandScoreGatePoints_(src.strokeCount, KANJI_HW_GATE_WEIGHT_DEFAULTS.strokeCount),
        strokeOrderPts: parseKanjiHandScoreGatePoints_(src.strokeOrder, KANJI_HW_GATE_WEIGHT_DEFAULTS.strokeOrder)
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
      try {
        const raw = localStorage.getItem(LS_APP_CACHED_KANJI_HAND_SCORE_WEIGHTS);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.weightsNormalized && typeof d.weightsNormalized.trajectory === "number") {
            kanjiHandScoreWeightsMem = normalizeKanjiHandScoreWeights_(d.weightsNormalized);
            return kanjiHandScoreWeightsMem;
          }
          if (d && d.sourceSettings) {
            kanjiHandScoreWeightsMem = buildKanjiHandScoreWeightsFromSettings_(d.sourceSettings);
            return kanjiHandScoreWeightsMem;
          }
        }
      } catch (e) {}
      try {
        const legacy = localStorage.getItem("app_cached_settings");
        if (legacy) {
          const d = JSON.parse(legacy);
          if (d && d.settings) {
            const migrated = buildKanjiHandScoreWeightsFromSettings_(d.settings);
            kanjiHandScoreWeightsMem = migrated;
            persistKanjiHandScoreWeightsFromSettings(d.settings);
            return kanjiHandScoreWeightsMem;
          }
        }
      } catch (e2) {}
      kanjiHandScoreWeightsMem = normalizeKanjiHandScoreWeights_(Object.assign({}, KANJI_HW_SCORE_WEIGHT_DEFAULTS, {
        strokeCountPts: KANJI_HW_GATE_WEIGHT_DEFAULTS.strokeCount,
        strokeOrderPts: KANJI_HW_GATE_WEIGHT_DEFAULTS.strokeOrder
      }));
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
    let __kanjiQuizScrollGuardBound = false;
    let __kanjiQuizTouchLockLastBump = 0;
    let __kanjiPracticeLastSubmitAt = 0;
    let __kanjiPracticeLastSubmitKey = "";
    function clearKanjiHwFrameReadyCache() {
      __kanjiQuizHwFrameReadyP = null;
    }
    function kanjiQuizTouchScrollLockActive() {
      return Date.now() < kanjiQuizScrollLockUntil;
    }
    function markKanjiQuizTouchDrawActivity(lockMs) {
      const dur = Math.max(0, Number(lockMs) || 0);
      kanjiQuizScrollLockUntil = Date.now() + dur;
    }
    function bindKanjiQuizScrollGuard() {
      if (__kanjiQuizScrollGuardBound) return;
      __kanjiQuizScrollGuardBound = true;
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
        __kanjiQuizHwFrameReadyP = ensureKanjiPracticeFrameReady();
      }
      return __kanjiQuizHwFrameReadyP;
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
    function setKanjiQuizHandSubmitBusy(isBusy) {
      const qBusy =
        kanjiQuizSession &&
        kanjiQuizSession.questions &&
        kanjiQuizSession.questions[kanjiQuizSession.index];
      const isStrokeBusy = qBusy && qBusy.type === "stroke_order_trace";
      const btn = document.getElementById("kanji-hw-submit-btn");
      const idleLabel = isStrokeBusy ? "これで採点" : "これでかいとう";
      kanjiQuizHandSubmitBusy = !!isBusy;
      if (kanjiQuizHandSubmitAnimTimer) {
        clearInterval(kanjiQuizHandSubmitAnimTimer);
        kanjiQuizHandSubmitAnimTimer = null;
      }
      if (!btn) return;
      btn.disabled = !!isBusy;
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
      }
    }
    function kanjiQuizRunHandwritingAnswer() {
      if (kanjiQuizHandSubmitBusy) return;
      if (!kanjiQuizParentStrokes.length) {
        alert("かんじを かいてください。");
        return;
      }
      if (!kanjiQuizSession) return;
      setKanjiQuizHandSubmitBusy(true);
      function postEvalToFrame() {
        return (function () {
          const frame = document.getElementById("kp-pro-frame");
          if (!frame || !frame.contentWindow) return false;
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
          if (expectedChar) {
            selectKanjiCharInQuizFrame(expectedChar);
          }
          const payload = {
            type: "quizEvalParentStrokes",
            expectedChar: expectedChar,
            scoreWeights: getKanjiHandScoreWeights(),
            strokes: kanjiQuizParentStrokes.map(function (s) {
              return { type: s.type, points: s.points.map(function (p) { return { x: +p.x, y: +p.y }; }) };
            })
          };
          setTimeout(function () {
            try {
              frame.contentWindow.postMessage(payload, "*");
            } catch (e) {}
          }, 90);
          return true;
        })();
      }
      ensureKanjiHwFrameReadyOnce().then(function () {
        const frame = document.getElementById("kp-pro-frame");
        if (frame) patchKanjiFrameForQuizPostMessage(frame);
        ensureKanjiFrameForQuizEval();
        if (!postEvalToFrame()) {
          setKanjiQuizHandSubmitBusy(false);
          alert("さいてんようのびゅうが みつかりません。");
        }
      }).catch(function () {
        setKanjiQuizHandSubmitBusy(false);
        alert("さいてんのじゅんびに しっぱいしました。もういちどためしてください。");
      });
    }
    function kanjiQuizOnHandwritingScored(sc) {
      setKanjiQuizHandSubmitBusy(false);
      if (!kanjiQuizSession) return;
      const secHand = document.getElementById("section-kanji-quiz-play");
      if (!secHand || !secHand.classList.contains("active")) return;
      const q = kanjiQuizSession.questions[kanjiQuizSession.index];
      if (!q || !isKanjiQuizHandwritingQuestionType_(q.type)) return;
      // 書き順は合格確定後の二重採点を無視（自動で次字へ移るまでの間）
      if (
        q.type === "stroke_order_trace" &&
        (kanjiQuizSession.rubyHandComplete || kanjiQuizSession.strokeOrderPendingAdvance)
      ) {
        return;
      }
      if (sc == null || sc < KANJI_QUIZ_HAND_PASS) {
        queueKanjiHandwritingWeakSignalForQuestion(q, sc);
        if (q.type === "stroke_order_trace") {
          kanjiQuizSession.strokeOrderFailedOnce = true;
          updateStrokeOrderHint_("practice", sc);
        }
        /* 書き順も「書いて答える」と同じ誤答パネル＋書き順デモ */
        kanjiQuizShowHandwritingWrongFeedback(sc);
        return;
      }
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
        return;
      }
      kanjiQuizHideWrongFeedback();
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
      const nextCh = targets[slot + 1];
      if (!selectKanjiCharInQuizFrame(nextCh)) return;
      const sum = document.getElementById("kanji-play-summary");
      if (sum) sum.innerHTML = "";
      kanjiQuizClearWritePad(true);
      kanjiQuizSetupWriteCanvas();
      kanjiQuizScheduleWriteCanvasReflow();
    }
    function kanjiQuizSkipHandwritingQuestion(btn) {
      if (!kanjiQuizSession) return;
      const secHand = document.getElementById("section-kanji-quiz-play");
      if (!secHand || !secHand.classList.contains("active")) return;
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
        const win = frame.contentWindow;
        if (!win) return;
        syncKanjiHandScoreWeightsToFrame(frame);
        const doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        const hookVer = String(doc.documentElement.dataset.kanjiQuizParentHook || "");
        if (hookVer === "3") return;
        // v3: なぞり軌道 getScaledRefs を親へ公開
        try {
          win.__kjQPatchInner = false;
          win.__kjEvalWrapped = false;
          win.__kjQPatchInnerV2 = false;
          win.__kjQPatchInnerV3 = false;
        } catch (_eHook) {}
        const s = doc.createElement("script");
        s.textContent =
          "(function(){" +
          "if(window.__kjQPatchInnerV3)return;" +
          "window.__kjQPatchInnerV3=true;" +
          "window.__kjQPatchInnerV2=true;" +
          "window.__kjQPatchInner=true;" +
          "window.__kpGetScaledRefs=function(){" +
          "try{" +
          "if(typeof getScaledRefs===\"function\")return getScaledRefs();" +
          "}catch(e){}" +
          "return[];" +
          "};" +
          "window.addEventListener(\"message\",function(ev){" +
          "if(!ev||!ev.data)return;var d=ev.data;" +
          "try{" +
          "if(d.type===\"quizEvalParentStrokes\"&&Array.isArray(d.strokes)){" +
          "if(d.scoreWeights&&typeof d.scoreWeights===\"object\")window.__kpHandScoreWeights=d.scoreWeights;" +
          "if(d.expectedChar){" +
          "var _ksel=document.getElementById(\"target-kanji\");" +
          "if(!_ksel||String(_ksel.value)!==String(d.expectedChar)){" +
          "if(window.parent)window.parent.postMessage({type:\"kanjiQuizScored\",score:0},\"*\");return;" +
          "}" +
          "}" +
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
          "function _kjWrapEval(){" +
          "if(typeof window.evaluateKanji!==\"function\"){requestAnimationFrame(_kjWrapEval);return;}" +
          "if(window.__kjEvalWrapped)return;" +
          "window.__kjEvalWrapped=true;" +
          "var _o=window.evaluateKanji;" +
          "window.evaluateKanji=function(t){" +
          "_o.apply(this,arguments);" +
          "setTimeout(function(){try{var e=document.getElementById(\"score\"),m=e&&e.innerText&&e.innerText.match(/(\\d+)/),n=m?parseInt(m[1],10):0;if(isNaN(n))n=0;var s=document.getElementById(\"target-kanji\"),k=s&&s.value?String(s.value):\"\";if(window.parent)window.parent.postMessage({type:\"kanjiQuizScored\",score:n,kanjiChar:k},\"*\");}catch(x){}},120);" +
          "};" +
          "}" +
          "_kjWrapEval();" +
          "})();";
        doc.documentElement.appendChild(s);
        doc.documentElement.dataset.kanjiQuizParentHook = "3";
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

        function cleanup() {
          window.removeEventListener("message", onKpKanjiReady);
          if (pollId != null) {
            clearInterval(pollId);
            pollId = null;
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
            if (n >= 60) finish();
          }, 80);
        }

        if (frame.dataset.kpLoaded === "1" && frame.contentDocument && frame.contentDocument.readyState === "complete") {
          setTimeout(tryPoll, 0);
        } else {
          frame.addEventListener("load", function onLf() {
            frame.removeEventListener("load", onLf);
            setTimeout(tryPoll, 0);
          });
        }
      });
    }
    function ensureKanjiFrameForQuizEval() {
      const hid = document.getElementById("kp-pro-frame-quiz-hidden");
      const frame = document.getElementById("kp-pro-frame");
      if (hid && frame && frame.parentElement !== hid) {
        hid.appendChild(frame);
      }
    }
    function restoreKanjiPracticeFrameIfMoved() {
      const slot = document.getElementById("kp-iframe-slot-practice");
      const frame = document.getElementById("kp-pro-frame");
      if (!frame || !slot) return;
      try {
        applyKpStrokeOrderPlayCompactMode_(frame, false);
        applyKpQuizWrongPanelCompactMode(frame, false);
      } catch (_eRk) {}
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
        hint.textContent = "せいかい！ 次の漢字へ自動でうつります…";
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
        ut.rate = 1.15; // あまり間をあけずにどんどん読む
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

      // 先頭（右端）にTTSオンオフのチェックボックスを追加
      const ttsEnabled = getUserPref("kanji_quiz_stroke_tts_enabled", "1") === "1";
      html += '<label class="kanji-so-reading-group kanji-stroke-tts-area" style="pointer-events:auto;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:8px 4px;background:rgba(255,255,255,0.5);border-radius:6px;border:1px dashed #ccc;">';
      html += '<input type="checkbox" class="kanji-stroke-tts-check" style="pointer-events:auto;transform:scale(1.3);margin:0;" ' + (ttsEnabled ? 'checked' : '') + '>';
      html += '<span style="writing-mode:vertical-rl;text-orientation:upright;font-size:13px;color:#555;font-weight:bold;letter-spacing:1px;pointer-events:auto;">読み上げ機能をオン</span>';
      html += '</label>';

      readings.forEach(function (r) {
        if (!r || !r.reading) return;
        const kind = r.kind === "on" ? "on" : "kun";
        const kindLabel = strokeOrderReadingKindLabel_(kind);
        const examples = Array.isArray(r.examples) ? r.examples.filter(Boolean) : [];
        const readTextForVoice = r.reading; // そのままの読み
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
            ttsPhrases.push(ex);
            html +=
              '<span class="kanji-so-reading-example">' + escapeHtml(String(ex)) + "</span>";
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

      // 表示後すぐに読み上げ開始
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
    /** KP iframe の kanjiQuizScored を1リスナで処理（クイズ優先、その後のみ練習の GAS 保存） */
    function initKanjiParentKanjiQuizScoredBridge() {
      if (window.__kanjiParentKanjiQuizScoredBridgeBound) return;
      window.__kanjiParentKanjiQuizScoredBridgeBound = true;
      window.addEventListener("message", function (ev) {
        if (!ev || !ev.data || ev.data.type !== "kanjiQuizScored") return;

        var quizSec = document.getElementById("section-kanji-quiz-play");
        if (quizSec && quizSec.classList.contains("active") && kanjiQuizSession) {
          kanjiQuizSession.lastHandScore = ev.data.score;
          var qNow = kanjiQuizSession.questions[kanjiQuizSession.index];
          var kToast = String(ev.data.kanjiChar || (qNow && qNow.kanji) || "").trim();
          showKanjiHandScoreToast(ev.data.score, kToast);
          var quizSum = document.getElementById("kanji-play-summary");
          if (quizSum) {
            quizSum.innerHTML =
              "<span style=\"color:#b8860b;font-weight:700;\">さいてん: " + ev.data.score + " てん</span>";
          }
          kanjiQuizOnHandwritingScored(ev.data.score);
          return;
        }

        var pracSec = document.getElementById("section-kanji-practice");
        if (!pracSec || !pracSec.classList.contains("active")) return;

        var score = Math.max(0, Math.min(100, Number(ev.data.score) || 0));
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
    }
    /** KanjiVG 再読込で target-kanji が先頭に戻る場合に、不正解モデル用の字を取り直す */
    function initKanjiQuizWrongModelKpReselectBridge() {
      if (window.__kanjiQuizWrongModelKpReselectBound) return;
      window.__kanjiQuizWrongModelKpReselectBound = true;
      window.addEventListener("message", function (ev) {
        if (!ev || !ev.data || ev.data.type !== "kpKanjiDataReady") return;
        const fr = document.getElementById("kp-pro-frame");
        if (!fr || ev.source !== fr.contentWindow) return;
        if (!kanjiQuizSession || !kanjiQuizSession.wrongModelKanjiChar) return;
        const panel = document.getElementById("kanji-quiz-hw-wrong-panel");
        if (!panel || panel.style.display === "none") return;
        selectKanjiCharInQuizFrame(kanjiQuizSession.wrongModelKanjiChar);
      });
    }
    function selectKanjiCharInQuizFrame(ch) {
      const frame = document.getElementById("kp-pro-frame");
      const win = frame && frame.contentWindow;
      if (!win) return false;
      try {
        const doc = win.document;
        const sel = doc.getElementById("target-kanji");
        if (!sel) return false;
        const target = String(ch || "");
        if (!target) return false;
        try {
          if (kanjiQuizSession && kanjiQuizSession.wrongModelKanjiChar === target) {
            win.__kpPendingKanjiSelect = target;
          }
        } catch (e0) {}
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
    /** 現在マスの漢字だけ KanjiVG を初期化（全文字ループは省略して初回表示を高速化） */
    function preloadKanjiQuizTargetsInFrame(targets, activeChar) {
      const frame = document.getElementById("kp-pro-frame");
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
    function kanjiQuizHideWrongFeedback() {
      const panel = document.getElementById("kanji-quiz-hw-wrong-panel");
      const sec = document.getElementById("section-kanji-quiz-play");
      if (sec) sec.classList.remove("kanji-quiz-wrong-visible");
      if (panel) panel.style.display = "none";
      try {
        if (kanjiQuizSession) delete kanjiQuizSession.wrongModelKanjiChar;
        const frClear = document.getElementById("kp-pro-frame");
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
      const frame = document.getElementById("kp-pro-frame");
      const hid = document.getElementById("kp-pro-frame-quiz-hidden");
      if (frame && hid && wrap && frame.parentElement === wrap) {
        applyKpQuizWrongPanelCompactMode(frame, false);
        hid.appendChild(frame);
        frame.style.width = "";
        frame.style.maxWidth = "";
        frame.style.height = "";
        frame.style.minHeight = "";
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
      const frame = document.getElementById("kp-pro-frame");
      if (!modelWrap || !frame || !ch) return;
      function mountAndPlayDemo() {
        if (frame.parentElement !== modelWrap) {
          modelWrap.innerHTML = "";
          modelWrap.appendChild(frame);
        }
        modelWrap.classList.add("is-kp-view-pending");
        delete frame.dataset.kpWrongViewPinned;
        applyKpQuizWrongPanelCompactMode(frame, true);
        frame.style.width = "100%";
        frame.style.maxWidth = "100%";
        frame.style.minHeight = "320px";
        frame.style.height = "360px";
        /* 高さ確定→ピン留め→表示（途中のスライドを見せない） */
        setTimeout(function () {
          try {
            delete frame.dataset.kpWrongViewPinned;
            kpResizeFrameToContent();
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
            if (frame.contentWindow) {
              frame.contentWindow.postMessage({ type: "quizPlayStrokeOrderDemo" }, "*");
            }
          } catch (e) {}
        }, 180);
      }
      function trySelectWithRetry() {
        let mountDone = false;
        function trySelectOnce() {
          if (mountDone) return;
          if (!selectKanjiCharInQuizFrame(ch)) return;
          mountDone = true;
          mountAndPlayDemo();
        }
        trySelectOnce();
        if (mountDone) return;
        // iframe側の候補再構築タイミングと競合するため、短い間隔で再試行する。
        setTimeout(trySelectOnce, 140);
        setTimeout(trySelectOnce, 360);
      }
      ensureKanjiHwFrameReadyOnce().then(trySelectWithRetry);
    }
    function kanjiQuizShowHandwritingWrongFeedback(sc) {
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
      if (ch) kanjiQuizMountWrongModelFrameForChar(ch);
      /* 左右並びのため scrollIntoView はしない（片方だけ見えるのを防ぐ） */
      try {
        const hw = document.getElementById("kanji-quiz-drill-handwriting");
        if (hw) {
          hw.style.display = "flex";
        }
      } catch (eShowHw) {}
    }
    function normalizeKanjiQuizInput(str) {
      try {
        return String(str || "").trim().normalize("NFKC");
      } catch (e) {
        return String(str || "").trim();
      }
    }
    /** れいぶん→よみ：原文を縦書きで表示し、対象かんじを赤字で強調（伏字ではなく漢字をそのまま）。 */
    function kanjiYomiFormatSentenceBlockHtml(q) {
      if (!q) return "";
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
      /**
       * readonly は仕様上スクリプトによる value 代入を禁止しないが、誤解や環境差を避けるため使わない。
       * 画面キーボード経由の入力だけを想定し、直接入力・ペースト・IME はブロックする。
       */
      function blockDirectEdit(ev) {
        ev.preventDefault();
      }
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Tab" || ev.key === "Escape") return;
        blockDirectEdit(ev);
      });
      el.addEventListener("paste", blockDirectEdit);
      el.addEventListener("drop", blockDirectEdit);
      el.addEventListener("cut", blockDirectEdit);
      el.addEventListener("beforeinput", function (ev) {
        if (ev.isTrusted) ev.preventDefault();
      });
      el.addEventListener("input", function () {
        const v = el.value;
        try {
          if (kanjiQuizSession) kanjiQuizSession.sentenceYomiRecognized = v;
        } catch (e) {}
        const hid = document.getElementById("kanji-play-input");
        if (hid) hid.value = v;
      });
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
        /* vertical-rl の wrap が横スクロール位置を持つ場合があるので先頭へ戻す */
        try {
          const wrap = sec && sec.querySelector(".kanji-quiz-drill-wrap");
          if (wrap) {
            wrap.scrollLeft = 0;
            wrap.scrollTop = 0;
          }
        } catch (eScroll) {}
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
      setKanjiQuizHandSubmitBusy(false);
      setKanjiQuizPlayHwFooterActive(false);
      const secShell = document.getElementById("section-kanji-quiz-play");
      if (secShell) {
        secShell.classList.remove("kanji-quiz-jukugo-active");
        secShell.classList.remove("kanji-quiz-choices-active");
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
      if (typingWrap) typingWrap.style.display = "none";
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
      kanjiQuizSession.selectedChoice = null;
      kanjiQuizSession.jukugoAnswerLocked = false;
      kanjiQuizSession.jukugoPendingAdvance = null;
      kanjiQuizSession.strokeOrderPendingAdvance = null;
      kanjiQuizSession.strokeOrderFailedOnce = false;
      updateStrokeOrderDemoButton_();
      resetKanjiQuizDrillPlayShell();
      const secPlay = document.getElementById("section-kanji-quiz-play");
      if (secPlay) {
        const isChoiceQ = q.type === "jukugo_yomi" || q.type === "okurigana_shift" || q.type === "stroke_count";
        secPlay.classList.toggle("kanji-quiz-jukugo-active", q.type === "jukugo_yomi");
        secPlay.classList.toggle("kanji-quiz-choices-active", isChoiceQ);
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
        } else if (q.type === "jukugo_yomi") {
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
          promptEl.innerText = "うすい線をなぞって書いて、60点以上をめざそう。";
        } else if (q.type === "ruby_to_kanji") {
          promptEl.innerText = q.prompt || "";
        } else if (q.type === "okurigana_shift") promptEl.innerText = "正しい送り仮名を選びましょう。";
        else if (q.type === "jukugo_yomi") promptEl.innerText = q.prompt || "例文の下線の熟語の読み方を選びましょう。";
        else promptEl.innerText = q.prompt || "";
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
        if (drillHand) drillHand.style.display = "flex";
        setKanjiQuizPlayHwFooterActive(true);
        const cvsActions = document.getElementById("kanji-hw-canvas-actions");
        if (cvsActions) cvsActions.style.display = "flex";
        const skipHwBtn = document.getElementById("kanji-quiz-skip-hw-btn");
        if (skipHwBtn) skipHwBtn.textContent = isStrokeOrderQ ? "次へ（ふせいかい）" : "次へ";
        updateStrokeOrderDemoButton_();
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
        if (summary) {
          summary.innerHTML =
            "<span style=\"color:#607d8b;font-size:clamp(12px,3vw,14px);\">さいてんようの データを じゅんびしています…</span>";
        }
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
                if (summary) {
                  summary.innerHTML =
                    '<span style="color:#FF8A80;font-size:clamp(12px,3vw,14px);">なぞり線を出せませんでした。マスに書いて採点できます。</span>';
                }
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
        } else if (q.type === "sentence_to_ruby") {
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
          const arr = shuffleKanjiQuizChoicesArray(q.choices);
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
        if (q.type === "sentence_to_ruby") {
          typingWrap.style.display = "flex";
          typingWrap.style.maxWidth = "min(980px, 98vw)";
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
        } else {
          typingWrap.style.display = "none";
        }
      }
      if (subBtn) {
        // 熟語読みは選択肢タッチで即回答するため、回答前は非表示（回答後に「次の問題へ」を出す）
        subBtn.style.display = q.type === "sentence_to_ruby" ? "inline-block" : "none";
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
            questions
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
          nigateTraining: !!ctx.nigateTraining,
          nigateAxis: ctx.nigateAxis || null,
          nigatePassRequired: ctx.nigatePassRequired || 3,
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
      switchSection('section-result');
      const rc = document.getElementById('result-content');
      const retryBtn = document.getElementById('result-retry-btn');
      const settingsBtn = document.getElementById('result-settings-btn');
      const homeBtn = document.getElementById('result-home-btn');
      const sameBookBtn = document.getElementById('result-kanji-same-book-btn');
      const otherBookBtn = document.getElementById('result-kanji-other-book-btn');
      if (!rc || !retryBtn || !settingsBtn || !homeBtn) return;
      function buildKanjiResultRowsHtml_(logRows) {
        return (Array.isArray(logRows) ? logRows : []).map(function (v) {
          const mark = v.isCorrect ? "○" : "×";
          const label = v.jukugoWord
            ? (escapeHtml(v.kanji || "") + "／" + escapeHtml(v.jukugoWord))
            : escapeHtml(v.kanji || "");
          return "「" + label + "」 " + mark + " " + Number(v.score || 0) + "点 → +" + Number(v.earned || 0).toFixed(2) + "Pt";
        }).join("<br>");
      }
      function renderKanjiResultBody_(earned, logRows, totalPts, saveNoteHtml) {
        const rows = buildKanjiResultRowsHtml_(logRows);
        const totalLine = (typeof totalPts === "number" && !isNaN(totalPts))
          ? '<p style="margin-top:8px;">合計ポイント: ' + Number(totalPts).toFixed(2) + "</p>"
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
            '<div style="margin-top:14px;padding:10px;background:#f3e5f5;border-radius:8px;text-align:left;font-size:14px;line-height:1.5;color:#4a148c;"><strong>ニガテ特訓のまとめ</strong><br>' +
            escapeHtml(p1) +
            "<br>" +
            escapeHtml(p2) +
            "</div>";
        }
        rc.innerHTML =
          '<h2 class="kanji-result-title">✨ 漢字セット完了！ ✨</h2>' +
          '<div class="kanji-result-scorebox">' +
          '<p class="kanji-result-pts">かくとくポイント: <span class="kanji-result-pts-val">+' +
          Number(earned || 0).toFixed(2) +
          "</span></p>" +
          '<hr class="kanji-result-hr">' +
          '<div class="kanji-result-logs">' +
          (rows || "結果なし") +
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
        '<p id="kanji-result-save-note" style="margin-top:8px;color:#607d8b;font-size:13px;">結果を保存しています…</p>'
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
            renderKanjiResultBody_(
              Number(d.earnedPoints || 0),
              nextLogs,
              Number(d.newTotal),
              '<p style="margin-top:8px;color:#2e7d32;font-size:13px;">結果を保存しました。</p>'
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
      } catch (_eT) {}
      if (kanjiQuizSession) {
        kanjiQuizSession.jukugoPendingAdvance = null;
        kanjiQuizSession.strokeOrderPendingAdvance = null;
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
    function showStrokeOrderAutoNext_(advanceFn) {
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
      kanjiStrokeOrderAutoNextTimer_ = setTimeout(goNext, 1500);
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
      return "";
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
        verdict.classList.remove("is-visible", "is-correct", "is-wrong");
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
    function showChoiceQuizVerdict_(q, isCorrect) {
      const verdict = document.getElementById("kanji-choice-verdict");
      const mark = document.getElementById("kanji-choice-verdict-mark");
      const answer = document.getElementById("kanji-choice-verdict-answer");
      const nextBtn = document.getElementById("kanji-choice-next-btn");
      if (!verdict || !mark || !answer) return;
      // 中身が外側へ持ち出されていた場合は verdict 内へ戻す
      if (mark.parentNode !== verdict) verdict.appendChild(mark);
      if (answer.parentNode !== verdict) verdict.appendChild(answer);
      mark.textContent = isCorrect ? "◎" : "×";
      mark.style.color = isCorrect ? "#e53935" : "#1565c0";
      answer.textContent = formatChoiceQuizCorrectReadingLabel_(q);
      verdict.classList.toggle("is-correct", !!isCorrect);
      verdict.classList.toggle("is-wrong", !isCorrect);
      verdict.classList.add("is-visible");
      verdict.style.display = "flex";
      // 出題＋ターゲット漢字と同じ縦列へ：出題 → ◎/× → 正解読み → 次へ
      var stemHost = null;
      if (q && q.type === "jukugo_yomi") {
        stemHost = document.querySelector("#kanji-play-detail .jukugo-yomi-stem");
      } else if (q && q.type === "okurigana_shift") {
        stemHost = document.getElementById("kanji-play-char");
        if (stemHost) stemHost.classList.add("kanji-choice-stem-host");
      }
      if (stemHost) {
        stemHost.appendChild(verdict);
        if (nextBtn) stemHost.appendChild(nextBtn);
      } else {
        restoreChoiceQuizFeedbackNodes_();
      }
    }
    function showJukugoYomiNextControls_(advanceFn) {
      const subBtn = document.getElementById("kanji-play-submit-btn");
      const nextBtn = document.getElementById("kanji-choice-next-btn");
      const sec = document.getElementById("section-kanji-quiz-play");
      if (!kanjiQuizSession) return;
      clearKanjiJukugoAutoNext_();
      var advanced = false;
      function goNext() {
        if (advanced) return;
        advanced = true;
        clearKanjiJukugoAutoNext_();
        if (kanjiQuizSession) kanjiQuizSession.jukugoPendingAdvance = null;
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
        advanceFn();
      }
      kanjiQuizSession.jukugoPendingAdvance = goNext;
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
      kanjiJukugoAutoNextTimer_ = setTimeout(goNext, 4000);
    }
    function estimateKanjiQuizProvisionalEarned_(scoreForServer, qType, earnedOverrideVal) {
      if (earnedOverrideVal != null && !isNaN(Number(earnedOverrideVal))) {
        return roundKanjiPtOneDecimal_(earnedOverrideVal);
      }
      const s = Number(scoreForServer) || 0;
      if (s >= 90) return 10;
      if (s >= 80) return 5;
      if (s >= 70) return 4;
      if (s >= 60) return 3;
      if (s >= 50) return 1;
      return 0;
    }
    function flushKanjiQuizBatchScores_(meta) {
      const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
      if (!user || !user.id) {
        return Promise.resolve({ status: "error", message: "ログイン情報が見つかりません。" });
      }
      const items = Array.isArray(meta && meta.pendingScoreItems) ? meta.pendingScoreItems : [];
      if (!items.length) {
        return Promise.resolve({ status: "success", earnedPoints: 0, newTotal: user.points, itemEarned: [] });
      }
      const kanjiSetScopeId =
        "KANJI_" + meta.modeName + "_" + meta.unitName + "_SET" + meta.setId;
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
      } else if (q.type === "sentence_to_ruby") {
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
        isCorrect = normalizeKanjiQuizInput(userRaw) === normalizeKanjiQuizInput(q.correctAnswer);
        if (isCorrect) {
          scriptBonusMult = kanjiQuizSentenceYomiScriptBonusMultiplier(
            normalizeKanjiQuizInput(userRaw),
            q.readingKind
          );
        }
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
        (q.type === "sentence_to_ruby" || q.type === "okurigana_shift" || q.type === "jukugo_yomi")
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
          }
        }
      }
      const selectedForFeedback =
        (q.type === "jukugo_yomi" || q.type === "okurigana_shift") && userRaw
          ? String(userRaw)
          : "";
      kanjiQuizSession.selectedChoice = null;
      const user = JSON.parse(localStorage.getItem("app_kid_user") || "null");
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
      var __isChoiceFeedbackQ =
        q.type === "jukugo_yomi" || q.type === "okurigana_shift";
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
      if (summary) {
        if (isCorrect && q.type === "sentence_to_ruby" && scriptBonusMult < 1) {
          var hintScript = q.readingKind === "on"
            ? "音読みはカタカナで答えてください。"
            : "訓読みはひらがなで答えてください。";
          summary.innerHTML =
            '<span style="color:#FFD54F;">せいかい！（ただし表記がちがうため <strong>半分点</strong>）<br><span style="font-size:0.85em;color:#FFE082;">' +
            escapeHtml(hintScript) +
            "</span></span>";
        } else if (isCorrect && q.type === "stroke_order_trace") {
          const soPts =
            earnedOverrideVal != null ? earnedOverrideVal : estimateKanjiQuizProvisionalEarned_(scoreForServer, q.type, earnedOverrideVal);
          const soNote = kanjiQuizSession && kanjiQuizSession.strokeOrderFailedOnce
            ? "（練習点）"
            : "（書き順点）";
          summary.innerHTML =
            '<span style="color:#69F0AE;">せいかい！ +' +
            soPts +
            "点" +
            soNote +
            '</span>' +
            '<span style="display:block;margin-top:4px;color:#607d8b;font-size:0.9em;">つぎの漢字へ自動でうつります…</span>';
        } else if (q.type === "jukugo_yomi" || q.type === "okurigana_shift") {
          // 正誤は出題横の判定パネルへ表示するため、フッター要約は出さない
          summary.innerHTML = "";
        } else if (isCorrect) {
          summary.innerHTML = '<span style="color:#69F0AE;">せいかい！</span>';
        } else {
          summary.innerHTML = '<span style="color:#FF8A80;">ざんねん… 次はがんばろう</span>';
        }
      }
      if (q.type === "jukugo_yomi" || q.type === "okurigana_shift") {
        applyJukugoYomiChoiceFeedback_(q, selectedForFeedback, isCorrect);
        showChoiceQuizVerdict_(q, isCorrect);
        if (summary) summary.innerHTML = "";
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
        if (q.type === "jukugo_yomi" || q.type === "okurigana_shift") {
          showJukugoYomiNextControls_(runAdvanceAfterScore_);
        } else if (q.type === "stroke_order_trace") {
          showStrokeOrderAutoNext_(runAdvanceAfterScore_);
        } else {
          runAdvanceAfterScore_();
        }
      } finally {
        __kanjiQuizSubmitInFlight = false;
        try {
          if (__kjSubmitBtn && q.type !== "jukugo_yomi" && q.type !== "okurigana_shift") {
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
    function renderKanjiYomiRomajiKeyboard(containerId, targetInputId, onEnterSubmit) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = "";
      window.__kanjiYomiRomajiTail = "";
      const pairs = kanjiYomiEnsureRomajiTable();
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
      const hint = document.createElement("div");
      hint.style.cssText =
        "font-size:12px;color:#455a64;margin-bottom:6px;text-align:center;font-weight:700;";
      hint.textContent = "ローマ字 → ひらがな で入力されます。カタカナで答える場合は「かな⇔カナ」ボタンで切替を。";
      wrap.appendChild(hint);
      const tailHint = document.createElement("div");
      tailHint.style.cssText =
        "font-size:12px;color:#3949ab;margin-bottom:8px;text-align:center;font-weight:700;min-height:1.2em;";
      tailHint.innerHTML = '<span style="color:#666;">入力中:</span> <span id="kanji-yomi-romaji-tail-text">―</span>';
      wrap.appendChild(tailHint);
      function updateTailDisplay() {
        const t = String(window.__kanjiYomiRomajiTail || "");
        const tEl = document.getElementById("kanji-yomi-romaji-tail-text");
        if (tEl) tEl.textContent = t ? t : "―";
      }
      const board = document.createElement("div");
      board.className = "keyboard";
      const rows = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m", "-"]
      ];
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
      rows.forEach(function (row) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "key-row";
        row.forEach(function (ch) {
          const keyBtn = document.createElement("button");
          keyBtn.type = "button";
          keyBtn.className = "key";
          keyBtn.textContent = ch;
          bindKeyHandler(keyBtn, function () {
            if (/^[a-z]$/i.test(ch)) applyChar(ch.toLowerCase());
            else if (ch === "-") applyChar("-");
          });
          rowDiv.appendChild(keyBtn);
        });
        board.appendChild(rowDiv);
      });
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
      scriptBtn.style.padding = "calc(var(--vk-pad-px, 12) * 1px * 0.75) 6px";
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
      bindKeyHandler(scriptBtn, function () {
        const inp = document.getElementById(targetInputId);
        if (!inp) return;
        inp.value = kanjiYomiSwapHiraKataString_(String(inp.value || ""));
        currentScriptKind = currentScriptKind === "on" ? "kun" : "on";
        refreshScriptBtnLabel();
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        updateTailDisplay();
      });
      rowBs.appendChild(scriptBtn);
      const bsBtn = document.createElement("button");
      bsBtn.type = "button";
      bsBtn.className = "key key-wide";
      bsBtn.textContent = "⌫";
      bindKeyHandler(bsBtn, function () {
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
      });
      rowBs.appendChild(bsBtn);
      board.appendChild(rowBs);
      const bottomRow = document.createElement("div");
      bottomRow.className = "key-row";
      const enterBtn = document.createElement("button");
      enterBtn.type = "button";
      enterBtn.className = "key key-action";
      enterBtn.style.flex = "1";
      enterBtn.textContent = "けってい";
      bindKeyHandler(enterBtn, function () {
        finalizeN();
        if (typeof onEnterSubmit === "function") onEnterSubmit();
      });
      bottomRow.appendChild(enterBtn);
      board.appendChild(bottomRow);
      wrap.appendChild(board);
      container.appendChild(wrap);
      updateTailDisplay();
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