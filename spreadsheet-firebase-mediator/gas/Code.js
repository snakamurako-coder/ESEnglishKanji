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
      .addItem('⚙️ 設定・フォルダID・連携状況の確認', 'menuShowSettings_')
      .addToUi();
  } catch (_) {
    // コンテナバインド外（Webアプリ単体実行時）は無視
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
