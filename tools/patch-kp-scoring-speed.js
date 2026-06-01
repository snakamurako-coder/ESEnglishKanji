/**
 * KP_HTML: 高速 populate + KanjiVG 優先読込
 * index.html: 採点準備がデータ無しで成功扱いになる不具合を修正
 */
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
let idx = fs.readFileSync(indexPath, "utf8");
const lines = idx.split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
if (lineIdx < 0) throw new Error("window.KP_HTML line not found");

const prefix = "window.KP_HTML = ";
const o = JSON.parse(lines[lineIdx].slice(prefix.length).replace(/;\s*$/, ""));
let h = o.value;

const oldPopulate = `function populateKanjiSelector() {
    const select = document.getElementById('target-kanji');
    const prevSelected = select && typeof select.value === 'string' ? select.value : '';
    const pending = typeof window.__kpPendingKanjiSelect === 'string' && window.__kpPendingKanjiSelect ? window.__kpPendingKanjiSelect : '';
    const keys = Object.keys(KANJI_DATA);
    select.innerHTML = keys.length ? keys.map(k => \`<option value="\${k}">\${k}</option>\`).join('') : '<option>データなし</option>';
    let restore = '';
    if (pending && keys.indexOf(pending) >= 0) restore = pending;
    else if (prevSelected && keys.indexOf(prevSelected) >= 0) restore = prevSelected;
    if (restore) select.value = restore;
    if (pending && keys.indexOf(pending) >= 0) {
      try { delete window.__kpPendingKanjiSelect; } catch (_kpDel) { window.__kpPendingKanjiSelect = ''; }
    }
    initTargetKanji();
    notifyParentKanjiDataReady();
  }`;

const newPopulate = `function populateKanjiSelector() {
    const select = document.getElementById('target-kanji');
    if (!select) return;
    const prevSelected = select && typeof select.value === 'string' ? select.value : '';
    const pending = typeof window.__kpPendingKanjiSelect === 'string' && window.__kpPendingKanjiSelect ? window.__kpPendingKanjiSelect : '';
    let want = '';
    if (pending && KANJI_DATA[pending]) want = pending;
    else if (prevSelected && KANJI_DATA[prevSelected]) want = prevSelected;
    if (pending && KANJI_DATA[pending]) {
      try { delete window.__kpPendingKanjiSelect; } catch (_kpDel) { window.__kpPendingKanjiSelect = ''; }
    }
    if (want) {
      let has = false;
      for (let i = 0; i < select.options.length; i++) {
        if (String(select.options[i].value) === want) { has = true; break; }
      }
      if (!has) {
        const op = document.createElement('option');
        op.value = want;
        op.textContent = want;
        select.appendChild(op);
      }
      select.value = want;
      initTargetKanji();
    } else if (!select.options.length) {
      select.innerHTML = '<option value="">—</option>';
    }
    notifyParentKanjiDataReady();
  }`;

if (!h.includes(oldPopulate)) {
  if (h.includes("select.innerHTML = keys.length ? keys.map")) {
    throw new Error("populateKanjiSelector shape changed; update patch script");
  }
  console.log("populateKanjiSelector already patched or missing");
} else {
  h = h.replace(oldPopulate, newPopulate);
  console.log("populateKanjiSelector -> lazy options");
}

const oldOnloadIife =
  "var _kjpPrev = window.onload;\n      window.onload = function() {\n        if (typeof _kjpPrev === \"function\") _kjpPrev();\n        updateProfileSelectUI();\n        if (typeof window.loadKanjiData === \"function\") {\n          window.loadKanjiData();\n        } else {\n          showLoading(false);\n        }\n      };\n    })();";

const newOnloadIife =
  "var _kjpPrev = window.onload;\n      window.onload = function() {\n        updateProfileSelectUI();\n        function _kpSheetInit() { if (typeof _kjpPrev === \"function\") _kjpPrev(); }\n        if (typeof window.loadKanjiData === \"function\") {\n          var _kpP = window.loadKanjiData();\n          if (_kpP && typeof _kpP.then === \"function\") {\n            _kpP.then(_kpSheetInit).catch(_kpSheetInit);\n          } else {\n            _kpSheetInit();\n          }\n        } else {\n          _kpSheetInit();\n          showLoading(false);\n        }\n      };\n    })();";

if (h.includes(oldOnloadIife)) {
  h = h.replace(oldOnloadIife, newOnloadIife);
  console.log("onload: KanjiVG fetch before GAS init");
} else if (!h.includes("_kpSheetInit")) {
  throw new Error("onload IIFE not found");
}

o.value = h;
lines[lineIdx] = prefix + JSON.stringify(o) + ";";
idx = lines.join("\n");

// ensureKanjiPracticeFrameReady: タイムアウト時にデータ無しなら ok:false
const oldTimeout =
  `            if (n >= POLL_MAX) {
              kpDismissIframeLoadingOverlay(win);
              finish({ ok: true, slow: true });
            }`;
const newTimeout =
  `            if (n >= POLL_MAX) {
              kpDismissIframeLoadingOverlay(win);
              finish({ ok: kanjiFrameHasVgData(win), slow: true });
            }`;
if (idx.includes(oldTimeout)) {
  idx = idx.replace(oldTimeout, newTimeout);
  console.log("ensureKanjiPracticeFrameReady: fail when no VG data on timeout");
} else if (!idx.includes("finish({ ok: kanjiFrameHasVgData(win), slow: true })")) {
  throw new Error("POLL_MAX timeout block not found");
}

// 採点 postMessage: referenceStrokes が無いときは 0 点を返す
const oldEvalBlock =
  '          "if(typeof initTargetKanji===\\"function\\")initTargetKanji();" +\n' +
  '          "}" +\n' +
  '          "userStrokes=d.strokes.map(function(s){return{type:(s&&s.type)||\\"tome\\"';
const newEvalBlock =
  '          "if(typeof initTargetKanji===\'function\')initTargetKanji();" +\n' +
  '          "}" +\n' +
  '          "if(!referenceStrokes||!referenceStrokes.length){if(window.parent)window.parent.postMessage({type:\\"kanjiQuizScored\\",score:0},\\"*\\");return;}" +\n' +
  '          "userStrokes=d.strokes.map(function(s){return{type:(s&&s.type)||\\"tome\\"';

if (idx.includes(oldEvalBlock)) {
  idx = idx.replace(oldEvalBlock, newEvalBlock);
  console.log("quiz postMessage: guard empty referenceStrokes");
} else if (!idx.includes("!referenceStrokes||!referenceStrokes.length")) {
  throw new Error("patchKanjiFrameForQuizPostMessage block not found");
}

// 採点ボタン: VG データ確認
const oldPostEval = `        ensureKanjiFrameForQuizEval();
        if (!postEvalToFrame()) {`;
const newPostEval = `        ensureKanjiFrameForQuizEval();
        const _evalWin = frame && frame.contentWindow;
        if (!_evalWin || !kanjiFrameHasVgData(_evalWin)) {
          setKanjiQuizHandSubmitBusy(false);
          alertKanjiVgLoadFailed();
          return;
        }
        if (!postEvalToFrame()) {`;
if (idx.includes(oldPostEval) && !idx.includes("_evalWin")) {
  idx = idx.replace(oldPostEval, newPostEval);
  console.log("kanjiQuizRunHandwritingAnswer: require VG data");
}

const verMatch = idx.match(/const KP_EMBED_VER = "(\d+)"/);
if (verMatch) {
  const next = String(parseInt(verMatch[1], 10) + 1);
  idx = idx.replace(/const KP_EMBED_VER = "\d+"/, `const KP_EMBED_VER = "${next}"`);
  console.log("KP_EMBED_VER ->", next);
}

fs.writeFileSync(indexPath, idx, "utf8");
console.log("patch-kp-scoring-speed.js done");
