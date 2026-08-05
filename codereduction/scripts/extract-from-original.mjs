/**
 * Extract index.html / コード.js into codereduction structure.
 * Run from repo root: node codereduction/scripts/extract-from-original.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const GAS_SRC = path.join(ROOT, 'コード.js');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readIndex() {
  return fs.readFileSync(INDEX, 'utf8');
}

function extractCss(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error('CSS not found');
  let css = m[1];
  // Remove dead compat placeholders mentioned in plan
  css = css.replace(/\/\*[\s\S]*?書き順ホスト[\s\S]*?\*\//g, '');
  css = css.replace(/\.kanji-stroke-order-host[\s\S]*?\}/g, '');
  return css.trim();
}

function extractBodyHtml(html) {
  const m = html.match(/<body>([\s\S]*?)<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/sortablejs/);
  if (!m) throw new Error('Body HTML not found');
  return m[1].trim();
}

function extractKpHtml(html) {
  const line = html.split('\n').find((l) => l.includes('window.KP_HTML'));
  if (!line) throw new Error('KP_HTML not found');
  const jsonPart = line.trim().replace(/^window\.KP_HTML\s*=\s*/, '').replace(/;\s*$/, '');
  const obj = JSON.parse(jsonPart);
  return obj.value;
}

function extractMainJs(html) {
  const marker = '// ▼ GASのURLを貼り付けてください';
  let idx = html.indexOf(marker);
  if (idx === -1) {
    const first = html.indexOf('const GAS_API_URL');
    idx = html.indexOf('const GAS_API_URL', first + 1);
    if (idx === -1) throw new Error('Main JS not found');
  }
  const scriptStart = html.lastIndexOf('<script>', idx);
  let js = html.slice(scriptStart + '<script>'.length);
  const endIdx = js.lastIndexOf('</script>');
  js = js.slice(0, endIdx);
  return js.trim();
}

function stripLegacyFromJs(js) {
  let out = js;

  out = out.replace(
    /function getUserPref\(key, defaultVal\) \{[\s\S]*?return oldVal !== null \? oldVal : defaultVal;\s*\}/,
    `function getUserPref(key, defaultVal) {
      const uid = getUserIdForPref();
      const val = localStorage.getItem(\`\${uid}_\${key}\`);
      return val !== null ? val : defaultVal;
    }`
  );

  out = out.replace(
    /const legacyH = parseInt\(getUserPref\('pen_canvas_height_px'[\s\S]*?Math\.round\(legacyH \* 1\.2\)\)\);\s*/g,
    ''
  );

  out = out.replace(
    /function openKanjiPracticePro\(\) \{[\s\S]*?\n    \}\n    function kpResizeFrameToContent/,
    `function openKanjiPracticePro() {
      const frame = document.getElementById('kp-pro-frame');
      if (!frame) return;
      const KP_EMBED_VER = "7";
      if (frame.dataset.kpEmbedVer !== KP_EMBED_VER) {
        frame.dataset.kpLoaded = "";
        frame.dataset.kpEmbedVer = KP_EMBED_VER;
      }
      if (frame.dataset.kpLoaded === "1") {
        syncKanjiHandScoreWeightsToFrame(frame);
        patchKanjiFrameForQuizPostMessage(frame);
        kpResizeFrameToContent();
        return;
      }
      if (!frame.src || frame.src.indexOf('kp-practice.html') < 0) {
        frame.src = 'assets/kp-practice.html';
      }
      frame.dataset.kpLoaded = "1";
      delete frame.dataset.kanjiQuizPatched;
      frame.addEventListener("load", function onKpEmbedLoad() {
        frame.removeEventListener("load", onKpEmbedLoad);
        syncKanjiHandScoreWeightsToFrame(frame);
        patchKanjiFrameForQuizPostMessage(frame);
      });
      setTimeout(function () {
        syncKanjiHandScoreWeightsToFrame(frame);
        patchKanjiFrameForQuizPostMessage(frame);
        kpResizeFrameToContent();
      }, 120);
      setTimeout(kpResizeFrameToContent, 700);
    }
    function kpResizeFrameToContent`
  );

  return out;
}

function splitJsIntoModules(js) {
  const modules = {
    'js/quiz/english/quiz.js': [],
    'js/quiz/kanji/quiz.js': [],
    'js/training.js': [],
    'js/rewards.js': [],
    'js/external.js': [],
    'js/parentAdmin.js': [],
    'js/materials.js': [],
    'js/home.js': [],
    'js/auth.js': [],
    'js/stopwatch.js': [],
    'js/kanjiLearning.js': [],
    'js/app-shared.js': [],
  };

  const lines = js.split('\n');
  let current = 'js/app-shared.js';
  const assign = (name) => { current = name; };

  for (const line of lines) {
    const fn = line.match(/^    function (\w+)/);
    if (fn) {
      const n = fn[1];
      if (/^(fetchUsers|verifyPin|addPin|clearPin|deletePin|cancelPin|preparePinReset|changePin|logout|loadUsers)/.test(n)) assign('js/auth.js');
      else if (/^(showHome|refreshMaterials|clearAppCache|resumeQuiz|discardQuiz|openKanjiLearning|openTrainingMenu|openParentAdmin|loadEnglishMaterials)/.test(n)) assign('js/home.js');
      else if (/^(loadMaterials|loadKanjiMaterials|showMaterials|selectUnit|prepareQuizSettings)/.test(n)) assign('js/materials.js');
      else if (/^(startStopwatch|stopStopwatch|resetStopwatch|tickStopwatch|syncStopwatch|renderStopwatch)/.test(n)) assign('js/stopwatch.js');
      else if (/^(loadTraining|startRoute|renderTraining|openTraining|saveTraining)/.test(n)) assign('js/training.js');
      else if (/^(loadRewards|loadInventory|exchangeReward|consumeReward|renderReward)/.test(n)) assign('js/rewards.js');
      else if (/^(loadExternal|submitExternal|approveExternal|rejectExternal|renderExternal)/.test(n)) assign('js/external.js');
      else if (/^(openParentAdmin|saveTrainingMenu|deleteTrainingRoute|saveParentNotify|renderTrainingAdmin)/.test(n)) assign('js/parentAdmin.js');
      else if (/^(openKanji|loadKanjiQuiz|renderKanji|submitKanji|startKanji|kanjiQuiz)/.test(n)) assign('js/quiz/kanji/quiz.js');
      else if (/^(prepareQuiz|showQuestion|checkAnswer|finishQuiz|renderCustomKeyboard|initializePen|flash|sortable|doSubmit)/.test(n)) assign('js/quiz/english/quiz.js');
      else if (/^(openKanjiPractice|openKanjiNigate|setKanjiHw)/.test(n)) assign('js/kanjiLearning.js');
    }
    modules[current].push(line);
  }

  return modules;
}

function buildSlimGas(src) {
  let gas = src;
  const removeFns = [
    'migrateTrainingProgressIfNeeded_',
    'migrateEnglishUnitHistoryFromUserJson_',
    'migrateKanjiHistoryFromUserJson_',
    'loadEnglishUnitHistoryWithMigration_',
  ];
  for (const fn of removeFns) {
    const re = new RegExp(`function ${fn}[\\s\\S]*?\\n\\}`, 'g');
    gas = gas.replace(re, '');
  }
  // Simplify buildKanjiHistoryView_ - remove legacy fallback
  gas = gas.replace(
    /function buildKanjiHistoryView_\(adminSs, userId, legacyHistoryJson\) \{[\s\S]*?\n\}/,
    `function buildKanjiHistoryView_(adminSs, userId) {
  const buckets = ['__kanjiChallenge', '__kanjiWeak', '__kanjiNigatePass'];
  const view = {};
  buckets.forEach(b => { view[b] = loadKanjiHistoryBucket_(adminSs, userId, b) || {}; });
  return view;
}`
  );
  // normalizeProgressForMenu_ - nested only
  gas = gas.replace(
    /function normalizeProgressForMenu_\(todayBlock, menuId\) \{[\s\S]*?\n\}/,
    `function normalizeProgressForMenu_(todayBlock, menuId) {
  if (!todayBlock || typeof todayBlock !== 'object') return {};
  const mid = String(menuId || '1');
  const block = todayBlock[mid];
  return block && typeof block === 'object' ? block : {};
}`
  );
  // getTrainingMenuSheet_ - no legacy sheet name
  gas = gas.replace(
    /function getTrainingMenuSheet_\(adminSs, menuId\) \{[\s\S]*?\n\}/,
    `function getTrainingMenuSheet_(adminSs, menuId) {
  const id = String(menuId || '1');
  return adminSs.getSheetByName('特訓メニュー' + id);
}`
  );
  return gas;
}

function main() {
  console.log('Reading', INDEX);
  const html = readIndex();
  ensureDir(path.join(OUT, 'css'));
  ensureDir(path.join(OUT, 'assets'));
  ensureDir(path.join(OUT, 'js/adapters'));
  ensureDir(path.join(OUT, 'js/quiz/english'));
  ensureDir(path.join(OUT, 'js/quiz/kanji'));
  ensureDir(path.join(OUT, 'gas'));

  const css = extractCss(html);
  fs.writeFileSync(path.join(OUT, 'css/app.css'), css, 'utf8');
  console.log('Wrote css/app.css', css.length, 'chars');

  const body = extractBodyHtml(html);
  fs.writeFileSync(path.join(OUT, '_body.html'), body, 'utf8');

  const kp = extractKpHtml(html);
  fs.writeFileSync(path.join(OUT, 'assets/kp-practice.html'), kp, 'utf8');
  console.log('Wrote assets/kp-practice.html', kp.length, 'chars');

  let js = extractMainJs(html);
  js = stripLegacyFromJs(js);
  fs.writeFileSync(path.join(OUT, 'js/_app-legacy-stripped.js'), js, 'utf8');
  console.log('Wrote js/_app-legacy-stripped.js', js.split('\n').length, 'lines');

  const modules = splitJsIntoModules(js);
  for (const [rel, lines] of Object.entries(modules)) {
    if (!lines.length) continue;
    const fp = path.join(OUT, rel);
    ensureDir(path.dirname(fp));
    fs.writeFileSync(fp, lines.join('\n'), 'utf8');
    console.log('Wrote', rel, lines.length, 'lines');
  }

  const gasSrc = fs.readFileSync(GAS_SRC, 'utf8');
  const slimGas = buildSlimGas(gasSrc);
  fs.writeFileSync(path.join(OUT, 'gas/コード.js'), slimGas, 'utf8');
  console.log('Wrote gas/コード.js', slimGas.split('\n').length, 'lines');

  fs.copyFileSync(path.join(ROOT, 'appsscript.json'), path.join(OUT, 'gas/appsscript.json'));
  if (fs.existsSync(path.join(ROOT, 'kanji-vg.js'))) {
    fs.copyFileSync(path.join(ROOT, 'kanji-vg.js'), path.join(OUT, 'kanji-vg.js'));
  }
  console.log('Done.');
}

main();
