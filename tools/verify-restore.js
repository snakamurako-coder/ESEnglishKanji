const fs = require("fs");
const s = fs.readFileSync("index.html", "utf8");
const line = s.split(/\r?\n/).find((l) => l.startsWith("window.KP_HTML"));
const v = JSON.parse(line.slice(16).replace(/;$/, "")).value;
const checks = {
  noBom: s.charCodeAt(0) !== 0xfeff,
  kpParse: v.length > 50000,
  sheetLoad: v.includes("get_kanji_data_from_sheet"),
  fetchOverride: v.includes("fetch(") && v.includes("KanjiVG"),
  noRawScriptInLine: !line.includes("</script>"),
  inject: s.includes("injectKanjiVgUrlIntoKpHtml"),
  bootstrap: s.includes("function bootstrapKpFrameKanjiData"),
  embedVer14: s.includes('KP_EMBED_VER = "14"'),
  srcdocInject: s.includes("frame.srcdoc = injectKanjiVgUrlIntoKpHtml"),
  noDrillSlotHtml: !s.includes('id="kp-iframe-slot-quiz-drill"'),
  drillEvalHead: s.includes("kp-iframe-slot-quiz-drill") && s.includes("ensureKanjiFrameForQuizEval"),
};
console.log(JSON.stringify(checks, null, 2));
const bad = Object.entries(checks).filter(([, ok]) => !ok);
if (bad.length) process.exit(1);
