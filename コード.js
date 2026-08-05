/** アプリ設定シートに入れる既定のキー一覧（足りない行だけ追加する） */
function getDefaultAppSettingsRows_() {
  return [
    ["基本Pt_ja_to_en_4choice", 3],
    ["基本Pt_ja_to_en_typing", 20],
    ["基本Pt_ja_to_en_voice", 20],
    ["基本Pt_ja_to_en_fill_4choice", 5],
    ["基本Pt_ja_to_en_fill_typing", 5],
    ["基本Pt_en_to_ja_4choice", 2],
    ["基本Pt_en_to_ja_typing", 20],
    ["基本Pt_en_to_ja_voice", 20],
    ["基本Pt_en_audio_to_ja_4choice", 2],
    ["基本Pt_en_audio_to_ja_typing", 20],
    ["基本Pt_en_audio_to_ja_voice", 20],
    ["基本Pt_en_audio_to_en_4choice", 3],
    ["基本Pt_en_audio_to_en_typing", 20],
    ["基本Pt_en_audio_to_en_voice", 20],
    ["基本Pt_en_audio_to_en_fill_4choice", 5],
    ["基本Pt_en_audio_to_en_fill_typing", 5],
    ["基本Pt_en_to_en_typing", 20],
    ["基本Pt_en_to_en_voice", 20],
    ["基本Pt_en_to_en_initial_typing", 20],
    ["基本Pt_en_to_en_sheet_fill_typing", 20],
    ["基本Pt_en_to_en_initial_voice", 20],
    ["基本Pt_en_to_en_sheet_fill_voice", 20],
    ["基本Pt_en_to_en_flash_typing", 20],
    ["基本Pt_en_to_en_flash_voice", 20],
    ["基本Pt_qtext_to_en_4choice", 3],
    ["基本Pt_qtext_to_en_typing", 30],
    ["基本Pt_qtext_to_en_voice", 30],
    ["基本Pt_qaudio_to_en_typing", 30],
    ["基本Pt_qaudio_to_en_voice", 30],
    ["基本Pt_ja_to_en_sort_sort_all", 25],
    ["基本Pt_ja_to_en_sort_sort_dummy", 28],
    ["基本Pt_ja_to_en_sort_sort_missing", 30],
    ["漢字基本Pt_採点_90以上", 10],
    ["漢字基本Pt_採点_80以上", 5],
    ["漢字基本Pt_採点_70以上", 4],
    ["漢字基本Pt_採点_60以上", 3],
    ["漢字基本Pt_採点_50以上", 1],
    ["漢字採点_高得点回数上限_週", 3],
    ["漢字採点_回数上限後倍率", 0.1],
    ["漢字採点_回復率_日", 0.15],
    ["漢字採点_完全回復日数", 7],
    ["漢字基本Pt_送り仮名選択_90以上", 10],
    ["漢字基本Pt_送り仮名選択_80以上", 5],
    ["漢字基本Pt_送り仮名選択_70以上", 4],
    ["漢字基本Pt_送り仮名選択_60以上", 3],
    ["漢字基本Pt_送り仮名選択_50以上", 1],
    ["漢字基本Pt_書取り_90以上", 10],
    ["漢字基本Pt_書取り_80以上", 5],
    ["漢字基本Pt_書取り_70以上", 4],
    ["漢字基本Pt_書取り_60以上", 3],
    ["漢字基本Pt_書取り_50以上", 1],
    ["漢字基本Pt_読みタイピング_90以上", 10],
    ["漢字基本Pt_読みタイピング_80以上", 5],
    ["漢字基本Pt_読みタイピング_70以上", 4],
    ["漢字基本Pt_読みタイピング_60以上", 3],
    ["漢字基本Pt_読みタイピング_50以上", 1],
    ["漢字基本Pt_画数_90以上", 10],
    ["漢字基本Pt_画数_80以上", 5],
    ["漢字基本Pt_画数_70以上", 4],
    ["漢字基本Pt_画数_60以上", 3],
    ["漢字基本Pt_画数_50以上", 1],
    ["漢字書き順_画数倍率", 1],
    ["漢字書き順_練習点", 5],
    ["漢字熟語読み_基礎点", 1],
    ["漢字熟語読み_選択肢倍率", 1],
    ["漢字熟語読み_無し選択肢ボーナス", 2],
    ["trajectory", 40],
    ["startEnd", 15],
    ["structure", 20],
    ["size", 25],
    ["strokeCount", 10],
    ["strokeOrder", 20]
  ];
}

function isEnglishBasePointSettingKey_(key) {
  return String(key || "").indexOf("基本Pt_") === 0;
}

function parseEnglishBasePointSettingKey_(key) {
  const s = String(key || "");
  if (!isEnglishBasePointSettingKey_(s)) return null;
  const body = s.slice("基本Pt_".length);
  const knownFormats = [
    "ja_to_en_sort", "en_audio_to_en", "en_audio_to_ja",
    "qtext_to_en", "qaudio_to_en", "ja_to_en", "en_to_ja", "en_to_en"
  ];
  for (let i = 0; i < knownFormats.length; i++) {
    const f = knownFormats[i];
    const prefix = f + "_";
    if (body.indexOf(prefix) === 0) {
      return { format: f, ansType: body.slice(prefix.length) };
    }
  }
  return null;
}

/** 英語基本点の既定（単語列・表現列）。クライアント computeQuizBasePoint のフォールバックと揃える。 */
function computeDefaultEnglishBasePointPair_(format, ansType) {
  if (format === "ja_to_en_sort") {
    const m = { sort_all: 25, sort_dummy: 28, sort_missing: 30 };
    const v = m[ansType] != null ? m[ansType] : 25;
    return { word: v, expression: v };
  }
  if (ansType === "fill_4choice" || ansType === "fill_typing") {
    return { word: 5, expression: 5 };
  }
  if (ansType === "4choice") {
    const v = String(format || "").indexOf("to_en") >= 0 ? 3 : 2;
    return { word: v, expression: v };
  }
  if (String(format || "").indexOf("qtext") >= 0 || String(format || "").indexOf("qaudio") >= 0) {
    return { word: 20, expression: 30 };
  }
  return { word: 20, expression: 25 };
}

function computeDefaultEnglishBasePointPairForKey_(key) {
  const parsed = parseEnglishBasePointSettingKey_(key);
  if (!parsed) return { word: 20, expression: 25 };
  return computeDefaultEnglishBasePointPair_(parsed.format, parsed.ansType);
}

function buildAppSettingsFromSheetRows_(data) {
  const out = {};
  if (!data || data.length < 1) return out;
  const hdr = data[0] || [];
  const threeCol = String(hdr[1] || "").trim() === "単語" && String(hdr[2] || "").trim() === "表現";
  for (let i = 1; i < data.length; i++) {
    const k = String(data[i][0] || "").trim();
    if (!k) continue;
    if (threeCol && isEnglishBasePointSettingKey_(k)) {
      out[k] = { word: data[i][1], expression: data[i][2] };
    } else {
      out[k] = data[i][1];
    }
  }
  return out;
}

function ensureAppSettingsSheetStructure_(sheet, result) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([["設定名", "単語", "表現"]]);
    if (result) result.headerFixed = true;
    return;
  }
  const lastCol = Math.max(3, sheet.getLastColumn());
  const row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colA = String(row1[0] || "").trim();
  const colB = String(row1[1] || "").trim();
  const colC = String(row1[2] || "").trim();
  if (colA === "設定名" && colB === "値" && colC !== "表現") {
    sheet.getRange(1, 2).setValue("単語");
    sheet.insertColumnAfter(2);
    sheet.getRange(1, 3).setValue("表現");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][0] || "").trim();
      if (k.indexOf("基本Pt_") === 0) {
        sheet.getRange(i + 1, 3).setValue(data[i][1]);
      }
    }
    if (result) {
      result.headerFixed = true;
      result.migratedToThreeCol = true;
    }
    return;
  }
  if (colA !== "設定名" || colB !== "単語" || colC !== "表現") {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 3).setValues([["設定名", "単語", "表現"]]);
    if (result) result.headerFixed = true;
  }
}

/**
 * アプリ設定シートの見出し行と不足キーを自動補完する。
 * setupSystem() の手動実行に加え、get_app_settings 取得時にも呼ぶ（デプロイ後の追加分を自動反映）。
 */
function ensureAppSettingsDefaults_(adminSs) {
  const result = { headerFixed: false, addedKeys: [], migratedToThreeCol: false, sheet: null };
  if (!adminSs) return result;

  let sheet = adminSs.getSheetByName("アプリ設定");
  if (!sheet) {
    sheet = adminSs.insertSheet("アプリ設定");
    sheet.appendRow(["設定名", "単語", "表現"]);
    sheet.appendRow(["基本ポイント_4択", 2, ""]);
    sheet.appendRow(["基本ポイント_タイピング", 20, ""]);
    sheet.appendRow(["基本ポイント_穴埋め", 5, ""]);
    sheet.appendRow(["基本ポイント_音声", 20, ""]);
    sheet.appendRow(["ヒント減点_イニシャル", 5, ""]);
    sheet.appendRow(["ヒント減点_文字数", 7, ""]);
    sheet.appendRow(["ヒント減点_音声", 10, ""]);
    result.headerFixed = true;
  }
  result.sheet = sheet;

  ensureAppSettingsSheetStructure_(sheet, result);

  const settingsData = sheet.getDataRange().getValues();
  const existingKeys = {};
  for (let i = 1; i < settingsData.length; i++) {
    const k = String(settingsData[i][0] || "").trim();
    if (k) existingKeys[k] = true;
  }

  getDefaultAppSettingsRows_().forEach(function (row) {
    const key = String(row[0] || "");
    if (!key || existingKeys[key]) return;
    if (isEnglishBasePointSettingKey_(key)) {
      const pair = computeDefaultEnglishBasePointPairForKey_(key);
      sheet.appendRow([key, pair.word, pair.expression]);
    } else {
      sheet.appendRow([key, row[1], ""]);
    }
    result.addedKeys.push(key);
    existingKeys[key] = true;
  });

  ensureTrainingMenuAppSettings_(sheet, existingKeys, result);
  ensureParentNotifyEmailSettings_(sheet, existingKeys, result);

  return result;
}

function getTrainingMenuDefaultColors_() {
  return ["#9C27B0", "#2196F3", "#4CAF50", "#FF9800", "#F44336", "#009688", "#E91E63", "#3F51B5", "#795548", "#607D8B", "#00BCD4", "#FFC107"];
}

function ensureTrainingMenuAppSettings_(sheet, existingKeys, result) {
  if (!sheet) return;
  const colors = getTrainingMenuDefaultColors_();
  for (let m = 1; m <= 12; m++) {
    const rows = [
      ["特訓メニュー" + m + "_表示名", ""],
      ["特訓メニュー" + m + "_有効", "1"],
      ["特訓メニュー" + m + "_色", colors[(m - 1) % colors.length]]
    ];
    rows.forEach(function (row) {
      const key = row[0];
      if (existingKeys[key]) return;
      sheet.appendRow([row[0], row[1], ""]);
      if (result && result.addedKeys) result.addedKeys.push(key);
      existingKeys[key] = true;
    });
  }
}

function setAppSettingValue_(adminSs, key, value) {
  ensureAppSettingsDefaults_(adminSs);
  const sheet = adminSs.getSheetByName("アプリ設定");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  if (isEnglishBasePointSettingKey_(key)) {
    const pair = computeDefaultEnglishBasePointPairForKey_(key);
    sheet.appendRow([key, value, pair.expression]);
  } else {
    sheet.appendRow([key, value, ""]);
  }
}

function setEnglishBasePointSettingValue_(adminSs, key, modeCategory, value) {
  ensureAppSettingsDefaults_(adminSs);
  const sheet = adminSs.getSheetByName("アプリ設定");
  if (!sheet) return;
  const col = modeCategory === "expression" ? 3 : 2;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) {
      sheet.getRange(i + 1, col).setValue(value);
      return;
    }
  }
  const pair = computeDefaultEnglishBasePointPairForKey_(key);
  sheet.appendRow([
    key,
    modeCategory === "word" ? value : pair.word,
    modeCategory === "expression" ? value : pair.expression
  ]);
}

function parseTrainingMenuEnabled_(value) {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "いいえ" || v === "無効" || v === "否") return false;
  return true;
}

function getTrainingRouteOptionLists_() {
  return {
    qFormats: [
      "日本語→英単語", "日本語→英語（並び替え）", "英単語→日本語", "音声→日本語", "音声→英単語",
      "疑問文→英語", "英語読み上げ→英語", "英語→英語", "漢字→採点チャレンジ"
    ],
    aFormats: [
      "4択", "タイピング", "音声", "穴埋め4択", "穴埋めタイピング",
      "タイピング（イニシャル）", "タイピング（穴埋め）", "音声入力（イニシャル）", "音声入力（穴埋め）",
      "タイピング（フラッシュ）", "音声入力（フラッシュ）",
      "すべて用いる", "不要語混入", "不足語補足", "採点"
    ],
    modes: ["ランダム", "順番"]
  };
}

function findTrainingMaterialForUnit_(unitName, materials) {
  const unit = String(unitName || "").trim();
  if (!unit) return null;
  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    if ((m.units || []).some(function (u) { return String(u) === unit; })) return m;
  }
  return null;
}

function getLearnerFormatOptionsForTraining_(modeName, category) {
  if (category === "kanji" || /漢字/.test(String(modeName || ""))) {
    return [{ value: "kanji_hand", qFormat: "漢字→採点チャレンジ" }];
  }
  const isWord = String(modeName || "").indexOf("単語") >= 0;
  if (isWord) {
    return [
      { value: "ja_to_en", qFormat: "日本語→英単語" },
      { value: "en_to_ja", qFormat: "英単語→日本語" },
      { value: "en_audio_to_ja", qFormat: "音声→日本語" },
      { value: "en_audio_to_en", qFormat: "英語読み上げ→英語" },
      { value: "en_to_en", qFormat: "英語→英語" }
    ];
  }
  return [
    { value: "ja_to_en", qFormat: "日本語→英単語" },
    { value: "ja_to_en_sort", qFormat: "日本語→英語（並び替え）" },
    { value: "en_to_ja", qFormat: "英単語→日本語" },
    { value: "qtext_to_en", qFormat: "疑問文→英語" },
    { value: "qaudio_to_en", qFormat: "音声→英単語" },
    { value: "en_audio_to_en", qFormat: "英語読み上げ→英語" },
    { value: "en_to_en", qFormat: "英語→英語" }
  ];
}

function getLearnerAnswerOptionsForTraining_(format, modeName) {
  const isWord = String(modeName || "").indexOf("単語") >= 0;
  const out = [];
  function add(value, aFormat) { out.push({ value: value, aFormat: aFormat }); }
  if (format === "kanji_hand") { add("hand_grade", "採点"); return out; }
  if (format === "ja_to_en_sort") {
    add("sort_all", "すべて用いる"); add("sort_dummy", "不要語混入"); add("sort_missing", "不足語補足"); return out;
  }
  if (format === "ja_to_en") {
    add("4choice", "4択"); add("typing", "タイピング"); add("voice", "音声");
    if (isWord) { add("fill_4choice", "穴埋め4択"); add("fill_typing", "穴埋めタイピング"); }
    return out;
  }
  if (format === "qtext_to_en" || format === "qaudio_to_en") {
    if (format !== "qaudio_to_en") add("4choice", "4択");
    add("typing", "タイピング"); add("voice", "音声");
    return out;
  }
  if (format === "en_to_ja" || format === "en_audio_to_ja") { add("4choice", "4択"); return out; }
  if (format === "en_audio_to_en") {
    add("4choice", "4択"); add("typing", "タイピング"); add("voice", "音声");
    if (isWord) { add("fill_4choice", "穴埋め4択"); add("fill_typing", "穴埋めタイピング"); }
    return out;
  }
  if (format === "en_to_en") {
    add("typing", "タイピング"); add("voice", "音声");
    add("flash_typing", "タイピング（フラッシュ）"); add("flash_voice", "音声入力（フラッシュ）");
    if (!isWord) {
      add("initial_typing", "タイピング（イニシャル）"); add("sheet_fill_typing", "タイピング（穴埋め）");
      add("initial_voice", "音声入力（イニシャル）"); add("sheet_fill_voice", "音声入力（穴埋め）");
    }
    return out;
  }
  return out;
}

function isValidTrainingRouteCombo_(unitName, qFormat, aFormat, materials) {
  const q = String(qFormat || "").trim();
  const a = String(aFormat || "").trim();
  if (!q || !a) return false;
  const mat = findTrainingMaterialForUnit_(unitName, materials);
  if (!mat) return false;
  const modeName = String(mat.modeName || "");
  const category = (mat.category === "kanji" || /漢字/.test(modeName)) ? "kanji" : "english";
  const formats = getLearnerFormatOptionsForTraining_(modeName, category);
  const fmt = formats.find(function (f) { return f.qFormat === q; });
  if (!fmt) return false;
  const answers = getLearnerAnswerOptionsForTraining_(fmt.value, modeName);
  return answers.some(function (x) { return x.aFormat === a; });
}

function getKnownBasePointSettingKeys_() {
  const keys = {};
  getDefaultAppSettingsRows_().forEach(function (row) {
    if (String(row[0]).indexOf("基本Pt_") === 0) keys[String(row[0])] = true;
  });
  return keys;
}

function readTrainingMenuRoutes_(sheet) {
  const routes = [];
  if (!sheet) return routes;
  const data = sheet.getDataRange().getValues();
  const header = data[0] || [];
  const blankIdx = header.indexOf("隠す文字数");
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!String(row[0] || "").trim() && !String(row[1] || "").trim() && !String(row[2] || "").trim()) continue;
    const aFormat = String(row[3] || "");
    const rawBlank = blankIdx >= 0 ? row[blankIdx] : "";
    const blankCount = (aFormat === "穴埋め4択" || aFormat === "穴埋めタイピング") ? rawBlank : "";
    routes.push({
      rowIdx: i + 1,
      stepIndex: i + 1,
      targetUsers: String(row[0] || ""),
      unitName: String(row[1] || ""),
      qFormat: String(row[2] || ""),
      aFormat: aFormat,
      mode: String(row[4] || ""),
      blankCount: blankCount
    });
  }
  return routes;
}

function setupSystem() {
  const scriptId = ScriptApp.getScriptId();
  const gasFile = DriveApp.getFileById(scriptId);
  const parents = gasFile.getParents();
  let parentFolder = DriveApp.getRootFolder();
  if (parents.hasNext()) parentFolder = parents.next();

  const props = PropertiesService.getScriptProperties();
  let adminSsId = props.getProperty('ADMIN_SS_ID');
  let materialsFolderId = props.getProperty('MATERIALS_FOLDER_ID');
  let kanjiMaterialsFolderId = props.getProperty('KANJI_MATERIALS_FOLDER_ID');
  let logMessage = "【セットアップログ】\n";

  if (!materialsFolderId) {
    const materialsFolder = parentFolder.createFolder("materials");
    props.setProperty('MATERIALS_FOLDER_ID', materialsFolder.getId());
    logMessage += "✅ materialsフォルダを作成しました。\n";

    const wordModeSs = SpreadsheetApp.create("単語練習モード");
    wordModeSs.getSheets()[0].setName("単元A").appendRow(["通し番号", "英単語", "日本語", "イニシャル", "イニシャルと文字数", "ヒント"]);
    wordModeSs.getSheets()[0].appendRow([1, "twin", "ふたご", "t", "t _ _ _", "tw", "カタカナではツインだよ。"]);
    DriveApp.getFileById(wordModeSs.getId()).moveTo(materialsFolder);

    const phraseModeSs = SpreadsheetApp.create("表現練習モード");
    const phraseHeaders = [
      "通し番号", "日本語", "英文", "別解１", "別解２", "別解３", "別解４", "別解５", "疑問文", "穴埋め１", "穴埋め２", "イニシャル", "イニシャルと文字数", "ヒント",
      "並び替え用英文", "並び替え箇所", "並び替え語句ダミー",
      "並び替え語句1", "並び替え語句2", "並び替え語句3", "並び替え語句4", "並び替え語句5", "並び替え語句6", "並び替え語句7", "並び替え語句8"
    ];
    phraseModeSs.getSheets()[0].setName("単元C").appendRow(phraseHeaders);
    phraseModeSs.getSheets()[0].appendRow([
      1, "私は8歳です。", "I'm eight years old.", "I am eight years old.", "", "", "", "", "How old are you?", "I'm (     ) years old.", "", "I", "I'm _ _ _ _ _", "年齢を聞かれた時の答え方だよ。",
      "", "", "",
      "", "", "", "", "", "", "", ""
    ]);
    phraseModeSs.getSheets()[0].appendRow([
      2, "これは私が昨日買った本です。", "This is the book I bought yesterday.", "", "", "", "", "", "", "", "", "", "", "本を指さしながら言う表現の練習だよ。",
      "This is the book I bought yesterday.", "This is the book I bought yesterday.", "a",
      "This", "is", "the", "book", "I", "bought", "yesterday.", ""
    ]);
    DriveApp.getFileById(phraseModeSs.getId()).moveTo(materialsFolder);
    
    logMessage += "✅ サンプル教材を作成しました。\n";
  }
  let kanjiFolder = null;
  if (!kanjiMaterialsFolderId) {
    kanjiFolder = parentFolder.createFolder("教材");
    props.setProperty('KANJI_MATERIALS_FOLDER_ID', kanjiFolder.getId());
    logMessage += "✅ 教材フォルダ（漢字用）を作成しました。\n";
  } else {
    try { kanjiFolder = DriveApp.getFolderById(kanjiMaterialsFolderId); } catch (_) {}
  }
  if (kanjiFolder) {
    const info = ensureKanjiSampleBook_(kanjiFolder);
    if (info.created) logMessage += "✅ 漢字学習サンプルブックを作成しました。\n";
    if (info.sheetId && !props.getProperty('KANJI_SHEET_ID')) {
      props.setProperty('KANJI_SHEET_ID', info.sheetId);
      logMessage += "✅ KANJI_SHEET_ID をサンプルブックに設定しました。\n";
    }
    const jukugoInfo = ensureKanjiJukugoSampleBook_(kanjiFolder);
    if (jukugoInfo.created) logMessage += "✅ 漢字熟語ブックを作成しました。\n";
    if (jukugoInfo.headerFixed) logMessage += "✅ 漢字熟語ブックの見出し行を整えました。\n";
    if (jukugoInfo.rowsAdded) logMessage += "✅ 漢字熟語ブックにサンプル行を追加しました。\n";
    const jukugoRepair = repairKanjiJukugoBooksInFolder_(kanjiFolder);
    if (jukugoRepair.repaired.length) {
      logMessage += "✅ 熟語ブックの見出しを整備: " + jukugoRepair.repaired.join("、") + "\n";
    }
  }

  let adminSs;
  if (!adminSsId) {
    adminSs = SpreadsheetApp.create("学習アプリ_管理ブック");
    props.setProperty('ADMIN_SS_ID', adminSs.getId());
    DriveApp.getFileById(adminSs.getId()).moveTo(parentFolder); 

    const usersSheet = adminSs.getSheets()[0];
    usersSheet.setName("users");
    // 新しく「特訓進捗_JSON」列を追加しました！
    usersSheet.appendRow(["ID", "名前", "PIN", "合計ポイント", "最終学習日時_JSON", "履歴_JSON", "日別ポイント_JSON", "特訓進捗_JSON", "ストップウォッチ_JSON"]);
    usersSheet.appendRow(["user_1", "テスト太郎", "1234", 100, "{}", "{}", "{}", "{}", "{}"]);

    const englishHistSheet = adminSs.insertSheet("english_unit_history");
    englishHistSheet.appendRow(["userId", "unitId", "unitHistoryJson", "updatedAt"]);

    const kanjiHistSheet = adminSs.insertSheet("kanji_history");
    kanjiHistSheet.appendRow(["userId", "bucket", "historyJson", "updatedAt"]);

    const rewardsSheet = adminSs.insertSheet("rewards");
    rewardsSheet.appendRow(["ID", "名前", "必要ポイント", "説明", "制限時間（分）"]);
    rewardsSheet.appendRow(["r_1", "YouTube視聴1時間延長券", 50, "管理者に提示して使ってね。", 60]);

    const inventorySheet = adminSs.insertSheet("inventory");
    inventorySheet.appendRow(["交換日時", "ユーザーID", "景品ID", "景品名", "状態", "使用日時", "終了通知状態"]);

    logMessage += "✅ 管理ブックと基本シートを作成しました。\n";
  } else {
    adminSs = SpreadsheetApp.openById(adminSsId);
  }

  let appSettingsSheet = adminSs.getSheetByName("アプリ設定");
  if (!appSettingsSheet) {
    appSettingsSheet = adminSs.insertSheet("アプリ設定");
    appSettingsSheet.appendRow(["設定名", "値"]);
    appSettingsSheet.appendRow(["基本ポイント_4択", 2]);
    appSettingsSheet.appendRow(["基本ポイント_タイピング", 20]);
    appSettingsSheet.appendRow(["基本ポイント_穴埋め", 5]);
    appSettingsSheet.appendRow(["基本ポイント_音声", 20]);
    appSettingsSheet.appendRow(["ヒント減点_イニシャル", 5]);
    appSettingsSheet.appendRow(["ヒント減点_文字数", 7]);
    appSettingsSheet.appendRow(["ヒント減点_音声", 10]);
    logMessage += "✅ 「アプリ設定」を追加しました。\n";
  }

  const appSettingsEnsure = ensureAppSettingsDefaults_(adminSs);
  if (appSettingsEnsure.headerFixed) {
    logMessage += "✅ 「アプリ設定」の見出し行（設定名・単語・表現）を整えました。\n";
  }
  if (appSettingsEnsure.migratedToThreeCol) {
    logMessage += "✅ 英語基本点を3列化しました（旧「値」列→単語列、表現列を追加）。\n";
  }
  if (appSettingsEnsure.addedKeys.length > 0) {
    logMessage += "✅ 「アプリ設定」に不足キーを " + appSettingsEnsure.addedKeys.length + " 件追加しました。\n";
    logMessage += "   追加: " + appSettingsEnsure.addedKeys.join(", ") + "\n";
  }

  let extLearningSheet = adminSs.getSheetByName("外部学習");
  if (!extLearningSheet) {
    extLearningSheet = adminSs.insertSheet("外部学習");
    extLearningSheet.appendRow(["カテゴリ", "分量", "獲得ポイント"]);
    extLearningSheet.appendRow(["ピアノ練習", "30分", 50]);
    extLearningSheet.appendRow(["読書", "30分", 30]);
    logMessage += "✅ 「外部学習」を追加しました。\n";
  }

  let extReqSheet = adminSs.getSheetByName("外部学習申請");
  if (!extReqSheet) {
    extReqSheet = adminSs.insertSheet("外部学習申請");
    extReqSheet.appendRow(["申請日時", "ユーザーID", "ユーザー名", "カテゴリ", "分量", "ポイント", "こどもメモ", "状態", "処理日時", "おとなメモ"]);
    logMessage += "✅ 「外部学習申請」を追加しました。\n";
  }

  const appSettingsForExtPin = adminSs.getSheetByName("アプリ設定");
  if (appSettingsForExtPin) {
    const extPinRows = appSettingsForExtPin.getDataRange().getValues();
    let hasExtAdminPin = false;
    for (let i = 1; i < extPinRows.length; i++) {
      if (String(extPinRows[i][0]) === "外部学習_管理者PIN") {
        hasExtAdminPin = true;
        break;
      }
    }
    if (!hasExtAdminPin) {
      appSettingsForExtPin.appendRow(["外部学習_管理者PIN", "1234"]);
      logMessage += "✅ 「外部学習_管理者PIN」を追加しました（アプリ設定シートで変更してください）。\n";
    }
  }

  // ★ 特訓メニュー1（従来名「特訓メニュー」互換）＋ 特訓メニュー2～12（ヘッダーのみ）
  const trainingHeader = ["対象ユーザー", "単元", "問題の形式", "こたえ方", "出し方", "隠す文字数"];
  const trainingPatterns = [
    ["全員", "", "英単語→日本語", "4択", "ランダム", ""],
    ["全員", "", "英単語→日本語", "タイピング", "ランダム", ""],
    ["全員", "", "英単語→日本語", "音声", "ランダム", ""],
    ["全員", "", "日本語→英単語", "4択", "ランダム", ""],
    ["全員", "", "日本語→英単語", "タイピング", "ランダム", ""],
    ["全員", "", "日本語→英単語", "音声", "ランダム", ""],
    ["全員", "", "日本語→英単語", "穴埋め4択", "ランダム", 1],
    ["全員", "", "日本語→英単語", "穴埋めタイピング", "ランダム", 1],
    ["全員", "", "音声→日本語", "4択", "ランダム", ""],
    ["全員", "", "音声→日本語", "タイピング", "ランダム", ""],
    ["全員", "", "音声→日本語", "音声", "ランダム", ""],
    ["全員", "", "音声→英単語", "タイピング", "ランダム", ""],
    ["全員", "", "音声→英単語", "音声", "ランダム", ""],
    ["全員", "", "英語→英語", "タイピング", "ランダム", ""],
    ["全員", "", "英語→英語", "音声", "ランダム", ""],
    ["全員", "", "英語→英語", "タイピング（イニシャル）", "ランダム", ""],
    ["全員", "", "英語→英語", "タイピング（穴埋め）", "ランダム", ""],
    ["全員", "", "英語→英語", "音声入力（イニシャル）", "ランダム", ""],
    ["全員", "", "英語→英語", "音声入力（穴埋め）", "ランダム", ""],
    ["全員", "", "漢字→採点チャレンジ", "採点", "ランダム", ""]
  ];
  let trainingSheet = adminSs.getSheetByName("特訓メニュー");
  if (!trainingSheet) {
    trainingSheet = adminSs.insertSheet("特訓メニュー");
    trainingSheet.appendRow(trainingHeader);
    trainingPatterns.forEach(p => trainingSheet.appendRow(p));
    logMessage += "✅ 新しい「特訓メニュー（学習ルート）」を追加しました。\n";
  }
  if (!adminSs.getSheetByName("特訓メニュー1")) {
    const s1 = adminSs.insertSheet("特訓メニュー1");
    const src = adminSs.getSheetByName("特訓メニュー");
    if (src) {
      const data = src.getDataRange().getValues();
      if (data.length) s1.getRange(1, 1, data.length, data[0].length).setValues(data);
      else s1.appendRow(trainingHeader);
    } else {
      s1.appendRow(trainingHeader);
      trainingPatterns.forEach(p => s1.appendRow(p));
    }
    logMessage += "✅ 「特訓メニュー1」を追加しました（従来の「特訓メニュー」と同じ内容）。\n";
  }
  for (let m = 2; m <= 12; m++) {
    const nm = "特訓メニュー" + m;
    if (!adminSs.getSheetByName(nm)) {
      const sh = adminSs.insertSheet(nm);
      sh.appendRow(trainingHeader);
      logMessage += "✅ 「" + nm + "」を追加しました。\n";
    }
  }
  const appSettingsTrain = adminSs.getSheetByName("アプリ設定");
  if (appSettingsTrain) {
    const asData = appSettingsTrain.getDataRange().getValues();
    const existing = {};
    for (let ri = 0; ri < asData.length; ri++) existing[String(asData[ri][0] || "")] = true;
    const trainMenuKeys = {};
    for (let ri = 0; ri < asData.length; ri++) trainMenuKeys[String(asData[ri][0] || "")] = true;
    ensureTrainingMenuAppSettings_(appSettingsTrain, trainMenuKeys, { addedKeys: [] });
  }

  const englishHistEnsure = ensureEnglishUnitHistorySheetStructure_(adminSs);
  if (englishHistEnsure.created) {
    logMessage += "✅ 「english_unit_history」を追加しました。\n";
  } else if (englishHistEnsure.headerFixed) {
    logMessage += "✅ 「english_unit_history」の見出し行を整えました。\n";
  }

  const kanjiHistEnsure = ensureKanjiHistorySheetStructure_(adminSs);
  if (kanjiHistEnsure.created) {
    logMessage += "✅ 「kanji_history」を追加しました。\n";
  } else if (kanjiHistEnsure.headerFixed) {
    logMessage += "✅ 「kanji_history」の見出し行を整えました。\n";
  }

  const swEnsure = ensureUsersSheetStopwatchColumn_(adminSs);
  if (swEnsure.headerFixed) logMessage += "✅ users に「ストップウォッチ_JSON」列を追加しました。\n";

  const rewardsEnsure = ensureRewardsSheetStructure_(adminSs);
  if (rewardsEnsure.headerFixed) logMessage += "✅ rewards に「制限時間（分）」列を追加しました。\n";
  if (rewardsEnsure.sampleUpdated) logMessage += "✅ サンプル景品 r_1 に制限時間 60 分を設定しました。\n";

  const invEnsure = ensureInventorySheetStructure_(adminSs);
  if (invEnsure.headerFixed) logMessage += "✅ inventory に「使用日時」「終了通知状態」列を追加しました。\n";

  const prunedEndTriggers = cleanupRewardEndNotificationTriggers_();
  if (prunedEndTriggers > 0) {
    logMessage += "✅ 古いご褒美終了トリガーを " + prunedEndTriggers + " 件削除しました。\n";
  }
  try {
    if (ensureRewardNotificationPollTrigger_()) {
      logMessage += "✅ ご褒美終了通知の定期チェック（5分）を登録しました。\n";
    }
  } catch (eTrigger) {
    logMessage += "⚠️ ご褒美通知トリガーの登録をスキップしました（上限超過の可能性）: " + eTrigger.message + "\n";
    logMessage += "   GAS エディタ → トリガー から不要なトリガーを手動削除後、再度 setupSystem() を実行してください。\n";
  }

  console.log(logMessage);
  return logMessage;
}

function ensureKanjiSampleBook_(kanjiFolder) {
  const out = { created: false, sheetId: "" };
  const sampleName = "漢字学習サンプル";
  let sampleFile = null;
  const files = kanjiFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (files.hasNext()) {
    const f = files.next();
    if (String(f.getName()) === sampleName) {
      sampleFile = f;
      break;
    }
  }
  let ss;
  if (!sampleFile) {
    ss = SpreadsheetApp.create(sampleName);
    sampleFile = DriveApp.getFileById(ss.getId());
    sampleFile.moveTo(kanjiFolder);
    out.created = true;
  } else {
    ss = SpreadsheetApp.openById(sampleFile.getId());
  }
  out.sheetId = ss.getId();

  let sheet = ss.getSheetByName("小１");
  if (!sheet) {
    sheet = ss.getSheets()[0] || ss.insertSheet("小１");
    sheet.setName("小１");
  }
  const header = [
    "セット", "漢字",
    "訓読みA_読み", "訓A_例文1", "訓A_例文2",
    "訓読みB_読み", "訓B_例文1", "訓B_例文2",
    "訓読みC_読み", "訓C_例文1", "訓C_例文2",
    "訓読みD_読み", "訓D_例文1", "訓D_例文2",
    "音読みA_読み", "音A_例文1", "音A_例文2",
    "音読みB_読み", "音B_例文1", "音B_例文2",
    "音読みC_読み", "音C_例文1", "音C_例文2",
    "音読みD_読み", "音D_例文1", "音D_例文2"
  ];
  const data = sheet.getDataRange().getValues();
  const headNow = (data[0] || []).map(v => String(v || "").trim());
  const sameHeader = headNow.length >= header.length && header.every((h, i) => headNow[i] === h);
  if (!sameHeader) {
    sheet.clear();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  const hasRows = sheet.getLastRow() > 1;
  if (!hasRows) {
    const rows = [
      [1, "一", "ひと", "一つある。", "もう一つだ。", "いっ", "けしゴムを一こかした。", "×", "×", "×", "×", "×", "×", "×", "いち", "一ばんだよ。", "一月はふゆだ。", "いつ", "きん一にまぜる。", "とう一する。", "×", "×", "×", "×", "×", "×"],
      [1, "右", "みぎ", "右をむく。", "右手を見る。", "×", "×", "×", "×", "×", "×", "×", "×", "×", "う", "うせつする。", "さゆうを見る。", "×", "×", "×", "×", "×", "×", "×", "×", "×"],
      [1, "雨", "あめ", "雨がふる。", "大雨がふる。", "あま", "雨水がでる。", "雨ぐもをみる。", "×", "×", "×", "×", "×", "×", "う", "雨てんちゅうしだ。", "ごう雨になる。", "×", "×", "×", "×", "×", "×", "×", "×", "×"],
      [1, "円", "まる", "円い形。", "円くかく。", "×", "×", "×", "×", "×", "×", "×", "×", "×", "えん", "百円玉をもつ。", "いちまん円だ。", "×", "×", "×", "×", "×", "×", "×", "×", "×"],
      [1, "王", "×", "×", "×", "×", "×", "×", "×", "×", "×", "×", "×", "×", "おう", "王さまにあう。", "王女さまをみる。", "×", "×", "×", "×", "×", "×", "×", "×", "×"],
      [1, "音", "おと", "音がなる。", "足音をきく。", "ね", "虫の音をきく。", "本音をいう。", "×", "×", "×", "×", "×", "×", "おん", "はつ音がよい。", "おん楽をきく。", "×", "×", "×", "×", "×", "×", "×", "×", "×"],
      [1, "下", "した", "下をむく。", "くつ下をはく。", "さ", "あたまを下げる。", "手を下げる。", "くだ", "さかを下る。", "川を下る。", "お", "山を下りる。", "木から下りる。", "か", "上下する。", "下きゅう生だ。", "げ", "下こうする。", "下しゃする。", "×", "×", "×", "×", "×", "×"]
    ];
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
  return out;
}

function getKanjiJukugoSheetHeaderRow_() {
  return [
    "セット", "ターゲット漢字",
    "漢字熟語A", "A読み", "A区分", "A例文",
    "漢字熟語B", "B読み", "B区分", "B例文",
    "漢字熟語C", "C読み", "C区分", "C例文"
  ];
}

function getKanjiJukugoSampleDataRows_() {
  return [
    [1, "引", "引力", "いんりょく", "漢語", "引力がはたらく。", "引く", "ひく", "和語", "つなを引く。", "万引き", "まんびき", "混種語", "万引きはわるいことだ。"],
    [1, "羽", "羽毛", "うもう", "漢語", "羽毛のふとん。", "羽", "はね", "和語", "鳥の羽。", "白羽", "しらは", "和語", "白羽の矢。"],
    [1, "雲", "雲海", "うんかい", "漢語", "雲海を見る。", "雲", "くも", "和語", "白い雲。", "雨雲", "あまぐも", "和語", "雨雲が出る。"],
    [1, "園", "公園", "こうえん", "漢語", "公園であそぶ。", "園", "その", "和語", "花の園。", "花園", "はなぞの", "和語", "花園を歩く。"],
    [1, "遠", "遠足", "えんそく", "漢語", "遠足に行く。", "遠い", "とおい", "和語", "遠い国。", "遠出", "とおで", "和語", "休みに遠出する。"],
    [1, "何", "何回", "なんかい", "混種語", "何回も言う。", "何", "なに,なん", "和語", "何を食べる。", "何日", "なんにち", "混種語", "何日かかかる。"],
    [1, "科", "理科", "りか", "漢語", "理科の時間。", "学科", "がっか", "漢語", "学科のテスト。", "×", "×", "×", "×"],
    [1, "夏", "春夏", "しゅんか", "漢語", "春夏と秋冬。", "夏", "なつ", "和語", "夏の海。", "夏休み", "なつやすみ", "和語", "夏休みがくる。"],
    [1, "家", "家来", "けらい", "漢語", "王の家来。", "家", "いえ,や", "和語", "新しい家。", "大家", "おおや", "和語", "大家に話す。"],
    [1, "歌", "歌手", "かしゅ", "漢語", "歌手になる。", "歌う", "うたう", "和語", "歌を歌う。", "校歌", "こうか", "漢語", "校歌を歌う。"]
  ];
}

function isKanjiJukugoBookFileName_(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (n === "漢字熟語ブック" || n === "漢字熟語") return true;
  return /^漢字熟語/.test(n) && n.indexOf("サンプル") < 0 && n.indexOf("学習") < 0;
}

function kanjiJukugoSheetHeaderMatches_(headNow) {
  const header = getKanjiJukugoSheetHeaderRow_();
  const row = (headNow || []).map(function (v) { return String(v || "").trim(); });
  return row.length >= header.length && header.every(function (h, i) { return row[i] === h; });
}

function ensureKanjiJukugoSheetHeaders_(sheet) {
  const out = { headerFixed: false, rowsAdded: false };
  if (!sheet) return out;
  const header = getKanjiJukugoSheetHeaderRow_();
  const data = sheet.getDataRange().getValues();
  const headNow = (data[0] || []).map(function (v) { return String(v || "").trim(); });
  if (!kanjiJukugoSheetHeaderMatches_(headNow)) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    out.headerFixed = true;
  }
  if (sheet.getLastRow() <= 1) {
    const rows = getKanjiJukugoSampleDataRows_();
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
    out.rowsAdded = true;
  }
  return out;
}

function repairKanjiJukugoBooksInFolder_(kanjiFolder) {
  const out = { repaired: [] };
  if (!kanjiFolder) return out;
  const files = kanjiFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (files.hasNext()) {
    const f = files.next();
    if (!isKanjiJukugoBookFileName_(f.getName())) continue;
    const ss = SpreadsheetApp.open(f);
    ss.getSheets().forEach(function (sh) {
      const fix = ensureKanjiJukugoSheetHeaders_(sh);
      if (fix.headerFixed || fix.rowsAdded) {
        out.repaired.push(f.getName() + "／" + sh.getName());
      }
    });
  }
  return out;
}

function ensureKanjiJukugoSampleBook_(kanjiFolder) {
  const out = { created: false, headerFixed: false, rowsAdded: false, sheetId: "" };
  const bookName = "漢字熟語ブック";
  let sampleFile = null;
  const files = kanjiFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
  const candidates = [];
  while (files.hasNext()) {
    const f = files.next();
    const nm = String(f.getName());
    if (nm === bookName || nm === "漢字熟語" || isKanjiJukugoBookFileName_(nm)) {
      candidates.push(f);
    }
  }
  candidates.sort(function (a, b) {
    const score = function (f) {
      const n = String(f.getName());
      if (n === bookName) return 0;
      if (n === "漢字熟語") return 1;
      return 2;
    };
    return score(a) - score(b);
  });
  if (candidates.length) sampleFile = candidates[0];
  let ss;
  if (!sampleFile) {
    ss = SpreadsheetApp.create(bookName);
    sampleFile = DriveApp.getFileById(ss.getId());
    sampleFile.moveTo(kanjiFolder);
    out.created = true;
  } else {
    ss = SpreadsheetApp.openById(sampleFile.getId());
  }
  out.sheetId = ss.getId();

  let sheet = ss.getSheetByName("小１");
  if (!sheet) {
    sheet = ss.getSheets()[0] || ss.insertSheet("小１");
    sheet.setName("小１");
  }
  const fix = ensureKanjiJukugoSheetHeaders_(sheet);
  out.headerFixed = fix.headerFixed;
  out.rowsAdded = fix.rowsAdded;
  return out;
}

const sendResponse = (responseObject) => {
  return ContentService.createTextOutput(JSON.stringify(responseObject)).setMimeType(ContentService.MimeType.JSON);
};

function doGet() {
  return ContentService
    .createTextOutput("OK: GAS endpoint is running")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (action === "save_learning_session") return handleSaveLearningSession(requestData);
    else if (action === "get_english_unit_history") return handleGetEnglishUnitHistory(requestData);
    else if (action === "get_kanji_history_bucket") return handleGetKanjiHistoryBucket(requestData);
    else if (action === "get_child_users") return handleGetChildUsers(requestData);
    else if (action === "verify_kid_pin") return handleVerifyKidPin(requestData);
    else if (action === "get_materials_list") return handleGetMaterialsList(requestData);
    else if (action === "get_questions") return handleGetQuestions(requestData);
    else if (action === "get_rewards") return handleGetRewards(requestData);
    else if (action === "exchange_reward") return handleExchangeReward(requestData);
    else if (action === "change_pin") return handleChangePin(requestData);
    else if (action === "get_inventory") return handleGetInventory(requestData);
    else if (action === "consume_reward") return handleConsumeReward(requestData);
    else if (action === "get_app_settings") return handleGetAppSettings(requestData);
    else if (action === "get_points_multiplier") return handleGetPointsMultiplier(requestData);
    else if (action === "get_external_learning") return handleGetExternalLearning(requestData);
    else if (action === "submit_external_learning_request") return handleSubmitExternalLearningRequest(requestData);
    else if (action === "get_pending_external_requests") return handleGetPendingExternalRequests(requestData);
    else if (action === "approve_external_request") return handleApproveExternalRequest(requestData);
    else if (action === "reject_external_request") return handleRejectExternalRequest(requestData);
    else if (action === "get_my_external_learning_requests") return handleGetMyExternalLearningRequests(requestData);
    else if (action === "recognize_handwriting") return recognizeSentence(requestData.ink || []);
    else if (action === "get_kanji_init_data") return handleGetKanjiInitData(requestData);
    else if (action === "get_kanji_data_from_sheet") return handleGetKanjiDataFromSheet(requestData);
    else if (action === "get_kanji_quiz_sets") return handleGetKanjiQuizSets(requestData);
    else if (action === "get_kanji_quiz_questions") return handleGetKanjiQuizQuestions(requestData);
    else if (action === "append_kanji_weak_signals") return handleAppendKanjiWeakSignals(requestData);
    else if (action === "get_kanji_weak_review_plan") return handleGetKanjiWeakReviewPlan(requestData);
    else if (action === "record_kanji_nigate_pass") return handleRecordKanjiNigatePass(requestData);
    
    // ★ 特訓ルート用のAPI
    else if (action === "get_training_route") return handleGetTrainingRoute(requestData);
    else if (action === "get_training_menu_admin") return handleGetTrainingMenuAdmin(requestData);
    else if (action === "save_training_menu_meta") return handleSaveTrainingMenuMeta(requestData);
    else if (action === "save_training_menu_route") return handleSaveTrainingMenuRoute(requestData);
    else if (action === "save_training_menu_routes_batch") return handleSaveTrainingMenuRoutesBatch(requestData);
    else if (action === "delete_training_menu_route") return handleDeleteTrainingMenuRoute(requestData);
    else if (action === "save_training_base_point") return handleSaveTrainingBasePoint(requestData);
    else if (action === "get_stopwatch") return handleGetStopwatch(requestData);
    else if (action === "save_stopwatch") return handleSaveStopwatch(requestData);
    else if (action === "get_parent_notify_emails") return handleGetParentNotifyEmails(requestData);
    else if (action === "save_parent_notify_emails") return handleSaveParentNotifyEmails(requestData);
    else if (action === "get_active_reward_ticket") return handleGetActiveRewardTicket(requestData);
    else if (action === "run_migrate_once") return handleRunMigrateOnce(requestData);
    
    else return sendResponse({ status: "error", message: "無効なactionです" });
  } catch (error) {
    return sendResponse({ status: "error", message: error.toString() });
  }
}

function doOptions(e) { return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT); }

function recognizeSentence(allStrokes) {
  if (!Array.isArray(allStrokes) || allStrokes.length === 0) {
    return sendResponse({ status: "error", message: "ストロークが空です。" });
  }

  const endpoints = [
    "https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8",
    "https://www.google.com.hk/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8"
  ];
  const languages = ["en", "en-US"];
  let lastError = "";

  for (let li = 0; li < languages.length; li++) {
    const lang = languages[li];
    const payload = {
      options: "enable_pre_space",
      requests: [{
        writing_guide: { writing_area_width: 1000, writing_area_height: 400 },
        ink: allStrokes,
        language: lang
      }]
    };

    for (let ei = 0; ei < endpoints.length; ei++) {
      const url = endpoints[ei];
      try {
        const response = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        const body = response.getContentText();
        if (code !== 200) {
          lastError = "HTTP " + code + " @ " + url;
          continue;
        }
        const result = JSON.parse(body);
        if (result[0] === "SUCCESS" && result[1] && result[1][0] && result[1][0][1] && result[1][0][1][0]) {
          const candidates = result[1][0][1]
            .filter(v => typeof v === "string" && v.trim() !== "")
            .slice(0, 10);
          return sendResponse({ status: "success", text: result[1][0][1][0], candidates: candidates });
        }
        lastError = "認識候補なし (" + lang + " @ " + url + ")";
      } catch (e) {
        lastError = String(e);
      }
    }
  }

  return sendResponse({ status: "error", message: "認識エラー: " + lastError });
}

// ==========================================
// ★ 特訓ルート（メニュー1～12）
// ==========================================
function getTrainingMenuSheet_(adminSs, menuId) {
  const id = String(menuId || '1');
  return adminSs.getSheetByName('特訓メニュー' + id);
}

/** 旧形式（今日のキー直下に stepIndex: true）を { "1": { stepIndex: true } } に寄せる */


function normalizeProgressForMenu_(todayBlock, menuId) {
  if (!todayBlock || typeof todayBlock !== 'object') return {};
  const mid = String(menuId || '1');
  const block = todayBlock[mid];
  return block && typeof block === 'object' ? block : {};
}

function handleGetTrainingRoute(req) {
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty('ADMIN_SS_ID'));
  let menuId = parseInt(req.trainingMenuId, 10);
  if (isNaN(menuId) || menuId < 1 || menuId > 12) menuId = 1;

  const sheet = getTrainingMenuSheet_(adminSs, menuId);
  const route = [];
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    const header = data[0] || [];
    const blankIdx = header.indexOf("隠す文字数");
    for (let i = 1; i < data.length; i++) {
      let target = String(data[i][0]);
      if (target === "全員" || target.includes(req.userId)) {
        const aFormat = String(data[i][3] || "");
        const rawBlank = blankIdx >= 0 ? data[i][blankIdx] : "";
        route.push({
          stepIndex: i,
          unitName: data[i][1],
          qFormat: data[i][2],
          aFormat: aFormat,
          mode: data[i][4],
          blankCount: (aFormat === "穴埋め4択" || aFormat === "穴埋めタイピング") ? rawBlank : ""
        });
      }
    }
  }

  const usersSheet = adminSs.getSheetByName("users");
  const userData = usersSheet.getDataRange().getValues();
  let progressData = {};
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0] === req.userId) {
      const rawProgress = JSON.parse(userData[i][7] || "{}");
      const todayBlock = rawProgress[todayStr] || {};
      progressData = normalizeProgressForMenu_(todayBlock, menuId);
      break;
    }
  }

  return sendResponse({ status: "success", route: route, progress: progressData, menuId: menuId });
}

function handleGetTrainingMenuAdmin(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  ensureAppSettingsDefaults_(adminSs);
  const settings = getAppSettingsMap_(adminSs);
  const defaultColors = getTrainingMenuDefaultColors_();
  const menus = [];
  for (let m = 1; m <= 12; m++) {
    const sheet = getTrainingMenuSheet_(adminSs, m);
    menus.push({
      id: m,
      displayName: String(settings["特訓メニュー" + m + "_表示名"] || "").trim(),
      enabled: parseTrainingMenuEnabled_(settings["特訓メニュー" + m + "_有効"]),
      color: String(settings["特訓メニュー" + m + "_色"] || "").trim() || defaultColors[(m - 1) % defaultColors.length],
      routes: readTrainingMenuRoutes_(sheet)
    });
  }

  const usersSheet = adminSs.getSheetByName("users");
  const childUsers = [];
  if (usersSheet) {
    const udata = usersSheet.getDataRange().getValues();
    for (let i = 1; i < udata.length; i++) {
      if (udata[i][0]) childUsers.push({ id: String(udata[i][0]), name: String(udata[i][1] || "") });
    }
  }

  const materials = getMaterialsList_();

  const opts = getTrainingRouteOptionLists_();
  const basePointSettings = {};
  Object.keys(settings).forEach(function (k) {
    if (k.indexOf("基本Pt_") === 0) basePointSettings[k] = settings[k];
  });
  return sendResponse({
    status: "success",
    menus: menus,
    childUsers: childUsers,
    materials: materials,
    colorPresets: defaultColors.map(function (c, idx) { return { id: "c" + idx, color: c }; }),
    qFormats: opts.qFormats,
    aFormats: opts.aFormats,
    modes: opts.modes,
    basePointSettings: basePointSettings
  });
}

function handleSaveTrainingMenuMeta(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  let menuId = parseInt(req.menuId, 10);
  if (isNaN(menuId) || menuId < 1 || menuId > 12) return sendResponse({ status: "error", message: "メニューIDが不正です" });

  if (req.displayName != null) setAppSettingValue_(adminSs, "特訓メニュー" + menuId + "_表示名", String(req.displayName));
  if (req.enabled != null) setAppSettingValue_(adminSs, "特訓メニュー" + menuId + "_有効", req.enabled ? "1" : "0");
  if (req.color != null) setAppSettingValue_(adminSs, "特訓メニュー" + menuId + "_色", String(req.color));

  return sendResponse({ status: "success", message: "メニュー設定を保存しました" });
}

function handleSaveTrainingMenuRoute(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  let menuId = parseInt(req.menuId, 10);
  if (isNaN(menuId) || menuId < 1 || menuId > 12) return sendResponse({ status: "error", message: "メニューIDが不正です" });

  const sheet = getTrainingMenuSheet_(adminSs, menuId);
  if (!sheet) return sendResponse({ status: "error", message: "特訓メニューシートが見つかりません" });

  const materials = getMaterialsList_();
  const qFormat = String(req.qFormat || "");
  const aFormat = String(req.aFormat || "");
  const unitName = String(req.unitName || "");
  if (!isValidTrainingRouteCombo_(unitName, qFormat, aFormat, materials)) {
    return sendResponse({ status: "error", message: "選んだ問題形式とこたえ方の組み合わせは、この単元では使えません。" });
  }

  const row = [
    String(req.targetUsers || "全員"),
    unitName,
    qFormat,
    aFormat,
    String(req.mode || "ランダム"),
    (aFormat === "穴埋め4択" || aFormat === "穴埋めタイピング") && req.blankCount != null && String(req.blankCount).trim() !== "" ? req.blankCount : ""
  ];

  let rowIdx = parseInt(req.rowIdx, 10);
  if (!isNaN(rowIdx) && rowIdx >= 2) {
    sheet.getRange(rowIdx, 1, rowIdx, 6).setValues([row]);
  } else {
    sheet.appendRow(row);
    rowIdx = sheet.getLastRow();
  }

  return sendResponse({ status: "success", message: "ルートを保存しました", rowIdx: rowIdx, route: {
    rowIdx: rowIdx,
    stepIndex: rowIdx,
    targetUsers: row[0],
    unitName: row[1],
    qFormat: row[2],
    aFormat: row[3],
    mode: row[4],
    blankCount: row[5]
  }});
}

function buildTrainingMenuRouteRow_(r, materials, rowLabel) {
  const qFormat = String(r.qFormat || "");
  const aFormat = String(r.aFormat || "");
  const unitName = String(r.unitName || "");
  const label = rowLabel ? ("ルート " + rowLabel + ": ") : "";
  if (!unitName || !qFormat || !aFormat) {
    return { error: label + "単元・問題形式・こたえ方を選んでください" };
  }
  if (!isValidTrainingRouteCombo_(unitName, qFormat, aFormat, materials)) {
    return { error: label + "選んだ組み合わせはこの単元では使えません" };
  }
  const blankRaw = (aFormat === "穴埋め4択" || aFormat === "穴埋めタイピング") && r.blankCount != null && String(r.blankCount).trim() !== "" ? r.blankCount : "";
  if ((aFormat === "穴埋め4択" || aFormat === "穴埋めタイピング") && (!blankRaw || Number(blankRaw) < 1)) {
    return { error: label + "穴埋めのときは「隠す文字数」を1以上で入力してください" };
  }
  return {
    row: [
      String(r.targetUsers || "全員"),
      unitName,
      qFormat,
      aFormat,
      String(r.mode || "ランダム"),
      blankRaw
    ]
  };
}

function writeTrainingMenuRoutesToSheet_(sheet, dataRows) {
  const header = ["対象ユーザー", "単元", "問題の形式", "こたえ方", "出し方", "隠す文字数"];
  const values = [header].concat(dataRows);
  const lastCol = header.length;
  sheet.getRange(1, 1, values.length, lastCol).setValues(values);
  const currentLast = sheet.getLastRow();
  if (currentLast > values.length) {
    sheet.deleteRows(values.length + 1, currentLast - values.length);
  }
}

function handleSaveTrainingMenuRoutesBatch(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  let menuId = parseInt(req.menuId, 10);
  if (isNaN(menuId) || menuId < 1 || menuId > 12) return sendResponse({ status: "error", message: "メニューIDが不正です" });

  const sheet = getTrainingMenuSheet_(adminSs, menuId);
  if (!sheet) return sendResponse({ status: "error", message: "特訓メニューシートが見つかりません" });

  const materials = getMaterialsList_();
  const routes = Array.isArray(req.routes) ? req.routes : [];
  const dataRows = [];
  for (let i = 0; i < routes.length; i++) {
    const built = buildTrainingMenuRouteRow_(routes[i], materials, String(i + 1));
    if (built.error) return sendResponse({ status: "error", message: built.error });
    dataRows.push(built.row);
  }

  writeTrainingMenuRoutesToSheet_(sheet, dataRows);
  return sendResponse({ status: "success", message: "ルートを一括保存しました（" + dataRows.length + " 件）", count: dataRows.length });
}

function handleSaveTrainingBasePoint(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  const settingKey = String(req.settingKey || "").trim();
  const known = getKnownBasePointSettingKeys_();
  if (!known[settingKey]) return sendResponse({ status: "error", message: "無効な設定キーです" });

  const num = Number(req.value);
  if (isNaN(num) || num < 0) return sendResponse({ status: "error", message: "0以上の数値を入力してください" });

  const modeCategory = String(req.modeCategory || "word").trim();
  if (modeCategory !== "word" && modeCategory !== "expression") {
    return sendResponse({ status: "error", message: "モード（単語/表現）が不正です" });
  }
  setEnglishBasePointSettingValue_(adminSs, settingKey, modeCategory, num);
  return sendResponse({
    status: "success",
    message: "点数を保存しました",
    settingKey: settingKey,
    modeCategory: modeCategory,
    value: num
  });
}

function handleDeleteTrainingMenuRoute(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  let menuId = parseInt(req.menuId, 10);
  if (isNaN(menuId) || menuId < 1 || menuId > 12) return sendResponse({ status: "error", message: "メニューIDが不正です" });

  const rowIdx = parseInt(req.rowIdx, 10);
  if (isNaN(rowIdx) || rowIdx < 2) return sendResponse({ status: "error", message: "削除する行が不正です" });

  const sheet = getTrainingMenuSheet_(adminSs, menuId);
  if (!sheet) return sendResponse({ status: "error", message: "特訓メニューシートが見つかりません" });

  sheet.deleteRow(rowIdx);
  return sendResponse({ status: "success", message: "ルートを削除しました" });
}

/** materials ブックのシート名が「単語A_40」のように末尾 _数字 なら、その数字を得点％として最後に乗算（未指定は100） */
function parseUnitSheetPointPercent_(sheetName) {
  const s = String(sheetName || "");
  const m = s.match(/_(\d+)$/);
  if (!m) return 100;
  let p = parseInt(m[1], 10);
  if (isNaN(p)) return 100;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  return p;
}

function getAppSettingsMap_(adminSs) {
  ensureAppSettingsDefaults_(adminSs);
  const sheet = adminSs.getSheetByName("アプリ設定");
  if (!sheet) return {};
  return buildAppSettingsFromSheetRows_(sheet.getDataRange().getValues());
}

/**
 * 問題タイプ（フロントの q.type）→ アプリ設定のキー接頭辞「漢字基本Pt_<別名>_」に対応。
 * タイプ別キーが未設定のときは従来どおり共通キー「漢字基本Pt_採点_XX以上」を参照する。
 */
var KANJI_QTYPE_PT_PREFIX_ = {
  okurigana_shift: "漢字基本Pt_送り仮名選択_",
  ruby_to_kanji: "漢字基本Pt_書取り_",
  sentence_to_ruby: "漢字基本Pt_読みタイピング_",
  stroke_count: "漢字基本Pt_画数_"
};

function kanjiSettingNumber_(settings, key, fallbackNum) {
  const v = settings[key];
  if (v === undefined || v === null || String(v).trim() === "") return fallbackNum;
  const n = Number(v);
  return isNaN(n) ? fallbackNum : n;
}

function getKanjiBasePointsByScore_(score, settings, questionType) {
  const s = Number(score) || 0;
  let suffix = null;
  let globalDefault = 0;
  if (s >= 90) {
    suffix = "90以上";
    globalDefault = 10;
  } else if (s >= 80) {
    suffix = "80以上";
    globalDefault = 5;
  } else if (s >= 70) {
    suffix = "70以上";
    globalDefault = 4;
  } else if (s >= 60) {
    suffix = "60以上";
    globalDefault = 3;
  } else if (s >= 50) {
    suffix = "50以上";
    globalDefault = 1;
  } else {
    return 0;
  }
  const qt = String(questionType || "").trim();
  const pref = KANJI_QTYPE_PT_PREFIX_[qt];
  if (pref) {
    const typeKey = pref + suffix;
    const v = settings[typeKey];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      const n = Number(v);
      if (!isNaN(n)) return n;
    }
  }
  const globalKey = "漢字基本Pt_採点_" + suffix;
  return kanjiSettingNumber_(settings, globalKey, globalDefault);
}

function toDateOnly_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calcKanjiCharRecoveryRate_(highScoreDates, now, settings) {
  const maxHighTimes = Math.max(1, Number(settings["漢字採点_高得点回数上限_週"] || 3));
  const overRate = Number(settings["漢字採点_回数上限後倍率"] || 0.1);
  const recoverPerDay = Number(settings["漢字採点_回復率_日"] || 0.15);
  const maxDays = Math.max(1, Number(settings["漢字採点_完全回復日数"] || 7));
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = (Array.isArray(highScoreDates) ? highScoreDates : [])
    .map(v => new Date(v))
    .filter(d => !isNaN(d.getTime()) && d >= weekAgo)
    .sort((a, b) => a.getTime() - b.getTime());
  if (recent.length < maxHighTimes) return 1.0;
  const triggerDate = recent[maxHighTimes - 1];
  const days = Math.max(0, Math.floor((toDateOnly_(now) - toDateOnly_(triggerDate)) / (24 * 60 * 60 * 1000)));
  if (days >= maxDays) return 1.0;
  return Math.min(1, overRate + recoverPerDay * days);
}

/** users シートの履歴_JSON 列（1セル約5万文字上限）に収める */
var HISTORY_JSON_CELL_MAX_CHARS_ = 45000;
var SESSION_SUBMIT_MAX_KEYS_ = 80;
var UNIT_HISTORY_MAX_QUESTION_KEYS_ = 120;
var KANJI_CHALLENGE_MAX_CHARS_ = 300;
var KANJI_NIGATE_PASS_MAX_KEYS_ = 150;
var DAILY_JSON_MAX_DAYS_ = 14;
var TRAINING_PROGRESS_MAX_DAYS_ = 2;
var LAST_STUDY_MAX_KEYS_ = 400;

function isDateKeyString_(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key || ""));
}

function pruneDateKeyedJson_(obj, maxDays, nowDate) {
  if (!obj || typeof obj !== "object") return;
  const now = nowDate || new Date();
  const today = now.toISOString().split("T")[0];
  const minMs = now.getTime() - Math.max(1, maxDays) * 24 * 60 * 60 * 1000;
  Object.keys(obj).forEach(function (k) {
    if (!isDateKeyString_(k)) return;
    const d = new Date(k + "T12:00:00");
    if (isNaN(d.getTime()) || d.getTime() < minMs) delete obj[k];
  });
  if (obj[today] == null && maxDays > 0) {
    /* 今日分が無くてもキー削除のみ（新規日は save 側で追加） */
  }
}

function pruneLastStudyJsonOrphans_(lastStudyJson, historyJson) {
  if (!lastStudyJson || typeof lastStudyJson !== "object") return;
  const hist = historyJson || {};
  Object.keys(lastStudyJson).forEach(function (k) {
    if (!k || String(k).startsWith("__")) return;
    if (!hist[k]) delete lastStudyJson[k];
  });
  const keys = Object.keys(lastStudyJson);
  if (keys.length <= LAST_STUDY_MAX_KEYS_) return;
  keys.sort(function (a, b) {
    return String(lastStudyJson[a] || "").localeCompare(String(lastStudyJson[b] || ""));
  });
  const drop = keys.length - LAST_STUDY_MAX_KEYS_;
  for (let i = 0; i < drop; i++) delete lastStudyJson[keys[i]];
}

function scoreUnitQuestionHistoryKey_(hist) {
  const h = hist || {};
  const rLen = Array.isArray(h.results) ? h.results.length : 0;
  const tLen = Array.isArray(h.times) ? h.times.length : 0;
  return rLen + tLen;
}

function pruneUnitHistoryQuestions_(unitHistory, maxKeys) {
  if (!unitHistory || typeof unitHistory !== "object") return;
  const qKeys = Object.keys(unitHistory);
  if (qKeys.length <= maxKeys) return;
  const scored = qKeys.map(function (k) {
    return { k: k, score: scoreUnitQuestionHistoryKey_(unitHistory[k]) };
  });
  scored.sort(function (a, b) {
    return a.score - b.score || String(a.k).localeCompare(String(b.k));
  });
  const drop = scored.length - maxKeys;
  for (let i = 0; i < drop; i++) delete unitHistory[scored[i].k];
}

function pruneKanjiChallengeIfNeeded_(challengeRoot, maxChars) {
  if (!challengeRoot || typeof challengeRoot !== "object") return;
  let keys = Object.keys(challengeRoot);
  if (keys.length <= maxChars) return;
  const scored = keys.map(function (k) {
    const rec = challengeRoot[k] || {};
    const dates = Array.isArray(rec.highScoreDates) ? rec.highScoreDates : [];
    const latest = dates.length ? String(dates[dates.length - 1]) : "";
    return { k: k, t: latest };
  });
  scored.sort(function (a, b) {
    return a.t.localeCompare(b.t);
  });
  const drop = scored.length - maxChars;
  for (let i = 0; i < drop; i++) delete challengeRoot[scored[i].k];
}

function pruneKanjiNigatePassIfNeeded_(passRoot, maxKeys) {
  if (!passRoot || typeof passRoot !== "object") return;
  const keys = Object.keys(passRoot);
  if (keys.length <= maxKeys) return;
  const scored = keys.map(function (k) {
    const rec = passRoot[k] || {};
    return { k: k, t: String(rec.updatedAt || "") };
  });
  scored.sort(function (a, b) {
    return a.t.localeCompare(b.t);
  });
  const drop = scored.length - maxKeys;
  for (let i = 0; i < drop; i++) delete passRoot[scored[i].k];
}

function pruneHistoryJsonStructure_(historyJson) {
  const root = historyJson || {};
  Object.keys(root).forEach(function (unitKey) {
    if (!unitKey || String(unitKey).startsWith("__")) return;
    if (root[unitKey] && typeof root[unitKey] === "object") {
      pruneUnitHistoryQuestions_(root[unitKey], UNIT_HISTORY_MAX_QUESTION_KEYS_);
    }
  });
  if (root.__sessionSubmits) pruneSessionSubmitLocks_(root.__sessionSubmits);
  return root;
}

function normalizeUserJsonBeforeSave_(userData) {
  if (!userData) return userData;
  userData.lastStudyJson = userData.lastStudyJson || {};
  userData.historyJson = userData.historyJson || {};
  userData.dailyPointsJson = userData.dailyPointsJson || {};
  userData.trainingProgressJson = userData.trainingProgressJson || {};
  stripKanjiAndEnglishFromHistoryJson_(userData.historyJson);
  const now = new Date();
  pruneDateKeyedJson_(userData.dailyPointsJson, DAILY_JSON_MAX_DAYS_, now);
  pruneDateKeyedJson_(userData.trainingProgressJson, TRAINING_PROGRESS_MAX_DAYS_, now);
  pruneHistoryJsonStructure_(userData.historyJson);
  userData.historyJson = pruneHistoryJsonToFit_(userData.historyJson, userData.lastStudyJson);
  pruneLastStudyJsonOrphans_(userData.lastStudyJson, userData.historyJson);
  return userData;
}

function pruneHistoryJsonToFit_(historyJson, lastStudyJson, maxChars) {
  const max = maxChars || HISTORY_JSON_CELL_MAX_CHARS_;
  const root = historyJson || {};
  let serialized = JSON.stringify(root);
  if (serialized.length <= max) return root;

  pruneHistoryJsonStructure_(root);
  serialized = JSON.stringify(root);
  if (serialized.length <= max) return root;

  const unitKeys = Object.keys(root).filter(function (k) {
    return k && !String(k).startsWith("__");
  });
  unitKeys.sort(function (a, b) {
    const ta = (lastStudyJson && lastStudyJson[a]) ? String(lastStudyJson[a]) : "";
    const tb = (lastStudyJson && lastStudyJson[b]) ? String(lastStudyJson[b]) : "";
    return ta.localeCompare(tb);
  });
  for (let i = 0; i < unitKeys.length; i++) {
    delete root[unitKeys[i]];
    serialized = JSON.stringify(root);
    if (serialized.length <= max) return root;
  }

  if (root.__sessionSubmits) {
    const locks = root.__sessionSubmits;
    const lk = Object.keys(locks);
    lk.sort(function (a, b) {
      const ta = (locks[a] && locks[a].at) ? String(locks[a].at) : "";
      const tb = (locks[b] && locks[b].at) ? String(locks[b].at) : "";
      return ta.localeCompare(tb);
    });
    while (lk.length > 20 && JSON.stringify(root).length > max) {
      delete locks[lk.shift()];
    }
  }
  return root;
}

function safeParseUserJsonCell_(raw, fallback) {
  try {
    if (raw == null || String(raw).trim() === "") return fallback || {};
    return JSON.parse(raw);
  } catch (_) {
    return fallback || {};
  }
}

function normalizeQuestionIdForHistory_(questionId, fallbackIndex) {
  const id = String(questionId != null ? questionId : "").trim();
  if (id) return id;
  return "q_" + String(fallbackIndex != null ? fallbackIndex : 0);
}

function buildHistoryUnitPatchForSession_(unitHistory, resultsList) {
  const patch = {};
  if (!unitHistory || !Array.isArray(resultsList)) return patch;
  resultsList.forEach(function (res, idx) {
    const qId = normalizeQuestionIdForHistory_(res && res.questionId, idx);
    if (unitHistory[qId]) patch[qId] = unitHistory[qId];
  });
  return patch;
}

var ENGLISH_UNIT_HISTORY_SHEET_NAME_ = "english_unit_history";
var ENGLISH_UNIT_HISTORY_HEADERS_ = ["userId", "unitId", "unitHistoryJson", "updatedAt"];
var ENGLISH_UNIT_HISTORY_JSON_MAX_CHARS_ = 40000;

function ensureSheetHeaderRow_(sheet, expectedHeaders) {
  const result = { headerFixed: false };
  if (!sheet) return result;
  const expected = Array.isArray(expectedHeaders) ? expectedHeaders : [];
  if (!expected.length) return result;
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    result.headerFixed = true;
    return result;
  }
  const row1 = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (String(row1[i] || "").trim() !== String(expected[i] || "").trim()) {
      ok = false;
      break;
    }
  }
  if (ok) return result;
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  result.headerFixed = true;
  return result;
}

/** 結合セルでも行数不一致にならないよう、1セルずつ書き込む */
function setRowValuesSafe_(sheet, rowIdx, startCol, values) {
  const row = parseInt(rowIdx, 10);
  const col = parseInt(startCol, 10);
  if (!sheet || isNaN(row) || row < 1 || isNaN(col) || col < 1) {
    throw new Error("シート書き込み位置が不正です");
  }
  const list = Array.isArray(values) ? values : [];
  for (let i = 0; i < list.length; i++) {
    sheet.getRange(row, col + i).setValue(list[i]);
  }
}

function ensureEnglishUnitHistorySheetStructure_(adminSs) {
  const result = { sheet: null, created: false, headerFixed: false };
  if (!adminSs) return result;
  let sheet = adminSs.getSheetByName(ENGLISH_UNIT_HISTORY_SHEET_NAME_);
  if (!sheet) {
    sheet = adminSs.insertSheet(ENGLISH_UNIT_HISTORY_SHEET_NAME_);
    result.created = true;
  }
  const hdr = ensureSheetHeaderRow_(sheet, ENGLISH_UNIT_HISTORY_HEADERS_);
  result.headerFixed = result.created || hdr.headerFixed;
  result.sheet = sheet;
  return result;
}

function ensureEnglishUnitHistorySheet_(adminSs) {
  return ensureEnglishUnitHistorySheetStructure_(adminSs).sheet;
}

function findEnglishUnitHistoryRowIndex_(sheet, userId, unitId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const uid = String(userId || "");
  const uId = String(unitId || "");
  const data = sheet.getRange(2, 1, lastRow, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || "").trim() === ENGLISH_UNIT_HISTORY_HEADERS_[0]) continue;
    if (String(data[i][0]) === uid && String(data[i][1]) === uId) return i + 2;
  }
  return -1;
}

function loadEnglishUnitHistory_(adminSs, userId, unitId) {
  const sheet = ensureEnglishUnitHistorySheet_(adminSs);
  const rowIdx = findEnglishUnitHistoryRowIndex_(sheet, userId, unitId);
  if (rowIdx < 0) return {};
  return safeParseUserJsonCell_(sheet.getRange(rowIdx, 3).getValue(), {});
}

function saveEnglishUnitHistory_(adminSs, userId, unitId, unitHistoryMap, nowIso) {
  const sheet = ensureEnglishUnitHistorySheet_(adminSs);
  const map = unitHistoryMap || {};
  pruneUnitHistoryQuestions_(map, UNIT_HISTORY_MAX_QUESTION_KEYS_);
  let serialized = JSON.stringify(map);
  if (serialized.length > ENGLISH_UNIT_HISTORY_JSON_MAX_CHARS_) {
    pruneUnitHistoryQuestions_(map, Math.max(40, Math.floor(UNIT_HISTORY_MAX_QUESTION_KEYS_ / 2)));
    serialized = JSON.stringify(map);
  }
  const rowValues = [String(userId || ""), String(unitId || ""), serialized, nowIso || new Date().toISOString()];
  const rowIdx = findEnglishUnitHistoryRowIndex_(sheet, userId, unitId);
  if (rowIdx >= 0) {
    setRowValuesSafe_(sheet, rowIdx, 1, rowValues);
  } else {
    sheet.appendRow(rowValues);
  }
  return map;
}

function mergeSessionResultsIntoUnitHistory_(unitHistory, resultsList) {
  const map = unitHistory || {};
  (Array.isArray(resultsList) ? resultsList : []).forEach(function (res, idx) {
    const qId = normalizeQuestionIdForHistory_(res && res.questionId, idx);
    if (!map[qId]) map[qId] = { results: [], times: [] };
    map[qId].results.push(res && res.isCorrect ? 1 : 0);
    if (map[qId].results.length > 10) map[qId].results.shift();
    const timeSec = Number(res && res.timeSec);
    map[qId].times.push(!isNaN(timeSec) ? timeSec : 0);
    if (map[qId].times.length > 10) map[qId].times.shift();
  });
  return map;
}



function stripEnglishUnitKeysFromHistoryJson_(historyJson) {
  const root = historyJson || {};
  Object.keys(root).forEach(function (k) {
    if (k && !String(k).startsWith("__")) delete root[k];
  });
  return root;
}

function usesEnglishUnitHistorySheet_(req, unitId) {
  if (req.learningCategory === "kanji" && req.challengeType === "score" && req.kanjiChar) return false;
  const uid = String(unitId || "");
  return !!uid && !uid.startsWith("__");
}



function handleGetEnglishUnitHistory(req) {
  const userId = String(req.userId || "");
  const unitId = String(req.unitId || "");
  if (!userId || !unitId) return sendResponse({ status: "error", message: "userId と unitId が必要です" });
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty("ADMIN_SS_ID"));
  const usersSheet = adminSs.getSheetByName("users");
  let map = loadEnglishUnitHistory_(adminSs, userId, unitId);
  return sendResponse({ status: "success", unitId: unitId, historyUnit: map || {} });
}

var KANJI_HISTORY_SHEET_NAME_ = "kanji_history";
var KANJI_HISTORY_HEADERS_ = ["userId", "bucket", "historyJson", "updatedAt"];
var KANJI_HISTORY_JSON_MAX_CHARS_ = 40000;
var KANJI_HISTORY_BUCKETS_ = ["__kanjiChallenge", "__kanjiWeak", "__kanjiNigatePass"];

function ensureKanjiHistorySheetStructure_(adminSs) {
  const result = { sheet: null, created: false, headerFixed: false };
  if (!adminSs) return result;
  let sheet = adminSs.getSheetByName(KANJI_HISTORY_SHEET_NAME_);
  if (!sheet) {
    sheet = adminSs.insertSheet(KANJI_HISTORY_SHEET_NAME_);
    result.created = true;
  }
  const hdr = ensureSheetHeaderRow_(sheet, KANJI_HISTORY_HEADERS_);
  result.headerFixed = result.created || hdr.headerFixed;
  result.sheet = sheet;
  return result;
}

function ensureKanjiHistorySheet_(adminSs) {
  return ensureKanjiHistorySheetStructure_(adminSs).sheet;
}

function findKanjiHistoryRowIndex_(sheet, userId, bucket) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const uid = String(userId || "");
  const b = String(bucket || "");
  const data = sheet.getRange(2, 1, lastRow, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || "").trim() === KANJI_HISTORY_HEADERS_[0]) continue;
    if (String(data[i][0]) === uid && String(data[i][1]) === b) return i + 2;
  }
  return -1;
}

function loadKanjiHistoryBucket_(adminSs, userId, bucket) {
  const sheet = ensureKanjiHistorySheet_(adminSs);
  const rowIdx = findKanjiHistoryRowIndex_(sheet, userId, bucket);
  if (rowIdx < 0) return {};
  return safeParseUserJsonCell_(sheet.getRange(rowIdx, 3).getValue(), {});
}

function saveKanjiHistoryBucket_(adminSs, userId, bucket, dataObj, nowIso) {
  const sheet = ensureKanjiHistorySheet_(adminSs);
  const data = dataObj || {};
  if (bucket === "__kanjiChallenge") pruneKanjiChallengeIfNeeded_(data, KANJI_CHALLENGE_MAX_CHARS_);
  if (bucket === "__kanjiWeak") pruneKanjiWeakIfNeeded_(data);
  if (bucket === "__kanjiNigatePass") pruneKanjiNigatePassIfNeeded_(data, KANJI_NIGATE_PASS_MAX_KEYS_);
  let serialized = JSON.stringify(data);
  if (serialized.length > KANJI_HISTORY_JSON_MAX_CHARS_) {
    if (bucket === "__kanjiChallenge") {
      pruneKanjiChallengeIfNeeded_(data, Math.max(50, Math.floor(KANJI_CHALLENGE_MAX_CHARS_ / 2)));
    }
    if (bucket === "__kanjiNigatePass") {
      pruneKanjiNigatePassIfNeeded_(data, Math.max(40, Math.floor(KANJI_NIGATE_PASS_MAX_KEYS_ / 2)));
    }
    serialized = JSON.stringify(data);
  }
  const rowValues = [String(userId || ""), String(bucket || ""), serialized, nowIso || new Date().toISOString()];
  const rowIdx = findKanjiHistoryRowIndex_(sheet, userId, bucket);
  if (rowIdx >= 0) {
    setRowValuesSafe_(sheet, rowIdx, 1, rowValues);
  } else {
    sheet.appendRow(rowValues);
  }
  return data;
}

function buildKanjiHistoryView_(adminSs, userId) {
  const buckets = ['__kanjiChallenge', '__kanjiWeak', '__kanjiNigatePass'];
  const view = {};
  buckets.forEach(b => { view[b] = loadKanjiHistoryBucket_(adminSs, userId, b) || {}; });
  return view;
}

function persistKanjiHistoryView_(adminSs, userId, view, nowIso) {
  const v = view || {};
  KANJI_HISTORY_BUCKETS_.forEach(function (bucket) {
    saveKanjiHistoryBucket_(adminSs, userId, bucket, v[bucket] || {}, nowIso);
  });
}

function stripKanjiKeysFromHistoryJson_(historyJson) {
  const root = historyJson || {};
  delete root.__kanjiChallenge;
  delete root.__kanjiWeak;
  delete root.__kanjiNigatePass;
  return root;
}

function stripKanjiAndEnglishFromHistoryJson_(historyJson) {
  stripEnglishUnitKeysFromHistoryJson_(historyJson);
  stripKanjiKeysFromHistoryJson_(historyJson);
  return historyJson;
}



function handleGetKanjiHistoryBucket(req) {
  const userId = String(req.userId || "");
  const bucket = String(req.bucket || "__kanjiChallenge");
  if (!userId) return sendResponse({ status: "error", message: "userId が必要です" });
  if (KANJI_HISTORY_BUCKETS_.indexOf(bucket) < 0) {
    return sendResponse({ status: "error", message: "bucket が不正です" });
  }
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty("ADMIN_SS_ID"));
  const usersSheet = adminSs.getSheetByName("users");
  let map = loadKanjiHistoryBucket_(adminSs, userId, bucket);
  return sendResponse({ status: "success", bucket: bucket, historyBucket: map || {} });
}

function writeUserLearningRow_(usersSheet, targetRowIdx, userData, newTotalPoints) {
  normalizeUserJsonBeforeSave_(userData);
  const rowValues = [
    newTotalPoints,
    JSON.stringify(userData.lastStudyJson),
    JSON.stringify(userData.historyJson),
    JSON.stringify(userData.dailyPointsJson),
    JSON.stringify(userData.trainingProgressJson)
  ];
  if (rowValues[2].length > HISTORY_JSON_CELL_MAX_CHARS_) {
    throw new Error("履歴データが大きすぎて保存できません。管理者に連絡してください。");
  }
  setRowValuesSafe_(usersSheet, targetRowIdx, 4, rowValues);
}

function pruneSessionSubmitLocks_(locksRoot) {
  if (!locksRoot || typeof locksRoot !== "object") return;
  const keys = Object.keys(locksRoot);
  if (keys.length <= SESSION_SUBMIT_MAX_KEYS_) return;
  keys.sort(function (a, b) {
    const ta = (locksRoot[a] && locksRoot[a].at) ? String(locksRoot[a].at) : "";
    const tb = (locksRoot[b] && locksRoot[b].at) ? String(locksRoot[b].at) : "";
    return ta.localeCompare(tb);
  });
  const drop = keys.length - SESSION_SUBMIT_MAX_KEYS_;
  for (let i = 0; i < drop; i++) delete locksRoot[keys[i]];
}

function getSessionSubmitLock_(userData, sessionSubmitId) {
  const id = String(sessionSubmitId || "").trim();
  if (!id) return null;
  const root = userData.historyJson.__sessionSubmits;
  if (!root || !root[id]) return null;
  const rec = root[id];
  if (rec.earnedPoints == null || rec.newTotal == null) return null;
  return rec;
}

function rememberSessionSubmitLock_(userData, sessionSubmitId, earnedPoints, newTotal, nowIso) {
  const id = String(sessionSubmitId || "").trim();
  if (!id) return;
  if (!userData.historyJson.__sessionSubmits) userData.historyJson.__sessionSubmits = {};
  userData.historyJson.__sessionSubmits[id] = {
    earnedPoints: earnedPoints,
    newTotal: newTotal,
    at: nowIso
  };
  pruneSessionSubmitLocks_(userData.historyJson.__sessionSubmits);
}

/** 英語1問の素点（ヒント減点後も最低1点。0・マイナスにならない） */
function computeEnglishQuestionRawPoints_(basePoint, maxDeduction) {
  const bp = Number(basePoint) || 2;
  const ded = Math.max(0, Number(maxDeduction) || 0);
  return Math.max(1, bp - ded);
}

var STOPWATCH_MAX_MS_ = 90 * 60 * 1000;
var USERS_COL_STOPWATCH_JSON_ = 9;
var REWARD_NOTIFY_POLL_HANDLER_ = "checkPendingRewardEndNotifications_";
var REWARD_END_NOTIFY_HANDLER_ = "sendRewardEndNotificationForRow_";

function getAdminSpreadsheet_() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("ADMIN_SS_ID"));
}

function ensureSheetHeaderColumn_(sheet, colIndex, headerText) {
  if (!sheet) return false;
  const lastCol = Math.max(1, sheet.getLastColumn());
  if (lastCol < colIndex) {
    sheet.getRange(1, colIndex).setValue(headerText);
    return true;
  }
  const cur = String(sheet.getRange(1, colIndex).getValue() || "").trim();
  if (cur !== headerText) {
    sheet.getRange(1, colIndex).setValue(headerText);
    return true;
  }
  return false;
}

function ensureUsersSheetStopwatchColumn_(adminSs) {
  const result = { headerFixed: false };
  const sheet = adminSs.getSheetByName("users");
  if (!sheet) return result;
  if (ensureSheetHeaderColumn_(sheet, USERS_COL_STOPWATCH_JSON_, "ストップウォッチ_JSON")) {
    result.headerFixed = true;
  }
  return result;
}

function ensureRewardsSheetStructure_(adminSs) {
  const result = { headerFixed: false, sampleUpdated: false };
  const props = PropertiesService.getScriptProperties();
  const FLAG = "REWARDS_STRUCTURE_OK_V1";
  let sheet = adminSs.getSheetByName("rewards");
  if (!sheet) {
    sheet = adminSs.insertSheet("rewards");
    sheet.appendRow(["ID", "名前", "必要ポイント", "説明", "制限時間（分）"]);
    sheet.appendRow(["r_1", "YouTube視聴1時間延長券", 50, "管理者に提示して使ってね。", 60]);
    result.headerFixed = true;
    props.setProperty(FLAG, "1");
    return result;
  }
  if (ensureSheetHeaderColumn_(sheet, 5, "制限時間（分）")) result.headerFixed = true;
  // ホットパスでは毎回の全行スキャンを避ける（初回／ヘッダ修正時のみサンプル点検）
  if (props.getProperty(FLAG) === "1" && !result.headerFixed) return result;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === "r_1" && (!data[i][4] || Number(data[i][4]) <= 0)) {
      sheet.getRange(i + 1, 5).setValue(60);
      result.sampleUpdated = true;
      break;
    }
  }
  props.setProperty(FLAG, "1");
  return result;
}

function ensureInventorySheetStructure_(adminSs) {
  const result = { headerFixed: false };
  let sheet = adminSs.getSheetByName("inventory");
  if (!sheet) {
    sheet = adminSs.insertSheet("inventory");
    sheet.appendRow(["交換日時", "ユーザーID", "景品ID", "景品名", "状態", "使用日時", "終了通知状態"]);
    result.headerFixed = true;
    return result;
  }
  if (ensureSheetHeaderColumn_(sheet, 6, "使用日時")) result.headerFixed = true;
  if (ensureSheetHeaderColumn_(sheet, 7, "終了通知状態")) result.headerFixed = true;
  return result;
}

function ensureParentNotifyEmailSettings_(sheet, existingKeys, result) {
  if (!sheet) return;
  for (let i = 1; i <= 4; i++) {
    const key = "通知メール_" + i;
    if (existingKeys[key]) continue;
    sheet.appendRow([key, "", ""]);
    if (result && result.addedKeys) result.addedKeys.push(key);
    existingKeys[key] = true;
  }
}

function cleanupRewardEndNotificationTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === REWARD_END_NOTIFY_HANDLER_) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return removed;
}

function ensureRewardNotificationPollTrigger_() {
  cleanupRewardEndNotificationTriggers_();
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === REWARD_NOTIFY_POLL_HANDLER_) return false;
  }
  ScriptApp.newTrigger(REWARD_NOTIFY_POLL_HANDLER_)
    .timeBased()
    .everyMinutes(5)
    .create();
  return true;
}

function defaultStopwatchSlot_() {
  return { running: false, startedAtMs: 0, elapsedMs: 0 };
}

function normalizeStopwatchSlot_(slot, nowMs) {
  const out = defaultStopwatchSlot_();
  const src = slot || {};
  out.running = !!src.running;
  out.startedAtMs = Number(src.startedAtMs) || 0;
  out.elapsedMs = Math.max(0, Number(src.elapsedMs) || 0);
  const now = nowMs == null ? Date.now() : nowMs;
  if (out.running) {
    if (!out.startedAtMs) out.startedAtMs = now;
    const elapsedLive = now - out.startedAtMs;
    if (elapsedLive >= STOPWATCH_MAX_MS_) {
      out.running = false;
      out.startedAtMs = 0;
      out.elapsedMs = 0;
    }
  } else if (out.elapsedMs >= STOPWATCH_MAX_MS_) {
    out.elapsedMs = 0;
    out.startedAtMs = 0;
  }
  return out;
}

function normalizeStopwatchState_(state, nowMs) {
  const src = state || {};
  return {
    home: normalizeStopwatchSlot_(src.home, nowMs),
    external: normalizeStopwatchSlot_(src.external, nowMs)
  };
}

function readStopwatchJson_(usersSheet, userRowIndex) {
  try {
    const raw = usersSheet.getRange(userRowIndex, USERS_COL_STOPWATCH_JSON_).getValue();
    if (!raw || String(raw).trim() === "") return normalizeStopwatchState_({});
    return normalizeStopwatchState_(JSON.parse(String(raw)));
  } catch (_) {
    return normalizeStopwatchState_({});
  }
}

function writeStopwatchJson_(usersSheet, userRowIndex, state) {
  const normalized = normalizeStopwatchState_(state);
  usersSheet.getRange(userRowIndex, USERS_COL_STOPWATCH_JSON_).setValue(JSON.stringify(normalized));
  return normalized;
}

function findUserRowIndex_(usersSheet, userId) {
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return i + 1;
  }
  return -1;
}

function findUserName_(usersSheet, userId) {
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return String(data[i][1] || userId);
  }
  return String(userId || "");
}

function getAppSettingScalar_(adminSs, key) {
  const sheet = adminSs.getSheetByName("アプリ設定");
  if (!sheet) return "";
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) return data[i][1];
  }
  return "";
}

function getParentNotifyEmails_(adminSs) {
  const out = [];
  for (let i = 1; i <= 4; i++) {
    const v = String(getAppSettingScalar_(adminSs, "通知メール_" + i) || "").trim();
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) out.push(v);
  }
  return out;
}

function formatJstDateTime_(dateObj) {
  return Utilities.formatDate(dateObj, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
}

function parseSheetDateTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const s = String(value || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/** rewards シートを1回読んで ID→制限時間(分) のマップを返す */
function buildRewardLimitMinutesMap_(adminSs) {
  const map = {};
  const sheet = adminSs.getSheetByName("rewards");
  if (!sheet) return map;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || "");
    if (!id) continue;
    const n = Number(data[i][4]);
    map[id] = isNaN(n) || n <= 0 ? 0 : Math.floor(n);
  }
  return map;
}

function getRewardLimitMinutesById_(adminSs, rewardId, limitMapOpt) {
  if (limitMapOpt && typeof limitMapOpt === "object") {
    const v = limitMapOpt[String(rewardId)];
    return v == null ? 0 : Number(v) || 0;
  }
  const sheet = adminSs.getSheetByName("rewards");
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(rewardId)) {
      const n = Number(data[i][4]);
      return isNaN(n) || n <= 0 ? 0 : Math.floor(n);
    }
  }
  return 0;
}

function getRewardInfoById_(adminSs, rewardId) {
  const sheet = adminSs.getSheetByName("rewards");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(rewardId)) {
      return {
        id: String(data[i][0]),
        name: String(data[i][1] || ""),
        points: Number(data[i][2]) || 0,
        desc: String(data[i][3] || ""),
        limitMinutes: (function () {
          const n = Number(data[i][4]);
          return isNaN(n) || n <= 0 ? 0 : Math.floor(n);
        })()
      };
    }
  }
  return null;
}

function computeRewardEndsAt_(usedAtDate, limitMinutes) {
  if (!usedAtDate || !limitMinutes) return null;
  return new Date(usedAtDate.getTime() + limitMinutes * 60 * 1000);
}

function computeRewardNotifyAt_(usedAtDate, limitMinutes) {
  const endsAt = computeRewardEndsAt_(usedAtDate, limitMinutes);
  if (!endsAt) return null;
  return new Date(endsAt.getTime() + 60 * 1000);
}

function sendMailToParents_(adminSs, subject, body) {
  const recipients = getParentNotifyEmails_(adminSs);
  if (!recipients.length) return { sent: false, reason: "no_recipients" };
  MailApp.sendEmail({
    to: recipients.join(","),
    subject: subject,
    body: body
  });
  return { sent: true, recipients: recipients };
}

function sendRewardStartEmail_(adminSs, userName, rewardName, limitMinutes, endsAtDate) {
  const endsText = endsAtDate ? formatJstDateTime_(endsAtDate) : "";
  const subject = "【学習アプリ】ご褒美チケット使用開始: " + rewardName;
  const body =
    userName + " さんが「" + rewardName + "」を使用しました。\n" +
    "制限時間: " + limitMinutes + " 分\n" +
    (endsText ? "終了予定: " + endsText + "（日本時間）\n" : "") +
    "\n終了後（+1分）にもう一度お知らせします。";
  return sendMailToParents_(adminSs, subject, body);
}

function sendRewardEndEmail_(adminSs, userName, rewardName, usedAtDate, endsAtDate) {
  const subject = "【学習アプリ】ご褒美チケット終了: " + rewardName;
  const body =
    userName + " さんの「" + rewardName + "」の制限時間が終了しました。\n" +
    "使用開始: " + (usedAtDate ? formatJstDateTime_(usedAtDate) : "不明") + "\n" +
    "終了予定: " + (endsAtDate ? formatJstDateTime_(endsAtDate) : "不明") + "（日本時間）\n";
  return sendMailToParents_(adminSs, subject, body);
}

/**
 * スクリプトエディタから実行: MailApp 初回承認と通知メール設定の確認用。
 * アプリ設定「通知メール_1」〜「通知メール_4」に届きます。
 * @param {string=} kind "simple"（既定）| "start" | "end" | "both"
 * @return {Object}
 */
function testParentNotifyMail_(kind) {
  const adminSs = getAdminSpreadsheet_();
  ensureAppSettingsDefaults_(adminSs);
  const recipients = getParentNotifyEmails_(adminSs);
  if (!recipients.length) {
    throw new Error("通知メールが未登録です。アプリの「管理メニュー → 通知メール設定」で保存してください。");
  }

  const mode = String(kind || "simple").toLowerCase();
  const now = new Date();
  const limitMinutes = 60;
  const endsAt = computeRewardEndsAt_(now, limitMinutes);
  const result = { ok: true, mode: mode, recipients: recipients, sentAt: formatJstDateTime_(now), mails: [] };

  if (mode === "simple" || mode === "all") {
    MailApp.sendEmail({
      to: recipients.join(","),
      subject: "【学習アプリ】通知メール試し送信",
      body:
        "これは試し送信です。MailApp の設定が正常です。\n\n" +
        "送信日時: " + formatJstDateTime_(now) + "（日本時間）\n" +
        "宛先: " + recipients.join(", ") + "\n"
    });
    result.mails.push({ type: "simple", sent: true });
  }

  if (mode === "start" || mode === "both" || mode === "all") {
    const startMail = sendRewardStartEmail_(adminSs, "テスト太郎", "テスト用ご褒美券", limitMinutes, endsAt);
    result.mails.push({ type: "start", sent: !!startMail.sent, detail: startMail });
  }

  if (mode === "end" || mode === "both" || mode === "all") {
    const endMail = sendRewardEndEmail_(adminSs, "テスト太郎", "テスト用ご褒美券", now, endsAt);
    result.mails.push({ type: "end", sent: !!endMail.sent, detail: endMail });
  }

  if (result.mails.length === 0) {
    throw new Error("kind は simple / start / end / both / all のいずれかを指定してください。");
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function scheduleRewardEndNotificationTrigger_(inventoryRowIdx, notifyAtDate) {
  if (!notifyAtDate || isNaN(notifyAtDate.getTime())) return false;
  const props = PropertiesService.getScriptProperties();
  props.setProperty("reward_end_row_" + inventoryRowIdx, String(inventoryRowIdx));
  // 1行ごとの time トリガーは上限（20件）に達しやすいため、5分ポーリングに任せる。
  return true;
}

function markInventoryEndNotifySent_(inventorySheet, rowIdx) {
  inventorySheet.getRange(rowIdx, 7).setValue("送信済み");
}

function trySendInventoryEndNotification_(adminSs, inventorySheet, rowIdx) {
  const row = inventorySheet.getRange(rowIdx, 1, 1, 7).getValues()[0];
  const userId = String(row[1] || "");
  const rewardId = String(row[2] || "");
  const rewardName = String(row[3] || "");
  const status = String(row[4] || "");
  const usedAt = parseSheetDateTime_(row[5]);
  const notifyStatus = String(row[6] || "");
  if (status !== "使用済み" || notifyStatus === "送信済み" || !usedAt) return { sent: false, reason: "skip" };
  const limitMinutes = getRewardLimitMinutesById_(adminSs, rewardId);
  if (!limitMinutes) return { sent: false, reason: "no_limit" };
  const notifyAt = computeRewardNotifyAt_(usedAt, limitMinutes);
  if (!notifyAt || Date.now() < notifyAt.getTime()) return { sent: false, reason: "not_yet" };
  const usersSheet = adminSs.getSheetByName("users");
  const userName = findUserName_(usersSheet, userId);
  const endsAt = computeRewardEndsAt_(usedAt, limitMinutes);
  const mail = sendRewardEndEmail_(adminSs, userName, rewardName, usedAt, endsAt);
  if (mail.sent) markInventoryEndNotifySent_(inventorySheet, rowIdx);
  return mail;
}

function sendRewardEndNotificationForRow_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf("reward_end_row_") !== 0) return;
    const rowIdx = parseInt(String(all[key]), 10);
    if (isNaN(rowIdx) || rowIdx < 2) return;
    try {
      const adminSs = getAdminSpreadsheet_();
      const inventorySheet = adminSs.getSheetByName("inventory");
      if (inventorySheet) trySendInventoryEndNotification_(adminSs, inventorySheet, rowIdx);
    } catch (e) {
      console.warn("sendRewardEndNotificationForRow_ row " + rowIdx, e);
    }
    props.deleteProperty(key);
  });
}

function checkPendingRewardEndNotifications_() {
  try {
    const adminSs = getAdminSpreadsheet_();
    const inventorySheet = adminSs.getSheetByName("inventory");
    if (!inventorySheet) return;
    const lastRow = inventorySheet.getLastRow();
    if (lastRow < 2) return;
    for (let rowIdx = 2; rowIdx <= lastRow; rowIdx++) {
      trySendInventoryEndNotification_(adminSs, inventorySheet, rowIdx);
    }
  } catch (e) {
    console.warn("checkPendingRewardEndNotifications_", e);
  }
}

function buildActiveRewardTicketForUser_(adminSs, userId) {
  const inventorySheet = adminSs.getSheetByName("inventory");
  if (!inventorySheet) return null;
  const lastRow = inventorySheet.getLastRow();
  if (lastRow < 2) return null;
  const data = inventorySheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const limitMap = buildRewardLimitMinutesMap_(adminSs);
  const now = Date.now();
  let best = null;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]) !== String(userId)) continue;
    if (String(row[4]) !== "使用済み") continue;
    const usedAt = parseSheetDateTime_(row[5]);
    if (!usedAt) continue;
    const limitMinutes = getRewardLimitMinutesById_(adminSs, String(row[2] || ""), limitMap);
    if (!limitMinutes) continue;
    const endsAt = computeRewardEndsAt_(usedAt, limitMinutes);
    if (!endsAt || endsAt.getTime() <= now) continue;
    const candidate = {
      rowIdx: i + 2,
      rewardId: String(row[2] || ""),
      rewardName: String(row[3] || ""),
      usedAt: usedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      limitMinutes: limitMinutes,
      remainingMs: endsAt.getTime() - now
    };
    if (!best || candidate.endsAt > best.endsAt) best = candidate;
  }
  return best;
}

function handleGetStopwatch(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureUsersSheetStopwatchColumn_(adminSs);
  const usersSheet = adminSs.getSheetByName("users");
  const rowIdx = findUserRowIndex_(usersSheet, req.userId);
  if (rowIdx < 0) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  const state = readStopwatchJson_(usersSheet, rowIdx);
  return sendResponse({ status: "success", stopwatch: state });
}

function handleSaveStopwatch(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureUsersSheetStopwatchColumn_(adminSs);
  const usersSheet = adminSs.getSheetByName("users");
  const rowIdx = findUserRowIndex_(usersSheet, req.userId);
  if (rowIdx < 0) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  const target = String(req.target || "home") === "external" ? "external" : "home";
  const state = readStopwatchJson_(usersSheet, rowIdx);
  state[target] = {
    running: !!req.running,
    startedAtMs: Number(req.startedAtMs) || 0,
    elapsedMs: Math.max(0, Number(req.elapsedMs) || 0)
  };
  const saved = writeStopwatchJson_(usersSheet, rowIdx, state);
  return sendResponse({ status: "success", stopwatch: saved });
}

function handleGetParentNotifyEmails(req) {
  const adminSs = getAdminSpreadsheet_();
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });
  ensureAppSettingsDefaults_(adminSs);
  const emails = [];
  for (let i = 1; i <= 4; i++) {
    emails.push(String(getAppSettingScalar_(adminSs, "通知メール_" + i) || "").trim());
  }
  return sendResponse({ status: "success", emails: emails });
}

function handleSaveParentNotifyEmails(req) {
  const adminSs = getAdminSpreadsheet_();
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });
  ensureAppSettingsDefaults_(adminSs);
  const list = Array.isArray(req.emails) ? req.emails : [];
  for (let i = 0; i < 4; i++) {
    const v = String(list[i] || "").trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return sendResponse({ status: "error", message: "メールアドレス " + (i + 1) + " の形式が正しくありません" });
    }
    setAppSettingValue_(adminSs, "通知メール_" + (i + 1), v);
  }
  return sendResponse({ status: "success", message: "通知メールを保存しました" });
}

function handleGetActiveRewardTicket(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureInventorySheetStructure_(adminSs);
  ensureRewardsSheetStructure_(adminSs);
  const ticket = buildActiveRewardTicketForUser_(adminSs, req.userId);
  return sendResponse({ status: "success", activeTicket: ticket });
}

function handleSaveLearningSession(req) {
  try {
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty('ADMIN_SS_ID'));
  const usersSheet = adminSs.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  
  let targetRowIdx = -1;
  let userData = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === req.userId) {
      targetRowIdx = i + 1;
      userData = {
        points: Number(data[i][3]) || 0,
        lastStudyJson: safeParseUserJsonCell_(data[i][4], {}),
        historyJson: safeParseUserJsonCell_(data[i][5], {}),
        dailyPointsJson: safeParseUserJsonCell_(data[i][6], {}),
        trainingProgressJson: safeParseUserJsonCell_(data[i][7], {})
      };
      break;
    }
  }
  if (targetRowIdx === -1) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });

  const priorLock = getSessionSubmitLock_(userData, req.sessionSubmitId);
  const unitId = String(req.unitId || "");
  const useEnglishHistorySheet = usesEnglishUnitHistorySheet_(req, unitId);
  if (priorLock) {
    const sheetPointPercent = parseUnitSheetPointPercent_(req.unitSheetName);
    let patchSource = {};
    if (useEnglishHistorySheet) {
      patchSource = loadEnglishUnitHistory_(adminSs, req.userId, unitId);
    } else if (userData.historyJson[unitId]) {
      patchSource = userData.historyJson[unitId];
    }
    const resp = {
      status: "success",
      earnedPoints: priorLock.earnedPoints,
      newTotal: priorLock.newTotal,
      alreadyProcessed: true,
      bonusApplied: req.isRandom,
      sheetPointPercent: sheetPointPercent,
      historyUnitId: unitId,
      historyUnitPatch: buildHistoryUnitPatchForSession_(patchSource, req.results),
      dailyPointsJson: userData.dailyPointsJson
    };
    if (req.trainingStepIndex) {
      resp.trainingProgressJson = userData.trainingProgressJson;
    }
    return sendResponse(resp);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let multiplier = 1.0;
  const lastStudyKey = String(req.kanjiSetScopeId || req.unitId || "");
  let lastStudyTimeStr = lastStudyKey ? userData.lastStudyJson[lastStudyKey] : undefined;
  if (req.kanjiSetContinuation) lastStudyTimeStr = null;

  if (lastStudyTimeStr) {
    const lastTime = new Date(lastStudyTimeStr);
    const diffHours = (now - lastTime) / (1000 * 60 * 60);
    let basePercent = 10 + Math.floor(diffHours / 2) * 10;
    if (basePercent > 100) basePercent = 100;
    multiplier = basePercent / 100;
  }
  
  if (req.isReviewMode) multiplier += 0.4;
  if (req.isRandom) multiplier += 0.1;

  let sessionRawPoints = 0;
  const resultsList = Array.isArray(req.results) ? req.results : [];
  let unitHistory = {};
  const kanjiScoreBatch = Array.isArray(req.kanjiScoreBatch) ? req.kanjiScoreBatch : null;
  const isKanjiScoreBatch = req.learningCategory === "kanji" && req.challengeType === "score" && kanjiScoreBatch && kanjiScoreBatch.length;
  const isKanjiScoreSession = req.learningCategory === "kanji" && req.challengeType === "score" && req.kanjiChar && !isKanjiScoreBatch;
  let kanjiView = null;
  let itemEarnedList = null;
  const sheetPointPercent = parseUnitSheetPointPercent_(req.unitSheetName);

  if (useEnglishHistorySheet) {
    unitHistory = loadEnglishUnitHistory_(adminSs, req.userId, unitId);
    if (userData.historyJson[unitId]) delete userData.historyJson[unitId];
  } else if (!isKanjiScoreBatch) {
    if (!userData.historyJson[unitId]) userData.historyJson[unitId] = {};
    unitHistory = userData.historyJson[unitId];
  }

  function applyOneKanjiScoreItem_(item, itemMultiplier, settings, view) {
    const charKey = String(item.kanjiChar || "");
    if (!charKey) return 0;
    const score = Number(item.score) || 0;
    const earnedOverride = item.earnedOverride;
    const hasEarnedOverride = earnedOverride != null && earnedOverride !== "" && !isNaN(Number(earnedOverride));
    let basePt = 0;
    if (hasEarnedOverride) {
      basePt = Math.round(Number(earnedOverride) * 10) / 10;
    } else {
      basePt = getKanjiBasePointsByScore_(score, settings, item.kanjiQuestionType);
    }
    if (!view.__kanjiChallenge) view.__kanjiChallenge = {};
    if (!view.__kanjiChallenge[charKey]) view.__kanjiChallenge[charKey] = { highScoreDates: [] };
    const cHist = view.__kanjiChallenge[charKey];
    if (!Array.isArray(cHist.highScoreDates)) cHist.highScoreDates = [];
    const recoveryRate = calcKanjiCharRecoveryRate_(cHist.highScoreDates, now, settings);
    let raw = Math.round(basePt * recoveryRate * 100) / 100;
    let earned = Math.round((raw * itemMultiplier) * 100) / 100;
    if (sheetPointPercent !== 100) {
      earned = Math.round(earned * (sheetPointPercent / 100) * 100) / 100;
    }
    earned = Math.max(0, earned);
    if (score >= 60) cHist.highScoreDates.push(now.toISOString());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    cHist.highScoreDates = cHist.highScoreDates
      .map(function (v) { return new Date(v); })
      .filter(function (d) { return !isNaN(d.getTime()) && d >= weekAgo; })
      .map(function (d) { return d.toISOString(); });
    const itemUnitId = String(item.unitId || unitId || "");
    const qHistId = item.questionId;
    if (itemUnitId && qHistId) {
      if (!userData.historyJson[itemUnitId]) userData.historyJson[itemUnitId] = {};
      const uh = userData.historyJson[itemUnitId];
      if (!uh[qHistId]) uh[qHistId] = { results: [], times: [] };
      uh[qHistId].results.push(item.questionCorrect === true ? 1 : 0);
      if (uh[qHistId].results.length > 10) uh[qHistId].results.shift();
      uh[qHistId].times.push(typeof item.timeSec === "number" ? item.timeSec : 0);
      if (uh[qHistId].times.length > 10) uh[qHistId].times.shift();
    }
    return earned;
  }

  if (isKanjiScoreBatch) {
    kanjiView = buildKanjiHistoryView_(adminSs, req.userId);
    const settings = getAppSettingsMap_(adminSs);
    itemEarnedList = [];
    let batchTotal = 0;
    kanjiScoreBatch.forEach(function (item, idx) {
      // 従来どおり：セット先頭のみ時間減衰倍率、2問目以降は continuation 相当で 1.0
      const itemMult = idx === 0 ? multiplier : 1.0;
      const earned = applyOneKanjiScoreItem_(item || {}, itemMult, settings, kanjiView);
      itemEarnedList.push(earned);
      batchTotal += earned;
    });
    sessionRawPoints = batchTotal;
  } else if (isKanjiScoreSession) {
    kanjiView = buildKanjiHistoryView_(adminSs, req.userId);
    const settings = getAppSettingsMap_(adminSs);
    const oneEarned = applyOneKanjiScoreItem_({
      kanjiChar: req.kanjiChar,
      score: req.score,
      earnedOverride: req.earnedOverride,
      kanjiQuestionType: req.kanjiQuestionType,
      questionId: req.questionId,
      questionCorrect: req.questionCorrect,
      timeSec: req.timeSec,
      unitId: unitId
    }, multiplier, settings, kanjiView);
    sessionRawPoints = oneEarned;
    itemEarnedList = [oneEarned];
  } else {
    resultsList.forEach(function (res, idx) {
      if (res && res.isCorrect) {
        let qPoint = computeEnglishQuestionRawPoints_(res.basePoint, res.maxDeduction);
        sessionRawPoints += qPoint;
      }
    });
    unitHistory = mergeSessionResultsIntoUnitHistory_(unitHistory, resultsList);
  }

  if (useEnglishHistorySheet) {
    saveEnglishUnitHistory_(adminSs, req.userId, unitId, unitHistory, now.toISOString());
  }

  if ((isKanjiScoreSession || isKanjiScoreBatch) && kanjiView) {
    persistKanjiHistoryView_(adminSs, req.userId, kanjiView, now.toISOString());
  }

  stripKanjiAndEnglishFromHistoryJson_(userData.historyJson);

  let earnedPoints;
  if (isKanjiScoreSession || isKanjiScoreBatch) {
    // applyOneKanjiScoreItem_ 側で倍率・シート補正済み
    earnedPoints = Math.round(Number(sessionRawPoints) * 100) / 100;
  } else {
    earnedPoints = Math.round((sessionRawPoints * multiplier) * 100) / 100;
    if (sheetPointPercent !== 100) {
      earnedPoints = Math.round(earnedPoints * (sheetPointPercent / 100) * 100) / 100;
    }
  }
  earnedPoints = Math.max(0, earnedPoints);
  const newTotalPoints = Math.round((userData.points + earnedPoints) * 100) / 100;
  
  userData.dailyPointsJson[todayStr] = (userData.dailyPointsJson[todayStr] || 0) + earnedPoints;
  userData.dailyPointsJson[todayStr] = Math.round(userData.dailyPointsJson[todayStr] * 100) / 100;
  if (lastStudyKey) userData.lastStudyJson[lastStudyKey] = now.toISOString();

  // ★ 特訓ルートのステップをクリアした場合は、今日の進捗にチェックを入れる（メニューID別）
  if (req.trainingStepIndex) {
    let mid = parseInt(req.trainingMenuId, 10);
    if (isNaN(mid) || mid < 1 || mid > 12) mid = 1;
    const midStr = String(mid);
    if (!userData.trainingProgressJson[todayStr]) userData.trainingProgressJson[todayStr] = {};
    if (!userData.trainingProgressJson[todayStr][midStr]) userData.trainingProgressJson[todayStr][midStr] = {};
    userData.trainingProgressJson[todayStr][midStr][req.trainingStepIndex] = true;
  }

  rememberSessionSubmitLock_(userData, req.sessionSubmitId, earnedPoints, newTotalPoints, now.toISOString());

  writeUserLearningRow_(usersSheet, targetRowIdx, userData, newTotalPoints);

  const sessionPatch = buildHistoryUnitPatchForSession_(unitHistory, resultsList);
  const resp = {
    status: "success",
    earnedPoints: earnedPoints,
    newTotal: newTotalPoints,
    historyUnitId: unitId,
    historyUnitPatch: sessionPatch,
    dailyPointsJson: userData.dailyPointsJson,
    bonusApplied: req.isRandom,
    sheetPointPercent: sheetPointPercent
  };
  if (itemEarnedList) resp.itemEarned = itemEarnedList;
  if (lastStudyKey) {
    resp.lastStudyKey = lastStudyKey;
    resp.lastStudyAt = now.toISOString();
  }
  if (req.trainingStepIndex) {
    resp.trainingProgressJson = userData.trainingProgressJson;
  }
  if ((isKanjiScoreSession || isKanjiScoreBatch) && kanjiView) {
    const kRoot = kanjiView.__kanjiChallenge || {};
    if (isKanjiScoreBatch) {
      resp.kanjiChallengePatches = {};
      kanjiScoreBatch.forEach(function (item) {
        const ck = String((item && item.kanjiChar) || "");
        if (ck && kRoot[ck]) resp.kanjiChallengePatches[ck] = kRoot[ck];
      });
    } else if (req.kanjiChar && kRoot[String(req.kanjiChar)]) {
      resp.kanjiChallengeChar = String(req.kanjiChar);
      resp.kanjiChallengePatch = kRoot[String(req.kanjiChar)];
    }
  }
  return sendResponse(resp);
  } catch (err) {
    return sendResponse({ status: "error", message: "保存処理エラー: " + String(err && err.message ? err.message : err) });
  }
}

/** 漢字ニガテ：kanji_history シート __kanjiWeak へ薄いシグナルだけマージ（キー数・recent 上限あり） */
var KANJI_WEAK_MAX_KEYS_ = 200;
var KANJI_WEAK_RECENT_MAX_ = 12;
var KANJI_NIGATE_PASS_REQUIRED_ = 3;

function kanjiWeakMakeKey_(modeId, unitName, setId, kanji) {
  return [String(modeId || ""), String(unitName || ""), String(setId || ""), String(kanji || "")].join("\x1f");
}

function pruneKanjiWeakIfNeeded_(weakRoot) {
  const keys = Object.keys(weakRoot);
  if (keys.length <= KANJI_WEAK_MAX_KEYS_) return;
  const scored = keys.map(function (k) {
    const r = weakRoot[k] || {};
    return { k: k, t: String(r.updatedAt || "") };
  });
  scored.sort(function (a, b) {
    return a.t.localeCompare(b.t);
  });
  const drop = scored.length - KANJI_WEAK_MAX_KEYS_;
  for (let i = 0; i < drop; i++) delete weakRoot[scored[i].k];
}

function normalizeKanjiWeakSignalPayload_(sig) {
  if (!sig || typeof sig !== "object") return null;
  const kanji = String(sig.kanji || sig.kanjiChar || "").trim();
  if (!kanji) return null;
  let signal = String(sig.signal || "").trim();
  if (!signal) {
    if (sig.readingMistake === true) signal = "reading_mistake";
    else if (sig.strokeCountQuizWrong === true) signal = "stroke_count_fail";
    else if (sig.handwritingFail === true) signal = "handwriting_fail";
    else signal = "hand_analytics";
  }
  return {
    kanji: kanji,
    modeId: String(sig.modeId || "").trim(),
    unitName: String(sig.unitName || "").trim(),
    setId: String(sig.setId || "").trim(),
    signal: signal,
    questionId: sig.questionId,
    hasStrokeOrderIssue: sig.hasStrokeOrderIssue,
    brushEndingAllOk: sig.brushEndingAllOk,
    strokeCountMismatch: sig.strokeCountMismatch,
    referenceStrokeCount: sig.referenceStrokeCount,
    handScore: sig.handScore
  };
}

function mergeKanjiWeakFromRequest_(weakRoot, req, nowIso) {
  const norm = normalizeKanjiWeakSignalPayload_(req);
  if (!norm) return { ok: false, message: "kanji が空です" };
  if (!weakRoot || typeof weakRoot !== "object") return { ok: false, message: "weakRoot が無効です" };
  const kanji = norm.kanji;
  const modeId = norm.modeId;
  const unitName = norm.unitName;
  const setId = norm.setId;
  const signal = norm.signal;
  const key = kanjiWeakMakeKey_(modeId, unitName, setId, kanji);
  if (!weakRoot[key]) {
    weakRoot[key] = {
      modeId: modeId,
      unitName: unitName,
      setId: setId,
      kanji: kanji,
      strokeOrderFails: 0,
      brushFails: 0,
      strokeCountFails: 0,
      readingFails: 0,
      handwritingFails: 0,
      lastRefStrokeCount: null,
      recent: [],
      updatedAt: nowIso
    };
  }
  const row = weakRoot[key];
  if (signal === "hand_analytics") {
    if (norm.strokeCountMismatch === true) row.strokeCountFails++;
    if (norm.hasStrokeOrderIssue === true) row.strokeOrderFails++;
    if (norm.brushEndingAllOk === false) row.brushFails++;
    if (norm.referenceStrokeCount != null && !isNaN(Number(norm.referenceStrokeCount))) {
      row.lastRefStrokeCount = Number(norm.referenceStrokeCount);
    }
    if (norm.handScore != null && Number(norm.handScore) < 60) row.handwritingFails++;
  } else if (signal === "reading_mistake") {
    row.readingFails++;
  } else if (signal === "stroke_count_fail") {
    row.strokeCountFails++;
  } else if (signal === "handwriting_fail") {
    row.handwritingFails = (Number(row.handwritingFails) || 0) + 1;
    row.lastQuestionType = "ruby_to_kanji";
    if (norm.brushEndingAllOk === false) row.brushFails++;
  }
  const ev = {
    at: nowIso,
    signal: signal,
    q: String(norm.questionId || "")
  };
  if (norm.hasStrokeOrderIssue != null) ev.hso = !!norm.hasStrokeOrderIssue;
  if (norm.brushEndingAllOk != null) ev.bok = !!norm.brushEndingAllOk;
  if (norm.strokeCountMismatch != null) ev.scm = !!norm.strokeCountMismatch;
  if (norm.handScore != null) ev.hs = Number(norm.handScore);
  if (!Array.isArray(row.recent)) row.recent = [];
  row.recent.push(ev);
  while (row.recent.length > KANJI_WEAK_RECENT_MAX_) row.recent.shift();
  row.updatedAt = nowIso;
  pruneKanjiWeakIfNeeded_(weakRoot);
  return { ok: true };
}

function handleAppendKanjiWeakSignals(req) {
  const userId = req.userId;
  if (!userId) return sendResponse({ status: "error", message: "userId が必要です" });
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty("ADMIN_SS_ID"));
  const usersSheet = adminSs.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  let targetRowIdx = -1;
  let userData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      targetRowIdx = i + 1;
      userData = {
        points: Number(data[i][3]) || 0,
        lastStudyJson: JSON.parse(data[i][4] || "{}"),
        historyJson: JSON.parse(data[i][5] || "{}"),
        dailyPointsJson: JSON.parse(data[i][6] || "{}"),
        trainingProgressJson: JSON.parse(data[i][7] || "{}")
      };
      break;
    }
  }
  if (targetRowIdx === -1) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  const nowIso = new Date().toISOString();
  const kanjiView = buildKanjiHistoryView_(adminSs, userId);
  if (!kanjiView.__kanjiWeak) kanjiView.__kanjiWeak = {};
  const list = Array.isArray(req.signals) ? req.signals : [req];
  let merged = 0;
  let lastErr = "";
  list.forEach(function (sig) {
    const r = mergeKanjiWeakFromRequest_(kanjiView.__kanjiWeak, sig, nowIso);
    if (r.ok) merged++;
    else lastErr = r.message || lastErr;
  });
  if (!merged) return sendResponse({ status: "error", message: lastErr || "マージ対象がありません" });
  persistKanjiHistoryView_(adminSs, userId, kanjiView, nowIso);
  stripKanjiAndEnglishFromHistoryJson_(userData.historyJson);
  normalizeUserJsonBeforeSave_(userData);
  usersSheet.getRange(targetRowIdx, 6).setValue(JSON.stringify(userData.historyJson));
  return sendResponse({ status: "success", merged: merged });
}

function normalizeNigateTrainMode_(trainMode) {
  const s = String(trainMode || "").trim();
  if (s === "write_kanji" || s === "stroke_order" || s === "brush") return "ruby_to_kanji";
  if (s === "select_kana") return "okurigana_shift";
  if (s === "reading" || s === "type_yomi") return "sentence_to_ruby";
  if (!s) return "ruby_to_kanji";
  return s;
}

function kanjiNigatePassKey_(modeId, unitName, setId, kanji, trainMode) {
  return kanjiWeakMakeKey_(modeId, unitName, setId, kanji) + "\x1f" + normalizeNigateTrainMode_(trainMode);
}

function getKanjiNigatePassRecord_(nigateRoot, modeId, unitName, setId, kanji, trainMode) {
  const root = nigateRoot || {};
  const key = kanjiNigatePassKey_(modeId, unitName, setId, kanji, trainMode);
  const rec = root[key];
  if (!rec) return { passCount: 0, passes: [] };
  return {
    passCount: Number(rec.passCount) || 0,
    passes: Array.isArray(rec.passes) ? rec.passes : []
  };
}

function recordKanjiNigatePass_(nigateRoot, modeId, unitName, setId, kanji, trainMode, nowIso, passRequired) {
  const need = passRequired || KANJI_NIGATE_PASS_REQUIRED_;
  const axis = normalizeNigateTrainMode_(trainMode);
  const root = nigateRoot || {};
  const key = kanjiNigatePassKey_(modeId, unitName, setId, kanji, axis);
  if (!root[key]) {
    root[key] = { passCount: 0, passes: [] };
  }
  const rec = root[key];
  rec.passCount = (Number(rec.passCount) || 0) + 1;
  if (!Array.isArray(rec.passes)) rec.passes = [];
  rec.passes.push(nowIso);
  while (rec.passes.length > 24) rec.passes.shift();
  rec.updatedAt = nowIso;
  return {
    passCount: rec.passCount,
    passRequired: need,
    graduated: rec.passCount >= need
  };
}

function handleRecordKanjiNigatePass(req) {
  const userId = req.userId;
  if (!userId) return sendResponse({ status: "error", message: "userId が必要です" });
  const kanji = String(req.kanji || req.kanjiChar || "").trim();
  if (!kanji) return sendResponse({ status: "error", message: "kanji が空です" });
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty("ADMIN_SS_ID"));
  const usersSheet = adminSs.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  let targetRowIdx = -1;
  let userData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      targetRowIdx = i + 1;
      userData = {
        historyJson: JSON.parse(data[i][5] || "{}"),
        lastStudyJson: JSON.parse(data[i][4] || "{}")
      };
      break;
    }
  }
  if (targetRowIdx === -1) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  const nowIso = new Date().toISOString();
  const passRequired = parseInt(req.passRequired, 10) || KANJI_NIGATE_PASS_REQUIRED_;
  const kanjiView = buildKanjiHistoryView_(adminSs, userId);
  if (!kanjiView.__kanjiNigatePass) kanjiView.__kanjiNigatePass = {};
  const result = recordKanjiNigatePass_(
    kanjiView.__kanjiNigatePass,
    String(req.modeId || ""),
    String(req.unitName || ""),
    String(req.setId || ""),
    kanji,
    String(req.trainMode || req.nigateAxis || "ruby_to_kanji"),
    nowIso,
    passRequired
  );
  persistKanjiHistoryView_(adminSs, userId, kanjiView, nowIso);
  stripKanjiAndEnglishFromHistoryJson_(userData.historyJson);
  normalizeUserJsonBeforeSave_(userData);
  usersSheet.getRange(targetRowIdx, 6).setValue(JSON.stringify(userData.historyJson));
  return sendResponse({ status: "success", kanji: kanji, passCount: result.passCount, passRequired: result.passRequired, graduated: result.graduated });
}

function findKanjiItemInGroups_(groups, kanji, preferredSetId) {
  const k = String(kanji || "");
  if (!k || !groups || !groups.length) return null;
  if (preferredSetId) {
    const g0 = groups.find(function (g) { return String(g.setId) === String(preferredSetId); });
    if (g0 && g0.items) {
      const hit = g0.items.find(function (it) { return String(it.kanji) === k; });
      if (hit) return { item: hit, setId: String(g0.setId) };
    }
  }
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (!g || !g.items) continue;
    const hit = g.items.find(function (it) { return String(it.kanji) === k; });
    if (hit) return { item: hit, setId: String(g.setId) };
  }
  return null;
}

function buildStrokeCountQuizQuestionForNigate_(kanji, refCount) {
  const k = String(kanji || "");
  let correct = parseInt(refCount, 10);
  if (isNaN(correct) || correct < 1) correct = 5;
  const raw = [correct - 2, correct - 1, correct, correct + 1, correct + 2].filter(function (n) { return n >= 1; });
  const seen = {};
  const choices = [];
  raw.forEach(function (n) {
    const s = String(n);
    if (!seen[s]) {
      seen[s] = true;
      choices.push(s);
    }
  });
  while (choices.length < 4) {
    const extra = String(correct + choices.length);
    if (!seen[extra]) {
      seen[extra] = true;
      choices.push(extra);
    } else break;
  }
  return {
    type: "stroke_count",
    kanji: k,
    prompt: "この漢字の画数を選びましょう。",
    choices: shuffleKanjiQuizArray_(choices),
    correctAnswer: String(correct),
    searchText: k + " 画数 " + correct
  };
}

function buildNigateQuestionForWeakRow_(trainMode, item, weakRow, dummyPoolByKanji) {
  if (!item) return null;
  const axis = normalizeNigateTrainMode_(trainMode);
  if (axis === "sentence_to_ruby") return buildSentenceToRubyQuizQuestion_(item);
  if (axis === "stroke_count") {
    return buildStrokeCountQuizQuestionForNigate_(weakRow.kanji, weakRow.lastRefStrokeCount);
  }
  if (axis === "okurigana_shift") {
    return buildOkuriganaShiftQuizQuestion_(item, dummyPoolByKanji || {});
  }
  return buildRubyToKanjiQuizQuestion_(item);
}

function kanjiWeakAxisWeight_(row, trainMode) {
  const axis = normalizeNigateTrainMode_(trainMode);
  if (axis === "sentence_to_ruby") return Number(row.readingFails) || 0;
  if (axis === "stroke_count") return Number(row.strokeCountFails) || 0;
  if (axis === "okurigana_shift") return Number(row.readingFails) || 0;
  if (axis === "ruby_to_kanji") {
    const hw = Number(row.handwritingFails) || 0;
    if (hw > 0) return hw;
    if (row.lastQuestionType === "ruby_to_kanji") return 1;
    return 0;
  }
  return Number(row.handwritingFails) || 0;
}

function dedupeWeakRowsByKanji_(rows) {
  const seen = {};
  const out = [];
  (rows || []).forEach(function (r) {
    const k = String(r.kanji || "");
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(r);
  });
  return out;
}

function handleGetKanjiWeakReviewPlan(req) {
  const userId = req.userId;
  if (!userId) return sendResponse({ status: "error", message: "userId が必要です" });
  const modeId = String(req.modeId || "").trim();
  const unitName = String(req.unitName || (Array.isArray(req.unitNames) && req.unitNames[0]) || "").trim();
  if (!modeId || !unitName) {
    return sendResponse({ status: "error", message: "modeId / unitName が必要です" });
  }
  const props = PropertiesService.getScriptProperties();
  const adminSs = SpreadsheetApp.openById(props.getProperty("ADMIN_SS_ID"));
  const usersSheet = adminSs.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  let historyJson = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      historyJson = JSON.parse(data[i][5] || "{}");
      break;
    }
  }
  if (!historyJson) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  const kanjiView = buildKanjiHistoryView_(adminSs, userId);
  const weakRoot = kanjiView.__kanjiWeak || {};
  const setIds = Array.isArray(req.setIds) ? req.setIds.map(function (x) { return String(x); }).filter(Boolean) : [];
  const trainMode = normalizeNigateTrainMode_(req.nigateAxis || req.trainMode || "ruby_to_kanji");
  const passRequired = parseInt(req.passRequired, 10) || KANJI_NIGATE_PASS_REQUIRED_;
  const limit = Math.min(12, Math.max(1, parseInt(req.limit, 10) || 12));
  const candidateRows = [];
  Object.keys(weakRoot).forEach(function (k) {
    const r = weakRoot[k];
    if (!r || !r.kanji) return;
    if (modeId && String(r.modeId) !== modeId) return;
    if (unitName && String(r.unitName) !== unitName) return;
    if (setIds.length && setIds.indexOf(String(r.setId)) < 0) return;
    const w = kanjiWeakAxisWeight_(r, trainMode);
    if (w <= 0) return;
    const passRec = getKanjiNigatePassRecord_(kanjiView.__kanjiNigatePass || {}, r.modeId, r.unitName, r.setId, r.kanji, trainMode);
    if (passRec.passCount >= passRequired) return;
    candidateRows.push({
      modeId: r.modeId,
      unitName: r.unitName,
      setId: r.setId,
      kanji: r.kanji,
      w: w,
      passCount: passRec.passCount,
      passRequired: passRequired,
      lastRefStrokeCount: r.lastRefStrokeCount
    });
  });
  candidateRows.sort(function (a, b) { return b.w - a.w; });
  const picked = dedupeWeakRowsByKanji_(candidateRows).slice(0, limit);
  if (!picked.length) {
    return sendResponse({
      status: "success",
      questions: [],
      rows: [],
      message: "この条件ではもんだいがありません。通常学習でまちがえた漢字がここにのこります。"
    });
  }
  let groups = [];
  try {
    const got = getKanjiQuizParsedFromSpreadsheet_(modeId, unitName);
    if (got.sheetMissing) return sendResponse({ status: "error", message: "指定シートが見つかりません。" });
    groups = (got.parsed && got.parsed.groups) ? got.parsed.groups : [];
  } catch (e) {
    return sendResponse({ status: "error", message: "教材の読み込みに失敗しました: " + e.message });
  }
  const allItems = [];
  groups.forEach(function (g) {
    if (g && g.items) allItems.push.apply(allItems, g.items);
  });
  const dummyPoolByKanji = collectOkuriganaDummyPoolByKanjiKanjiQuiz_(allItems);
  const questions = [];
  const rows = [];
  picked.forEach(function (weakRow) {
    const found = findKanjiItemInGroups_(groups, weakRow.kanji, weakRow.setId);
    if (!found) return;
    const q = buildNigateQuestionForWeakRow_(trainMode, found.item, weakRow, dummyPoolByKanji);
    if (!q) return;
    q.questionId = "NIGATE_" + weakRow.kanji + "_" + trainMode + "_" + found.setId;
    q.nigateSourceSetId = found.setId;
    q.nigatePassCount = weakRow.passCount;
    q.nigatePassRequired = passRequired;
    q.nigateTrainMode = trainMode;
    questions.push(q);
    rows.push(weakRow);
  });
  if (!questions.length) {
    return sendResponse({
      status: "success",
      questions: [],
      rows: rows,
      message: "よわみデータはありますが、教材シートから問題を組み立てられませんでした。"
    });
  }
  return sendResponse({
    status: "success",
    questions: questions,
    rows: rows,
    passRequired: passRequired,
    trainMode: trainMode
  });
}

// ==========================================
// 既存のハンドラー（変更なし）
// ==========================================
function handleGetAppSettings(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID'));
  ensureAppSettingsDefaults_(adminSs);
  const settingsSheet = adminSs.getSheetByName("アプリ設定");
  if (!settingsSheet) return sendResponse({ status: "success", settings: {} });
  return sendResponse({
    status: "success",
    settings: buildAppSettingsFromSheetRows_(settingsSheet.getDataRange().getValues())
  });
}
function handleGetExternalLearning(req) { const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID')).getSheetByName("外部学習"); const list = []; if (sheet) { const data = sheet.getDataRange().getValues(); if (data.length > 0) { const headers = data[0].map(String); const isNew = headers[0] === "カテゴリ"; for (let i = 1; i < data.length; i++) { if (!data[i][0]) continue; if (isNew) { list.push({ category: data[i][0], volume: data[i][1], points: Number(data[i][2]) }); } else { list.push({ category: data[i][0], volume: "", points: Number(data[i][1]) }); } } } } return sendResponse({ status: "success", list: list }); }

function ensureExternalLearningRequestSheet_(adminSs) {
  let sheet = adminSs.getSheetByName("外部学習申請");
  if (!sheet) {
    sheet = adminSs.insertSheet("外部学習申請");
    sheet.appendRow(["申請日時", "ユーザーID", "ユーザー名", "カテゴリ", "分量", "ポイント", "こどもメモ", "状態", "処理日時", "おとなメモ"]);
  }
  return sheet;
}

function getExternalLearningAdminPin_(adminSs) {
  const sheet = adminSs.getSheetByName("アプリ設定");
  if (!sheet) return "";
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === "外部学習_管理者PIN") return String(data[i][1] || "");
  }
  return "";
}

function verifyExternalAdminPin_(adminSs, adminPin) {
  const expected = getExternalLearningAdminPin_(adminSs);
  if (!expected) return { ok: false, message: "管理者PINがアプリ設定に登録されていません。「外部学習_管理者PIN」を追加してください。" };
  if (String(adminPin) !== String(expected)) return { ok: false, message: "管理者PINが一致しません" };
  return { ok: true };
}

function validateExternalMenu_(adminSs, menuName, points) {
  const sheet = adminSs.getSheetByName("外部学習");
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return false;
  const headers = data[0].map(String);
  const isNew = headers[0] === "カテゴリ";
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (isNew) {
      if (String(data[i][0]) === String(menuName.category) && String(data[i][1]) === String(menuName.volume) && Number(data[i][2]) === Number(points)) return true;
    } else {
      if (String(data[i][0]) === String(menuName.category || menuName) && Number(data[i][1]) === Number(points)) return true;
    }
  }
  return false;
}

function ensureExternalRequestHeaderMap_(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const map = {};
  ["申請日時", "ユーザーID", "ユーザー名", "カテゴリ", "分量", "ポイント", "こどもメモ", "状態", "処理日時", "おとなメモ"].forEach(key => {
    map[key] = header.indexOf(key) + 1; // 1-based col
  });
  const required = ["申請日時", "ユーザーID", "ユーザー名", "ポイント", "状態"];
  for (const k of required) {
    if (map[k] === 0) return { ok: false, map: null, message: "「外部学習申請」シートのヘッダーが最新ではありません。カテゴリ/分量/こどもメモ/おとなメモ列を追加してください。" };
  }
  return { ok: true, map };
}

function handleSubmitExternalLearningRequest(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID'));
  const usersSheet = adminSs.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  let userName = "";
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === req.userId) {
      userName = String(data[i][1] || "");
      break;
    }
  }
  if (!userName) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  if (!validateExternalMenu_(adminSs, { category: req.category, volume: req.volume }, req.points)) return sendResponse({ status: "error", message: "メニューが不正です" });

  const sheet = ensureExternalLearningRequestSheet_(adminSs);
  const { ok, map, message } = ensureExternalRequestHeaderMap_(sheet);
  if (!ok) return sendResponse({ status: "error", message });

  const now = new Date();
  const nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const row = [];
  row[map["申請日時"] - 1] = nowStr;
  row[map["ユーザーID"] - 1] = req.userId;
  row[map["ユーザー名"] - 1] = userName;
  if (map["カテゴリ"]) row[map["カテゴリ"] - 1] = req.category;
  if (map["分量"]) row[map["分量"] - 1] = req.volume;
  row[map["ポイント"] - 1] = Number(req.points);
  if (map["こどもメモ"]) row[map["こどもメモ"] - 1] = req.childMemo || "";
  row[map["状態"] - 1] = "申請中";
  if (map["処理日時"]) row[map["処理日時"] - 1] = "";
  if (map["おとなメモ"]) row[map["おとなメモ"] - 1] = "";
  sheet.appendRow(row);
  const rowIdx = sheet.getLastRow();

  return sendResponse({ status: "success", message: "申請を受け付けました。おうちの人に承認してもらってね。", rowIdx: rowIdx });
}

function handleGetPendingExternalRequests(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID'));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  const sheet = ensureExternalLearningRequestSheet_(adminSs);
  const { ok, map, message } = ensureExternalRequestHeaderMap_(sheet);
  if (!ok) return sendResponse({ status: "error", message });
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][map["状態"] - 1]) === "申請中") {
      list.push({
        rowIdx: i + 1,
        requestedAt: String(data[i][map["申請日時"] - 1] || ""),
        userId: String(data[i][map["ユーザーID"] - 1] || ""),
        userName: String(data[i][map["ユーザー名"] - 1] || ""),
        category: map["カテゴリ"] ? String(data[i][map["カテゴリ"] - 1] || "") : "",
        volume: map["分量"] ? String(data[i][map["分量"] - 1] || "") : "",
        points: Number(data[i][map["ポイント"] - 1]) || 0,
        childMemo: map["こどもメモ"] ? String(data[i][map["こどもメモ"] - 1] || "") : ""
      });
    }
  }
  return sendResponse({ status: "success", list: list });
}

function handleApproveExternalRequest(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID'));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  const sheet = ensureExternalLearningRequestSheet_(adminSs);
  const rowIdx = Number(req.rowIdx);
  const lastRow = sheet.getLastRow();
  if (rowIdx < 2 || rowIdx > lastRow) return sendResponse({ status: "error", message: "申請が見つかりません" });

  const { ok, map, message } = ensureExternalRequestHeaderMap_(sheet);
  if (!ok) return sendResponse({ status: "error", message });
  const row = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (String(row[map["状態"] - 1]) !== "申請中") return sendResponse({ status: "error", message: "この申請はすでに処理済みです" });

  const userId = String(row[map["ユーザーID"] - 1]);
  const points = Number(row[map["ポイント"] - 1]) || 0;
  const menuName = map["カテゴリ"] ? String(row[map["カテゴリ"] - 1]) : "";
  const userName = String(row[map["ユーザー名"] - 1] || "");

  const usersSheet = adminSs.getSheetByName("users");
  const udata = usersSheet.getDataRange().getValues();
  let found = false;
  let newTotal = 0;
  for (let i = 1; i < udata.length; i++) {
    if (udata[i][0] === userId) {
      found = true;
      newTotal = Math.round(((Number(udata[i][3]) || 0) + points) * 100) / 100;
      usersSheet.getRange(i + 1, 4).setValue(newTotal);
      break;
    }
  }
  if (!found) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });

  const now = new Date();
  const nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.getRange(rowIdx, map["状態"]).setValue("承認済み");
  if (map["処理日時"]) sheet.getRange(rowIdx, map["処理日時"]).setValue(nowStr);
  if (map["おとなメモ"]) sheet.getRange(rowIdx, map["おとなメモ"]).setValue(req.adminMemo || "");

  return sendResponse({ status: "success", message: "承認してポイントを付与しました。", newTotal: newTotal, userId: userId, userName: userName, category: menuName, volume: map["分量"] ? String(row[map["分量"] - 1]) : "", points: points });
}

function handleRejectExternalRequest(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID'));
  const v = verifyExternalAdminPin_(adminSs, req.adminPin);
  if (!v.ok) return sendResponse({ status: "error", message: v.message });

  const sheet = ensureExternalLearningRequestSheet_(adminSs);
  const rowIdx = Number(req.rowIdx);
  const lastRow = sheet.getLastRow();
  if (rowIdx < 2 || rowIdx > lastRow) return sendResponse({ status: "error", message: "申請が見つかりません" });

  const { ok, map, message } = ensureExternalRequestHeaderMap_(sheet);
  if (!ok) return sendResponse({ status: "error", message });

  const status = String(sheet.getRange(rowIdx, map["状態"]).getValue());
  if (status !== "申請中") return sendResponse({ status: "error", message: "この申請はすでに処理済みです" });

  const now = new Date();
  const nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.getRange(rowIdx, map["状態"]).setValue("却下");
  if (map["処理日時"]) sheet.getRange(rowIdx, map["処理日時"]).setValue(nowStr);
  if (map["おとなメモ"]) sheet.getRange(rowIdx, map["おとなメモ"]).setValue(req.adminMemo || "");

  return sendResponse({ status: "success", message: "却下しました。" });
}

function handleGetMyExternalLearningRequests(req) {
  const adminSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID'));
  const sheet = ensureExternalLearningRequestSheet_(adminSs);
  const { ok, map, message } = ensureExternalRequestHeaderMap_(sheet);
  if (!ok) return sendResponse({ status: "error", message });
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = data.length - 1; i >= 1 && list.length < 30; i--) {
    if (String(data[i][map["ユーザーID"] - 1]) === String(req.userId)) {
      list.push({
        rowIdx: i + 1,
        requestedAt: String(data[i][map["申請日時"] - 1] || ""),
        category: map["カテゴリ"] ? String(data[i][map["カテゴリ"] - 1] || "") : "",
        volume: map["分量"] ? String(data[i][map["分量"] - 1] || "") : "",
        points: Number(data[i][map["ポイント"] - 1]) || 0,
        status: String(data[i][map["状態"] - 1] || ""),
        childMemo: map["こどもメモ"] ? String(data[i][map["こどもメモ"] - 1] || "") : ""
      });
    }
  }
  return sendResponse({ status: "success", list: list });
}
function handleGetPointsMultiplier(req) { const data = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID')).getSheetByName("users").getDataRange().getValues(); let multiplier = 1.0; for (let i = 1; i < data.length; i++) { if (data[i][0] === req.userId) { const lastStudyTimeStr = JSON.parse(data[i][4] || "{}")[req.unitId]; if (lastStudyTimeStr) { const diffHours = (new Date() - new Date(lastStudyTimeStr)) / (1000 * 60 * 60); let basePercent = 10 + Math.floor(diffHours / 2) * 10; if (basePercent > 100) basePercent = 100; multiplier = basePercent / 100; } break; } } return sendResponse({ status: "success", multiplier: multiplier }); }
function handleGetChildUsers(req) { const data = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID')).getSheetByName("users").getDataRange().getValues(); const users = []; for (let i = 1; i < data.length; i++) { if (data[i][0] && i > 0) users.push({ id: data[i][0], name: data[i][1] }); } return sendResponse({ status: "success", users: users }); }
function handleVerifyKidPin(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureUsersSheetStopwatchColumn_(adminSs);
  const usersSheet = adminSs.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  const safeJsonObject_ = (raw) => {
    try {
      const v = JSON.parse(raw || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.userId)) {
      if (String(data[i][2]) === String(req.pin)) {
        const rowIdx = i + 1;
        const stopwatch = readStopwatchJson_(usersSheet, rowIdx);
        return sendResponse({
          status: "success",
          user: {
            id: data[i][0],
            name: data[i][1],
            points: data[i][3],
            lastStudyJson: safeJsonObject_(data[i][4]),
            historyJson: stripKanjiAndEnglishFromHistoryJson_(safeJsonObject_(data[i][5])),
            dailyPointsJson: safeJsonObject_(data[i][6]),
            stopwatchJson: stopwatch
          },
          message: "ログイン成功"
        });
      }
      return sendResponse({ status: "error", message: "PINがちがいます" });
    }
  }
  return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
}
function handleChangePin(req) { const usersSheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ADMIN_SS_ID')).getSheetByName("users"); const data = usersSheet.getDataRange().getValues(); for (let i = 1; i < data.length; i++) { if (data[i][0] === req.userId) { usersSheet.getRange(i + 1, 3).setValue(req.newPin); return sendResponse({ status: "success", message: "新しいPINをセットしました！" }); } } return sendResponse({ status: "error", message: "ユーザーが見つかりません" }); }
function handleGetMaterialsList(req) {
  return sendResponse({ status: "success", materials: getMaterialsList_() });
}

function getMaterialsList_() {
  const props = PropertiesService.getScriptProperties();
  const materials = [];
  const pushFolderFiles = (folderId, category) => {
    if (!folderId) return;
    let folder;
    try { folder = DriveApp.getFolderById(folderId); } catch (_) { return; }
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    while (files.hasNext()) {
      const file = files.next();
      materials.push({
        modeId: file.getId(),
        modeName: file.getName(),
        category: category,
        units: SpreadsheetApp.open(file).getSheets().map(function (s) { return s.getName(); })
      });
    }
  };
  pushFolderFiles(props.getProperty("MATERIALS_FOLDER_ID"), "english");
  pushFolderFiles(props.getProperty("KANJI_MATERIALS_FOLDER_ID"), "kanji");
  return materials;
}
function handleGetQuestions(req) { const data = SpreadsheetApp.openById(req.modeId).getSheetByName(req.unitName).getDataRange().getValues(); const headers = data[0]; const questions = []; for (let i = 1; i < data.length; i++) { let qObj = {}; for (let j = 0; j < headers.length; j++) qObj[headers[j]] = data[i][j]; if (qObj["通し番号"]) questions.push(qObj); } return sendResponse({ status: "success", questions: questions }); }
function handleGetRewards(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureRewardsSheetStructure_(adminSs);
  const data = adminSs.getSheetByName("rewards").getDataRange().getValues();
  const rewards = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const limitMinutes = Number(data[i][4]);
    rewards.push({
      id: data[i][0],
      name: data[i][1],
      points: Number(data[i][2]),
      desc: data[i][3],
      limitMinutes: isNaN(limitMinutes) || limitMinutes <= 0 ? 0 : Math.floor(limitMinutes)
    });
  }
  return sendResponse({ status: "success", rewards: rewards });
}

function handleExchangeReward(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureInventorySheetStructure_(adminSs);
  ensureRewardsSheetStructure_(adminSs);
  const usersSheet = adminSs.getSheetByName("users");
  const usersData = usersSheet.getDataRange().getValues();
  let userRow = -1;
  let currentPoints = 0;
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][0] === req.userId) {
      userRow = i + 1;
      currentPoints = Number(usersData[i][3]) || 0;
      break;
    }
  }
  if (userRow === -1) return sendResponse({ status: "error", message: "ユーザーが見つかりません" });
  const rewardData = getRewardInfoById_(adminSs, req.rewardId);
  if (!rewardData) return sendResponse({ status: "error", message: "景品が見つかりません" });
  if (currentPoints < rewardData.points) return sendResponse({ status: "error", message: "ポイントが足りません" });
  const newPoints = Math.round((currentPoints - rewardData.points) * 100) / 100;
  usersSheet.getRange(userRow, 4).setValue(newPoints);
  adminSs.getSheetByName("inventory").appendRow([
    formatJstDateTime_(new Date()),
    req.userId,
    req.rewardId,
    rewardData.name,
    "未消化",
    "",
    ""
  ]);
  return sendResponse({ status: "success", newPoints: newPoints, message: rewardData.name + " をゲットしました！" });
}

function handleGetInventory(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureInventorySheetStructure_(adminSs);
  ensureRewardsSheetStructure_(adminSs);
  const limitMap = buildRewardLimitMinutesMap_(adminSs);
  const data = adminSs.getSheetByName("inventory").getDataRange().getValues();
  const inventory = [];
  const uid = String(req.userId || "");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== uid) continue;
    const rewardId = String(data[i][2] || "");
    inventory.push({
      rowIdx: i + 1,
      date: data[i][0],
      rewardId: rewardId,
      rewardName: data[i][3],
      status: data[i][4],
      usedAt: data[i][5] || "",
      limitMinutes: getRewardLimitMinutesById_(adminSs, rewardId, limitMap)
    });
  }
  inventory.sort(function (a, b) { return b.rowIdx - a.rowIdx; });
  return sendResponse({ status: "success", inventory: inventory });
}

function handleConsumeReward(req) {
  const adminSs = getAdminSpreadsheet_();
  ensureInventorySheetStructure_(adminSs);
  ensureRewardsSheetStructure_(adminSs);
  const inventorySheet = adminSs.getSheetByName("inventory");
  const rowIdx = parseInt(req.rowIdx, 10);
  if (isNaN(rowIdx) || rowIdx < 2 || rowIdx > inventorySheet.getLastRow()) {
    return sendResponse({ status: "error", message: "無効な行です" });
  }
  const row = inventorySheet.getRange(rowIdx, 1, 1, 7).getValues()[0];
  if (String(row[1]) !== String(req.userId)) {
    return sendResponse({ status: "error", message: "この景品はあなたのものではありません" });
  }
  if (String(row[4]) === "使用済み") {
    return sendResponse({ status: "error", message: "すでに使用済みです" });
  }
  const rewardId = String(row[2] || "");
  const rewardName = String(row[3] || "");
  const limitMinutes = getRewardLimitMinutesById_(adminSs, rewardId);
  const usedAt = new Date();
  const usedAtText = formatJstDateTime_(usedAt);
  inventorySheet.getRange(rowIdx, 5).setValue("使用済み");
  inventorySheet.getRange(rowIdx, 6).setValue(usedAtText);
  inventorySheet.getRange(rowIdx, 7).setValue(limitMinutes > 0 ? "未送信" : "");

  let activeTicket = null;
  if (limitMinutes > 0) {
    const usersSheet = adminSs.getSheetByName("users");
    const userName = findUserName_(usersSheet, req.userId);
    const endsAt = computeRewardEndsAt_(usedAt, limitMinutes);
    const notifyAt = computeRewardNotifyAt_(usedAt, limitMinutes);
    try { sendRewardStartEmail_(adminSs, userName, rewardName, limitMinutes, endsAt); } catch (e) { console.warn("start email failed", e); }
    if (notifyAt) scheduleRewardEndNotificationTrigger_(rowIdx, notifyAt);
    activeTicket = {
      rowIdx: rowIdx,
      rewardId: rewardId,
      rewardName: rewardName,
      usedAt: usedAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : "",
      limitMinutes: limitMinutes,
      remainingMs: endsAt ? Math.max(0, endsAt.getTime() - Date.now()) : 0
    };
  }

  return sendResponse({
    status: "success",
    message: "景品をつかいました！",
    activeTicket: activeTicket
  });
}

// ★設定を消去する緊急用関数（不要なら後で消してもOK）
function resetProperties() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  console.log("古い設定をすべて消去しました！");
}

function handleGetKanjiInitData(req) {
  const prop = PropertiesService.getScriptProperties();
  const sheetId = prop.getProperty('KANJI_SHEET_ID');
  let targetSheetId = sheetId;
  if (!targetSheetId) {
    const folderId = prop.getProperty('KANJI_MATERIALS_FOLDER_ID');
    if (folderId) {
      try {
        const files = DriveApp.getFolderById(folderId).getFilesByType(MimeType.GOOGLE_SHEETS);
        if (files.hasNext()) targetSheetId = files.next().getId();
      } catch (_) {}
    }
  }
  if (!targetSheetId) return sendResponse({ status: "error", message: "漢字教材が未設定です（KANJI_SHEET_ID または 教材フォルダを確認）" });
  try {
    const ss = SpreadsheetApp.openById(targetSheetId);
    const sheets = ss.getSheets().map(s => s.getName());
    return sendResponse({ status: "success", bookName: ss.getName(), sheets: sheets });
  } catch (e) {
    return sendResponse({ status: "error", message: "漢字データにアクセスできません: " + e.message });
  }
}

function handleGetKanjiDataFromSheet(req) {
  const sheetName = String(req.sheetName || "");
  if (!sheetName) return sendResponse({ status: "error", message: "sheetName が未指定です" });
  const prop = PropertiesService.getScriptProperties();
  const sheetId = prop.getProperty('KANJI_SHEET_ID');
  let targetSheetId = sheetId;
  if (!targetSheetId) {
    const folderId = prop.getProperty('KANJI_MATERIALS_FOLDER_ID');
    if (folderId) {
      try {
        const files = DriveApp.getFolderById(folderId).getFilesByType(MimeType.GOOGLE_SHEETS);
        if (files.hasNext()) targetSheetId = files.next().getId();
      } catch (_) {}
    }
  }
  if (!targetSheetId) return sendResponse({ status: "error", message: "漢字教材が未設定です（KANJI_SHEET_ID または 教材フォルダを確認）" });
  try {
    const ss = SpreadsheetApp.openById(targetSheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return sendResponse({ status: "success", data: {} });
    const values = sheet.getDataRange().getValues();
    const kanjiMap = {};
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const kanji = row[0];
      if (!kanji || String(kanji).trim().length !== 1) continue;
      const paths = [];
      for (let j = 2; j < row.length; j++) {
        const cellValue = row[j];
        if (!cellValue) continue;
        const strVal = String(cellValue).trim();
        if (!strVal) continue;
        if (strVal.indexOf('|') >= 0) {
          strVal.split('|').forEach(p => {
            const cleaned = String(p || "").trim();
            if (cleaned && (cleaned.charAt(0) === 'M' || cleaned.charAt(0) === 'm')) paths.push(cleaned);
          });
        } else if (strVal.charAt(0) === 'M' || strVal.charAt(0) === 'm') {
          paths.push(strVal);
        }
      }
      if (paths.length > 0) kanjiMap[String(kanji).trim()] = paths;
    }
    return sendResponse({ status: "success", data: kanjiMap });
  } catch (e) {
    return sendResponse({ status: "error", message: "漢字データ取得に失敗しました: " + e.message });
  }
}

function parseKanjiQuizSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return { groups: [] };
  const headers = values[0].map(v => String(v || "").trim());
  const cellText = (v) => {
    const s = String(v || "").trim();
    if (!s || s === "×" || s === "x" || s === "X") return "";
    return s;
  };
  const idxSet = headers.indexOf("セット");
  const idxKanji = headers.indexOf("漢字");
  if (idxSet < 0 || idxKanji < 0) {
    throw new Error("漢字クイズシートの見出しに「セット」「漢字」が必要です。");
  }

  const readingDefs = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const m = h.match(/^(訓読み|音読み)([A-ZＡ-Ｚ])_読み$/);
    if (!m) continue;
    const kind = m[1] === "訓読み" ? "訓" : "音";
    const label = m[2].toUpperCase();
    const exIdx = [];
    for (let j = 0; j < headers.length; j++) {
      const ex = headers[j];
      if (ex.indexOf(kind + label + "_例文") === 0) exIdx.push(j);
    }
    readingDefs.push({ label: kind + label, readingIdx: i, exampleIdx: exIdx });
  }
  if (readingDefs.length === 0) {
    throw new Error("見出しが新形式ではありません。訓読みA_読み / 音読みA_読み の列が必要です。");
  }

  const groupsMap = {};
  const order = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const setRaw = cellText(row[idxSet]);
    const kanji = cellText(row[idxKanji]);
    if (!setRaw || !kanji) continue;
    const setId = setRaw;
    if (!groupsMap[setId]) {
      groupsMap[setId] = { setId, items: [] };
      order.push(setId);
    }
    const readings = [];
    readingDefs.forEach(def => {
      const reading = cellText(row[def.readingIdx]);
      if (!reading) return;
      const examples = def.exampleIdx
        .map(i => cellText(row[i]))
        .filter(Boolean);
      const rk = def.label.indexOf("音") === 0 ? "on" : "kun";
      readings.push({ label: def.label, kind: rk, reading, examples });
    });
    groupsMap[setId].items.push({
      rowIndex: r + 1,
      kanji,
      readings
    });
  }
  const groups = order.map(setId => groupsMap[setId]).filter(g => g.items.length > 0);
  return { groups };
}

/**
 * 漢字クイズ3形式: 配列シャッフル（非破壊）
 */
function shuffleKanjiQuizArray_(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** ひらがな → カタカナ（音読み表示・正解用） */
function hiraganaToKatakanaKanjiQuiz_(s) {
  return Array.from(String(s || ""))
    .map(function (ch) {
      const c = ch.charCodeAt(0);
      if (c >= 0x3041 && c <= 0x3096) return String.fromCharCode(c + 0x60);
      return ch;
    })
    .join("");
}

/** 音=カタカナ・訓=シートのまま（ひらがな想定） */
function readingDisplayForQuiz_(reading, kind) {
  const r = String(reading || "");
  if (kind === "on") return hiraganaToKatakanaKanjiQuiz_(r);
  return r;
}

/** 正解読み（完全一致判定用）。音はカタカナ、訓は原文 */
function normalizedCorrectReadingAnswer_(reading, kind) {
  return readingDisplayForQuiz_(reading, kind);
}

/** 例文中で最初の kanji 列文字列をマスク（×等は素材に入らない前提） */
function maskKanjiInExampleOnce_(sentence, kanjiCol) {
  const s = String(sentence || "");
  const k = String(kanjiCol || "");
  if (!s || !k) return { ok: false, masked: s };
  const idx = s.indexOf(k);
  if (idx < 0) return { ok: false, masked: s };
  return { ok: true, masked: s.slice(0, idx) + "＿" + s.slice(idx + k.length) };
}

/**
 * 訓読みから格助詞「を」を取り除く（送り仮名選択肢に「を」が紛れ込むのを防ぐ）。
 *   - 末尾の「を」は安全に切り落とせる（「を」は訓読みの一部にならない）。
 *   - 末尾以外に「を」が混在している reading は破損データとみなし、空文字を返して呼び出し側に
 *     その reading を使わせない（ダミープール／本問のいずれにも採用させない）。
 *   - 「は／が／に／へ／で」は実際の訓読み末尾（例：「出る」の「で」等）に現れるため除去しない。
 */
function stripJoshiTailFromReading_(reading) {
  var s = String(reading || "");
  if (s.length > 1 && s.slice(-1) === "を") {
    s = s.slice(0, -1);
  }
  if (s.indexOf("を") >= 0) return "";
  return s;
}

/** 候補文字列に「を」が含まれていれば true（送り仮名候補としては不正）。 */
function okuriganaCandidateHasWo_(cand) {
  return String(cand || "").indexOf("を") >= 0;
}

/**
 * 例文中の「正解の表層形（漢字＋送り仮名）」を選択肢候補に置き換えた表示用文字列を返す。
 *   例: example="音がなる", kanji="音", surfaceCorrect="音", candidate="音と"
 *       → "音とがなる"
 *
 * 例文内に surfaceCorrect が無い場合は、漢字単独で無理に置換すると例えば
 *   example="上を見る", kanji="上", surfaceCorrect="上がる", candidate="上と"
 * のとき "上とを見る" のような不自然な文を生むため、置換せず候補そのもの（cand）を返す。
 * 呼び出し側（buildOkuriganaShiftQuizQuestion_）は surfaceCorrect を含む例文だけを採用するため
 * 通常はこのフォールバックには到達しないが、汚染データに対する防御として残している。
 */
function renderOkuriganaChoiceInExample_(example, kanji, surfaceCorrect, candidate) {
  var ex = String(example || "");
  var cand = String(candidate || "");
  if (!ex) return cand;
  var k = String(kanji || "");
  var surf = String(surfaceCorrect || k || "");
  if (surf && ex.indexOf(surf) >= 0) {
    var p = ex.indexOf(surf);
    return ex.slice(0, p) + cand + ex.slice(p + surf.length);
  }
  if (k && (!surf || surf.length === k.length) && ex.indexOf(k) >= 0) {
    var p2 = ex.indexOf(k);
    return ex.slice(0, p2) + cand + ex.slice(p2 + k.length);
  }
  return cand;
}

/**
 * 例文中のターゲット語をよみがなに置き換え（訓読み提示用）。
 *
 * 想定する surfaceForm の取り扱い：
 *   - surfaceForm 未指定 or surfaceForm == kanji（送り仮名なしの読み）→ 漢字 1 文字を reading に置換
 *   - surfaceForm が漢字＋送り仮名の場合 →
 *       (a) 例文中に surfaceForm そのものがあればその範囲を reading に置換（「持つ」→「もつ」）
 *       (b) 例文には漢字しかないが、続く文字が surfaceForm の送り仮名と一致 → 同上
 *       (c) いずれでもない（例文の漢字が別用法・別語幹で使われている） → 「""」を返す
 *
 * (c) を返すのは、例えば surfaceForm="上がる" で例文 "上を見る" のような場合。
 * 旧実装は漢字だけを reading に差し替えて "あがるを見る" のような壊れた文を出していた。
 * このようなケースは呼び出し側でフォールバック（原文表示や別例文採用）に任せる。
 */
function replaceKanjiWithReadingInExample_(sentence, kanjiCol, readingText, surfaceForm) {
  const s = String(sentence || "");
  const k = String(kanjiCol || "");
  const rd = String(readingText || "");
  const surf = surfaceForm != null ? String(surfaceForm) : "";
  if (!s || !k || !rd) return "";
  if (surf && surf.length > k.length && s.indexOf(surf) >= 0) {
    const p = s.indexOf(surf);
    return s.slice(0, p) + rd + s.slice(p + surf.length);
  }
  const idx = s.indexOf(k);
  if (idx < 0) return "";
  if (!surf || surf.length === k.length) {
    return s.slice(0, idx) + rd + s.slice(idx + k.length);
  }
  if (surf.indexOf(k) === 0) {
    var okuri = surf.slice(k.length);
    if (okuri && s.slice(idx + k.length).startsWith(okuri)) {
      return s.slice(0, idx) + rd + s.slice(idx + k.length + okuri.length);
    }
  }
  return "";
}

/**
 * 送り仮名ダミー候補プール（漢字ごと）。
 * 問題の漢字と同じ漢字からのみダミーを出し、他漢字の混入を防ぐ。
 */
function collectOkuriganaDummyPoolByKanjiKanjiQuiz_(items) {
  const poolMap = {};
  if (!items || !items.length) return poolMap;
  items.forEach(function (item) {
    const k = String(item.kanji || "");
    if (k.length !== 1) return;
    if (!poolMap[k]) poolMap[k] = [];
    const readings = Array.isArray(item.readings) ? item.readings : [];
    readings.forEach(function (r) {
      if (r.kind !== "kun") return;
      const reading = stripJoshiTailFromReading_(String(r.reading || ""));
      if (reading.length < 2) return;
      if (okuriganaCandidateHasWo_(reading)) return;
      let bestSplitPos = 1;
      for (let s = 1; s <= reading.length; s++) {
        const cand = k + reading.substring(s);
        if (Array.isArray(r.examples) && r.examples.some(function(ex) { return String(ex).indexOf(cand) >= 0; })) {
          bestSplitPos = s;
          break;
        }
      }
      const correct = k + reading.substring(bestSplitPos);
      if (okuriganaCandidateHasWo_(correct)) return;
      for (let splitPos = 1; splitPos <= reading.length; splitPos++) {
        const cand = k + reading.substring(splitPos);
        if (cand !== correct && !okuriganaCandidateHasWo_(cand)) poolMap[k].push(cand);
      }
    });
  });
  return poolMap;
}

function buildOkuriganaShiftQuizQuestion_(item, dummyPoolByKanji) {
  const k = String(item.kanji || "");
  if (k.length !== 1) return null;
  const readings = (Array.isArray(item.readings) ? item.readings : []).filter(function (r) {
    var rd = stripJoshiTailFromReading_(String(r.reading || ""));
    return r.kind === "kun" && rd.length >= 2 && !okuriganaCandidateHasWo_(rd);
  });
  if (!readings.length) return null;
  const r = readings[Math.floor(Math.random() * readings.length)];
  const reading = stripJoshiTailFromReading_(String(r.reading || ""));
  let bestSplitPos = 1;
  for (let s = 1; s <= reading.length; s++) {
    const cand = k + reading.substring(s);
    if (Array.isArray(r.examples) && r.examples.some(function(ex) { return String(ex).indexOf(cand) >= 0; })) {
      bestSplitPos = s;
      break;
    }
  }
  const correct = k + reading.substring(bestSplitPos);
  if (okuriganaCandidateHasWo_(correct)) return null;
  const wrongSet = {};
  const sameKanjiPool = (dummyPoolByKanji && dummyPoolByKanji[k]) || [];
  sameKanjiPool.forEach(function (d) {
    if (d && d !== correct && !okuriganaCandidateHasWo_(d)) wrongSet[d] = true;
  });
  for (let splitPos = 1; splitPos <= reading.length; splitPos++) {
    const cand = k + reading.substring(splitPos);
    if (cand !== correct && !okuriganaCandidateHasWo_(cand)) wrongSet[cand] = true;
  }
  const wrongList = shuffleKanjiQuizArray_(Object.keys(wrongSet));
  const picks = wrongList.slice(0, 3);
  const choices = shuffleKanjiQuizArray_([correct].concat(picks));
  const uniq = [];
  const seen = {};
  choices.forEach(function (c) {
    if (c && !seen[c]) {
      seen[c] = true;
      uniq.push(c);
    }
  });
  if (uniq.length < 2) return null;
  const examples = Array.isArray(r.examples) ? r.examples : [];
  /**
   * 例文選定：
   * 1) 正解の表層形（correct）を含む例文を最優先
   * 2) 無ければ漢字を含む例文へフォールバック（学習画面で例文を必ず見せる）
   * 読み置換に失敗しても漢字入り例文はそのまま残す（旧実装はここで空にして消していた）。
   */
  var contextExample = "";
  for (var ei = 0; ei < examples.length; ei++) {
    var exTry = String(examples[ei] || "");
    if (exTry.indexOf(correct) >= 0) {
      contextExample = exTry;
      break;
    }
  }
  if (!contextExample) {
    for (var ej = 0; ej < examples.length; ej++) {
      var ex2 = String(examples[ej] || "");
      if (ex2.indexOf(k) >= 0) {
        contextExample = ex2;
        break;
      }
    }
  }
  var contextSentenceReading = contextExample
    ? replaceKanjiWithReadingInExample_(contextExample, k, reading, correct)
    : "";
  // 置換できなくても例文表示用に原文を使う
  if (!contextSentenceReading && contextExample) {
    contextSentenceReading = contextExample;
  }
  var choicesDisplayMap = {};
  if (contextExample) {
    uniq.forEach(function (c) {
      choicesDisplayMap[c] = renderOkuriganaChoiceInExample_(contextExample, k, correct, c);
    });
  }
  const searchParts = [k, reading, r.label, contextSentenceReading, contextExample].concat(uniq).join(" ");
  return {
    type: "okurigana_shift",
    kanji: k,
    rowIndex: item.rowIndex,
    readingLabel: r.label,
    readingKind: "kun",
    readingHint: reading,
    exampleSentenceRaw: contextExample,
    contextSentenceReading: contextSentenceReading,
    choicesDisplayMap: choicesDisplayMap,
    prompt: "正しい送り仮名を選びましょう。",
    choices: uniq,
    correctAnswer: correct,
    searchText: searchParts
  };
}

function buildRubyToKanjiQuizQuestion_(item) {
  const k = String(item.kanji || "");
  if (!k) return null;
  const pairs = [];
  (Array.isArray(item.readings) ? item.readings : []).forEach(function (r) {
    const examples = Array.isArray(r.examples) ? r.examples : [];
    examples.forEach(function (ex) {
      const exs = String(ex || "");
      if (exs.indexOf(k) >= 0) pairs.push({ r: r, ex: exs });
    });
  });
  if (!pairs.length) return null;
  const pick = pairs[Math.floor(Math.random() * pairs.length)];
  const masked = maskKanjiInExampleOnce_(pick.ex, k);
  if (!masked.ok) return null;
  const readingDisp = readingDisplayForQuiz_(pick.r.reading, pick.r.kind);
  const searchParts = [k, readingDisp, pick.r.label, masked.masked, pick.ex].join(" ");
  return {
    type: "ruby_to_kanji",
    kanji: k,
    rowIndex: item.rowIndex,
    readingKind: pick.r.kind,
    readingLabel: pick.r.label,
    readingDisplay: readingDisp,
    maskedSentence: masked.masked,
    prompt: "読みと例文の空欄の漢字を、筆順どおりに手書きしましょう（各字とも60点以上）。",
    correctAnswer: k,
    searchText: searchParts
  };
}

function buildSentenceToRubyQuizQuestion_(item) {
  const k = String(item.kanji || "");
  if (!k) return null;
  const pairs = [];
  (Array.isArray(item.readings) ? item.readings : []).forEach(function (r) {
    const examples = Array.isArray(r.examples) ? r.examples : [];
    examples.forEach(function (ex) {
      const exs = String(ex || "");
      if (exs.indexOf(k) >= 0) pairs.push({ r: r, ex: exs });
    });
  });
  if (!pairs.length) return null;
  const pick = pairs[Math.floor(Math.random() * pairs.length)];
  const masked = maskKanjiInExampleOnce_(pick.ex, k);
  if (!masked.ok) return null;
  const ans = normalizedCorrectReadingAnswer_(pick.r.reading, pick.r.kind);
  var hintOn = pick.r.kind === "on" ? "（音読みはカタカナ）" : "（訓読みはひらがな）";
  const searchParts = [k, ans, pick.r.label, masked.masked, pick.ex].join(" ");
  return {
    type: "sentence_to_ruby",
    kanji: k,
    rowIndex: item.rowIndex,
    readingKind: pick.r.kind,
    readingLabel: pick.r.label,
    /** 設問表示は原文＋赤字強調（フロント）。互換のため伏字も残す */
    fullExample: pick.ex,
    sentence: masked.masked,
    prompt: "赤字のかんじの よみを 入力しましょう。" + hintOn,
    correctAnswer: ans,
    searchText: searchParts
  };
}

/**
 * 3タイプを偏りなく混在（各バケットをシャッフル後ラウンドロビン）
 */
function mergeKanjiQuizBucketsBalanced_(buckets) {
  const order = ["okurigana_shift", "ruby_to_kanji", "sentence_to_ruby", "stroke_order_trace"];
  const queues = order.map(function (key) {
    return shuffleKanjiQuizArray_(buckets[key] || []).slice();
  });
  const out = [];
  var keepGoing = true;
  while (keepGoing) {
    keepGoing = false;
    queues.forEach(function (q) {
      if (q.length) {
        out.push(q.shift());
        keepGoing = true;
      }
    });
  }
  return out;
}

var JUKUGO_NONE_ANSWER_ = "__NONE__";
var JUKUGO_NONE_LABEL_ = "この中に回答はない";

function detectKanjiSheetKindFromHeaders_(headers) {
  const h = (headers || []).map(function (v) { return String(v || "").trim(); });
  if (h.indexOf("ターゲット漢字") >= 0) return "jukugo";
  if (h.some(function (x) { return /^漢字熟語[A-CＡ-Ｃ]$/.test(x); })) return "jukugo";
  if (h.indexOf("A読み") >= 0 && h.indexOf("セット") >= 0 && h.indexOf("漢字") < 0) return "jukugo";
  return "standard";
}

function detectKanjiSheetKind_(headers, spreadsheetName) {
  const fromHeaders = detectKanjiSheetKindFromHeaders_(headers);
  if (fromHeaders === "jukugo") return "jukugo";
  if (isKanjiJukugoBookFileName_(spreadsheetName)) return "jukugo";
  return "standard";
}

function jukugoCellText_(v) {
  const s = String(v || "").trim();
  if (!s || s === "×" || s === "x" || s === "X") return "";
  return s;
}

function normalizeJukugoReading_(s) {
  return String(s || "").trim().replace(/\s+/g, "");
}

function splitJukugoReadings_(s) {
  return String(s || "").split(/[,，、]/).map(normalizeJukugoReading_).filter(Boolean);
}

function parseKanjiJukugoSheetFromValues_(values) {
  if (!values || values.length < 2) return { groups: [], sheetKind: "jukugo" };
  const headers = values[0].map(function (v) { return String(v || "").trim(); });
  const idxSet = headers.indexOf("セット");
  const idxTarget = headers.indexOf("ターゲット漢字");
  if (idxSet < 0 || idxTarget < 0) {
    throw new Error("漢字熟語シートの見出しに「セット」「ターゲット漢字」が必要です。");
  }
  const slotDefs = [
    { word: "漢字熟語A", reading: "A読み", category: "A区分", example: "A例文" },
    { word: "漢字熟語B", reading: "B読み", category: "B区分", example: "B例文" },
    { word: "漢字熟語C", reading: "C読み", category: "C区分", example: "C例文" }
  ].map(function (def) {
    return {
      wordIdx: headers.indexOf(def.word),
      readingIdx: headers.indexOf(def.reading),
      categoryIdx: headers.indexOf(def.category),
      exampleIdx: headers.indexOf(def.example)
    };
  });
  const groupsMap = {};
  const order = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const setRaw = jukugoCellText_(row[idxSet]);
    const targetKanji = jukugoCellText_(row[idxTarget]);
    if (!setRaw || !targetKanji) continue;
    const setId = setRaw;
    if (!groupsMap[setId]) {
      groupsMap[setId] = { setId: setId, targetKanji: targetKanji, entries: [] };
      order.push(setId);
    }
    slotDefs.forEach(function (slot, slotIndex) {
      if (slot.wordIdx < 0 || slot.readingIdx < 0) return;
      const word = jukugoCellText_(row[slot.wordIdx]);
      const reading = jukugoCellText_(row[slot.readingIdx]);
      const category = slot.categoryIdx >= 0 ? jukugoCellText_(row[slot.categoryIdx]) : "";
      const example = slot.exampleIdx >= 0 ? jukugoCellText_(row[slot.exampleIdx]) : "";
      if (!word || !reading || !example) return;
      groupsMap[setId].entries.push({
        rowIndex: r + 1,
        slot: String.fromCharCode(65 + slotIndex),
        targetKanji: targetKanji,
        word: word,
        reading: reading,
        category: category || "未分類",
        example: example
      });
      // セット内のターゲット漢字一覧用（先頭行だけだと欠ける）
      if (!groupsMap[setId].targetKanjiList) groupsMap[setId].targetKanjiList = [];
      if (groupsMap[setId].targetKanjiList.indexOf(targetKanji) < 0) {
        groupsMap[setId].targetKanjiList.push(targetKanji);
      }
    });
  }
  const groups = order.map(function (setId) {
    return groupsMap[setId];
  }).filter(function (g) { return g.entries.length > 0; });
  return { groups: groups, sheetKind: "jukugo" };
}

function parseKanjiJukugoSheet_(sheet) {
  return parseKanjiJukugoSheetFromValues_(sheet.getDataRange().getValues());
}

function collectJukugoReadingPool_(entries) {
  const pool = [];
  (entries || []).forEach(function (entry) {
    splitJukugoReadings_(entry.reading).forEach(function (r) {
      pool.push({ reading: r, category: entry.category || "", targetKanji: entry.targetKanji });
    });
  });
  return pool;
}

function pickJukugoDummyReadings_(pool, correctReadings, category, count) {
  const exclude = {};
  (correctReadings || []).forEach(function (r) { exclude[r] = true; });
  const sameCat = [];
  const otherCat = [];
  (pool || []).forEach(function (p) {
    const r = normalizeJukugoReading_(p.reading);
    if (!r || exclude[r]) return;
    if (p.category === category) sameCat.push(r);
    else otherCat.push(r);
  });
  const uniq = function (arr) {
    const seen = {};
    const out = [];
    arr.forEach(function (r) {
      if (seen[r]) return;
      seen[r] = true;
      out.push(r);
    });
    return out;
  };
  let candidates = uniq(sameCat);
  if (candidates.length < count) {
    candidates = candidates.concat(uniq(otherCat).filter(function (r) { return candidates.indexOf(r) < 0; }));
  }
  candidates = shuffleKanjiQuizArray_(candidates);
  return candidates.slice(0, count);
}

function buildJukugoYomiQuizQuestion_(entry, pool, opts) {
  if (!entry) return null;
  opts = opts || {};
  const choiceCount = Math.min(8, Math.max(3, parseInt(opts.choiceCount, 10) || 4));
  const includeNone = !!opts.includeNoneOption;
  const correctReadings = splitJukugoReadings_(entry.reading);
  const correctPrimary = correctReadings[0] || "";
  if (!correctPrimary) return null;
  const useNoneCorrect = includeNone && Math.random() < 0.30;
  let readingChoices = [];
  let correctAnswer = correctPrimary;
  if (useNoneCorrect) {
    readingChoices = pickJukugoDummyReadings_(pool, correctReadings, entry.category, choiceCount);
    correctAnswer = JUKUGO_NONE_ANSWER_;
  } else {
    const dummyCount = Math.max(0, choiceCount - 1);
    const dummies = pickJukugoDummyReadings_(pool, correctReadings, entry.category, dummyCount);
    readingChoices = [correctPrimary].concat(dummies);
    while (readingChoices.length < choiceCount) {
      const extra = pickJukugoDummyReadings_(pool, readingChoices.concat(correctReadings), entry.category, 1);
      if (!extra.length) break;
      readingChoices.push(extra[0]);
    }
    readingChoices = readingChoices.slice(0, choiceCount);
    correctAnswer = correctPrimary;
  }
  readingChoices = shuffleKanjiQuizArray_(readingChoices);
  const choices = readingChoices.slice();
  const choicesDisplay = readingChoices.slice();
  if (includeNone) {
    choices.push(JUKUGO_NONE_ANSWER_);
    choicesDisplay.push(JUKUGO_NONE_LABEL_);
  }
  return {
    type: "jukugo_yomi",
    kanji: entry.targetKanji,
    rowIndex: entry.rowIndex,
    slot: entry.slot || "",
    jukugoWord: entry.word,
    category: entry.category,
    exampleSentence: entry.example,
    prompt: "例文の下線の熟語の読み方を選びましょう。",
    choices: choices,
    choicesDisplay: choicesDisplay,
    correctAnswer: correctAnswer,
    correctReadings: correctReadings,
    includeNoneOption: includeNone,
    noneIsCorrect: useNoneCorrect,
    choiceCount: choiceCount,
    searchText: [entry.targetKanji, entry.word, correctPrimary, entry.example].join(" ")
  };
}

function buildStrokeOrderTraceQuizQuestion_(item) {
  const k = String(item.kanji || "");
  if (!k) return null;
  return {
    type: "stroke_order_trace",
    kanji: k,
    rowIndex: item.rowIndex,
    prompt: "漢字練習と同じ画面で書いて、60点以上をめざそう。",
    correctAnswer: k,
    searchText: k + " 書き順",
    readings: (item.readings || []).map(function (r) {
      return {
        label: r.label,
        kind: r.kind,
        reading: r.reading,
        examples: (r.examples || []).slice()
      };
    })
  };
}

function buildKanjiQuizProblemList_(group) {
  const items = group.items || [];
  if (!items.length) return [];
  const dummyPoolByKanji = collectOkuriganaDummyPoolByKanjiKanjiQuiz_(items);
  const buckets = { okurigana_shift: [], ruby_to_kanji: [], sentence_to_ruby: [], stroke_order_trace: [] };
  items.forEach(function (item) {
    const o = buildOkuriganaShiftQuizQuestion_(item, dummyPoolByKanji);
    if (o) buckets.okurigana_shift.push(o);
    const r2 = buildRubyToKanjiQuizQuestion_(item);
    if (r2) buckets.ruby_to_kanji.push(r2);
    const r3 = buildSentenceToRubyQuizQuestion_(item);
    if (r3) buckets.sentence_to_ruby.push(r3);
    const r4 = buildStrokeOrderTraceQuizQuestion_(item);
    if (r4) buckets.stroke_order_trace.push(r4);
  });
  const merged = shuffleKanjiQuizArray_(mergeKanjiQuizBucketsBalanced_(buckets));
  return merged.map(function (q, i) {
    const base = Object.assign({}, q);
    base.questionIndex = i;
    base.questionId =
      "KANJI_Q_" + String(group.setId) + "_" + q.rowIndex + "_" + q.type + "_" + i;
    return base;
  });
}

function buildStrokeOrderQuizProblemList_(group) {
  const items = group.items || [];
  if (!items.length) return [];
  const list = [];
  items.forEach(function (item) {
    const q = buildStrokeOrderTraceQuizQuestion_(item);
    if (q) list.push(q);
  });
  const shuffled = shuffleKanjiQuizArray_(list);
  return shuffled.map(function (q, i) {
    const base = Object.assign({}, q);
    base.questionIndex = i;
    base.questionId =
      "KANJI_Q_" + String(group.setId) + "_" + q.rowIndex + "_" + q.type + "_" + i;
    return base;
  });
}

function buildJukugoQuizProblemList_(group, opts) {
  const entries = group.entries || [];
  if (!entries.length) return [];
  // 同じ行の熟語ABCのうち、1回のセット取り組みではいずれか1つだけ出題する
  const byRow = {};
  const rowOrder = [];
  entries.forEach(function (entry) {
    const key = String(entry.rowIndex);
    if (!byRow[key]) {
      byRow[key] = [];
      rowOrder.push(key);
    }
    byRow[key].push(entry);
  });
  const pool = collectJukugoReadingPool_(entries);
  const list = [];
  rowOrder.forEach(function (key) {
    const candidates = byRow[key];
    if (!candidates || !candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const q = buildJukugoYomiQuizQuestion_(pick, pool, opts);
    if (q) list.push(q);
  });
  const shuffled = shuffleKanjiQuizArray_(list);
  return shuffled.map(function (q, i) {
    const base = Object.assign({}, q);
    base.questionIndex = i;
    base.questionId =
      "JUKUGO_Q_" + String(group.setId) + "_" + q.rowIndex + "_" + (q.slot || "") + "_" + q.type + "_" + i;
    return base;
  });
}

/** 同一シートの解析結果を短時間キャッシュし、get_kanji_quiz_sets → get_kanji_quiz_questions の連続で Spreadsheet 再読みを避ける */
function kanjiQuizSheetParsedCacheKey_(modeId, unitName) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    String(modeId) + "\x1f" + String(unitName),
    Utilities.Charset.UTF_8
  );
  return "kq_sh_" + Utilities.base64EncodeWebSafe(digest).slice(0, 36);
}

/** CacheService は1キー約100KB。熟語シートは例文込みで超えやすいのでセット単位に分割する */
var KANJI_QUIZ_PARSED_CACHE_TTL_SEC_ = 300;
var KANJI_QUIZ_PARSED_CACHE_SOFT_MAX_CHARS_ = 90000;

function readKanjiQuizParsedCache_(cache, key) {
  const hit = cache.get(key);
  if (!hit) return null;
  try {
    const meta = JSON.parse(hit);
    if (!meta || typeof meta !== "object") return null;
    if (!meta.chunked) {
      if (!meta.groups) return null;
      return { parsed: meta, sheetMissing: false };
    }
    const n = parseInt(meta.groupCount, 10) || 0;
    if (n <= 0) return { parsed: { groups: [], sheetKind: meta.sheetKind || "jukugo" }, sheetMissing: false };
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + "_g" + i);
    const bag = cache.getAll(keys);
    const groups = [];
    for (let i = 0; i < n; i++) {
      const raw = bag[key + "_g" + i];
      if (!raw) return null; // 欠けている場合は再解析
      groups.push(JSON.parse(raw));
    }
    return {
      parsed: { groups: groups, sheetKind: meta.sheetKind || "jukugo" },
      sheetMissing: false
    };
  } catch (e) {
    return null;
  }
}

function writeKanjiQuizParsedCache_(cache, key, parsed) {
  try {
    const json = JSON.stringify(parsed);
    if (json.length <= KANJI_QUIZ_PARSED_CACHE_SOFT_MAX_CHARS_) {
      cache.put(key, json, KANJI_QUIZ_PARSED_CACHE_TTL_SEC_);
      return;
    }
    const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
    const meta = {
      chunked: true,
      sheetKind: parsed.sheetKind || "standard",
      groupCount: groups.length
    };
    cache.put(key, JSON.stringify(meta), KANJI_QUIZ_PARSED_CACHE_TTL_SEC_);
    // putAll は最大100件。セット数がそれを超える場合は分割投入する
    const CHUNK = 90;
    for (let offset = 0; offset < groups.length; offset += CHUNK) {
      const batch = {};
      const end = Math.min(groups.length, offset + CHUNK);
      for (let i = offset; i < end; i++) {
        batch[key + "_g" + i] = JSON.stringify(groups[i]);
      }
      cache.putAll(batch, KANJI_QUIZ_PARSED_CACHE_TTL_SEC_);
    }
  } catch (e) {
    // それでも載せられない場合は無視（次回も再解析）。Lock で同時再解析は抑止される。
  }
}

/**
 * 取得パスでは見出しが揃っているとき追加読み書きしない。
 * ファイル名から熟語と判定したが必須列が欠けるときだけ見出しを直す（サンプル行追加はしない）。
 */
function maybeRepairJukugoHeadersOnGet_(sheet, headers) {
  const head = (headers || []).map(function (v) { return String(v || "").trim(); });
  if (head.indexOf("セット") >= 0 && head.indexOf("ターゲット漢字") >= 0) {
    return { repaired: false, values: null };
  }
  const header = getKanjiJukugoSheetHeaderRow_();
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  return { repaired: true, values: sheet.getDataRange().getValues() };
}

function getKanjiQuizParsedFromSpreadsheet_(modeId, unitName) {
  const cache = CacheService.getScriptCache();
  const key = kanjiQuizSheetParsedCacheKey_(modeId, unitName);
  const cached0 = readKanjiQuizParsedCache_(cache, key);
  if (cached0) return cached0;

  // セット一覧→問題取得や先読みが重なると同一シートを同時再解析しやすい。
  // ScriptLock で直列化し、キャッシュスタンプを防ぐ。
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    locked = lock.tryLock(28000);
  } catch (eLock) {
    locked = false;
  }
  if (!locked) {
    // 他実行が解析中の可能性。少し待ってキャッシュ再試行してから、必要ならロックなしで続行。
    Utilities.sleep(900);
    const cachedWait = readKanjiQuizParsedCache_(cache, key);
    if (cachedWait) return cachedWait;
  }
  try {
    const cached1 = readKanjiQuizParsedCache_(cache, key);
    if (cached1) return cached1;

    const ss = SpreadsheetApp.openById(modeId);
    const sheet = ss.getSheetByName(unitName);
    if (!sheet) return { parsed: null, sheetMissing: true };
    // 熟語シートでも getDataRange は原則1回だけ（ensure の三重読みをやめる）
    let values = sheet.getDataRange().getValues();
    let headers = values[0] || [];
    let sheetKind = detectKanjiSheetKind_(headers, ss.getName());
    if (sheetKind === "jukugo") {
      const fix = maybeRepairJukugoHeadersOnGet_(sheet, headers);
      if (fix.repaired && fix.values) {
        values = fix.values;
        headers = values[0] || [];
        sheetKind = detectKanjiSheetKind_(headers, ss.getName());
      }
    }
    const parsed = sheetKind === "jukugo"
      ? parseKanjiJukugoSheetFromValues_(values)
      : parseKanjiQuizSheet_(sheet);
    parsed.sheetKind = sheetKind;
    writeKanjiQuizParsedCache_(cache, key, parsed);
    return { parsed: parsed, sheetMissing: false };
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (eRel) {}
    }
  }
}

function handleGetKanjiQuizSets(req) {
  const modeId = String(req.modeId || "").trim();
  const unitName = String(req.unitName || "").trim();
  if (!modeId || !unitName) return sendResponse({ status: "error", message: "modeId と unitName が必要です。" });
  try {
    const got = getKanjiQuizParsedFromSpreadsheet_(modeId, unitName);
    if (got.sheetMissing) return sendResponse({ status: "error", message: "指定シートが見つかりません。" });
    const parsed = got.parsed;
    const sheetKind = parsed.sheetKind || "standard";
    const sets = parsed.groups.map(function (g) {
      if (sheetKind === "jukugo") {
        const rowSeen = {};
        let rowCount = 0;
        (g.entries || []).forEach(function (e) {
          const rk = String(e.rowIndex);
          if (rowSeen[rk]) return;
          rowSeen[rk] = true;
          rowCount++;
        });
        const kanjiList = Array.isArray(g.targetKanjiList) && g.targetKanjiList.length
          ? g.targetKanjiList.slice()
          : [g.targetKanji].filter(Boolean);
        return { setId: g.setId, count: rowCount, kanjiList: kanjiList };
      }
      return { setId: g.setId, count: g.items.length, kanjiList: g.items.map(function (it) { return it.kanji; }) };
    });
    return sendResponse({ status: "success", sets: sets, sheetKind: sheetKind });
  } catch (e) {
    return sendResponse({ status: "error", message: "漢字セット取得に失敗しました: " + e.message });
  }
}

function handleGetKanjiQuizQuestions(req) {
  const modeId = String(req.modeId || "").trim();
  const unitName = String(req.unitName || "").trim();
  const setId = String(req.setId || "").trim();
  if (!modeId || !unitName || !setId) return sendResponse({ status: "error", message: "modeId / unitName / setId が必要です。" });
  try {
    const got = getKanjiQuizParsedFromSpreadsheet_(modeId, unitName);
    if (got.sheetMissing) return sendResponse({ status: "error", message: "指定シートが見つかりません。" });
    const parsed = got.parsed;
    const sheetKind = parsed.sheetKind || "standard";
    const group = parsed.groups.find(function (g) { return String(g.setId) === setId; });
    if (!group) return sendResponse({ status: "error", message: "指定セットが見つかりません。" });
    let questions;
    if (sheetKind === "jukugo") {
      questions = buildJukugoQuizProblemList_(group, {
        choiceCount: req.choiceCount,
        includeNoneOption: !!req.includeNoneOption
      });
    } else if (String(req.formatMode || "") === "stroke_order") {
      questions = buildStrokeOrderQuizProblemList_(group);
    } else {
      questions = buildKanjiQuizProblemList_(group);
    }
    return sendResponse({
      status: "success",
      setId: setId,
      sheetKind: sheetKind,
      questions: questions
    });
  } catch (e) {
    return sendResponse({ status: "error", message: "漢字問題取得に失敗しました: " + e.message });
  }
}