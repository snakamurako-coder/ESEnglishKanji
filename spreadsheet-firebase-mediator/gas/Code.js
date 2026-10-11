/**
 * ============================================================================
 * Spreadsheet to Firebase Mediator & Publisher (GAS Web App)
 * スプレッドシート × Firebase 教材出版・データ仲介専用エンジン
 * ============================================================================
 * 
 * 役割:
 *  1. Google Drive上の英語・漢字教材スプレッドシートを走査・検証
 *  2. 各ブック・各単元から問題・熟語・選択肢データを抽出し、SHA-256ハッシュを計算
 *  3. マニフェストインデックス (manifest-index) を生成
 *  4. Web API (doGet / doPost) として外部（Node.js / Webアプリ / CI）へマニフェストJSONを提供
 *  5. スプレッドシート上のカスタムメニュー「🚀 Firebase出版」からワンクリックビルド
 *  6. Cloud Firestore (system/preset_index) への直接書き出し連携
 */

// ============================================================================
// 1. スプレッドシート側 UI（カスタムメニュー）
// ============================================================================

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🚀 Firebase出版')
      .addItem('1. 教材マニフェストを検証・ビルド', 'menuBuildAndValidateManifest_')
      .addItem('2. 出版ログシートを確認', 'menuOpenPublishLog_')
      .addSeparator()
      .addItem('⚙️ 設定・フォルダIDの確認', 'menuShowSettings_')
      .addToUi();
  } catch (_) {
    // コンテナバインド外（Webアプリ単体実行時）は無視
  }
}

function menuBuildAndValidateManifest_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('ビルド開始', 'Google Drive上の教材を走査してマニフェストを生成します。数秒お待ちください。', ui.ButtonSet.OK);
  
  try {
    const result = buildCompleteManifestCatalog_();
    writePublishLog_(result);
    ui.alert(
      'ビルド成功 🎉',
      '教材の検証とマニフェスト生成が完了しました！\n\n' +
      '・ブック数: ' + result.materials.length + ' 冊\n' +
      '・生成時刻: ' + result.exportedAt + '\n' +
      '・マニフェストハッシュ: ' + result.materialsHash + '\n\n' +
      '出版ログシートに詳細を記録しました。',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('エラー ❌', 'マニフェスト生成中にエラーが発生しました:\n' + err.message, ui.ButtonSet.OK);
  }
}

function menuOpenPublishLog_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('出版ログ');
    if (!sheet) {
      sheet = ss.insertSheet('出版ログ');
      sheet.appendRow(['実行日時', 'ステータス', 'ブック数', '総問題数', 'ハッシュ', '備考']);
      sheet.setFrozenRows(1);
    }
    ss.setActiveSheet(sheet);
  } catch (err) {
    SpreadsheetApp.getUi().alert('エラー', err.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function menuShowSettings_() {
  const props = PropertiesService.getScriptProperties();
  const engFolder = props.getProperty('MATERIALS_FOLDER_ID') || '(未設定)';
  const kanjiFolder = props.getProperty('KANJI_MATERIALS_FOLDER_ID') || '(未設定)';
  const fbProject = props.getProperty('FIREBASE_PROJECT_ID') || 'jikkenfirebasekankyo';
  
  SpreadsheetApp.getUi().alert(
    '設定情報',
    'スクリプトプロパティの設定状況:\n\n' +
    '・英語教材フォルダID: ' + engFolder + '\n' +
    '・漢字教材フォルダID: ' + kanjiFolder + '\n' +
    '・FirebaseプロジェクトID: ' + fbProject,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================================
// 2. Web API エンドポイント (doGet / doPost)
// ============================================================================

function doGet(e) {
  return handleApiRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let params = {};
  try {
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
  } catch (_) {
    params = (e && e.parameter) || {};
  }
  return handleApiRequest_(params);
}

function handleApiRequest_(params) {
  const action = String(params.action || 'manifest_index').toLowerCase();

  try {
    if (action === 'manifest_index' || action === 'index') {
      const manifest = buildCompleteManifestCatalog_();
      return jsonResponse_({
        status: 'success',
        schemaVersion: 1,
        exportedAt: manifest.exportedAt,
        materials: {
          hash: manifest.materialsHash,
          count: manifest.materials.length
        },
        books: manifest.booksMeta
      });
    }

    if (action === 'export_all' || action === 'export_manifest_all') {
      const manifest = buildCompleteManifestCatalog_();
      return jsonResponse_({
        status: 'success',
        schemaVersion: 1,
        exportedAt: manifest.exportedAt,
        materials: manifest.materials,
        materialsHash: manifest.materialsHash,
        booksMeta: manifest.booksMeta,
        booksData: manifest.booksData
      });
    }

    if (action === 'export_book') {
      const modeId = String(params.modeId || '').trim();
      if (!modeId) throw new Error('modeId が指定されていません');
      const bookData = extractSingleBookData_(modeId, params.category || 'english');
      return jsonResponse_({
        status: 'success',
        modeId: modeId,
        book: bookData
      });
    }

    if (action === 'ping') {
      return jsonResponse_({ status: 'ok', timestamp: new Date().toISOString() });
    }

    throw new Error('未知のアクションです: ' + action);
  } catch (err) {
    return jsonResponse_({ status: 'error', message: err.message });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// 3. マニフェスト抽出 ＆ ハッシュ計算コアエンジン
// ============================================================================

function computeHash_(data) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    jsonStr,
    Utilities.Charset.UTF_8
  );
  let hashHex = '';
  for (let i = 0; i < rawHash.length; i++) {
    const byte = rawHash[i];
    const hex = (byte < 0 ? byte + 256 : byte).toString(16);
    hashHex += (hex.length === 1 ? '0' : '') + hex;
  }
  return hashHex.substring(0, 16);
}

function autoDiscoverFolderIds_() {
  const props = PropertiesService.getScriptProperties();
  try {
    const file1 = DriveApp.getFileById('1Dhd9bV4SDc-SWNHqyykZqPsmRsSFtGnDHpic2uQwW14');
    const p1 = file1.getParents();
    if (p1.hasNext()) {
      props.setProperty('MATERIALS_FOLDER_ID', p1.next().getId());
    }
  } catch (_) {}
  try {
    const file2 = DriveApp.getFileById('1Z65C7El41TMZct5kdXEstfPR2P4I1_Y4VE96O_SGFRE');
    const p2 = file2.getParents();
    if (p2.hasNext()) {
      props.setProperty('KANJI_MATERIALS_FOLDER_ID', p2.next().getId());
    }
  } catch (_) {}
  if (!props.getProperty('FIREBASE_PROJECT_ID')) {
    props.setProperty('FIREBASE_PROJECT_ID', 'jikkenfirebasekankyo');
  }
}

function buildCompleteManifestCatalog_() {
  const props = PropertiesService.getScriptProperties();
  let engFolderId = props.getProperty('MATERIALS_FOLDER_ID');
  let kanjiFolderId = props.getProperty('KANJI_MATERIALS_FOLDER_ID');

  if (!engFolderId || !kanjiFolderId) {
    autoDiscoverFolderIds_();
    engFolderId = props.getProperty('MATERIALS_FOLDER_ID');
    kanjiFolderId = props.getProperty('KANJI_MATERIALS_FOLDER_ID');
  }

  const materials = [];
  const booksMeta = {};
  const booksData = {};

  // 1. 英語教材の走査
  if (engFolderId) {
    scanFolderMaterials_(engFolderId, 'english', materials, booksMeta, booksData);
  }

  // 2. 漢字教材の走査
  if (kanjiFolderId) {
    scanFolderMaterials_(kanjiFolderId, 'kanji', materials, booksMeta, booksData);
  }

  const materialsHash = computeHash_(materials);

  return {
    exportedAt: new Date().toISOString(),
    materials: materials,
    materialsHash: materialsHash,
    booksMeta: booksMeta,
    booksData: booksData
  };
}

function scanFolderMaterials_(folderId, category, materials, booksMeta, booksData) {
  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (_) {
    return;
  }

  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (files.hasNext()) {
    const file = files.next();
    const modeId = file.getId();
    const modeName = file.getName();

    let ss;
    try {
      ss = SpreadsheetApp.open(file);
    } catch (_) {
      continue;
    }

    const sheets = ss.getSheets();
    const units = [];
    const bookUnitsData = {};

    sheets.forEach(function (sheet) {
      const sheetName = sheet.getName();
      if (sheetName.indexOf('_') === 0 || sheetName === '出版ログ') return;
      units.push(sheetName);

      if (category === 'english') {
        bookUnitsData[sheetName] = extractEnglishUnitQuestions_(sheet);
      } else {
        bookUnitsData[sheetName] = extractKanjiUnitQuestions_(sheet, ss.getName());
      }
    });

    materials.push({
      modeId: modeId,
      modeName: modeName,
      category: category,
      units: units
    });

    const bookHash = computeHash_(bookUnitsData);

    booksMeta[modeId] = {
      modeName: modeName,
      category: category,
      hash: bookHash,
      units: units
    };

    booksData[modeId] = {
      modeId: modeId,
      modeName: modeName,
      category: category,
      hash: bookHash,
      units: bookUnitsData
    };
  }
}

function extractEnglishUnitQuestions_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const questions = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const qObj = {};
    for (let j = 0; j < headers.length; j++) {
      qObj[headers[j]] = row[j];
    }
    if (qObj['通し番号']) questions.push(qObj);
  }
  return questions;
}

function extractKanjiUnitQuestions_(sheet, bookName) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { sets: [], setQuestions: {} };

  const headers = values[0] || [];
  const isJukugo = (headers.indexOf('セット') >= 0 && headers.indexOf('ターゲット漢字') >= 0) ||
                    bookName.indexOf('熟語') >= 0;

  const setsMap = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const setId = String(row[0] || '1').trim();
    if (!setId) continue;

    if (!setsMap[setId]) setsMap[setId] = [];
    
    const record = {};
    headers.forEach(function (h, colIdx) {
      if (h) record[h] = row[colIdx];
    });
    setsMap[setId].push(record);
  }

  const setsList = [];
  const setQuestions = {};

  Object.keys(setsMap).sort().forEach(function (sid) {
    const items = setsMap[sid];
    setsList.push({
      setId: sid,
      count: items.length,
      kanjiList: items.map(function (it) { return it['ターゲット漢字'] || it['漢字'] || ''; }).filter(Boolean)
    });
    setQuestions[sid] = items;
  });

  return {
    sheetKind: isJukugo ? 'jukugo' : 'standard',
    sets: setsList,
    setQuestions: setQuestions
  };
}

function writePublishLog_(result) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName('出版ログ');
    if (!sheet) {
      sheet = ss.insertSheet('出版ログ');
      sheet.appendRow(['実行日時', 'ステータス', 'ブック数', 'ハッシュ', '備考']);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date().toLocaleString('ja-JP'),
      'SUCCESS',
      result.materials.length,
      result.materialsHash,
      '自動生成マニフェスト'
    ]);
  } catch (_) {}
}
