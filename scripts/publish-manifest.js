/**
 * Googleスプレッドシート(GAS API)から英語・漢字の全教材・問題データを抽出し、
 * ハッシュ付き静的マニフェストJSON群を data/ に生成するパブリッシュスクリプト
 * 
 * 実行: node scripts/publish-manifest.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');

function getGasApiUrl() {
  const apiJsPath = path.join(ROOT_DIR, 'js', 'api.js');
  const content = fs.readFileSync(apiJsPath, 'utf8');
  const m = content.match(/const\s+GAS_API_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('GAS_API_URL が js/api.js に見つかりません');
  return m[1];
}

function computeHash(obj) {
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex').substring(0, 16);
}

async function fetchGas(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

async function main() {
  const gasUrl = getGasApiUrl();
  console.log('==> Connecting to GAS API:', gasUrl);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });

  // 1. 教材一覧を取得
  console.log('==> Fetching materials list...');
  const matsResp = await fetchGas(gasUrl, { action: 'get_materials_list' });
  if (!matsResp || matsResp.status !== 'success' || !Array.isArray(matsResp.materials)) {
    throw new Error('get_materials_list の取得に失敗しました');
  }

  const materialsList = matsResp.materials;
  console.log(`==> Found ${materialsList.length} book(s)`);

  const materialsHash = computeHash(materialsList);
  const materialsFileName = `manifest-materials.${materialsHash}.json`;
  const materialsFilePath = path.join(DATA_DIR, materialsFileName);
  fs.writeFileSync(materialsFilePath, JSON.stringify({
    status: 'success',
    hash: materialsHash,
    materials: materialsList,
    exportedAt: new Date().toISOString()
  }, null, 2), 'utf8');

  // 2. 各ブックの各シート（単元）のデータを取得
  const booksMeta = {};

  for (const book of materialsList) {
    const { modeId, modeName, category, units } = book;
    console.log(`\n--> Processing book: [${category}] ${modeName} (${units ? units.length : 0} units)`);

    const bookUnitsData = {};

    if (Array.isArray(units)) {
      for (const unit of units) {
        if (category === 'english') {
          process.stdout.write(`    [English] Unit: ${unit} ... `);
          try {
            const qResp = await fetchGas(gasUrl, { action: 'get_questions', modeId, unitName: unit });
            if (qResp && qResp.status === 'success' && Array.isArray(qResp.questions)) {
              bookUnitsData[unit] = qResp.questions;
              console.log(`OK (${qResp.questions.length} questions)`);
            } else {
              console.log(`SKIPPED`);
            }
          } catch (err) {
            console.log(`FAILED: ${err.message}`);
          }
        } else if (category === 'kanji') {
          process.stdout.write(`    [Kanji] Unit: ${unit} ... `);
          try {
            const setsResp = await fetchGas(gasUrl, { action: 'get_kanji_quiz_sets', modeId, unitName: unit });
            if (setsResp && setsResp.status === 'success' && Array.isArray(setsResp.sets)) {
              const sets = setsResp.sets;
              const setQuestions = {};
              process.stdout.write(`Sets: ${sets.length} ... `);
              for (const s of sets) {
                const sid = String(s.setId);
                try {
                  const qResp = await fetchGas(gasUrl, { action: 'get_kanji_quiz_questions', modeId, unitName: unit, setId: sid });
                  if (qResp && qResp.status === 'success' && Array.isArray(qResp.questions)) {
                    setQuestions[sid] = qResp.questions;
                  }
                } catch (_) {}
              }
              bookUnitsData[unit] = {
                sheetKind: setsResp.sheetKind || 'standard',
                sets: sets,
                setQuestions: setQuestions
              };
              console.log(`OK`);
            } else {
              console.log(`SKIPPED`);
            }
          } catch (err) {
            console.log(`FAILED: ${err.message}`);
          }
        }
      }
    }

    const bookHash = computeHash(bookUnitsData);
    const bookFileName = `${modeId}.${bookHash}.json`;
    const bookFilePath = path.join(BOOKS_DIR, bookFileName);

    fs.writeFileSync(bookFilePath, JSON.stringify({
      modeId,
      modeName,
      category,
      hash: bookHash,
      units: bookUnitsData,
      exportedAt: new Date().toISOString()
    }, null, 2), 'utf8');

    booksMeta[modeId] = {
      modeName,
      category,
      hash: bookHash,
      path: `data/books/${bookFileName}`,
      units: Object.keys(bookUnitsData)
    };
  }

  // 3. 全体を束ねる軽量インデックスマニフェストを作成
  const manifestIndex = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    materials: {
      hash: materialsHash,
      path: `data/${materialsFileName}`,
      count: materialsList.length
    },
    books: booksMeta
  };

  const indexPath = path.join(DATA_DIR, 'manifest-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(manifestIndex, null, 2), 'utf8');

  console.log('\n==> Manifest generation completed successfully!');
  console.log('    Index:', indexPath);
  console.log('    Data directory:', DATA_DIR);
}

main().catch(err => {
  console.error('\n[Error]', err);
  process.exit(1);
});
