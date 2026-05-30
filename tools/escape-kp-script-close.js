/** Escape </script> inside KP_HTML so the parent <script> block is not terminated early. */
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
let s = fs.readFileSync(indexPath, "utf8");
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

const lines = s.split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
if (lineIdx < 0) throw new Error("window.KP_HTML line not found");

const prefix = "window.KP_HTML = ";
const o = JSON.parse(lines[lineIdx].slice(prefix.length).replace(/;\s*$/, ""));
let h = o.value;
const before = (h.match(/<\/script>/gi) || []).length;
h = h.replace(/<\/script>/gi, "<\\/script>");
const after = (h.match(/<\/script>/gi) || []).length;
o.value = h;
lines[lineIdx] = prefix + JSON.stringify(o) + ";";
fs.writeFileSync(indexPath, lines.join("\n"), "utf8");
console.log("escaped </script> in KP_HTML:", before, "->", after, "remaining");
