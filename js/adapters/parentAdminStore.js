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

      var cleanPin = String(pin).trim();

      // 正式管理者PIN 303707 なら即座に認証成功 & Firestore に確定保存
      if (cleanPin === "303707") {
        cachedAdminPin = cleanPin;
        var dbInst = getDb();
        if (dbInst) {
          dbInst.collection('system').doc('admin_config').set({
            adminPin: "303707",
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true });
        }
        resolve(true);
        return;
      }

      var db = getDb();
      if (db) {
        db.collection('system').doc('admin_config').get().then(function (doc) {
          if (doc.exists) {
            var data = doc.data();
            if (data && data.adminPin) {
              if (String(data.adminPin).trim() === cleanPin) {
                cachedAdminPin = cleanPin;
                resolve(true);
                return;
              } else {
                reject(new Error("PINが正しくありません"));
                return;
              }
            }
          }
          // Firestore にまだ admin_config がない場合、初期既定値 (1234 等) なら保存
          if (cleanPin === "1234" || cleanPin === "1794") {
            cachedAdminPin = cleanPin;
            db.collection('system').doc('admin_config').set({
              adminPin: cleanPin,
              updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
                firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
            }, { merge: true });
            resolve(true);
            return;
          }

          // それ以外は GAS で検証して Firestore に自動保存
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

  /**
   * 特訓メニューメタ設定の保存（Firestore 即時書き込み & GAS 非同期同期）
   */
  function saveTrainingMenuMeta(pin, menuId, meta) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      var idNum = parseInt(menuId, 10);
      if (isNaN(idNum) || idNum < 1 || idNum > 12) {
        reject(new Error("メニューIDが不正です"));
        return;
      }

      // Firestore の training_admin ドキュメントを更新
      if (db) {
        var docRef = db.collection('system').doc('training_admin');
        docRef.get().then(function (doc) {
          var data = doc.exists ? doc.data() : { menus: [] };
          var menus = Array.isArray(data.menus) ? data.menus : [];
          var target = menus.find(function (m) { return m && m.id === idNum; });
          if (!target) {
            target = { id: idNum, routes: [] };
            menus.push(target);
          }
          if (meta.displayName != null) target.displayName = String(meta.displayName);
          if (meta.color != null) target.color = String(meta.color);
          if (meta.enabled != null) target.enabled = !!meta.enabled;

          return docRef.set({
            menus: menus,
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true });
        }).then(function () {
          resolve(true);
        }).catch(function (err) {
          console.warn("Firestore save training menu meta error:", err);
          resolve(true); // オフラインでも続行
        });
      } else {
        resolve(true);
      }

      // GAS にバックグラウンド非同期送信（UI待機なし）
      var gasUrl = getGasUrl();
      if (gasUrl) {
        fetch(gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: "save_training_menu_meta",
            adminPin: pin,
            menuId: idNum,
            displayName: meta.displayName || "",
            color: meta.color || "",
            enabled: !!meta.enabled
          })
        }).catch(function (e) {
          console.warn("GAS save_training_menu_meta background error:", e);
        });
      }
    });
  }

  /**
   * 特訓基本点数の保存（Firestore 即時書き込み & GAS 非同期同期）
   */
  function saveTrainingBasePoint(pin, settingKey, modeCategory, value) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      var numVal = Number(value);
      if (isNaN(numVal) || numVal < 0) {
        reject(new Error("0以上の数値を入力してください"));
        return;
      }

      if (db) {
        var docRef = db.collection('system').doc('training_admin');
        docRef.get().then(function (doc) {
          var data = doc.exists ? doc.data() : {};
          var basePoints = data.basePoints || {};
          var prev = basePoints[settingKey];
          if (prev != null && typeof prev === 'object' && !Array.isArray(prev)) {
            if (modeCategory === 'expression') prev.expression = numVal;
            else prev.word = numVal;
          } else {
            basePoints[settingKey] = modeCategory === 'expression' ?
              { word: prev != null ? prev : "", expression: numVal } :
              { word: numVal, expression: "" };
          }

          return docRef.set({
            basePoints: basePoints,
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true });
        }).then(function () {
          resolve(true);
        }).catch(function (err) {
          console.warn("Firestore save training base point error:", err);
          resolve(true);
        });
      } else {
        resolve(true);
      }

      // GAS 非同期送信
      var gasUrl = getGasUrl();
      if (gasUrl) {
        fetch(gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: "save_training_base_point",
            adminPin: pin,
            settingKey: settingKey,
            modeCategory: modeCategory,
            value: numVal
          })
        }).catch(function (e) {
          console.warn("GAS save_training_base_point background error:", e);
        });
      }
    });
  }

  /**
   * 特訓ルート一括保存（Firestore 即時書き込み & GAS 非同期同期）
   */
  function saveTrainingRoutesBatch(pin, menuId, routes) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      var idNum = parseInt(menuId, 10);
      if (isNaN(idNum) || idNum < 1 || idNum > 12) {
        reject(new Error("メニューIDが不正です"));
        return;
      }

      var cleanRoutes = Array.isArray(routes) ? routes.map(function (r, idx) {
        return {
          stepIndex: idx + 1,
          targetUsers: String(r.targetUsers || "全員"),
          unitName: String(r.unitName || ""),
          qFormat: String(r.qFormat || ""),
          aFormat: String(r.aFormat || ""),
          mode: String(r.mode || "ランダム"),
          blankCount: r.blankCount != null ? r.blankCount : ""
        };
      }) : [];

      if (db) {
        var docRef = db.collection('system').doc('training_admin');
        docRef.get().then(function (doc) {
          var data = doc.exists ? doc.data() : { menus: [] };
          var menus = Array.isArray(data.menus) ? data.menus : [];
          var target = menus.find(function (m) { return m && m.id === idNum; });
          if (!target) {
            target = { id: idNum };
            menus.push(target);
          }
          target.routes = cleanRoutes;

          return docRef.set({
            menus: menus,
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true });
        }).then(function () {
          resolve({ status: "success", count: cleanRoutes.length });
        }).catch(function (err) {
          console.warn("Firestore save training routes error:", err);
          resolve({ status: "success", count: cleanRoutes.length });
        });
      } else {
        resolve({ status: "success", count: cleanRoutes.length });
      }

      // GAS 非同期送信
      var gasUrl = getGasUrl();
      if (gasUrl) {
        fetch(gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: "save_training_menu_routes_batch",
            adminPin: pin,
            menuId: idNum,
            routes: cleanRoutes
          })
        }).catch(function (e) {
          console.warn("GAS save_training_menu_routes_batch background error:", e);
        });
      }
    });
  }

  /**
   * 管理者PINの変更（Firestore 即時書き込み & GAS 非同期同期）
   */
  function updateAdminPin(currentPin, newPin) {
    return new Promise(function (resolve, reject) {
      if (!newPin || String(newPin).trim().length < 4) {
        reject(new Error("PINは4桁以上の数字を入力してください"));
        return;
      }
      verifyAdminPin(currentPin).then(function () {
        var db = getDb();
        if (db) {
          db.collection('system').doc('admin_config').set({
            adminPin: String(newPin).trim(),
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true }).then(function () {
            cachedAdminPin = newPin;
            resolve(true);
          }).catch(function (err) {
            reject(err);
          });
        } else {
          cachedAdminPin = newPin;
          resolve(true);
        }

        var gasUrl = getGasUrl();
        if (gasUrl) {
          fetch(gasUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'update_admin_pin', currentPin: currentPin, newPin: newPin })
          }).catch(function (e) {
            console.warn("GAS update_admin_pin background error:", e);
          });
        }
      }).catch(reject);
    });
  }

  /**
   * ユーザー一覧とポイントの取得
   */
  function getUsersPoints(pin) {
    return new Promise(function (resolve, reject) {
      var gasUrl = getGasUrl();
      fetch(gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_users_points_admin', adminPin: pin })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === 'success' && Array.isArray(d.users)) {
            resolve(d.users);
          } else {
            reject(new Error((d && d.message) || 'ユーザー一覧の取得に失敗しました'));
          }
        })
        .catch(reject);
    });
  }

  /**
   * ユーザーポイントの更新（GAS更新 & Firestore同期）
   */
  function updateUserPoints(pin, userId, newPoints) {
    return new Promise(function (resolve, reject) {
      var gasUrl = getGasUrl();
      var pts = Math.round(Number(newPoints) * 100) / 100;
      fetch(gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'update_user_points_admin', adminPin: pin, userId: userId, newPoints: pts })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === 'success') {
            // Firestore にも同期
            var db = getDb();
            if (db) {
              db.collection('users').doc(String(userId)).set({
                points: pts,
                updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
                  firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
              }, { merge: true }).catch(function (e) {
                console.warn("Firestore user points update error:", e);
              });
            }
            resolve(d);
          } else {
            reject(new Error((d && d.message) || 'ポイント更新に失敗しました'));
          }
        })
        .catch(reject);
    });
  }

  global.parentAdminStore = {
    verifyAdminPin: verifyAdminPin,
    updateAdminPin: updateAdminPin,
    getNotifyEmails: getNotifyEmails,
    saveNotifyEmails: saveNotifyEmails,
    getUsersPoints: getUsersPoints,
    updateUserPoints: updateUserPoints,
    getTrainingAdminData: getTrainingAdminData,
    saveTrainingAdminDataToFirestore: saveTrainingAdminDataToFirestore,
    saveTrainingMenuMeta: saveTrainingMenuMeta,
    saveTrainingBasePoint: saveTrainingBasePoint,
    saveTrainingRoutesBatch: saveTrainingRoutesBatch
  };

})(typeof window !== 'undefined' ? window : this);
