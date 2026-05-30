/**
 * Patches window.KP_HTML in index.html (KanjiVG load + selector + messages).
 */
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
if (lineIdx < 0) throw new Error("window.KP_HTML line not found");

const prefix = "window.KP_HTML = ";
const jsonStr = lines[lineIdx].slice(prefix.length).replace(/;\s*$/, "");
const o = JSON.parse(jsonStr);
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

if (!h.includes(oldPopulate)) throw new Error("populateKanjiSelector block not found");
h = h.replace(oldPopulate, newPopulate);

const sheetBlock = /  function loadKanjiDataFromSheet\(\) \{[\s\S]*?  \}\n\n  function notifyParentKanjiDataReady/;
if (!sheetBlock.test(h)) throw new Error("loadKanjiDataFromSheet block not found");
h = h.replace(sheetBlock, "\n  function notifyParentKanjiDataReady");

h = h.replace(/showLoading\(true, "KanjiVG\.txt \?\?\?\.\.\."\);/g, 'showLoading(true, "KanjiVG.txt を読込中...");');
h = h.replace(/throw new Error\("TSV\?\?\?\?\?\?\?\?\?"\);/g, 'throw new Error("TSVに有効な行がありません");');
h = h.replace(
  /alert\("KanjiVG\.txt \?\?\?\?\?\?: " \+ \(e && e\.message \? e\.message : e\)\);/g,
  'alert("KanjiVG.txt の読み込みに失敗: " + (e && e.message ? e.message : e));'
);

const iifeOld =
  '(function(){var _kjpPrev=window.onload;window.onload=function(){if(typeof _kjpPrev==="function")_kjpPrev();updateProfileSelectUI();showLoading(true,"初期化中...");window.loadKanjiData();};})();';
const iifeNew =
  '(function(){var _kjpPrev=window.onload;window.onload=function(){if(typeof _kjpPrev==="function")_kjpPrev();updateProfileSelectUI();if(typeof window.loadKanjiData==="function"){window.loadKanjiData();}else{showLoading(false);}};})();';
if (!h.includes(iifeOld)) throw new Error("onload IIFE not found");
h = h.replace(iifeOld, iifeNew);

if (!h.includes("window.kpLookupKanjiPaths")) {
  h = h.replace(
    "function initTargetKanji() {",
    "window.kpLookupKanjiPaths = function(ch) {\n    const c = String(ch || '');\n    return (KANJI_DATA && c && KANJI_DATA[c]) ? KANJI_DATA[c] : null;\n  };\n\n  function initTargetKanji() {"
  );
  h = h.replace(
    "if(!char || !KANJI_DATA[char]) return;",
    "const paths = window.kpLookupKanjiPaths(char);\n    if(!char || !paths) return;"
  );
  h = h.replace(
    "referenceStrokes = KANJI_DATA[char].map(p => {",
    "referenceStrokes = paths.map(p => {"
  );
}

o.value = h;
lines[lineIdx] = prefix + JSON.stringify(o) + ";";
fs.writeFileSync(indexPath, lines.join("\n"), "utf8");
console.log("KP_HTML patched OK");
