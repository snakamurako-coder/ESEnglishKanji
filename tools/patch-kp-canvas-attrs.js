const fs = require("fs");
const path = require("path");
const indexPath = path.join(__dirname, "..", "index.html");
const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/);
const lineIdx = lines.findIndex((l) => l.startsWith("window.KP_HTML"));
const prefix = "window.KP_HTML = ";
const o = JSON.parse(lines[lineIdx].slice(prefix.length).replace(/;\s*$/, ""));
let h = o.value;
const oldTag = '<canvas id="canvas"></canvas>';
const newTag = '<canvas id="canvas" width="300" height="300"></canvas>';
if (!h.includes(oldTag)) {
  if (h.includes(newTag)) {
    console.log("canvas attrs already set");
    process.exit(0);
  }
  throw new Error("canvas tag not found");
}
h = h.replace(oldTag, newTag);
o.value = h;
lines[lineIdx] = prefix + JSON.stringify(o) + ";";
fs.writeFileSync(indexPath, lines.join("\n"), "utf8");
console.log("canvas width/height attributes added");
