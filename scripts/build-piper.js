/**
 * scripts/build-piper.js
 * esbuild を用いて Piper TTS エンジンをブラウザ向け単一 bundle (js/lib/piper.bundle.js) にビルド
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  const outDir = path.join(__dirname, '..', 'js', 'lib');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outfile = path.join(outDir, 'piper.bundle.js');
  console.log(`[build-piper] Piper TTS バンドルをビルド中 -> ${outfile}`);

  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'src', 'piper', 'index.js')],
    bundle: true,
    minify: false,
    format: 'iife',
    globalName: 'PiperTTSModule',
    external: ['fs', 'path'],
    target: ['chrome90', 'edge90', 'safari15', 'firefox90'],
    outfile: outfile,
    sourcemap: false
  });

  const stats = fs.statSync(outfile);
  console.log(`[build-piper] ビルド成功！ サイズ: ${(stats.size / 1024).toFixed(1)} KB`);
}

build().catch((err) => {
  console.error('[build-piper] ビルド失敗:', err);
  process.exit(1);
});
