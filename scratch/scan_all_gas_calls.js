const fs = require('fs');
const path = require('path');

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'scratch' || f === 'spreadsheet-firebase-mediator') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      scanDir(p, fileList);
    } else if (f.endsWith('.js') || f.endsWith('.html')) {
      fileList.push(p);
    }
  }
  return fileList;
}

const allFiles = scanDir('.');
console.log(`Scanning ${allFiles.length} files...`);

const report = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // GAS_API_URL or getGasUrl or fetch(gasUrl or fetch(GAS_API_URL or gasApiFetchJson
    if (
      line.includes('GAS_API_URL') ||
      line.includes('getGasUrl()') ||
      line.includes('gasApiFetch') ||
      (line.includes('fetch(') && (line.includes('gas') || line.includes('Gas') || line.includes('script.google.com')))
    ) {
      report.push({ file, line: idx + 1, text: line.trim() });
    }
  });
});

console.log(`Found ${report.length} occurrences:`);
report.forEach(r => {
  console.log(`${r.file}:${r.line}: ${r.text.slice(0, 120)}`);
});
