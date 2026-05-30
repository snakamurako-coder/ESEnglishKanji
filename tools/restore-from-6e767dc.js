/**
 * Restore index.html from 6e767dc (Phase1) + Phase2 merge.
 * node tools/restore-from-6e767dc.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const indexPath = path.join(__dirname, "..", "index.html");
const refPath = path.join(__dirname, "_ref-6e767dc-index.html");

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readUtf8(p) {
  return stripBom(fs.readFileSync(p, "utf8"));
}

function loadRef() {
  if (!fs.existsSync(refPath) || fs.statSync(refPath).size < 500000) {
    const buf = execSync('git show "6e767dc:index.html"', { maxBuffer: 60e6 });
    fs.writeFileSync(refPath, buf);
    console.log("wrote ref from git", buf.length);
  }
  return stripBom(fs.readFileSync(refPath, "utf8"));
}

function extractFunction(src, name) {
  const sig = "function " + name;
  const i = src.indexOf(sig);
  if (i < 0) return null;
  let depth = 0;
  let started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === "{") {
      depth++;
      started = true;
    } else if (ch === "}") {
      depth--;
      if (started && depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

function replaceFunction(cur, name, replacement) {
  const old = extractFunction(cur, name);
  if (!old) throw new Error("missing in current: " + name);
  if (!replacement) throw new Error("missing in ref: " + name);
  return cur.replace(old, replacement);
}

function replaceKpHtmlFromRef(cur, ref) {
  const refLine = ref.split(/\r?\n/).find((l) => l.startsWith("window.KP_HTML"));
  if (!refLine) throw new Error("KP_HTML line missing in ref");
  JSON.parse(refLine.slice("window.KP_HTML = ".length).replace(/;\s*$/, ""));
  const lines = cur.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
  if (idx < 0) throw new Error("KP_HTML missing in current");
  lines[idx] = refLine.trim().endsWith(";") ? refLine.trim() : refLine.trim() + ";";
  return lines.join("\n");
}

function escapeKpScriptTags(html) {
  const lines = html.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
  const prefix = "window.KP_HTML = ";
  const o = JSON.parse(lines[idx].slice(prefix.length).replace(/;\s*$/, ""));
  o.value = o.value.replace(/<\/script>/gi, "<\\/script>");
  lines[idx] = prefix + JSON.stringify(o) + ";";
  return lines.join("\n");
}

const phase1Only = process.argv.includes("--phase1-only");
const headSnapshot = readUtf8(indexPath);
let cur = headSnapshot;
const ref = loadRef();

const fns = [
  "openKanjiPracticePro",
  "ensureKanjiPracticeFrameReady",
  "ensureKanjiFrameForQuizEval",
  "restoreKanjiPracticeFrameIfMoved",
];
for (const name of fns) {
  cur = replaceFunction(cur, name, extractFunction(ref, name));
  console.log("phase1 fn:", name);
}

cur = replaceKpHtmlFromRef(cur, ref);
cur = escapeKpScriptTags(cur);
console.log("phase1: KP_HTML replaced + escaped");

cur = cur.replace(
  /\s*<div id="kp-iframe-slot-quiz-drill"[^>]*><\/div>\s*\n?/,
  "\n"
);

if (!phase1Only) {
  // Phase2: keep helpers from HEAD if still present
  const head = headSnapshot;

  // openKanjiPracticePro: inject URL + bootstrap + VER 14
  let openFn = extractFunction(cur, "openKanjiPracticePro");
  openFn = openFn.replace(
    /const KP_EMBED_VER = "5";/,
    'const KP_EMBED_VER = "14";'
  );
  openFn = openFn.replace(
    /frame\.srcdoc = kpHtml;/,
    "frame.srcdoc = injectKanjiVgUrlIntoKpHtml(kpHtml);"
  );
  if (!openFn.includes("bootstrapKpFrameKanjiData(frame)")) {
    openFn = openFn.replace(
      /frame\.removeEventListener\("load", onKpEmbedLoad\);\n        syncKanjiHandScoreWeightsToFrame\(frame\);\n        patchKanjiFrameForQuizPostMessage\(frame\);/,
      `frame.removeEventListener("load", onKpEmbedLoad);
        syncKanjiHandScoreWeightsToFrame(frame);
        patchKanjiFrameForQuizPostMessage(frame);
        bootstrapKpFrameKanjiData(frame);`
    );
    openFn = openFn.replace(
      /patchKanjiFrameForQuizPostMessage\(frame\);\n        kpResizeFrameToContent\(\);\n      \}, 120\);/,
      `patchKanjiFrameForQuizPostMessage(frame);
        bootstrapKpFrameKanjiData(frame);
        kpResizeFrameToContent();
      }, 120);`
    );
  }
  cur = replaceFunction(cur, "openKanjiPracticePro", openFn);

  const headEnsure = extractFunction(head, "ensureKanjiPracticeFrameReady");
  if (headEnsure && headEnsure.includes("bootstrapKpFrameKanjiData")) {
    cur = replaceFunction(cur, "ensureKanjiPracticeFrameReady", headEnsure);
    console.log("phase2: ensureKanjiPracticeFrameReady from HEAD");
  }

  const headEval = extractFunction(head, "ensureKanjiFrameForQuizEval");
  if (headEval) {
    cur = replaceFunction(cur, "ensureKanjiFrameForQuizEval", headEval);
    console.log("phase2: ensureKanjiFrameForQuizEval from HEAD");
  }

  const headRestore = extractFunction(head, "restoreKanjiPracticeFrameIfMoved");
  if (headRestore) {
    cur = replaceFunction(cur, "restoreKanjiPracticeFrameIfMoved", headRestore);
    console.log("phase2: restoreKanjiPracticeFrameIfMoved from HEAD");
  }

  if (!cur.includes("#kp-iframe-slot-quiz-drill")) {
    const slotCss =
      "    #kp-iframe-slot-quiz-drill { display: none !important; width: 0; height: 0; overflow: hidden; }\n";
    cur = cur.replace(
      /    #kanji-quiz-drill-handwriting \.kanji-drill-hw-canvas-panel #kanji-quiz-write-canvas \{/,
      slotCss + "    #kanji-quiz-drill-handwriting .kanji-drill-hw-canvas-panel #kanji-quiz-write-canvas {"
    );
  }
}

cur = stripBom(cur);
fs.writeFileSync(indexPath, cur, "utf8");
console.log("done ->", indexPath);
