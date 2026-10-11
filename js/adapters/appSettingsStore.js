/**
 * js/adapters/appSettingsStore.js
 * アプリ設定・特訓ルート・外部学習メニューの Firestore 完結管理ストア
 * （GASへの依存を完全排除し、アプリ内部・Firestoreで全設定を高速完結）
 */
(function (global) {
  'use strict';

  var cachedSettings = null;

  // 既定のアプリ設定（基本ポイント等）
  var DEFAULT_SETTINGS = {
    "基本Pt_ja_to_en_4choice": 3,
    "基本Pt_ja_to_en_typing": 20,
    "基本Pt_ja_to_en_voice": 20,
    "基本Pt_ja_to_en_fill_4choice": 5,
    "基本Pt_ja_to_en_fill_typing": 5,
    "基本Pt_en_to_ja_4choice": 2,
    "基本Pt_en_to_ja_typing": 20,
    "基本Pt_en_to_ja_voice": 20,
    "基本Pt_en_audio_to_ja_4choice": 2,
    "基本Pt_en_audio_to_ja_typing": 20,
    "基本Pt_en_audio_to_ja_voice": 20,
    "基本Pt_en_audio_to_en_4choice": 3,
    "基本Pt_en_audio_to_en_typing": 20,
    "基本Pt_en_audio_to_en_voice": 20,
    "基本Pt_en_audio_to_en_fill_4choice": 5,
    "基本Pt_en_audio_to_en_fill_typing": 5,
    "基本Pt_en_to_en_typing": 20,
    "基本Pt_en_to_en_voice": 20,
    "基本Pt_en_to_en_initial_typing": 20,
    "基本Pt_en_to_en_sheet_fill_typing": 20,
    "基本Pt_en_to_en_initial_voice": 20,
    "基本Pt_en_to_en_sheet_fill_voice": 20,
    "基本Pt_en_to_en_flash_typing": 20,
    "基本Pt_en_to_en_flash_voice": 20,
    "基本Pt_qtext_to_en_4choice": 3,
    "基本Pt_qtext_to_en_typing": 30,
    "基本Pt_qtext_to_en_voice": 30,
    "基本Pt_qaudio_to_en_typing": 30,
    "基本Pt_qaudio_to_en_voice": 30,
    "基本Pt_ja_to_en_sort_sort_all": 25,
    "基本Pt_ja_to_en_sort_sort_dummy": 28,
    "基本Pt_ja_to_en_sort_sort_missing": 30,
    "漢字基本Pt_採点_90以上": 10,
    "漢字基本Pt_採点_80以上": 5,
    "漢字基本Pt_採点_70以上": 4,
    "漢字基本Pt_採点_60以上": 3,
    "漢字基本Pt_採点_50以上": 1,
    "漢字採点_高得点回数上限_週": 3,
    "漢字採点_回数上限後倍率": 0.1,
    "漢字採点_回復率_日": 0.15,
    "漢字採点_完全回復日数": 7,
    "漢字基本Pt_送り仮名選択_90以上": 10,
    "漢字基本Pt_送り仮名選択_80以上": 5,
    "漢字基本Pt_送り仮名選択_70以上": 4,
    "漢字基本Pt_送り仮名選択_60以上": 3,
    "漢字基本Pt_送り仮名選択_50以上": 1,
    "漢字基本Pt_書取り_90以上": 10,
    "漢字基本Pt_書取り_80以上": 5,
    "漢字基本Pt_書取り_70以上": 4,
    "漢字基本Pt_書取り_60以上": 3,
    "漢字基本Pt_書取り_50以上": 1,
    "漢字基本Pt_読みタイピング_90以上": 10,
    "漢字基本Pt_読みタイピング_80以上": 5,
    "漢字基本Pt_読みタイピング_70以上": 4,
    "漢字基本Pt_読みタイピング_60以上": 3,
    "漢字基本Pt_読みタイピング_50以上": 1,
    "漢字基本Pt_画数_90以上": 10,
    "漢字基本Pt_画数_80以上": 5,
    "漢字基本Pt_画数_70以上": 4,
    "漢字基本Pt_画数_60以上": 3,
    "漢字基本Pt_画数_50以上": 1,
    "漢字書き順_画数倍率": 1
  };

  // 既定の外部学習メニュー
  var DEFAULT_EXTERNAL_MENUS = [
    { category: "ドリル・宿題", volume: "1ページ", points: 5 },
    { category: "ドリル・宿題", volume: "2ページ以上", points: 10 },
    { category: "読書", volume: "15分", points: 5 },
    { category: "読書", volume: "30分以上", points: 10 },
    { category: "習い事・練習", volume: "15分", points: 5 },
    { category: "習い事・練習", volume: "30分以上", points: 10 },
    { category: "お手伝い", volume: "かんたん", points: 3 },
    { category: "お手伝い", volume: "しっかり", points: 8 }
  ];

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  /**
   * アプリ基本設定の取得（Firestore 優先 & 即座返却）
   */
  function getAppSettings() {
    return new Promise(function (resolve) {
      if (cachedSettings) {
        resolve({ status: 'success', settings: cachedSettings });
        return;
      }

      var db = getDb();
      if (!db) {
        cachedSettings = Object.assign({}, DEFAULT_SETTINGS);
        resolve({ status: 'success', settings: cachedSettings });
        return;
      }

      db.collection('system').doc('app_settings').get().then(function (doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data && data.settings) {
            cachedSettings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
            resolve({ status: 'success', settings: cachedSettings });
            return;
          }
        }
        // Firestore が空の場合は既定値で初期シード
        cachedSettings = Object.assign({}, DEFAULT_SETTINGS);
        db.collection('system').doc('app_settings').set({
          settings: cachedSettings,
          updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        }, { merge: true });
        resolve({ status: 'success', settings: cachedSettings });
      }).catch(function (err) {
        console.warn("Firestore getAppSettings error, fallback to default:", err);
        cachedSettings = Object.assign({}, DEFAULT_SETTINGS);
        resolve({ status: 'success', settings: cachedSettings });
      });
    });
  }

  /**
   * アプリ基本設定の保存
   */
  function saveAppSettings(newSettings) {
    return new Promise(function (resolve, reject) {
      cachedSettings = Object.assign({}, cachedSettings || DEFAULT_SETTINGS, newSettings || {});
      var db = getDb();
      if (!db) {
        resolve(true);
        return;
      }
      db.collection('system').doc('app_settings').set({
        settings: cachedSettings,
        updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
          firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
      }, { merge: true }).then(function () {
        resolve(true);
      }).catch(reject);
    });
  }

  /**
   * 特訓ルートの取得（Firestore 完結）
   */
  function getTrainingRoute(menuId, userId) {
    return new Promise(function (resolve) {
      var db = getDb();
      if (!db) {
        resolve({ status: 'success', routes: [] });
        return;
      }

      db.collection('system').doc('training_admin').get().then(function (doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data && Array.isArray(data.menus)) {
            var menu = data.menus.find(function (m) { return String(m.id) === String(menuId); });
            if (menu && Array.isArray(menu.routes)) {
              // targetUsers でフィルタリング（「全員」または該当 userId）
              var matched = menu.routes.filter(function (r) {
                if (!r.targetUsers || r.targetUsers === '全員') return true;
                return String(r.targetUsers).indexOf(String(userId)) >= 0;
              });
              resolve({
                status: 'success',
                menuName: menu.name || '',
                routes: matched,
                basePoints: data.basePoints || {}
              });
              return;
            }
          }
        }
        resolve({ status: 'success', routes: [], basePoints: {} });
      }).catch(function () {
        resolve({ status: 'success', routes: [], basePoints: {} });
      });
    });
  }

  /**
   * 外部学習メニュー一覧の取得（Firestore 完結）
   */
  function getExternalLearningMenus() {
    return new Promise(function (resolve) {
      var db = getDb();
      if (!db) {
        resolve({ status: 'success', list: DEFAULT_EXTERNAL_MENUS });
        return;
      }

      db.collection('system').doc('external_menus').get().then(function (doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data && Array.isArray(data.list) && data.list.length > 0) {
            resolve({ status: 'success', list: data.list });
            return;
          }
        }
        // Firestore に無ければ既定リストで初期シード
        db.collection('system').doc('external_menus').set({
          list: DEFAULT_EXTERNAL_MENUS,
          updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        }, { merge: true });
        resolve({ status: 'success', list: DEFAULT_EXTERNAL_MENUS });
      }).catch(function () {
        resolve({ status: 'success', list: DEFAULT_EXTERNAL_MENUS });
      });
    });
  }

  global.appSettingsStore = {
    getAppSettings: getAppSettings,
    saveAppSettings: saveAppSettings,
    getTrainingRoute: getTrainingRoute,
    getExternalLearningMenus: getExternalLearningMenus
  };

})(typeof window !== 'undefined' ? window : this);
