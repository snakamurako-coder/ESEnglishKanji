/**
 * scripts/split-index-html.js
 * 既存の index.html をセクション単位に分割し、
 * src/sections/*.html および src/index.template.html を生成するワンタイム移行スクリプト
 */

// このスクリプトは初期分割完了済みのワンタイムスクリプトです。
// 再実行による上書き事故を防ぐため通常は実行を停止します。
console.log('[INFO] Sections are already split. To re-split, remove this check.');
process.exit(0);

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const srcDir = path.join(rootDir, 'src');
const sectionsDir = path.join(srcDir, 'sections');

if (!fs.existsSync(sectionsDir)) {
  fs.mkdirSync(sectionsDir, { recursive: true });
}

const raw = fs.readFileSync(indexPath, 'utf8');
// 改行コードを統一して配列化
const lines = raw.split(/\r?\n/);

console.log(`Original index.html total lines: ${lines.length}`);

// 1-indexed 行番号で指定 (startLine, endLine は inclusive)
const sectionDefs = [
  {
    name: '01-users-pin.html',
    start: 11, // 空行含む
    end: 15
  },
  {
    name: '02-home.html',
    start: 16,
    end: 63
  },
  {
    name: '03-kanji-learning.html',
    start: 64,
    end: 93
  },
  {
    name: '04-kanji-practice.html',
    start: 94,
    end: 125
  },
  {
    name: '05-kanji-nigate.html',
    start: 126,
    end: 155
  },
  {
    name: '06-training.html',
    start: 156,
    end: 165
  },
  {
    name: '07-rewards-inventory.html',
    start: 166,
    end: 168
  },
  {
    name: '08-materials.html',
    start: 169,
    end: 219
  },
  {
    name: '09-kanji-quiz-sets.html',
    start: 220,
    end: 262
  },
  {
    name: '10-kanji-quiz-play.html',
    start: 263,
    end: 371
  },
  {
    name: '11-external.html',
    start: 372,
    end: 392
  },
  {
    name: '12-parent-admin.html',
    start: 393,
    end: 481
  },
  {
    name: '13-quiz-play.html',
    start: 482,
    end: 562
  },
  {
    name: '14-result.html',
    start: 563,
    end: 576
  }
];

// 各セクションを書き出す
for (const def of sectionDefs) {
  // lines は 0-indexed なので start - 1 から end まで (slice の第2引数は exclusive なので end)
  const slice = lines.slice(def.start - 1, def.end);
  const outPath = path.join(sectionsDir, def.name);
  fs.writeFileSync(outPath, slice.join('\n') + '\n', 'utf8');
  console.log(`Extracted: ${def.name} (${slice.length} lines)`);
}

// テンプレートの構築
// 1行目〜10行目 (ヘッダーまで)
const headLines = lines.slice(0, 10);
// 577行目〜末尾 (フッターとスクリプト)
const footLines = lines.slice(576);

let templateContent = headLines.join('\n') + '\n\n';
for (const def of sectionDefs) {
  templateContent += `  <!-- @include sections/${def.name} -->\n`;
}
templateContent += '\n' + footLines.join('\n');

const templatePath = path.join(srcDir, 'index.template.html');
fs.writeFileSync(templatePath, templateContent, 'utf8');
console.log(`Generated: src/index.template.html`);
