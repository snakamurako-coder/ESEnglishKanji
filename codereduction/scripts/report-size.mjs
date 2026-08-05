/**
 * 行数比較レポート生成
 * node codereduction/scripts/report-size.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CR = path.resolve(__dirname, '..');

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

const origIndex = path.join(ROOT, 'index.html');
const crIndex = path.join(CR, 'index.html');
const origGas = path.join(ROOT, 'コード.js');
const crGas = path.join(CR, 'gas/コード.js');

const report = {
  original: {
    indexHtmlLines: countLines(origIndex),
    indexHtmlKb: fileSizeKb(origIndex),
    gasLines: countLines(origGas),
    gasKb: fileSizeKb(origGas),
  },
  codereduction: {
    indexHtmlLines: countLines(crIndex),
    indexHtmlKb: fileSizeKb(crIndex),
    cssLines: countLines(path.join(CR, 'css/app.css')),
    appJsLines: countLines(path.join(CR, 'js/app.js')),
    adapterAndInfraLines:
      countLines(path.join(CR, 'js/main.js')) +
      countLines(path.join(CR, 'js/api.js')) +
      countLines(path.join(CR, 'js/state.js')) +
      dirJsLines(path.join(CR, 'js/adapters')),
    splitModuleLines: dirJsLines(path.join(CR, 'js/quiz')) +
      countLines(path.join(CR, 'js/home.js')) +
      countLines(path.join(CR, 'js/auth.js')) +
      countLines(path.join(CR, 'js/materials.js')) +
      countLines(path.join(CR, 'js/training.js')) +
      countLines(path.join(CR, 'js/rewards.js')) +
      countLines(path.join(CR, 'js/external.js')) +
      countLines(path.join(CR, 'js/stopwatch.js')) +
      countLines(path.join(CR, 'js/kanjiLearning.js')) +
      countLines(path.join(CR, 'js/parentAdmin.js')) +
      countLines(path.join(CR, 'js/app-shared.js')),
    kpPracticeKb: fileSizeKb(path.join(CR, 'assets/kp-practice.html')),
    gasLines: countLines(crGas),
    gasKb: fileSizeKb(crGas),
    migrateOnceLines: countLines(path.join(CR, 'gas/migrateOnce.gs')),
  },
};

const crFrontTotal =
  report.codereduction.indexHtmlLines +
  report.codereduction.cssLines +
  report.codereduction.appJsLines +
  report.codereduction.adapterAndInfraLines;

console.log(JSON.stringify(report, null, 2));
console.log('\n--- Summary ---');
console.log(`Original index.html: ${report.original.indexHtmlLines} lines / ${report.original.indexHtmlKb} KB`);
console.log(`codereduction front (shell+css+app+infra): ${crFrontTotal} lines`);
console.log(`KP externalized: ${report.codereduction.kpPracticeKb} KB (was embedded in index.html)`);
console.log(`Original GAS: ${report.original.gasLines} lines → slim: ${report.codereduction.gasLines} lines (+ migrateOnce ${report.codereduction.migrateOnceLines})`);

fs.writeFileSync(path.join(CR, 'SIZE-REPORT.json'), JSON.stringify(report, null, 2));
