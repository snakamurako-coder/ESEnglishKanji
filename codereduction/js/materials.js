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
          knsh.innerHTML = kpsh.innerHTML;
          knsh.value = kpsh.value;
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
      ssel.innerHTML = units.map(function (u) {
        return `<option value="${escapeHtml(u)}">${escapeHtml(formatUnitSheetDisplayLabel(u))}</option>`;
      }).join("");
      knOnSheetChange();
    }
    function knOnSheetChange() {
      const bsel = document.getElementById("kn-book-select");
      const ssel = document.getElementById("kn-sheet-select");
      const setSel = document.getElementById("kn-set-select");
      if (!bsel || !ssel || !setSel) return;
      const modeId = bsel.value;
      const unitName = ssel.value;
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
    function loadMaterialsByFilter(btn, category) {
      const origText = toggleBtnLoading(btn, true);
      document.getElementById('materials-container').innerHTML = "<p>よみこみ中...</p>";
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
            return;
          }
          function appendKanjiBookButtons_(books) {
            books.forEach(function (m) {
              const sub = document.createElement("h3");
              sub.style.margin = "8px 0 4px";
              sub.style.fontSize = "1.05em";
              sub.innerText = "📁 " + m.modeName;
              c.appendChild(sub);
              m.units.forEach(function (u) {
                const b = document.createElement("button");
                b.className = "menu-btn btn-gray";
                b.innerText = "📄 " + formatUnitSheetDisplayLabel(u);
                b.onclick = function () { loadQuestionsForSettings(b, m.modeId, m.modeName, u, category); };
                c.appendChild(b);
              });
            });
          }
          if (category === "kanji") {
            const standardBooks = list.filter(function (m) { return !/熟語/.test(String(m.modeName || "")); });
            const jukugoBooks = list.filter(function (m) { return /熟語/.test(String(m.modeName || "")); });
            if (standardBooks.length) {
              const hStd = document.createElement("h2");
              hStd.innerText = "📚 通常漢字ブック";
              c.appendChild(hStd);
              appendKanjiBookButtons_(standardBooks);
            }
            if (jukugoBooks.length) {
              const hJuk = document.createElement("h2");
              hJuk.style.marginTop = standardBooks.length ? "18px" : "0";
              hJuk.innerText = "📚 漢字熟語ブック";
              c.appendChild(hJuk);
              appendKanjiBookButtons_(jukugoBooks);
            }
          } else {
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
      const standardFormats = ['mixed', 'select_kana', 'type_yomi', 'write_kanji', 'stroke_order'];
      if (kanjiQuizCurrentSheetKind_ === 'jukugo') {
        // 熟語ブック → 熟語読みのみ
        Array.from(sel.options).forEach(function (opt) {
          const on = opt.value === 'jukugo_yomi';
          opt.disabled = !on;
          opt.hidden = !on;
        });
        sel.value = 'jukugo_yomi';
        try { localStorage.setItem(LS_KANJI_QUIZ_FORMAT, 'jukugo_yomi'); } catch (e) {}
      } else {
        // 通常の単漢字ブック → 熟語読み以外をすべて用意
        Array.from(sel.options).forEach(function (opt) {
          const on = standardFormats.indexOf(opt.value) >= 0;
          opt.disabled = !on;
          opt.hidden = !on;
        });
        if (sel.value === 'jukugo_yomi' || !sel.value || (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].disabled)) {
          let fallback = 'write_kanji';
          try {
            const v = localStorage.getItem(LS_KANJI_QUIZ_FORMAT);
            if (v && standardFormats.indexOf(v) >= 0) fallback = v;
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
      if (sel && sel.value) return sel.value;
      try {
        const v = localStorage.getItem(LS_KANJI_QUIZ_FORMAT);
        if (v && ['mixed', 'write_kanji', 'select_kana', 'type_yomi', 'stroke_order', 'jukugo_yomi'].indexOf(v) >= 0) return v;
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
      if (!mode || mode === 'mixed') return arr.slice();
      var typeMap = {
        write_kanji: 'ruby_to_kanji',
        select_kana: 'okurigana_shift',
        type_yomi: 'sentence_to_ruby',
        stroke_order: 'stroke_order_trace',
        jukugo_yomi: 'jukugo_yomi'
      };
      var t = typeMap[mode];
      if (!t) return arr.slice();
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
    function prepareKanjiQuizQuestionsForPlay(rawList) {
      var mode = getKanjiQuizFormatMode();
      var normalized = (Array.isArray(rawList) ? rawList : []).map(function (q) {
        if (!q || q.type !== "okurigana_shift") return q;
        return rebuildOkuriganaQuestionByAlgorithm_(q);
      });
      var filtered = filterKanjiQuizQuestionsByFormat(normalized, mode);
      if (!filtered.length) {
        alert('この しかた では もんだいがありません。\nほかの しかたを えらぶか、混合にしてください。');
        return null;
      }
      // 出題順のシャッフルは startKanjiQuizPlay 内で1回だけ行う（二重シャッフル防止）
      return { questions: filtered, formatMode: mode };
    }