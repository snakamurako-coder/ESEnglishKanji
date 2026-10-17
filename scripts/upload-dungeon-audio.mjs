/**
 * 単語迷宮 SE/BGM を Firebase Storage へアップロード
 * 配置先: materials/dungeon/SE/{fileName}
 *
 * 使い方:
 *   node scripts/upload-dungeon-audio.mjs
 *   node scripts/upload-dungeon-audio.mjs --src "C:/path/to/SE"
 *
 * Firebase CLI にログイン済みであること（firebase login）
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUCKET = 'jikkenfirebasekankyo.firebasestorage.app';
const STORAGE_PREFIX = 'materials/dungeon/SE/';

// Firebase CLI が使う OAuth クライアント（公開クライアントID）
const FIREBASE_CLI_CLIENT = {
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'jMMCUInJn7qzCrdLbmB-vHzF'
};

function parseArgs(argv) {
  const out = { src: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src' && argv[i + 1]) {
      out.src = argv[++i];
    }
  }
  return out;
}

function defaultSrcCandidates() {
  return [
    path.join(PROJECT_ROOT, 'SE'),
    path.join(PROJECT_ROOT, '..', 'DungeonRPGindex', 'SE'),
    path.join(process.env.USERPROFILE || '', 'コード開発', 'Projects', 'DungeonRPGindex', 'SE')
  ];
}

function resolveSrcDir(cliSrc) {
  if (cliSrc) {
    const abs = path.resolve(cliSrc);
    if (!fs.existsSync(abs)) throw new Error('ソースフォルダがありません: ' + abs);
    return abs;
  }
  for (const c of defaultSrcCandidates()) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('SE フォルダが見つかりません。--src で指定してください。');
}

function loadFirebaseTokens() {
  const cfgPath = path.join(process.env.USERPROFILE || '', '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error('firebase-tools.json がありません。先に firebase login してください。');
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (!cfg.tokens || !cfg.tokens.refresh_token) {
    throw new Error('Firebase の refresh_token がありません。firebase login し直してください。');
  }
  return cfg.tokens;
}

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json, buf });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function refreshAccessToken(tokens) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: FIREBASE_CLI_CLIENT.client_id,
    client_secret: FIREBASE_CLI_CLIENT.client_secret
  }).toString();

  const res = await httpsRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (res.status !== 200 || !res.json || !res.json.access_token) {
    throw new Error('アクセストークン取得失敗: ' + (res.text || res.status));
  }
  return res.json.access_token;
}

async function uploadFile(accessToken, localPath, objectName) {
  const data = fs.readFileSync(localPath);
  const encodedName = encodeURIComponent(objectName);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodedName}`;
  const res = await httpsRequest(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'audio/mpeg',
      'Content-Length': data.length
    }
  }, data);

  if (res.status !== 200) {
    throw new Error(`upload failed ${path.basename(localPath)}: HTTP ${res.status} ${res.text.slice(0, 200)}`);
  }
  return res.json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const srcDir = resolveSrcDir(args.src);
  const files = fs.readdirSync(srcDir)
    .filter((f) => /\.(mp3|m4a|ogg|wav|aac)$/i.test(f))
    .sort();

  if (!files.length) {
    throw new Error('音声ファイルがありません: ' + srcDir);
  }

  console.log(`[upload-dungeon-audio] src=${srcDir}`);
  console.log(`[upload-dungeon-audio] files=${files.length} → gs://${BUCKET}/${STORAGE_PREFIX}`);

  const tokens = loadFirebaseTokens();
  const accessToken = await refreshAccessToken(tokens);

  let ok = 0;
  let fail = 0;
  for (const file of files) {
    const localPath = path.join(srcDir, file);
    const objectName = STORAGE_PREFIX + file;
    try {
      await uploadFile(accessToken, localPath, objectName);
      ok++;
      console.log(`  OK  ${file}`);
    } catch (err) {
      fail++;
      console.error(`  NG  ${file}: ${err.message || err}`);
    }
  }

  console.log(`[upload-dungeon-audio] done ok=${ok} fail=${fail}`);
  if (fail) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[upload-dungeon-audio] FATAL:', err.message || err);
  process.exit(1);
});
