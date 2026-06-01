/**
 * Restores KanjiVG.txt fetch override inside KP_HTML (GitHub Pages).
 * Uses absolute KANJI_VG_TXT_URL from parent injection; robust TSV parse.
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
    window.syncData = function() {
      try { SafeStorage.remove("kanjiData_KanjiVG_txt"); } catch (_) {}
      try { SafeStorage.remove("kanjiData_KanjiVG.txt"); } catch (_) {}
      return window.loadKanjiData();
    };
    window.loadKanjiData = function() {
      if (window.__kpKanjiInflight) return window.__kpKanjiInflight;
      var cacheKey = "kanjiData_KanjiVG_txt";
      var cached = SafeStorage.get(cacheKey);
      if (cached) {
        try {
          var parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            KANJI_DATA = parsed;
            populateKanjiSelector();
            showLoading(false);
            return Promise.resolve();
          }
          SafeStorage.remove(cacheKey);
        } catch (_) { SafeStorage.remove(cacheKey); }
      }
      showLoading(true, "KanjiVG.txt を読込中...");
      var url = resolveKanjiVgTxtUrl();
      window.__kpKanjiInflight = fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then(function(text) {
          var data = parseKanjiVgTsv(text);
          if (!Object.keys(data).length) throw new Error("TSVに有効な行がありません");
          KANJI_DATA = data;
          SafeStorage.set(cacheKey, JSON.stringify(data));
          populateKanjiSelector();
          showLoading(false);
        })
        .catch(function(e) {
          alert("KanjiVG.txt の読み込みに失敗: " + (e && e.message ? e.message : e));
          showLoading(false);
        })
        .finally(function() { window.__kpKanjiInflight = null; });
      return window.__kpKanjiInflight;
    };
    (function() {
      var _kjpPrev = window.onload;
      window.onload = function() {
        if (typeof _kjpPrev === "function") _kjpPrev();
        updateProfileSelectUI();
        if (typeof window.loadKanjiData === "function") {
          window.loadKanjiData();
        } else {
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

// Insert override before </body>
const bodyClose = "</body>";
if (h.indexOf(OVERRIDE_MARKER) < 0) {
  if (!h.includes(bodyClose)) throw new Error("</body> not found in KP_HTML");
  h = h.replace(bodyClose, overrideBlock + "\n" + bodyClose);
  console.log("Inserted KanjiVG fetch override");
} else {
  console.log("Override marker already present");
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
fs.writeFileSync(indexPath, lines.join("\n"), "utf8");

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
