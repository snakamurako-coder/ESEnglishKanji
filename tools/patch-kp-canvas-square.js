/**
 * KP_HTML 内の漢字練習 #canvas を常に正方形表示にする。
 */
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
if (lineIdx < 0) throw new Error("window.KP_HTML line not found");

const prefix = "window.KP_HTML = ";
const o = JSON.parse(lines[lineIdx].slice(prefix.length).replace(/;\s*$/, ""));
let h = o.value;

const oldRule =
  "#canvas { background-color: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: crosshair; }";
const newRule =
  "#canvas { background-color: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: crosshair; display: block; width: min(300px, calc(100vw - 40px)); height: min(300px, calc(100vw - 40px)); aspect-ratio: 1 / 1; max-width: 100%; box-sizing: border-box; flex-shrink: 0; margin: 0 auto; }";

if (!h.includes(oldRule) && !h.includes("aspect-ratio: 1 / 1")) {
  throw new Error("#canvas rule not found for patch");
}
if (h.includes(oldRule)) {
  h = h.replace(oldRule, newRule);
} else if (!h.includes(newRule)) {
  h = h.replace(
    /#canvas \{ background-color: #fff;[\s\S]*?cursor: crosshair; \}/,
    newRule
  );
}

o.value = h;
lines[lineIdx] = prefix + JSON.stringify(o) + ";";
fs.writeFileSync(indexPath, lines.join("\n"), "utf8");

let idx = fs.readFileSync(indexPath, "utf8");
const verMatch = idx.match(/const KP_EMBED_VER = "(\d+)"/);
if (verMatch) {
  const next = String(parseInt(verMatch[1], 10) + 1);
  idx = idx.replace(/const KP_EMBED_VER = "\d+"/, `const KP_EMBED_VER = "${next}"`);
  fs.writeFileSync(indexPath, idx, "utf8");
  console.log("KP_EMBED_VER ->", next);
}
console.log("patch-kp-canvas-square.js done");
