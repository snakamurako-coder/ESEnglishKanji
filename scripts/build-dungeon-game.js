const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const refHtmlPath = path.join(rootDir, '参考', '単語迷宮 百階.html');
const outJsPath = path.join(rootDir, 'js', 'modules', 'dungeonGame.js');

const refHtml = fs.readFileSync(refHtmlPath, 'utf8');

// スクリプト部分の抽出
const scriptStartTag = '<script>';
const scriptEndTag = '</script>';
const sIdx = refHtml.indexOf(scriptStartTag);
const eIdx = refHtml.lastIndexOf(scriptEndTag);

if (sIdx === -1 || eIdx === -1) {
  console.error('[ERROR] Could not find script tags in 参考/単語迷宮 百階.html');
  process.exit(1);
}

let refJs = refHtml.slice(sIdx + scriptStartTag.length, eIdx).trim();

// IIFEラッパーを外す
refJs = refJs.replace(/^\(function\(\)\{\s*["']use strict["'];?/, '').replace(/\}\)\(\);?\s*$/, '');

// 1. 問題データ定義 (W1〜makeQ) をマニフェスト連携・10段階makeQに置換
const oldDataStart = '/* ---------- 問題データ ---------- */';
const oldDataEnd = '/* ---------- 数値設計 ---------- */';
const p1 = refJs.indexOf(oldDataStart);
const p2 = refJs.indexOf(oldDataEnd);

if (p1 === -1 || p2 === -1) {
  console.error('[ERROR] Problem data section not found');
  process.exit(1);
}

const newDataSection = `/* ==========================================================================
     📚 教材マニフェスト ＆ 塔（Towers）データ管理 (ESEnglishKanji 連携)
     ========================================================================== */
  let ALL_VOCAB_UNITS = ["基本単語"];
  let ALL_EXPR_UNITS = ["基本表現"];
  let VOCAB_BY_UNIT = {};
  let EXPR_BY_UNIT = {};
  let isManifestLoaded = false;

  const DEFAULT_VOCAB = [
    {英単語:"borrow",日本語:"借りる",イニシャル:"b",イニシャルと文字数:"b _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"decide",日本語:"決める",イニシャル:"d",イニシャルと文字数:"d _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"weather",日本語:"天気",イニシャル:"w",イニシャルと文字数:"w _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"enough",日本語:"十分な",イニシャル:"e",イニシャルと文字数:"e _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"foreign",日本語:"外国の",イニシャル:"f",イニシャルと文字数:"f _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
    {英単語:"without",日本語:"〜なしで",イニシャル:"w",イニシャルと文字数:"w _ _ _ _ _ _",ヒント:"", unit:"基本単語"},
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

  VOCAB_BY_UNIT["基本単語"] = DEFAULT_VOCAB.slice();
  EXPR_BY_UNIT["基本表現"] = DEFAULT_EXPR.slice();

  function tokenizeSentence(text) {
    if (!text) return [];
    return text.trim()
      .replace(/[.,?!;:()'"]/g, '')
      .split(/\\s+/)
      .filter(w => w.length > 0);
  }

  function normalizeText(s) {
    if (!s) return "";
    return String(s)
      .toLowerCase()
      .replace(/[.,?!;:()'"]/g, '')
      .replace(/\\s+/g, ' ')
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

      if (!indexRes && window.manifestCache && typeof window.manifestCache.getManifest === 'function') {
        indexRes = window.manifestCache.getManifest();
      }
      if (!indexRes && window.g_manifest) {
        indexRes = window.g_manifest;
      }
      if (!indexRes) {
        const local = localStorage.getItem('manifest_data');
        if (local) {
          try { indexRes = JSON.parse(local); } catch(e) {}
        }
      }
      if (!indexRes) return;

      const vocabMap = {};
      const exprMap = {};
      const vocabUnitNames = [];
      const exprUnitNames = [];

      const books = indexRes.books || (indexRes.modes ? indexRes.modes : {});
      for (const key of Object.keys(books)) {
        const bookData = books[key];
        if (!bookData || !bookData.units) continue;
        const modeName = String(bookData.title || bookData.name || key);
        const modeId = String(bookData.id || key);

        if (modeName.includes('単語') || modeId === '1b7c-jNq387Zz9c3E7-6-S_a116Z1T9B') {
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
      renderTowerCards();
      renderAdminTowerList();
    } catch (err) {
      console.warn('[Dungeon] Manifest load failed, using fallback.', err);
    }
  }

  if (typeof window !== 'undefined') {
    setTimeout(loadManifestMaterialsForDungeon, 300);
  }

  /* ---------- 塔（Towers）データ管理 ---------- */
  const TOWERS_KEY = "tango-meikyu-towers";
  const DEFAULT_TOWERS = [
    {
      id: "tower_starter",
      name: "はじまりの塔",
      desc: "数字・色・自己紹介で基礎をかためる入門の塔",
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

  /* ---------- 難易度1〜10 の定義 ---------- */
  const FMT = { c: "4択 英→日", r: "4択 日→英", t: "記述" };
  const LV = [
    null,
    ["c", "A"],
    ["c", "B"],
    ["r", "A"],
    ["c", "C"],
    ["r", "BC"],
    ["c", "DE"],
    ["r", "DE"],
    ["t", "AB"],
    ["t", "CD"],
    ["t", "E"]
  ];
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

  const bonus = L => CFG.base + CFG.perLv * L;
  const spdOf = r => {
    const left = 1 - r;
    return left >= 0.8 ? CFG.sp1 : left >= 0.6 ? CFG.sp2 : left >= 0.4 ? CFG.sp3 : left >= 0.2 ? CFG.sp4 : CFG.sp5;
  };
  const pct = res => res.ok ? bonus(res.L) + res.sp : CFG.base;
  const roll = p => Math.random() * 100 < p;

  function isQuestionEnglish(q) {
    if (!q) return true;
    if (q.lang === 'en') return true;
    if (q.lang === 'ja') return false;
    if (q.answer && /^[a-zA-Z0-9\\s'’\\-]+$/.test(q.answer)) return true;
    if (q.prompt && (q.prompt.includes("英語で") || q.prompt.includes("英単語") || q.prompt.includes("スペル"))) return true;
    return false;
  }

  /* 制限時間計算 (各Lvベース秒数 × 全体倍率 × 塔の倍率) */
  function tlim(L) {
    const key = "t_lv" + L;
    let baseTime = (typeof CFG !== "undefined" && CFG[key]);
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
    const towerMul = (currentTower && typeof currentTower.timeMultiplier === "number" && currentTower.timeMultiplier > 0)
      ? currentTower.timeMultiplier
      : 1;
    const globalMul = (typeof CFG !== "undefined" && CFG.time) ? CFG.time : 1;
    return baseTime * globalMul * towerMul;
  }

  /* ---------- 問題生成 (makeQ: Lv1〜10) ---------- */
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
          L, fm: "4択 (日→英)", type: "choice",
          prompt: "「" + w.日本語 + "」にあたる英語は？",
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
          L, fm: "4択＋なし (英→日)", type: "choice",
          prompt: '"' + w.英単語 + '" の意味は？',
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
          L, fm: "スペル補う", type: "spell",
          prompt: "「" + w.日本語 + "」のスペルを補おう",
          hint: masked,
          answer: raw,
          missingChars: missingChars,
          rawWord: raw
        };
      }

      // Lv 4: 単語 / 日本語→英語 / 音声入力
      if (L === 4) {
        return {
          L, fm: "音声入力", type: "voice",
          prompt: "「" + w.日本語 + "」を英語で発音しよう",
          hint: w.イニシャルと文字数 || (w.英単語[0] + " " + "_ ".repeat(w.英単語.length - 1)),
          answer: w.英単語.toLowerCase(),
          rawWord: w.英単語
        };
      }

      // Lv 5: 単語 / 日本語→英語 / タイピング
      if (L === 5) {
        return {
          L, fm: "タイピング", type: "type",
          prompt: "「" + w.日本語 + "」を英語で入力しよう",
          hint: w.イニシャルと文字数 || (w.英単語[0] + " " + "_ ".repeat(w.英単語.length - 1) + "（" + w.英単語.length + "文字）"),
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
        L, fm: "並び替え (過不足なし)", type: "sort",
        variant: "all",
        prompt: "「" + q.日本語 + "」になるように単語を並べよう",
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
        L, fm: "並び替え (不要語排除)", type: "sort",
        variant: "dummy",
        prompt: "「" + q.日本語 + "」になるよう並べよう（使わない単語が1つあるよ！）",
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
        L, fm: "並び替え (＋1補う)", type: "sort",
        variant: "missing",
        prompt: "「" + q.日本語 + "」になるよう並べよう（1語足りない単語を補ってね！）",
        hint: "足りない単語を入力して「＋追加」し、並べてね",
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
        L, fm: "音声入力", type: "voice",
        prompt: "「" + q.日本語 + "」を英語で発音しよう",
        hint: "（" + q.tokens.length + "語の文）",
        answer: q.英文,
        validAnswers: validAnswers
      };
    }

    // Lv 10: 表現 / 日本語→英語 / タイピング
    if (L === 10) {
      return {
        L, fm: "タイピング", type: "type",
        prompt: "「" + q.日本語 + "」を英語で入力しよう",
        hint: "（" + q.tokens.length + "語の文）",
        answer: q.英文,
        validAnswers: validAnswers
      };
    }

    return null;
  }
\n`;

refJs = refJs.slice(0, p1) + newDataSection + refJs.slice(p2);

// 2. SCHEMA の置換（t_lv1〜t_lv10 を含んだ完全版SCHEMA）
const oldSchemaStart = 'const SCHEMA=[';
const oldSchemaEnd = 'const DEF={};';
const s1 = refJs.indexOf(oldSchemaStart);
const s2 = refJs.indexOf(oldSchemaEnd);

if (s1 === -1 || s2 === -1) {
  console.error('[ERROR] SCHEMA section not found');
  process.exit(1);
}

const newSchemaSection = `const SCHEMA=[
 ["主人公",[["hp0","HP（Lv1）",50,1,9999,1],["hpLv","HP：1レベルごとの増加",10,0,999,1],["mp0","MP（Lv1）",10,0,9999,1],["mpLv","MP：1レベルごとの増加",2,0,999,1],["atk0","攻撃力（Lv1）",10,1,9999,1],["atkLv","攻撃力：1レベルごとの増加",3,0,999,1],["exp0","次のLvまでの経験値（Lv1）",20,1,99999,1],["expLv","必要経験値：1レベルごとの増加",8,0,9999,1],["dmgBase","与ダメージ係数（攻撃力×）",0.7,0.05,10,0.05],["critMul","クリティカル倍率",2,1,10,0.1]]],
 ["装備",[["defCoef","防御力1あたり減らせる被ダメージ",0.5,0,10,0.05],["g1d","ブロンズ防具の防御力",2,0,9999,1],["g1s","ブロンズソードの攻撃力",12,0,9999,1],["g2d","アイアン防具の防御力",5,0,9999,1],["g2s","アイアンソードの攻撃力",30,0,9999,1],["g3d","スチール防具の防御力",7,0,9999,1],["g3s","スチールソードの攻撃力",42,0,9999,1],["g4d","シルバー防具の防御力",9,0,9999,1],["g4s","シルバーソードの攻撃力",54,0,9999,1],["g5d","プラチナ防具の防御力",12,0,9999,1],["g5s","プラチナソードの攻撃力",72,0,9999,1],["g6d","ダークスチール防具の防御力",15,0,9999,1],["g6s","ダークスチールソードの攻撃力",90,0,9999,1],["g7d","ミスリル防具の防御力",17,0,9999,1],["g7s","ミスリルソードの攻撃力",102,0,9999,1],["g8d","アダマンタイト防具の防御力",19,0,9999,1],["g8s","アダマンタイトソードの攻撃力",114,0,9999,1],["g9d","ヒヒイロカネ防具の防御力",22,0,9999,1],["g9s","ヒヒイロカネソードの攻撃力",132,0,9999,1],["g10d","オリハルコン防具の防御力",25,0,9999,1],["g10s","オリハルコンソードの攻撃力",150,0,9999,1]]],
 ["敵の強さ",[["K","倒すのに必要な標準攻撃の回数（1階）",3,0.5,30,0.5],["N","無防備で耐えられる被弾数（1階）",10,1,50,1],["depth","深い階ほど厳しくなる度合い",1,0,5,0.1],["expDiv","1レベル上がるのに必要な撃破数",3,0.5,30,0.5],["eCrit","敵の痛恨の確率（%）",5,0,100,1],["eCritMul","敵の痛恨の倍率",1.5,1,10,0.1],["monMin","1階あたりの敵の数（最小）",3,0,15,1],["monMax","1階あたりの敵の数（最大）",5,0,15,1],["chase","勇者を追いかけ始める距離（マス）",2,0,20,1]]],
 ["敵のタイプ",[["a0hp","標準型：HP倍率",1,0.1,10,0.05],["a0atk","標準型：攻撃倍率",1,0.1,10,0.05],["a0eva","標準型：回避率（%）",5,0,100,1],["a1hp","速攻型：HP倍率",0.7,0.1,10,0.05],["a1atk","速攻型：攻撃倍率",1.3,0.1,10,0.05],["a1eva","速攻型：回避率（%）",12,0,100,1],["a2hp","重装型：HP倍率",1.5,0.1,10,0.05],["a2atk","重装型：攻撃倍率",0.8,0.1,10,0.05],["a2eva","重装型：回避率（%）",2,0,100,1],["a3hp","呪い型：HP倍率",0.9,0.1,10,0.05],["a3atk","呪い型：攻撃倍率",1.15,0.1,10,0.05],["a3eva","呪い型：回避率（%）",8,0,100,1]]],
 ["守護竜",[["bh","HP（通常の敵の何倍か）",6.25,0.5,50,0.25],["ba","攻撃力（通常の敵の何倍か）",1.68,0.5,20,0.02],["bEva","回避率（%）",5,0,100,1],["bossExp","経験値（通常の敵の何倍か）",5,0,100,0.5],["regenAt","自己再生を使うHP（最大HPの%以下）",50,0,100,5],["regenHeal","自己再生の回復量（最大HPの%）",50,0,100,5]]],
 ["クイズの効果",[["base","基本値・不正解時の効果（%）",5,0,100,1],["perLv","難易度1つごとの上昇（%）",5,0,50,0.5],["sp1","速さ補正：残り80%以上",15,-100,100,1],["sp2","速さ補正：残り60%以上",10,-100,100,1],["sp3","速さ補正：残り40%以上",5,-100,100,1],["sp4","速さ補正：残り20%以上",0,-100,100,1],["sp5","速さ補正：残り20%未満",-5,-100,100,1],["t_lv1","制限時間：Lv1 単語四択（秒）",10,1,300,1],["t_lv2","制限時間：Lv2 単語四択＋なし（秒）",12,1,300,1],["t_lv3","制限時間：Lv3 単語スペル補う（秒）",15,1,300,1],["t_lv4","制限時間：Lv4 単語音声入力（秒）",16,1,300,1],["t_lv5","制限時間：Lv5 単語タイピング（秒）",22,1,300,1],["t_lv6","制限時間：Lv6 表現並び替え過不足なし（秒）",25,1,300,1],["t_lv7","制限時間：Lv7 表現並び替え不要語排除（秒）",28,1,300,1],["t_lv8","制限時間：Lv8 表現並び替え＋1補う（秒）",30,1,300,1],["t_lv9","制限時間：Lv9 表現音声入力（秒）",18,1,300,1],["t_lv10","制限時間：Lv10 表現タイピング（秒）",25,1,300,1],["time","制限時間の全体倍率",1,0.2,10,0.1]]],
 ["必殺技・とくぎ",[["spPow","必殺技の威力（通常の何倍か）",3,0.5,50,0.1],["spSureLv","必殺技が必中になるLv",10,1,999,1],["spDrainLv","必殺技が吸収を得るLv",20,1,999,1],["spDrain","必殺技の吸収量（与ダメージの%）",20,0,100,1],["spAllLv","必殺技が全体攻撃になるLv",30,1,999,1],["s1lv","二連切：習得Lv",5,1,999,1],["s1mp","二連切：消費MP",4,0,999,1],["s1pow","二連切：1発の威力（%）",60,1,1000,5],["s2lv","回転切り：習得Lv",10,1,999,1],["s2mp","回転切り：消費MP",6,0,999,1],["s2pow","回転切り：威力（%）",60,1,1000,5],["s3lv","三連斬：習得Lv",15,1,999,1],["s3mp","三連斬：消費MP",8,0,999,1],["s3pow","三連斬：1発の威力（%）",50,1,1000,5],["s4lv","竜巻切り：習得Lv",20,1,999,1],["s4mp","竜巻切り：消費MP",10,0,999,1],["s4pow","竜巻切り：威力（%）",70,1,1000,5]]],
 ["回復",[["stairHeal","階段を降りたときのHP・MP回復（%）",20,0,100,1],["revive","復活の首飾りで戻るHP（%）",50,1,100,1]]],
 ["どうぐ",[["iPot","初期所持：ポーション",3,0,99,1],["iEth","初期所持：まりょくの水",2,0,99,1],["iWing","初期所持：みちびきのコンパス",1,0,99,1],["iGate","初期所持：さいしんの渦",1,0,99,1],["iNeck","初期所持：復活の首飾り",1,0,99,1],["chestMin","1階あたりの宝箱の数",1,0,10,1],["chest2","宝箱がもう1つ出る確率（%）",40,0,100,1],["dNeck","宝箱：復活の首飾りの確率（%）",1.5,0,100,0.1],["dPot","宝箱：ポーションの比率",50,0,1000,1],["dEth","宝箱：まりょくの水の比率",28,0,1000,1],["dWing","宝箱：コンパスの比率",12,0,1000,1],["dGate","宝箱：さいしんの渦の比率",10,0,1000,1]]]
];\n`;

refJs = refJs.slice(0, s1) + newSchemaSection + refJs.slice(s2);

// 3. セーブ・ロード（autosave / saveRec / loadRec）を塔別セーブに連動
refJs = refJs.replace(
  /let REC=\{best:0,save:null\};[\s\S]*?function saveRec\(\)\{[\s\S]*?\}[\s\S]*?function autosave\(\)\{[\s\S]*?saveRec\(\);?\s*\}/,
  `let REC = loadTowerRec();
function saveRec() {
  saveTowerRec(REC);
}
function autosave() {
  if (S.practice) return;
  if (!REC) REC = loadTowerRec();
  if (S.floor > REC.best) REC.best = S.floor;
  REC.save = { floor: S.floor, cleared: S.cleared, diff: S.diff, p: clone(S.p), st: clone(S.st) };
  saveRec();
}`
);

// 4. ask 関数を Lv1〜10 完全対応版に置換
const oldAskStart = '/* ---------- クイズ ---------- */\nfunction ask(L,kind,done,name){';
const oldAskEnd = '/* ---------- 行動 ---------- */';
const a1 = refJs.indexOf('/* ---------- クイズ ---------- */');
const a2 = refJs.indexOf(oldAskEnd);

if (a1 === -1 || a2 === -1) {
  console.error('[ERROR] ask function section not found');
  process.exit(1);
}

const newAskSection = `/* ---------- クイズ (Lv1〜10 全形式対応) ---------- */
let currentRecognition = null;

function ask(L, kind, done, name) {
  const K = KIND[kind];
  const q = makeQ(L);
  const limit = tlim(L) * 1000;
  const t0 = performance.now();
  let fin = false, hurry = false;

  const qp = $("#quizPane");
  const targetBox = qp || winEl();
  if (!targetBox) return;

  const root = $("#appRoot");
  const isGB = root && root.classList.contains("mode-gb");

  if (root) root.classList.add("is-quiz");
  if (qp) qp.style.display = "flex";

  let h = '<div class="qkind"><span class="qic" aria-hidden="true">' + K[0] + '</span><div><b>' + (name || K[1]) + 'クイズ</b><small>正解で ' + K[2](L) + '</small></div><span class="sec" id="qsec"></span></div>' +
    '<div class="qhead"><span>難易度 ' + L + '・' + (LV_INFO[L] ? LV_INFO[L].name : q.fm) + '</span></div>' +
    '<div class="tbar"><i id="tfill"></i></div>' +
    '<p class="qprompt">' + q.prompt + (q.hint ? '<small>' + q.hint + '</small>' : '') + '</p>';

  if (q.type === "choice") {
    h += '<div class="choices' + (q.is5Choice ? ' choices-5' : '') + '">' +
      q.choices.map((c, i) => '<button data-c="' + i + '" type="button">' + (i + 1) + '. ' + c + '</button>').join("") +
      '</div>';
  } else if (q.type === "spell") {
    h += '<div class="spell-display" style="font-size:22px;letter-spacing:4px;color:var(--gold);text-align:center;margin:6px 0;font-family:var(--game);font-weight:bold;">' + q.hint + '</div>' +
      '<form class="typed" id="qform"><input type="text" id="qin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="抜けた文字または単語を入力" aria-label="英語で入力"><button type="submit">こたえる</button></form>';
  } else if (q.type === "voice") {
    h += '<div class="voice-box" style="display:flex;flex-direction:column;align-items:center;gap:8px;margin:6px 0;">' +
      '<button type="button" id="voiceBtn" style="background:#1e88e5;color:#fff;font-size:14px;padding:8px 16px;border-radius:20px;font-family:var(--game);border:none;cursor:pointer;">🎙️ マイクを押して英語で発音</button>' +
      '<div id="voiceStatus" style="font-size:12px;color:var(--muted);font-family:var(--game);">ボタンを押して英語で話してね</div>' +
      '<button type="button" id="voiceSwitchBtn" style="font-size:11px;padding:3px 8px;background:none;border:1px solid #555;color:var(--muted);font-family:var(--game);cursor:pointer;">⌨️ 文字入力に切り替え</button>' +
      '<form class="typed" id="qform" style="display:none;width:100%;margin-top:6px;"><input type="text" id="qin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="英語で入力"><button type="submit">こたえる</button></form>' +
      '</div>';
  } else if (q.type === "sort") {
    h += '<div class="sort-area" style="display:flex;flex-direction:column;gap:6px;margin:4px 0;">' +
      (q.variant === 'missing' ? '<div style="display:flex;gap:6px;align-items:center;"><input type="text" id="sortMissingIn" placeholder="足りない単語を入力" style="font-size:14px;padding:4px 8px;flex:1;background:#000;color:#fff;border:1px solid var(--line);border-radius:4px;"><button type="button" id="sortAddBtn" style="font-size:12px;padding:4px 10px;background:var(--gold);color:#000;font-weight:bold;">＋追加</button></div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted);font-family:var(--game);">' +
      '<span>回答枠（タップして並べる）</span>' +
      '<button type="button" id="sortClearBtn" style="font-size:10px;padding:2px 8px;background:#2b2942;">クリア</button>' +
      '</div>' +
      '<div id="sortSlots" style="min-height:36px;border:1px dashed var(--gold);border-radius:4px;padding:4px;display:flex;flex-wrap:wrap;gap:4px;background:rgba(245,176,39,0.08);align-items:center;"></div>' +
      '<div style="font-size:11px;color:var(--muted);font-family:var(--game);">単語カード' + (q.variant === 'dummy' ? '（1語不要なものがあるよ）' : '') + '</div>' +
      '<div id="sortPool" style="display:flex;flex-wrap:wrap;gap:4px;"></div>' +
      '<button type="button" id="sortSubmit" style="width:100%;margin-top:4px;background:#2ed573;color:#000;font-weight:bold;font-size:14px;padding:6px;display:none;">これで回答する ▶</button>' +
      '</div>';
  } else {
    // type
    h += '<form class="typed" id="qform"><input type="text" id="qin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="英語で入力..." aria-label="英語で入力"><button type="submit">こたえる</button></form>';
  }

  targetBox.innerHTML = h + '<p class="qres" id="qres"></p>';

  const fill = $("#tfill"), sec = $("#qsec");

  function finish(ok, timeout, btn) {
    if (fin) return;
    fin = true;
    cancelAnimationFrame(raf);
    quizKey = null;

    if (currentRecognition) {
      try { currentRecognition.abort(); } catch(e) {}
      currentRecognition = null;
    }

    // 回答終了時にソフトウェアキーボードを直ちに格納
    if (window.AppKeyboard) {
      AppKeyboard.hide();
      AppKeyboard.resetTarget();
    }

    const r = Math.min(1, (performance.now() - t0) / limit);
    S.st.total++;
    if (ok) S.st.ok++;
    const sp = spdOf(r);
    const correctDisplay = q.answer || (q.validAnswers && q.validAnswers[0]) || "";
    const resTxt = ok
      ? "せいかい！ 速さ補正 " + (sp > 0 ? "+" : sp < 0 ? "−" : "±") + Math.abs(sp) + "% → 効果 " + (bonus(L) + sp) + "%"
      : (timeout ? "じかんぎれ… " : "ざんねん… ") + "こたえは「" + correctDisplay + "」";

    se(ok ? "quiz_correct" : "quiz_wrong");
    if (ok && sp >= CFG.sp1 && CFG.sp1 > CFG.sp2) se("speed_bonus", 250);

    if (isGB) {
      if (root) root.classList.remove("is-quiz");
      if (qp) qp.style.display = "none";
      const w = winEl();
      if (w) {
        w.innerHTML = '<p class="msg ' + (ok ? "ok" : "ng") + '" style="color:' + (ok ? 'var(--heal)' : 'var(--danger)') + ';font-weight:bold;">' + (ok ? '⭕ ' : '❌ ') + resTxt + '</p>';
      }
      setTimeout(() => done({ ok, r, L, sp }), ok ? 800 : 1500);
    } else {
      targetBox.querySelectorAll("button,input").forEach(b => b.disabled = true);
      if (btn) btn.classList.add(ok ? "ok" : "ng");
      const res = $("#qres");
      if (res) {
        res.className = "qres " + (ok ? "ok" : "ng");
        res.textContent = resTxt;
      }
      setTimeout(() => {
        if (root) root.classList.remove("is-quiz");
        if (qp) qp.style.display = "none";
        done({ ok, r, L, sp });
      }, ok ? 800 : 1500);
    }
  }

  // クイズ形式別の入力・キーボード紐づけ
  if (q.type === "choice") {
    if (window.AppKeyboard) {
      AppKeyboard.hide();
      AppKeyboard.resetTarget();
    }
    const bs = targetBox.querySelectorAll("button[data-c]");
    bs.forEach(b => b.onclick = () => finish(q.choices[+b.dataset.c] === q.answer, false, b));
    quizKey = k => {
      const n = "12345".indexOf(k);
      if (n >= 0 && bs[n]) bs[n].click();
    };
    choiceIndex = 0;
    updatePadFocus();
  } else if (q.type === "sort") {
    if (window.AppKeyboard) {
      AppKeyboard.hide();
      AppKeyboard.resetTarget();
    }
    const slotsEl = targetBox.querySelector("#sortSlots");
    const poolEl = targetBox.querySelector("#sortPool");
    const submitBtn = targetBox.querySelector("#sortSubmit");
    const clearBtn = targetBox.querySelector("#sortClearBtn");
    const missingIn = targetBox.querySelector("#sortMissingIn");
    const addBtn = targetBox.querySelector("#sortAddBtn");

    let placedWords = [];
    let poolWords = q.cards.slice();

    function renderSort() {
      if (!slotsEl || !poolEl) return;
      slotsEl.innerHTML = placedWords.map((w, idx) => '<button type="button" class="sort-card placed" data-idx="' + idx + '" style="padding:4px 8px;font-size:13px;background:var(--gold);color:#000;border:1px solid #fff;border-radius:4px;cursor:pointer;">' + w + '</button>').join("");
      poolEl.innerHTML = poolWords.map((w, idx) => '<button type="button" class="sort-card in-pool" data-idx="' + idx + '" style="padding:4px 8px;font-size:13px;background:#201f30;color:#fff;border:1px solid var(--line);border-radius:4px;cursor:pointer;">' + w + '</button>').join("");

      slotsEl.querySelectorAll(".sort-card.placed").forEach(b => {
        b.onclick = () => {
          const idx = +b.dataset.idx;
          const removed = placedWords.splice(idx, 1)[0];
          poolWords.push(removed);
          renderSort();
          se("select");
        };
      });

      poolEl.querySelectorAll(".sort-card.in-pool").forEach(b => {
        b.onclick = () => {
          const idx = +b.dataset.idx;
          const picked = poolWords.splice(idx, 1)[0];
          placedWords.push(picked);
          renderSort();
          se("select");
        };
      });

      if (submitBtn) {
        submitBtn.style.display = placedWords.length >= q.expectedCount ? "block" : "none";
      }
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        poolWords = poolWords.concat(placedWords);
        placedWords = [];
        renderSort();
        se("cancel");
      };
    }

    if (addBtn && missingIn) {
      const doAdd = () => {
        const val = missingIn.value.trim();
        if (!val) return;
        placedWords.push(val);
        missingIn.value = "";
        renderSort();
        se("decide");
        if (window.AppKeyboard) AppKeyboard.hide();
      };
      addBtn.onclick = doAdd;
      missingIn.onfocus = () => {
        if (window.AppKeyboard) {
          AppKeyboard.setMode('english');
          AppKeyboard.setTarget(missingIn);
          AppKeyboard.show();
        }
      };
    }

    if (submitBtn) {
      submitBtn.onclick = () => {
        const formed = placedWords.join(" ");
        const norm = normalizeText(formed);
        const ok = q.validAnswers ? q.validAnswers.some(a => normalizeText(a) === norm) : normalizeText(q.answer) === norm;
        finish(ok, false, submitBtn);
      };
    }

    renderSort();
    quizKey = null;
  } else if (q.type === "voice") {
    const vBtn = targetBox.querySelector("#voiceBtn");
    const vStat = targetBox.querySelector("#voiceStatus");
    const swBtn = targetBox.querySelector("#voiceSwitchBtn");
    const qform = targetBox.querySelector("#qform");
    const inp = targetBox.querySelector("#qin");

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    const submitVoice = (val) => {
      const norm = normalizeText(val);
      const ok = q.validAnswers ? q.validAnswers.some(a => normalizeText(a) === norm) : normalizeText(q.answer) === norm;
      finish(ok, false, null);
    };

    if (swBtn && qform && inp) {
      swBtn.onclick = () => {
        if (vBtn) vBtn.style.display = "none";
        if (vStat) vStat.style.display = "none";
        swBtn.style.display = "none";
        qform.style.display = "flex";
        inp.focus();
        if (window.AppKeyboard) {
          AppKeyboard.setMode('english');
          AppKeyboard.setTarget(inp);
          AppKeyboard.show();
        }
      };
    }

    if (!SpeechRec) {
      if (vStat) vStat.textContent = "音声入力非対応のため、文字入力をお使いください";
      if (swBtn) swBtn.click();
    } else if (vBtn) {
      vBtn.onclick = () => {
        if (currentRecognition) return;
        try {
          const rec = new SpeechRec();
          rec.lang = 'en-US';
          rec.continuous = false;
          rec.interimResults = false;
          currentRecognition = rec;
          vStat.textContent = "🎙️ 聞き取り中... 英語で話してね";
          vBtn.style.background = "#e50914";

          rec.onresult = (ev) => {
            const transcript = ev.results[0][0].transcript;
            vStat.textContent = "「" + transcript + "」と認識しました";
            setTimeout(() => submitVoice(transcript), 400);
          };
          rec.onerror = (err) => {
            vStat.textContent = "認識できませんでした。もう一度試すか文字入力をお使いください";
            vBtn.style.background = "#1e88e5";
            currentRecognition = null;
          };
          rec.onend = () => {
            vBtn.style.background = "#1e88e5";
            currentRecognition = null;
          };
          rec.start();
        } catch(e) {
          vStat.textContent = "音声認識エラー。文字入力をお使いください";
        }
      };
    }

    if (qform && inp) {
      qform.onsubmit = (e) => {
        e.preventDefault();
        submitVoice(inp.value);
      };
    }
  } else {
    // spell または type
    const inp = targetBox.querySelector("#qin");
    const qform = targetBox.querySelector("#qform");
    if (inp) {
      inp.focus();
      inp.setAttribute("inputmode", "latin");
      inp.addEventListener("input", () => {
        const sanitized = inp.value.replace(/[^a-zA-Z0-9\\s'’\\-]/g, "");
        if (inp.value !== sanitized) {
          inp.value = sanitized;
          const prev = $("#vkPreviewInput");
          if (prev) prev.value = sanitized;
        }
      });
      if (window.AppKeyboard) {
        AppKeyboard.setMode('english');
        AppKeyboard.setTarget(inp);
        AppKeyboard.show();
      }
    }

    if (qform) {
      qform.onsubmit = (e) => {
        e.preventDefault();
        if (window.AppKeyboard) {
          AppKeyboard.hide();
          AppKeyboard.resetTarget();
        }
        const val = normalizeText(inp ? inp.value : "");
        let ok = false;
        if (q.type === "spell") {
          ok = (val === normalizeText(q.rawWord)) || (val === normalizeText(q.missingChars));
        } else {
          ok = q.validAnswers ? q.validAnswers.some(a => normalizeText(a) === val) : normalizeText(q.answer) === val;
        }
        finish(ok, false, null);
      };
    }
    quizKey = null;
  }

  (function tick() {
    if (fin) return;
    const el = performance.now() - t0, left = Math.max(0, limit - el);
    if (fill) fill.style.width = (100 * left / limit) + "%";
    if (!hurry && left < limit * 0.2) { hurry = true; se("quiz_hurry"); }
    if (sec) sec.textContent = (left / 1000).toFixed(1) + " 秒";
    if (left <= 0) return finish(false, true, null);
    raf = requestAnimationFrame(tick);
  })();
}
\n`;

refJs = refJs.slice(0, a1) + newAskSection + refJs.slice(a2);

// 5. 戻るボタンのバインド置換
refJs = refJs.replace(
  /const bBtn = \$\("#topBackBtn"\);[\s\S]*?bBtn\.onclick = \(e\)=>\{[\s\S]*?\};\s*\}/,
  `const bBtn = $("#topBackBtn");
  if (bBtn) {
    bBtn.onclick = (e) => {
      e.preventDefault();
      handleTopBack();
    };
  }`
);

// 5.0 diffRow の置換（10段階難易度の名称表示に対応し、FMT未定義エラーを防ぐ）
refJs = refJs.replace(
  /function diffRow\(\)\{[\s\S]*?return h\+'<p class="dnote">'[\s\S]*?<\/p>';\s*\}/,
  `function diffRow(){
  let h='<div class="diff"><span class="dtitle">難易度</span>';
  for(let n=1;n<=10;n++) h+='<button type="button" class="dchip'+(n===S.diff?" on":"")+'" data-l="'+n+'" aria-label="難易度'+n+'">'+n+'</button>';
  h+='<span class="dnav-hint">◀▶選択 / ▼コマンド</span></div>';
  const lvName = (typeof LV_INFO !== "undefined" && LV_INFO[S.diff]) ? LV_INFO[S.diff].name : ("Lv " + S.diff);
  return h+'<p class="dnote">'+lvName+'・正解で効果 '+bonus(S.diff)+'%＋速さ補正（不正解は '+CFG.base+'%）</p>';
}`
);


// 5.1 イベントガード追加（ダンジョンゲーム非アクティブ時に他の画面へ干渉しないようにする）
refJs = `function isDungeonActive() {
  const sec = document.getElementById("section-dungeon");
  return sec && sec.classList.contains("active") && document.body.classList.contains("in-dungeon-game");
}\n\n` + refJs;

refJs = refJs.replace(
  'document.addEventListener("click",e=>{',
  'document.addEventListener("click",e=>{ if(!isDungeonActive()) return;'
);
refJs = refJs.replace(
  'document.addEventListener("click",e=>{',
  'document.addEventListener("click",e=>{ if(!isDungeonActive()) return;'
);
refJs = refJs.replace(
  'document.addEventListener("touchstart",e=>{',
  'document.addEventListener("touchstart",e=>{ if(!isDungeonActive()) return;'
);
refJs = refJs.replace(
  'window.addEventListener("keydown", e => {',
  'window.addEventListener("keydown", e => { if(!isDungeonActive()) return;'
);
refJs = refJs.replace(
  'document.addEventListener("keydown",e=>{',
  'document.addEventListener("keydown",e=>{ if(!isDungeonActive()) return;'
);
refJs = refJs.replace(
  'window.addEventListener("resize",()=>{',
  'window.addEventListener("resize",()=>{ if(!isDungeonActive()) return;'
);

// 5.2 即時起動 boot の無害化（塔選択画面から startDungeonWithTower で安全に起動）
refJs = refJs.replace(
  /const hot=window\.claude&&window\.claude\.hot;[\s\S]*?if\(hot&&hot\.ready\)hot\.ready\(boot\); else boot\(\(hot&&hot\.data\)\|\|\{\}\);/,
  '// boot will be invoked via startDungeonWithTower() or openDungeonGame()'
);

// 5.3 旧テスター・チートボタン イベント（プレイヤーメニューから管理者画面へ移設したため、直接バインドによるnullエラーを防止）
refJs = refJs.replace(
  /\/\* デバッグテスター・チートボタン イベント \*\/[\s\S]*?\$\("#mTryBtn"\)\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};\s*/,
  () => `/* デバッグテスター・チートボタン イベント（管理者画面 16-parent-admin-dungeon へ移設） */
  const rSaveBtn = $("#mResetSaveBtn");
  if (rSaveBtn) {
    rSaveBtn.onclick = () => {
      if (confirm("セーブデータを初期化しますか？（最高記録もリセットされます）")) {
        REC = {best:0, save:null};
        saveRec();
        renderStatus();
        alert("セーブデータを初期化しました。");
      }
    };
  }

  $$(".mode-btn").forEach(b => {
    b.onclick = () => {
      $$(".mode-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentDisplayMode = b.dataset.mode;
      applyLayout();
      se("select");
    };
  });

  const hapticsEl = $("#mHapticsToggle");
  if (hapticsEl) {
    hapticsEl.onchange = (e) => {
      hapticsEnabled = e.target.checked;
    };
  }
`
);


// 6. 追加関数（handleTopBack, 塔選択画面, 保護者管理画面）
const extraAdminAndNavFunctions = `
/* ==========================================================================
   🏰 塔選択画面 ＆ 画面遷移 ＆ 保護者管理画面連携
   ========================================================================== */
function handleTopBack() {
  if (S && S.screen && (S.screen === "explore" || S.screen === "battle")) {
    if (confirm("塔の選択画面に戻りますか？\\n（現在の進行状況はセーブされます）")) {
      autosave();
      if (window.AppKeyboard) AppKeyboard.hide();
      backToTowerSelect();
    }
  } else {
    if (window.AppKeyboard) AppKeyboard.hide();
    backToTowerSelect();
  }
}

function openDungeonGame(startFloor, isPractice) {
  document.body.classList.add('in-dungeon-game');
  const sec = document.getElementById("section-dungeon");
  if (sec) {
    sec.style.display = "block";
    sec.classList.add("active");
  }
  if (typeof switchSection === "function") {
    switchSection("section-dungeon");
  } else if (typeof global.switchSection === "function") {
    global.switchSection("section-dungeon");
  } else {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    if (sec) sec.classList.add('active');
  }
  if (typeof startFloor === "number" && startFloor > 0) {
    startDungeonWithTower(currentTower.id, startFloor, !!isPractice);
  } else {
    backToTowerSelect();
  }
}

function backToTowerSelect() {
  document.body.classList.add('in-dungeon-game');
  if (window.AppKeyboard) AppKeyboard.hide();
  const selectView = document.getElementById("dungeon-tower-select");
  const mainView = document.getElementById("dungeon-game-main");
  if (selectView) selectView.style.display = "block";
  if (mainView) mainView.style.display = "none";
  renderTowerCards();
}

function startDungeonWithTower(towerId, startFloor, isPractice) {
  const tower = TOWERS.find(t => t.id === towerId) || TOWERS[0];
  currentTower = tower;
  document.body.classList.add('in-dungeon-game');

  const selectView = document.getElementById("dungeon-tower-select");
  const mainView = document.getElementById("dungeon-game-main");
  if (selectView) selectView.style.display = "none";
  if (mainView) mainView.style.display = "block";

  applyLayout();
  buildSoundTestGrid();
  renderTune();
  autoLoadRelativeAudio();
  if (window.AppKeyboard) AppKeyboard.init();

  REC = loadTowerRec(tower.id);
  const bestTag = $("#best");
  if (bestTag) bestTag.textContent = REC.best ? "地下 " + REC.best + " 階" : "—";

  if (typeof startFloor === "number" && startFloor > 0) {
    start(startFloor, !!isPractice);
  } else if (REC.save && !isPractice) {
    resume();
  } else {
    start(1, false);
  }
}

function renderTowerCards() {
  const listEl = document.getElementById("dungeon-tower-list");
  if (!listEl) return;
  loadTowers();

  listEl.innerHTML = TOWERS.map(tower => {
    const rec = loadTowerRec(tower.id);
    const hasSave = !!rec.save;
    const isCleared = rec.best >= (tower.maxFloor || 100);

    return \`
      <div class="dungeon-tower-card \${isCleared ? 'best-cleared' : ''}">
        <div>
          <h2 class="dungeon-tower-title">🏰 \${tower.name}</h2>
          <p class="dungeon-tower-desc">\${tower.desc || '問題に挑戦して最深階を目指そう！'}</p>
        </div>
        <div class="dungeon-tower-meta">
          <span>最高到達: <b>\${rec.best ? '地下 ' + rec.best + ' 階' : '未挑戦'}</b></span>
          <span>最大: <b>\${tower.maxFloor || 100}階</b></span>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          \${hasSave ? \`<button type="button" class="dungeon-btn" style="flex:1;background:var(--gold);color:#000;font-weight:bold;font-size:13px;padding:6px;" onclick="startDungeonWithTower('\${tower.id}')">▶ つづきから（地下 \${rec.save.floor} 階）</button>\` : ''}
          <button type="button" class="dungeon-btn" style="flex:1;background:\${hasSave ? '#201f30' : 'var(--gold)'};color:\${hasSave ? '#fff' : '#000'};font-weight:bold;font-size:13px;padding:6px;" onclick="startDungeonWithTower('\${tower.id}', 1, false)">\${hasSave ? '最初から' : '⚔️ 挑戦する'}</button>
        </div>
      </div>
    \`;
  }).join("");
}

function exitDungeonToHome() {
  document.body.classList.remove('in-dungeon-game');
  if (window.AppKeyboard) AppKeyboard.hide();
  const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
  if (typeof showHome === "function") {
    showHome(user);
  } else if (typeof switchSection === "function") {
    switchSection("section-home");
  }
}

/* ---------- 保護者管理画面 (16-parent-admin-dungeon.html) 連携 ---------- */
function openParentAdminDungeon() {
  document.body.classList.remove('in-dungeon-game');
  if (window.AppKeyboard) AppKeyboard.hide();

  const sec = document.getElementById("section-parent-admin-dungeon");
  if (sec) {
    sec.style.display = "block";
    sec.classList.add("active");
  }
  if (typeof switchSection === "function") {
    switchSection("section-parent-admin-dungeon");
  } else if (typeof global.switchSection === "function") {
    global.switchSection("section-parent-admin-dungeon");
  } else {
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('active');
      if (s.id !== "section-parent-admin-dungeon") s.style.display = 'none';
    });
    if (sec) sec.classList.add('active');
  }
  switchAdminDungeonTab('params');
  renderAdminParams();
  renderAdminTowerList();
}

function exitParentAdminDungeon() {
  const sec = document.getElementById("section-parent-admin-dungeon");
  if (sec) {
    sec.classList.remove('active');
    sec.style.display = 'none';
  }
  if (typeof switchSection === "function") {
    switchSection("section-parent-admin");
  } else if (typeof global.switchSection === "function") {
    global.switchSection("section-parent-admin");
  } else {
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const pSec = document.getElementById("section-parent-admin");
    if (pSec) {
      pSec.classList.add('active');
      pSec.style.display = 'block';
    }
  }
}

function switchAdminDungeonTab(tab) {
  const tBtn = document.getElementById("dungeon-tab-towers-btn");
  const pBtn = document.getElementById("dungeon-tab-params-btn");
  const tPanel = document.getElementById("dungeon-admin-tab-towers");
  const pPanel = document.getElementById("dungeon-admin-tab-params");

  if (tab === 'towers') {
    if (tBtn) { tBtn.style.background = "var(--gold)"; tBtn.style.color = "#000"; tBtn.style.fontWeight = "bold"; }
    if (pBtn) { pBtn.style.background = "var(--panel)"; pBtn.style.color = "var(--fg)"; pBtn.style.fontWeight = "normal"; }
    if (tPanel) tPanel.style.display = "block";
    if (pPanel) pPanel.style.display = "none";
    renderAdminTowerList();
  } else {
    if (pBtn) { pBtn.style.background = "var(--gold)"; pBtn.style.color = "#000"; pBtn.style.fontWeight = "bold"; }
    if (tBtn) { tBtn.style.background = "var(--panel)"; tBtn.style.color = "var(--fg)"; tBtn.style.fontWeight = "normal"; }
    if (tPanel) tPanel.style.display = "none";
    if (pPanel) pPanel.style.display = "block";
    renderAdminParams();
  }
}

function renderAdminTowerList() {
  const container = document.getElementById("dungeon-admin-tower-cards");
  if (!container) return;
  loadTowers();

  container.innerHTML = TOWERS.map(tower => {
    const vCount = tower.vocabUnits && tower.vocabUnits.length > 0 ? tower.vocabUnits.length + ' 単元' : '全単語（' + ALL_VOCAB_UNITS.length + ' 単元）';
    const eCount = tower.exprUnits && tower.exprUnits.length > 0 ? tower.exprUnits.length + ' 単元' : '全表現（' + ALL_EXPR_UNITS.length + ' 単元）';

    return \`
      <div style="background:#1b1a2a;border:1px solid #37344f;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:220px;">
          <h3 style="margin:0 0 4px;font-size:16px;color:var(--gold);font-family:var(--game);">🏰 \${tower.name}</h3>
          <p style="margin:0 0 6px;font-size:12px;color:var(--muted);">\${tower.desc || '説明なし'}</p>
          <div style="font-size:11px;color:var(--fg);display:flex;gap:12px;flex-wrap:wrap;">
            <span>最大: \${tower.maxFloor || 100}階</span>
            <span>制限時間: \${Math.round((tower.timeMultiplier || 1.0) * 100)}%</span>
            <span>単語: \${vCount}</span>
            <span>表現: \${eCount}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="dungeon-btn" style="font-size:12px;padding:4px 10px;" onclick="openTowerEditModal('\${tower.id}')">✏️ 編集</button>
          \${TOWERS.length > 1 ? \`<button type="button" class="dungeon-btn" style="font-size:12px;padding:4px 10px;color:var(--danger);border-color:var(--danger);" onclick="deleteTower('\${tower.id}')">🗑️ 削除</button>\` : ''}
        </div>
      </div>
    \`;
  }).join("");
}

function openTowerEditModal(towerId) {
  const panel = document.getElementById("dungeon-tower-edit-panel");
  const title = document.getElementById("dungeon-tower-edit-title");
  if (!panel) return;

  const tower = towerId ? TOWERS.find(t => t.id === towerId) : {
    id: "tower_" + Date.now(),
    name: "",
    desc: "",
    maxFloor: 100,
    timeMultiplier: 1.0,
    vocabUnits: [],
    exprUnits: []
  };

  title.textContent = towerId ? "🏰 塔の編集: " + tower.name : "🏰 新しい塔の追加";
  document.getElementById("tower-edit-id").value = tower.id;
  document.getElementById("tower-edit-name").value = tower.name;
  document.getElementById("tower-edit-desc").value = tower.desc || "";
  document.getElementById("tower-edit-maxfloor").value = tower.maxFloor || 100;
  document.getElementById("tower-edit-timemul").value = Math.round((tower.timeMultiplier || 1.0) * 100);

  // 単元チェックボックス群の生成
  const vContainer = document.getElementById("tower-edit-vocab-units");
  if (vContainer) {
    vContainer.innerHTML = ALL_VOCAB_UNITS.map(u => {
      const checked = !tower.vocabUnits || tower.vocabUnits.length === 0 || tower.vocabUnits.includes(u);
      return \`<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" name="vocab_unit" value="\${u}" \${checked ? 'checked' : ''}><span>\${u}</span></label>\`;
    }).join("");
  }

  const eContainer = document.getElementById("tower-edit-expr-units");
  if (eContainer) {
    eContainer.innerHTML = ALL_EXPR_UNITS.map(u => {
      const checked = !tower.exprUnits || tower.exprUnits.length === 0 || tower.exprUnits.includes(u);
      return \`<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" name="expr_unit" value="\${u}" \${checked ? 'checked' : ''}><span>\${u}</span></label>\`;
    }).join("");
  }

  panel.style.display = "block";
  panel.scrollIntoView({ behavior: 'smooth' });
}

function closeTowerEditModal() {
  const panel = document.getElementById("dungeon-tower-edit-panel");
  if (panel) panel.style.display = "none";
}

function toggleAllUnits(type, select) {
  const name = type === 'vocab' ? 'vocab_unit' : 'expr_unit';
  document.querySelectorAll('input[name="' + name + '"]').forEach(cb => {
    cb.checked = !!select;
  });
}

const towerForm = document.getElementById("dungeon-tower-edit-form");
if (towerForm) {
  towerForm.onsubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("tower-edit-id").value;
    const name = document.getElementById("tower-edit-name").value.trim();
    const desc = document.getElementById("tower-edit-desc").value.trim();
    const maxFloor = parseInt(document.getElementById("tower-edit-maxfloor").value, 10) || 100;
    const timeMul = (parseInt(document.getElementById("tower-edit-timemul").value, 10) || 100) / 100;

    const vSelected = [...document.querySelectorAll('input[name="vocab_unit"]:checked')].map(cb => cb.value);
    const eSelected = [...document.querySelectorAll('input[name="expr_unit"]:checked')].map(cb => cb.value);

    const existingIdx = TOWERS.findIndex(t => t.id === id);
    const newTower = {
      id: id || ("tower_" + Date.now()),
      name: name || "新しい塔",
      desc: desc,
      maxFloor: Math.max(10, Math.min(100, maxFloor)),
      timeMultiplier: Math.max(0.3, Math.min(3.0, timeMul)),
      vocabUnits: vSelected.length === ALL_VOCAB_UNITS.length ? [] : vSelected,
      exprUnits: eSelected.length === ALL_EXPR_UNITS.length ? [] : eSelected
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
    alert("塔の設定を保存しました！");
  };
}

function deleteTower(towerId) {
  if (TOWERS.length <= 1) {
    alert("塔は最低1つ必要です。");
    return;
  }
  if (!confirm("この塔を削除しますか？")) return;
  TOWERS = TOWERS.filter(t => t.id !== towerId);
  saveTowers();
  renderAdminTowerList();
  renderTowerCards();
}

function renderAdminParams() {
  const pBox = document.getElementById("dungeon-admin-params");
  const tbl = document.getElementById("dungeon-admin-ttable");
  if (pBox) {
    pBox.innerHTML = SCHEMA.map((g, gi) => '<details class="pgroup"><summary style="cursor:pointer;color:var(--gold);margin-bottom:6px;">' + g[0] + '</summary><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;margin-bottom:8px;">' + g[1].map(r => '<label style="font-size:12px;display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:#11101e;border:1px solid #37344f;border-radius:4px;"><span>' + r[1] + '</span><input type="number" id="adm_p_' + r[0] + '" min="' + r[3] + '" max="' + r[4] + '" step="' + r[5] + '" value="' + CFG[r[0]] + '" style="width:70px;background:#000;color:#fff;border:1px solid var(--line);border-radius:3px;font-size:12px;padding:2px 4px;"></label>').join("") + '</div></details>').join("");
    SCHEMA.forEach(g => g[1].forEach(r => {
      const el = document.getElementById("adm_p_" + r[0]);
      if (el) el.addEventListener("change", e => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v)) v = DEF[r[0]];
        v = Math.max(r[3], Math.min(r[4], v));
        CFG[r[0]] = v;
        e.target.value = v;
        applyCfg();
        renderAdminParamsTable();
      });
    }));
  }
  renderAdminParamsTable();

  const resetBtn = document.getElementById("dungeon-cfgReset");
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm("パラメータをすべて初期値に戻しますか？")) {
        Object.assign(CFG, DEF);
        applyCfg();
        renderAdminParams();
        alert("初期値に戻しました。");
      }
    };
  }

  const outBtn = document.getElementById("dungeon-cfgOut");
  if (outBtn) {
    outBtn.onclick = () => {
      const t = JSON.stringify(CFG);
      const txt = document.getElementById("dungeon-cfgText");
      if (txt) txt.value = t;
      try { navigator.clipboard.writeText(t); } catch(e) {}
      const msg = document.getElementById("dungeon-cfgMsg");
      if (msg) msg.textContent = "設定JSONを書き出しました。クリップボードにもコピーしました。";
    };
  }

  const inBtn = document.getElementById("dungeon-cfgIn");
  if (inBtn) {
    inBtn.onclick = () => {
      const txt = document.getElementById("dungeon-cfgText");
      if (!txt) return;
      try {
        const o = JSON.parse(txt.value);
        setCfg(o);
        applyCfg();
        renderAdminParams();
        const msg = document.getElementById("dungeon-cfgMsg");
        if (msg) msg.textContent = "設定を読み込みました。";
      } catch(e) {
        alert("読み込めませんでした。正しいJSON形式で貼り付けてください。");
      }
    };
  }

  const tryBtn = document.getElementById("dungeon-tryBtn");
  if (tryBtn) {
    tryBtn.onclick = () => {
      const fInp = document.getElementById("dungeon-tryF");
      const f = fInp ? Math.max(1, Math.min(100, parseInt(fInp.value, 10) || 1)) : 1;
      openDungeonGame(f, true);
    };
  }
}

function adminCheatAction(type) {
  if (!S || !S.p) {
    alert("まず「練習モードで試走する ▶」を押してダンジョンを開始してください。");
    return;
  }
  if (type === 'heal') {
    S.p.hp = pMaxHp(S.p.lv);
    S.p.mp = pMaxMp(S.p.lv);
    se("heal_hp");
    alert("HP・MPを全回復しました！");
  } else if (type === 'gauge') {
    S.p.gauge = 100;
    se("special_start");
    alert("必殺ゲージをMAX（100%）にしました！");
  } else if (type === 'items') {
    for (let k in S.p.it) S.p.it[k] = (S.p.it[k] || 0) + 5;
    se("gear_get");
    alert("全アイテムを+5個補給しました！");
  } else if (type === 'gear') {
    S.p.gearMax = 10;
    S.p.eq = fullSet(10);
    se("equip");
    alert("オリハルコン（最強装備一式）を装備しました！");
  } else if (type === 'skip') {
    if (S.floor < (currentTower.maxFloor || 100)) {
      S.floor++;
      enterFloor("地下 " + S.floor + " 階に スキップした。");
      openDungeonGame(S.floor, true);
    } else {
      alert("最深階です。");
    }
  } else if (type === 'battle') {
    openDungeonGame(S.floor || 1, true);
    setTimeout(() => {
      startBattle(ri(4), false);
    }, 200);
  } else if (type === 'boss') {
    openDungeonGame(S.floor || 1, true);
    setTimeout(() => {
      startBattle(0, true);
    }, 200);
  }
}

function renderAdminParamsTable() {
  const tbl = document.getElementById("dungeon-admin-ttable");
  if (!tbl) return;
  let h = "<tr><th>階</th><th>想定Lv</th><th>主HP</th><th>主攻</th><th>主防</th><th>敵HP</th><th>敵攻</th><th>必要攻撃</th><th>耐久</th><th>竜HP</th><th>竜攻</th></tr>";
  for (const f of [1, 10, 30, 50, 80, 100]) {
    const s = monStats(f, archOf(0), false), b = f % 10 === 0 ? monStats(f, archOf(0), true) : null;
    h += "<tr><td>" + f + "</td><td>" + f + "</td><td>" + pMaxHp(f) + "</td><td>" + expAtk(f) + "</td><td>" + expDef(f) + "</td><td>" + s.hp + "</td><td>" + s.atk + "</td><td>" + kHits(f).toFixed(1) + "</td><td>" + nHits(f).toFixed(1) + "</td><td>" + (b ? b.hp : "—") + "</td><td>" + (b ? b.atk : "—") + "</td></tr>";
  }
  tbl.innerHTML = h;
}
`;

// 7. グローバル公開オブジェクト
const globalExports = `
  /* ==========================================================================
     🌐 グローバル公開 API
     ========================================================================== */
  global.DungeonGame = {
    open: openDungeonGame,
    openAdmin: openParentAdminDungeon,
    backToSelect: backToTowerSelect,
    exitHome: exitDungeonToHome,
    startWithTower: startDungeonWithTower,
    getTowers: () => TOWERS,
    setTower: (id) => { currentTower = TOWERS.find(t => t.id === id) || TOWERS[0]; }
  };

  global.openDungeonGame = openDungeonGame;
  global.backToTowerSelect = backToTowerSelect;
  global.exitDungeonToHome = exitDungeonToHome;
  global.startDungeonWithTower = startDungeonWithTower;

  global.openParentAdminDungeon = openParentAdminDungeon;
  global.exitParentAdminDungeon = exitParentAdminDungeon;
  global.switchAdminDungeonTab = switchAdminDungeonTab;
  global.openTowerEditModal = openTowerEditModal;
  global.closeTowerEditModal = closeTowerEditModal;
  global.toggleAllUnits = toggleAllUnits;
  global.resetTowersToDefault = resetTowersToDefault;
  global.deleteTower = deleteTower;
  global.adminCheatAction = adminCheatAction;

  // 初期化
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        renderTowerCards();
      });
    } else {
      renderTowerCards();
    }
  }
`;

// 最終組み立て
const finalJs = `/**
 * js/modules/dungeonGame.js
 * 単語迷宮 百階 (Dungeon RPG Gamification)
 * 完全刷新版: 「参考/単語迷宮 百階.html」のUI/UX（GBモード・Switchモード、HUD、戦闘画面、フィールド探索、
 * ソフトウェアキーボード、ゲームパッド、サウンド）を採用し、
 * 教材マニフェスト連携、塔管理、難易度1〜10問題出題、パラメータ調整、画面遷移を統合。
 */

(function(global) {
  'use strict';

` + refJs + '\n' + extraAdminAndNavFunctions + '\n' + globalExports + '\n})(typeof window !== "undefined" ? window : this);\n';

fs.writeFileSync(outJsPath, finalJs, 'utf8');
console.log('[SUCCESS] Successfully generated js/modules/dungeonGame.js (' + Buffer.byteLength(finalJs, 'utf8') + ' bytes)');
