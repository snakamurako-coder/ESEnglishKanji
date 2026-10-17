/**
 * ============================================================================
 * Spreadsheet to Firebase Mediator & Publisher (GAS Web App)
 * スプレッドシート × Firebase 教材出版・データ仲介専用エンジン
 * ============================================================================
 * 
 * 役割（仲介GASの2大責務）:
 *  【上流】教材のマニフェスト化（Spreadsheet → Firebase Publishing）:
 *    1. Google Drive上の英語・漢字教材スプレッドシートを走査・検証
 *    2. 各ブック・各単元から問題・熟語・選択肢データを抽出し、SHA-256ハッシュを計算
 *    3. マニフェストインデックス (manifest-index) および各単元JSONを生成
 *    4. Web API (doGet / doPost) として外部（CLI / Webアプリ / CI）へマニフェストJSONを提供
 *    5. スプレッドシート上のカスタムメニュー「🚀 Firebase出版 & データ仲介」からワンクリックビルド
 * 
 *  【下流】取り組み作業の仲介・集約（Firebase → Spreadsheet Logging）:
 *    1. アプリ（Firebase）で実施されたクイズ結果（セッション）をリアルタイム/バッチで受領
 *    2. スプレッドシートの「取り組み履歴」シートへ自動追記・アーカイブ（重複排除）
 *    3. 保護者がスプレッドシート上で学習推移・正答率・獲得ポイントを確認可能
 *    4. 日次学習サマリーメールの自動配信
 */

// ============================================================================
// 1. スプレッドシート側 UI（カスタムメニュー）
// ============================================================================

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🚀 Firebase出版 & データ仲介')
      .addItem('1. 📚 教材マニフェストを検証・ビルド', 'menuBuildAndValidateManifest_')
      .addItem('2. 📥 取り組み記録シートを確認・更新', 'menuOpenStudyLogSheet_')
      .addItem('3. ✉️ 本日の学習サマリーをメール送信', 'menuSendDailyStudyReport_')
      .addSeparator()
      .addItem('4. 💾 全設定＆教材スプレッドシート一括出力（バックアップ）', 'menuExportFullBackupSpreadsheets_')
      .addSeparator()
      .addItem('⚙️ 設定・フォルダID・連携状況の確認', 'menuShowSettings_')
      .addToUi();
  } catch (_) {
    // コンテナバインド外（Webアプリ単体実行時）は無視
  }
}

/**
 * 4. 全設定＆教材スプレッドシート一括出力（バックアップ）メニューハンドラ
 */
function menuExportFullBackupSpreadsheets_() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('完全バックアップの生成', '現在の全設定および各教材ブック（5冊）をGoogleドライブへ見出し付きで一括生成します。数秒〜数十秒かかります。開始しますか？', ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;

  try {
    const result = exportFullBackupSpreadsheets_();
    ui.alert(
      'エクスポート完了 🎉',
      'Googleドライブに見出し・書式付きで全ブックを生成しました！\n\n' +
      '・フォルダ名: ' + result.folderName + '\n' +
      '・生成日時: ' + result.exportedAt + '\n\n' +
      'フォルダURL:\n' + result.folderUrl,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('エラー ❌', 'エクスポートに失敗しました:\n' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * 1. 教材マニフェストを検証・ビルド
 */
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

/**
 * 2. 取り組み記録シートを開く
 */
function menuOpenStudyLogSheet_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    const sheet = getOrCreateStudyLogSheet_(ss);
    ss.setActiveSheet(sheet);
  } catch (err) {
    SpreadsheetApp.getUi().alert('エラー', err.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 3. 本日の学習サマリーをメール送信
 */
function menuSendDailyStudyReport_() {
  const ui = SpreadsheetApp.getUi();
  try {
    const report = sendDailyStudyReport_();
    ui.alert(
      'メール送信完了 ✉️',
      '本日の学習サマリーを送信しました。\n\n' +
      '・対象セッション数: ' + report.sessionCount + ' 件\n' +
      '・合計獲得ポイント: ' + report.totalPoints + ' Pt\n' +
      '・送信先: ' + (report.recipients.join(', ') || '設定なし'),
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('エラー ❌', 'メール送信に失敗しました:\n' + err.message, ui.ButtonSet.OK);
  }
}

/**
 * 設定確認ダイアログ
 */
function menuShowSettings_() {
  const props = PropertiesService.getScriptProperties();
  const engFolder = props.getProperty('MATERIALS_FOLDER_ID') || '(未設定)';
  const kanjiFolder = props.getProperty('KANJI_MATERIALS_FOLDER_ID') || '(未設定)';
  const fbProject = props.getProperty('FIREBASE_PROJECT_ID') || 'jikkenfirebasekankyo';
  const emails = props.getProperty('NOTIFY_EMAILS') || '(未設定)';
  
  SpreadsheetApp.getUi().alert(
    '設定情報',
    'スクリプトプロパティの設定状況:\n\n' +
    '・英語教材フォルダID: ' + engFolder + '\n' +
    '・漢字教材フォルダID: ' + kanjiFolder + '\n' +
    '・FirebaseプロジェクトID: ' + fbProject + '\n' +
    '・通知メールアドレス: ' + emails,
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
    // ------------------------------------------------------------------------
    // 【上流】教材マニフェスト取得 API
    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    // 【下流】取り組み作業の記録・集約 API
    // ------------------------------------------------------------------------
    if (action === 'log_learning_session' || action === 'save_learning_session' || action === 'log_session') {
      const recordResult = recordLearningSessionToSheet_(params);
      return jsonResponse_({
        status: 'success',
        recorded: recordResult.recorded,
        alreadyProcessed: recordResult.alreadyProcessed,
        rowNumber: recordResult.rowNumber
      });
    }

    if (action === 'sync_sessions' || action === 'batch_sync_sessions') {
      const sessions = Array.isArray(params.sessions) ? params.sessions : [];
      let added = 0;
      sessions.forEach(function (s) {
        const res = recordLearningSessionToSheet_(s);
        if (res.recorded) added++;
      });
      return jsonResponse_({
        status: 'success',
        total: sessions.length,
        addedCount: added
      });
    }

    if (action === 'daily_report') {
      const report = sendDailyStudyReport_();
      return jsonResponse_({
        status: 'success',
        report: report
      });
    }

    // ------------------------------------------------------------------------
    // 【バックアップ】全設定＆教材スプレッドシート一括出力 API
    // ------------------------------------------------------------------------
    if (action === 'export_full_backup' || action === 'backup_spreadsheets') {
      const backupResult = exportFullBackupSpreadsheets_();
      return jsonResponse_({
        status: 'success',
        folderName: backupResult.folderName,
        folderUrl: backupResult.folderUrl,
        exportedAt: backupResult.exportedAt,
        files: backupResult.files
      });
    }

    if (action === 'import_full_config' || action === 'fetch_backup_spreadsheet_data') {
      const importResult = importFullConfigSpreadsheets_(body);
      return jsonResponse_(importResult);
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
// 3. マニフェスト抽出 ＆ ハッシュ計算コアエンジン（上流パイプライン）
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
      if (sheetName.indexOf('_') === 0 || sheetName === '出版ログ' || sheetName === '取り組み履歴') return;
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
      path: 'data/books/' + modeId + '.' + bookHash + '.json',
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

function extractSingleBookData_(modeId, category) {
  const ss = SpreadsheetApp.openById(modeId);
  const sheets = ss.getSheets();
  const bookUnitsData = {};

  sheets.forEach(function (sheet) {
    const sheetName = sheet.getName();
    if (sheetName.indexOf('_') === 0 || sheetName === '出版ログ' || sheetName === '取り組み履歴') return;
    if (category === 'english') {
      bookUnitsData[sheetName] = extractEnglishUnitQuestions_(sheet);
    } else {
      bookUnitsData[sheetName] = extractKanjiUnitQuestions_(sheet, ss.getName());
    }
  });

  return {
    modeId: modeId,
    modeName: ss.getName(),
    category: category,
    hash: computeHash_(bookUnitsData),
    units: bookUnitsData
  };
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
      const h = String(headers[j] || '').trim();
      if (h) {
        qObj[h] = row[j];
      }
    }
    if (qObj['通し番号']) questions.push(qObj);
  }
  return questions;
}

function extractKanjiUnitQuestions_(sheet, bookName) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { sets: [], setQuestions: {}, sheetKind: 'standard' };

  const headers = (values[0] || []).map(function (h) { return String(h || '').trim(); });
  const isJukugo = (headers.indexOf('セット') >= 0 && headers.indexOf('ターゲット漢字') >= 0) ||
                    String(bookName || '').indexOf('熟語') >= 0 ||
                    headers.some(function (h) { return /^漢字熟語[A-CＡ-Ｃ]$/.test(h); });

  // 「セット」列を優先。無い場合のみ1列目（通し番号と誤認しやすいので注意）
  const setCol = headers.indexOf('セット');
  const setsMap = {};
  const setOrder = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const setRaw = setCol >= 0 ? row[setCol] : row[0];
    const setId = String(setRaw != null && setRaw !== '' ? setRaw : '1').trim();
    if (!setId) continue;

    if (!setsMap[setId]) {
      setsMap[setId] = [];
      setOrder.push(setId);
    }

    const record = { rowIndex: i + 1 };
    headers.forEach(function (h, colIdx) {
      if (h) record[h] = row[colIdx];
    });
    // セット列が数値のまま残ると後段でキー不一致になるため文字列に揃える
    if (setCol >= 0) record['セット'] = setId;
    setsMap[setId].push(record);
  }

  const setsList = [];
  const setQuestions = {};

  setOrder.forEach(function (sid) {
    const items = setsMap[sid] || [];
    const kanjiList = [];
    const seen = {};
    items.forEach(function (it) {
      const k = String(it['ターゲット漢字'] || it['漢字'] || '').trim();
      if (!k || seen[k]) return;
      seen[k] = true;
      kanjiList.push(k);
    });
    setsList.push({
      setId: sid,
      count: items.length,
      kanjiList: kanjiList
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

// ============================================================================
// 4. 取り組み作業の集約 ＆ スプレッドシート追記（下流パイプライン）
// ============================================================================

/**
 * 「取り組み履歴」シートを取得、なければ新設
 */
function getOrCreateStudyLogSheet_(ss) {
  let sheet = ss.getSheetByName('取り組み履歴');
  if (!sheet) {
    sheet = ss.insertSheet('取り組み履歴');
    const headers = [
      '日時',
      'ユーザーID',
      '学習区分',
      '単元名',
      '出題数',
      '正解数',
      '正答率',
      '獲得Pt',
      '挑戦モード',
      'セッションID'
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);

    // 見栄えのスタイル調整
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#37474F')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }
  return sheet;
}

/**
 * 単件の学習セッションをスプレッドシートへ追記（重複排除付き）
 */
function recordLearningSessionToSheet_(payload) {
  if (!payload || !payload.userId) {
    return { recorded: false, reason: 'missing_user_id' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { recorded: false, reason: 'no_active_spreadsheet' };

  const sheet = getOrCreateStudyLogSheet_(ss);
  const submitId = String(payload.sessionSubmitId || payload.submitId || '').trim();

  // 重複チェック（セッションIDが既にあればスキップ）
  if (submitId) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // セッションID列（第10列）を走査
      const ids = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === submitId) {
          return { recorded: false, alreadyProcessed: true, rowNumber: i + 2 };
        }
      }
    }
  }

  // 出題数・正解数・正答率の計算
  const results = Array.isArray(payload.results) ? payload.results : [];
  const totalQ = payload.totalQuestions != null ? Number(payload.totalQuestions) : results.length;
  let correctQ = payload.correctQuestions != null ? Number(payload.correctQuestions) : 0;
  if (!payload.correctQuestions && results.length > 0) {
    results.forEach(function (r) {
      if (r && (r.correct === true || r.isCorrect === true || r.questionCorrect === true)) correctQ++;
    });
  }

  const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) + '%' : '-';
  const earnedPt = Number(payload.earnedPoints || payload.earnedOverride || 0);
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const modeStr = payload.isReviewMode ? '復習' : (payload.isRandom ? 'ランダム' : '通常');

  sheet.appendRow([
    nowStr,
    String(payload.userId),
    String(payload.learningCategory || 'english'),
    String(payload.unitSheetName || payload.unitId || ''),
    totalQ,
    correctQ,
    accuracy,
    earnedPt,
    modeStr,
    submitId
  ]);

  return { recorded: true, rowNumber: sheet.getLastRow() };
}

/**
 * 本日の学習サマリーを集計し、保護者へメール通知
 */
function sendDailyStudyReport_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートが見つかりません');

  const sheet = ss.getSheetByName('取り組み履歴');
  if (!sheet || sheet.getLastRow() <= 1) {
    return { sessionCount: 0, totalPoints: 0, recipients: [] };
  }

  const todayPrefix = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();

  let todayCount = 0;
  let todayPoints = 0;
  let todayTotalQuestions = 0;
  let todayCorrectQuestions = 0;
  const userBreakdown = {};

  rows.forEach(function (row) {
    const rowDate = String(row[0] || '');
    if (rowDate.indexOf(todayPrefix) === 0) {
      todayCount++;
      const uid = String(row[1] || '不明');
      const q = Number(row[4]) || 0;
      const c = Number(row[5]) || 0;
      const pt = Number(row[7]) || 0;

      todayPoints += pt;
      todayTotalQuestions += q;
      todayCorrectQuestions += c;

      if (!userBreakdown[uid]) userBreakdown[uid] = { count: 0, questions: 0, correct: 0, points: 0 };
      userBreakdown[uid].count++;
      userBreakdown[uid].questions += q;
      userBreakdown[uid].correct += c;
      userBreakdown[uid].points += pt;
    }
  });

  if (todayCount === 0) {
    return { sessionCount: 0, totalPoints: 0, recipients: [] };
  }

  // 通知先メールアドレスの取得
  const props = PropertiesService.getScriptProperties();
  const rawEmails = props.getProperty('NOTIFY_EMAILS') || '';
  const recipients = rawEmails.split(',').map(function (e) { return e.trim(); }).filter(Boolean);

  if (recipients.length > 0) {
    const accuracy = todayTotalQuestions > 0 ? Math.round((todayCorrectQuestions / todayTotalQuestions) * 100) + '%' : '-';
    let detailText = '';
    Object.keys(userBreakdown).forEach(function (uid) {
      const u = userBreakdown[uid];
      detailText += `・${uid}: ${u.questions}問取り組み（正解: ${u.correct}問, 獲得: ${u.points}Pt）\n`;
    });

    const body = `【ESEnglishKanji 本日の学習レポート】\n\n` +
      `日付: ${todayPrefix}\n` +
      `総取り組みセット数: ${todayCount} 回\n` +
      `総問題数: ${todayTotalQuestions} 問\n` +
      `全体正答率: ${accuracy}\n` +
      `本日獲得ポイント: ${todayPoints} Pt\n\n` +
      `▼ ユーザー別内訳:\n${detailText}\n` +
      `詳細な学習履歴は Google スプレッドシート（取り組み履歴）をご確認ください。`;

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: `【学習レポート】${todayPrefix} の取り組みサマリー (${todayPoints}Pt 獲得)`,
      body: body
    });
  }

  return {
    sessionCount: todayCount,
    totalPoints: todayPoints,
    recipients: recipients
  };
}

// ============================================================================
// 【バックアップ＆エクスポート】見出し付きスプレッドシート完全自動生成エンジン
// ============================================================================

/**
 * 全設定および各教材ブック（5冊）をGoogleドライブへ見出し付きで一括生成
 */
function exportFullBackupSpreadsheets_() {
  const now = new Date();
  const timestampStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyyMMdd_HHmmss");
  const folderName = "ESEnglishKanji_バックアップ_" + timestampStr;

  // 1. Google Drive にタイムスタンプ付き専用フォルダを作成
  const folder = DriveApp.createFolder(folderName);
  const folderUrl = folder.getUrl();

  // 2. 『1_学習アプリ_管理ブック』を生成
  const adminSs = SpreadsheetApp.create("1_学習アプリ_管理ブック");
  DriveApp.getFileById(adminSs.getId()).moveTo(folder);
  buildAdminManagementWorkbook_(adminSs);

  // 3. 『2_教材_英単語ブック』を生成
  const engWordSs = SpreadsheetApp.create("2_教材_英単語ブック");
  DriveApp.getFileById(engWordSs.getId()).moveTo(folder);
  buildEnglishWordWorkbook_(engWordSs);

  // 4. 『3_教材_英語表現ブック』を生成
  const engPhraseSs = SpreadsheetApp.create("3_教材_英語表現ブック");
  DriveApp.getFileById(engPhraseSs.getId()).moveTo(folder);
  buildEnglishPhraseWorkbook_(engPhraseSs);

  // 5. 『4_教材_漢字練習ブック』を生成
  const kanjiSs = SpreadsheetApp.create("4_教材_漢字練習ブック");
  DriveApp.getFileById(kanjiSs.getId()).moveTo(folder);
  buildKanjiWorkbook_(kanjiSs);

  // 6. 『5_教材_漢字熟語ブック』を生成
  const jukugoSs = SpreadsheetApp.create("5_教材_漢字熟語ブック");
  DriveApp.getFileById(jukugoSs.getId()).moveTo(folder);
  buildJukugoWorkbook_(jukugoSs);

  return {
    folderName: folderName,
    folderUrl: folderUrl,
    exportedAt: Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss"),
    files: [
      { name: "1_学習アプリ_管理ブック", url: adminSs.getUrl() },
      { name: "2_教材_英単語ブック", url: engWordSs.getUrl() },
      { name: "3_教材_英語表現ブック", url: engPhraseSs.getUrl() },
      { name: "4_教材_漢字練習ブック", url: kanjiSs.getUrl() },
      { name: "5_教材_漢字熟語ブック", url: jukugoSs.getUrl() }
    ]
  };
}

/**
 * 見出しスタイリング共通ユーティリティ（背景色、太字、中央揃え、枠線、固定行、列幅調整）
 */
function applySheetHeaderStyle_(sheet, headers, bgColor) {
  sheet.clear();
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground(bgColor || '#E8EAED');
  range.setFontWeight('bold');
  range.setFontColor('#202124');
  range.setHorizontalAlignment('center');
  range.setVerticalAlignment('middle');
  range.setBorder(true, true, true, true, true, true, '#9AA0A6', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
    if (sheet.getColumnWidth(c) < 110) {
      sheet.setColumnWidth(c, 110);
    }
  }
}

/**
 * ① 『学習アプリ_管理ブック』の構築
 */
function buildAdminManagementWorkbook_(ss) {
  // 1. users シート
  const usersSheet = ss.getActiveSheet();
  usersSheet.setName("users");
  const userHeaders = ["ID", "名前", "PIN", "合計ポイント", "最終学習日時_JSON", "履歴_JSON", "日別ポイント_JSON", "特訓進捗_JSON", "ストップウォッチ_JSON"];
  applySheetHeaderStyle_(usersSheet, userHeaders, '#E8EAED');
  const defaultUsers = [
    ["admin_1", "パパ", "303707", 0, "", "", "", "", ""],
    ["user_1", "あかり", "1234", 100, "", "", "", "", ""],
    ["user_2", "ひかり", "1234", 100, "", "", "", "", ""],
    ["user_3", "しょうご", "1234", 100, "", "", "", "", ""],
    ["user_4", "ママ", "1234", 0, "", "", "", "", ""]
  ];
  usersSheet.getRange(2, 1, defaultUsers.length, userHeaders.length).setValues(defaultUsers);

  // 2. アプリ設定 シート
  const configSheet = ss.insertSheet("アプリ設定");
  const configHeaders = ["設定名", "単語", "表現"];
  applySheetHeaderStyle_(configSheet, configHeaders, '#E8EAED');
  const defaultConfigs = [
    // 1. システム・保護者設定
    ["外部学習_管理者PIN", "303707", ""],
    ["漢字手書き配点", '{"tome":15,"hane":15,"harai":15,"balance":30,"shape":25}', ""],
    ["漢字手書き合格ライン", "70", ""],
    ["ニガテ特訓ボーナス倍率", "1.4", ""],
    ["ランダム出題ボーナス倍率", "1.1", ""],
    ["通知メール_1", "parent@example.com", ""],
    ["通知メール_2", "", ""],
    ["通知メール_3", "", ""],
    ["通知メール_4", "", ""],

    // 2. 英語学習 基本配点（3列形式: 単語列 / 表現列）
    ["基本Pt_ja_to_en_4choice", "3", "3"],
    ["基本Pt_ja_to_en_typing", "20", "20"],
    ["基本Pt_ja_to_en_voice", "20", "20"],
    ["基本Pt_ja_to_en_fill_4choice", "5", "5"],
    ["基本Pt_ja_to_en_fill_typing", "5", "5"],
    ["基本Pt_en_to_ja_4choice", "2", "2"],
    ["基本Pt_en_to_ja_typing", "20", "20"],
    ["基本Pt_en_to_ja_voice", "20", "20"],
    ["基本Pt_en_audio_to_ja_4choice", "2", "2"],
    ["基本Pt_en_audio_to_ja_typing", "20", "20"],
    ["基本Pt_en_audio_to_ja_voice", "20", "20"],
    ["基本Pt_en_audio_to_en_4choice", "3", "3"],
    ["基本Pt_en_audio_to_en_typing", "20", "20"],
    ["基本Pt_en_audio_to_en_voice", "20", "20"],
    ["基本Pt_en_audio_to_en_fill_4choice", "5", "5"],
    ["基本Pt_en_audio_to_en_fill_typing", "5", "5"],
    ["基本Pt_en_to_en_typing", "20", "25"],
    ["基本Pt_en_to_en_voice", "20", "25"],
    ["基本Pt_en_to_en_initial_typing", "20", "25"],
    ["基本Pt_en_to_en_sheet_fill_typing", "20", "25"],
    ["基本Pt_en_to_en_initial_voice", "20", "25"],
    ["基本Pt_en_to_en_sheet_fill_voice", "20", "25"],
    ["基本Pt_en_to_en_flash_typing", "20", "25"],
    ["基本Pt_en_to_en_flash_voice", "20", "25"],
    ["基本Pt_qtext_to_en_4choice", "3", "3"],
    ["基本Pt_qtext_to_en_typing", "20", "30"],
    ["基本Pt_qtext_to_en_voice", "20", "30"],
    ["基本Pt_qaudio_to_en_typing", "20", "30"],
    ["基本Pt_qaudio_to_en_voice", "20", "30"],
    ["基本Pt_ja_to_en_sort_sort_all", "25", "25"],
    ["基本Pt_ja_to_en_sort_sort_dummy", "28", "28"],
    ["基本Pt_ja_to_en_sort_sort_missing", "30", "30"],

    // 3. 漢字学習 基本配点
    ["漢字基本Pt_採点_90以上", "10", ""],
    ["漢字基本Pt_採点_80以上", "5", ""],
    ["漢字基本Pt_採点_70以上", "4", ""],
    ["漢字基本Pt_採点_60以上", "3", ""],
    ["漢字基本Pt_採点_50以上", "1", ""],
    ["漢字採点_高得点回数上限_週", "3", ""],
    ["漢字採点_回数上限後倍率", "0.1", ""],
    ["漢字採点_回復率_日", "0.15", ""],
    ["漢字採点_完全回復日数", "7", ""],
    ["漢字基本Pt_送り仮名選択_90以上", "10", ""],
    ["漢字基本Pt_送り仮名選択_80以上", "5", ""],
    ["漢字基本Pt_送り仮名選択_70以上", "4", ""],
    ["漢字基本Pt_送り仮名選択_60以上", "3", ""],
    ["漢字基本Pt_送り仮名選択_50以上", "1", ""],
    ["漢字基本Pt_書取り_90以上", "10", ""],
    ["漢字基本Pt_書取り_80以上", "5", ""],
    ["漢字基本Pt_書取り_70以上", "4", ""],
    ["漢字基本Pt_書取り_60以上", "3", ""],
    ["漢字基本Pt_書取り_50以上", "1", ""],
    ["漢字基本Pt_読みタイピング_90以上", "10", ""],
    ["漢字基本Pt_読みタイピング_80以上", "5", ""],
    ["漢字基本Pt_読みタイピング_70以上", "4", ""],
    ["漢字基本Pt_読みタイピング_60以上", "3", ""],
    ["漢字基本Pt_読みタイピング_50以上", "1", ""],
    ["漢字基本Pt_画数_90以上", "10", ""],
    ["漢字基本Pt_画数_80以上", "5", ""],
    ["漢字基本Pt_画数_70以上", "4", ""],
    ["漢字基本Pt_画数_60以上", "3", ""],
    ["漢字基本Pt_画数_50以上", "1", ""],
    ["漢字書き順_画数倍率", "1", ""],
    ["漢字書き順_練習点", "5", ""],
    ["漢字熟語読み_基礎点", "1", ""],
    ["漢字熟語読み_選択肢倍率", "1", ""],
    ["漢字熟語読み_無し選択肢ボーナス", "2", ""],
    ["漢字熟語読みタイプ_基礎点", "15", ""],

    // 4. 特訓メニュー1〜12 メタ設定
    ["特訓メニュー1_表示名", "英検5級 基本特訓", ""],
    ["特訓メニュー1_有効", "TRUE", ""],
    ["特訓メニュー1_色", "#9C27B0", ""],
    ["特訓メニュー2_表示名", "英単語 発音＆スペル特訓", ""],
    ["特訓メニュー2_有効", "TRUE", ""],
    ["特訓メニュー2_色", "#2196F3", ""],
    ["特訓メニュー3_表示名", "漢字 書き取り＆読み特訓", ""],
    ["特訓メニュー3_有効", "TRUE", ""],
    ["特訓メニュー3_色", "#4CAF50", ""],
    ["特訓メニュー4_表示名", "特訓メニュー 4", ""],
    ["特訓メニュー4_有効", "TRUE", ""],
    ["特訓メニュー4_色", "#FF9800", ""],
    ["特訓メニュー5_表示名", "特訓メニュー 5", ""],
    ["特訓メニュー5_有効", "TRUE", ""],
    ["特訓メニュー5_色", "#F44336", ""],
    ["特訓メニュー6_表示名", "特訓メニュー 6", ""],
    ["特訓メニュー6_有効", "TRUE", ""],
    ["特訓メニュー6_色", "#009688", ""],
    ["特訓メニュー7_表示名", "特訓メニュー 7", ""],
    ["特訓メニュー7_有効", "TRUE", ""],
    ["特訓メニュー7_色", "#E91E63", ""],
    ["特訓メニュー8_表示名", "特訓メニュー 8", ""],
    ["特訓メニュー8_有効", "TRUE", ""],
    ["特訓メニュー8_色", "#3F51B5", ""],
    ["特訓メニュー9_表示名", "特訓メニュー 9", ""],
    ["特訓メニュー9_有効", "TRUE", ""],
    ["特訓メニュー9_色", "#795548", ""],
    ["特訓メニュー10_表示名", "特訓メニュー 10", ""],
    ["特訓メニュー10_有効", "TRUE", ""],
    ["特訓メニュー10_色", "#607D8B", ""],
    ["特訓メニュー11_表示名", "特訓メニュー 11", ""],
    ["特訓メニュー11_有効", "TRUE", ""],
    ["特訓メニュー11_色", "#00BCD4", ""],
    ["特訓メニュー12_表示名", "特訓メニュー 12", ""],
    ["特訓メニュー12_有効", "TRUE", ""],
    ["特訓メニュー12_色", "#FFC107", ""]
  ];
  configSheet.getRange(2, 1, defaultConfigs.length, configHeaders.length).setValues(defaultConfigs);

  // 3. rewards シート
  const rewardsSheet = ss.insertSheet("rewards");
  const rewardHeaders = ["景品ID", "景品名", "必要ポイント", "制限時間(分)", "説明", "アイコン", "有効"];
  applySheetHeaderStyle_(rewardsSheet, rewardHeaders, '#CEEAD6');
  const defaultRewards = [
    ["reward_game_30", "ゲーム 30分", 100, 30, "宿題を終えてから遊ぼう", "🎮", true],
    ["reward_youtube_30", "YouTube 30分", 100, 30, "スマホかテレビで見てね", "📺", true],
    ["reward_snack_special", "特別なおやつ", 80, 0, "好きなおやつを1つ選べるよ", "🍦", true],
    ["reward_book_manga", "マンガ・本 1冊", 300, 0, "読みたい本を買ってもらえるチケット", "📚", true]
  ];
  rewardsSheet.getRange(2, 1, defaultRewards.length, rewardHeaders.length).setValues(defaultRewards);

  // 4. inventory シート
  const invSheet = ss.insertSheet("inventory");
  const invHeaders = ["交換日時", "ユーザーID", "景品ID", "景品名", "状態", "使用日時", "通知状態"];
  applySheetHeaderStyle_(invSheet, invHeaders, '#FCE8E6');

  // 5. 外部学習 シート
  const extSheet = ss.insertSheet("外部学習");
  const extHeaders = ["カテゴリ", "分量", "ポイント"];
  applySheetHeaderStyle_(extSheet, extHeaders, '#FEF7E0');
  const defaultExt = [
    ["ドリル・宿題", "1ページ", 5],
    ["ドリル・宿題", "2ページ以上", 10],
    ["読書", "15分", 5],
    ["読書", "30分以上", 10],
    ["習い事・練習", "15分", 5],
    ["習い事・練習", "30分以上", 10],
    ["お手伝い", "かんたん", 3],
    ["お手伝い", "しっかり", 8]
  ];
  extSheet.getRange(2, 1, defaultExt.length, extHeaders.length).setValues(defaultExt);

  // 6. 外部学習申請 シート
  const reqSheet = ss.insertSheet("外部学習申請");
  const reqHeaders = ["申請日時", "ユーザーID", "ユーザー名", "カテゴリ", "分量", "ポイント", "こどもメモ", "状態", "処理日時", "おとなメモ"];
  applySheetHeaderStyle_(reqSheet, reqHeaders, '#FEF7E0');

  // 7. 特訓メニュー1 〜 12 シート
  for (let m = 1; m <= 12; m++) {
    const trainSheet = ss.insertSheet("特訓メニュー" + m);
    const trainHeaders = ["ステップ番号", "単元名", "出題形式", "回答形式", "モード", "穴埋め文字数"];
    applySheetHeaderStyle_(trainSheet, trainHeaders, '#E8F0FE');
    if (m === 1) {
      const sampleSteps = [
        [1, "英検5級_単元1", "日本語→英語", "4択", "ランダム", ""],
        [2, "英検5級_単元1", "英語音声→日本語", "タイピング", "通常", ""],
        [3, "英検5級_単元1", "日本語→英語", "音声発音", "ランダム", ""]
      ];
      trainSheet.getRange(2, 1, sampleSteps.length, trainHeaders.length).setValues(sampleSteps);
    }
  }
}

/**
 * ② 『教材_英単語ブック』の構築
 */
function buildEnglishWordWorkbook_(ss) {
  const sheet1 = ss.getActiveSheet();
  sheet1.setName("英検5級_単元1");
  const headers = ["通し番号", "英単語", "日本語", "イニシャル", "イニシャルと文字数", "ヒント"];
  applySheetHeaderStyle_(sheet1, headers, '#E8F0FE');

  const sampleWords = [
    [1, "apple", "りんご", "a", "a (5)", "赤いくだもの"],
    [2, "book", "本", "b", "b (4)", "読むもの"],
    [3, "cat", "ねこ", "c", "c (3)", "かわいい動物"],
    [4, "dog", "いぬ", "d", "d (3)", "人なつっこい動物"],
    [5, "elephant", "ぞう", "e", "e (8)", "鼻の長い動物"],
    [6, "friend", "友だち", "f", "f (6)", "なかよし"],
    [7, "guitar", "ギター", "g", "g (6)", "楽器"],
    [8, "house", "家", "h", "h (5)", "住むところ"],
    [9, "island", "島", "i", "i (6)", "海にかこまれた陸地"],
    [10, "juice", "ジュース", "j", "j (5)", "飲み物"]
  ];
  sheet1.getRange(2, 1, sampleWords.length, headers.length).setValues(sampleWords);

  // 単元2シートも追加
  const sheet2 = ss.insertSheet("英検5級_単元2");
  applySheetHeaderStyle_(sheet2, headers, '#E8F0FE');
  const sampleWords2 = [
    [1, "kitchen", "台所", "k", "k (7)", "料理をするところ"],
    [2, "lemon", "レモン", "l", "l (5)", "黄色くてすっぱいくだもの"],
    [3, "music", "音楽", "m", "m (5)", "歌やメロディ"],
    [4, "notebook", "ノート", "n", "n (8)", "文字を書く帳面"],
    [5, "orange", "オレンジ", "o", "o (6)", "かんきつ類のくだもの"]
  ];
  sheet2.getRange(2, 1, sampleWords2.length, headers.length).setValues(sampleWords2);
}

/**
 * ③ 『教材_英語表現ブック』の構築
 */
function buildEnglishPhraseWorkbook_(ss) {
  const sheet = ss.getActiveSheet();
  sheet.setName("日常会話_Lesson1");
  const headers = [
    "通し番号", "日本語", "英文", "別解１", "別解２", "別解３", "別解４", "別解５",
    "疑問文", "穴埋め１", "穴埋め２", "イニシャル", "イニシャルと文字数", "ヒント",
    "並び替え用英文", "並び替え箇所", "並び替え語句ダミー",
    "並び替え語句1", "並び替え語句2", "並び替え語句3", "並び替え語句4",
    "並び替え語句5", "並び替え語句6", "並び替え語句7", "並び替え語句8"
  ];
  applySheetHeaderStyle_(sheet, headers, '#E6F4EA');

  const samplePhrases = [
    [
      1, "おはようございます。", "Good morning.", "", "", "", "", "",
      "", "Good", "morning", "G", "G (4)", "朝のあいさつ",
      "Good morning.", "all", "",
      "Good", "morning.", "", "", "", "", "", ""
    ],
    [
      2, "お元気ですか？", "How are you?", "", "", "", "", "",
      "How are you?", "How", "you", "H", "H (3)", "あいさつ",
      "How are you?", "all", "",
      "How", "are", "you?", "", "", "", "", ""
    ],
    [
      3, "私の名前はケンです。", "My name is Ken.", "I am Ken.", "", "", "", "",
      "", "name", "Ken", "M", "M (2)", "自己紹介",
      "My name is Ken.", "all", "",
      "My", "name", "is", "Ken.", "", "", "", ""
    ]
  ];
  sheet.getRange(2, 1, samplePhrases.length, headers.length).setValues(samplePhrases);
}

/**
 * ④ 『教材_漢字練習ブック』の構築
 */
function buildKanjiWorkbook_(ss) {
  const grades = ["小１", "小２", "小３", "小４", "小５", "小６"];
  const headers = ["通し番号", "漢字", "読み", "画数", "部首", "意味", "例題文", "穴埋め問題", "選択肢1", "選択肢2", "選択肢3"];

  const sampleKanjiG1 = [
    [1, "日", "にち、ひ", 4, "日", "太陽、ひ", "日曜日に公園へ行く。", "（　）曜日に公園へ行く。", "日", "目", "白"],
    [2, "月", "げつ、つき", 4, "月", "お月さま", "夜空に月が出ている。", "夜空に（　）が出ている。", "月", "円", "用"],
    [3, "火", "か、ひ", 4, "火", "ひ、ほのお", "火曜日は習い事がある。", "（　）曜日は習い事がある。", "火", "水", "人"],
    [4, "水", "すい、みず", 4, "水", "みず", "冷たい水を飲む。", "冷たい（　）を飲む。", "水", "氷", "木"],
    [5, "木", "もく、き", 4, "木", "き、樹木", "大きな木の下で休む。", "大きな（　）の下で休む。", "木", "本", "林"],
    [6, "金", "きん、かね", 8, "金", "きん、おかね", "金曜日が一番好きだ。", "（　）曜日が一番好きだ。", "金", "全", "銀"],
    [7, "土", "ど、つち", 3, "土", "つち、じめん", "植木鉢に土を入れる。", "植木鉢に（　）を入れる。", "土", "士", "工"]
  ];

  grades.forEach(function (g, idx) {
    const sheet = idx === 0 ? ss.getActiveSheet() : ss.insertSheet(g);
    sheet.setName(g);
    applySheetHeaderStyle_(sheet, headers, '#FEF7E0');
    if (idx === 0) {
      sheet.getRange(2, 1, sampleKanjiG1.length, headers.length).setValues(sampleKanjiG1);
    }
  });
}

/**
 * ⑤ 『教材_漢字熟語ブック』の構築
 */
function buildJukugoWorkbook_(ss) {
  const sheet = ss.getActiveSheet();
  sheet.setName("熟語一覧");
  const headers = ["通し番号", "熟語", "読み", "意味", "例文"];
  applySheetHeaderStyle_(sheet, headers, '#FCE8E6');

  const sampleJukugo = [
    [1, "日光", "にっこう", "太陽の光", "暖かい日光を浴びる。"],
    [2, "月光", "げっこう", "月の光", "静かな月光の下を歩く。"],
    [3, "火花", "ひばな", "飛び散る火の粉", "火花がパチパチと散る。"],
    [4, "水車", "すいしゃ", "水力で回る車", "川辺で水車が回っている。"],
    [5, "森林", "しんりん", "たくさんの木が生い茂る場所", "森林浴を楽しむ。"]
  ];
  sheet.getRange(2, 1, sampleJukugo.length, headers.length).setValues(sampleJukugo);
}

/**
 * ============================================================================
 * 【インポート＆復元・移行】スプレッドシートから全設定・教材・ユーザーを一括抽出
 * ============================================================================
 */
function safeParseJsonCellMediator_(val, fallback) {
  if (val == null || val === "") return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch (_) {
    return fallback;
  }
}

function importFullConfigSpreadsheets_(body) {
  try {
    let ssId = String((body && (body.spreadsheetId || body.ssId)) || "").trim();
    if (ssId.indexOf("docs.google.com") !== -1) {
      const m = ssId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (m) ssId = m[1];
    }

    let targetSs = null;
    if (ssId) {
      try {
        targetSs = SpreadsheetApp.openById(ssId);
      } catch (eOpen) {
        return { status: "error", message: "指定されたスプレッドシートを開けませんでした: " + eOpen.message };
      }
    } else {
      const props = PropertiesService.getScriptProperties();
      const adminSsId = props.getProperty("ADMIN_SS_ID");
      if (adminSsId) {
        try {
          targetSs = SpreadsheetApp.openById(adminSsId);
        } catch (_) {}
      }
      if (!targetSs) {
        try {
          targetSs = SpreadsheetApp.getActiveSpreadsheet();
        } catch (_) {}
      }
    }

    if (!targetSs) {
      return { status: "error", message: "スプレッドシートが見つかりません。有効なURLまたはIDを指定してください。" };
    }

    // 1. users シート
    const usersSheet = targetSs.getSheetByName("users");
    const parsedUsers = [];
    if (usersSheet) {
      const vals = usersSheet.getDataRange().getValues();
      if (vals.length > 1) {
        const headers = vals[0].map(function (h) { return String(h || "").trim(); });
        const idIdx = headers.indexOf("ID") >= 0 ? headers.indexOf("ID") : 0;
        const nameIdx = headers.indexOf("名前") >= 0 ? headers.indexOf("名前") : 1;
        const pinIdx = headers.indexOf("PIN") >= 0 ? headers.indexOf("PIN") : 2;
        const ptIdx = headers.indexOf("合計ポイント") >= 0 ? headers.indexOf("合計ポイント") : 3;
        const lastIdx = headers.indexOf("最終学習日時_JSON") >= 0 ? headers.indexOf("最終学習日時_JSON") : 4;
        const histIdx = headers.indexOf("履歴_JSON") >= 0 ? headers.indexOf("履歴_JSON") : 5;
        const dailyIdx = headers.indexOf("日別ポイント_JSON") >= 0 ? headers.indexOf("日別ポイント_JSON") : 6;
        const trainIdx = headers.indexOf("特訓進捗_JSON") >= 0 ? headers.indexOf("特訓進捗_JSON") : 7;
        const stopIdx = headers.indexOf("ストップウォッチ_JSON") >= 0 ? headers.indexOf("ストップウォッチ_JSON") : 8;

        for (let i = 1; i < vals.length; i++) {
          const row = vals[i];
          const uId = String(row[idIdx] || "").trim();
          if (!uId) continue;
          parsedUsers.push({
            id: uId,
            name: String(row[nameIdx] || uId).trim(),
            pin: String(row[pinIdx] || "1234").trim(),
            points: Number(row[ptIdx]) || 0,
            lastStudyJson: safeParseJsonCellMediator_(row[lastIdx], {}),
            historyJson: safeParseJsonCellMediator_(row[histIdx], {}),
            dailyPointsJson: safeParseJsonCellMediator_(row[dailyIdx], {}),
            trainingProgressJson: safeParseJsonCellMediator_(row[trainIdx], {}),
            stopwatchJson: safeParseJsonCellMediator_(row[stopIdx], {})
          });
        }
      }
    }

    // 2. アプリ設定 シート
    const configSheet = targetSs.getSheetByName("アプリ設定");
    const appSettings = {};
    const basePointsMap = {};
    if (configSheet) {
      const vals = configSheet.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        const row = vals[i];
        const key = String(row[0] || "").trim();
        if (!key) continue;
        const valWord = row[1];
        const valPhrase = row[2];
        if (key.startsWith("基本Pt_") && valPhrase !== undefined && String(valPhrase).trim() !== "") {
          const pair = {
            word: Number(valWord) || 0,
            expression: Number(valPhrase) || 0
          };
          appSettings[key] = pair;
          basePointsMap[key] = pair;
        } else {
          appSettings[key] = valWord !== undefined ? String(valWord).trim() : "";
        }
      }
    }

    // 3. rewards シート
    const rewardsSheet = targetSs.getSheetByName("rewards");
    const parsedRewards = [];
    if (rewardsSheet) {
      const vals = rewardsSheet.getDataRange().getValues();
      if (vals.length > 1) {
        for (let i = 1; i < vals.length; i++) {
          const row = vals[i];
          const rId = String(row[0] || "").trim();
          if (!rId) continue;
          parsedRewards.push({
            id: rId,
            name: String(row[1] || "").trim(),
            points: Math.max(0, Number(row[2]) || 0),
            timeMinutes: Math.max(0, Number(row[3]) || 0),
            desc: String(row[4] || "").trim(),
            icon: String(row[5] || "🎁").trim(),
            enabled: row[6] !== false && String(row[6]).toLowerCase() !== "false"
          });
        }
      }
    }

    // 4. 外部学習 シート
    const extSheet = targetSs.getSheetByName("外部学習");
    const parsedExtMenus = [];
    if (extSheet) {
      const vals = extSheet.getDataRange().getValues();
      if (vals.length > 1) {
        for (let i = 1; i < vals.length; i++) {
          const row = vals[i];
          const cat = String(row[0] || "").trim();
          const vol = String(row[1] || "").trim();
          if (!cat && !vol) continue;
          parsedExtMenus.push({
            id: "ext_" + i,
            category: cat,
            volume: vol,
            points: Math.max(0, Number(row[2]) || 0)
          });
        }
      }
    }

    // 5. 特訓メニュー1〜12
    const defaultColors = ["#9C27B0", "#2196F3", "#4CAF50", "#FF9800", "#F44336", "#009688", "#E91E63", "#3F51B5", "#795548", "#607D8B", "#00BCD4", "#FFC107"];
    const trainingMenus = [];
    for (let m = 1; m <= 12; m++) {
      const mName = String(appSettings["特訓メニュー" + m + "_表示名"] || ("メニュー " + m)).trim();
      const mEnabled = String(appSettings["特訓メニュー" + m + "_有効"] || "TRUE").toUpperCase() !== "FALSE";
      const mColor = String(appSettings["特訓メニュー" + m + "_色"] || defaultColors[(m - 1) % defaultColors.length]).trim();

      const tSheet = targetSs.getSheetByName("特訓メニュー" + m);
      const routes = [];
      if (tSheet) {
        const vals = tSheet.getDataRange().getValues();
        if (vals.length > 1) {
          for (let r = 1; r < vals.length; r++) {
            const row = vals[r];
            const unitName = String(row[1] || "").trim();
            if (!unitName) continue;
            routes.push({
              step: Number(row[0]) || r,
              unit: unitName,
              format: String(row[2] || "").trim(),
              ansType: String(row[3] || "").trim(),
              mode: String(row[4] || "通常").trim(),
              fillCount: row[5] ? Number(row[5]) : null,
              targetUsers: "全員"
            });
          }
        }
      }
      trainingMenus.push({
        id: m,
        displayName: mName,
        color: mColor,
        enabled: mEnabled,
        routes: routes
      });
    }

    // 6. adminConfig & scoringConfig
    let adminPinVal = String(appSettings["外部学習_管理者PIN"] || "303707").trim();
    const notifyEmailsList = [
      appSettings["通知メール_1"],
      appSettings["通知メール_2"],
      appSettings["通知メール_3"],
      appSettings["通知メール_4"]
    ].map(function (s) { return String(s || "").trim(); }).filter(Boolean);

    let weights = { tome: 15, hane: 15, harai: 15, balance: 30, shape: 25 };
    if (appSettings["漢字手書き配点"]) {
      try {
        weights = Object.assign(weights, JSON.parse(appSettings["漢字手書き配点"]));
      } catch (_) {}
    }

    const scoringConfigObj = {
      passScore: Number(appSettings["漢字手書き合格ライン"]) || 70,
      weakBonus: Number(appSettings["ニガテ特訓ボーナス倍率"]) || 1.4,
      randomBonus: Number(appSettings["ランダム出題ボーナス倍率"]) || 1.1,
      tomeWeight: Number(weights.tome) || 15,
      haneWeight: Number(weights.hane) || 15,
      haraiWeight: Number(weights.harai) || 15,
      balanceWeight: Number(weights.balance) || 30,
      shapeWeight: Number(weights.shape) || 25
    };

    return {
      status: "success",
      sourceSpreadsheetId: targetSs.getId(),
      sourceSpreadsheetName: targetSs.getName(),
      data: {
        users: parsedUsers,
        adminConfig: {
          adminPin: adminPinVal,
          notifyEmails: notifyEmailsList
        },
        scoringConfig: scoringConfigObj,
        trainingAdmin: {
          menus: trainingMenus,
          basePoints: basePointsMap
        },
        rewards: parsedRewards,
        externalMenus: parsedExtMenus,
        appSettings: appSettings
      }
    };
  } catch (err) {
    return { status: "error", message: "スプレッドシートのインポートに失敗しました: " + err.message };
  }
}

