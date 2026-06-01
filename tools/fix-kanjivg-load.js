/**
 * Restores KanjiVG.txt fetch override inside KP_HTML (GitHub Pages).
 * Uses absolute KANJI_VG_TXT_URL from parent injection; robust TSV parse.
 */
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
const kanjiVgPath = path.join(__dirname, "..", "KanjiVG.txt");

function computeKanjiVgListRev() {
  const t = fs.readFileSync(kanjiVgPath, "utf8");
  const rows = t.split(/\r?\n/).filter((l) => {
    const r = l.trim();
    return r && r.charAt(0) !== "#" && r.split("\t").length >= 3;
  });
  return rows.length + "-" + Buffer.byteLength(t, "utf8");
}

const KANJI_VG_LIST_REV = computeKanjiVgListRev();
console.log("KANJI_VG_LIST_REV =", KANJI_VG_LIST_REV);

const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
if (lineIdx < 0) throw new Error("window.KP_HTML line not found");

const prefix = "window.KP_HTML = ";
const jsonStr = lines[lineIdx].slice(prefix.length).replace(/;\s*$/, "");
const o = JSON.parse(jsonStr);
let h = o.value;

const OVERRIDE_MARKER = "// Data loading override for unified repository flow (KanjiVG.txt).";

const overrideBlock = `<script>
  ${OVERRIDE_MARKER}
  (function() {
    function resolveKanjiVgTxtUrl() {
      try {
        var u = window.KANJI_VG_TXT_URL;
        if (u && String(u).trim()) return String(u).trim();
      } catch (e1) {}
      try {
        if (window.parent && window.parent !== window && window.parent.location && window.parent.location.href) {
          return new URL("KanjiVG.txt", window.parent.location.href).href;
        }
      } catch (e2) {}
      try {
        return new URL("KanjiVG.txt", window.location.href).href;
      } catch (e3) {
        return "KanjiVG.txt";
      }
    }
    function firstIdeographFromTsvCell(cell) {
      var s = String(cell || "").normalize("NFC").trim();
      if (!s) return "";
      for (var i = 0; i < s.length; ) {
        var cp = s.codePointAt(i);
        i += cp > 0xffff ? 2 : 1;
        if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0xf900 && cp <= 0xfaff)) {
          return String.fromCodePoint(cp);
        }
      }
      return "";
    }
    function parseUnicodeToChar(rawUnicode) {
      var raw = String(rawUnicode || "").trim();
      if (!raw) return "";
      var hexMatch = raw.match(/^(?:U\\+|0x)?([0-9A-Fa-f]{4,6})$/i);
      if (hexMatch) {
        var cp = parseInt(hexMatch[1], 16);
        if (!isNaN(cp) && cp > 0 && cp <= 0x10ffff) return String.fromCodePoint(cp);
      }
      var sci = Number(raw);
      if (!isNaN(sci) && sci > 0) {
        var cp2 = Math.round(sci);
        if (cp2 > 0 && cp2 <= 0x10ffff) return String.fromCodePoint(cp2);
      }
      return "";
    }
    function parseKanjiVgTsv(text) {
      var map = {};
      var body = String(text || "");
      if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
      var lines = body.split(/\\r?\\n/);
      for (var li = 0; li < lines.length; li++) {
        var row = lines[li].trim();
        if (!row || row.charAt(0) === "#") continue;
        var cols = row.split("\\t");
        if (cols.length < 3) continue;
        var kanji = firstIdeographFromTsvCell(cols[0]);
        var unicodeCol = String(cols[1] || "").trim();
        var strokesCol = String(cols[2] || "").trim();
        if (!kanji) kanji = parseUnicodeToChar(unicodeCol);
        if (!kanji || !strokesCol) continue;
        var paths = strokesCol.split("|").map(function(p) {
          return String(p || "").trim();
        }).filter(function(p) {
          return p && (p.charAt(0) === "M" || p.charAt(0) === "m");
        });
        if (paths.length > 0) map[kanji] = paths;
      }
      return map;
    }
    function getKanjiVgListRev() {
      try {
        var r = window.KANJI_VG_LIST_REV;
        if (r != null && String(r).trim()) return String(r).trim();
      } catch (e0) {}
      try {
        if (window.parent && window.parent !== window && window.parent.KANJI_VG_LIST_REV) {
          return String(window.parent.KANJI_VG_LIST_REV).trim();
        }
      } catch (e1) {}
      return "";
    }
    function readKanjiVgMeta() {
      try {
        var raw = SafeStorage.get("kanjiData_KanjiVG_meta");
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
    function isKanjiVgCacheFresh(meta) {
      if (!meta || typeof meta !== "object") return false;
      var rev = getKanjiVgListRev();
      if (!rev || String(meta.rev || "") !== rev) return false;
      if (meta.source === "sheet") return (Number(meta.count) || 0) > 0;
      try {
        if (String(meta.url || "") !== resolveKanjiVgTxtUrl()) return false;
      } catch (e) { return false; }
      return (Number(meta.count) || 0) > 0;
    }
    function applyKanjiDataMap(data) {
      if (!data || typeof data !== "object" || !Object.keys(data).length) return false;
      KANJI_DATA = data;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.__kanjiVgDataMap = data;
        }
      } catch (e) {}
      populateKanjiSelector();
      showLoading(false);
      return true;
    }
    function loadKanjiDataFromLocalCache() {
      var cacheKey = "kanjiData_KanjiVG_txt";
      var legacyKey = "kanjiData_KanjiVG.txt";
      try {
        if (window.parent && window.parent !== window && window.parent.__kanjiVgDataMap) {
          if (applyKanjiDataMap(window.parent.__kanjiVgDataMap)) return true;
        }
      } catch (eP) {}
      var meta = readKanjiVgMeta();
      if (isKanjiVgCacheFresh(meta)) {
        var cached = SafeStorage.get(cacheKey) || SafeStorage.get(legacyKey);
        if (cached) {
          try {
            var parsed = JSON.parse(cached);
            if (applyKanjiDataMap(parsed)) return true;
          } catch (e) {}
        }
      }
      if (!meta) {
        var legacyOnly = SafeStorage.get(legacyKey);
        if (legacyOnly) {
          try {
            var legParsed = JSON.parse(legacyOnly);
            if (applyKanjiDataMap(legParsed)) return true;
          } catch (e2) {}
        }
      }
      SafeStorage.remove(cacheKey);
      SafeStorage.remove(legacyKey);
      SafeStorage.remove("kanjiData_KanjiVG_meta");
      return false;
    }
    function persistKanjiDataAfterLoad(data, opts) {
      var cacheKey = "kanjiData_KanjiVG_txt";
      var legacyKey = "kanjiData_KanjiVG.txt";
      var rev = getKanjiVgListRev();
      var o = opts || {};
      KANJI_DATA = data;
      try {
        SafeStorage.set(cacheKey, JSON.stringify(data));
        SafeStorage.set("kanjiData_KanjiVG_meta", JSON.stringify({
          rev: rev,
          source: o.source || "txt",
          url: o.url || "",
          count: Object.keys(data).length,
          savedAt: Date.now()
        }));
        SafeStorage.remove(legacyKey);
        if (window.parent && window.parent !== window) {
          window.parent.__kanjiVgDataMap = data;
        }
      } catch (e) {}
      populateKanjiSelector();
      showLoading(false);
    }
    function loadKanjiDataFromSheetFallback() {
      showLoading(true, "筆順データを読込中（シート）...");
      return postKanjiApi("get_kanji_data_from_sheet", { sheetName: "KanjiVG.txt" })
        .then(function(res) {
          if (!res || res.status !== "success") {
            throw new Error((res && res.message) || "シートからの取得に失敗しました");
          }
          var data = res.data || {};
          if (!Object.keys(data).length) throw new Error("シートに有効な漢字データがありません");
          persistKanjiDataAfterLoad(data, { source: "sheet" });
        });
    }
    window.syncData = function() {
      try { SafeStorage.remove("kanjiData_KanjiVG_txt"); } catch (_) {}
      try { SafeStorage.remove("kanjiData_KanjiVG_meta"); } catch (_) {}
      try { SafeStorage.remove("kanjiData_KanjiVG.txt"); } catch (_) {}
      try {
        if (window.parent && window.parent !== window) {
          window.parent.__kanjiVgDataMap = null;
        }
      } catch (_) {}
      return window.loadKanjiData();
    };
    window.loadKanjiData = function() {
      if (window.__kpKanjiInflight) return window.__kpKanjiInflight;
      if (loadKanjiDataFromLocalCache()) {
        return Promise.resolve();
      }
      showLoading(true, "KanjiVG.txt を読込中...");
      var url = resolveKanjiVgTxtUrl();
      var rev = getKanjiVgListRev();
      window.__kpKanjiInflight = fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then(function(text) {
          var data = parseKanjiVgTsv(text);
          if (!Object.keys(data).length) throw new Error("TSVに有効な行がありません");
          persistKanjiDataAfterLoad(data, { source: "txt", url: url });
        })
        .catch(function(e) {
          return loadKanjiDataFromSheetFallback().catch(function(e2) {
            var msg = (e2 && e2.message) ? e2.message : String(e2 || e || "不明");
            alert("筆順データの読み込みに失敗しました。\\nKanjiVG.txt: " + (e && e.message ? e.message : e) + "\\nシート: " + msg);
            showLoading(false);
          });
        })
        .finally(function() { window.__kpKanjiInflight = null; });
      return window.__kpKanjiInflight;
    };
    (function() {
      var _kjpPrev = window.onload;
      window.onload = function() {
        updateProfileSelectUI();
        function _kpSheetInit() {
          if (typeof _kjpPrev === "function") _kjpPrev();
        }
        if (typeof window.loadKanjiData === "function") {
          var _kpP = window.loadKanjiData();
          if (_kpP && typeof _kpP.then === "function") {
            _kpP.then(_kpSheetInit).catch(_kpSheetInit);
          } else {
            _kpSheetInit();
          }
        } else {
          _kpSheetInit();
          showLoading(false);
        }
      };
    })();
  })();
<\\/script>`;

// Remove any previous override block
const overrideRe = /<script>\s*\/\/ Data loading override[\s\S]*?<\\\/script>/;
if (overrideRe.test(h)) {
  h = h.replace(overrideRe, "");
  console.log("Removed old KanjiVG override block");
}

// Stop double load: init only fills sheet selector, not loadKanjiData (fetch override handles data)
if (h.includes("loadKanjiData();\n        } catch(e) { alert(\"初期化エラー")) {
  h = h.replace(
    /sheetSelect\.innerHTML = initData\.sheets\.map\(s => `[^`]+`\)\.join\(''\);\s*\n\s*loadKanjiData\(\);/,
    "sheetSelect.innerHTML = initData.sheets.map(s => `<option value=\"${s}\">${s}</option>`).join('');"
  );
  console.log("Removed loadKanjiData() from get_kanji_init_data handler");
}

// Insert or replace override before </body>
const bodyClose = "</body>";
if (overrideRe.test(h)) {
  h = h.replace(overrideRe, overrideBlock);
  console.log("Replaced KanjiVG fetch override block");
} else if (h.indexOf(OVERRIDE_MARKER) < 0) {
  if (!h.includes(bodyClose)) throw new Error("</body> not found in KP_HTML");
  h = h.replace(bodyClose, overrideBlock + "\n" + bodyClose);
  console.log("Inserted KanjiVG fetch override");
} else {
  throw new Error("Override marker found but block regex did not match");
}

// kpLookupKanjiPaths helper
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
  console.log("Added kpLookupKanjiPaths");
}

o.value = h;
lines[lineIdx] = prefix + JSON.stringify(o) + ";";
let fullIdx = lines.join("\n");

// 親ページ: KanjiVG リスト版・ローカルキャッシュ復元
const revConst = `const KANJI_VG_LIST_REV = "${KANJI_VG_LIST_REV}";`;
if (!fullIdx.includes("const KANJI_VG_LIST_REV")) {
  fullIdx = fullIdx.replace(
    /(\/\*\* GitHub Pages 等：index\.html と同階層の KanjiVG\.txt への絶対 URL)/,
    "/** KanjiVG.txt を更新したら rev を変える（fix-kanjivg-load.js が自動算出可） */\n    " +
      revConst +
      "\n    $1"
  );
  console.log("Inserted KANJI_VG_LIST_REV in parent script");
} else {
  fullIdx = fullIdx.replace(
    /const KANJI_VG_LIST_REV = "[^"]+";/,
    revConst
  );
  console.log("Updated KANJI_VG_LIST_REV in parent script");
}

if (!fullIdx.includes("function clearKanjiVgLocalCache")) {
  fullIdx = fullIdx.replace(
    "function getKanjiVgTxtUrl() {",
    `function clearKanjiVgLocalCache() {
      try {
        localStorage.removeItem("kanjiData_KanjiVG_txt");
        localStorage.removeItem("kanjiData_KanjiVG_meta");
        localStorage.removeItem("kanjiData_KanjiVG.txt");
        window.__kanjiVgDataMap = null;
      } catch (_kv) {}
    }
    function hydrateParentKanjiVgCache() {
      if (window.__kanjiVgDataMap && typeof window.__kanjiVgDataMap === "object" && Object.keys(window.__kanjiVgDataMap).length > 0) {
        return true;
      }
      try {
        const meta = JSON.parse(localStorage.getItem("kanjiData_KanjiVG_meta") || "null");
        if (!meta || String(meta.rev || "") !== KANJI_VG_LIST_REV) return false;
        const raw = localStorage.getItem("kanjiData_KanjiVG_txt") || localStorage.getItem("kanjiData_KanjiVG.txt");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          window.__kanjiVgDataMap = parsed;
          return true;
        }
      } catch (_hy) {}
      return false;
    }
    function getKanjiVgTxtUrl() {`
  );
  console.log("Inserted clearKanjiVgLocalCache / hydrateParentKanjiVgCache");
}

fullIdx = fullIdx.replace(
  /const tag = "<scr" \+ "ipt>window\.KANJI_VG_TXT_URL=" \+ JSON\.stringify\(getKanjiVgTxtUrl\(\)\) \+ ";<\/scr" \+ "ipt>";/,
  'const tag = "<scr" + "ipt>window.KANJI_VG_TXT_URL=" + JSON.stringify(getKanjiVgTxtUrl()) + ";window.KANJI_VG_LIST_REV=" + JSON.stringify(KANJI_VG_LIST_REV) + ";</scr" + "ipt>";'
);

if (!fullIdx.includes("hydrateParentKanjiVgCache();")) {
  fullIdx = fullIdx.replace(
    "function ensureKanjiVgPrefetch() {\n      try {\n        if (document.getElementById(\"kanji-vg-prefetch-link\")) return;",
    "function ensureKanjiVgPrefetch() {\n      hydrateParentKanjiVgCache();\n      try {\n        if (document.getElementById(\"kanji-vg-prefetch-link\")) return;"
  );
}

if (!fullIdx.includes("clearKanjiVgLocalCache();")) {
  fullIdx = fullIdx.replace(
    "function clearAppCacheAndReload() {\n      if (!confirm(",
    "function clearAppCacheAndReload() {\n      clearKanjiVgLocalCache();\n      if (!confirm("
  );
}

fs.writeFileSync(indexPath, fullIdx, "utf8");

// Bump KP_EMBED_VER
let idx = fs.readFileSync(indexPath, "utf8");
const verMatch = idx.match(/const KP_EMBED_VER = "(\d+)"/);
if (verMatch) {
  const next = String(parseInt(verMatch[1], 10) + 1);
  idx = idx.replace(/const KP_EMBED_VER = "\d+"/, `const KP_EMBED_VER = "${next}"`);
  fs.writeFileSync(indexPath, idx, "utf8");
  console.log("KP_EMBED_VER ->", next);
}

console.log("fix-kanjivg-load.js done");
