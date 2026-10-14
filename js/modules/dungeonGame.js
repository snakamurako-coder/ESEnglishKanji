/**
 * js/modules/dungeonGame.js
 * 単語迷宮 百階 (Dungeon RPG Gamification)
 * 
 * 1. 塔（ダンジョン）選択システム:
 *    - プレイヤーは挑戦する塔を選択してダンジョンに突入
 *    - 塔ごとに最高記録・セーブデータを個別に保持
 * 2. 管理者による塔の作成・編集・出題問題セット（単元）の割り当て:
 *    - マニフェストから自動抽出した単語・表現単元チェックボックスで出題範囲を自由設定
 * 3. 難易度1〜10の降順ルール（指定された単元からランダム装填）:
 *    - Lv10: 表現 / 日本語→英語 / タイピング
 *    - Lv9:  表現 / 日本語→英語 / 音声入力
 *    - Lv8:  表現 / 日本語→英語 / 並び替え（＋１補う）
 *    - Lv7:  表現 / 日本語→英語 / 並び替え（－１不要語排除）
 *    - Lv6:  表現 / 日本語→英語 / 並び替え（過不足なし）
 *    - Lv5:  単語 / 日本語→英語 / タイピング
 *    - Lv4:  単語 / 日本語→英語 / 音声入力
 *    - Lv3:  単語 / 日本語→英語 / スペル補う
 *    - Lv2:  単語 / 英語→日本語 / 四択＋「この中に正答はない」
 *    - Lv1:  単語 / 日本語→英語 / 四択
 */

(function(global) {
  'use strict';

  const $ = s => document.querySelector('#section-dungeon ' + s) || document.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = n => Math.floor(Math.random() * n);
  const shuffle = a => {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = ri(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /* ---------- 教材マニフェスト ＆ 単元管理 ---------- */
  let ALL_VOCAB_UNITS = []; // ["数字1_50", "数字2_60", "色_50", ...]
  let ALL_EXPR_UNITS = [];  // ["あかり自己紹介", "ひかり自己紹介", ...]
  let VOCAB_BY_UNIT = {};   // { "数字1_50": [...rows], ... }
  let EXPR_BY_UNIT = {};    // { "あかり自己紹介": [...rows], ... }
  let isManifestLoaded = false;

  // フォールバック用初期データ
  const DEFAULT_VOCAB = [
    {英単語:"borrow",日本語:"借りる",イニシャル:"b",イニシャルと文字数:"b _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"decide",日本語:"決める",イニシャル:"d",イニシャルと文字数:"d _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"weather",日本語:"天気",イニシャル:"w",イニシャルと文字数:"w _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"enough",日本語:"十分な",イニシャル:"e",イニシャルと文字数:"e _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"foreign",日本語:"外国の",イニシャル:"f",イニシャルと文字数:"f _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"believe",日本語:"信じる",イニシャル:"b",イニシャルと文字数:"b _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"arrive",日本語:"到着する",イニシャル:"a",イニシャルと文字数:"a _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"culture",日本語:"文化",イニシャル:"c",イニシャルと文字数:"c _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"explain",日本語:"説明する",イニシャル:"e",イニシャルと文字数:"e _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"important",日本語:"重要な",イニシャル:"i",イニシャルと文字数:"i _ _ _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"language",日本語:"言語",イニシャル:"l",イニシャルと文字数:"l _ _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"protect",日本語:"守る",イニシャル:"p",イニシャルと文字数:"p _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"future",日本語:"未来",イニシャル:"f",イニシャルと文字数:"f _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"increase",日本語:"増加する",イニシャル:"i",イニシャルと文字数:"i _ _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"opinion",日本語:"意見",イニシャル:"o",イニシャルと文字数:"o _ _ _ _ _ _",ヒント:"", unit:"基本単語"}
  ];

  const DEFAULT_EXPR = [
    {
      日本語: "こんにちは。", 英文: "Hello.",
      別解1: "Hi.", 別解2: "Good morning.", 別解3: "", 別解4: "", 別解5: "",
      並び替え語句ダミー: "bye", tokens: ["Hello"], unit: "基本表現"
    },
    {
      日本語: "わたしの名前はあかりです。", 英文: "My name is Akari.",
      別解1: "I am Akari.", 別解2: "I'm Akari.", 別解3: "", 別解4: "", 別解5: "",
      並び替え語句ダミー: "are", tokens: ["My", "name", "is", "Akari"], unit: "基本表現"
    },
    {
      日本語: "わたしは10歳です。", 英文: "I am ten years old.",
      別解1: "I'm ten years old.", 別解2: "", 別解3: "", 別解4: "", 別解5: "",
      並び替え語句ダミー: "nine", tokens: ["I", "am", "ten", "years", "old"], unit: "基本表現"
    },
    {
      日本語: "お会いできてうれしいです。", 英文: "Nice to meet you.",
      別解1: "Glad to meet you.", 別解2: "", 別解3: "", 別解4: "", 別解5: "",
      並び替え語句ダミー: "see", tokens: ["Nice", "to", "meet", "you"], unit: "基本表現"
    },
    {
      日本語: "わたしは本を読むのが好きです。", 英文: "I like reading books.",
      別解1: "I like to read books.", 別解2: "", 別解3: "", 別解4: "", 別解5: "",
      並び替え語句ダミー: "play", tokens: ["I", "like", "reading", "books"], unit: "基本表現"
    }
  ];

  ALL_VOCAB_UNITS = ["基本単語"];
  ALL_EXPR_UNITS = ["基本表現"];
  VOCAB_BY_UNIT["基本単語"] = DEFAULT_VOCAB.slice();
  EXPR_BY_UNIT["基本表現"] = DEFAULT_EXPR.slice();

  function tokenizeSentence(text) {
    if (!text) return [];
    return text.trim()
      .replace(/[.,?!;:()'"]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  function normalizeText(s) {
    if (!s) return "";
    return String(s)
      .toLowerCase()
      .replace(/[.,?!;:()'"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 教材マニフェスト読み込み
  async function loadManifestMaterialsForDungeon() {
    try {
      let indexRes = null;
      try {
        const r = await fetch('data/manifest-index.json', { cache: 'no-store' });
        if (r.ok) indexRes = await r.json();
      } catch (e) {}

      if (!indexRes || !indexRes.books) return;

      const vocabMap = {};
      const exprMap = {};
      const vocabUnitNames = [];
      const exprUnitNames = [];

      for (const modeId of Object.keys(indexRes.books)) {
        const bookInfo = indexRes.books[modeId];
        const modeName = bookInfo.modeName || '';
        const hash = bookInfo.hash || '';
        if (bookInfo.category !== 'english') continue;

        let bookData = null;
        try {
          const bRes = await fetch(`data/books/${modeId}.${hash}.json`);
          if (bRes.ok) bookData = await bRes.json();
        } catch (e) {}

        if (!bookData || !bookData.units) continue;

        if (modeName.includes('単語') || modeId === '1Dhd9bV4SDc-SWNHqyykZqPsmRsSFtGnDHpic2uQwW14') {
          Object.keys(bookData.units).forEach(uName => {
            const rows = bookData.units[uName];
            if (!Array.isArray(rows)) return;
            vocabUnitNames.push(uName);
            vocabMap[uName] = [];
            rows.forEach(row => {
              const en = String(row["英単語"] || row["英文"] || "").trim();
              const ja = String(row["日本語"] != null ? row["日本語"] : "").trim();
              if (en && ja) {
                vocabMap[uName].push({
                  英単語: en,
                  日本語: ja,
                  イニシャル: String(row["イニシャル"] || en[0] || "").trim(),
                  イニシャルと文字数: String(row["イニシャルと文字数"] || "").trim(),
                  ヒント: String(row["ヒント"] || "").trim(),
                  unit: uName
                });
              }
            });
          });
        } else if (modeName.includes('表現') || modeId === '1FEwmkmGQYKttN-Uovji8YbNXaT7rzWE0aH6Cyi7osaA') {
          Object.keys(bookData.units).forEach(uName => {
            const rows = bookData.units[uName];
            if (!Array.isArray(rows)) return;
            exprUnitNames.push(uName);
            exprMap[uName] = [];
            rows.forEach(row => {
              const en = String(row["英文"] || "").trim();
              const ja = String(row["日本語"] != null ? row["日本語"] : "").trim();
              if (en && ja) {
                const tokens = tokenizeSentence(row["並び替え箇所"] || en);
                if (tokens.length >= 2) {
                  exprMap[uName].push({
                    日本語: ja,
                    英文: en,
                    別解1: String(row["別解１"] || "").trim(),
                    別解2: String(row["別解２"] || "").trim(),
                    別解3: String(row["別解３"] || "").trim(),
                    別解4: String(row["別解４"] || "").trim(),
                    別解5: String(row["別解５"] || "").trim(),
                    並び替え語句ダミー: String(row["並び替え語句ダミー"] || "").trim(),
                    tokens: tokens,
                    ヒント: String(row["ヒント"] || "").trim(),
                    unit: uName
                  });
                }
              }
            });
          });
        }
      }

      if (vocabUnitNames.length > 0) {
        ALL_VOCAB_UNITS = [...new Set(vocabUnitNames)];
        VOCAB_BY_UNIT = vocabMap;
      }
      if (exprUnitNames.length > 0) {
        ALL_EXPR_UNITS = [...new Set(exprUnitNames)];
        EXPR_BY_UNIT = exprMap;
      }
      isManifestLoaded = true;
      console.log(`[Dungeon] Loaded manifest: ${ALL_VOCAB_UNITS.length} vocab units, ${ALL_EXPR_UNITS.length} expr units.`);
      renderTowerCards();
    } catch (err) {
      console.warn('[Dungeon] Manifest load failed, using fallback.', err);
    }
  }

  if (typeof window !== 'undefined') {
    setTimeout(loadManifestMaterialsForDungeon, 300);
  }

  /* ---------- 塔（Towers）のデータ管理 ---------- */
  const TOWERS_KEY = "tango-meikyu-towers";
  const DEFAULT_TOWERS = [
    {
      id: "tower_starter",
      name: "はじまりの塔",
      desc: "数字・色・あかりの自己紹介で基礎をかためる入門の塔",
      maxFloor: 30,
      timeMultiplier: 1.0,
      vocabUnits: ["数字1_50", "色_50"],
      exprUnits: ["あかり自己紹介"]
    },
    {
      id: "tower_self_intro",
      name: "自己紹介の塔",
      desc: "自己紹介の単語と様々な表現フレーズをマスターする塔",
      maxFloor: 50,
      timeMultiplier: 1.0,
      vocabUnits: ["自己紹介用１", "自己紹介用２"],
      exprUnits: ["あかり自己紹介", "ひかり自己紹介", "ひかりを紹介"]
    },
    {
      id: "tower_hundred",
      name: "覇王迷宮 百階",
      desc: "すべての単語と表現からランダムに出題される究極の百階ダンジョン",
      maxFloor: 100,
      timeMultiplier: 1.0,
      vocabUnits: [], // 空 = 全単元
      exprUnits: []   // 空 = 全単元
    }
  ];

  let TOWERS = [];
  function loadTowers() {
    try {
      const v = JSON.parse(localStorage.getItem(TOWERS_KEY));
      if (Array.isArray(v) && v.length > 0) {
        TOWERS = v.map(t => ({
          ...t,
          timeMultiplier: (typeof t.timeMultiplier === "number" && t.timeMultiplier > 0) ? t.timeMultiplier : 1.0
        }));
        return;
      }
    } catch(e) {}
    TOWERS = JSON.parse(JSON.stringify(DEFAULT_TOWERS));
    saveTowers();
  }
  function saveTowers() {
    try { localStorage.setItem(TOWERS_KEY, JSON.stringify(TOWERS)); } catch(e) {}
  }
  function resetTowersToDefault() {
    TOWERS = JSON.parse(JSON.stringify(DEFAULT_TOWERS));
    saveTowers();
    renderTowerCards();
    renderAdminTowerList();
    alert("塔の設定を初期状態にもどしました。");
  }
  loadTowers();

  let currentTower = TOWERS[0] || DEFAULT_TOWERS[0];

  /* 塔ごとの記録・セーブキー */
  function getTowerRecKey(towerId) {
    return "tango-meikyu-rec-" + (towerId || (currentTower && currentTower.id) || "default");
  }
  function loadTowerRec(towerId) {
    try {
      return Object.assign({ best: 0, save: null }, JSON.parse(localStorage.getItem(getTowerRecKey(towerId))) || {});
    } catch(e) {
      return { best: 0, save: null };
    }
  }
  function saveTowerRec(rec, towerId) {
    try {
      localStorage.setItem(getTowerRecKey(towerId), JSON.stringify(rec));
    } catch(e) {}
  }

  // 選択された塔の出題プールを取得
  function getActiveVocabPool() {
    const list = [];
    const selected = (currentTower && Array.isArray(currentTower.vocabUnits) && currentTower.vocabUnits.length > 0)
      ? currentTower.vocabUnits
      : ALL_VOCAB_UNITS;
    selected.forEach(u => {
      if (Array.isArray(VOCAB_BY_UNIT[u])) list.push(...VOCAB_BY_UNIT[u]);
    });
    return list.length > 0 ? list : DEFAULT_VOCAB;
  }

  function getActiveExprPool() {
    const list = [];
    const selected = (currentTower && Array.isArray(currentTower.exprUnits) && currentTower.exprUnits.length > 0)
      ? currentTower.exprUnits
      : ALL_EXPR_UNITS;
    selected.forEach(u => {
      if (Array.isArray(EXPR_BY_UNIT[u])) list.push(...EXPR_BY_UNIT[u]);
    });
    return list.length > 0 ? list : DEFAULT_EXPR;
  }

  /* ---------- 操作パッド設定 (right: 右利き・右側縦 / left: 左利き・左側縦 / bottom: スマホモード・下部) ---------- */
  let dungeonPadMode = "right";
  try {
    const saved = localStorage.getItem("dungeon-pad-mode") || localStorage.getItem("dungeon-hand-mode");
    if (saved === "left" || saved === "right" || saved === "bottom") {
      dungeonPadMode = saved;
    }
  } catch(e) {}

  function applyDungeonPadModeUI() {
    const mainView = document.getElementById("dungeon-main-view");
    if (mainView) {
      mainView.classList.remove("dungeon-hand-right", "dungeon-hand-left", "dungeon-mode-bottom");
      if (dungeonPadMode === "left") mainView.classList.add("dungeon-hand-left");
      else if (dungeonPadMode === "bottom") mainView.classList.add("dungeon-mode-bottom");
      else mainView.classList.add("dungeon-hand-right");
    }
    const label = document.getElementById("dungeon-hand-label");
    if (label) {
      if (dungeonPadMode === "left") label.textContent = "🫲 左利き";
      else if (dungeonPadMode === "bottom") label.textContent = "📱 スマホ";
      else label.textContent = "🫱 右利き";
    }
    const btnRight = document.getElementById("dungeon-pad-btn-right") || document.getElementById("dungeon-hand-btn-right");
    const btnLeft = document.getElementById("dungeon-pad-btn-left") || document.getElementById("dungeon-hand-btn-left");
    const btnBottom = document.getElementById("dungeon-pad-btn-bottom");
    
    [
      [btnRight, dungeonPadMode === "right"],
      [btnLeft, dungeonPadMode === "left"],
      [btnBottom, dungeonPadMode === "bottom"]
    ].forEach(([b, active]) => {
      if (!b) return;
      b.classList.toggle("active", !!active);
      b.style.background = active ? "var(--gold)" : "";
      b.style.color = active ? "#000" : "";
      b.style.fontWeight = active ? "bold" : "";
    });
  }

  function setDungeonPadMode(mode) {
    dungeonPadMode = (mode === "left" || mode === "bottom") ? mode : "right";
    try {
      localStorage.setItem("dungeon-pad-mode", dungeonPadMode);
      localStorage.setItem("dungeon-hand-mode", dungeonPadMode);
    } catch(e) {}
    applyDungeonPadModeUI();
    try { se("select"); } catch(e) {}
    if (typeof S !== "undefined" && S && S.screen === "explore") {
      winExplore("どちらへ すすむ？");
    }
  }

  function toggleDungeonPadMode() {
    const next = dungeonPadMode === "right" ? "left" : (dungeonPadMode === "left" ? "bottom" : "right");
    setDungeonPadMode(next);
  }

  // 互換用エイリアス
  const setDungeonHandMode = setDungeonPadMode;
  const toggleDungeonHandMode = toggleDungeonPadMode;
  const applyDungeonHandModeUI = applyDungeonPadModeUI;
  const dungeonHandMode = dungeonPadMode;

  /* ---------- 難易度1〜10 の定義 ---------- */
  const LV_INFO = [
    null,
    { name: "単語 四択 (日→英)", mode: "単語", dir: "日→英", fmt: "四択" },
    { name: "単語 四択＋なし (英→日)", mode: "単語", dir: "英→日", fmt: "四択＋「この中に正答はない」" },
    { name: "単語 スペル補う (日→英)", mode: "単語", dir: "日→英", fmt: "スペル補う" },
    { name: "単語 音声入力 (日→英)", mode: "単語", dir: "日→英", fmt: "音声入力" },
    { name: "単語 タイピング (日→英)", mode: "単語", dir: "日→英", fmt: "タイピング" },
    { name: "表現 並び替え過不足なし (日→英)", mode: "表現", dir: "日→英", fmt: "並び替え（過不足なし）" },
    { name: "表現 並び替え－1不要語 (日→英)", mode: "表現", dir: "日→英", fmt: "並び替え（－１不要語排除）" },
    { name: "表現 並び替え＋1補う (日→英)", mode: "表現", dir: "日→英", fmt: "並び替え（＋１補う）" },
    { name: "表現 音声入力 (日→英)", mode: "表現", dir: "日→英", fmt: "音声入力" },
    { name: "表現 タイピング (日→英)", mode: "表現", dir: "日→英", fmt: "タイピング" }
  ];

  function tlim(L) {
    const key = "t_lv" + L;
    let baseTime = CFG[key];
    if (typeof baseTime !== "number" || !isFinite(baseTime)) {
      if (L === 1) baseTime = 10;
      else if (L === 2) baseTime = 12;
      else if (L === 3) baseTime = 15;
      else if (L === 4) baseTime = 16;
      else if (L === 5) baseTime = 22;
      else if (L === 6) baseTime = 25;
      else if (L === 7) baseTime = 28;
      else if (L === 8) baseTime = 30;
      else if (L === 9) baseTime = 18;
      else if (L === 10) baseTime = 25;
      else baseTime = 15;
    }
    const towerMul = (currentTower && typeof currentTower.timeMultiplier === "number" && currentTower.timeMultiplier > 0) ? currentTower.timeMultiplier : 1;
    return baseTime * (CFG.time || 1) * towerMul;
  }

  /* ---------- 問題生成 (makeQ) ---------- */
  function makeQ(L) {
    const isVocab = L <= 5;
    const vPool = getActiveVocabPool();
    const ePool = getActiveExprPool();

    if (isVocab) {
      const w = vPool[ri(vPool.length)];
      
      // Lv 1: 単語 / 日本語→英語 / 四択
      if (L === 1) {
        const others = shuffle(vPool.filter(x => x.英単語 !== w.英単語));
        const dummy1 = others[0] ? others[0].英単語 : "word";
        const dummy2 = others[1] ? others[1].英単語 : "book";
        const dummy3 = others[2] ? others[2].英単語 : "study";
        const choices = shuffle([w.英単語, dummy1, dummy2, dummy3]);
        return {
          L, fm: "choice4", type: "choice",
          prompt: `「${w.日本語}」にあたる英語は？`,
          hint: w.ヒント && w.ヒント !== "なし" ? w.ヒント : "",
          answer: w.英単語,
          choices: choices
        };
      }

      // Lv 2: 単語 / 英語→日本語 / 四択＋「この中に正答はない」
      if (L === 2) {
        const others = shuffle(vPool.filter(x => x.日本語 !== w.日本語));
        const noneText = "この中に正答はない";
        const isNoneCorrect = Math.random() < 0.25;

        let choices = [], answer = "";
        if (isNoneCorrect) {
          answer = noneText;
          const d1 = others[0] ? others[0].日本語 : "〜する";
          const d2 = others[1] ? others[1].日本語 : "〜を見る";
          const d3 = others[2] ? others[2].日本語 : "〜へ行く";
          const d4 = others[3] ? others[3].日本語 : "大きい";
          choices = shuffle([d1, d2, d3, d4]).concat(noneText);
        } else {
          answer = w.日本語;
          const d1 = others[0] ? others[0].日本語 : "〜する";
          const d2 = others[1] ? others[1].日本語 : "〜を見る";
          const d3 = others[2] ? others[2].日本語 : "〜へ行く";
          choices = shuffle([w.日本語, d1, d2, d3]).concat(noneText);
        }

        return {
          L, fm: "choice5", type: "choice",
          prompt: `"${w.英単語}" の意味は？`,
          hint: w.ヒント && w.ヒント !== "なし" ? w.ヒント : "",
          answer: answer,
          choices: choices,
          is5Choice: true
        };
      }

      // Lv 3: 単語 / 日本語→英語 / スペル補う
      if (L === 3) {
        const raw = w.英単語.toLowerCase();
        const chars = raw.split("");
        const len = chars.length;
        const blankCount = len <= 4 ? 1 : len <= 7 ? 2 : 3;
        const blankIndices = [];
        while (blankIndices.length < blankCount && blankIndices.length < len) {
          const idx = ri(len);
          if (!blankIndices.includes(idx)) blankIndices.push(idx);
        }
        const masked = chars.map((ch, i) => blankIndices.includes(i) ? "_" : ch).join(" ");
        const missingChars = blankIndices.sort((a,b)=>a-b).map(i => chars[i]).join("");
        return {
          L, fm: "spell", type: "spell",
          prompt: `「${w.日本語}」のスペルを補おう`,
          hint: masked,
          answer: raw,
          missingChars: missingChars,
          rawWord: raw
        };
      }

      // Lv 4: 単語 / 日本語→英語 / 音声入力
      if (L === 4) {
        return {
          L, fm: "voice", type: "voice",
          prompt: `「${w.日本語}」を英語で発音しよう`,
          hint: w.イニシャルと文字数 || (w.英単語[0] + " " + "_ ".repeat(w.英単語.length - 1)),
          answer: w.英単語.toLowerCase(),
          rawWord: w.英単語
        };
      }

      // Lv 5: 単語 / 日本語→英語 / タイピング
      if (L === 5) {
        return {
          L, fm: "type", type: "type",
          prompt: `「${w.日本語}」を英語で入力しよう`,
          hint: w.イニシャルと文字数 || (w.英単語[0] + " " + "_ ".repeat(w.英単語.length - 1) + `（${w.英単語.length}文字）`),
          answer: w.英単語.toLowerCase(),
          rawWord: w.英単語
        };
      }
    }

    // 表現問題 (Lv 6〜10)
    const q = ePool[ri(ePool.length)];
    const validAnswers = [q.英文, q.別解1, q.別解2, q.別解3, q.別解4, q.別解5]
      .map(s => normalizeText(s))
      .filter(s => s.length > 0);

    // Lv 6: 表現 / 日本語→英語 / 並び替え（過不足なし）
    if (L === 6) {
      return {
        L, fm: "sort_all", type: "sort",
        variant: "all",
        prompt: `「${q.日本語}」になるように単語を並べよう`,
        hint: q.ヒント || "",
        answer: q.英文,
        validAnswers: validAnswers,
        cards: shuffle(q.tokens.slice()),
        expectedCount: q.tokens.length
      };
    }

    // Lv 7: 表現 / 日本語→英語 / 並び替え（－１不要語排除）
    if (L === 7) {
      let dummy = q.並び替え語句ダミー;
      if (!dummy) {
        const others = shuffle(ePool.filter(x => x.英文 !== q.英文));
        dummy = others[0] && others[0].tokens[0] ? others[0].tokens[0] : "very";
      }
      return {
        L, fm: "sort_dummy", type: "sort",
        variant: "dummy",
        prompt: `「${q.日本語}」になるよう並べよう（使わない単語が1つあるよ！）`,
        hint: "不要な単語を1つ除外して回答枠に並べてね",
        answer: q.英文,
        validAnswers: validAnswers,
        cards: shuffle(q.tokens.concat(dummy)),
        expectedCount: q.tokens.length,
        dummyWord: dummy
      };
    }

    // Lv 8: 表現 / 日本語→英語 / 並び替え（＋１補う）
    if (L === 8) {
      const missingIdx = ri(q.tokens.length);
      const missingWord = q.tokens[missingIdx];
      const remaining = q.tokens.filter((_, i) => i !== missingIdx);
      return {
        L, fm: "sort_missing", type: "sort",
        variant: "missing",
        prompt: `「${q.日本語}」になるよう並べよう（1語足りない単語を補ってね！）`,
        hint: "足りない単語を入力して「＋カード追加」し、並べてね",
        answer: q.英文,
        validAnswers: validAnswers,
        cards: shuffle(remaining),
        missingWord: missingWord,
        expectedCount: q.tokens.length
      };
    }

    // Lv 9: 表現 / 日本語→英語 / 音声入力
    if (L === 9) {
      return {
        L, fm: "voice", type: "voice",
        prompt: `「${q.日本語}」を英語で発音しよう`,
        hint: `（${q.tokens.length}語の文）`,
        answer: q.英文,
        validAnswers: validAnswers
      };
    }

    // Lv 10: 表現 / 日本語→英語 / タイピング
    if (L === 10) {
      return {
        L, fm: "type", type: "type",
        prompt: `「${q.日本語}」を英語で入力しよう`,
        hint: `（${q.tokens.length}語の文）`,
        answer: q.英文,
        validAnswers: validAnswers
      };
    }

    return null;
  }

  /* ---------- バランス調整パラメータ ---------- */
  const SCHEMA = [
    ["主人公", [
      ["hp0", "HP（Lv1）", 50, 1, 9999, 1], ["hpLv", "HP：1レベルごとの増加", 10, 0, 999, 1],
      ["mp0", "MP（Lv1）", 10, 0, 9999, 1], ["mpLv", "MP：1レベルごとの増加", 2, 0, 999, 1],
      ["atk0", "攻撃力（Lv1）", 10, 1, 9999, 1], ["atkLv", "攻撃力：1レベルごとの増加", 3, 0, 999, 1],
      ["exp0", "次のLvまでの経験値（Lv1）", 20, 1, 99999, 1], ["expLv", "必要経験値：1レベルごとの増加", 8, 0, 9999, 1],
      ["dmgBase", "与ダメージ係数（攻撃力×）", 0.7, 0.05, 10, 0.05], ["critMul", "クリティカル倍率", 2, 1, 10, 0.1]
    ]],
    ["装備", [
      ["defCoef", "防御力1あたり減らせる被ダメージ", 0.5, 0, 10, 0.05],
      ["g1d", "ブロンズ防具の防御力", 2, 0, 9999, 1], ["g1s", "ブロンズソードの攻撃力", 12, 0, 9999, 1],
      ["g2d", "アイアン防具の防御力", 5, 0, 9999, 1], ["g2s", "アイアンソードの攻撃力", 30, 0, 9999, 1],
      ["g3d", "スチール防具の防御力", 7, 0, 9999, 1], ["g3s", "スチールソードの攻撃力", 42, 0, 9999, 1],
      ["g4d", "シルバー防具の防御力", 9, 0, 9999, 1], ["g4s", "シルバーソードの攻撃力", 54, 0, 9999, 1],
      ["g5d", "プラチナ防具の防御力", 12, 0, 9999, 1], ["g5s", "プラチナソードの攻撃力", 72, 0, 9999, 1],
      ["g6d", "ダークスチール防具の防御力", 15, 0, 9999, 1], ["g6s", "ダークスチールソードの攻撃力", 90, 0, 9999, 1],
      ["g7d", "ミスリル防具の防御力", 17, 0, 9999, 1], ["g7s", "ミスリルソードの攻撃力", 102, 0, 9999, 1],
      ["g8d", "アダマンタイト防具の防御力", 19, 0, 9999, 1], ["g8s", "アダマンタイトソードの攻撃力", 114, 0, 9999, 1],
      ["g9d", "ヒヒイロカネ防具の防御力", 22, 0, 9999, 1], ["g9s", "ヒヒイロカネソードの攻撃力", 132, 0, 9999, 1],
      ["g10d", "オリハルコン防具の防御力", 25, 0, 9999, 1], ["g10s", "オリハルコンソードの攻撃力", 150, 0, 9999, 1]
    ]],
    ["敵の強さ", [
      ["K", "倒すのに必要な標準攻撃の回数（1階）", 3, 0.5, 30, 0.5], ["N", "無防備で耐えられる被弾数（1階）", 10, 1, 50, 1],
      ["depth", "深い階ほど厳しくなる度合い", 1, 0, 5, 0.1], ["expDiv", "1レベル上がるのに必要な撃破数", 3, 0.5, 30, 0.5],
      ["eCrit", "敵の痛恨の確率（%）", 5, 0, 100, 1], ["eCritMul", "敵の痛恨の倍率", 1.5, 1, 10, 0.1],
      ["monMin", "1階あたりの敵の数（最小）", 3, 0, 15, 1], ["monMax", "1階あたりの敵の数（最大）", 5, 0, 15, 1],
      ["chase", "勇者を追いかけ始める距離（マス）", 2, 0, 20, 1]
    ]],
    ["敵のタイプ", [
      ["a0hp", "標準型：HP倍率", 1, 0.1, 10, 0.05], ["a0atk", "標準型：攻撃倍率", 1, 0.1, 10, 0.05], ["a0eva", "標準型：回避率（%）", 5, 0, 100, 1],
      ["a1hp", "速攻型：HP倍率", 0.7, 0.1, 10, 0.05], ["a1atk", "速攻型：攻撃倍率", 1.3, 0.1, 10, 0.05], ["a1eva", "速攻型：回避率（%）", 12, 0, 100, 1],
      ["a2hp", "重装型：HP倍率", 1.5, 0.1, 10, 0.05], ["a2atk", "重装型：攻撃倍率", 0.8, 0.1, 10, 0.05], ["a2eva", "重装型：回避率（%）", 2, 0, 100, 1],
      ["a3hp", "呪い型：HP倍率", 0.9, 0.1, 10, 0.05], ["a3atk", "呪い型：攻撃倍率", 1.15, 0.1, 10, 0.05], ["a3eva", "呪い型：回避率（%）", 8, 0, 100, 1]
    ]],
    ["守護竜", [
      ["bh", "HP（通常の敵の何倍か）", 6.25, 0.5, 50, 0.25], ["ba", "攻撃力（通常の敵の何倍か）", 1.68, 0.5, 20, 0.02],
      ["bEva", "回避率（%）", 5, 0, 100, 1], ["bossExp", "経験値（通常の敵の何倍か）", 5, 0, 100, 0.5],
      ["regenAt", "自己再生を使うHP（最大HPの%以下）", 50, 0, 100, 5], ["regenHeal", "自己再生の回復量（最大HPの%）", 50, 0, 100, 5]
    ]],
    ["クイズの効果", [
      ["base", "基本値・不正解時の効果（%）", 5, 0, 100, 1], ["perLv", "難易度1つごとの上昇（%）", 5, 0, 50, 0.5],
      ["sp1", "速さ補正：残り80%以上", 15, -100, 100, 1], ["sp2", "速さ補正：残り60%以上", 10, -100, 100, 1],
      ["sp3", "速さ補正：残り40%以上", 5, -100, 100, 1], ["sp4", "速さ補正：残り20%以上", 0, -100, 100, 1],
      ["sp5", "速さ補正：残り20%未満", -5, -100, 100, 1],
      ["t_lv1", "制限時間：Lv1 単語四択（秒）", 10, 1, 300, 1],
      ["t_lv2", "制限時間：Lv2 単語四択＋なし（秒）", 12, 1, 300, 1],
      ["t_lv3", "制限時間：Lv3 単語スペル補う（秒）", 15, 1, 300, 1],
      ["t_lv4", "制限時間：Lv4 単語音声入力（秒）", 16, 1, 300, 1],
      ["t_lv5", "制限時間：Lv5 単語タイピング（秒）", 22, 1, 300, 1],
      ["t_lv6", "制限時間：Lv6 表現並び替え過不足なし（秒）", 25, 1, 300, 1],
      ["t_lv7", "制限時間：Lv7 表現並び替え不要語排除（秒）", 28, 1, 300, 1],
      ["t_lv8", "制限時間：Lv8 表現並び替え＋1補う（秒）", 30, 1, 300, 1],
      ["t_lv9", "制限時間：Lv9 表現音声入力（秒）", 18, 1, 300, 1],
      ["t_lv10", "制限時間：Lv10 表現タイピング（秒）", 25, 1, 300, 1],
      ["time", "制限時間の全体倍率", 1, 0.2, 10, 0.1]
    ]],
    ["必殺技・とくぎ", [
      ["spPow", "必殺技の威力（通常の何倍か）", 3, 0.5, 50, 0.1], ["spSureLv", "必殺技が必中になるLv", 10, 1, 999, 1],
      ["spDrainLv", "必殺技が吸収を得るLv", 20, 1, 999, 1], ["spDrain", "必殺技の吸収量（与ダメージの%）", 20, 0, 100, 1],
      ["spAllLv", "必殺技が全体攻撃になるLv", 30, 1, 999, 1],
      ["s1lv", "二連切：習得Lv", 5, 1, 999, 1], ["s1mp", "二連切：消費MP", 4, 0, 999, 1], ["s1pow", "二連切：1発の威力（%）", 60, 1, 1000, 5],
      ["s2lv", "回転切り：習得Lv", 10, 1, 999, 1], ["s2mp", "回転切り：消費MP", 6, 0, 999, 1], ["s2pow", "回転切り：威力（%）", 60, 1, 1000, 5],
      ["s3lv", "三連斬：習得Lv", 15, 1, 999, 1], ["s3mp", "三連斬：消費MP", 8, 0, 999, 1], ["s3pow", "三連斬：1発の威力（%）", 50, 1, 1000, 5],
      ["s4lv", "竜巻切り：習得Lv", 20, 1, 999, 1], ["s4mp", "竜巻切り：消費MP", 10, 0, 999, 1], ["s4pow", "竜巻切り：威力（%）", 70, 1, 1000, 5]
    ]],
    ["回復", [
      ["stairHeal", "階段を降りたときのHP・MP回復（%）", 20, 0, 100, 1],
      ["revive", "復活の首飾りで戻るHP（%）", 50, 1, 100, 1]
    ]],
    ["どうぐ", [
      ["iPot", "初期所持：ポーション", 3, 0, 99, 1], ["iEth", "初期所持：まりょくの水", 2, 0, 99, 1],
      ["iWing", "初期所持：みちびきのコンパス", 1, 0, 99, 1], ["iGate", "初期所持：さいしんの渦", 1, 0, 99, 1],
      ["iNeck", "初期所持：復活の首飾り", 1, 0, 99, 1],
      ["chestMin", "1階あたりの宝箱の数", 1, 0, 10, 1], ["chest2", "宝箱がもう1つ出る確率（%）", 40, 0, 100, 1],
      ["dNeck", "宝箱：復活の首飾りの確率（%）", 1.5, 0, 100, 0.1], ["dPot", "宝箱：ポーションの比率", 50, 0, 1000, 1],
      ["dEth", "宝箱：まりょくの水の比率", 28, 0, 1000, 1], ["dWing", "宝箱：コンパスの比率", 12, 0, 1000, 1],
      ["dGate", "宝箱：さいしんの渦の比率", 10, 0, 1000, 1]
    ]]
  ];

  const DEF = {};
  SCHEMA.forEach(g => g[1].forEach(r => { DEF[r[0]] = r[2]; }));
  const CFG = Object.assign({}, DEF);
  const CKEY = "tango-meikyu-v1-cfg";
  function setCfg(o) {
    if (o) {
      for (const k in DEF) {
        if (typeof o[k] === "number" && isFinite(o[k])) CFG[k] = o[k];
      }
    }
  }
  function saveCfg() {
    try { localStorage.setItem(CKEY, JSON.stringify(CFG)); } catch(e) {}
  }
  try { setCfg(JSON.parse(localStorage.getItem(CKEY))); } catch(e) {}

  const pAtk = L => CFG.atk0 + CFG.atkLv * (L - 1);
  const pMaxHp = L => CFG.hp0 + CFG.hpLv * (L - 1);
  const pMaxMp = L => CFG.mp0 + CFG.mpLv * (L - 1);
  const SK = [["二連切", 2, false], ["回転切り", 1, true], ["三連斬", 3, false], ["竜巻切り", 1, true]];
  const skills = () => SK.map((k, i) => ({ n: k[0], hits: k[1], all: k[2], lv: CFG["s" + (i + 1) + "lv"], mp: CFG["s" + (i + 1) + "mp"], pow: CFG["s" + (i + 1) + "pow"] / 100 }));
  const firstSkillLv = () => Math.min(CFG.s1lv, CFG.s2lv, CFG.s3lv, CFG.s4lv);
  const expNext = L => Math.max(1, CFG.exp0 + CFG.expLv * (L - 1));

  const GEAR = ["ブロンズ", "アイアン", "スチール", "シルバー", "プラチナ", "ダークスチール", "ミスリル", "アダマンタイト", "ヒヒイロカネ", "オリハルコン"];
  const SLOTS = [["helm", "ヘルム", "⛑️"], ["armor", "アーマー", "👕"], ["legs", "レギンス", "👖"], ["gaunt", "ガントレット", "🧤"], ["boots", "ブーツ", "👢"], ["shield", "シールド", "🛡️"], ["sword", "ソード", "🗡️"]];
  const gearVal = (slot, t) => t < 1 ? 0 : CFG["g" + t + (slot === "sword" ? "s" : "d")];
  const tierAt = f => Math.min(10, Math.floor((f - 1) / 10) + 1);
  const expAtk = f => pAtk(f) + gearVal("sword", tierAt(f));
  const expDef = f => 6 * gearVal("helm", tierAt(f));
  const atkNow = () => pAtk(S.p.lv) + gearVal("sword", S.p.eq.sword);
  const defNow = () => SLOTS.reduce((a, x) => a + (x[0] === "sword" ? 0 : gearVal(x[0], S.p.eq[x[0]])), 0);
  const needEquip = () => SLOTS.some(x => S.p.eq[x[0]] < S.p.gearMax);
  const fullSet = t => { const o = {}; SLOTS.forEach(x => { o[x[0]] = t; }); return o; };
  function fillGear(p, cleared) {
    if (!p.eq || !p.gearMax) {
      p.gearMax = Math.min(10, Math.floor((cleared || 0) / 10) + 1);
      p.eq = fullSet(p.gearMax);
    }
  }

  const kHits = f => CFG.K * (1 + CFG.depth * (f - 1) / 99);
  const nHits = f => CFG.N / (1 + CFG.depth * (f - 1) / 99);
  const archOf = i => ({ hp: CFG["a" + i + "hp"], atk: CFG["a" + i + "atk"], eva: CFG["a" + i + "eva"] });
  const MON = [
    [["🦠", "スライム"], ["🦇", "コウモリ"], ["🐢", "おおガメ"], ["👻", "ゴースト"]],
    [["🐍", "どくヘビ"], ["🕷️", "おおグモ"], ["🐗", "あばれイノシシ"], ["💀", "スケルトン"]],
    [["🦂", "おおサソリ"], ["🦅", "まちょう"], ["🗿", "ゴーレム"], ["🧟", "ゾンビ"]],
    [["🐺", "ヤミオオカミ"], ["🧛", "きゅうけつき"], ["👹", "オーガ"], ["🧙", "まどうし"]],
    [["👿", "アークデーモン"], ["😈", "インプ"], ["🦖", "だいきょうりゅう"], ["☠️", "しにがみ"]]
  ];
  const bandOf = f => Math.min(4, Math.floor((f - 1) / 20));
  function monStats(f, a, boss) {
    const hp = Math.round(expAtk(f) * kHits(f) * a.hp * (boss ? CFG.bh : 1));
    const atk = Math.round(pMaxHp(f) / nHits(f) * a.atk * (boss ? CFG.ba : 1) + expDef(f) * CFG.defCoef);
    const exp = Math.round(expNext(f) / CFG.expDiv * a.hp * a.atk * (boss ? CFG.bossExp : 1));
    return { hp, atk, exp };
  }
  function makeMon(f, ai, boss) {
    const a = boss ? { hp: 1, atk: 1, eva: CFG.bEva } : archOf(ai);
    const s = monStats(f, a, boss);
    const v = boss ? ["🐉", f + "階の守護竜"] : MON[bandOf(f)][ai];
    return { g: v[0], name: v[1], hp: s.hp, max: s.hp, atk: s.atk, exp: s.exp, eva: a.eva, boss: !!boss };
  }

  const ITEMS = {
    pot: { ic: "🧪", n: "ポーション" }, eth: { ic: "💧", n: "まりょくの水" },
    wing: { ic: "🧭", n: "みちびきのコンパス" }, gate: { ic: "🌀", n: "さいしんの渦" },
    neck: { ic: "📿", n: "復活の首飾り" }
  };
  const fillItems = it => Object.assign({ pot: 0, eth: 0, wing: 0, gate: 0, neck: 0 }, it);
  const roll = p => Math.random() * 100 < p;
  const loot = () => {
    if (roll(CFG.dNeck)) return "neck";
    const w = [["pot", CFG.dPot], ["eth", CFG.dEth], ["wing", CFG.dWing], ["gate", CFG.dGate]];
    const tot = w.reduce((a, x) => a + x[1], 0);
    let r = Math.random() * tot;
    for (const x of w) { r -= x[1]; if (r < 0) return x[0]; }
    return "pot";
  };

  const bonus = L => CFG.base + CFG.perLv * L;
  const spdOf = r => {
    const left = 1 - r;
    return left >= 0.8 ? CFG.sp1 : left >= 0.6 ? CFG.sp2 : left >= 0.4 ? CFG.sp3 : left >= 0.2 ? CFG.sp4 : CFG.sp5;
  };
  const pct = res => res.ok ? bonus(res.L) + res.sp : CFG.base;

  const KIND = {
    atk: ["⚔️", "こうげき", L => "クリティカル率 " + bonus(L) + "%"],
    skill: ["🗡️", "とくぎ", L => "1発ごとのクリティカル率 " + bonus(L) + "%"],
    guard: ["🛡️", "ぼうぎょ", L => "被ダメージを " + (100 - CFG.perLv * L) + "% に"],
    evade: ["👟", "かいひ", L => "回避率 " + bonus(L) + "%"],
    heal: ["💖", "HPかいふく", L => "最大HPの " + bonus(L) + "% 回復"],
    mp: ["💧", "MPかいふく", L => "最大MPの " + bonus(L) + "% 回復"],
    first: ["⚡", "先制", L => "先制率 " + bonus(L) + "%"],
    flee: ["🏃", "にげる", L => "成功率 " + bonus(L) + "%"]
  };

  /* ---------- ゲーム内状態 ---------- */
  let S = { screen: "title" };
  const W = 11, H = 11, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const clone = o => JSON.parse(JSON.stringify(o));

  function genFloor(f) {
    const cells = new Array(W * H).fill(1);
    let x = 1 + ri(W - 2), y = 1 + ri(H - 2);
    const sx = x, sy = y;
    let open = 1, guard = 0;
    cells[y * W + x] = 0;
    while (open < 50 && guard++ < 8000) {
      const d = DIRS[ri(4)], nx = x + d[0], ny = y + d[1];
      if (nx < 1 || ny < 1 || nx > W - 2 || ny > H - 2) continue;
      x = nx; y = ny;
      if (cells[y * W + x]) { cells[y * W + x] = 0; open++; }
    }
    const dist = new Array(W * H).fill(-1);
    dist[sy * W + sx] = 0;
    const q = [sy * W + sx];
    let far = sy * W + sx;
    while (q.length) {
      const c = q.shift(), cx = c % W, cy = (c - cx) / W;
      for (const d of DIRS) {
        const i = (cy + d[1]) * W + cx + d[0];
        if (cells[i] === 0 && dist[i] < 0) {
          dist[i] = dist[c] + 1;
          q.push(i);
          if (dist[i] > dist[far]) far = i;
        }
      }
    }
    const free = [];
    for (let i = 0; i < W * H; i++) if (cells[i] === 0 && i !== far && dist[i] >= 2) free.push(i);
    shuffle(free);
    const ents = {}, boss = f % 10 === 0;
    const nm = CFG.monMin + ri(Math.max(0, CFG.monMax - CFG.monMin) + 1);
    const nc = CFG.chestMin + (roll(CFG.chest2) ? 1 : 0);
    for (let k = 0; k < nm && free.length; k++) ents[free.pop()] = { t: "mon", a: ri(4) };
    for (let k = 0; k < nc && free.length; k++) ents[free.pop()] = { t: "chest" };
    if (boss) ents[far] = { t: "boss" };
    S.map = { cells, seen: new Array(W * H).fill(0), px: sx, py: sy, stairs: far, ents };
    reveal();
  }

  function reveal() {
    const m = S.map;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = m.px + dx, y = m.py + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) m.seen[y * W + x] = 1;
      }
    }
  }

  function log(t) {
    if (!S.log) S.log = [];
    S.log.push(t);
    if (S.log.length > 40) S.log.shift();
  }

  function newState(f, practice) {
    return {
      screen: "explore", floor: f, practice: !!practice,
      cleared: practice ? f - 1 : 0, diff: (S && S.diff) || 5,
      p: {
        lv: f, exp: 0, hp: pMaxHp(f), mp: pMaxMp(f), gauge: 0,
        gearMax: practice ? tierAt(f) : 1, eq: fullSet(practice ? tierAt(f) : 1),
        it: { pot: CFG.iPot, eth: CFG.iEth, wing: CFG.iWing, gate: CFG.iGate, neck: CFG.iNeck }
      },
      st: { ok: 0, total: 0, kills: 0 },
      log: [], b: null, map: null
    };
  }

  function start(f, practice) {
    S = newState(f, practice);
    if (!practice) {
      const rec = loadTowerRec();
      rec.save = null;
      saveTowerRec(rec);
    }
    se("game_start");
    enterFloor("地下 " + f + " 階に おりたった。");
  }

  function resume() {
    const rec = loadTowerRec();
    const v = rec.save;
    if (!v) return start(1, false);
    S = newState(v.floor, false);
    S.cleared = v.cleared; S.diff = v.diff || 5; S.p = clone(v.p);
    S.p.it = fillItems(S.p.it); fillGear(S.p, S.cleared); S.st = clone(v.st);
    se("game_start");
    enterFloor("地下 " + v.floor + " 階から さいかい。");
  }

  function enterFloor(msg) {
    genFloor(S.floor);
    S.screen = "explore";
    S.b = null;
    log(msg);
    render();
    curtain("地下 " + S.floor + " 階");
    winExplore(S.floor % 10 === 0 ? "つよい けはいが する…" : "どちらへ すすむ？");
  }

  function autosave() {
    if (S.practice) return;
    const rec = loadTowerRec();
    if (S.floor > rec.best) rec.best = S.floor;
    rec.save = { floor: S.floor, cleared: S.cleared, diff: S.diff, p: clone(S.p), st: clone(S.st) };
    saveTowerRec(rec);
  }

  /* ---------- 効果音 / BGM ---------- */
  const SE = {}, SE_TOTAL = 44;
  let seOn = true, bgmOn = true;
  try {
    const v = JSON.parse(localStorage.getItem("tango-meikyu-se") || "null");
    if (v) {
      if (typeof v.on === "boolean") seOn = v.on;
      if (typeof v.bgm === "boolean") bgmOn = v.bgm;
    }
  } catch(e) {}
  function saveSnd() {
    try { localStorage.setItem("tango-meikyu-se", JSON.stringify({ on: seOn, bgm: bgmOn })); } catch(e) {}
  }

  const BGM = {}, BGM_TOTAL = 4;
  let bgmCur = 0;
  function bgmWant() {
    if (S.screen === "explore") return 1;
    if (S.screen === "battle") return S.b && S.b.m.boss ? 3 : 2;
    if (S.screen === "clear") return 4;
    return 0;
  }
  function bgmUpdate() {
    const k = bgmOn ? bgmWant() : 0, a = BGM[k];
    if (k === bgmCur && (!a || !a.paused)) return;
    if (bgmCur && BGM[bgmCur]) BGM[bgmCur].pause();
    bgmCur = k;
    if (!a) return;
    a.currentTime = 0;
    const pr = a.play();
    if (pr) pr.catch(() => {});
  }
  function seLoad(files) {
    let n = 0;
    for (const f of files) {
      const bm = /^bgm0*(\d+)[_\-. ]/i.exec(f.name);
      if (bm && /\.(mp3|m4a|ogg|wav|aac)$/i.test(f.name)) {
        const k = +bm[1];
        if (BGM[k]) { BGM[k].pause(); URL.revokeObjectURL(BGM[k].src); if (bgmCur === k) bgmCur = 0; }
        const b = new Audio(URL.createObjectURL(f));
        b.loop = true; b.volume = 0.35; b.preload = "auto"; BGM[k] = b; n++; continue;
      }
      const m = /^se\d{2}_([a-z_]+?)__.*\.mp3$/i.exec(f.name);
      if (!m) continue;
      const k = m[1].toLowerCase();
      if (SE[k]) URL.revokeObjectURL(SE[k].src);
      const a = new Audio(URL.createObjectURL(f));
      a.preload = "auto"; SE[k] = a; n++;
    }
    seStatus();
    return n;
  }
  function se(k, delay) {
    const a = SE[k];
    if (!a || !seOn) return;
    const go = () => {
      try {
        const x = a.cloneNode();
        x.volume = 0.7;
        const pr = x.play();
        if (pr) pr.catch(() => {});
      } catch(e) {}
    };
    delay ? setTimeout(go, delay) : go();
  }
  function seStatus() {
    const n = Object.keys(SE).length;
    const nb = Object.keys(BGM).length;
    const statEl = document.getElementById("dungeon-seStat");
    if (statEl) {
      statEl.textContent = (n || nb) ? `読込済: 効果音 ${n}/${SE_TOTAL}・BGM ${nb}/${BGM_TOTAL}` : "効果音なし";
    }
    const seMuteBtn = document.getElementById("dungeon-seMute");
    const bgmMuteBtn = document.getElementById("dungeon-bgmMute");
    if (seMuteBtn) seMuteBtn.textContent = seOn ? "🔊 効果音: ON" : "🔇 効果音: OFF";
    if (bgmMuteBtn) bgmMuteBtn.textContent = bgmOn ? "🎵 BGM: ON" : "🚫 BGM: OFF";
  }

  const SKEY = {
    "二連切": "skill_nirengiri", "回転切り": "skill_kaitengiri",
    "三連斬": "skill_sanrenzan", "竜巻切り": "skill_tatsumakigiri"
  };

  /* ---------- エフェクト ---------- */
  function pulse(cls, ms) {
    const wrap = document.querySelector("#section-dungeon .dungeon-stagewrap");
    if (!wrap) return;
    wrap.classList.remove(cls);
    void wrap.offsetWidth;
    wrap.classList.add(cls);
    setTimeout(() => wrap.classList.remove(cls), ms || 600);
  }
  function pop(text, cls, delay, me) {
    setTimeout(() => {
      const fxEl = document.getElementById("dungeon-fx");
      if (!fxEl) return;
      const e = document.createElement("div");
      e.className = "dungeon-pop " + (cls || "");
      e.textContent = text;
      e.style.left = (me ? 50 : 30 + Math.random() * 40) + "%";
      e.style.top = (me ? 78 : 34 + Math.random() * 14) + "%";
      fxEl.appendChild(e);
      setTimeout(() => e.remove(), 1150);
    }, delay || 0);
  }
  function gl(cls) {
    const g = document.getElementById("dungeon-glyph");
    if (!g) return;
    g.classList.remove("hit", "crit", "dodge", "lunge", "appear", "regen");
    void g.offsetWidth;
    g.classList.add(cls);
  }
  function curtain(text) {
    const fxEl = document.getElementById("dungeon-fx");
    if (!fxEl) return;
    const e = document.createElement("div");
    e.className = "dungeon-curtain";
    e.textContent = text;
    fxEl.appendChild(e);
    setTimeout(() => e.remove(), 1150);
  }

  /* ---------- 描画 ---------- */
  function render() {
    renderStage();
    renderStatus();
    renderLog();
    bgmUpdate();
    const bestEl = document.getElementById("dungeon-best");
    const rec = loadTowerRec();
    if (bestEl) bestEl.textContent = rec.best ? `地下 ${rec.best} 階` : "—";
    
    const subTitle = document.getElementById("dungeon-tower-subtitle");
    if (subTitle && currentTower) {
      subTitle.textContent = `【${currentTower.name}】`;
    }
  }

  function mini(c, v, mx, l) {
    return `<span class="dungeon-mini"><em>${l} ${v}</em><span class="dungeon-bar ${c}"><i style="width:${Math.max(0, Math.min(100, 100 * v / mx))}%"></i></span></span>`;
  }
  function hud() {
    const p = S.p;
    const maxF = currentTower ? (currentTower.maxFloor || 100) : 100;
    return `<div class="dungeon-hud"><span class="fl">地下 ${S.floor}/${maxF} 階${S.floor % 10 === 0 ? " 🐉" : ""}</span><span>Lv${p.lv}${S.practice ? "・練習" : ""}</span>` +
      mini("hp", p.hp, pMaxHp(p.lv), "HP") +
      mini("mp", p.mp, pMaxMp(p.lv), "MP") +
      mini("sp", p.gauge, 100, "必殺") + `</div>`;
  }

  function renderStage() {
    const stage = document.getElementById("dungeon-stage");
    if (!stage) return;

    if (S.screen === "title") {
      stage.innerHTML = `<div class="dungeon-result"><div class="dungeon-big">${currentTower ? currentTower.name : "迷宮"}</div><p>${currentTower ? currentTower.desc : "正解の むずかしさと速さが、そのまま力になる。"}</p><p style="color:var(--muted)">地下${currentTower ? currentTower.maxFloor : 100}階まで、どこまで もぐれるか。</p></div>`;
      return;
    }
    if (S.screen === "over" || S.screen === "clear") {
      const r = S.result;
      stage.innerHTML = `<div class="dungeon-result"><div class="dungeon-big">${S.screen === "clear" ? "踏破！" : "全滅"}</div><p>到達 地下 ${r.floor} 階 ／ Lv ${r.lv}</p><p>正答率 ${r.acc}%（${r.ok} / ${r.total}）・たおした数 ${r.kills}</p>${r.isNew ? '<p class="new">きろく こうしん！</p>' : ''}${r.practice ? '<p style="color:var(--muted)">練習のため記録なし</p>' : ''}</div>`;
      return;
    }
    if (S.screen === "battle") {
      const m = S.b.m;
      stage.innerHTML = hud() + `<div class="dungeon-scene"><div class="dungeon-glyph${m.boss ? " boss" : ""}" id="dungeon-glyph">${m.g}</div><div class="dungeon-mname">${m.name}</div><div class="dungeon-bar"><i style="width:${Math.max(0, Math.min(100, 100 * m.hp / m.max))}%"></i></div><div style="color:var(--muted);font-size:13px">HP ${m.hp} / ${m.max}　こうげき ${m.atk}</div></div>`;
      return;
    }

    const m = S.map;
    let h = hud() + '<div class="dungeon-map">';
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i - x) / W;
      let cls = "c", g = "";
      if (!m.seen[i]) cls += " u";
      else if (m.cells[i] === 0) {
        cls += " f";
        const e = m.ents[i];
        if (x === m.px && y === m.py) { cls += " me"; g = "🤺"; }
        else if (e) {
          if (e.t === "mon") { cls += " mon"; g = MON[bandOf(S.floor)][e.a][0]; }
          else if (e.t === "boss") { cls += " boss"; g = "🐉"; }
          else { cls += " chest"; g = "🎁"; }
        } else if (i === m.stairs) { cls += " st"; g = "🪜"; }
        if (Math.abs(x - m.px) + Math.abs(y - m.py) === 1) cls += " adj";
      }
      h += `<div class="${cls}" data-i="${i}">${g}</div>`;
    }
    stage.innerHTML = h + '</div>';
  }

  function renderStatus() {
    const el = document.getElementById("dungeon-status");
    if (!el) return;
    if (!S.p) { el.innerHTML = '<dt>—</dt><dd>ぼうけんを はじめよう</dd>'; return; }
    const p = S.p, mx = pMaxHp(p.lv), it = p.it;
    el.innerHTML = `<dt>塔</dt><dd>${currentTower ? currentTower.name : "単語迷宮"}</dd>` +
      `<dt>レベル</dt><dd>${p.lv}</dd>` +
      `<dt>HP</dt><dd>${p.hp} / ${mx}<div class="dungeon-bar hp"><i style="width:${Math.max(0, Math.min(100, 100 * p.hp / mx))}%"></i></div></dd>` +
      `<dt>MP</dt><dd>${p.mp} / ${pMaxMp(p.lv)}<div class="dungeon-bar mp"><i style="width:${Math.max(0, Math.min(100, 100 * p.mp / pMaxMp(p.lv)))}%"></i></div></dd>` +
      `<dt>こうげき</dt><dd>${atkNow()}（剣 +${gearVal("sword", p.eq.sword)}）</dd>` +
      `<dt>ぼうぎょ</dt><dd>${defNow()}</dd>` +
      `<dt>ひっさつ</dt><dd>${p.gauge}%<div class="dungeon-bar sp"><i style="width:${p.gauge}%"></i></div></dd>` +
      `<dt>けいけん</dt><dd>${p.exp} / ${expNext(p.lv)}<div class="dungeon-bar xp"><i style="width:${Math.max(0, Math.min(100, 100 * p.exp / expNext(p.lv)))}%"></i></div></dd>` +
      `<dt>どうぐ</dt><dd>${Object.keys(ITEMS).map(k => ITEMS[k].ic + it[k]).join("　")}</dd>` +
      `<dt>踏破</dt><dd>${S.cleared ? `地下 ${S.cleared} 階まで` : "まだなし"}</dd>` +
      `<dt>正答</dt><dd>${S.st.ok} / ${S.st.total}</dd>`;
  }

  function renderLog() {
    const el = document.getElementById("dungeon-log");
    if (!el) return;
    el.innerHTML = (S.log || []).map(t => "<p>" + t + "</p>").join("");
    el.scrollTop = el.scrollHeight;
  }

  /* ---------- 冒険メニュー (ステータス・きろく・音声設定) ---------- */
  function openDungeonMenu(defaultTab) {
    const modal = document.getElementById("dungeon-menu-modal");
    if (!modal) return;
    modal.style.display = "flex";
    applyDungeonPadModeUI();
    renderStatus();
    renderLog();
    seStatus();
    switchDungeonMenuTab(defaultTab || "stat");
    se("select");
  }

  function closeDungeonMenu() {
    const modal = document.getElementById("dungeon-menu-modal");
    if (!modal) return;
    modal.style.display = "none";
    se("cancel");
  }

  function switchDungeonMenuTab(tab) {
    const tabs = ["stat", "log", "sound"];
    tabs.forEach(t => {
      const btn = document.getElementById("dungeon-tab-btn-" + t);
      const panel = document.getElementById("dungeon-tab-panel-" + t);
      if (btn) btn.classList.toggle("active", t === tab);
      if (panel) panel.style.display = (t === tab) ? "block" : "none";
    });
    if (tab === "stat") renderStatus();
    else if (tab === "log") {
      renderLog();
      const logEl = document.getElementById("dungeon-log");
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    } else if (tab === "sound") {
      applyDungeonPadModeUI();
      seStatus();
    }
  }

  function handleDungeonMenuOverlayClick(e) {
    if (e.target && e.target.id === "dungeon-menu-modal") {
      closeDungeonMenu();
    }
  }

  /* ---------- Nintendo Wii風 縦向きパッド (十字キーが一番下) ---------- */
  function updateWiiPad() {
    const pad = document.getElementById("dungeon-wii-pad");
    if (!pad) return;

    // スマホモード（下部）のときはWiiパッドは表示しない（二重化防止）
    if (dungeonPadMode === "bottom") {
      pad.style.display = "none";
      return;
    }

    pad.style.display = "flex";

    // モードUI反映
    applyDungeonPadModeUI();

    // そうびボタンのNEWバッジとクリックイベント
    const eqb = document.getElementById("dungeon-wii-eqb");
    if (eqb) {
      eqb.innerHTML = '🛡️ そうび' + (needEquip() ? '<span class="badge">NEW</span>' : '');
      eqb.onclick = winEquip;
    }

    // どうぐボタン
    const bag = document.getElementById("dungeon-wii-bag");
    if (bag) {
      bag.onclick = () => winItems("どちらへ すすむ？");
    }

    // メニューボタン
    const menuBtn = document.getElementById("dungeon-wii-menu");
    if (menuBtn) {
      menuBtn.onclick = () => openDungeonMenu();
    }
    const centerBtn = document.getElementById("dungeon-dpad-center-btn");
    if (centerBtn) {
      centerBtn.onclick = () => openDungeonMenu();
    }

    // 十字キー (移動)
    pad.querySelectorAll(".dungeon-dpad button[data-d]").forEach(b => {
      b.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const d = b.dataset.d.split(",");
        move(+d[0], +d[1]);
      };
    });
  }

  function hideWiiPad() {
    const pad = document.getElementById("dungeon-wii-pad");
    if (pad) pad.style.display = "none";
  }

  let quizKey = null, raf = 0, currentRecognition = null;

  function say(t) {
    const win = document.getElementById("dungeon-win");
    if (win) win.innerHTML = `<p class="dungeon-msg">${t}</p>`;
  }

  function winMenu(msg) {
    hideWiiPad();
    const rec = loadTowerRec();
    const v = rec.save;
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">${msg}</p><div class="dungeon-btns">${v ? '<button id="dungeon-cont" type="button">つづきから<small>地下 ' + v.floor + ' 階・Lv ' + v.p.lv + '</small></button>' : ''}<button id="dungeon-go" type="button">地下1階から はじめる${v ? '<small>セーブは消えます</small>' : ''}</button></div>`;
    const contBtn = document.getElementById("dungeon-cont");
    if (contBtn) contBtn.onclick = resume;
    let armed = !v;
    const goBtn = document.getElementById("dungeon-go");
    if (goBtn) {
      goBtn.onclick = () => {
        if (armed) return start(1, false);
        armed = true;
        goBtn.innerHTML = 'ほんとうに はじめから？<small>もういちど押すと開始</small>';
      };
    }
  }

  function winTitle() { winMenu("ぼうけんを はじめますか？"); }
  function winEnd() {
    hideWiiPad();
    const rec = loadTowerRec();
    winMenu(S.screen === "clear" ? `${currentTower.name}を踏破した！` : (rec.save && !S.practice ? `ちからつきた… 地下 ${rec.save.floor} 階の はじめから やりなおせる。` : "ちからつきた…"));
  }

  function diffRow() {
    let h = '<div class="dungeon-diff"><span>難易度</span>';
    for (let n = 1; n <= 10; n++) {
      h += `<button type="button" class="dungeon-dchip${n === S.diff ? " on" : ""}" data-l="${n}" aria-label="難易度${n}">${n}</button>`;
    }
    const info = LV_INFO[S.diff];
    return h + `</div><p class="dungeon-dnote">${info.name}・正解で効果 ${bonus(S.diff)}%＋はやさ補正（不正解は ${CFG.base}%）</p>`;
  }

  function bindDiff(refresh) {
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.querySelectorAll(".dungeon-dchip").forEach(b => b.onclick = () => {
      S.diff = +b.dataset.l;
      refresh();
    });
  }

  function winNext(t) {
    hideWiiPad();
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">${t}</p><div class="dungeon-btns"><button id="dungeon-next" type="button">🪜 次の階へ おりる ▶</button></div>`;
    const b = document.getElementById("dungeon-next");
    if (b) {
      b.onclick = () => { b.disabled = true; se("stairs"); descend(); };
      setTimeout(() => { try { b.focus(); } catch(e) {} }, 400);
    }
  }

  function winExplore(t) {
    updateWiiPad();
    const win = document.getElementById("dungeon-win");
    if (!win) return;

    if (dungeonPadMode === "bottom") {
      // スマホモード（下部に以前の配置で十字キーを表示）
      win.innerHTML = `<div class="dungeon-explore">` +
        `<div>` +
          `<p class="dungeon-msg">${t}</p>` +
          `<div class="dungeon-btns">` +
            `<button id="dungeon-bag" type="button">🎒 どうぐ</button>` +
            `<button id="dungeon-eqb" type="button">🛡️ そうび${needEquip() ? '<span class="badge">NEW</span>' : ''}</button>` +
            `<button id="dungeon-cmd-menu" type="button">📋 メニュー</button>` +
          `</div>` +
          `<div style="margin-top:8px;">` +
            `<button type="button" class="dungeon-btn dungeon-hand-switch-btn" style="width:auto;display:inline-block;padding:2px 8px;font-size:11px;" onclick="toggleDungeonPadMode()">` +
              `<span>📱 スマホモード（下部）</span> ⇄ 切替` +
            `</button>` +
          `</div>` +
        `</div>` +
        `<div class="dungeon-dpad">` +
          `<button class="up" data-d="0,-1" type="button" aria-label="上へ">▲</button>` +
          `<button class="lf" data-d="-1,0" type="button" aria-label="左へ">◀</button>` +
          `<button class="menu" id="dungeon-dpad-menu-bottom" type="button" aria-label="メニューを開く">メニュー</button>` +
          `<button class="rt" data-d="1,0" type="button" aria-label="右へ">▶</button>` +
          `<button class="dn" data-d="0,1" type="button" aria-label="下へ">▼</button>` +
        `</div>` +
      `</div>`;

      win.querySelectorAll(".dungeon-dpad button[data-d]").forEach(b => {
        b.onclick = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          const d = b.dataset.d.split(",");
          move(+d[0], +d[1]);
        };
      });
      const dpadMenu = document.getElementById("dungeon-dpad-menu-bottom");
      if (dpadMenu) dpadMenu.onclick = () => openDungeonMenu();
    } else {
      // 右利き（右側縦パッド）または左利き（左側縦パッド）のときは下部にD-padは出さない（二重化防止）
      win.innerHTML = `<div class="dungeon-explore-compact">` +
        `<p class="dungeon-msg">${t}</p>` +
        `<div class="dungeon-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">` +
          `<button id="dungeon-bag" type="button">🎒 どうぐ</button>` +
          `<button id="dungeon-eqb" type="button">🛡️ そうび${needEquip() ? '<span class="badge">NEW</span>' : ''}</button>` +
          `<button id="dungeon-cmd-menu" type="button">📋 メニュー</button>` +
        `</div>` +
        `<p class="dungeon-note" style="margin-top:8px;font-size:12px;color:var(--muted)">縦向きパッドの十字キー・スワイプ・となりのマスをタップ・矢印キーでも動けるよ</p>` +
      `</div>`;
    }
    
    const bag = document.getElementById("dungeon-bag");
    if (bag) bag.onclick = () => winItems("どちらへ すすむ？");
    const eqb = document.getElementById("dungeon-eqb");
    if (eqb) eqb.onclick = winEquip;
    const cmdMenu = document.getElementById("dungeon-cmd-menu");
    if (cmdMenu) cmdMenu.onclick = () => openDungeonMenu();
  }

  function winEquip() {
    hideWiiPad();
    const p = S.p;
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">🛡️ そうび（こうげき ${atkNow()}・ぼうぎょ ${defNow()}）</p><div class="eqlist">${SLOTS.map(x => {
      const sw = x[0] === "sword";
      let o = "";
      for (let t = 1; t <= p.gearMax; t++) {
        o += `<option value="${t}"${p.eq[x[0]] === t ? " selected" : ""}>${GEAR[t - 1]}${x[1]}（${sw ? "攻" : "防"} +${gearVal(x[0], t)}）</option>`;
      }
      return `<label class="eqrow" for="eq_${x[0]}"><span>${x[2]} ${x[1]}${p.eq[x[0]] < p.gearMax ? '<span class="badge">NEW</span>' : ''}</span><select id="eq_${x[0]}">${o}</select></label>`;
    }).join("")}</div><div class="dungeon-btns" style="margin-top:10px"><button id="eqBest" type="button"${needEquip() ? "" : " disabled"}>いちばん強い装備にする</button><button id="dungeon-back" type="button">もどる</button></div>`;
    
    SLOTS.forEach(x => {
      const sel = document.getElementById("eq_" + x[0]);
      if (sel) sel.onchange = e => { p.eq[x[0]] = +e.target.value; se("equip"); renderStatus(); winEquip(); };
    });
    document.getElementById("eqBest").onclick = () => {
      p.eq = fullSet(p.gearMax);
      se("equip");
      log(GEAR[p.gearMax - 1] + "の装備を 身につけた。");
      renderStatus(); renderLog();
      pop("🛡️ そうび！", "guard", 0, true);
      winEquip();
    };
    document.getElementById("dungeon-back").onclick = () => winExplore("どちらへ すすむ？");
  }

  function winItems(t) {
    hideWiiPad();
    const p = S.p, it = p.it, inB = S.screen === "battle", b = bonus(S.diff);
    const maxF = currentTower ? (currentTower.maxFloor || 100) : 100;
    const newest = Math.min(maxF, S.cleared + 1);
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    const row = (k, dis, sub) => `<button type="button" data-it="${k}"${it[k] < 1 || dis ? " disabled" : ""}>${ITEMS[k].ic} ${ITEMS[k].n} ×${it[k]}<small>${sub}</small></button>`;
    
    win.innerHTML = `<p class="dungeon-msg">🎒 どうぐ${inB ? "（つかうと 1ターン消費）" : ""}</p>${diffRow()}<div class="dungeon-btns">` +
      row("pot", p.hp >= pMaxHp(p.lv), `クイズ正解で HP ${b}% 回復`) +
      row("eth", p.mp >= pMaxMp(p.lv), `クイズ正解で MP ${b}% 回復`) +
      row("wing", inB || S.cleared < 1, inB ? "戦闘中は使えない" : S.cleared < 1 ? "踏破した階が まだない" : `踏破した階（1〜${S.cleared}）へワープ`) +
      row("gate", inB || S.floor === newest, inB ? "戦闘中は使えない" : S.floor === newest ? "いまが いちばん新しい階" : `地下 ${newest} 階へワープ`) +
      row("neck", true, "戦闘で倒れると自動で発動（1戦闘に1回）") +
      '<button id="dungeon-back" type="button">もどる</button></div>';
    
    bindDiff(() => winItems(t));
    win.querySelectorAll("button[data-it]").forEach(x => x.onclick = () => {
      const k = x.dataset.it;
      if (k === "pot") ask(S.diff, "heal", r => doItem("pot", r));
      else if (k === "eth") ask(S.diff, "mp", r => doItem("eth", r));
      else if (k === "wing") winWarp(t);
      else warp(newest, "gate");
    });
    document.getElementById("dungeon-back").onclick = () => inB ? winCmd(t) : winExplore(t);
  }

  function winWarp(t) {
    hideWiiPad();
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">🧭 どの階へ とぶ？（1〜${S.cleared}）</p><form class="dungeon-typed" id="wform"><input type="number" id="warpF" min="1" max="${S.cleared}" value="${S.cleared}" aria-label="ワープ先の階"><button type="submit">ワープする</button><button id="dungeon-back" type="button">もどる</button></form>`;
    document.getElementById("wform").addEventListener("submit", e => {
      e.preventDefault();
      warp(Math.max(1, Math.min(S.cleared, Math.round(+document.getElementById("warpF").value || 1))), "wing");
    });
    document.getElementById("dungeon-back").onclick = () => winItems(t);
  }

  function warp(f, key) {
    S.p.it[key]--;
    S.floor = f;
    se("warp");
    pulse("fx-warp", 800);
    enterFloor(ITEMS[key].n + "で 地下 " + f + " 階へ ワープした。");
  }

  function winFirst() {
    hideWiiPad();
    const m = S.b.m;
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">${m.name}が あらわれた！</p>${diffRow()}<div class="dungeon-btns"><button id="dungeon-go" type="button">⚡ 先制クイズ<small>正解で先制率 ${bonus(S.diff)}%</small></button></div>`;
    bindDiff(winFirst);
    document.getElementById("dungeon-go").onclick = () => ask(S.diff, "first", doFirst);
  }

  function winCmd(t) {
    hideWiiPad();
    const p = S.p, m = S.b.m, b = bonus(S.diff), it = p.it;
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">${t}</p>${diffRow()}<div class="dungeon-btns"><button id="cA" type="button">⚔️ こうげき<small>クリティカル率 ${b}%・ゲージ +${b}</small></button><button id="cS" type="button"${p.gauge < 100 ? " disabled" : ""}>💥 ひっさつ<small>${p.gauge < 100 ? "ゲージ " + p.gauge + "%" : CFG.spPow + "倍" + (p.lv >= CFG.spSureLv ? "・必中" : "") + (p.lv >= CFG.spDrainLv ? "・吸収" + CFG.spDrain + "%" : "") + (p.lv >= CFG.spAllLv ? "・全体" : "")}</small></button><button id="cQ" type="button"${p.lv < firstSkillLv() ? " disabled" : ""}>🗡️ とくぎ<small>${p.lv < firstSkillLv() ? "Lv" + firstSkillLv() + "で習得" : "MP " + p.mp}</small></button><button id="cH" type="button">🎒 どうぐ<small>🧪${it.pot}　💧${it.eth}</small></button><button id="cF" type="button"${m.boss ? " disabled" : ""}>🏃 にげる<small>成功率 ${b}%</small></button></div>`;
    
    bindDiff(() => winCmd(t));
    document.getElementById("cA").onclick = () => ask(S.diff, "atk", doAttack);
    document.getElementById("cS").onclick = doSpecial;
    document.getElementById("cQ").onclick = () => winSkill(t);
    document.getElementById("cH").onclick = () => winItems(t);
    document.getElementById("cF").onclick = () => ask(S.diff, "flee", doFlee);
  }

  function winSkill(t) {
    hideWiiPad();
    const p = S.p;
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">🗡️ とくぎ（MP ${p.mp} / ${pMaxMp(p.lv)}）</p>${diffRow()}<div class="dungeon-btns">${skills().map((k, i) => `<button type="button" data-k="${i}"${p.lv < k.lv || p.mp < k.mp ? " disabled" : ""}>${k.n}<small>${p.lv < k.lv ? "Lv" + k.lv + "で習得" : "MP " + k.mp + "・威力" + Math.round(k.pow * 100) + "%" + (k.all ? " 敵全体" : " ×" + k.hits + "回")}</small></button>`).join("")}<button id="dungeon-back" type="button">もどる</button></div>`;
    
    bindDiff(() => winSkill(t));
    win.querySelectorAll("button[data-k]").forEach(b => b.onclick = () => {
      const k = skills()[+b.dataset.k];
      ask(S.diff, "skill", r => { S.p.mp -= k.mp; strike(r, k.pow, k.hits, k.n); }, k.n);
    });
    document.getElementById("dungeon-back").onclick = () => winCmd(t);
  }

  function winDefend(t) {
    hideWiiPad();
    const m = S.b.m, b = bonus(S.diff);
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    win.innerHTML = `<p class="dungeon-msg">${t} ${m.name}が おそいかかる！</p>${diffRow()}<div class="dungeon-btns"><button id="dG" type="button">🛡️ ぼうぎょ<small>被ダメージ ${100 - CFG.perLv * S.diff}% に軽減</small></button><button id="dE" type="button">👟 かいひ<small>回避率 ${b}%・失敗で満額</small></button></div>`;
    
    bindDiff(() => winDefend(t));
    document.getElementById("dG").onclick = () => ask(S.diff, "guard", r => doDefend("guard", r));
    document.getElementById("dE").onclick = () => ask(S.diff, "evade", r => doDefend("evade", r));
  }

  /* ---------- ダンジョン専用オンスクリーンキーボード連携 ---------- */
  function mountDungeonKeyboard(targetInputId, containerId, isSortMissing, onEnter, onAddCard) {
    if (typeof global.renderCustomKeyboard === "function") {
      try {
        global.renderCustomKeyboard(
          false, // isFillMode: false (ダンジョンは直接 input 要素に書き込むため)
          !!isSortMissing, // sortMissingMode (true の場合「カードにする」ボタンが表示される)
          containerId,
          targetInputId,
          onEnter,
          onAddCard
        );
      } catch(err) {
        console.warn("Failed to mount dungeon keyboard:", err);
      }
    }
  }

  /* ---------- クイズ本体 (ask) ---------- */
  function ask(L, kind, done, name) {
    hideWiiPad();
    const win = document.getElementById("dungeon-win");
    if (!win) return;
    const K = KIND[kind];
    const q = makeQ(L);
    const limit = tlim(L) * 1000;
    const t0 = performance.now();
    let fin = false, hurry = false;

    let h = `<div class="dungeon-qkind"><span class="dungeon-qic" aria-hidden="true">${K[0]}</span><div><b>${name || K[1]}クイズ</b><small>正解で ${K[2](L)}</small></div><span class="sec" id="dungeon-qsec"></span></div>` +
      `<div class="dungeon-qhead"><span>難易度 ${L}・${LV_INFO[L].name}</span></div>` +
      `<div class="dungeon-tbar"><i id="dungeon-tfill"></i></div>` +
      `<p class="dungeon-qprompt">${q.prompt}${q.hint ? '<small>' + q.hint + '</small>' : ''}</p>`;

    if (q.type === "choice") {
      h += `<div class="dungeon-choices${q.is5Choice ? ' choices-5' : ''}">${q.choices.map((c, i) => `<button data-c="${i}" type="button">${i + 1}. ${c}</button>`).join("")}</div>`;
    } else if (q.type === "spell") {
      h += `<div class="dungeon-spell-display">${q.hint}</div>` +
        `<form class="dungeon-typed" id="dungeon-qform"><input type="text" id="dungeon-qin" readonly inputmode="none" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="抜けた文字または単語を入力" aria-label="英語で入力"><button type="submit" class="dungeon-btn" style="display:none;">こたえる</button></form>` +
        `<div id="dungeon-keyboard-container" class="dungeon-keyboard-wrap"></div>`;
    } else if (q.type === "voice") {
      h += `<div class="dungeon-voice-box">` +
        `<button type="button" id="dungeon-voice-btn" class="dungeon-voice-btn">🎙️ マイクを押して英語で発音</button>` +
        `<div id="dungeon-voice-status" class="dungeon-voice-status">ボタンを押して英語で話してね</div>` +
        `<div id="dungeon-voice-fallback" style="margin-top:8px;">` +
        `<button type="button" id="dungeon-voice-switch" class="dungeon-btn" style="font-size:12px;padding:4px 8px;min-height:32px;">⌨️ 文字入力に切り替え</button>` +
        `</div>` +
        `<form class="dungeon-typed" id="dungeon-voice-form" style="display:none;width:100%;margin-top:8px;flex-direction:column;"><input type="text" id="dungeon-voice-in" readonly inputmode="none" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="英語で入力"><button type="submit" class="dungeon-btn" style="display:none;">決定</button><div id="dungeon-voice-keyboard-container" class="dungeon-keyboard-wrap" style="margin-top:8px;"></div></form>` +
        `</div>`;
    } else if (q.type === "sort") {
      const showMissing = q.variant === "missing";
      const showDummy = q.variant === "dummy";
      h += `<div class="dungeon-sort-area">` +
        (showMissing ? `<div style="display:flex;gap:6px;margin-bottom:6px;"><input type="text" id="dungeon-sort-missing-in" readonly inputmode="none" placeholder="足りない単語を入力" style="font-size:15px;padding:6px;flex:1;"><button type="button" id="dungeon-sort-add-btn" class="dungeon-btn" style="min-height:36px;padding:4px 10px;">＋カード追加</button></div><div id="dungeon-sort-keyboard-container" class="dungeon-keyboard-wrap" style="margin-bottom:8px;"></div>` : '') +
        `<div class="dungeon-sort-label"><span>回答枠（タップして並べる）</span><button type="button" id="dungeon-sort-clear-btn" class="dungeon-btn" style="min-height:28px;padding:2px 8px;font-size:11px;">クリア</button></div>` +
        `<div id="dungeon-sort-slot" class="dungeon-sort-slot"></div>` +
        `<div class="dungeon-sort-label" style="margin-top:8px;"><span>単語カード${showDummy ? '（1つ使わないカードがあるよ）' : ''}</span></div>` +
        `<div id="dungeon-sort-pool" class="dungeon-sort-pool"></div>` +
        `<button type="button" id="dungeon-sort-submit" class="dungeon-btn" style="width:100%;margin-top:10px;background:#2e7d32;display:none;">これで回答する ▶</button>` +
        `</div>`;
    } else {
      h += `<form class="dungeon-typed" id="dungeon-qform"><input type="text" id="dungeon-qin" readonly inputmode="none" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="英語で入力" aria-label="英語で入力"><button type="submit" class="dungeon-btn" style="display:none;">こたえる</button></form>` +
        `<div id="dungeon-keyboard-container" class="dungeon-keyboard-wrap"></div>`;
    }

    win.innerHTML = h + '<p class="dungeon-qres" id="dungeon-qres"></p>';

    const fill = document.getElementById("dungeon-tfill");
    const sec = document.getElementById("dungeon-qsec");

    function finish(ok, timeout, btn) {
      if (fin) return;
      fin = true;
      cancelAnimationFrame(raf);
      quizKey = null;
      if (currentRecognition) {
        try { currentRecognition.abort(); } catch(e) {}
        currentRecognition = null;
      }

      const r = Math.min(1, (performance.now() - t0) / limit);
      S.st.total++;
      if (ok) S.st.ok++;

      win.querySelectorAll("button, input").forEach(b => b.disabled = true);
      if (btn) btn.classList.add(ok ? "ok" : "ng");

      const res = document.getElementById("dungeon-qres");
      if (res) {
        res.className = "dungeon-qres " + (ok ? "ok" : "ng");
        const sp = spdOf(r);
        const correctDisplay = q.answer || (q.validAnswers && q.validAnswers[0]) || "";
        res.textContent = ok
          ? `せいかい！ はやさ補正 ${sp > 0 ? "+" : sp < 0 ? "−" : "±"}${Math.abs(sp)}% → 効果 ${bonus(L) + sp}%`
          : (timeout ? "じかんぎれ… " : "ざんねん… ") + `こたえは「${correctDisplay}」`;
      }

      se(ok ? "quiz_correct" : "quiz_wrong");
      if (ok && spdOf(r) >= CFG.sp1 && CFG.sp1 > CFG.sp2) se("speed_bonus", 250);
      setTimeout(() => done({ ok, r, L, sp: spdOf(r) }), ok ? 800 : 1600);
    }

    if (q.type === "choice") {
      const bs = win.querySelectorAll("button[data-c]");
      bs.forEach(b => b.onclick = () => finish(q.choices[+b.dataset.c] === q.answer, false, b));
      quizKey = k => {
        const n = "12345".indexOf(k);
        if (n >= 0 && bs[n]) bs[n].click();
      };
    } else if (q.type === "spell") {
      const inp = document.getElementById("dungeon-qin");
      const form = document.getElementById("dungeon-qform");
      const submitSpell = () => {
        if (fin) return;
        const val = normalizeText(inp ? inp.value : "");
        const ok = (val === normalizeText(q.rawWord)) || (val === normalizeText(q.missingChars));
        finish(ok, false, null);
      };
      if (form) form.addEventListener("submit", e => {
        e.preventDefault();
        submitSpell();
      });
      mountDungeonKeyboard("dungeon-qin", "dungeon-keyboard-container", false, submitSpell, null);
    } else if (q.type === "voice") {
      const voiceBtn = document.getElementById("dungeon-voice-btn");
      const vStatus = document.getElementById("dungeon-voice-status");
      const switchBtn = document.getElementById("dungeon-voice-switch");
      const vForm = document.getElementById("dungeon-voice-form");
      const vIn = document.getElementById("dungeon-voice-in");

      const submitVoiceFallback = () => {
        if (fin) return;
        const val = normalizeText(vIn ? vIn.value : "");
        const ok = q.validAnswers
          ? q.validAnswers.some(ans => normalizeText(ans) === val)
          : normalizeText(q.answer) === val;
        finish(ok, false, null);
      };

      if (vForm) {
        vForm.addEventListener("submit", e => {
          e.preventDefault();
          submitVoiceFallback();
        });
      }

      switchBtn.onclick = () => {
        voiceBtn.style.display = "none";
        vStatus.style.display = "none";
        switchBtn.style.display = "none";
        vForm.style.display = "flex";
        mountDungeonKeyboard("dungeon-voice-in", "dungeon-voice-keyboard-container", false, submitVoiceFallback, null);
      };

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        vStatus.textContent = "音声入力非対応のため、文字入力をお使いください";
        switchBtn.click();
      } else {
        voiceBtn.onclick = () => {
          if (currentRecognition) return;
          try {
            const rec = new SpeechRecognition();
            currentRecognition = rec;
            rec.lang = 'en-US';
            rec.interimResults = false;
            rec.maxAlternatives = 3;

            voiceBtn.classList.add("listening");
            voiceBtn.textContent = "👂 聞き取り中...英語で話してね";
            vStatus.textContent = "認識中...";

            rec.onresult = (evt) => {
              let recognized = "";
              for (let i = evt.resultIndex; i < evt.results.length; i++) {
                if (evt.results[i].isFinal) recognized += evt.results[i][0].transcript;
              }
              vStatus.textContent = `認識: "${recognized}"`;
              const norm = normalizeText(recognized);
              const ok = q.validAnswers
                ? q.validAnswers.some(ans => normalizeText(ans) === norm)
                : normalizeText(q.answer) === norm;
              finish(ok, false, voiceBtn);
            };

            rec.onerror = () => {
              vStatus.textContent = "聞き取れませんでした。もう一度押すか文字入力に切り替えてね";
              voiceBtn.classList.remove("listening");
              voiceBtn.textContent = "🎙️ もう一度マイクを押す";
              currentRecognition = null;
            };

            rec.onend = () => {
              voiceBtn.classList.remove("listening");
              if (!fin) voiceBtn.textContent = "🎙️ もう一度マイクを押す";
              currentRecognition = null;
            };

            rec.start();
          } catch(err) {
            vStatus.textContent = "マイク起動に失敗しました。文字入力をお使いください";
            switchBtn.click();
          }
        };
      }
    } else if (q.type === "sort") {
      const slot = document.getElementById("dungeon-sort-slot");
      const pool = document.getElementById("dungeon-sort-pool");
      const submitBtn = document.getElementById("dungeon-sort-submit");
      const clearBtn = document.getElementById("dungeon-sort-clear-btn");
      const missingIn = document.getElementById("dungeon-sort-missing-in");
      const addBtn = document.getElementById("dungeon-sort-add-btn");

      function updateSubmitVisibility() {
        const count = slot.children.length;
        if (count === q.expectedCount) submitBtn.style.display = "block";
        else submitBtn.style.display = "none";
      }

      function createChip(word, isUserAdded) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "dungeon-sort-chip" + (isUserAdded ? " user-added" : "");
        chip.textContent = word;
        chip.dataset.word = word;
        chip.onclick = () => {
          if (chip.parentNode === pool) slot.appendChild(chip);
          else pool.appendChild(chip);
          se("select");
          updateSubmitVisibility();
        };
        return chip;
      }

      q.cards.forEach(w => pool.appendChild(createChip(w, false)));

      if (addBtn && missingIn) {
        const addCard = () => {
          const val = missingIn.value.trim();
          if (!val) return;
          pool.appendChild(createChip(val, true));
          missingIn.value = "";
          se("decide");
          updateSubmitVisibility();
        };
        addBtn.onclick = addCard;
        missingIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addCard(); } });
        mountDungeonKeyboard("dungeon-sort-missing-in", "dungeon-sort-keyboard-container", true, null, addCard);
      }

      if (clearBtn) {
        clearBtn.onclick = () => {
          while (slot.firstChild) pool.appendChild(slot.firstChild);
          updateSubmitVisibility();
          se("cancel");
        };
      }

      submitBtn.onclick = () => {
        const joinedWords = Array.from(slot.children).map(c => c.dataset.word).join(" ");
        const norm = normalizeText(joinedWords);
        const ok = q.validAnswers
          ? q.validAnswers.some(ans => normalizeText(ans) === norm)
          : normalizeText(q.answer) === norm;
        finish(ok, false, submitBtn);
      };
    } else {
      const inp = document.getElementById("dungeon-qin");
      const form = document.getElementById("dungeon-qform");
      const submitType = () => {
        if (fin) return;
        const val = normalizeText(inp ? inp.value : "");
        const ok = q.validAnswers
          ? q.validAnswers.some(ans => normalizeText(ans) === val)
          : normalizeText(q.answer) === val;
        finish(ok, false, null);
      };
      if (form) form.addEventListener("submit", e => {
        e.preventDefault();
        submitType();
      });
      mountDungeonKeyboard("dungeon-qin", "dungeon-keyboard-container", false, submitType, null);
    }

    (function tick() {
      if (fin) return;
      const el = performance.now() - t0, left = Math.max(0, limit - el);
      if (fill) fill.style.width = (100 * left / limit) + "%";
      if (!hurry && left < limit * 0.2) {
        hurry = true;
        se("quiz_hurry");
      }
      if (sec) sec.textContent = (left / 1000).toFixed(1) + " 秒";
      if (left <= 0) return finish(false, true, null);
      raf = requestAnimationFrame(tick);
    })();
  }

  /* ---------- バトルアクション ---------- */
  function doFirst(res) {
    if (roll(pct(res))) {
      log("先手を とった！"); renderLog(); pop("⚡ 先制！", "crit", 0, true); se("first_strike");
      winCmd("先手を とった！ どうする？");
    } else {
      log("先手を とられた！"); renderLog(); winDefend("先手を とられた！");
    }
  }

  function hitMon(total, t, evs) {
    const m = S.b.m;
    m.hp = Math.max(0, m.hp - total);
    log(t); render();
    evs.forEach((e, i) => pop(e.k === "miss" ? "MISS" : (e.k === "crit" ? "クリティカル " + e.d : e.d), e.k === "hit" ? "" : e.k, i * 220));
    const anyCrit = evs.some(e => e.k === "crit");
    gl(anyCrit ? "crit" : total ? "hit" : "dodge");
    if (anyCrit) pulse("fx-crit", 350);

    if (m.hp <= 0) {
      say(t);
      setTimeout(() => {
        const g = document.getElementById("dungeon-glyph");
        if (g) g.classList.add("dead");
      }, 300);
      return setTimeout(victory, 950);
    }

    if (m.boss && !m.regen && m.hp <= m.max * CFG.regenAt / 100) {
      m.regen = true; say(t);
      return setTimeout(() => {
        const h = Math.min(m.max - m.hp, Math.round(m.max * CFG.regenHeal / 100));
        m.hp += h;
        const t2 = m.name + "の 自己再生！「周囲の魔力を 取り込んでいる！？」 HPが " + h + " かいふくした。";
        log(t2); render(); gl("regen"); se("boss_regen"); pulse("fx-heal", 700); pop("+" + h, "heal", 150);
        winCmd(t2 + " どうする？");
      }, 1100);
    }
    winDefend(t);
  }

  function strike(res, pow, hits, label, sure, drain) {
    const p = S.p, m = S.b.m, parts = [], evs = [];
    let total = 0;
    const cr = res ? pct(res) : CFG.base;
    for (let h = 0; h < hits; h++) {
      if (!sure && roll(m.eva)) {
        parts.push("ミス"); evs.push({ k: "miss" }); continue;
      }
      const crit = roll(cr);
      const d = Math.max(1, Math.round(atkNow() * CFG.dmgBase * pow * (crit ? CFG.critMul : 1) * rnd(0.9, 1.1)));
      total += d;
      parts.push((crit ? "クリティカル " : "") + d);
      evs.push({ k: crit ? "crit" : "hit", d });
    }
    if (res && res.ok) p.gauge = Math.min(100, p.gauge + pct(res));
    let t = (label ? label + "！ " : "") + m.name + "に " + parts.join("・") + (total ? " のダメージ。" : "… あたらなかった。");
    if (drain && total) {
      const h = Math.min(pMaxHp(p.lv) - p.hp, Math.round(total * drain));
      p.hp += h; t += " HPを " + h + " すいとった。";
      pop("💖 +" + h, "heal", 300, true); se("special_drain", 350);
    }
    if (label === "ひっさつ") se("special_hit");
    else if (label) se(SKEY[label]);
    evs.forEach((e, i) => {
      if (!label || e.k !== "hit") se(e.k === "miss" ? "attack_miss" : e.k === "crit" ? "attack_critical" : "attack_hit", i * 220);
    });
    hitMon(total, t, evs);
  }

  function doAttack(res) { strike(res, 1, 1, ""); }
  function doSpecial() {
    const lv = S.p.lv;
    S.p.gauge = 0; se("special_start"); pulse("fx-crit", 350);
    strike(null, CFG.spPow, 1, "ひっさつ", lv >= CFG.spSureLv, lv >= CFG.spDrainLv ? CFG.spDrain / 100 : 0);
  }

  function doItem(k, res) {
    const p = S.p, hpItem = k === "pot", mx = hpItem ? pMaxHp(p.lv) : pMaxMp(p.lv), cur = hpItem ? p.hp : p.mp;
    p.it[k]--;
    const amt = Math.min(Math.max(1, Math.round(mx * pct(res) / 100)), mx - cur);
    if (hpItem) p.hp += amt; else p.mp += amt;
    const t = ITEMS[k].n + "を つかった。" + (hpItem ? "HP" : "MP") + "が " + amt + " かいふくした。" + (res.ok ? "" : "（ふせいかいで こうかは わずか）");
    log(t); render();
    pulse(hpItem ? "fx-heal" : "fx-mp", 650); se(hpItem ? "heal_hp" : "heal_mp");
    pop((hpItem ? "💖 +" : "💧 +") + amt, hpItem ? "heal" : "mp", 0, true);
    if (S.screen === "battle") winDefend(t); else winExplore(t);
  }

  function doFlee(res) {
    if (roll(pct(res))) {
      se("flee"); log("うまく にげきった。");
      S.screen = "explore"; S.b = null; render(); winExplore("うまく にげきった。");
    } else {
      log("にげられなかった！"); renderLog(); winDefend("にげられなかった！");
    }
  }

  function doDefend(stance, res) {
    const p = S.p, m = S.b.m, ec = roll(CFG.eCrit);
    let dmg = Math.max(1, m.atk - defNow() * CFG.defCoef) * rnd(0.85, 1.15) * (ec ? CFG.eCritMul : 1), t, fx;
    const pre = ec ? "つうこんの いちげき！ " : "";
    if (stance === "evade" && roll(pct(res))) {
      dmg = 0; t = m.name + "の こうげきを ひらりと かわした！"; fx = "dodge";
    } else if (stance === "evade") {
      dmg = Math.max(1, Math.round(dmg)); t = pre + "かわしきれず " + dmg + " のダメージ。"; fx = ec ? "hurt2" : "hurt";
    } else {
      const mul = res.ok ? Math.max(0, 1 - (pct(res) - CFG.base) / 100) : 1;
      dmg = Math.max(1, Math.round(dmg * mul));
      t = pre + m.name + "の こうげき。" + (res.ok ? "みがまえて " : "") + dmg + " のダメージ" + (res.ok ? "（" + Math.round(mul * 100) + "%に軽減）。" : "。");
      fx = res.ok ? "guard" : (ec ? "hurt2" : "hurt");
    }
    p.hp = Math.max(0, p.hp - dmg);
    log(t); render(); gl("lunge");
    if (fx === "dodge") { se("evade"); pulse("fx-dodge", 450); pop("👟 かわした！", "guard", 0, true); }
    else if (fx === "guard") { se("guard"); pulse("fx-guard", 500); pop("🛡️ -" + dmg, "guard", 0, true); }
    else { se(ec ? "enemy_critical" : "enemy_hit"); pulse("fx-" + fx, 700); pop((ec ? "痛恨 -" : "-") + dmg, ec ? "crit" : "hurt", 0, true); }
    
    if (p.hp <= 0) {
      if (p.it.neck > 0 && !S.b.rev) {
        S.b.rev = true; p.it.neck--; say(t);
        return setTimeout(() => {
          p.hp = Math.max(1, Math.round(pMaxHp(p.lv) * CFG.revive / 100));
          const t2 = "復活の首飾りが くだけ散った！ HP " + p.hp + " で よみがえった。";
          log(t2); render(); pulse("fx-heal", 700); se("revive"); pop("📿 ふっかつ！", "heal", 0, true);
          winCmd(t2 + " どうする？");
        }, 1000);
      }
      say(t);
      return setTimeout(() => finishRun("over"), 1000);
    }
    winCmd(t + " どうする？");
  }

  function victory() {
    const p = S.p, m = S.b.m, i = S.b.i;
    S.st.kills++; p.exp += m.exp; const lv0 = p.lv;
    let t = m.name + "を たおした！ けいけんち " + m.exp + "。", up = false;
    while (p.exp >= expNext(p.lv)) {
      p.exp -= expNext(p.lv); p.lv++; up = true;
      p.hp += pMaxHp(p.lv) - pMaxHp(p.lv - 1);
      p.mp += pMaxMp(p.lv) - pMaxMp(p.lv - 1);
      t += " レベル " + p.lv + " に あがった！";
      const sk = skills().find(k => k.lv === p.lv);
      if (sk) t += " " + sk.n + "を おぼえた！";
    }
    if (m.boss) {
      p.it.pot++; p.it.eth++; p.hp = pMaxHp(p.lv); p.mp = pMaxMp(p.lv);
      t += " ポーションと まりょくの水を てにいれた。HPとMPが 全回復した！";
      const nt = Math.min(10, Math.floor(S.floor / 10) + 1);
      if (nt > p.gearMax) {
        p.gearMax = nt; se("gear_get", 2200);
        t += " " + GEAR[nt - 1] + "の装備一式を てにいれた！ そうびメニューで つけかえよう。";
      }
    }
    log(t);
    delete S.map.ents[i];
    S.map.px = i % W; S.map.py = (i - S.map.px) / W;
    reveal();
    S.screen = "explore"; S.b = null; render();
    se(m.boss ? "boss_down" : "enemy_down");
    if (up) { pop("LEVEL UP!", "crit", 0, true); se("levelup", 700); }
    if (skills().some(k => k.lv > lv0 && k.lv <= p.lv)) se("skill_learn", 1600);
    if (i === S.map.stairs) winNext(t); else winExplore(t);
  }

  function startBattle(i, e, ambush) {
    S.b = { i, m: makeMon(S.floor, e.a, e.t === "boss") };
    S.screen = "battle";
    log(S.b.m.name + (ambush ? "が おそいかかってきた！" : "が あらわれた！"));
    render();
    se(S.b.m.boss ? "boss_encounter" : "encounter");
    pulse("fx-enc", 650); gl("appear"); winFirst();
  }

  function moveMonsters() {
    const m = S.map, pi = m.py * W + m.px, done = new Set();
    for (const k of Object.keys(m.ents)) {
      const i = +k, e = m.ents[i];
      if (!e || e.t !== "mon" || done.has(e)) continue;
      done.add(e);
      const x = i % W, y = (i - x) / W, d = Math.abs(x - m.px) + Math.abs(y - m.py);
      if (d === 1) return i;
      const opts = [];
      for (const dr of DIRS) {
        const nx = x + dr[0], ny = y + dr[1], j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || m.cells[j] !== 0 || m.ents[j] || j === m.stairs || j === pi) continue;
        opts.push([j, Math.abs(nx - m.px) + Math.abs(ny - m.py)]);
      }
      if (!opts.length) continue;
      let pick = null;
      if (d <= CFG.chase) {
        const near = opts.filter(o => o[1] < d);
        if (near.length) pick = near[ri(near.length)];
      }
      if (!pick) pick = opts[ri(opts.length)];
      delete m.ents[i];
      m.ents[pick[0]] = e;
    }
    return null;
  }

  function move(dx, dy) {
    if (S.screen !== "explore") return;
    const m = S.map, nx = m.px + dx, ny = m.py + dy, i = ny * W + nx;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || m.cells[i] !== 0) {
      se("disabled"); return;
    }
    const e = m.ents[i];
    if (e && (e.t === "mon" || e.t === "boss")) return startBattle(i, e, false);
    m.px = nx; m.py = ny; reveal();
    let msg = null, got = null;
    if (e && e.t === "chest") {
      delete m.ents[i]; got = loot(); S.p.it[got]++; msg = ITEMS[got].n + "を みつけた！";
      se("chest"); log("たからばこから " + ITEMS[got].n + "を みつけた。");
    }
    if (i === m.stairs) {
      render(); se("stairs"); say("かいだんを おりる…");
      setTimeout(descend, 400); return;
    }
    const a = moveMonsters();
    if (a != null) return startBattle(a, m.ents[a], true);
    render();
    if (got) { pop(ITEMS[got].ic + " " + ITEMS[got].n, "guard", 0, true); winExplore(msg); }
  }

  function descend() {
    S.cleared = Math.max(S.cleared, S.floor);
    const maxF = currentTower ? (currentTower.maxFloor || 100) : 100;
    if (S.floor >= maxF) return finishRun("clear");
    S.floor++;
    const p = S.p, mx = pMaxHp(p.lv), h = Math.min(mx - p.hp, Math.round(mx * CFG.stairHeal / 100));
    p.hp += h;
    p.mp = Math.min(pMaxMp(p.lv), p.mp + Math.round(pMaxMp(p.lv) * CFG.stairHeal / 100));
    enterFloor("地下 " + S.floor + " 階へ。ひといきついて HP " + h + " かいふく。");
    autosave();
  }

  function finishRun(kind) {
    const st = S.st;
    const r = {
      floor: S.floor, lv: S.p.lv, ok: st.ok, total: st.total,
      kills: st.kills, acc: st.total ? Math.round(100 * st.ok / st.total) : 0,
      practice: S.practice, isNew: false
    };
    if (!S.practice) {
      const rec = loadTowerRec();
      if (S.floor > rec.best) {
        rec.best = S.floor; r.isNew = true;
        saveTowerRec(rec);
      }
    }
    S.result = r; S.screen = kind; render(); winEnd();
    se(kind === "clear" ? "game_clear" : "game_over");
    if (r.isNew) se("new_record", 2600);
  }

  /* ---------- プレイヤー用：塔選択画面の描画 ---------- */
  function renderTowerCards() {
    const listEl = document.getElementById("dungeon-tower-list");
    if (!listEl) return;

    listEl.innerHTML = TOWERS.map(t => {
      const rec = loadTowerRec(t.id);
      const vUnitCount = (t.vocabUnits && t.vocabUnits.length) ? t.vocabUnits.length : ALL_VOCAB_UNITS.length;
      const eUnitCount = (t.exprUnits && t.exprUnits.length) ? t.exprUnits.length : ALL_EXPR_UNITS.length;
      const vUnitStr = (t.vocabUnits && t.vocabUnits.length) ? t.vocabUnits.join(", ") : "全単元";
      const eUnitStr = (t.exprUnits && t.exprUnits.length) ? t.exprUnits.join(", ") : "全単元";

      return `<div class="dungeon-window" style="display:flex;flex-direction:column;justify-content:space-between;border-color:${t.id === currentTower.id ? 'var(--gold)' : 'var(--line)'};padding:14px;background:#1b1a2a;">` +
        `<div>` +
        `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">` +
        `<h2 style="font-family:'DotGothic16',monospace;font-size:18px;margin:0;color:var(--gold);">🏰 ${t.name}</h2>` +
        `<span style="font-size:12px;color:var(--muted);">${t.maxFloor || 100}階建て${(t.timeMultiplier && t.timeMultiplier !== 1) ? '・時間 ' + Math.round(t.timeMultiplier * 100) + '%' : ''}</span>` +
        `</div>` +
        `<p style="font-size:13px;color:#ccc;margin:0 0 10px;line-height:1.4;">${t.desc || ''}</p>` +
        `<div style="font-size:11px;color:var(--muted);background:#12111c;padding:6px 8px;border-radius:4px;margin-bottom:10px;line-height:1.5;">` +
        `<div><b>単語:</b> ${vUnitStr} (${vUnitCount}単元)</div>` +
        `<div><b>表現:</b> ${eUnitStr} (${eUnitCount}単元)</div>` +
        `</div>` +
        `<div style="font-size:13px;color:var(--stairs);margin-bottom:12px;">さいこう到達: <b>${rec.best ? `地下 ${rec.best} 階` : '未挑戦'}</b></div>` +
        `</div>` +
        `<div style="display:flex;gap:6px;">` +
        (rec.save ? `<button type="button" class="dungeon-btn" style="flex:1;background:#2e7d32;color:#fff;font-size:13px;" onclick="startTowerDungeon('${t.id}', true)">つづきから (${rec.save.floor}階)</button>` : '') +
        `<button type="button" class="dungeon-btn" style="flex:1;font-size:13px;" onclick="startTowerDungeon('${t.id}', false)">${rec.save ? 'はじめから' : '挑戦する ▶'}</button>` +
        `</div>` +
        `</div>`;
    }).join("");
  }

  function startTowerDungeon(towerId, isResume) {
    const t = TOWERS.find(x => x.id === towerId);
    if (t) currentTower = t;

    const selectEl = document.getElementById("dungeon-tower-select");
    const mainEl = document.getElementById("dungeon-game-main");
    if (selectEl) selectEl.style.display = "none";
    if (mainEl) mainEl.style.display = "block";

    const titleEl = document.getElementById("dungeon-tower-title");
    const subTitle = document.getElementById("dungeon-tower-subtitle");
    if (titleEl && currentTower) {
      titleEl.innerHTML = `単語迷宮<small>【${currentTower.name}】</small>`;
    }

    if (isResume) resume();
    else start(1, false);
  }

  function backToTowerSelect() {
    hideWiiPad();
    if (bgmCur && BGM[bgmCur]) {
      BGM[bgmCur].pause();
      bgmCur = 0;
    }
    const selectEl = document.getElementById("dungeon-tower-select");
    const mainEl = document.getElementById("dungeon-game-main");
    if (mainEl) mainEl.style.display = "none";
    if (selectEl) selectEl.style.display = "block";
    renderTowerCards();
  }

  /* ---------- 管理者用：塔の管理・出題セット設定 ---------- */
  function switchAdminDungeonTab(tab) {
    const tabTowers = document.getElementById("dungeon-admin-tab-towers");
    const tabParams = document.getElementById("dungeon-admin-tab-params");
    const btnTowers = document.getElementById("dungeon-tab-towers-btn");
    const btnParams = document.getElementById("dungeon-tab-params-btn");

    if (tab === "towers") {
      if (tabTowers) tabTowers.style.display = "block";
      if (tabParams) tabParams.style.display = "none";
      if (btnTowers) { btnTowers.style.background = "var(--gold)"; btnTowers.style.color = "#000"; }
      if (btnParams) { btnParams.style.background = "var(--panel)"; btnParams.style.color = "var(--fg)"; }
      renderAdminTowerList();
    } else {
      if (tabTowers) tabTowers.style.display = "none";
      if (tabParams) tabParams.style.display = "block";
      if (btnTowers) { btnTowers.style.background = "var(--panel)"; btnTowers.style.color = "var(--fg)"; }
      if (btnParams) { btnParams.style.background = "var(--gold)"; btnParams.style.color = "#000"; }
      initAdminPanel();
    }
  }

  function renderAdminTowerList() {
    const container = document.getElementById("dungeon-admin-tower-cards");
    if (!container) return;

    container.innerHTML = TOWERS.map((t, idx) => {
      const vUnitStr = (t.vocabUnits && t.vocabUnits.length) ? t.vocabUnits.join(", ") : "全単元から出題";
      const eUnitStr = (t.exprUnits && t.exprUnits.length) ? t.exprUnits.join(", ") : "全単元から出題";
      const timeMulStr = (t.timeMultiplier && t.timeMultiplier !== 1) ? ` ・ 時間 ${Math.round(t.timeMultiplier * 100)}%` : '';

      return `<div style="background:#1b1a2a;border:1px solid #333048;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">` +
        `<div style="flex:1;min-width:240px;">` +
        `<div style="display:flex;align-items:center;gap:8px;">` +
        `<h3 style="margin:0;font-family:'DotGothic16',monospace;font-size:17px;color:var(--gold);">🏰 ${t.name}</h3>` +
        `<span style="font-size:12px;color:var(--muted);">${t.maxFloor || 100}階${timeMulStr}</span>` +
        `</div>` +
        `<p style="font-size:13px;color:#aaa;margin:4px 0 6px;">${t.desc || ''}</p>` +
        `<div style="font-size:12px;color:var(--muted);line-height:1.4;">` +
        `<div><b>単語:</b> ${vUnitStr}</div>` +
        `<div><b>表現:</b> ${eUnitStr}</div>` +
        `</div>` +
        `</div>` +
        `<div style="display:flex;gap:6px;">` +
        `<button type="button" class="dungeon-btn" style="min-height:36px;padding:4px 12px;font-size:13px;" onclick="openTowerEditModal('${t.id}')">編集</button>` +
        `<button type="button" class="dungeon-btn" style="min-height:36px;padding:4px 12px;font-size:13px;background:#b71c1c;color:#fff;" onclick="deleteTower('${t.id}')">削除</button>` +
        `</div>` +
        `</div>`;
    }).join("");
  }

  function openTowerEditModal(towerId) {
    const panel = document.getElementById("dungeon-tower-edit-panel");
    if (!panel) return;
    panel.style.display = "block";
    panel.scrollIntoView({ behavior: 'smooth' });

    let t = null;
    if (towerId) {
      t = TOWERS.find(x => x.id === towerId);
      document.getElementById("dungeon-tower-edit-title").textContent = `塔の編集：${t.name}`;
      document.getElementById("tower-edit-id").value = t.id;
      document.getElementById("tower-edit-name").value = t.name;
      document.getElementById("tower-edit-desc").value = t.desc || "";
      document.getElementById("tower-edit-maxfloor").value = t.maxFloor || 100;
      const timemulEl = document.getElementById("tower-edit-timemul");
      if (timemulEl) timemulEl.value = Math.round(((t && t.timeMultiplier) || 1.0) * 100);
    } else {
      document.getElementById("dungeon-tower-edit-title").textContent = "新しい塔の追加";
      document.getElementById("tower-edit-id").value = "tower_" + Date.now();
      document.getElementById("tower-edit-name").value = "";
      document.getElementById("tower-edit-desc").value = "";
      document.getElementById("tower-edit-maxfloor").value = 100;
      const timemulEl = document.getElementById("tower-edit-timemul");
      if (timemulEl) timemulEl.value = 100;
    }

    // 単語チェックボックス生成
    const vocabBox = document.getElementById("tower-edit-vocab-units");
    const selVocab = (t && Array.isArray(t.vocabUnits)) ? t.vocabUnits : [];
    const isVocabAll = !t || selVocab.length === 0;
    if (vocabBox) {
      vocabBox.innerHTML = ALL_VOCAB_UNITS.map(u => {
        const checked = isVocabAll || selVocab.includes(u);
        return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#fff;cursor:pointer;">` +
          `<input type="checkbox" name="tower_vocab_unit" value="${u}"${checked ? ' checked' : ''}>` +
          `<span>${u}</span>` +
          `</label>`;
      }).join("");
    }

    // 表現チェックボックス生成
    const exprBox = document.getElementById("tower-edit-expr-units");
    const selExpr = (t && Array.isArray(t.exprUnits)) ? t.exprUnits : [];
    const isExprAll = !t || selExpr.length === 0;
    if (exprBox) {
      exprBox.innerHTML = ALL_EXPR_UNITS.map(u => {
        const checked = isExprAll || selExpr.includes(u);
        return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#fff;cursor:pointer;">` +
          `<input type="checkbox" name="tower_expr_unit" value="${u}"${checked ? ' checked' : ''}>` +
          `<span>${u}</span>` +
          `</label>`;
      }).join("");
    }
  }

  function closeTowerEditModal() {
    const panel = document.getElementById("dungeon-tower-edit-panel");
    if (panel) panel.style.display = "none";
  }

  function toggleAllUnits(type, selectAll) {
    const name = type === "vocab" ? "tower_vocab_unit" : "tower_expr_unit";
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
      cb.checked = !!selectAll;
    });
  }

  function deleteTower(towerId) {
    if (TOWERS.length <= 1) {
      alert("塔をすべて削除することはできません。");
      return;
    }
    const t = TOWERS.find(x => x.id === towerId);
    if (!confirm(`「${t ? t.name : towerId}」を削除してもよろしいですか？`)) return;
    TOWERS = TOWERS.filter(x => x.id !== towerId);
    saveTowers();
    renderAdminTowerList();
    renderTowerCards();
  }

  // フォーム保存ハンドラ
  function bindTowerEditForm() {
    const form = document.getElementById("dungeon-tower-edit-form");
    if (!form) return;
    form.onsubmit = e => {
      e.preventDefault();
      const id = document.getElementById("tower-edit-id").value;
      const name = document.getElementById("tower-edit-name").value.trim();
      const desc = document.getElementById("tower-edit-desc").value.trim();
      const maxFloor = parseInt(document.getElementById("tower-edit-maxfloor").value, 10) || 100;
      const timemulEl = document.getElementById("tower-edit-timemul");
      const timeMulPct = parseInt(timemulEl ? timemulEl.value : "100", 10) || 100;
      const timeMultiplier = Math.max(0.3, Math.min(3.0, timeMulPct / 100));

      const checkedVocab = Array.from(document.querySelectorAll('input[name="tower_vocab_unit"]:checked')).map(cb => cb.value);
      const checkedExpr = Array.from(document.querySelectorAll('input[name="tower_expr_unit"]:checked')).map(cb => cb.value);

      // 全選択されている場合は空配列（=全単元）として格納
      const finalVocab = (checkedVocab.length === ALL_VOCAB_UNITS.length) ? [] : checkedVocab;
      const finalExpr = (checkedExpr.length === ALL_EXPR_UNITS.length) ? [] : checkedExpr;

      const existingIdx = TOWERS.findIndex(x => x.id === id);
      const newTower = {
        id, name, desc, maxFloor, timeMultiplier,
        vocabUnits: finalVocab,
        exprUnits: finalExpr
      };

      if (existingIdx >= 0) {
        TOWERS[existingIdx] = newTower;
      } else {
        TOWERS.push(newTower);
      }

      saveTowers();
      closeTowerEditModal();
      renderAdminTowerList();
      renderTowerCards();
      alert(`「${name}」の設定を保存しました！`);
    };
  }

  /* ---------- 管理者バランス調整パネル ---------- */
  function renderAdminTable() {
    const tbl = document.getElementById("dungeon-admin-ttable");
    if (!tbl) return;
    let h = "<tr><th>階</th><th>想定Lv</th><th>主HP</th><th>主攻</th><th>主防</th><th>敵HP</th><th>敵攻</th><th>必要攻撃</th><th>耐久</th><th>竜HP</th><th>竜攻</th></tr>";
    for (const f of [1, 10, 30, 50, 80, 100]) {
      const s = monStats(f, archOf(0), false);
      const b = f % 10 === 0 ? monStats(f, archOf(0), true) : null;
      h += `<tr><td>${f}</td><td>${f}</td><td>${pMaxHp(f)}</td><td>${expAtk(f)}</td><td>${expDef(f)}</td><td>${s.hp}</td><td>${s.atk}</td><td>${kHits(f).toFixed(1)}</td><td>${nHits(f).toFixed(1)}</td><td>${b ? b.hp : "—"}</td><td>${b ? b.atk : "—"}</td></tr>`;
    }
    tbl.innerHTML = h;
  }

  function buildAdminParams() {
    const container = document.getElementById("dungeon-admin-params");
    if (!container) return;
    const open = [...container.querySelectorAll(".dungeon-pgroup")].map(d => d.open);
    container.innerHTML = SCHEMA.map((g, gi) =>
      `<details class="dungeon-pgroup"${open[gi] ? " open" : ""}><summary>${g[0]}</summary><div class="dungeon-tune">${g[1].map(r =>
        `<label class="prow" for="p_${r[0]}"><span>${r[1]}</span><input type="number" id="p_${r[0]}" min="${r[3]}" max="${r[4]}" step="${r[5]}" value="${CFG[r[0]]}"></label>`
      ).join("")}</div></details>`
    ).join("");

    SCHEMA.forEach(g => g[1].forEach(r => {
      const inp = document.getElementById("p_" + r[0]);
      if (inp) inp.addEventListener("change", e => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v)) v = DEF[r[0]];
        v = Math.max(r[3], Math.min(r[4], v));
        CFG[r[0]] = v;
        e.target.value = v;
        applyCfg();
      });
    }));
  }

  function applyCfg() {
    saveCfg();
    renderAdminTable();
    if (S.p && (S.screen === "explore" || S.screen === "battle")) {
      S.p.hp = Math.max(1, Math.min(S.p.hp, pMaxHp(S.p.lv)));
      S.p.mp = Math.min(S.p.mp, pMaxMp(S.p.lv));
      renderStage();
      renderStatus();
    }
  }

  function cfgMsg(t) {
    const el = document.getElementById("dungeon-cfgMsg");
    if (el) el.textContent = t;
  }

  function initAdminPanel() {
    buildAdminParams();
    renderAdminTable();

    let resetArmed = false;
    const resetBtn = document.getElementById("dungeon-cfgReset");
    if (resetBtn) resetBtn.onclick = () => {
      if (!resetArmed) {
        resetArmed = true;
        cfgMsg("もういちど押すと、すべての数値が初期値にもどります。");
        return;
      }
      resetArmed = false;
      Object.assign(CFG, DEF);
      buildAdminParams();
      applyCfg();
      cfgMsg("初期値にもどしました。");
    };

    const outBtn = document.getElementById("dungeon-cfgOut");
    if (outBtn) outBtn.onclick = () => {
      const t = JSON.stringify(CFG);
      const textEl = document.getElementById("dungeon-cfgText");
      if (textEl) textEl.value = t;
      const done = () => cfgMsg("設定を書き出しました。下の文字列を保存しておくと、あとで読み込めます。");
      try {
        navigator.clipboard.writeText(t).then(() => cfgMsg("設定を書き出して、コピーしました。"), done);
      } catch(e) { done(); }
    };

    const inBtn = document.getElementById("dungeon-cfgIn");
    if (inBtn) inBtn.onclick = () => {
      try {
        const textEl = document.getElementById("dungeon-cfgText");
        const o = JSON.parse(textEl ? textEl.value : "");
        if (!o || typeof o !== "object") throw 0;
        setCfg(o);
        buildAdminParams();
        applyCfg();
        cfgMsg("設定を読み込みました。");
      } catch(e) {
        cfgMsg("読み込めませんでした。書き出した文字列を そのまま貼り付けてください。");
      }
    };

    const tryBtn = document.getElementById("dungeon-tryBtn");
    if (tryBtn) tryBtn.onclick = () => {
      const fInp = document.getElementById("dungeon-tryF");
      const f = Math.max(1, Math.min(100, Math.round(+(fInp ? fInp.value : 1))));
      openDungeonGame();
      startTowerDungeon(currentTower ? currentTower.id : "tower_starter", false);
      start(f, true);
    };
  }

  /* ---------- イベントバインド ---------- */
  function bindGlobalDungeonEvents() {
    const sec = document.getElementById("section-dungeon");
    if (!sec) return;

    sec.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b || b.disabled || b.type === "submit" || b.closest(".dungeon-choices, .dungeon-sebar, .dungeon-dpad")) return;
      const id = b.id;
      if (b.classList.contains("dungeon-dchip")) se("select");
      else if (id === "dungeon-back") se("cancel");
      else if (["dungeon-bag", "dungeon-eqb", "cQ", "cH"].includes(id)) se("menu_open");
      else if (["cA", "cF", "dG", "dE"].includes(id) || b.dataset.k != null || b.dataset.it != null) se("decide");
    }, true);

    const seDirBtn = document.getElementById("dungeon-seDirBtn");
    const seFileBtn = document.getElementById("dungeon-seFileBtn");
    const seDir = document.getElementById("dungeon-seDir");
    const seFiles = document.getElementById("dungeon-seFiles");

    if (seDirBtn && seDir) seDirBtn.onclick = () => seDir.click();
    if (seFileBtn && seFiles) seFileBtn.onclick = () => seFiles.click();

    [seDir, seFiles].forEach(el => {
      if (!el) return;
      el.addEventListener("change", e => {
        const n = seLoad(e.target.files || []);
        e.target.value = "";
        const statEl = document.getElementById("dungeon-seStat");
        if (!n && statEl) {
          statEl.textContent = "se01_〜 や BGM01_〜 で始まる音のファイルが見つかりませんでした";
        } else {
          se("decide");
          bgmUpdate();
        }
      });
    });

    const seMute = document.getElementById("dungeon-seMute");
    const bgmMute = document.getElementById("dungeon-bgmMute");
    if (seMute) seMute.onclick = () => { seOn = !seOn; saveSnd(); seStatus(); se("select"); };
    if (bgmMute) bgmMute.onclick = () => { bgmOn = !bgmOn; saveSnd(); seStatus(); bgmUpdate(); };
    seStatus();

    const stage = document.getElementById("dungeon-stage");
    if (stage) {
      stage.addEventListener("click", e => {
        const c = e.target.closest(".c.adj");
        if (!c) return;
        const i = +c.dataset.i, x = i % W, y = (i - x) / W;
        move(x - S.map.px, y - S.map.py);
      });

      let sw = null;
      stage.addEventListener("touchstart", e => {
        if (e.target.closest(".dungeon-map")) {
          const t = e.touches[0];
          sw = [t.clientX, t.clientY];
        }
      }, { passive: true });

      stage.addEventListener("touchend", e => {
        if (!sw) return;
        const t = e.changedTouches[0], dx = t.clientX - sw[0], dy = t.clientY - sw[1];
        sw = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
        e.preventDefault();
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
        else move(0, dy > 0 ? 1 : -1);
      });
    }

    document.addEventListener("keydown", e => {
      const activeSec = document.querySelector(".section.active");
      if (!activeSec || activeSec.id !== "section-dungeon") return;
      if (document.getElementById("dungeon-game-main").style.display === "none") return;
      if (e.isComposing || e.key === 'Process') return;

      // メニューモーダルが開いている場合
      const menuModal = document.getElementById("dungeon-menu-modal");
      const isMenuOpen = menuModal && menuModal.style.display !== "none";
      if (isMenuOpen) {
        if (e.key === "Escape" || e.key === "m" || e.key === "M") {
          e.preventDefault();
          closeDungeonMenu();
          return;
        }
      }

      // クイズ出題中のテキスト入力判定 (dungeon-qin, dungeon-sort-missing-in, dungeon-voice-in)
      const activeInput = document.getElementById("dungeon-qin") ||
                          document.getElementById("dungeon-sort-missing-in") ||
                          ((() => { const vi = document.getElementById("dungeon-voice-in"); return (vi && vi.offsetParent !== null) ? vi : null; })());

      if (activeInput) {
        if (['Enter', 'Backspace', ' ', 'Shift'].includes(e.key) || (e.key.length === 1 && /^[\x20-\x7E¥]$/.test(e.key))) {
          e.preventDefault();
        }
        if (e.key === 'Enter') {
          if (activeInput.id === "dungeon-sort-missing-in") {
            const addBtn = document.getElementById("dungeon-sort-add-btn");
            if (addBtn) addBtn.click();
          } else if (activeInput.id === "dungeon-voice-in") {
            const form = document.getElementById("dungeon-voice-form");
            if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
          } else {
            const form = document.getElementById("dungeon-qform");
            if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
        } else if (e.key === 'Backspace') {
          activeInput.value = activeInput.value.slice(0, -1);
        } else if (e.key === ' ') {
          activeInput.value += ' ';
        } else if (e.key.length === 1 && /^[\x20-\x7E¥]$/.test(e.key)) {
          activeInput.value += e.key;
        }
        return;
      }

      if (e.target.tagName === "INPUT") return;
      if (quizKey) { quizKey(e.key); return; }

      if ((e.key === "m" || e.key === "M") && S.screen === "explore") {
        e.preventDefault();
        openDungeonMenu();
        return;
      }

      const k = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
      }[e.key];
      if (k && S.screen === "explore") {
        e.preventDefault();
        move(k[0], k[1]);
      }
    });
  }

  /* ---------- 公開API ---------- */
  function openDungeonGame() {
    if (typeof global.switchSection === "function") {
      global.switchSection("section-dungeon");
    } else {
      document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
      const el = document.getElementById("section-dungeon");
      if (el) el.classList.add("active");
    }

    applyDungeonPadModeUI();

    if (!isManifestLoaded) {
      loadManifestMaterialsForDungeon();
    }

    bindGlobalDungeonEvents();

    // 塔選択画面を表示
    document.getElementById("dungeon-game-main").style.display = "none";
    document.getElementById("dungeon-tower-select").style.display = "block";
    renderTowerCards();
  }

  function exitDungeonToHome() {
    hideWiiPad();
    if (bgmCur && BGM[bgmCur]) {
      BGM[bgmCur].pause();
      bgmCur = 0;
    }
    const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
    if (typeof global.showHome === "function") {
      global.showHome(user);
    } else if (typeof global.switchSection === "function") {
      global.switchSection("section-home");
    }
  }

  function openParentAdminDungeon() {
    if (typeof global.switchSection === "function") {
      global.switchSection("section-parent-admin-dungeon");
    } else {
      document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
      const el = document.getElementById("section-parent-admin-dungeon");
      if (el) el.classList.add("active");
    }
    bindTowerEditForm();
    switchAdminDungeonTab('towers');
  }

  function exitParentAdminDungeon() {
    if (typeof global.switchSection === "function") {
      global.switchSection("section-parent-admin");
    }
  }

  // 初期化時に操作パッド設定をDOMに反映
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyDungeonPadModeUI);
    } else {
      applyDungeonPadModeUI();
    }
  }

  // グローバル公開
  global.openDungeonGame = openDungeonGame;
  global.openDungeonMenu = openDungeonMenu;
  global.closeDungeonMenu = closeDungeonMenu;
  global.switchDungeonMenuTab = switchDungeonMenuTab;
  global.handleDungeonMenuOverlayClick = handleDungeonMenuOverlayClick;
  global.setDungeonPadMode = setDungeonPadMode;
  global.toggleDungeonPadMode = toggleDungeonPadMode;
  global.setDungeonHandMode = setDungeonPadMode;
  global.toggleDungeonHandMode = toggleDungeonPadMode;
  global.exitDungeonToHome = exitDungeonToHome;
  global.enterParentAdminDungeon = openParentAdminDungeon;
  global.exitParentAdminDungeon = exitParentAdminDungeon;
  global.startTowerDungeon = startTowerDungeon;
  global.backToTowerSelect = backToTowerSelect;
  global.switchAdminDungeonTab = switchAdminDungeonTab;
  global.openTowerEditModal = openTowerEditModal;
  global.closeTowerEditModal = closeTowerEditModal;
  global.toggleAllUnits = toggleAllUnits;
  global.deleteTower = deleteTower;
  global.resetTowersToDefault = resetTowersToDefault;

  global.DungeonGame = {
    open: openDungeonGame,
    openMenu: openDungeonMenu,
    closeMenu: closeDungeonMenu,
    openAdmin: openParentAdminDungeon,
    loadManifest: loadManifestMaterialsForDungeon,
    setPadMode: setDungeonPadMode,
    togglePadMode: toggleDungeonPadMode,
    getPadMode: () => dungeonPadMode,
    setHandMode: setDungeonPadMode,
    toggleHandMode: toggleDungeonPadMode,
    getHandMode: () => dungeonPadMode,
    getPoolStatus: () => ({
      vocabUnits: ALL_VOCAB_UNITS.length,
      exprUnits: ALL_EXPR_UNITS.length,
      currentTower: currentTower ? currentTower.name : null,
      isLoaded: isManifestLoaded
    }),
    makeQ: makeQ,
    tlim: tlim,
    getTowers: () => TOWERS
  };

})(typeof window !== 'undefined' ? window : this);
