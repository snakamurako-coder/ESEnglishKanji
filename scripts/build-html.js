/**
 * scripts/build-html.js
 * src/index.template.html と src/sections/*.html を結合してルートの index.html を生成するスクリプト
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const templatePath = path.join(srcDir, 'index.template.html');
const outIndexPath = path.join(rootDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error(`[ERROR] Template not found: ${templatePath}`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');

// <!-- @include (path) --> を置換
const includeRegex = /^[ \t]*<!--\s*@include\s+([^\s]+)\s*-->/gm;

const result = template.replace(includeRegex, (match, relPath) => {
  const targetPath = path.join(srcDir, relPath);
  if (!fs.existsSync(targetPath)) {
    console.error(`[ERROR] Included file not found: ${targetPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(targetPath, 'utf8');
  return content.trimEnd();
});

// CRLF/LF を正規化して出力
const normalized = result.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
fs.writeFileSync(outIndexPath, normalized, 'utf8');
console.log(`[SUCCESS] Generated index.html from src/index.template.html (${result.length} bytes)`);
