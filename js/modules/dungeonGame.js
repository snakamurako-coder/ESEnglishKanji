/**
 * js/modules/dungeonGame.js
 * 単語迷宮 百階 (Dungeon RPG Gamification)
 * 完全刷新版: 「参考/単語迷宮 百階.html」のUI/UX（GBモード・Switchモード、HUD、戦闘画面、フィールド探索、
 * ソフトウェアキーボード、ゲームパッド、サウンド）を採用し、
 * 教材マニフェスト連携、塔管理、難易度1〜10問題出題、パラメータ調整、画面遷移を統合。
 */

(function(global) {
  'use strict';

function isDungeonActive() {
  const sec = document.getElementById("section-dungeon");
  return sec && sec.classList.contains("active") && document.body.classList.contains("in-dungeon-game");
}



const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>a+Math.random()*(b-a), ri=n=>Math.floor(Math.random()*n);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};

/* 触覚フィードバック */
let hapticsEnabled = true;
function haptic(ms=15){
  if(hapticsEnabled && window.navigator && window.navigator.vibrate){
    try{ window.navigator.vibrate(ms); }catch(e){}
  }
}

/* ==========================================================================
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
    if (q.answer && /^[a-zA-Z0-9\s'’\-]+$/.test(q.answer)) return true;
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

/* ---------- 数値設計 ---------- */
const SCHEMA=[
 ["主人公",[["hp0","HP（Lv1）",50,1,9999,1],["hpLv","HP：1レベルごとの増加",10,0,999,1],["mp0","MP（Lv1）",10,0,9999,1],["mpLv","MP：1レベルごとの増加",2,0,999,1],["atk0","攻撃力（Lv1）",10,1,9999,1],["atkLv","攻撃力：1レベルごとの増加",3,0,999,1],["exp0","次のLvまでの経験値（Lv1）",20,1,99999,1],["expLv","必要経験値：1レベルごとの増加",8,0,9999,1],["dmgBase","与ダメージ係数（攻撃力×）",0.7,0.05,10,0.05],["critMul","クリティカル倍率",2,1,10,0.1]]],
 ["装備",[["defCoef","防御力1あたり減らせる被ダメージ",0.5,0,10,0.05],["g1d","ブロンズ防具の防御力",2,0,9999,1],["g1s","ブロンズソードの攻撃力",12,0,9999,1],["g2d","アイアン防具の防御力",5,0,9999,1],["g2s","アイアンソードの攻撃力",30,0,9999,1],["g3d","スチール防具の防御力",7,0,9999,1],["g3s","スチールソードの攻撃力",42,0,9999,1],["g4d","シルバー防具の防御力",9,0,9999,1],["g4s","シルバーソードの攻撃力",54,0,9999,1],["g5d","プラチナ防具の防御力",12,0,9999,1],["g5s","プラチナソードの攻撃力",72,0,9999,1],["g6d","ダークスチール防具の防御力",15,0,9999,1],["g6s","ダークスチールソードの攻撃力",90,0,9999,1],["g7d","ミスリル防具の防御力",17,0,9999,1],["g7s","ミスリルソードの攻撃力",102,0,9999,1],["g8d","アダマンタイト防具の防御力",19,0,9999,1],["g8s","アダマンタイトソードの攻撃力",114,0,9999,1],["g9d","ヒヒイロカネ防具の防御力",22,0,9999,1],["g9s","ヒヒイロカネソードの攻撃力",132,0,9999,1],["g10d","オリハルコン防具の防御力",25,0,9999,1],["g10s","オリハルコンソードの攻撃力",150,0,9999,1]]],
 ["敵の強さ",[["K","倒すのに必要な標準攻撃の回数（1階）",3,0.5,30,0.5],["N","無防備で耐えられる被弾数（1階）",10,1,50,1],["depth","深い階ほど厳しくなる度合い",1,0,5,0.1],["expDiv","1レベル上がるのに必要な撃破数",3,0.5,30,0.5],["eCrit","敵の痛恨の確率（%）",5,0,100,1],["eCritMul","敵の痛恨の倍率",1.5,1,10,0.1],["monMin","1階あたりの敵の数（最小）",3,0,15,1],["monMax","1階あたりの敵の数（最大）",5,0,15,1],["chase","勇者を追いかけ始める距離（マス）",2,0,20,1]]],
 ["敵のタイプ",[["a0hp","標準型：HP倍率",1,0.1,10,0.05],["a0atk","標準型：攻撃倍率",1,0.1,10,0.05],["a0eva","標準型：回避率（%）",5,0,100,1],["a1hp","速攻型：HP倍率",0.7,0.1,10,0.05],["a1atk","速攻型：攻撃倍率",1.3,0.1,10,0.05],["a1eva","速攻型：回避率（%）",12,0,100,1],["a2hp","重装型：HP倍率",1.5,0.1,10,0.05],["a2atk","重装型：攻撃倍率",0.8,0.1,10,0.05],["a2eva","重装型：回避率（%）",2,0,100,1],["a3hp","呪い型：HP倍率",0.9,0.1,10,0.05],["a3atk","呪い型：攻撃倍率",1.15,0.1,10,0.05],["a3eva","呪い型：回避率（%）",8,0,100,1]]],
 ["守護竜",[["bh","HP（通常の敵の何倍か）",6.25,0.5,50,0.25],["ba","攻撃力（通常の敵の何倍か）",1.68,0.5,20,0.02],["bEva","回避率（%）",5,0,100,1],["bossExp","経験値（通常の敵の何倍か）",5,0,100,0.5],["regenAt","自己再生を使うHP（最大HPの%以下）",50,0,100,5],["regenHeal","自己再生の回復量（最大HPの%）",50,0,100,5]]],
 ["クイズの効果",[["base","基本値・不正解時の効果（%）",5,0,100,1],["perLv","難易度1つごとの上昇（%）",5,0,50,0.5],["sp1","速さ補正：残り80%以上",15,-100,100,1],["sp2","速さ補正：残り60%以上",10,-100,100,1],["sp3","速さ補正：残り40%以上",5,-100,100,1],["sp4","速さ補正：残り20%以上",0,-100,100,1],["sp5","速さ補正：残り20%未満",-5,-100,100,1],["t_lv1","制限時間：Lv1 単語四択（秒）",10,1,300,1],["t_lv2","制限時間：Lv2 単語四択＋なし（秒）",12,1,300,1],["t_lv3","制限時間：Lv3 単語スペル補う（秒）",15,1,300,1],["t_lv4","制限時間：Lv4 単語音声入力（秒）",16,1,300,1],["t_lv5","制限時間：Lv5 単語タイピング（秒）",22,1,300,1],["t_lv6","制限時間：Lv6 表現並び替え過不足なし（秒）",25,1,300,1],["t_lv7","制限時間：Lv7 表現並び替え不要語排除（秒）",28,1,300,1],["t_lv8","制限時間：Lv8 表現並び替え＋1補う（秒）",30,1,300,1],["t_lv9","制限時間：Lv9 表現音声入力（秒）",18,1,300,1],["t_lv10","制限時間：Lv10 表現タイピング（秒）",25,1,300,1],["time","制限時間の全体倍率",1,0.2,10,0.1]]],
 ["必殺技・とくぎ",[["spPow","必殺技の威力（通常の何倍か）",3,0.5,50,0.1],["spSureLv","必殺技が必中になるLv",10,1,999,1],["spDrainLv","必殺技が吸収を得るLv",20,1,999,1],["spDrain","必殺技の吸収量（与ダメージの%）",20,0,100,1],["spAllLv","必殺技が全体攻撃になるLv",30,1,999,1],["s1lv","二連切：習得Lv",5,1,999,1],["s1mp","二連切：消費MP",4,0,999,1],["s1pow","二連切：1発の威力（%）",60,1,1000,5],["s2lv","回転切り：習得Lv",10,1,999,1],["s2mp","回転切り：消費MP",6,0,999,1],["s2pow","回転切り：威力（%）",60,1,1000,5],["s3lv","三連斬：習得Lv",15,1,999,1],["s3mp","三連斬：消費MP",8,0,999,1],["s3pow","三連斬：1発の威力（%）",50,1,1000,5],["s4lv","竜巻切り：習得Lv",20,1,999,1],["s4mp","竜巻切り：消費MP",10,0,999,1],["s4pow","竜巻切り：威力（%）",70,1,1000,5]]],
 ["回復",[["stairHeal","階段を降りたときのHP・MP回復（%）",20,0,100,1],["revive","復活の首飾りで戻るHP（%）",50,1,100,1]]],
 ["どうぐ",[["iPot","初期所持：ポーション",3,0,99,1],["iEth","初期所持：まりょくの水",2,0,99,1],["iWing","初期所持：みちびきのコンパス",1,0,99,1],["iGate","初期所持：さいしんの渦",1,0,99,1],["iNeck","初期所持：復活の首飾り",1,0,99,1],["chestMin","1階あたりの宝箱の数",1,0,10,1],["chest2","宝箱がもう1つ出る確率（%）",40,0,100,1],["dNeck","宝箱：復活の首飾りの確率（%）",1.5,0,100,0.1],["dPot","宝箱：ポーションの比率",50,0,1000,1],["dEth","宝箱：まりょくの水の比率",28,0,1000,1],["dWing","宝箱：コンパスの比率",12,0,1000,1],["dGate","宝箱：さいしんの渦の比率",10,0,1000,1]]]
];
const DEF={}; SCHEMA.forEach(g=>g[1].forEach(r=>{DEF[r[0]]=r[2]}));
const CFG=Object.assign({},DEF), CKEY="tango-meikyu-v1-cfg";
function setCfg(o){if(o)for(const k in DEF)if(typeof o[k]==="number"&&isFinite(o[k]))CFG[k]=o[k]}
function saveCfg(){try{localStorage.setItem(CKEY,JSON.stringify(CFG))}catch(e){}}
try{setCfg(JSON.parse(localStorage.getItem(CKEY)))}catch(e){}

const pAtk=L=>CFG.atk0+CFG.atkLv*(L-1);
const pMaxHp=L=>CFG.hp0+CFG.hpLv*(L-1);
const pMaxMp=L=>CFG.mp0+CFG.mpLv*(L-1);
const SK=[["二連切",2,false],["回転切り",1,true],["三連斬",3,false],["竜巻切り",1,true]];
const skills=()=>SK.map((k,i)=>({n:k[0],hits:k[1],all:k[2],lv:CFG["s"+(i+1)+"lv"],mp:CFG["s"+(i+1)+"mp"],pow:CFG["s"+(i+1)+"pow"]/100}));
const firstSkillLv=()=>Math.min(CFG.s1lv,CFG.s2lv,CFG.s3lv,CFG.s4lv);
const expNext=L=>Math.max(1,CFG.exp0+CFG.expLv*(L-1));

const GEAR=["ブロンズ","アイアン","スチール","シルバー","プラチナ","ダークスチール","ミスリル","アダマンタイト","ヒヒイロカネ","オリハルコン"];
const SLOTS=[["helm","ヘルム","⛑️"],["armor","アーマー","👕"],["legs","レギンス","👖"],["gaunt","ガントレット","🧤"],["boots","ブーツ","👢"],["shield","シールド","🛡️"],["sword","ソード","🗡️"]];
const gearVal=(slot,t)=>t<1?0:CFG["g"+t+(slot==="sword"?"s":"d")];
const tierAt=f=>Math.min(10,Math.floor((f-1)/10)+1);
const expAtk=f=>pAtk(f)+gearVal("sword",tierAt(f));
const expDef=f=>6*gearVal("helm",tierAt(f));
const atkNow=()=>pAtk(S.p.lv)+gearVal("sword",S.p.eq.sword);
const defNow=()=>SLOTS.reduce((a,x)=>a+(x[0]==="sword"?0:gearVal(x[0],S.p.eq[x[0]])),0);
const needEquip=()=>SLOTS.some(x=>S.p.eq[x[0]]<S.p.gearMax);
const fullSet=t=>{const o={};SLOTS.forEach(x=>{o[x[0]]=t});return o};
function fillGear(p,cleared){if(!p.eq||!p.gearMax){p.gearMax=Math.min(10,Math.floor((cleared||0)/10)+1);p.eq=fullSet(p.gearMax)}}
const kHits=f=>CFG.K*(1+CFG.depth*(f-1)/99);
const nHits=f=>CFG.N/(1+CFG.depth*(f-1)/99);
const archOf=i=>({hp:CFG["a"+i+"hp"],atk:CFG["a"+i+"atk"],eva:CFG["a"+i+"eva"]});
const MON=[
 [["🦠","スライム"],["🦇","コウモリ"],["🐢","おおガメ"],["👻","ゴースト"]],
 [["🐍","どくヘビ"],["🕷️","おおグモ"],["🐗","あばれイノシシ"],["💀","スケルトン"]],
 [["🦂","おおサソリ"],["🦅","まちょう"],["🗿","ゴーレム"],["🧟","ゾンビ"]],
 [["🐺","ヤミオオカミ"],["🧛","きゅうけつき"],["👹","オーガ"],["🧙","まどうし"]],
 [["👿","アークデーモン"],["😈","インプ"],["🦖","だいきょうりゅう"],["☠️","しにがみ"]]
];
const bandOf=f=>Math.min(4,Math.floor((f-1)/20));
function monStats(f,a,boss){
  const hp=Math.round(expAtk(f)*kHits(f)*a.hp*(boss?CFG.bh:1));
  const atk=Math.round(pMaxHp(f)/nHits(f)*a.atk*(boss?CFG.ba:1)+expDef(f)*CFG.defCoef);
  const exp=Math.round(expNext(f)/CFG.expDiv*a.hp*a.atk*(boss?CFG.bossExp:1));
  return {hp,atk,exp};
}
function makeMon(f,ai,boss){
  const a=boss?{hp:1,atk:1,eva:CFG.bEva}:archOf(ai), s=monStats(f,a,boss), v=boss?["🐉",f+"階の守護竜"]:MON[bandOf(f)][ai];
  return {g:v[0],name:v[1],hp:s.hp,max:s.hp,atk:s.atk,exp:s.exp,eva:a.eva,boss:!!boss};
}

/* ---------- 記録とセーブ ---------- */
const KEY="tango-meikyu-v1";
function loadRec(){try{return Object.assign({best:0,save:null},JSON.parse(localStorage.getItem(KEY))||{})}catch(e){return {best:0,save:null}}}
function saveRec(){try{localStorage.setItem(KEY,JSON.stringify(REC))}catch(e){}}
let REC=loadRec();
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---------- どうぐ・クイズの種類 ---------- */
const ITEMS={pot:{ic:"🧪",n:"ポーション"},eth:{ic:"💧",n:"まりょくの水"},wing:{ic:"🧭",n:"みちびきのコンパス"},gate:{ic:"🌀",n:"さいしんの渦"},neck:{ic:"📿",n:"復活の首飾り"}};
const fillItems=it=>Object.assign({pot:0,eth:0,wing:0,gate:0,neck:0},it);
const loot=()=>{
  if(roll(CFG.dNeck))return "neck";
  const w=[["pot",CFG.dPot],["eth",CFG.dEth],["wing",CFG.dWing],["gate",CFG.dGate]],tot=w.reduce((a,x)=>a+x[1],0);
  let r=Math.random()*tot;for(const x of w){r-=x[1];if(r<0)return x[0]}
  return "pot";
};
const KIND={
  atk:["⚔️","こうげき",L=>"クリティカル率 "+bonus(L)+"%"],
  skill:["🗡️","とくぎ",L=>"1発ごとのクリティカル率 "+bonus(L)+"%"],
  guard:["🛡️","ぼうぎょ",L=>"被ダメージを "+(100-CFG.perLv*L)+"% に"],
  evade:["👟","かいひ",L=>"回避率 "+bonus(L)+"%"],
  heal:["💖","HPかいふく",L=>"最大HPの "+bonus(L)+"% 回復"],
  mp:["💧","MPかいふく",L=>"最大MPの "+bonus(L)+"% 回復"],
  first:["⚡","先制",L=>"先制率 "+bonus(L)+"%"],
  flee:["🏃","にげる",L=>"成功率 "+bonus(L)+"%"]
};

/* ---------- 状態 ---------- */
let S={screen:"title"};
const W=11,H=11,DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

function genFloor(f){
  const cells=new Array(W*H).fill(1);
  let x=1+ri(W-2),y=1+ri(H-2);const sx=x,sy=y;let open=1,guard=0;cells[y*W+x]=0;
  while(open<50&&guard++<8000){
    const d=DIRS[ri(4)],nx=x+d[0],ny=y+d[1];
    if(nx<1||ny<1||nx>W-2||ny>H-2)continue;
    x=nx;y=ny;if(cells[y*W+x]){cells[y*W+x]=0;open++}
  }
  const dist=new Array(W*H).fill(-1);dist[sy*W+sx]=0;const q=[sy*W+sx];let far=sy*W+sx;
  while(q.length){
    const c=q.shift(),cx=c%W,cy=(c-cx)/W;
    for(const d of DIRS){const i=(cy+d[1])*W+cx+d[0];
      if(cells[i]===0&&dist[i]<0){dist[i]=dist[c]+1;q.push(i);if(dist[i]>dist[far])far=i}}
  }
  const free=[];for(let i=0;i<W*H;i++)if(cells[i]===0&&i!==far&&dist[i]>=2)free.push(i);
  shuffle(free);
  const ents={},boss=f%10===0;
  const nm=CFG.monMin+ri(Math.max(0,CFG.monMax-CFG.monMin)+1),nc=CFG.chestMin+(roll(CFG.chest2)?1:0);
  for(let k=0;k<nm&&free.length;k++)ents[free.pop()]={t:"mon",a:ri(4)};
  for(let k=0;k<nc&&free.length;k++)ents[free.pop()]={t:"chest"};
  if(boss)ents[far]={t:"boss"};
  S.map={cells,seen:new Array(W*H).fill(0),px:sx,py:sy,stairs:far,ents};
  reveal();
}
function reveal(){
  const m=S.map;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const x=m.px+dx,y=m.py+dy;if(x>=0&&y>=0&&x<W&&y<H)m.seen[y*W+x]=1;
  }
}
function log(t){S.log.push(t);if(S.log.length>40)S.log.shift();renderLog()}

function newState(f,practice){
  return {screen:"explore",floor:f,practice:!!practice,cleared:practice?f-1:0,diff:(S&&S.diff)||5,
    p:{lv:f,exp:0,hp:pMaxHp(f),mp:pMaxMp(f),gauge:0,gearMax:practice?tierAt(f):1,eq:fullSet(practice?tierAt(f):1),it:{pot:CFG.iPot,eth:CFG.iEth,wing:CFG.iWing,gate:CFG.iGate,neck:CFG.iNeck}},st:{ok:0,total:0,kills:0},log:[],b:null,map:null};
}
function start(f,practice){
  S=newState(f,practice);
  if(!practice){REC.save=null;saveRec()}
  se("game_start");enterFloor("地下 "+f+" 階に おりたった。");
}
function resume(){
  const v=REC.save;S=newState(v.floor,false);
  S.cleared=v.cleared;S.diff=v.diff||5;S.p=clone(v.p);S.p.it=fillItems(S.p.it);fillGear(S.p,S.cleared);S.st=clone(v.st);
  se("game_start");enterFloor("地下 "+v.floor+" 階から さいかい。");
}
function enterFloor(msg){
  genFloor(S.floor);S.screen="explore";S.b=null;log(msg);
  render();curtain("地下 "+S.floor+" 階");
  winExplore(S.floor%10===0?"つよい けはいが する…":"どちらへ すすむ？");
}
function autosave(){
  if(S.practice)return;
  if(S.floor>REC.best)REC.best=S.floor;
  REC.save={floor:S.floor,cleared:S.cleared,diff:S.diff,p:clone(S.p),st:clone(S.st)};
  saveRec();
}

/* ==========================================================================
   🔊 オーディオシステム (SE & BGM) + サウンドテスター機能
   ========================================================================== */
const AUDIO_MANIFEST=[
  {type:"bgm",id:1,name:"探索 BGM",file:"BGM01_Overworld_Bound.mp3"},
  {type:"bgm",id:2,name:"通常戦闘 BGM",file:"BGM02_Steel_Meets_Magic.mp3"},
  {type:"bgm",id:3,name:"守護竜戦 BGM",file:"BGM03_Crown_of_the_Valiant.mp3"},
  {type:"bgm",id:4,name:"百階踏破 BGM",file:"BGM04_Arrival_at_the_Zenith.mp3"},
  {type:"se",id:"attack_hit",name:"攻撃ヒット",file:"se01_attack_hit__sword-slash3.mp3"},
  {type:"se",id:"attack_miss",name:"攻撃ミス",file:"se02_attack_miss__sword-gesture2.mp3"},
  {type:"se",id:"attack_critical",name:"会心の一撃",file:"se03_attack_critical__ax-slash-2.mp3"},
  {type:"se",id:"skill_nirengiri",name:"二連切",file:"se04_skill_nirengiri__sword-slash4.mp3"},
  {type:"se",id:"skill_kaitengiri",name:"回転切り",file:"se05_skill_kaitengiri__sword-gesture1.mp3"},
  {type:"se",id:"skill_sanrenzan",name:"三連斬",file:"se06_skill_sanrenzan__sword-slash5.mp3"},
  {type:"se",id:"skill_tatsumakigiri",name:"竜巻切り",file:"se07_skill_tatsumakigiri__magic-wind1.mp3"},
  {type:"se",id:"special_start",name:"必殺発動",file:"se08_special_start__super-arts-motion1.mp3"},
  {type:"se",id:"special_hit",name:"必殺ヒット",file:"se09_special_hit__sword-slash6.mp3"},
  {type:"se",id:"special_drain",name:"HP吸収",file:"se10_special_drain__magic-drain1.mp3"},
  {type:"se",id:"enemy_hit",name:"被ダメージ",file:"se11_enemy_hit__blow2.mp3"},
  {type:"se",id:"enemy_critical",name:"痛恨被弾",file:"se12_enemy_critical__super-arts-hit1.mp3"},
  {type:"se",id:"guard",name:"ぼうぎょ",file:"se13_guard__shield1.mp3"},
  {type:"se",id:"evade",name:"かいひ",file:"se14_evade__highspeed-movement1.mp3"},
  {type:"se",id:"encounter",name:"敵遭遇",file:"se15_encounter__goblin-cry2.mp3"},
  {type:"se",id:"boss_encounter",name:"守護竜咆哮",file:"se16_boss_encounter__dragon-cry1.mp3"},
  {type:"se",id:"boss_regen",name:"自己再生",file:"se17_boss_regen__magic-drain2.mp3"},
  {type:"se",id:"enemy_down",name:"敵撃破",file:"se18_enemy_down__down1.mp3"},
  {type:"se",id:"boss_down",name:"守護竜撃破",file:"se19_boss_down__trumpet1.mp3"},
  {type:"se",id:"levelup",name:"レベルアップ",file:"se20_levelup__levelup1.mp3"},
  {type:"se",id:"skill_learn",name:"とくぎ習得",file:"se21_skill_learn__decision10.mp3"},
  {type:"se",id:"first_strike",name:"先制攻撃",file:"se22_first_strike__shakin1.mp3"},
  {type:"se",id:"flee",name:"にげる",file:"se23_flee__flee1.mp3"},
  {type:"se",id:"heal_hp",name:"HP回復",file:"se24_heal_hp__magic-cure2.mp3"},
  {type:"se",id:"heal_mp",name:"MP回復",file:"se25_heal_mp__gauge-recovery2.mp3"},
  {type:"se",id:"revive",name:"首飾り復活",file:"se26_revive__magic-cure4.mp3"},
  {type:"se",id:"chest",name:"宝箱",file:"se27_chest__treasure-chest1.mp3"},
  {type:"se",id:"equip",name:"そうび変更",file:"se28_equip__decision14.mp3"},
  {type:"se",id:"gear_get",name:"新装備入手",file:"se29_gear_get__item-get2.mp3"},
  {type:"se",id:"stairs",name:"階段移動",file:"se30_stairs__sceneswitch2.mp3"},
  {type:"se",id:"warp",name:"ワープ",file:"se31_warp__magic-worp1.mp3"},
  {type:"se",id:"quiz_correct",name:"クイズ正解",file:"se32_quiz_correct__correct2.mp3"},
  {type:"se",id:"quiz_wrong",name:"クイズ不正解",file:"se33_quiz_wrong__incorrect1.mp3"},
  {type:"se",id:"quiz_hurry",name:"制限時間警告",file:"se34_quiz_hurry__warning1.mp3"},
  {type:"se",id:"speed_bonus",name:"速度ボーナス",file:"se35_speed_bonus__kira2.mp3"},
  {type:"se",id:"select",name:"カーソル移動",file:"se36_select__cursor5.mp3"},
  {type:"se",id:"decide",name:"決定",file:"se37_decide__decision23.mp3"},
  {type:"se",id:"cancel",name:"キャンセル",file:"se38_cancel__cancel8.mp3"},
  {type:"se",id:"disabled",name:"壁/不可",file:"se39_disabled__beep1.mp3"},
  {type:"se",id:"menu_open",name:"メニュー開く",file:"se40_menu_open__menu4.mp3"},
  {type:"se",id:"game_start",name:"ゲーム開始",file:"se41_game_start__decision18.mp3"},
  {type:"se",id:"game_over",name:"ゲームオーバー",file:"se42_game_over__curse-melody1.mp3"},
  {type:"se",id:"game_clear",name:"百階踏破ファンファーレ",file:"se43_game_clear__jajean1.mp3"},
  {type:"se",id:"new_record",name:"新記録達成",file:"se44_new_record__decision37.mp3"}
];

const SE={}, SE_TOTAL=44;
const BGM={}, BGM_TOTAL=4;
let seOn=true, bgmOn=true;
let seVol=0.7, bgmVol=0.35;
let bgmCur=0;

try{
  const v=JSON.parse(localStorage.getItem("tango-meikyu-se")||"null");
  if(v){
    if(typeof v.on==="boolean")seOn=v.on;
    if(typeof v.bgm==="boolean")bgmOn=v.bgm;
    if(typeof v.seVol==="number")seVol=v.seVol;
    if(typeof v.bgmVol==="number")bgmVol=v.bgmVol;
  }
}catch(e){}

function saveSnd(){
  try{localStorage.setItem("tango-meikyu-se",JSON.stringify({on:seOn,bgm:bgmOn,seVol,bgmVol}))}catch(e){}
}

function bgmWant(){
  if(S.screen==="explore")return 1;
  if(S.screen==="battle")return S.b&&S.b.m.boss?3:2;
  if(S.screen==="clear")return 4;
  return 0;
}

function setupBgmElement(aud, id){
  if(!aud) return;
  aud.loop = true;
  aud.volume = bgmVol;
  aud.preload = "auto";
  
  // ended イベントでも確実にループ再開（ブラウザのloop属性停止対策）
  if(!aud._hasBgmLoopHook){
    aud._hasBgmLoopHook = true;
    aud.addEventListener("ended", ()=>{
      if(bgmOn && bgmCur === id){
        aud.currentTime = 0;
        const pr = aud.play();
        if(pr) pr.catch(()=>{});
      }
    });
  }
}

function bgmUpdate(){
  if(!bgmOn){
    if(bgmCur && BGM[bgmCur]){
      try { BGM[bgmCur].pause(); } catch(e){}
    }
    bgmCur = 0;
    return;
  }

  const k = bgmWant();
  const a = BGM[k];

  // 違うBGMに切り替わっていない場合（同じBGM）:
  // 曲を巻き戻さず、ずっとループ再生を維持する
  if(k === bgmCur){
    if(a){
      setupBgmElement(a, k);
      if(a.paused){
        const pr = a.play();
        if(pr) pr.catch(()=>{});
      }
    }
    return;
  }

  // ===== 違うBGMに切り替わる場合 =====
  // 1. 直前の古いBGMを停止して先頭リセット
  if(bgmCur && BGM[bgmCur]){
    try {
      BGM[bgmCur].pause();
      BGM[bgmCur].currentTime = 0;
    } catch(e){}
  }

  // 2. 新しいBGMを先頭からループ再生開始
  bgmCur = k;
  if(!a) return;

  setupBgmElement(a, k);
  a.currentTime = 0;
  a.volume = bgmVol;
  const pr = a.play();
  if(pr) pr.catch(()=>{});
}

function se(k,delay){
  if(!seOn)return;
  const a=SE[k];if(!a)return;
  const go=()=>{
    try{
      if(a.paused || a.ended){
        a.currentTime=0;
        a.volume=seVol;
        const pr=a.play();if(pr)pr.catch(()=>{});
      }else{
        const cl=new Audio(a.src);
        cl.volume=seVol;
        const pr=cl.play();if(pr)pr.catch(()=>{});
      }
    }catch(e){}
  };
  delay?setTimeout(go,delay):go();
}

function seLoadFromFiles(files){
  let n=0;
  for(const f of files){
    const bm=/^bgm0*(\d+)[_\-. ]/i.exec(f.name);
    if(bm&&/\.(mp3|m4a|ogg|wav|aac)$/i.test(f.name)){
      const k=+bm[1];
      if(BGM[k]){BGM[k].pause();URL.revokeObjectURL(BGM[k].src);if(bgmCur===k)bgmCur=0}
      const b=new Audio(URL.createObjectURL(f));
      setupBgmElement(b, k);
      BGM[k]=b; n++; continue;
    }
    const m=/^se\d{2}_([a-z_]+?)__.*\.mp3$/i.exec(f.name);
    if(!m)continue;
    const k=m[1].toLowerCase();
    if(SE[k])URL.revokeObjectURL(SE[k].src);
    const a=new Audio(URL.createObjectURL(f));
    a.preload="auto"; SE[k]=a; n++;
  }
  updateSoundUI();
  return n;
}

/* 相対パス "SE/..." からの自動読み込み試行 */
function autoLoadRelativeAudio(){
  let loadedCount = 0;
  let tried = 0;
  AUDIO_MANIFEST.forEach(item=>{
    const path = "SE/" + item.file;
    const aud = new Audio(path);
    aud.preload = "auto";

    let registered = false;
    const onReady = ()=>{
      if(registered) return;
      registered = true;
      if(item.type==="bgm"){
        setupBgmElement(aud, item.id);
        BGM[item.id] = aud;
        if(bgmOn && bgmWant() === item.id && (bgmCur === 0 || bgmCur === item.id)){
          bgmUpdate();
        }
      }else{
        aud.volume = seVol;
        SE[item.id] = aud;
      }
      loadedCount++;
      updateSoundUI();
    };

    aud.addEventListener("canplaythrough", onReady, { once: true });
    aud.addEventListener("canplay", onReady, { once: true });
    aud.addEventListener("loadeddata", onReady, { once: true });

    aud.onerror = ()=>{
      tried++;
      if(tried === AUDIO_MANIFEST.length && loadedCount === 0){
        updateSoundUI();
      }
    };

    // 初期オブジェクトとしても事前登録（即時タップ対応）
    if(item.type==="bgm"){
      setupBgmElement(aud, item.id);
      BGM[item.id] = aud;
    }else{
      aud.volume = seVol;
      SE[item.id] = aud;
    }
  });
}

function updateSoundUI(){
  const nSE = Object.keys(SE).length;
  const nBGM = Object.keys(BGM).length;
  const stText = (nSE || nBGM)
    ? `効果音 ${nSE}/${SE_TOTAL} ・ BGM ${nBGM}/${BGM_TOTAL} 読み込み済み`
    : `音未読み込み（「SEフォルダから自動ロード試行」またはフォルダ選択で読込）`;
  
  const statEl = $("#mSoundStatus");
  if(statEl) statEl.textContent = "読み込み状態: " + stText;

  const seMuteBtn = $("#mSeMute");
  const bgmMuteBtn = $("#mBgmMute");
  if(seMuteBtn){
    seMuteBtn.className = "sound-toggle-btn " + (seOn?"on":"off");
    $("#mSeMuteTxt").textContent = seOn?"ON 🔊":"OFF 🔇";
  }
  if(bgmMuteBtn){
    bgmMuteBtn.className = "sound-toggle-btn " + (bgmOn?"on":"off");
    $("#mBgmMuteTxt").textContent = bgmOn?"ON 🎵":"OFF 🚫";
  }
}

const SKEY={"二連切":"skill_nirengiri","回転切り":"skill_kaitengiri","三連斬":"skill_sanrenzan","竜巻切り":"skill_tatsumakigiri"};

/* ---------- エフェクト ---------- */
function pulse(cls,ms){
  const wrap=$(".stagewrap"); if(!wrap)return;
  wrap.classList.remove(cls); void wrap.offsetWidth; wrap.classList.add(cls);
  setTimeout(()=>wrap.classList.remove(cls),ms||600);
}
function pop(text,cls,delay,me){
  setTimeout(()=>{
    const fxEl=$("#fx"); if(!fxEl)return;
    const e=document.createElement("div"); e.className="pop "+(cls||""); e.textContent=text;
    e.style.left=(me?50:30+Math.random()*40)+"%"; e.style.top=(me?78:34+Math.random()*14)+"%";
    fxEl.appendChild(e); setTimeout(()=>e.remove(),1150);
  },delay||0);
}
function gl(cls){
  const g=$("#glyph"); if(!g)return;
  g.classList.remove("hit","crit","dodge","lunge","appear","regen"); void g.offsetWidth; g.classList.add(cls);
}
function curtain(text){
  const fxEl=$("#fx"); if(!fxEl)return;
  const e=document.createElement("div"); e.className="curtain"; e.textContent=text;
  fxEl.appendChild(e); setTimeout(()=>e.remove(),1150);
}

/* ---------- 描画 ---------- */
function render(){
  renderStage();
  renderHUD();
  renderStatus();
  renderLog();
  bgmUpdate();
  const bEl=$("#best"); if(bEl) bEl.textContent=REC.best?"地下 "+REC.best+" 階":"—";
}

function mini(c,v,mx,l){
  return '<span class="mini"><em>'+l+' '+v+'</em><span class="bar '+c+'"><i style="width:'+(Math.max(0,Math.min(100,100*v/mx)))+'%"></i></span></span>';
}

function renderHUD(){
  const hudEl = $("#hudBar");
  if(!hudEl) return;
  if(!S.p){
    hudEl.innerHTML = '<span class="fl">単語迷宮 百階</span><span style="color:var(--muted)">ぼうけんを はじめよう</span>';
    return;
  }
  const p=S.p;
  hudEl.innerHTML='<span class="fl">地下 '+S.floor+' 階'+(S.floor%10===0?" 🐉":"")+'</span><span>Lv'+p.lv+(S.practice?"・練習":"")+'</span>'+mini("hp",p.hp,pMaxHp(p.lv),"HP")+mini("mp",p.mp,pMaxMp(p.lv),"MP")+mini("sp",p.gauge,100,"必殺");
}

function renderStage(){
  const stage=$("#stage"); if(!stage) return;
  if(S.screen==="title"){
    stage.innerHTML='<div class="result"><div class="big">百階</div><p>正解の むずかしさと速さが、そのまま力になる。</p><p style="color:var(--muted)">地下100階まで、どこまで もぐれるか。</p></div>';
    return;
  }
  if(S.screen==="over"||S.screen==="clear"){
    const r=S.result;
    stage.innerHTML='<div class="result"><div class="big">'+(S.screen==="clear"?"踏破":"全滅")+'</div><p>到達 地下 '+r.floor+' 階 ／ Lv '+r.lv+'</p><p>正答率 '+r.acc+'%（'+r.ok+' / '+r.total+'）・たおした数 '+r.kills+'</p>'+(r.isNew?'<p class="new">★ きろく こうしん！ ★</p>':'')+(r.practice?'<p style="color:var(--muted)">練習のため記録なし</p>':'')+'</div>';
    return;
  }
  if(S.screen==="battle"){
    const m=S.b.m;
    stage.innerHTML='<div class="scene"><div class="glyph'+(m.boss?" boss":"")+'" id="glyph">'+m.g+'</div><div class="mname">'+m.name+'</div><div class="bar"><i style="width:'+(100*m.hp/m.max)+'%"></i></div><div style="color:var(--muted);font-size:12px;font-family:var(--game)">HP '+m.hp+' / '+m.max+'　こうげき '+m.atk+'</div></div>';
    return;
  }
  const m=S.map;
  let h='<div class="map">';
  for(let i=0;i<W*H;i++){
    const x=i%W, y=(i-x)/W;
    let cls="c", g="";
    if(!m.seen[i]) cls+=" u";
    else if(m.cells[i]===0){
      cls+=" f"; const e=m.ents[i];
      if(x===m.px&&y===m.py){ cls+=" me"; g="🤺"; }
      else if(e){
        if(e.t==="mon"){ cls+=" mon"; g=MON[bandOf(S.floor)][e.a][0]; }
        else if(e.t==="boss"){ cls+=" boss"; g="🐉"; }
        else{ cls+=" chest"; g="🎁"; }
      }
      else if(i===m.stairs){ cls+=" st"; g="🪜"; }
      if(Math.abs(x-m.px)+Math.abs(y-m.py)===1) cls+=" adj";
    }
    h+='<div class="'+cls+'" data-i="'+i+'">'+g+'</div>';
  }
  stage.innerHTML=h+'</div>';
}

function renderStatus(){
  const el=$("#mStatGrid"); if(!el) return;
  if(!S.p){
    el.innerHTML='<div class="stat-item"><span>状態</span><span>ゲーム未開始</span></div>';
    return;
  }
  const p=S.p, mxHp=pMaxHp(p.lv), mxMp=pMaxMp(p.lv), it=p.it;
  el.innerHTML=`
    <div class="stat-item"><span>レベル</span><span>Lv ${p.lv}</span></div>
    <div class="stat-item"><span>HP</span><span>${p.hp} / ${mxHp}</span></div>
    <div class="stat-item"><span>MP</span><span>${p.mp} / ${mxMp}</span></div>
    <div class="stat-item"><span>こうげき</span><span>${atkNow()} (剣+${gearVal("sword",p.eq.sword)})</span></div>
    <div class="stat-item"><span>ぼうぎょ</span><span>${defNow()}</span></div>
    <div class="stat-item"><span>必殺ゲージ</span><span>${p.gauge}%</span></div>
    <div class="stat-item"><span>経験値</span><span>${p.exp} / ${expNext(p.lv)}</span></div>
    <div class="stat-item"><span>踏破記録</span><span>${S.cleared ? "地下 "+S.cleared+" 階" : "未踏破"}</span></div>
    <div class="stat-item"><span>クイズ正答</span><span>${S.st.ok} / ${S.st.total}</span></div>
    <div class="stat-item" style="grid-column: 1 / -1"><span>所持アイテム</span><span>${Object.keys(ITEMS).map(k=>ITEMS[k].ic+it[k]).join("　")}</span></div>
  `;
}

function renderLog(){
  const el=$("#mLogBox"); if(!el) return;
  el.innerHTML=(S.log||[]).map(t=>"<p>"+t+"</p>").join("");
  el.scrollTop=el.scrollHeight;
}

/* ---------- ウィンドウ & ゲームパッドナビゲーション ---------- */
let quizKey=null, raf=0;
const winEl=()=>$("#win");

let padFocusRow = 0; // 0: 難易度行, 1: コマンド行
let padBtnIndex = 0; // コマンドボタン行内インデックス
let choiceIndex = 0; // 4択クイズの選択肢インデックス (0..3)
let curDiffRefresh = null; // 現在の難易度再描画コールバック

function changeDiff(delta){
  const nextDiff = Math.max(1, Math.min(10, S.diff + delta));
  if(nextDiff !== S.diff){
    S.diff = nextDiff;
    se("select");
    if(typeof curDiffRefresh === "function"){
      curDiffRefresh();
    } else {
      updatePadFocus();
    }
  }
}

function updatePadFocus(){
  const w = winEl(); if(!w) return;
  const root = $("#appRoot");
  const qp = $("#quizPane");
  const isQuizActive = root && root.classList.contains("is-quiz") && qp && qp.style.display !== "none";

  w.querySelectorAll(".pad-focus").forEach(el=>el.classList.remove("pad-focus"));
  if(qp) qp.querySelectorAll(".pad-focus").forEach(el=>el.classList.remove("pad-focus"));

  // 1. クイズ4択画面中（quizPane または w 内）
  const quizHost = (isQuizActive && qp && qp.querySelector(".choices")) ? qp : w;
  const cBtns = [...quizHost.querySelectorAll(".choices button:not(:disabled)")];
  if(cBtns.length){
    choiceIndex = Math.max(0, Math.min(cBtns.length - 1, choiceIndex));
    if(cBtns[choiceIndex]){
      cBtns[choiceIndex].classList.add("pad-focus");
      try{ cBtns[choiceIndex].scrollIntoView({block:"nearest", inline:"nearest"}); }catch(e){}
    }
    return;
  }

  // 2. 難易度チップがある画面
  const chips = [...w.querySelectorAll(".dchip")];
  const cmdBtns = [...w.querySelectorAll(".btns button:not(:disabled)")];

  if(chips.length && padFocusRow === 0){
    // 難易度行がフォーカス
    const curChip = w.querySelector(`.dchip[data-l="${S.diff}"]`);
    if(curChip){
      curChip.classList.add("pad-focus");
      try{ curChip.scrollIntoView({block:"nearest", inline:"nearest"}); }catch(e){}
    }
  } else if(cmdBtns.length){
    // コマンドボタン行がフォーカス
    padFocusRow = 1;
    padBtnIndex = Math.max(0, Math.min(cmdBtns.length - 1, padBtnIndex));
    if(cmdBtns[padBtnIndex]){
      cmdBtns[padBtnIndex].classList.add("pad-focus");
      try{ cmdBtns[padBtnIndex].scrollIntoView({block:"nearest", inline:"nearest"}); }catch(e){}
    }
  }
}

function clearQuizState(){
  const root = $("#appRoot");
  const qp = $("#quizPane");
  if(root) root.classList.remove("is-quiz");
  if(qp) qp.style.display = "none";
}

function say(t){
  const w=winEl(); if(w) w.innerHTML='<p class="msg">'+t+'</p>';
}

function winMenu(msg){
  clearQuizState();
  const v=REC.save;
  const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">'+msg+'</p><div class="btns">'+(v?'<button id="cont" type="button">つづきから<small>地下 '+v.floor+' 階・Lv '+v.p.lv+'</small></button>':'')+'<button id="go" type="button">地下1階から はじめる'+(v?'<small>セーブは消えます</small>':'')+'</button></div>';
  if(v) $("#cont").onclick=resume;
  let armed=!v;
  $("#go").onclick=()=>{
    if(armed) return start(1,false);
    armed=true;
    $("#go").innerHTML='ほんとうに はじめから？<small>もういちど押すと開始</small>';
  };
  padFocusRow = 1; padBtnIndex = v ? 0 : 0;
  curDiffRefresh = null;
  updatePadFocus();
}
function winTitle(){ winMenu("ぼうけんを はじめますか？"); }
function winEnd(){
  winMenu(S.screen==="clear"?"百階を ふみこえた！":(REC.save&&!S.practice?"ちからつきた… 地下 "+REC.save.floor+" 階の はじめから やりなおせる。":"ちからつきた…"));
}

function diffRow(){
  let h='<div class="diff"><span class="dtitle">難易度</span>';
  for(let n=1;n<=10;n++) h+='<button type="button" class="dchip'+(n===S.diff?" on":"")+'" data-l="'+n+'" aria-label="難易度'+n+'">'+n+'</button>';
  h+='<span class="dnav-hint">◀▶選択 / ▼コマンド</span></div>';
  return h+'<p class="dnote">'+FMT[LV[S.diff][0]]+'・正解で効果 '+bonus(S.diff)+'%＋速さ補正（不正解は '+CFG.base+'%）</p>';
}
function bindDiff(refresh){
  const w=winEl(); if(!w) return;
  curDiffRefresh = refresh;
  w.querySelectorAll(".dchip").forEach(b=>b.onclick=()=>{
    S.diff=+b.dataset.l;
    refresh();
    updatePadFocus();
  });
}

function winNext(t){
  clearQuizState();
  const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">'+t+'</p><div class="btns"><button id="next" type="button">🪜 次の階へ おりる ▶</button></div>';
  const b=$("#next"); b.onclick=()=>{b.disabled=true;se("stairs");descend();};
  setTimeout(()=>{try{b.focus()}catch(e){}},400);
  padFocusRow = 1; padBtnIndex = 0; curDiffRefresh = null;
  updatePadFocus();
}

function winExplore(t){
  clearQuizState();
  const w=winEl(); if(!w) return;
  w.innerHTML='<div class="explore-idle"><p class="msg">'+t+'</p><div class="explore-nav-bar"><span class="nav-hint">🧭 十字キーで移動</span><button id="btnOpenMenu" type="button" class="btn-field-menu">📋 メニュー [START/＋]</button></div></div>';
  const b=$("#btnOpenMenu");
  if(b) b.onclick=()=>winExploreMenu();
  padFocusRow = 0; padBtnIndex = 0; curDiffRefresh = null;
  updatePadFocus();
}

function winExploreMenu(){
  se("menu_open");
  const w=winEl(); if(!w) return;
  w.innerHTML='<div class="explore-menu"><p class="msg">📋 探索メニュー</p><div class="btns">'+
    '<button id="bag" type="button">🎒 どうぐ</button>'+
    '<button id="eqb" type="button">🛡️ そうび'+(needEquip()?'<span class="badge">NEW</span>':'')+'</button>'+
    '<button id="btnSystemSettings" type="button">⚙️ せってい<small>[SELECT / ー]</small></button>'+
    '<button id="btnCloseMenu" type="button">◀ とじる<small>[Bボタン]</small></button>'+
    '</div></div>';
  $("#bag").onclick=()=>winItems("どちらへ すすむ？");
  $("#eqb").onclick=winEquip;
  $("#btnSystemSettings").onclick=()=>openMenu();
  $("#btnCloseMenu").onclick=()=>{
    se("cancel");
    winExplore("どちらへ すすむ？");
  };
  padFocusRow = 1; padBtnIndex = 0; curDiffRefresh = null;
  updatePadFocus();
}

function toggleFieldMenu(){
  if(S.screen!=="explore") return;
  const w=winEl();
  if(w && w.querySelector(".explore-menu")){
    se("cancel");
    winExplore("どちらへ すすむ？");
  } else {
    winExploreMenu();
  }
}

function winEquip(){
  const p=S.p; const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">🛡️ そうび（攻 '+atkNow()+'・防 '+defNow()+'）</p><div class="eqlist">'+SLOTS.map(x=>{
    const sw=x[0]==="sword"; let o="";
    for(let t=1;t<=p.gearMax;t++) o+='<option value="'+t+'"'+(p.eq[x[0]]===t?" selected":"")+'>'+GEAR[t-1]+x[1]+'（'+(sw?"攻":"防")+' +'+gearVal(x[0],t)+'）</option>';
    return '<label class="eqrow" for="eq_'+x[0]+'"><span>'+x[2]+' '+x[1]+(p.eq[x[0]]<p.gearMax?'<span class="badge">NEW</span>':'')+'</span><select id="eq_'+x[0]+'">'+o+'</select></label>';
  }).join("")+'</div><div class="btns" style="margin-top:8px"><button id="eqBest" type="button"'+(needEquip()?"":" disabled")+'>最強装備にする</button><button id="back" type="button">もどる</button></div>';
  SLOTS.forEach(x=>{$("#eq_"+x[0]).onchange=e=>{p.eq[x[0]]=+e.target.value;se("equip");renderStatus();winEquip();}});
  $("#eqBest").onclick=()=>{
    p.eq=fullSet(p.gearMax);se("equip");log(GEAR[p.gearMax-1]+"の装備を 身につけた。");
    renderStatus();renderLog();pop("🛡️ そうび！","guard",0,true);winEquip();
  };
  $("#back").onclick=()=>winExploreMenu();
  padFocusRow = 1; padBtnIndex = needEquip() ? 0 : 1; curDiffRefresh = null;
  updatePadFocus();
}

function winItems(t){
  const p=S.p, it=p.it, inB=S.screen==="battle", b=bonus(S.diff), newest=Math.min(100,S.cleared+1);
  const row=(k,dis,sub)=>'<button type="button" data-it="'+k+'"'+(it[k]<1||dis?" disabled":"")+'>'+ITEMS[k].ic+' '+ITEMS[k].n+' ×'+it[k]+'<small>'+sub+'</small></button>';
  const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">🎒 どうぐ'+(inB?"（つかうと 1ターン消費）":"")+'</p>'+diffRow()+'<div class="btns">'+
    row("pot",p.hp>=pMaxHp(p.lv),"クイズ正解で HP "+b+"% 回復")+
    row("eth",p.mp>=pMaxMp(p.lv),"クイズ正解で MP "+b+"% 回復")+
    row("wing",inB||S.cleared<1,inB?"戦闘中は使えない":S.cleared<1?"踏破した階が まだない":"踏破階（1〜"+S.cleared+"）へワープ")+
    row("gate",inB||S.floor===newest,inB?"戦闘中は使えない":S.floor===newest?"いまが最新階":"地下 "+newest+" 階へワープ")+
    row("neck",true,"戦闘で倒れると自動発動（1戦闘1回）")+
    '<button id="back" type="button">もどる</button></div>';
  bindDiff(()=>winItems(t));
  w.querySelectorAll("button[data-it]").forEach(x=>x.onclick=()=>{
    const k=x.dataset.it;
    if(k==="pot") ask(S.diff,"heal",r=>doItem("pot",r));
    else if(k==="eth") ask(S.diff,"mp",r=>doItem("eth",r));
    else if(k==="wing") winWarp(t);
    else warp(newest,"gate");
  });
  $("#back").onclick=()=>inB?winCmd(t):winExploreMenu();
  padFocusRow = 0; padBtnIndex = 0;
  updatePadFocus();
}

function winWarp(t){
  const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">🧭 どの階へ とぶ？（1〜'+S.cleared+'）</p><form class="typed" id="wform"><input type="number" id="warpF" min="1" max="'+S.cleared+'" value="'+S.cleared+'" aria-label="ワープ先の階"><button type="submit">ワープする</button><button id="back" type="button">もどる</button></form>';
  $("#wform").addEventListener("submit",e=>{e.preventDefault();warp(Math.max(1,Math.min(S.cleared,Math.round(+$("#warpF").value||1))),"wing")});
  $("#back").onclick=()=>winItems(t);
  padFocusRow = 1; padBtnIndex = 0; curDiffRefresh = null;
  updatePadFocus();
}

function warp(f,key){
  S.p.it[key]--; S.floor=f; se("warp"); pulse("fx-warp",800);
  enterFloor(ITEMS[key].n+"で 地下 "+f+" 階へ ワープした。");
}

function winFirst(){
  clearQuizState();
  const m=S.b.m; const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">'+m.name+'が あらわれた！</p>'+diffRow()+'<div class="btns"><button id="go" type="button">⚡ 先制クイズ<small>正解で先制率 '+bonus(S.diff)+'%</small></button></div>';
  bindDiff(winFirst);
  $("#go").onclick=()=>{
    $("#go").classList.add("pad-focus");
    ask(S.diff,"first",doFirst);
  };
  padFocusRow = 0; padBtnIndex = 0;
  updatePadFocus();
}

function winCmd(t){
  clearQuizState();
  const p=S.p, m=S.b.m, b=bonus(S.diff), it=p.it;
  const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">'+t+'</p>'+diffRow()+'<div class="btns"><button id="cA" type="button">⚔️ こうげき<small>クリティカル率 '+b+'%・ゲージ +'+b+'</small></button><button id="cS" type="button"'+(p.gauge<100?" disabled":"")+'>💥 ひっさつ<small>'+(p.gauge<100?"ゲージ "+p.gauge+"%":CFG.spPow+"倍"+(p.lv>=CFG.spSureLv?"・必中":"")+(p.lv>=CFG.spDrainLv?"・吸収"+CFG.spDrain+"%":"")+(p.lv>=CFG.spAllLv?"・全体":""))+'</small></button><button id="cQ" type="button"'+(p.lv<firstSkillLv()?" disabled":"")+'>🗡️ とくぎ<small>'+(p.lv<firstSkillLv()?"Lv"+firstSkillLv()+"で習得":"MP "+p.mp)+'</small></button><button id="cH" type="button">🎒 どうぐ<small>🧪'+it.pot+'　💧'+it.eth+'</small></button><button id="cF" type="button"'+(m.boss?" disabled":"")+'>🏃 にげる<small>成功率 '+b+'%</small></button></div>';
  bindDiff(()=>winCmd(t));
  $("#cA").onclick=()=>{
    $("#cA").classList.add("pad-focus");
    ask(S.diff,"atk",doAttack);
  };
  $("#cS").onclick=doSpecial;
  $("#cQ").onclick=()=>winSkill(t);
  $("#cH").onclick=()=>winItems(t);
  $("#cF").onclick=()=>{
    $("#cF").classList.add("pad-focus");
    ask(S.diff,"flee",doFlee);
  };
  padFocusRow = 0; padBtnIndex = 0;
  updatePadFocus();
}

function winSkill(t){
  clearQuizState();
  const p=S.p; const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">🗡️ とくぎ（MP '+p.mp+' / '+pMaxMp(p.lv)+'）</p>'+diffRow()+'<div class="btns">'+skills().map((k,i)=>'<button type="button" data-k="'+i+'"'+(p.lv<k.lv||p.mp<k.mp?" disabled":"")+'>'+k.n+'<small>'+(p.lv<k.lv?"Lv"+k.lv+"で習得":"MP "+k.mp+"・威力"+Math.round(k.pow*100)+"%"+(k.all?" 敵全体":" ×"+k.hits+"回"))+'</small></button>').join("")+'<button id="back" type="button">もどる</button></div>';
  bindDiff(()=>winSkill(t));
  w.querySelectorAll("button[data-k]").forEach(b=>b.onclick=()=>{
    b.classList.add("pad-focus");
    const k=skills()[+b.dataset.k];
    ask(S.diff,"skill",r=>{S.p.mp-=k.mp;strike(r,k.pow,k.hits,k.n)},k.n);
  });
  $("#back").onclick=()=>winCmd(t);
  padFocusRow = 0; padBtnIndex = 0;
  updatePadFocus();
}

function winDefend(t){
  clearQuizState();
  const m=S.b.m, b=bonus(S.diff);
  const w=winEl(); if(!w) return;
  w.innerHTML='<p class="msg">'+t+' '+m.name+'が おそいかかる！</p>'+diffRow()+'<div class="btns"><button id="dG" type="button">🛡️ ぼうぎょ<small>被ダメージ '+(100-CFG.perLv*S.diff)+'% に軽減</small></button><button id="dE" type="button">👟 かいひ<small>回避率 '+b+'%・失敗で満額</small></button></div>';
  bindDiff(()=>winDefend(t));
  $("#dG").onclick=()=>{
    $("#dG").classList.add("pad-focus");
    ask(S.diff,"guard",r=>doDefend("guard",r));
  };
  $("#dE").onclick=()=>{
    $("#dE").classList.add("pad-focus");
    ask(S.diff,"evade",r=>doDefend("evade",r));
  };
  padFocusRow = 0; padBtnIndex = 0;
  updatePadFocus();
}

/* ---------- クイズ (Lv1〜10 全形式対応) ---------- */
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
        const sanitized = inp.value.replace(/[^a-zA-Z0-9\s'’\-]/g, "");
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

/* ---------- 行動 ---------- */
function doFirst(res){
  if(roll(pct(res))){
    log("先手を とった！"); pop("⚡ 先制！","crit",0,true); se("first_strike");
    winCmd("先手を とった！ どうする？");
  }else{
    log("先手を とられた！"); winDefend("先手を とられた！");
  }
}

function hitMon(total,t,evs){
  const m=S.b.m; m.hp=Math.max(0,m.hp-total); log(t); render();
  evs.forEach((e,i)=>pop(e.k==="miss"?"MISS":(e.k==="crit"?"クリティカル "+e.d:e.d),e.k==="hit"?"":e.k,i*220));
  const anyCrit=evs.some(e=>e.k==="crit");
  gl(anyCrit?"crit":total?"hit":"dodge");
  if(anyCrit) pulse("fx-crit",350);
  if(m.hp<=0){
    say(t);
    setTimeout(()=>{const g=$("#glyph");if(g)g.classList.add("dead");},300);
    return setTimeout(victory,950);
  }
  if(m.boss&&!m.regen&&m.hp<=m.max*CFG.regenAt/100){
    m.regen=true; say(t);
    return setTimeout(()=>{
      const h=Math.min(m.max-m.hp,Math.round(m.max*CFG.regenHeal/100));
      m.hp+=h;
      const t2=m.name+"の 自己再生！ HPが "+h+" 回復した。";
      log(t2); render(); gl("regen"); se("boss_regen"); pulse("fx-heal",700); pop("+"+h,"heal",150);
      winCmd(t2+" どうする？");
    },1100);
  }
  winDefend(t);
}

function strike(res,pow,hits,label,sure,drain){
  const p=S.p, m=S.b.m, parts=[], evs=[]; let total=0;
  const cr=res?pct(res):CFG.base;
  for(let h=0;h<hits;h++){
    if(!sure&&roll(m.eva)){parts.push("ミス");evs.push({k:"miss"});continue;}
    const crit=roll(cr), d=Math.max(1,Math.round(atkNow()*CFG.dmgBase*pow*(crit?CFG.critMul:1)*rnd(0.9,1.1)));
    total+=d; parts.push((crit?"クリティカル ":"")+d); evs.push({k:crit?"crit":"hit",d});
  }
  if(res&&res.ok) p.gauge=Math.min(100,p.gauge+pct(res));
  let t=(label?label+"！ ":"")+m.name+"に "+parts.join("・")+(total?" のダメージ。":"… あたらなかった。");
  if(drain&&total){
    const h=Math.min(pMaxHp(p.lv)-p.hp,Math.round(total*drain));
    p.hp+=h; t+=" HPを "+h+" すいとった。"; pop("💖 +"+h,"heal",300,true); se("special_drain",350);
  }
  if(label==="ひっさつ") se("special_hit"); else if(label) se(SKEY[label]);
  evs.forEach((e,i)=>{if(!label||e.k!=="hit")se(e.k==="miss"?"attack_miss":e.k==="crit"?"attack_critical":"attack_hit",i*220);});
  hitMon(total,t,evs);
}

function doAttack(res){ strike(res,1,1,""); }
function doSpecial(){
  const lv=S.p.lv; S.p.gauge=0; se("special_start"); pulse("fx-crit",350);
  strike(null,CFG.spPow,1,"ひっさつ",lv>=CFG.spSureLv,lv>=CFG.spDrainLv?CFG.spDrain/100:0);
}

function doItem(k,res){
  const p=S.p, hpItem=k==="pot", mx=hpItem?pMaxHp(p.lv):pMaxMp(p.lv), cur=hpItem?p.hp:p.mp;
  p.it[k]--;
  const amt=Math.min(Math.max(1,Math.round(mx*pct(res)/100)),mx-cur);
  if(hpItem) p.hp+=amt; else p.mp+=amt;
  const t=ITEMS[k].n+"を つかった。"+(hpItem?"HP":"MP")+"が "+amt+" 回復した。"+(res.ok?"":"（不正解で効果はわずか）");
  log(t); render();
  pulse(hpItem?"fx-heal":"fx-mp",650); se(hpItem?"heal_hp":"heal_mp");
  pop((hpItem?"💖 +":"💧 +")+amt,hpItem?"heal":"mp",0,true);
  if(S.screen==="battle") winDefend(t); else winExplore(t);
}

function doFlee(res){
  if(roll(pct(res))){
    se("flee"); log("うまく にげきった。"); S.screen="explore"; S.b=null; render();
    winExplore("うまく にげきった。");
  }else{
    log("にげられなかった！"); winDefend("にげられなかった！");
  }
}

function doDefend(stance,res){
  const p=S.p, m=S.b.m, ec=roll(CFG.eCrit);
  let dmg=Math.max(1,m.atk-defNow()*CFG.defCoef)*rnd(0.85,1.15)*(ec?CFG.eCritMul:1), t, fx;
  const pre=ec?"つうこんの いちげき！ ":"";
  if(stance==="evade"&&roll(pct(res))){
    dmg=0; t=m.name+"の こうげきを ひらりと かわした！"; fx="dodge";
  }else if(stance==="evade"){
    dmg=Math.max(1,Math.round(dmg)); t=pre+"かわしきれず "+dmg+" のダメージ。"; fx=ec?"hurt2":"hurt";
  }else{
    const mul=res.ok?Math.max(0,1-(pct(res)-CFG.base)/100):1;
    dmg=Math.max(1,Math.round(dmg*mul));
    t=pre+m.name+"の こうげき。"+(res.ok?"みがまえて ":"")+dmg+" のダメージ"+(res.ok?"（"+Math.round(mul*100)+"%に軽減）。":"。");
    fx=res.ok?"guard":(ec?"hurt2":"hurt");
  }
  p.hp=Math.max(0,p.hp-dmg); log(t); render(); gl("lunge");
  if(fx==="dodge"){ se("evade"); pulse("fx-dodge",450); pop("👟 かわした！","guard",0,true); }
  else if(fx==="guard"){ se("guard"); pulse("fx-guard",500); pop("🛡️ -"+dmg,"guard",0,true); }
  else{ se(ec?"enemy_critical":"enemy_hit"); pulse("fx-"+fx,700); pop((ec?"痛恨 -":"-")+dmg,ec?"crit":"hurt",0,true); }

  if(p.hp<=0){
    if(p.it.neck>0&&!S.b.rev){
      S.b.rev=true; p.it.neck--; say(t);
      return setTimeout(()=>{
        p.hp=Math.max(1,Math.round(pMaxHp(p.lv)*CFG.revive/100));
        const t2="復活の首飾りが くだけ散った！ HP "+p.hp+" で よみがえった。";
        log(t2); render(); pulse("fx-heal",700); se("revive"); pop("📿 ふっかつ！","heal",0,true);
        winCmd(t2+" どうする？");
      },1000);
    }
    say(t); return setTimeout(()=>finishRun("over"),1000);
  }
  winCmd(t+" どうする？");
}

function victory(){
  const p=S.p, m=S.b.m, i=S.b.i;
  S.st.kills++; p.exp+=m.exp; const lv0=p.lv;
  let t=m.name+"を たおした！ けいけんち "+m.exp+"。", up=false;
  while(p.exp>=expNext(p.lv)){
    p.exp-=expNext(p.lv); p.lv++; up=true;
    p.hp+=pMaxHp(p.lv)-pMaxHp(p.lv-1); p.mp+=pMaxMp(p.lv)-pMaxMp(p.lv-1);
    t+=" レベル "+p.lv+" に あがった！";
    const sk=skills().find(k=>k.lv===p.lv); if(sk) t+=" "+sk.n+"を おぼえた！";
  }
  if(m.boss){
    p.it.pot++; p.it.eth++; p.hp=pMaxHp(p.lv); p.mp=pMaxMp(p.lv);
    t+=" ポーションと まりょくの水を てにいれた。HPとMPが 全回復した！";
    const nt=Math.min(10,Math.floor(S.floor/10)+1);
    if(nt>p.gearMax){
      p.gearMax=nt; se("gear_get",2200);
      t+=" "+GEAR[nt-1]+"の装備一式を てにいれた！";
    }
  }
  log(t);

  // マップ上のエンティティ削除
  if(i != null && S.map.ents && S.map.ents[i]){
    delete S.map.ents[i];
  }

  // プレイヤーの移動: 通常遭遇で敵のマスへ前進した場合のみ敵マスへ移動
  // 不意打ち（敵から襲われた場合）やテスター戦闘（i == null）では現在位置を維持
  const isAmbush = !!(S.b && S.b.ambush);
  if(!isAmbush && i != null && i > 0 && i < W * H && S.map.cells[i] === 0){
    S.map.px = i % W;
    S.map.py = (i - S.map.px) / W;
  }

  // 念のためプレイヤー座標が壁内やマップ外にならないよう安全確認
  const curIdx = S.map.py * W + S.map.px;
  if(S.map.cells[curIdx] !== 0){
    // 万が一壁に入っていた場合は最も近い床マスへ自動補正
    for(let r = 1; r < Math.max(W, H); r++){
      let found = false;
      for(let dy = -r; dy <= r; dy++){
        for(let dx = -r; dx <= r; dx++){
          const nx = S.map.px + dx, ny = S.map.py + dy, idx = ny * W + nx;
          if(nx >= 0 && ny >= 0 && nx < W && ny < H && S.map.cells[idx] === 0){
            S.map.px = nx; S.map.py = ny; found = true; break;
          }
        }
        if(found) break;
      }
      if(found) break;
    }
  }

  reveal();
  S.screen="explore"; S.b=null; render();
  se(m.boss?"boss_down":"enemy_down");
  if(up){ pop("LEVEL UP!","crit",0,true); se("levelup",700); }
  if(skills().some(k=>k.lv>lv0&&k.lv<=p.lv)) se("skill_learn",1600);
  if(i != null && i===S.map.stairs) winNext(t); else winExplore(t);
}

function startBattle(i,e,ambush){
  S.b={i: (i != null ? i : null), m:makeMon(S.floor,e.a,e.t==="boss"), ambush:!!ambush}; S.screen="battle";
  log(S.b.m.name+(ambush?"が おそいかかってきた！":"が あらわれた！")); render();
  se(S.b.m.boss?"boss_encounter":"encounter"); pulse("fx-enc",650); gl("appear"); winFirst();
}

function moveMonsters(){
  const m=S.map, pi=m.py*W+m.px, done=new Set();
  for(const k of Object.keys(m.ents)){
    const i=+k, e=m.ents[i]; if(!e||e.t!=="mon"||done.has(e))continue; done.add(e);
    const x=i%W, y=(i-x)/W, d=Math.abs(x-m.px)+Math.abs(y-m.py);
    if(d===1) return i;
    const opts=[];
    for(const dr of DIRS){
      const nx=x+dr[0], ny=y+dr[1], j=ny*W+nx;
      if(nx<0||ny<0||nx>=W||ny>=H||m.cells[j]!==0||m.ents[j]||j===m.stairs||j===pi)continue;
      opts.push([j,Math.abs(nx-m.px)+Math.abs(ny-m.py)]);
    }
    if(!opts.length)continue;
    let pick=null;
    if(d<=CFG.chase){const near=opts.filter(o=>o[1]<d);if(near.length)pick=near[ri(near.length)];}
    if(!pick) pick=opts[ri(opts.length)];
    delete m.ents[i]; m.ents[pick[0]]=e;
  }
  return null;
}

function move(dx,dy){
  if(S.screen!=="explore")return;
  const m=S.map, nx=m.px+dx, ny=m.py+dy, i=ny*W+nx;
  if(nx<0||ny<0||nx>=W||ny>=H||m.cells[i]!==0){ se("disabled"); return; }
  haptic(15);
  const e=m.ents[i];
  if(e&&(e.t==="mon"||e.t==="boss")) return startBattle(i,e,false);
  m.px=nx; m.py=ny; reveal();
  let msg=null, got=null;
  if(e&&e.t==="chest"){
    delete m.ents[i]; got=loot(); S.p.it[got]++; msg=ITEMS[got].n+"を みつけた！";
    se("chest"); log("たからばこから "+ITEMS[got].n+"を みつけた。");
  }
  if(i===m.stairs){
    render(); se("stairs"); say("かいだんを おりる…"); setTimeout(descend,400); return;
  }
  const a=moveMonsters();
  if(a!=null) return startBattle(a,m.ents[a],true);
  render();
  if(got){ pop(ITEMS[got].ic+" "+ITEMS[got].n,"guard",0,true); winExplore(msg); }
}

function descend(){
  S.cleared=Math.max(S.cleared,S.floor);
  if(S.floor>=100) return finishRun("clear");
  S.floor++;
  const p=S.p, mx=pMaxHp(p.lv), h=Math.min(mx-p.hp,Math.round(mx*CFG.stairHeal/100));
  p.hp+=h; p.mp=Math.min(pMaxMp(p.lv),p.mp+Math.round(pMaxMp(p.lv)*CFG.stairHeal/100));
  enterFloor("地下 "+S.floor+" 階へ。ひといきついて HP "+h+" 回復。");
  autosave();
}

function finishRun(kind){
  const st=S.st, r={floor:S.floor,lv:S.p.lv,ok:st.ok,total:st.total,kills:st.kills,acc:st.total?Math.round(100*st.ok/st.total):0,practice:S.practice,isNew:false};
  if(!S.practice&&S.floor>REC.best){REC.best=S.floor;r.isNew=true;saveRec()}
  S.result=r; S.screen=kind; render(); winEnd();
  se(kind==="clear"?"game_clear":"game_over");
  if(r.isNew) se("new_record",2600);
}

/* ==========================================================================
   🕹️ ソフトウェアパッド連動ロジック
   十字キー、A/B/X/Yボタン、START/SELECT/+/-ボタンの処理
   ========================================================================== */
function padAction(action){
  haptic(20);
  if(action==="up") handleDirection(0,-1);
  else if(action==="down") handleDirection(0,1);
  else if(action==="left") handleDirection(-1,0);
  else if(action==="right") handleDirection(1,0);
  else if(action==="A") handleButtonA();
  else if(action==="B") handleButtonB();
  else if(action==="X") handleButtonX();
  else if(action==="Y") handleButtonY();
  else if(action==="START" || action==="PLUS"){
    // ① メニューボタン (GB: START / Switch: PLUS)
    if(S.screen==="explore"){
      toggleFieldMenu();
    } else {
      openMenu();
    }
  }
  else if(action==="SELECT" || action==="MINUS" || action==="MENU"){
    // ② 設定ボタン (GB: SELECT / Switch: MINUS, HOME)
    const modal=$("#menuModal");
    if(modal && modal.classList.contains("open")) closeMenu();
    else openMenu();
  }
}

function handleDirection(dx,dy){
  const w = winEl();
  const root = $("#appRoot");
  const qp = $("#quizPane");
  const isQuizActive = root && root.classList.contains("is-quiz") && qp && qp.style.display !== "none";
  const quizHost = (isQuizActive && qp && qp.querySelector(".choices button")) ? qp : w;

  // 1. クイズ4択画面中
  if(quizHost && quizHost.querySelector(".choices button")){
    const cBtns = [...quizHost.querySelectorAll(".choices button:not(:disabled)")];
    if(cBtns.length){
      if(dx !== 0){
        if(choiceIndex % 2 === 0 && dx > 0 && choiceIndex + 1 < cBtns.length) choiceIndex++;
        else if(choiceIndex % 2 === 1 && dx < 0) choiceIndex--;
        else choiceIndex = (choiceIndex + dx + cBtns.length) % cBtns.length;
      } else if(dy !== 0){
        if(dy > 0 && choiceIndex + 2 < cBtns.length) choiceIndex += 2;
        else if(dy < 0 && choiceIndex - 2 >= 0) choiceIndex -= 2;
        else choiceIndex = (choiceIndex + dy + cBtns.length) % cBtns.length;
      }
      se("select");
      updatePadFocus();
      return;
    }
  }

  // 2. ウィンドウ内に難易度チップまたはコマンドボタンが存在する場合
  if(w){
    const chips = [...w.querySelectorAll(".dchip")];
    const cmdBtns = [...w.querySelectorAll(".btns button:not(:disabled)")];

    if(chips.length > 0){
      // 難易度行がある画面（戦闘画面など）
      if(padFocusRow === 0){
        // --- 難易度行にいる時 ---
        if(dx !== 0){
          // 左右キーで難易度1〜10を変更
          changeDiff(dx);
          return;
        } else if(dy > 0){
          // ↓キー押し込みでコマンド行へ移動！
          if(cmdBtns.length){
            padFocusRow = 1;
            padBtnIndex = 0;
            se("select");
            updatePadFocus();
          }
          return;
        }
      } else {
        // --- コマンド行にいる時 ---
        if(dy < 0){
          // ↑キーで難易度行へ復帰！
          padFocusRow = 0;
          se("select");
          updatePadFocus();
          return;
        } else if(dx !== 0 || dy > 0){
          // 左右キーまたは↓キーでコマンド選択を循環
          if(cmdBtns.length){
            const step = (dx !== 0 ? dx : dy);
            padBtnIndex = (padBtnIndex + step + cmdBtns.length) % cmdBtns.length;
            se("select");
            updatePadFocus();
          }
          return;
        }
      }
    } else if(cmdBtns.length > 0){
      // 探索中かつメニュー非表示時（.explore-idle）は十字キーで直接マップ移動！
      if(S.screen === "explore" && !w.querySelector(".explore-menu")){
        move(dx, dy);
        return;
      }
      // 難易度行がないボタン一覧（探索メニュー、リザルト、階段など）
      padFocusRow = 1;
      const step = (dx !== 0 ? dx : dy);
      padBtnIndex = (padBtnIndex + step + cmdBtns.length) % cmdBtns.length;
      se("select");
      updatePadFocus();
      return;
    }
  }

  // 3. 探索画面の通常移動
  if(S.screen==="explore"){
    move(dx,dy);
  }
}

function handleButtonA(){
  const w = winEl(); if(!w) return;
  const root = $("#appRoot");
  const qp = $("#quizPane");
  const isQuizActive = root && root.classList.contains("is-quiz") && qp && qp.style.display !== "none";
  const quizHost = (isQuizActive && qp && qp.querySelector(".choices button")) ? qp : w;

  // 1. クイズ4択画面中なら選択中の選択肢を実行
  const cBtns = [...quizHost.querySelectorAll(".choices button:not(:disabled)")];
  if(cBtns.length){
    choiceIndex = Math.max(0, Math.min(cBtns.length - 1, choiceIndex));
    if(cBtns[choiceIndex]){
      cBtns[choiceIndex].click();
      return;
    }
  }

  // 2. テキスト入力クイズの送信ボタン
  const qFormSubmit = $("#qform button[type=submit]");
  if(qFormSubmit && !qFormSubmit.disabled){ qFormSubmit.click(); return; }

  // 3. ワープフォーム送信ボタン
  const wFormSubmit = $("#wform button[type=submit]");
  if(wFormSubmit && !wFormSubmit.disabled){ wFormSubmit.click(); return; }

  // 4. 難易度行にいる時にAボタンを押した場合はコマンド行へ移動
  const chips = [...w.querySelectorAll(".dchip")];
  const cmdBtns = [...w.querySelectorAll(".btns button:not(:disabled)")];

  if(chips.length > 0 && padFocusRow === 0){
    if(cmdBtns.length){
      padFocusRow = 1;
      padBtnIndex = 0;
      se("decide");
      updatePadFocus();
      return;
    }
  }

  // 5. コマンド行にいる時: 現在フォーカス中のコマンドを実行
  if(cmdBtns.length){
    padBtnIndex = Math.max(0, Math.min(cmdBtns.length - 1, padBtnIndex));
    if(cmdBtns[padBtnIndex]){
      cmdBtns[padBtnIndex].click();
      return;
    }
  }

  // 6. 探索時
  if(S.screen==="explore"){
    se("decide");
  }
}

function handleButtonB(){
  const modal = $("#menuModal");
  if(modal && modal.classList.contains("open")){
    closeMenu();
    return;
  }
  const w = winEl(); if(!w) return;

  // 探索メニューが開いていれば閉じる
  if(S.screen === "explore" && w.querySelector(".explore-menu")){
    se("cancel");
    winExplore("どちらへ すすむ？");
    return;
  }

  // もどるボタンがあれば実行
  const backBtn = $("#back");
  if(backBtn && !backBtn.disabled){ backBtn.click(); return; }

  // 戦闘中、コマンド行にいるなら難易度行に戻る
  const chips = [...w.querySelectorAll(".dchip")];
  if(chips.length > 0 && padFocusRow === 1){
    padFocusRow = 0;
    se("cancel");
    updatePadFocus();
    return;
  }

  // 戦闘中なら「にげる」ショートカット
  const fleeBtn = $("#cF");
  if(fleeBtn && !fleeBtn.disabled){ fleeBtn.click(); return; }

  se("cancel");
}

function handleButtonX(){
  // 🎒 どうぐショートカット
  const bagBtn = $("#bag") || $("#cH");
  if(bagBtn && !bagBtn.disabled){ bagBtn.click(); }
  else { se("select"); }
}

function handleButtonY(){
  // 🗡️ とくぎ / そうびショートカット
  const skBtn = $("#cQ") || $("#eqb");
  if(skBtn && !skBtn.disabled){ skBtn.click(); }
  else { se("select"); }
}


/* ==========================================================================
   📱 🖥️ 画面レイアウト構築 (HTMLジェネレーター)
   ========================================================================== */
let currentDisplayMode = "auto"; // "auto" | "gb" | "switch"

function applyLayout(){
  const isLandscape = window.innerWidth > window.innerHeight;
  let mode = currentDisplayMode;
  if(mode === "auto"){
    mode = isLandscape ? "switch" : "gb";
  }

  const root = $("#appRoot");
  root.className = mode === "switch" ? "mode-switch" : "mode-gb";

  if(mode === "switch"){
    renderSwitchHTML(root);
  } else {
    renderGameBoyHTML(root);
  }

  bindPadButtons();
  render();

  // 現在の画面に応じたウィンドウを確実に再描画
  if(S.screen === "title"){
    winTitle();
  } else if(S.screen === "explore"){
    winExplore(S.floor%10===0?"つよい けはいが する…":"どちらへ すすむ？");
  } else if(S.screen === "battle"){
    if(S.b && S.b.m) winCmd("どうする？");
  } else if(S.screen === "over" || S.screen === "clear"){
    winEnd();
  }
}

function renderGameBoyHTML(root){
  root.innerHTML = `
    <div class="screen-wrapper">
      <header class="top-nav">
        <div class="top-left">
          <button class="btn-back-menu" id="topBackBtn" type="button" aria-label="戻る">◀ 戻る</button>
          <h1 class="game-title">単語迷宮<small>百階</small></h1>
        </div>
        <div class="top-right">
          <div class="best-tag">最高 <b id="best">—</b></div>
          <button class="btn-menu-trigger" id="topMenuBtn" type="button">⚙️ MENU</button>
        </div>
      </header>

      <div class="screen-body">
        <div class="battle-main" id="battleMain">
          <div class="stagewrap">
            <div id="stage"></div>
            <div id="fx"></div>
          </div>

          <div class="hud" id="hudBar"></div>

          <div class="window-cmd" id="win"></div>
        </div>

        <div class="quiz-pane" id="quizPane" style="display:none;"></div>
      </div>
    </div>

    <!-- ゲームボーイ風下部操作パネル -->
    <div class="gb-pad-area">
      <div class="gb-top-row">
        <!-- 十字キー -->
        <div class="dpad-cross">
          <button class="dpad-up" data-act="up" type="button" aria-label="上">▲</button>
          <button class="dpad-down" data-act="down" type="button" aria-label="下">▼</button>
          <button class="dpad-left" data-act="left" type="button" aria-label="左">◀</button>
          <button class="dpad-right" data-act="right" type="button" aria-label="右">▶</button>
          <div class="dpad-center"></div>
        </div>

        <!-- B / A ボタン (斜め配置) -->
        <div class="gb-ab-group">
          <div class="gb-btn-wrap">
            <button class="gb-round-btn" data-act="B" type="button" aria-label="Bボタン">B</button>
            <span class="gb-btn-label">CANCEL</span>
          </div>
          <div class="gb-btn-wrap">
            <button class="gb-round-btn" data-act="A" type="button" aria-label="Aボタン">A</button>
            <span class="gb-btn-label">ACTION</span>
          </div>
        </div>
      </div>

      <!-- SELECT / START ボタン -->
      <div class="gb-bottom-row">
        <div class="gb-pill-wrap">
          <button class="gb-pill-btn" data-act="SELECT" type="button" aria-label="SELECT"></button>
          <span class="gb-pill-label">SELECT</span>
        </div>
        <div class="gb-pill-wrap">
          <button class="gb-pill-btn" data-act="START" type="button" aria-label="START"></button>
          <span class="gb-pill-label">START</span>
        </div>
      </div>
    </div>
  `;
}

function renderSwitchHTML(root){
  root.innerHTML = `
    <!-- 左Joy-Con (Blue) -->
    <div class="switch-joycon joycon-left">
      <button class="joycon-btn-minus" data-act="MINUS" type="button" aria-label="マイナスボタン">ー</button>
      
      <div class="stick-deco">
        <div class="stick-deco-inner"></div>
      </div>

      <div class="switch-dpad">
        <button class="s-dpad-up" data-act="up" type="button" aria-label="上">▲</button>
        <button class="s-dpad-down" data-act="down" type="button" aria-label="下">▼</button>
        <button class="s-dpad-left" data-act="left" type="button" aria-label="左">◀</button>
        <button class="s-dpad-right" data-act="right" type="button" aria-label="右">▶</button>
      </div>

      <button class="btn-capture" data-act="SELECT" type="button" aria-label="キャプチャボタン"></button>
    </div>

    <!-- 中央 スクリーン本体 -->
    <div class="screen-wrapper">
      <header class="top-nav">
        <div class="top-left">
          <button class="btn-back-menu" id="topBackBtn" type="button" aria-label="戻る">◀ 戻る</button>
          <h1 class="game-title">単語迷宮<small>百階</small></h1>
        </div>
        <div class="top-right">
          <div class="best-tag">最高 <b id="best">—</b></div>
          <button class="btn-menu-trigger" id="topMenuBtn" type="button">⚙️ MENU</button>
        </div>
      </header>

      <div class="screen-body">
        <div class="battle-main" id="battleMain">
          <div class="stagewrap">
            <div id="stage"></div>
            <div id="fx"></div>
          </div>

          <div class="hud" id="hudBar"></div>

          <div class="window-cmd" id="win"></div>
        </div>

        <div class="quiz-pane" id="quizPane" style="display:none;"></div>
      </div>
    </div>

    <!-- 右Joy-Con (Red) -->
    <div class="switch-joycon joycon-right">
      <button class="joycon-btn-plus" data-act="PLUS" type="button" aria-label="プラスボタン">＋</button>

      <div class="switch-abxy">
        <button class="s-btn-x" data-act="X" type="button" aria-label="Xボタン">X</button>
        <button class="s-btn-a" data-act="A" type="button" aria-label="Aボタン">A</button>
        <button class="s-btn-b" data-act="B" type="button" aria-label="Bボタン">B</button>
        <button class="s-btn-y" data-act="Y" type="button" aria-label="Yボタン">Y</button>
      </div>

      <div class="stick-deco">
        <div class="stick-deco-inner"></div>
      </div>

      <button class="btn-home" data-act="MENU" type="button" aria-label="HOMEボタン">⌂</button>
    </div>
  `;
}

function bindPadButtons(){
  $$("[data-act]").forEach(b=>{
    b.addEventListener("pointerdown",e=>{
      e.preventDefault();
      b.classList.add("active");
      padAction(b.dataset.act);
    });
    const clear=()=>{ b.classList.remove("active"); };
    b.addEventListener("pointerup", clear);
    b.addEventListener("pointerleave", clear);
    b.addEventListener("pointercancel", clear);
  });

  const mBtn = $("#topMenuBtn");
  if(mBtn) mBtn.onclick = ()=>openMenu();

  const bBtn = $("#topBackBtn");
  if (bBtn) {
    bBtn.onclick = (e) => {
      e.preventDefault();
      handleTopBack();
    };
  }
}

let lastIsLandscape = window.innerWidth > window.innerHeight;
window.addEventListener("resize",()=>{ if(!isDungeonActive()) return;
  const curLandscape = window.innerWidth > window.innerHeight;
  if(currentDisplayMode === "auto" && curLandscape !== lastIsLandscape){
    lastIsLandscape = curLandscape;
    applyLayout();
  }
});


/* ==========================================================================
   ⚙️ メニューモーダル管理
   ========================================================================== */
function openMenu(tabId="tab-sound"){
  se("menu_open");
  const modal = $("#menuModal");
  modal.classList.add("open");
  switchMenuTab(tabId);
  renderStatus();
  renderLog();
  renderTune();
  updateSoundUI();
}

function closeMenu(){
  se("cancel");
  const modal = $("#menuModal");
  modal.classList.remove("open");
}

function switchMenuTab(tabId){
  $$(".menu-tab-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  $$(".tab-content").forEach(c=>{
    c.classList.toggle("active", c.id === tabId);
  });
}

$("#modalCloseBtn").onclick = closeMenu;
$("#menuModal").onclick = (e)=>{
  if(e.target === $("#menuModal")) closeMenu();
};

$$(".menu-tab-btn").forEach(b=>{
  b.onclick = ()=>{
    se("select");
    switchMenuTab(b.dataset.tab);
  };
});

/* サウンドコントロール イベント */
$("#mSeMute").onclick = ()=>{
  seOn = !seOn; saveSnd(); updateSoundUI(); se("select");
};
$("#mBgmMute").onclick = ()=>{
  bgmOn = !bgmOn; saveSnd(); updateSoundUI(); bgmUpdate();
};

$("#mSeVol").oninput = (e)=>{
  seVol = parseFloat(e.target.value);
  $("#mSeVolTxt").textContent = Math.round(seVol*100)+"%";
  saveSnd();
};
$("#mSeVol").onchange = ()=>se("select");

$("#mBgmVol").oninput = (e)=>{
  bgmVol = parseFloat(e.target.value);
  $("#mBgmVolTxt").textContent = Math.round(bgmVol*100)+"%";
  saveSnd();
  if(bgmCur && BGM[bgmCur]) BGM[bgmCur].volume = bgmVol;
};

$("#mAutoLoadBtn").onclick = ()=>{
  autoLoadRelativeAudio();
  se("decide");
};
$("#mDirBtn").onclick = ()=> $("#mInputSeDir").click();
$("#mFileBtn").onclick = ()=> $("#mInputSeFiles").click();

[["#mInputSeDir"],["#mInputSeFiles"]].forEach(([id])=>$(id).addEventListener("change",e=>{
  const n = seLoadFromFiles(e.target.files||[]);
  e.target.value="";
  if(!n){
    $("#mSoundStatus").textContent = "se01_〜 や BGM01_〜 で始まるファイルが見つかりませんでした";
  }else{
    se("decide"); bgmUpdate();
  }
}));

/* サウンドテスター一覧の構築 */
function buildSoundTestGrid(){
  const grid = $("#soundTestGrid"); if(!grid) return;
  grid.innerHTML = AUDIO_MANIFEST.map(item=>`
    <button class="st-btn" data-st-type="${item.type}" data-st-id="${item.id}" type="button">
      ▶ ${item.name}
    </button>
  `).join("");

  grid.querySelectorAll(".st-btn").forEach(b=>{
    b.onclick = ()=>{
      const type = b.dataset.stType;
      const id = b.dataset.stId;
      if(type==="bgm"){
        const num = +id;
        if(BGM[num]){
          if(bgmCur && BGM[bgmCur] && bgmCur !== num) {
            BGM[bgmCur].pause();
            BGM[bgmCur].currentTime = 0;
          }
          bgmCur = num;
          setupBgmElement(BGM[num], num);
          BGM[num].currentTime = 0;
          BGM[num].volume = bgmVol;
          BGM[num].play().catch(()=>{});
        }else{
          alert("このBGMはまだ読み込まれていません。");
        }
      }else{
        if(SE[id]){
          try{
            SE[id].currentTime = 0;
            SE[id].volume = seVol;
            const pr = SE[id].play();
            if(pr) pr.catch(e => console.warn("SE play failed:", e));
          }catch(e){
            console.warn("SE error:", e);
          }
        }else{
          alert("この効果音はまだ読み込まれていません。");
        }
      }
    };
  });
}

/* デバッグテスター・チートボタン イベント */
$("#chHeal").onclick = ()=>{
  if(!S.p) return;
  S.p.hp = pMaxHp(S.p.lv); S.p.mp = pMaxMp(S.p.lv);
  log("【テスター】HPとMPを全回復した！");
  render(); pop("💖 全回復！","heal",0,true); se("heal_hp");
};
$("#chGauge").onclick = ()=>{
  if(!S.p) return;
  S.p.gauge = 100;
  log("【テスター】必殺ゲージをMAX(100%)にした！");
  render(); pop("💥 必殺MAX！","crit",0,true); se("special_start");
};
$("#chItems").onclick = ()=>{
  if(!S.p) return;
  Object.keys(S.p.it).forEach(k=>S.p.it[k]+=5);
  log("【テスター】どうぐを各5個補充した！");
  render(); pop("🎒 アイテム補充！","guard",0,true); se("chest");
};
$("#chGear").onclick = ()=>{
  if(!S.p) return;
  S.p.gearMax = 10;
  S.p.eq = fullSet(10);
  log("【テスター】最高位のオリハルコン装備一式を装備した！");
  render(); pop("🛡️ 最強装備！","guard",0,true); se("gear_get");
};
$("#chSkip").onclick = ()=>{
  if(!S.p) return;
  log("【テスター】階段を降りて次の階へスキップした！");
  closeMenu();
  descend();
};
$("#chBattle").onclick = ()=>{
  if(!S.p) return;
  closeMenu();
  startBattle(null, {t:"mon", a:ri(4)}, false);
};
$("#chBoss").onclick = ()=>{
  if(!S.p) return;
  closeMenu();
  startBattle(null, {t:"boss"}, false);
};

$("#mResetSaveBtn").onclick = ()=>{
  if(confirm("セーブデータを初期化しますか？（最高記録もリセットされます）")){
    REC = {best:0, save:null};
    saveRec();
    renderStatus();
    alert("セーブデータを初期化しました。");
  }
};

/* 画面モード切り替え */
$$(".mode-btn").forEach(b=>{
  b.onclick = ()=>{
    $$(".mode-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    currentDisplayMode = b.dataset.mode;
    applyLayout();
    se("select");
  };
});

/* 触覚振動トグル */
$("#mHapticsToggle").onchange = (e)=>{
  hapticsEnabled = e.target.checked;
};


/* ==========================================================================
   🛠️ バランス調整 (テスター用 SCHEMA 管理)
   ========================================================================== */
function renderTable(){
  const tbl=$("#mTtable"); if(!tbl) return;
  let h="<tr><th>階</th><th>想定Lv</th><th>主HP</th><th>主攻</th><th>主防</th><th>敵HP</th><th>敵攻</th><th>必要攻撃</th><th>耐久</th><th>竜HP</th><th>竜攻</th></tr>";
  for(const f of [1,10,30,50,80,100]){
    const s=monStats(f,archOf(0),false), b=f%10===0?monStats(f,archOf(0),true):null;
    h+="<tr><td>"+f+"</td><td>"+f+"</td><td>"+pMaxHp(f)+"</td><td>"+expAtk(f)+"</td><td>"+expDef(f)+"</td><td>"+s.hp+"</td><td>"+s.atk+"</td><td>"+kHits(f).toFixed(1)+"</td><td>"+nHits(f).toFixed(1)+"</td><td>"+(b?b.hp:"—")+"</td><td>"+(b?b.atk:"—")+"</td></tr>";
  }
  tbl.innerHTML=h;
}

function buildParams(){
  const pBox=$("#mParams"); if(!pBox) return;
  const open=[...document.querySelectorAll("#mParams .pgroup")].map(d=>d.open);
  pBox.innerHTML=SCHEMA.map((g,gi)=>'<details class="pgroup"'+(open[gi]?" open":"")+'><summary>'+g[0]+'</summary>'+g[1].map(r=>'<label class="prow" for="p_'+r[0]+'"><span>'+r[1]+'</span><input type="number" id="p_'+r[0]+'" min="'+r[3]+'" max="'+r[4]+'" step="'+r[5]+'" value="'+CFG[r[0]]+'"></label>').join("")+'</details>').join("");
  SCHEMA.forEach(g=>g[1].forEach(r=>{
    const el=$("#p_"+r[0]);
    if(el) el.addEventListener("change",e=>{
      let v=parseFloat(e.target.value); if(!isFinite(v)) v=DEF[r[0]];
      v=Math.max(r[3],Math.min(r[4],v)); CFG[r[0]]=v; e.target.value=v; applyCfg();
    });
  }));
}

function applyCfg(){
  saveCfg(); renderTable();
  if(S.p&&(S.screen==="explore"||S.screen==="battle")){
    S.p.hp=Math.max(1,Math.min(S.p.hp,pMaxHp(S.p.lv)));
    S.p.mp=Math.min(S.p.mp,pMaxMp(S.p.lv));
    renderStage(); renderStatus();
  }
}
function renderTune(){ buildParams(); renderTable(); }

let resetArmed=false;
$("#mCfgReset").onclick=()=>{
  if(!resetArmed){
    resetArmed=true; $("#mCfgMsg").textContent="もう一度押すとすべての数値が初期値に戻ります。"; return;
  }
  resetArmed=false; Object.assign(CFG,DEF); buildParams(); applyCfg();
  $("#mCfgMsg").textContent="初期値に戻しました。";
};
$("#mCfgOut").onclick=()=>{
  const t=JSON.stringify(CFG); $("#mCfgText").value=t;
  const done=()=>{$("#mCfgMsg").textContent="設定JSONを書き出しました。";};
  try{navigator.clipboard.writeText(t).then(()=>{$("#mCfgMsg").textContent="設定をクリップボードにコピーしました！";},done)}catch(e){done()}
};
$("#mCfgIn").onclick=()=>{
  try{
    const o=JSON.parse($("#mCfgText").value);
    if(!o||typeof o!=="object") throw 0;
    setCfg(o); buildParams(); applyCfg();
    $("#mCfgMsg").textContent="設定を読み込みました。";
  }catch(e){
    $("#mCfgMsg").textContent="読み込めませんでした。正しいJSON形式で貼り付けてください。";
  }
};

$("#mTryBtn").onclick=()=>{
  const f=Math.max(1,Math.min(100,Math.round(+$("#mTryF").value||1)));
  closeMenu();
  start(f,true);
};


/* ==========================================================================
   🎮 入力イベント (キーボード & タッチスワイプ & マップタップ)
   ========================================================================== */
document.addEventListener("click",e=>{ if(!isDungeonActive()) return; if(!isDungeonActive()) return;
  const b=e.target.closest("button");
  if(!b||b.disabled||b.type==="submit"||b.id==="topBackBtn"||b.closest(".choices,.dpad-cross,.switch-dpad,.switch-abxy,.gb-ab-group,.menu-card"))return;
  const id=b.id;
  if(b.classList.contains("dchip")) se("select");
  else if(id==="back") se("cancel");
  else if(["bag","eqb","cQ","cH"].includes(id)) se("menu_open");
  else if(["cA","cF","dG","dE","next","cont"].includes(id)||b.dataset.k!=null||b.dataset.it!=null) se("decide");
},true);

// マップタップ移動
document.addEventListener("click",e=>{
  const c=e.target.closest(".c.adj"); if(!c||!S.map) return;
  const i=+c.dataset.i, x=i%W, y=(i-x)/W;
  move(x-S.map.px, y-S.map.py);
});

// マップ上スワイプ移動
let sw=null;
document.addEventListener("touchstart",e=>{ if(!isDungeonActive()) return;
  if(e.target.closest(".map")){
    const t=e.touches[0]; sw=[t.clientX,t.clientY];
  }
},{passive:true});
document.addEventListener("touchend",e=>{
  if(!sw) return;
  const t=e.changedTouches[0], dx=t.clientX-sw[0], dy=t.clientY-sw[1]; sw=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<26) return;
  e.preventDefault();
  if(Math.abs(dx)>Math.abs(dy)) move(dx>0?1:-1, 0);
  else move(0, dy>0?1:-1);
});

// 物理キーボードをソフトウェアキーボードの各キーに対応するショートカットとして捕捉
window.addEventListener("keydown", e => { if(!isDungeonActive()) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^F\d+$/.test(e.key)) return;

  const qin = document.getElementById("qin");
  const isTypingActive = qin && document.body.contains(qin) && !qin.disabled;

  if (isTypingActive && window.AppKeyboard && window.AppKeyboard.activeInstance) {
    const handled = window.AppKeyboard.sendKey(e.code, e.key, e.shiftKey);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }
}, true);

// キーボード操作 (矢印キー, WASD, 数字キー, Enter, Space, Esc, Z, X)
document.addEventListener("keydown",e=>{ if(!isDungeonActive()) return;
  if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
  if(e.key==="Escape"){
    const modal=$("#menuModal");
    if(modal.classList.contains("open")) closeMenu();
    else openMenu();
    return;
  }

  // Mキー / Tabキーで探索メニュー開閉
  if(e.key === "m" || e.key === "M" || e.key === "Tab"){
    e.preventDefault();
    if(S.screen === "explore") toggleFieldMenu();
    else openMenu();
    return;
  }

  // 1〜4キーでクイズ選択肢を即回答（既存互換）
  if(quizKey && "1234".includes(e.key)){
    quizKey(e.key);
    return;
  }

  // 十字キー (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) および WASD
  const k={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];
  if(k){
    e.preventDefault();
    handleDirection(k[0], k[1]);
    return;
  }

  // Aボタン相当 (Enter, Space, Z, J)
  if(e.key==="Enter" || e.key===" " || e.key==="z" || e.key==="Z" || e.key==="j" || e.key==="J"){
    e.preventDefault();
    handleButtonA();
    return;
  }

  // Bボタン相当 (Backspace, x, X, k, K)
  if(e.key==="Backspace" || e.key==="x" || e.key==="X" || e.key==="k" || e.key==="K"){
    e.preventDefault();
    handleButtonB();
    return;
  }
});


/* ==========================================================================
   🚀 起動ブートストラップ
   ========================================================================== */
function boot(d){
  if(d&&d.CFG) setCfg(d.CFG);
  applyLayout();
  buildSoundTestGrid();
  renderTune();
  autoLoadRelativeAudio();
  if(window.AppKeyboard) AppKeyboard.init();

  if(d&&d.S&&d.S.p&&d.S.p.it&&(d.S.screen==="explore"||d.S.screen==="battle")){
    S=d.S; S.p.it=fillItems(S.p.it); fillGear(S.p,S.cleared);
    render();
    if(S.screen==="battle") winCmd("どうする？"); else winExplore("どちらへ すすむ？");
  }else{
    S={screen:"title"};
    render();
    winTitle();
  }
}

// boot will be invoked via startDungeonWithTower() or openDungeonGame()


/* ==========================================================================
   Virtual Keyboard System (keyboard-export/virtual-keyboard.js より移植)
   ========================================================================== */
/**
 * Virtual Keyboard System (VirtualKeyboard)
 * 
 * 英語・日本語（QWERTYローマ字 / JISかな）両対応 高機能オンスクリーンキーボード
 * - 依存ライブラリなし（Vanilla JS）
 * - タッチデバイス対応（pointerdown 最適化、タップ遅延・ダブルタップ拡大防止）
 * - 大文字/小文字/CapsLock (Shift長押し)
 * - 日本語ローマ字入力リアルタイム変換（拗音・促音・撥音・n自動確定）
 * - JISひらがな配列 ＆ 濁点/半濁点の後付け結合
 * - ひらがな ⇔ カタカナ 相互変換トグル
 * - 動的スケーリング（--kb-scale, --vk-font-px, --vk-pad-px）
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VirtualKeyboard = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- ローマ字・かな変換テーブル構築 ---
  let _romajiPairs = null;
  function getRomajiPairs() {
    if (_romajiPairs) return _romajiPairs;
    const M = {};
    const V = ["a", "i", "u", "e", "o"];
    const VA = ["あ", "い", "う", "え", "お"];
    V.forEach((v, i) => { M[v] = VA[i]; });

    function row(prefix, chars) {
      const arr = chars.split("");
      V.forEach((v, i) => {
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
    M["ya"] = "や"; M["yi"] = "い"; M["yu"] = "ゆ"; M["ye"] = "いぇ"; M["yo"] = "よ";
    M["wa"] = "わ"; M["wi"] = "うぃ"; M["we"] = "うぇ"; M["wo"] = "を"; M["wu"] = "う";
    M["shi"] = "し"; M["si"] = "し";
    M["chi"] = "ち"; M["ti"] = "ち";
    M["tsu"] = "つ"; M["tu"] = "つ";
    M["fu"] = "ふ"; M["hu"] = "ふ";
    M["ji"] = "じ"; M["zi"] = "じ";

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
      ["jy", "じゃ", "じゅ", "じょ"],
      ["j", "じゃ", "じゅ", "じょ"]
    ];
    yoGo.forEach(rowY => {
      const p = rowY[0];
      M[p + "a"] = rowY[1];
      M[p + "u"] = rowY[2];
      M[p + "o"] = rowY[3];
    });

    M["nn"] = "ん"; M["xn"] = "ん";
    M["vu"] = "ゔ"; M["va"] = "ゔぁ"; M["vi"] = "ゔぃ"; M["ve"] = "ゔぇ"; M["vo"] = "ゔぉ";
    M["xtu"] = "っ"; M["xtsu"] = "っ"; M["ltu"] = "っ"; M["ltsu"] = "っ";
    M["xa"] = "ぁ"; M["xi"] = "ぃ"; M["xu"] = "ぅ"; M["xe"] = "ぇ"; M["xo"] = "ぉ";
    M["la"] = "ぁ"; M["li"] = "ぃ"; M["lu"] = "ぅ"; M["le"] = "ぇ"; M["lo"] = "ぉ";
    M["xya"] = "ゃ"; M["xyu"] = "ゅ"; M["xyo"] = "ょ";
    M["lya"] = "ゃ"; M["lyu"] = "ゅ"; M["lyo"] = "ょ";

    // 促音 (kk, ss, tt, pp, gg, bb, zz, etc.)
    ["k", "s", "t", "p", "g", "b", "z", "d", "j", "c"].forEach(c => {
      V.forEach(v => {
        const one = M[c + v];
        if (one) M[c + c + v] = "っ" + one;
      });
    });
    M["ssa"] = "っさ"; M["ssi"] = "っし"; M["ssu"] = "っす"; M["sse"] = "っせ"; M["sso"] = "っそ";
    M["tta"] = "った"; M["tti"] = "っち"; M["ttu"] = "っつ"; M["tte"] = "って"; M["tto"] = "っと";
    M["hha"] = "っは"; M["hhi"] = "っひ"; M["hhu"] = "っふ"; M["hhe"] = "っへ"; M["hho"] = "っほ";
    M["aa"] = "ああ"; M["ii"] = "いい"; M["uu"] = "うう"; M["ee"] = "ええ"; M["ei"] = "えい";
    M["oo"] = "おお"; M["ou"] = "おう";

    const pairs = Object.keys(M).map(k => [k, M[k]]);
    pairs.sort((a, b) => b[0].length - a[0].length);
    _romajiPairs = pairs;
    return pairs;
  }

  // --- ローマ字バッファ消化関数 ---
  function flushRomajiBuffer(buffer, pairs) {
    let outKana = "";
    let rest = String(buffer || "").toLowerCase().replace(/[^a-z\-]/g, "");
    while (rest.length) {
      let matched = false;
      for (let i = 0; i < pairs.length; i++) {
        const pat = pairs[i][0];
        const kana = pairs[i][1];
        if (rest.startsWith(pat)) {
          outKana += kana;
          rest = rest.slice(pat.length);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      // 'n' の後に母音・y以外の子音が来た場合は 'ん' として確定
      if (rest.length >= 2 && rest.charAt(0) === "n") {
        const c2 = rest.charAt(1);
        if ("aeiouy".indexOf(c2) < 0 && c2 !== "n") {
          outKana += "ん";
          rest = rest.slice(1);
          continue;
        }
      }
      break;
    }
    return { kana: outKana, rest: rest };
  }

  // --- ひらがな ⇔ カタカナ 相互変換 ---
  function swapHiraKataString(str) {
    return Array.from(String(str || ""))
      .map(ch => {
        const c = ch.codePointAt(0);
        if (c >= 0x3041 && c <= 0x3096) return String.fromCodePoint(c + 0x60); // ひらがな→カタカナ
        if (c >= 0x30a1 && c <= 0x30f6) return String.fromCodePoint(c - 0x60); // カタカナ→ひらがな
        return ch;
      })
      .join("");
  }

  // ひらがなを指定スクリプト(kun: ひらがな, on: カタカナ)へ
  function hiraToScript(hira, scriptKind) {
    if (scriptKind === "on") {
      return Array.from(String(hira || ""))
        .map(ch => {
          const c = ch.codePointAt(0);
          if (c >= 0x3041 && c <= 0x3096) return String.fromCodePoint(c + 0x60);
          return ch;
        })
        .join("");
    }
    return String(hira || "");
  }

  // --- 濁点・半濁点の後付け結合 ---
  function applyDakutenToLast(targetInput, mark) {
    if (!targetInput || !targetInput.value) return false;
    const dakuten = {
      か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご",
      さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ",
      た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど",
      は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ",
      う: "ゔ",
      カ: "ガ", キ: "ギ", ク: "グ", ケ: "ゲ", コ: "ゴ",
      サ: "ザ", シ: "ジ", ス: "ズ", セ: "ゼ", ソ: "ゾ",
      タ: "ダ", チ: "ヂ", ツ: "ヅ", テ: "デ", ト: "ド",
      ハ: "バ", ヒ: "ビ", フ: "ブ", ヘ: "ベ", ホ: "ボ",
      ウ: "ヴ"
    };
    const handakuten = {
      は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ",
      ハ: "パ", ヒ: "ピ", フ: "プ", ヘ: "ペ", ホ: "ポ"
    };
    const map = mark === "゜" ? handakuten : dakuten;
    const chars = Array.from(targetInput.value);
    const last = chars[chars.length - 1];
    if (map[last]) {
      chars[chars.length - 1] = map[last];
      targetInput.value = chars.join("");
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }

  // JIS ひらがな配列（106/109準拠）
  const JIS_KBD_LAYOUT = [
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

  // QWERTY 配列
  const QWERTY_YOMI_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", "-"]
  ];

  // 英語用 配列
  const ENGLISH_ROWS = [
    ['!', '"', '$', '%', '&', "'", '(', ')', '-', '¥'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?']
  ];

  /**
   * タッチ最適化用キーイベントバインド関数
   * pointerdownで即座に実行し、clickはpreventDefaultで抑制
   */
  function bindKey(btn, onAction) {
    btn.addEventListener('pointerdown', function (ev) {
      if (btn.disabled) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      ev.preventDefault();
      onAction(ev);
    });
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
    });
  }

  function resolveElement(elOrSelector) {
    if (typeof elOrSelector === 'string') {
      return document.querySelector(elOrSelector);
    }
    return elOrSelector;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- メインクラス ---
  const VirtualKeyboard = {
    /**
     * 英語キーボードを描画する
     * @param {Object} options
     *   - container: string | HTMLElement (必須)
     *   - targetInput: string | HTMLElement (対象のinput/textarea)
     *   - scale: number (拡大率、デフォルト: 1.0)
     *   - fontSize: number (フォントサイズpx、デフォルト: 18)
     *   - actionLabel: string (決定ボタンのテキスト、デフォルト: 'けってい')
     *   - showSpace: boolean (Spaceボタンの有無、デフォルト: true)
     *   - onEnter: function (決定押下時のコールバック)
     *   - onInput: function (文字入力時のコールバック)
     */
    renderEnglish: function (options) {
      options = options || {};
      const container = resolveElement(options.container);
      if (!container) return null;
      container.innerHTML = "";

      const targetInput = resolveElement(options.targetInput);
      const scale = options.scale || 1.0;
      const fontPx = options.fontSize || 18;
      const padPx = Math.max(8, Math.round(fontPx * 0.72));
      const actionLabel = options.actionLabel !== undefined ? options.actionLabel : "けってい";

      const wrap = document.createElement('div');
      wrap.className = 'keyboard-scale-wrap vk-scale-wrap';
      wrap.style.setProperty('--kb-scale', String(scale));
      wrap.style.setProperty('--vk-font-px', String(fontPx));
      wrap.style.setProperty('--vk-pad-px', String(padPx));

      const board = document.createElement('div');
      board.className = 'keyboard vk-keyboard';

      // Shift状態管理
      let shiftMode = 0; // 0: 小文字, 1: 1文字大文字, 2: CapsLock
      let isShiftHoldMode = false;
      let shiftPressStartTime = 0;
      let shiftTimer1s = null;
      let shiftTimer2s = null;

      function updateKeyboardDisplay() {
        const isUpper = shiftMode > 0 || isShiftHoldMode;
        const shiftBtn = wrap.querySelector('.vk-shift-btn');
        if (shiftBtn) {
          shiftBtn.classList.remove('vk-shift-1', 'vk-shift-2');
          if (shiftMode === 2) {
            shiftBtn.innerText = '⇪';
            shiftBtn.style.background = '#FF9800';
            shiftBtn.classList.add('vk-shift-2');
          } else if (shiftMode === 1 || isShiftHoldMode) {
            shiftBtn.innerText = '⇧';
            shiftBtn.style.background = '#e50914';
            shiftBtn.classList.add('vk-shift-1');
          } else {
            shiftBtn.innerText = '⇧';
            shiftBtn.style.background = '#444444';
          }
        }
        wrap.querySelectorAll('.key-char').forEach(btn => {
          const baseChar = btn.getAttribute('data-char');
          if (/[a-z]/.test(baseChar)) {
            btn.innerText = isUpper ? baseChar.toUpperCase() : baseChar;
          }
        });
      }

      function appendChar(char) {
        if (!targetInput) return;
        targetInput.value += char;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof options.onInput === 'function') options.onInput(char, targetInput.value);
      }

      function backspace() {
        if (!targetInput) return;
        if (targetInput.value.length > 0) {
          targetInput.value = targetInput.value.slice(0, -1);
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (typeof options.onInput === 'function') options.onInput('', targetInput.value);
        }
      }

      function flashKey(selector) {
        if (!wrap) return;
        const b = wrap.querySelector(selector);
        if (b) {
          b.classList.add('vk-active-flash');
          setTimeout(() => b.classList.remove('vk-active-flash'), 120);
        }
      }

      function pressChar(char) {
        const isUpper = shiftMode > 0 || isShiftHoldMode;
        let c = char;
        if (/[a-z]/i.test(char)) {
          c = isUpper ? char.toUpperCase() : char.toLowerCase();
          flashKey('.key-char[data-char="' + char.toLowerCase() + '"]');
        } else {
          flashKey('.vk-key[data-char="' + char + '"]');
        }
        appendChar(c);
        if (shiftMode === 1) {
          shiftMode = 0;
          updateKeyboardDisplay();
        }
      }

      function pressBackspace() {
        flashKey('[data-action="backspace"]');
        backspace();
      }

      function pressEnter() {
        flashKey('[data-action="enter"]');
        if (typeof options.onEnter === 'function') {
          options.onEnter(targetInput ? targetInput.value : '');
        }
      }

      function pressSpace() {
        flashKey('[data-action="space"]');
        appendChar(' ');
      }

      ENGLISH_ROWS.forEach((row, rIdx) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'key-row vk-row';

        // 4行目左端: Shiftキー
        if (rIdx === 3) {
          const shiftBtn = document.createElement('button');
          shiftBtn.type = 'button';
          shiftBtn.className = 'key key-wide vk-key vk-key-wide vk-shift-btn';
          shiftBtn.innerText = '⇧';

          shiftBtn.onpointerdown = (e) => {
            e.preventDefault();
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (shiftPressStartTime > 0) return;
            shiftPressStartTime = Date.now();
            shiftTimer1s = setTimeout(() => {
              if (shiftBtn && !isShiftHoldMode) {
                shiftBtn.style.background = '#FF9800';
                shiftBtn.innerText = '⇪';
              }
            }, 1000);
            shiftTimer2s = setTimeout(() => {
              isShiftHoldMode = true;
              shiftMode = 0;
              updateKeyboardDisplay();
            }, 2000);
          };

          const handlePointerUp = (e) => {
            e.preventDefault();
            if (shiftPressStartTime === 0) return;
            clearTimeout(shiftTimer1s);
            clearTimeout(shiftTimer2s);
            const duration = Date.now() - shiftPressStartTime;
            shiftPressStartTime = 0;
            if (isShiftHoldMode) {
              isShiftHoldMode = false;
              shiftMode = 0;
            } else if (duration >= 1000) {
              shiftMode = (shiftMode === 2) ? 0 : 2;
            } else if (duration > 0 && duration < 1000) {
              shiftMode = (shiftMode === 1 || shiftMode === 2) ? 0 : 1;
            }
            updateKeyboardDisplay();
          };

          shiftBtn.onpointerup = handlePointerUp;
          shiftBtn.onpointerleave = handlePointerUp;
          shiftBtn.onpointercancel = handlePointerUp;
          shiftBtn.oncontextmenu = (e) => { e.preventDefault(); return false; };
          rowDiv.appendChild(shiftBtn);
        }

        row.forEach(char => {
          const keyBtn = document.createElement('button');
          keyBtn.type = 'button';
          keyBtn.innerText = char;
          if (/[a-z]/.test(char)) {
            keyBtn.className = 'key key-char vk-key';
            keyBtn.setAttribute('data-char', char);
          } else {
            keyBtn.className = 'key vk-key';
          }

          bindKey(keyBtn, () => {
            const isUpper = shiftMode > 0 || isShiftHoldMode;
            let inputChar = char;
            if (/[a-z]/.test(char) && isUpper) inputChar = char.toUpperCase();
            appendChar(inputChar);
            if (shiftMode === 1) {
              shiftMode = 0;
              updateKeyboardDisplay();
            }
          });
          rowDiv.appendChild(keyBtn);
        });

        // 4行目右端: Backspaceキー
        if (rIdx === 3) {
          const bsBtn = document.createElement('button');
          bsBtn.type = 'button';
          bsBtn.className = 'key key-wide vk-key vk-key-wide';
          bsBtn.setAttribute('data-action', 'backspace');
          bsBtn.innerText = '⌫';
          bindKey(bsBtn, backspace);
          rowDiv.appendChild(bsBtn);
        }
        board.appendChild(rowDiv);
      });

      // 最下段: Space & 決定ボタン
      const bottomRow = document.createElement('div');
      bottomRow.className = 'key-row vk-row';

      if (options.showSpace !== false) {
        const spaceBtn = document.createElement('button');
        spaceBtn.type = 'button';
        spaceBtn.className = 'key vk-key';
        spaceBtn.setAttribute('data-action', 'space');
        spaceBtn.style.flex = "3";
        spaceBtn.innerText = "Space";
        bindKey(spaceBtn, () => appendChar(" "));
        bottomRow.appendChild(spaceBtn);
      }

      if (actionLabel) {
        const enterBtn = document.createElement('button');
        enterBtn.type = 'button';
        enterBtn.className = 'key key-action vk-key vk-key-action';
        enterBtn.setAttribute('data-action', 'enter');
        enterBtn.innerText = actionLabel;
        bindKey(enterBtn, () => {
          if (typeof options.onEnter === 'function') {
            options.onEnter(targetInput ? targetInput.value : '');
          }
        });
        bottomRow.appendChild(enterBtn);
      }

      board.appendChild(bottomRow);
      wrap.appendChild(board);
      container.appendChild(wrap);
      updateKeyboardDisplay();

      return {
        wrap: wrap,
        updateDisplay: updateKeyboardDisplay,
        pressChar: pressChar,
        backspace: pressBackspace,
        enter: pressEnter,
        space: pressSpace,
        setScale: (sc) => wrap.style.setProperty('--kb-scale', String(sc)),
        setFontSize: (fs) => {
          wrap.style.setProperty('--vk-font-px', String(fs));
          wrap.style.setProperty('--vk-pad-px', String(Math.max(8, Math.round(fs * 0.72))));
        }
      };
    },

    /**
     * 日本語（漢字読み仮名・ローマ字/JISかな）キーボードを描画する
     * @param {Object} options
     *   - container: string | HTMLElement (必須)
     *   - targetInput: string | HTMLElement (対象のinput/textarea)
     *   - layout: 'qwerty' | 'jis' (デフォルト: 'qwerty')
     *   - allowLayoutSwitch: boolean (QWERTY/JIS切り替えボタンを表示するか、デフォルト: true)
     *   - scale: number (拡大率、デフォルト: 1.0)
     *   - fontSize: number (フォントサイズpx、デフォルト: 18)
     *   - actionLabel: string (決定ボタンのテキスト、デフォルト: 'けってい')
     *   - onEnter: function (決定押下時のコールバック)
     *   - onInput: function (文字入力時のコールバック)
     */
    renderJapanese: function (options) {
      options = options || {};
      const container = resolveElement(options.container);
      if (!container) return null;
      container.innerHTML = "";

      const targetInput = resolveElement(options.targetInput);
      let kbdLayout = options.layout === "jis" ? "jis" : "qwerty";
      const allowSwitch = options.allowLayoutSwitch !== false;
      const scale = options.scale || 1.0;
      const fontPx = options.fontSize || 18;
      const padPx = Math.max(8, Math.round(fontPx * 0.72));
      const actionLabel = options.actionLabel !== undefined ? options.actionLabel : "けってい";

      // 状態管理
      let romajiTail = ""; // 入力中ローマ字バッファ
      let currentScriptKind = "kun"; // 'kun': ひらがな, 'on': カタカナ
      const pairs = getRomajiPairs();

      const wrap = document.createElement("div");
      wrap.className = "keyboard-scale-wrap vk-scale-wrap";
      wrap.style.setProperty("--kb-scale", String(scale));
      wrap.style.setProperty("--vk-font-px", String(fontPx));
      wrap.style.setProperty("--vk-pad-px", String(padPx));

      // レイアウト切り替えヘッダー
      if (allowSwitch) {
        const layoutRow = document.createElement("div");
        layoutRow.className = "kanji-yomi-kbd-layout-row vk-layout-row";
        layoutRow.setAttribute("role", "group");

        function makeLayoutBtn(label, mode) {
          const b = document.createElement("button");
          b.type = "button";
          const isActive = kbdLayout === mode;
          b.className = "kanji-yomi-kbd-layout-btn vk-layout-btn" + (isActive ? " is-active" : "");
          b.textContent = label;
          b.addEventListener("click", (ev) => {
            ev.preventDefault();
            if (kbdLayout === mode) return;
            kbdLayout = mode;
            options.layout = mode;
            VirtualKeyboard.renderJapanese(options);
          });
          return b;
        }

        layoutRow.appendChild(makeLayoutBtn("QWERTY（ローマ字）", "qwerty"));
        layoutRow.appendChild(makeLayoutBtn("JIS ひらがな", "jis"));
        wrap.appendChild(layoutRow);
      }

      // ガイド表示
      const hint = document.createElement("div");
      hint.className = "kanji-yomi-kbd-hint vk-hint";
      hint.textContent = kbdLayout === "jis"
        ? "JIS 配列：キーをタップしてひらがなを入力。左上の薄い文字は QWERTY 上の位置です。"
        : "ローマ字 → ひらがな で入力されます。カタカナで答える場合は「かな⇔カナ」ボタンで切替を。";
      wrap.appendChild(hint);

      // ローマ字入力中のプレビュー
      const tailHint = document.createElement("div");
      tailHint.className = "kanji-yomi-kbd-tail-hint vk-tail-hint";
      tailHint.style.display = kbdLayout === "jis" ? "none" : "";
      tailHint.innerHTML = '<span style="color:#666;">入力中:</span> <span class="vk-tail-val">―</span>';
      wrap.appendChild(tailHint);

      function updateTailDisplay() {
        const valEl = tailHint.querySelector('.vk-tail-val');
        if (valEl) valEl.textContent = romajiTail ? romajiTail : "―";
      }

      const board = document.createElement("div");
      board.className = "keyboard vk-keyboard" + (kbdLayout === "jis" ? " kbd-jis" : " kbd-qwerty");

      function applyChar(lower) {
        if (!targetInput) return;
        if (lower === "-") {
          // カタカナ時は長音符
          targetInput.value += "ー";
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          updateTailDisplay();
          if (typeof options.onInput === 'function') options.onInput("ー", targetInput.value);
          return;
        }
        if (!/^[a-z]$/.test(lower)) return;
        romajiTail += lower;
        const fl = flushRomajiBuffer(romajiTail, pairs);
        const piece = hiraToScript(fl.kana, currentScriptKind);
        romajiTail = fl.rest;
        if (piece) {
          targetInput.value += piece;
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          if (typeof options.onInput === 'function') options.onInput(piece, targetInput.value);
        }
        updateTailDisplay();
      }

      function applyJisKana(kana) {
        if (!targetInput || !kana) return;
        const piece = hiraToScript(kana, currentScriptKind);
        targetInput.value += piece;
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof options.onInput === 'function') options.onInput(piece, targetInput.value);
      }

      function applyJisKey(keyDef) {
        if (!targetInput || !keyDef) return;
        const kana = String(keyDef.kana || "");
        if (kana === "゛") {
          if (!applyDakutenToLast(targetInput, "゛")) applyJisKana("゛");
          return;
        }
        if (kana === "゜") {
          if (!applyDakutenToLast(targetInput, "゜")) applyJisKana("゜");
          return;
        }
        applyJisKana(kana);
      }

      function backspaceKey() {
        if (!targetInput) return;
        if (romajiTail.length > 0) {
          romajiTail = romajiTail.slice(0, -1);
          updateTailDisplay();
          return;
        }
        if (targetInput.value.length > 0) {
          targetInput.value = targetInput.value.slice(0, -1);
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          if (typeof options.onInput === 'function') options.onInput('', targetInput.value);
        }
      }

      function finalizeN() {
        if (!targetInput) return;
        if (romajiTail === "n") {
          const piece = hiraToScript("ん", currentScriptKind);
          targetInput.value += piece;
          romajiTail = "";
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          updateTailDisplay();
          if (typeof options.onInput === 'function') options.onInput(piece, targetInput.value);
        }
      }

      function toggleScriptKind() {
        if (!targetInput) return;
        targetInput.value = swapHiraKataString(targetInput.value);
        currentScriptKind = currentScriptKind === "on" ? "kun" : "on";
        refreshScriptBtn();
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        updateTailDisplay();
      }

      // JIS 配列の組み立て
      if (kbdLayout === "jis") {
        JIS_KBD_LAYOUT.forEach((row, ri) => {
          const rowDiv = document.createElement("div");
          rowDiv.className = "key-row key-row-jis vk-row vk-row-jis";
          row.forEach(keyDef => {
            const keyBtn = document.createElement("button");
            keyBtn.type = "button";
            keyBtn.className = "key key-dual-label vk-key vk-key-dual";
            const sub = String(keyDef.sub || "").trim();
            if (sub) {
              keyBtn.innerHTML = '<span class="kj-kbd-sub vk-sub">' + escapeHtml(sub) + '</span><span class="kj-kbd-main vk-main">' + escapeHtml(keyDef.kana) + '</span>';
            } else {
              keyBtn.innerHTML = '<span class="kj-kbd-main kj-kbd-main-only vk-main">' + escapeHtml(keyDef.kana) + '</span>';
            }
            bindKey(keyBtn, () => applyJisKey(keyDef));
            rowDiv.appendChild(keyBtn);
          });
          board.appendChild(rowDiv);
        });
      } else {
        // QWERTY 配列の組み立て
        QWERTY_YOMI_ROWS.forEach(row => {
          const rowDiv = document.createElement("div");
          rowDiv.className = "key-row vk-row";
          row.forEach(ch => {
            const keyBtn = document.createElement("button");
            keyBtn.type = "button";
            keyBtn.className = "key vk-key";
            keyBtn.textContent = ch;
            keyBtn.setAttribute('data-char', ch.toLowerCase());
            bindKey(keyBtn, () => {
              if (/^[a-z]$/i.test(ch)) applyChar(ch.toLowerCase());
              else if (ch === "-") applyChar("-");
            });
            rowDiv.appendChild(keyBtn);
          });
          board.appendChild(rowDiv);
        });
      }

      // 操作行: かな ⇔ カナ トグル ＆ Backspace
      const rowBs = document.createElement("div");
      rowBs.className = "key-row vk-row";

      const scriptBtn = document.createElement("button");
      scriptBtn.type = "button";
      scriptBtn.className = "key key-wide vk-key vk-key-wide vk-script-btn";

      function refreshScriptBtn() {
        scriptBtn.classList.remove("vk-script-kun", "vk-script-on");
        if (currentScriptKind === "on") {
          scriptBtn.classList.add("vk-script-on");
          scriptBtn.innerHTML = '<span style="font-size:0.85em;color:#fff;opacity:0.95;">いま:カナ</span><br>かな ⇔ カナ';
          scriptBtn.style.background = "#ff8a65";
          scriptBtn.title = "現在カタカナ入力。タップでひらがなに切替（入力済みも相互変換）";
        } else {
          scriptBtn.classList.add("vk-script-kun");
          scriptBtn.innerHTML = '<span style="font-size:0.85em;color:#fff;opacity:0.95;">いま:かな</span><br>かな ⇔ カナ';
          scriptBtn.style.background = "#42a5f5";
          scriptBtn.title = "現在ひらがな入力。タップでカタカナに切替（入力済みも相互変換）";
        }
      }
      refreshScriptBtn();
      bindKey(scriptBtn, toggleScriptKind);
      rowBs.appendChild(scriptBtn);

      const bsBtn = document.createElement("button");
      bsBtn.type = "button";
      bsBtn.className = "key key-wide vk-key vk-key-wide";
      bsBtn.setAttribute('data-action', 'backspace');
      bsBtn.textContent = "⌫";
      bindKey(bsBtn, backspaceKey);
      rowBs.appendChild(bsBtn);
      board.appendChild(rowBs);

      // 最下段: 決定ボタン
      if (actionLabel) {
        const bottomRow = document.createElement("div");
        bottomRow.className = "key-row vk-row";
        const enterBtn = document.createElement("button");
        enterBtn.type = "button";
        enterBtn.className = "key key-action vk-key vk-key-action";
        enterBtn.setAttribute('data-action', 'enter');
        enterBtn.style.flex = "1";
        enterBtn.textContent = actionLabel;
        bindKey(enterBtn, () => {
          finalizeN();
          if (typeof options.onEnter === "function") {
            options.onEnter(targetInput ? targetInput.value : "");
          }
        });
        bottomRow.appendChild(enterBtn);
        board.appendChild(bottomRow);
      }

      wrap.appendChild(board);
      container.appendChild(wrap);
      updateTailDisplay();

      const JIS_FLAT_MAP = {};
      JIS_KBD_LAYOUT.forEach(r => {
        r.forEach(k => {
          if (k.sub) JIS_FLAT_MAP[k.sub.toLowerCase()] = k;
        });
      });

      function flashKey(selector) {
        if (!wrap) return;
        const b = wrap.querySelector(selector);
        if (b) {
          b.classList.add('vk-active-flash');
          setTimeout(() => b.classList.remove('vk-active-flash'), 120);
        }
      }

      function pressChar(char) {
        const lower = char.toLowerCase();
        flashKey('[data-char="' + lower + '"]');
        if (kbdLayout === "jis") {
          const found = JIS_FLAT_MAP[lower];
          if (found) applyJisKey(found);
          else if (/^[a-z\-]$/.test(lower)) applyChar(lower);
        } else {
          applyChar(lower);
        }
      }

      function pressBackspace() {
        flashKey('[data-action="backspace"]');
        backspaceKey();
      }

      function pressEnter() {
        flashKey('[data-action="enter"]');
        finalizeN();
        if (typeof options.onEnter === "function") {
          options.onEnter(targetInput ? targetInput.value : "");
        }
      }

      function pressSpace() {
        finalizeN();
        if (targetInput) {
          targetInput.value += " ";
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          if (typeof options.onInput === 'function') options.onInput(" ", targetInput.value);
        }
      }

      return {
        wrap: wrap,
        finalizeN: finalizeN,
        toggleScript: toggleScriptKind,
        pressChar: pressChar,
        backspace: pressBackspace,
        enter: pressEnter,
        space: pressSpace,
        setScale: (sc) => wrap.style.setProperty('--kb-scale', String(sc)),
        setFontSize: (fs) => {
          wrap.style.setProperty('--vk-font-px', String(fs));
          wrap.style.setProperty('--vk-pad-px', String(Math.max(8, Math.round(fs * 0.72))));
        }
      };
    }
  };

  return VirtualKeyboard;
});


/* ==========================================================================
   ⌨️ AppKeyboard: ゲーム連携コントローラー
   ========================================================================== */
window.AppKeyboard = {
  currentMode: 'english',
  scale: 1.0,
  fontSize: 18,
  activeInstance: null,
  customTarget: null,
  _initialized: false,

  setMode(mode) {
    if (this.currentMode === mode && this.activeInstance) return;
    this.currentMode = mode;
    const modeTabs = document.querySelectorAll('.vk-tab-btn');
    modeTabs.forEach(b => {
      if (b.dataset.vkMode === mode) b.classList.add('active');
      else b.classList.remove('active');
    });
    this.render();
  },

  sendKey(code, key, shiftKey) {
    if (!this.activeInstance) return false;
    // Backspace
    if (code === 'Backspace' || key === 'Backspace') {
      if (this.activeInstance.backspace) {
        this.activeInstance.backspace();
        if (typeof se === 'function') se('select');
        return true;
      }
      return false;
    }
    // Enter
    if (code === 'Enter' || key === 'Enter') {
      if (this.activeInstance.enter) {
        this.activeInstance.enter();
        return true;
      }
      return false;
    }
    // Space
    if (code === 'Space' || key === ' ' || key === 'Spacebar') {
      if (this.activeInstance.space) {
        this.activeInstance.space();
        if (typeof se === 'function') se('select');
        return true;
      }
      return false;
    }
    // 文字キー
    let char = null;
    if (code && code.startsWith('Key')) {
      char = code.slice(3).toLowerCase();
      if (shiftKey && this.currentMode === 'english') char = char.toUpperCase();
    } else if (code && code.startsWith('Digit')) {
      char = code.slice(5);
    } else if (code === 'Minus' || key === '-') {
      char = '-';
    } else if (code === 'Quote' || key === "'" || key === '"') {
      char = "'";
    } else if (key && /^[a-zA-Z0-9\-']$/.test(key)) {
      char = (shiftKey && this.currentMode === 'english') ? key.toUpperCase() : key.toLowerCase();
    }

    if (char && this.activeInstance.pressChar) {
      this.activeInstance.pressChar(char);
      if (typeof se === 'function') se('select');
      return true;
    }
    return false;
  },

  init() {
    if (this._initialized) return;
    this._initialized = true;

    const overlay = document.getElementById('keyboardOverlay');
    const mountPoint = document.getElementById('vkMountPoint');
    const previewInput = document.getElementById('vkPreviewInput');
    const floatToggle = document.getElementById('vkFloatingToggle');
    const minBtn = document.getElementById('vkMinBtn');
    const clearBtn = document.getElementById('vkClearBtn');
    const sizeUpBtn = document.getElementById('vkSizeUpBtn');
    const sizeDownBtn = document.getElementById('vkSizeDownBtn');
    const modeTabs = document.querySelectorAll('.vk-tab-btn');

    if (!overlay || !mountPoint) return;

    modeTabs.forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        modeTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.vkMode;
        this.render();
      });
    });

    if (minBtn) {
      minBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.hide();
      });
    }
    if (floatToggle) {
      floatToggle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.show();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const tgt = this.getTargetInput();
        if (tgt) {
          tgt.value = '';
          tgt.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (previewInput && previewInput !== tgt) {
          previewInput.value = '';
        }
      });
    }

    if (sizeDownBtn) {
      sizeDownBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.fontSize = Math.max(14, this.fontSize - 2);
        this.scale = Math.max(0.7, +(this.scale - 0.1).toFixed(1));
        if (this.activeInstance) {
          this.activeInstance.setFontSize(this.fontSize);
          this.activeInstance.setScale(this.scale);
        }
      });
    }
    if (sizeUpBtn) {
      sizeUpBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.fontSize = Math.min(26, this.fontSize + 2);
        this.scale = Math.min(1.5, +(this.scale + 0.1).toFixed(1));
        if (this.activeInstance) {
          this.activeInstance.setFontSize(this.fontSize);
          this.activeInstance.setScale(this.scale);
        }
      });
    }

    this.render();
    this.hide();
  },

  getTargetInput() {
    if (this.customTarget && document.body.contains(this.customTarget)) {
      return this.customTarget;
    }
    const qin = document.getElementById('qin');
    if (qin && document.body.contains(qin) && !qin.disabled) {
      return qin;
    }
    const winp = document.getElementById('winp');
    if (winp && document.body.contains(winp) && !winp.disabled) {
      return winp;
    }
    return document.getElementById('vkPreviewInput');
  },

  setTarget(inputEl) {
    this.customTarget = inputEl;
    const previewInput = document.getElementById('vkPreviewInput');
    if (previewInput && inputEl) {
      previewInput.value = inputEl.value;
    }
    this.render();
  },

  resetTarget() {
    this.customTarget = null;
    this.render();
  },

  show() {
    const overlay = document.getElementById('keyboardOverlay');
    const floatToggle = document.getElementById('vkFloatingToggle');
    if (overlay) overlay.classList.remove('is-minimized');
    if (floatToggle) floatToggle.classList.add('is-hidden');
  },

  hide() {
    const overlay = document.getElementById('keyboardOverlay');
    const floatToggle = document.getElementById('vkFloatingToggle');
    if (overlay) overlay.classList.add('is-minimized');
    if (floatToggle) floatToggle.classList.remove('is-hidden');
  },

  render() {
    const mountPoint = document.getElementById('vkMountPoint');
    const previewInput = document.getElementById('vkPreviewInput');
    if (!mountPoint || typeof VirtualKeyboard === 'undefined') return;

    mountPoint.innerHTML = '';
    const target = this.getTargetInput();

    const handleInput = (piece, full) => {
      if (previewInput && previewInput !== target) {
        previewInput.value = full;
      }
      if (target && target !== previewInput) {
        target.value = full;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const handleEnter = (val) => {
      this.hide();
      this.resetTarget();
      const qform = document.getElementById('qform');
      const wform = document.getElementById('wform');
      if (qform && document.body.contains(qform)) {
        qform.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      } else if (wform && document.body.contains(wform)) {
        wform.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      if (typeof se === 'function') se('confirm');
    };

    if (this.currentMode === 'english') {
      this.activeInstance = VirtualKeyboard.renderEnglish({
        container: mountPoint,
        targetInput: target,
        scale: this.scale,
        fontSize: this.fontSize,
        actionLabel: 'けってい',
        onEnter: handleEnter,
        onInput: handleInput
      });
    } else if (this.currentMode === 'japanese-qwerty') {
      this.activeInstance = VirtualKeyboard.renderJapanese({
        container: mountPoint,
        targetInput: target,
        layout: 'qwerty',
        allowLayoutSwitch: false,
        scale: this.scale,
        fontSize: this.fontSize,
        actionLabel: 'けってい',
        onEnter: handleEnter,
        onInput: handleInput
      });
    } else if (this.currentMode === 'japanese-jis') {
      this.activeInstance = VirtualKeyboard.renderJapanese({
        container: mountPoint,
        targetInput: target,
        layout: 'jis',
        allowLayoutSwitch: false,
        scale: this.scale,
        fontSize: this.fontSize,
        actionLabel: 'けってい',
        onEnter: handleEnter,
        onInput: handleInput
      });
    }
  }
};

// 即時初期化トリガー
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.AppKeyboard) window.AppKeyboard.init();
  });
} else {
  if (window.AppKeyboard) window.AppKeyboard.init();
}



/* ==========================================================================
   🏰 塔選択画面 ＆ 画面遷移 ＆ 保護者管理画面連携
   ========================================================================== */
function handleTopBack() {
  if (S && S.screen && (S.screen === "explore" || S.screen === "battle")) {
    if (confirm("塔の選択画面に戻りますか？\n（現在の進行状況はセーブされます）")) {
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
  }
  if (typeof startFloor === "number" && startFloor > 0) {
    startDungeonWithTower(currentTower.id, startFloor, !!isPractice);
  } else {
    backToTowerSelect();
  }
}

function backToTowerSelect() {
  document.body.classList.remove('in-dungeon-game');
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

    return `
      <div class="dungeon-tower-card ${isCleared ? 'best-cleared' : ''}">
        <div>
          <h2 class="dungeon-tower-title">🏰 ${tower.name}</h2>
          <p class="dungeon-tower-desc">${tower.desc || '問題に挑戦して最深階を目指そう！'}</p>
        </div>
        <div class="dungeon-tower-meta">
          <span>最高到達: <b>${rec.best ? '地下 ' + rec.best + ' 階' : '未挑戦'}</b></span>
          <span>最大: <b>${tower.maxFloor || 100}階</b></span>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          ${hasSave ? `<button type="button" class="dungeon-btn" style="flex:1;background:var(--gold);color:#000;font-weight:bold;font-size:13px;padding:6px;" onclick="startDungeonWithTower('${tower.id}')">▶ つづきから（地下 ${rec.save.floor} 階）</button>` : ''}
          <button type="button" class="dungeon-btn" style="flex:1;background:${hasSave ? '#201f30' : 'var(--gold)'};color:${hasSave ? '#fff' : '#000'};font-weight:bold;font-size:13px;padding:6px;" onclick="startDungeonWithTower('${tower.id}', 1, false)">${hasSave ? '最初から' : '⚔️ 挑戦する'}</button>
        </div>
      </div>
    `;
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
  const sec = document.getElementById("section-parent-admin-dungeon");
  if (sec) sec.style.display = "block";
  if (typeof switchSection === "function") {
    switchSection("section-parent-admin-dungeon");
  }
  switchAdminDungeonTab('towers');
  renderAdminTowerList();
}

function exitParentAdminDungeon() {
  if (typeof switchSection === "function") {
    switchSection("section-parent-admin");
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

    return `
      <div style="background:#1b1a2a;border:1px solid #37344f;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:220px;">
          <h3 style="margin:0 0 4px;font-size:16px;color:var(--gold);font-family:var(--game);">🏰 ${tower.name}</h3>
          <p style="margin:0 0 6px;font-size:12px;color:var(--muted);">${tower.desc || '説明なし'}</p>
          <div style="font-size:11px;color:var(--fg);display:flex;gap:12px;flex-wrap:wrap;">
            <span>最大: ${tower.maxFloor || 100}階</span>
            <span>制限時間: ${Math.round((tower.timeMultiplier || 1.0) * 100)}%</span>
            <span>単語: ${vCount}</span>
            <span>表現: ${eCount}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="dungeon-btn" style="font-size:12px;padding:4px 10px;" onclick="openTowerEditModal('${tower.id}')">✏️ 編集</button>
          ${TOWERS.length > 1 ? `<button type="button" class="dungeon-btn" style="font-size:12px;padding:4px 10px;color:var(--danger);border-color:var(--danger);" onclick="deleteTower('${tower.id}')">🗑️ 削除</button>` : ''}
        </div>
      </div>
    `;
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
      return `<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" name="vocab_unit" value="${u}" ${checked ? 'checked' : ''}><span>${u}</span></label>`;
    }).join("");
  }

  const eContainer = document.getElementById("tower-edit-expr-units");
  if (eContainer) {
    eContainer.innerHTML = ALL_EXPR_UNITS.map(u => {
      const checked = !tower.exprUnits || tower.exprUnits.length === 0 || tower.exprUnits.includes(u);
      return `<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" name="expr_unit" value="${u}" ${checked ? 'checked' : ''}><span>${u}</span></label>`;
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

})(typeof window !== "undefined" ? window : this);
