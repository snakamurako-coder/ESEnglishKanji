const fs = require("fs");
const line = fs.readFileSync("index.html", "utf8").split(/\r?\n/).find((l) => l.startsWith("window.KP_HTML"));
const h = JSON.parse(line.slice(16).replace(/;\s*$/, "")).value;
const checks = [
  ["resolveKanjiVgTxtUrl", h.includes("resolveKanjiVgTxtUrl")],
  ["fetch(url)", h.includes("fetch(url)")],
  ["window.loadKanjiData override", h.includes("window.loadKanjiData = function")],
  ["kpLookupKanjiPaths", h.includes("window.kpLookupKanjiPaths")],
  ["no init loadKanjiData", !h.includes("loadKanjiData();\n        } catch(e) { alert(\"初期化エラー")],
  ["firstIdeographFromTsvCell", h.includes("firstIdeographFromTsvCell")],
];
let ok = true;
checks.forEach(([name, pass]) => {
  console.log(pass ? "OK" : "FAIL", name);
  if (!pass) ok = false;
});
process.exit(ok ? 0 : 1);
