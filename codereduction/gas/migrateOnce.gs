/**
 * 管理者が Apps Script エディタから1回だけ実行するデータ移行。
 * 実行後は slim コード.js がランタイム互換分岐を持たない前提で運用する。
 *
 * 使い方: runMigrateOnce() を選択して実行
 * または doPost action: run_migrate_once（管理者PIN必須・完了後はスキップ）
 */
function runMigrateOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRATE_ONCE_DONE_V2') === '1') {
    return 'already migrated (MIGRATE_ONCE_DONE_V2=1)';
  }
  const adminSs = SpreadsheetApp.openById(props.getProperty('ADMIN_SS_ID'));
  const usersSheet = adminSs.getSheetByName('users');
  const log = [];

  log.push(migrateAllUsersTrainingProgress_(usersSheet));
  log.push(migrateAllEnglishUnitHistory_(adminSs, usersSheet));
  log.push(migrateAllKanjiHistoryBuckets_(adminSs, usersSheet));
  log.push(ensureAppSettingsThreeColumn_(adminSs));

  props.setProperty('MIGRATE_ONCE_DONE_V2', '1');
  const text = log.join('\n');
  Logger.log(text);
  return text;
}

function handleRunMigrateOnce(req) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRATE_ONCE_DONE_V2') === '1') {
    return sendResponse({ status: 'success', log: 'already migrated (MIGRATE_ONCE_DONE_V2=1)' });
  }
  const adminSs = SpreadsheetApp.openById(props.getProperty('ADMIN_SS_ID'));
  const v = verifyExternalAdminPin_(adminSs, req && req.adminPin);
  if (!v.ok) return sendResponse({ status: 'error', message: v.message });
  const log = runMigrateOnce();
  return sendResponse({ status: 'success', log: log });
}

function migrateAllUsersTrainingProgress_(usersSheet) {
  const data = usersSheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const tp = safeParseUserJsonCell_(data[i][7], {});
    const before = JSON.stringify(tp);
    migrateTrainingProgressAllDates_(tp);
    if (JSON.stringify(tp) !== before) {
      usersSheet.getRange(i + 1, 8).setValue(JSON.stringify(tp));
      count++;
    }
  }
  return 'trainingProgress migrated rows: ' + count;
}

function migrateTrainingProgressAllDates_(trainingProgressJson) {
  if (!trainingProgressJson || typeof trainingProgressJson !== 'object') return;
  Object.keys(trainingProgressJson).forEach(function (dateKey) {
    const t = trainingProgressJson[dateKey];
    if (!t || typeof t !== 'object') return;
    var hasNestedMenu = false;
    for (var k in t) {
      if (['1','2','3','4','5','6','7','8','9','10','11','12'].indexOf(String(k)) >= 0) {
        if (t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) {
          hasNestedMenu = true;
          break;
        }
      }
    }
    if (hasNestedMenu) return;
    var hasFlatTrue = false;
    for (var k2 in t) {
      if (t[k2] === true) { hasFlatTrue = true; break; }
    }
    if (!hasFlatTrue) return;
    var nested = {};
    for (var k3 in t) {
      if (t[k3] === true) nested[k3] = true;
    }
    trainingProgressJson[dateKey] = { '1': nested };
  });
}

function migrateAllEnglishUnitHistory_(adminSs, usersSheet) {
  ensureEnglishUnitHistorySheet_(adminSs);
  const data = usersSheet.getDataRange().getValues();
  let units = 0;
  for (let i = 1; i < data.length; i++) {
    const userId = data[i][0];
    const hist = safeParseUserJsonCell_(data[i][5], {});
    const unitKeys = Object.keys(hist).filter(function (k) { return k && !String(k).startsWith('__'); });
    unitKeys.forEach(function (unitId) {
      const legacy = hist[unitId];
      if (!legacy || typeof legacy !== 'object') return;
      let map = loadEnglishUnitHistory_(adminSs, userId, unitId);
      if (!map || Object.keys(map).length === 0) map = legacy;
      saveEnglishUnitHistory_(adminSs, userId, unitId, map, new Date().toISOString());
      delete hist[unitId];
      units++;
    });
    if (unitKeys.length) {
      const userData = {
        historyJson: hist,
        lastStudyJson: safeParseUserJsonCell_(data[i][4], {}),
        dailyPointsJson: safeParseUserJsonCell_(data[i][6], {}),
        trainingProgressJson: safeParseUserJsonCell_(data[i][7], {})
      };
      normalizeUserJsonBeforeSave_(userData);
      usersSheet.getRange(i + 1, 6).setValue(JSON.stringify(userData.historyJson));
    }
  }
  return 'english unit history migrated: ' + units;
}

function migrateAllKanjiHistoryBuckets_(adminSs, usersSheet) {
  ensureKanjiHistorySheet_(adminSs);
  const buckets = ['__kanjiChallenge', '__kanjiWeak', '__kanjiNigatePass'];
  const data = usersSheet.getDataRange().getValues();
  let moved = 0;
  for (let i = 1; i < data.length; i++) {
    const userId = data[i][0];
    const hist = safeParseUserJsonCell_(data[i][5], {});
    buckets.forEach(function (bucket) {
      const legacy = hist[bucket];
      if (!legacy || typeof legacy !== 'object') return;
      let map = loadKanjiHistoryBucket_(adminSs, userId, bucket);
      if (!map || Object.keys(map).length === 0) {
        saveKanjiHistoryBucket_(adminSs, userId, bucket, legacy, new Date().toISOString());
        moved++;
      }
      delete hist[bucket];
    });
    const userData = {
      historyJson: hist,
      lastStudyJson: safeParseUserJsonCell_(data[i][4], {}),
      dailyPointsJson: safeParseUserJsonCell_(data[i][6], {}),
      trainingProgressJson: safeParseUserJsonCell_(data[i][7], {})
    };
    normalizeUserJsonBeforeSave_(userData);
    usersSheet.getRange(i + 1, 6).setValue(JSON.stringify(userData.historyJson));
  }
  return 'kanji history buckets migrated: ' + moved;
}

function ensureAppSettingsThreeColumn_(adminSs) {
  const sheet = adminSs.getSheetByName('アプリ設定');
  if (!sheet) return 'app settings sheet missing';
  ensureAppSettingsSheetStructure_(sheet, { settings: {}, created: false });
  return 'app settings structure ensured';
}
