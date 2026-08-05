/**
 * ルート正本の行数レポート（軽量化前後の比較用）
 * node codereduction/scripts/report-size.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.resolve(__dirname, '..');

/** promote 前の monolith（履歴固定値。再計測しない） */
const HISTORICAL_ORIGINAL = {
  indexHtmlLines: 17043,
  indexHtmlKb: 837,
  gasLines: 4587,
  gasKb: 193,
};

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

function dirJsLines(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) total += dirJsLines(p);
    else if (/\.(js|gs)$/.test(ent.name)) total += countLines(p);
  }
  return total;
}

function fileSizeKb(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return Math.round(fs.statSync(filePath).size / 1024);
}

function findGasCodePath() {
  const preferred = path.join(ROOT, 'コード.js');
  if (fs.existsSync(preferred)) return preferred;
  for (const name of fs.readdirSync(ROOT)) {
    if (!name.endsWith('.js') || name === 'kanji-vg.js') continue;
    const p = path.join(ROOT, name);
    if (fs.statSync(p).size > 50000) return p;
  }
  return preferred;
}

const gasPath = findGasCodePath();

const report = {
  original: HISTORICAL_ORIGINAL,
  root: {
    indexHtmlLines: countLines(path.join(ROOT, 'index.html')),
    indexHtmlKb: fileSizeKb(path.join(ROOT, 'index.html')),
    cssLines: countLines(path.join(ROOT, 'css/app.css')),
    appJsLines: countLines(path.join(ROOT, 'js/app.js')),
    adapterAndInfraLines:
      countLines(path.join(ROOT, 'js/main.js')) +
      countLines(path.join(ROOT, 'js/api.js')) +
      countLines(path.join(ROOT, 'js/state.js')) +
      dirJsLines(path.join(ROOT, 'js/adapters')),
    splitModuleLines:
      dirJsLines(path.join(ROOT, 'js/quiz')) +
      countLines(path.join(ROOT, 'js/home.js')) +
      countLines(path.join(ROOT, 'js/auth.js')) +
      countLines(path.join(ROOT, 'js/materials.js')) +
      countLines(path.join(ROOT, 'js/training.js')) +
      countLines(path.join(ROOT, 'js/rewards.js')) +
      countLines(path.join(ROOT, 'js/external.js')) +
      countLines(path.join(ROOT, 'js/stopwatch.js')) +
      countLines(path.join(ROOT, 'js/kanjiLearning.js')) +
      countLines(path.join(ROOT, 'js/parentAdmin.js')) +
      countLines(path.join(ROOT, 'js/app-shared.js')),
    kpPracticeKb: fileSizeKb(path.join(ROOT, 'assets/kp-practice.html')),
    gasLines: countLines(gasPath),
    gasKb: fileSizeKb(gasPath),
    migrateOnceLines: countLines(path.join(ROOT, 'migrateOnce.gs')),
  },
};

const rootFrontTotal =
  report.root.indexHtmlLines +
  report.root.cssLines +
  report.root.appJsLines +
  report.root.adapterAndInfraLines;

console.log(JSON.stringify(report, null, 2));
console.log('\n--- Summary ---');
console.log(
  `Original index.html: ${report.original.indexHtmlLines} lines / ${report.original.indexHtmlKb} KB`
);
console.log(`Root front (shell+css+app+infra): ${rootFrontTotal} lines`);
console.log(
  `KP externalized: ${report.root.kpPracticeKb} KB (was embedded in index.html)`
);
console.log(
  `Original GAS: ${report.original.gasLines} lines → slim: ${report.root.gasLines} lines (+ migrateOnce ${report.root.migrateOnceLines})`
);

fs.writeFileSync(path.join(OUT_DIR, 'SIZE-REPORT.json'), JSON.stringify(report, null, 2));
console.log(`Wrote ${path.join(OUT_DIR, 'SIZE-REPORT.json')}`);
