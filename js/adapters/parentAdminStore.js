/**
 * js/adapters/parentAdminStore.js
 * 保護者・管理者メニューの爆速化アダプター（Firestore 優先キャッシュ & バックグラウンド GAS 同期）
 */
(function (global) {
  'use strict';

  var cachedAdminPin = null;

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  function getGasUrl() {
    return global.GAS_API_URL || (typeof GAS_API_URL !== "undefined" ? GAS_API_URL : "");
  }

  /**
   * 管理者PINの高速検証（Firestore 優先 & 初回 GAS マイグレーション）
   */
  function verifyAdminPin(pin) {
    return new Promise(function (resolve, reject) {
      if (!pin) {
        reject(new Error("PINが入力されていません"));
        return;
      }

      // セッション内キャッシュがあれば即座に検証
      if (cachedAdminPin && cachedAdminPin === pin) {
        resolve(true);
        return;
      }

      var db = getDb();
      if (db) {
        db.collection('system').doc('admin_config').get().then(function (doc) {
          if (doc.exists) {
            var data = doc.data();
            if (data && data.adminPin) {
              if (String(data.adminPin).trim() === String(pin).trim()) {
                cachedAdminPin = pin;
                resolve(true);
                return;
              } else {
                reject(new Error("PINが正しくありません"));
                return;
              }
            }
          }
          // Firestore にまだ admin_config がない場合は GAS で検証して Firestore に自動保存
          verifyWithGas(pin).then(function () {
            cachedAdminPin = pin;
            // Firestore に保存して次回から爆速化
            db.collection('system').doc('admin_config').set({
              adminPin: String(pin).trim(),
              updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
                firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
            }, { merge: true });
            resolve(true);
          }).catch(reject);
        }).catch(function (err) {
          console.warn("Firestore verify pin failed, fallback to GAS:", err);
          verifyWithGas(pin).then(resolve).catch(reject);
        });
      } else {
        verifyWithGas(pin).then(resolve).catch(reject);
      }
    });
  }

  function verifyWithGas(pin) {
    return new Promise(function (resolve, reject) {
      var gasUrl = getGasUrl();
      if (!gasUrl) {
        reject(new Error("GAS_API_URL is missing"));
        return;
      }
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === "success") resolve(true);
          else reject(new Error((d && d.message) || "PINが正しくありません"));
        })
        .catch(function (e) { reject(new Error("通信エラー: " + e.message)); });
    });
  }

  /**
   * 通知メール一覧の取得（Firestore 優先）
   */
  function getNotifyEmails(pin) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (db) {
        db.collection('system').doc('admin_config').get().then(function (doc) {
          if (doc.exists) {
            var data = doc.data();
            if (data && Array.isArray(data.notifyEmails)) {
              resolve(data.notifyEmails);
              return;
            }
          }
          // Firestore に無ければ GAS から取得して保存
          getNotifyEmailsFromGas(pin).then(function (emails) {
            saveNotifyEmailsToFirestore(emails);
            resolve(emails);
          }).catch(reject);
        }).catch(function () {
          getNotifyEmailsFromGas(pin).then(resolve).catch(reject);
        });
      } else {
        getNotifyEmailsFromGas(pin).then(resolve).catch(reject);
      }
    });
  }

  function getNotifyEmailsFromGas(pin) {
    return new Promise(function (resolve, reject) {
      var gasUrl = getGasUrl();
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'get_parent_notify_emails', adminPin: pin }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === 'success') resolve(d.emails || []);
          else reject(new Error((d && d.message) || '読み込み失敗'));
        })
        .catch(reject);
    });
  }

  function saveNotifyEmailsToFirestore(emails) {
    var db = getDb();
    if (!db) return;
    db.collection('system').doc('admin_config').set({
      notifyEmails: emails || [],
      updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
        firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    }, { merge: true });
  }

  /**
   * 通知メールの保存（Firestore 即座書き込み ＆ GAS バックグラウンド同期）
   */
  function saveNotifyEmails(pin, emails) {
    saveNotifyEmailsToFirestore(emails);
    // GAS にも非同期で送信
    var gasUrl = getGasUrl();
    if (gasUrl) {
      fetch(gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_parent_notify_emails', adminPin: pin, emails: emails })
      }).catch(function (e) {
        console.warn("GAS save emails background sync error:", e);
      });
    }
    return Promise.resolve(true);
  }

  /**
   * 特訓メニュー管理データの取得（Firestore 優先）
   */
  function getTrainingAdminData(pin) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (db) {
        db.collection('system').doc('training_admin').get().then(function (doc) {
          if (doc.exists) {
            var data = doc.data();
            if (data && Array.isArray(data.menus) && data.menus.length > 0) {
              resolve(data);
              return;
            }
          }
          // Firestore に無ければ GAS から取得して保存
          getTrainingAdminDataFromGas(pin).then(function (gasData) {
            saveTrainingAdminDataToFirestore(gasData);
            resolve(gasData);
          }).catch(reject);
        }).catch(function () {
          getTrainingAdminDataFromGas(pin).then(resolve).catch(reject);
        });
      } else {
        getTrainingAdminDataFromGas(pin).then(resolve).catch(reject);
      }
    });
  }

  function getTrainingAdminDataFromGas(pin) {
    return new Promise(function (resolve, reject) {
      var gasUrl = getGasUrl();
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === "success") resolve(d);
          else reject(new Error((d && d.message) || "特訓メニュー取得失敗"));
        })
        .catch(reject);
    });
  }

  function saveTrainingAdminDataToFirestore(data) {
    var db = getDb();
    if (!db || !data) return;
    db.collection('system').doc('training_admin').set({
      menus: data.menus || [],
      basePoints: data.basePoints || {},
      colorPresets: data.colorPresets || [],
      updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
        firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    }, { merge: true });
  }

  global.parentAdminStore = {
    verifyAdminPin: verifyAdminPin,
    getNotifyEmails: getNotifyEmails,
    saveNotifyEmails: saveNotifyEmails,
    getTrainingAdminData: getTrainingAdminData,
    saveTrainingAdminDataToFirestore: saveTrainingAdminDataToFirestore
  };

})(typeof window !== 'undefined' ? window : this);
