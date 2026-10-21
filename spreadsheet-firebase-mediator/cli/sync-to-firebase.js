/**
 * Spreadsheet-Firebase Mediator CLI
 * 
 * 仲介GAS Web APIから最新マニフェストJSON群を取得し、
 * Firebase Hostingの配信ディレクトリ(data/)へ配置してデプロイを連携するCLIツール
 * 
 * 実行方法:
 *   node cli/sync-to-firebase.js [--mediator-url <URL>] [--skip-deploy]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');

function parseArgs() {
  const args = process.argv.slice(2);
  const DEFAULT_MEDIATOR_URL = 'https://script.google.com/macros/s/AKfycbw3kHj3mGXxB3tDUBtbnA0D2SqDdlsD9T0ef9oO3GRf3-QqqFdBPyBNcPvdXxxFnbqXfQ/exec';
  const opts = { mediatorUrl: DEFAULT_MEDIATOR_URL, skipDeploy: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mediator-url' && args[i + 1]) {
      opts.mediatorUrl = args[i + 1];
      i++;
    } else if (args[i] === '--skip-deploy') {
      opts.skipDeploy = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log('==> Spreadsheet-Firebase Mediator CLI started');

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

  if (opts.mediatorUrl) {
    console.log('==> Fetching from dedicated Mediator Web App:', opts.mediatorUrl);
    const res = await fetch(opts.mediatorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export_all' })
    });
    if (!res.ok) throw new Error(`Mediator returned HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Mediator export failed');

    // 1. materials ファイル書き出し
    const matFileName = `manifest-materials.${data.materialsHash}.json`;
    fs.writeFileSync(path.join(DATA_DIR, matFileName), JSON.stringify({
      status: 'success',
      hash: data.materialsHash,
      materials: data.materials,
      exportedAt: data.exportedAt
    }, null, 2), 'utf8');

    // 2. 各ブックファイル書き出し
    if (data.booksData) {
      for (const [modeId, book] of Object.entries(data.booksData)) {
        const bookFileName = `${modeId}.${book.hash}.json`;
        fs.writeFileSync(path.join(BOOKS_DIR, bookFileName), JSON.stringify(book, null, 2), 'utf8');
      }
    }

    // 3. インデックスファイル書き出し
    const indexData = {
      schemaVersion: 1,
      exportedAt: data.exportedAt,
      materials: {
        hash: data.materialsHash,
        path: `data/${matFileName}`,
        count: data.materials.length
      },
      books: data.booksMeta
    };
    fs.writeFileSync(path.join(DATA_DIR, 'manifest-index.json'), JSON.stringify(indexData, null, 2), 'utf8');
    console.log('==> Manifests saved to data/ successfully!');
  } else {
    console.log('==> Using local publisher pipeline (scripts/publish-manifest.js)...');
    execSync('node scripts/publish-manifest.js', { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  if (!opts.skipDeploy) {
    console.log('\n==> Deploying to Firebase Hosting...');
    execSync('powershell -ExecutionPolicy Bypass -File .\\scripts\\deploy-fb.ps1 -HostingOnly', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log('\n==> Sync and deploy completed successfully!');
  }
}

main().catch(err => {
  console.error('\n[Error]', err.message);
  process.exit(1);
});
