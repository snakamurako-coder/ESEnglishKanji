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

    /** アプリ設定の英語基本点（3列: 単語/表現）。旧1列の数値にも対応。 */
    function getEnglishBasePointFromSettings_(settingKey, isWord) {
      const raw = appSettings[settingKey];
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        const v = isWord ? raw.word : raw.expression;
        const n = Number(v);
        if (v != null && String(v).trim() !== "" && !isNaN(n)) return n;
      }
      const legacy = Number(raw);
      if (raw != null && String(raw).trim() !== "" && !isNaN(legacy)) return legacy;
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

    /** 漢字セット単位の時間経過倍率（GAS handleSaveLearningSession と同様）。lastStudyJson が無ければ 1。 */
    function computeKanjiQuizTimeMultiplierClient(modeName, unitName, setId) {
      try {
        const user = JSON.parse(localStorage.getItem("app_kid_user") || "{}");
        const scopeId =
          "KANJI_" + String(modeName || "") + "_" + String(unitName || "") + "_SET" + String(setId || "");
        const lastStudyJson = user.lastStudyJson || {};
        const lastStudyTimeStr = lastStudyJson[scopeId];
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

    /** kanji_history シート（API キャッシュ）または legacy localStorage から highScoreDates を取り出す。 */
    function readKanjiChallengeHighScoreDatesClient_(kanjiChar) {
      try {
        const cached = getKanjiHistoryCacheBucket("__kanjiChallenge");
        if (cached) {
          const rec = cached[String(kanjiChar || "")];
          return rec && Array.isArray(rec.highScoreDates) ? rec.highScoreDates : [];
        }
        const user = JSON.parse(localStorage.getItem("app_kid_user") || "{}");
        const root = (user.historyJson && user.historyJson.__kanjiChallenge) || {};
        const rec = root[String(kanjiChar || "")];
        return rec && Array.isArray(rec.highScoreDates) ? rec.highScoreDates : [];
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
    function estimateKanjiQuizPerfectSessionPointsClient(unitName, modeName, setId, questions) {
      const sheetPct = parseUnitSheetPointPercentClient(unitName);
      const timeMult = computeKanjiQuizTimeMultiplierClient(modeName, unitName, setId);
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
    function confirmKanjiQuizIfReducedSheetPoints(unitName, modeName, setId, questions) {
      const sheetPct = parseUnitSheetPointPercentClient(unitName);
      const list = Array.isArray(questions) ? questions : [];
      const n = list.length;
      const defaultTopBandPt = 10;
      const idealTotal = n * defaultTopBandPt;
      const approx = estimateKanjiQuizPerfectSessionPointsClient(unitName, modeName, setId, list);
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
        "\n※ 日付をまたぐと回復します。\n\n取り組みますか？";
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

    function showHome(user) {
      if (!user || user.id == null) {
        switchSection('section-users');
        fetchUsers();
        return;
      }
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