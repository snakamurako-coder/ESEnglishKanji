const fs = require("fs");
const indexPath = require("path").join(__dirname, "..", "index.html");

let s = fs.readFileSync(indexPath, "utf8");
let bomRemoved = false;
if (s.charCodeAt(0) === 0xfeff) {
  s = s.slice(1);
  bomRemoved = true;
}

const lines = s.split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
if (lineIdx < 0) throw new Error("KP_HTML line missing");

const prefix = "window.KP_HTML = ";
const o = JSON.parse(lines[lineIdx].slice(prefix.length).replace(/;\s*$/, ""));
let h = o.value;

const oldPopulate =
  "    if (pending && KANJI_DATA[pending]) want = pending;\n" +
  "    else if (prevSelected && KANJI_DATA[prevSelected]) want = prevSelected;\n" +
  "    if (pending && KANJI_DATA[pending]) {";

const newPopulate =
  "    const _kpHas = (ch) => (typeof window.kpLookupKanjiPaths === 'function' ? window.kpLookupKanjiPaths(ch) : (KANJI_DATA && KANJI_DATA[ch] ? KANJI_DATA[ch] : null));\n" +
  "    if (pending && _kpHas(pending)) want = pending;\n" +
  "    else if (prevSelected && _kpHas(prevSelected)) want = prevSelected;\n" +
  "    if (pending && _kpHas(pending)) {";

if (!h.includes(oldPopulate)) {
  if (h.includes("_kpHas")) {
    console.log("populate already uses _kpHas");
  } else {
    throw new Error("populate KANJI_DATA block not found");
  }
} else {
  h = h.replace(oldPopulate, newPopulate);
  o.value = h;
  lines[lineIdx] = prefix + JSON.stringify(o) + ";";
  s = lines.join("\n");
}

fs.writeFileSync(indexPath, s, "utf8");
console.log("done", { bomRemoved });
