/**
 * js/adapters/externalStore.js
 * 外部学習の申請・リアルタイム承認を司る Firestore アダプター
 */
(function (global) {
  'use strict';

  var activeAdminUnsubscribe = null;
  var activeMyRequestsUnsubscribe = null;

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  function isPendingStatus_(status) {
    var s = String(status || '').trim();
    return s === 'pending' || s === '申請中';
  }

  /**
   * 子どもの外部学習申請を Firestore に登録
   */
  function submitRequest(reqData) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (!db) {
        reject(new Error("Firestore not available"));
        return;
      }

      var now = new Date();
      var pad = function (n) { return n < 10 ? '0' + n : String(n); };
      var dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
                    pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

      var payload = {
        userId: reqData.userId,
        userName: reqData.userName || '',
        category: reqData.category || '',
        volume: reqData.volume || '',
        points: Number(reqData.points) || 0,
        childMemo: reqData.childMemo || '',
        adminMemo: '',
        status: 'pending', // 'pending' | 'approved' | 'rejected'
        requestedAt: reqData.requestedAt || dateStr,
        createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
          firebase.firestore.FieldValue.serverTimestamp() : now.toISOString()
      };

      db.collection('externalRequests').add(payload)
        .then(function (docRef) {
          var out = Object.assign({}, payload, { id: docRef.id });
          resolve(out);
        })
        .catch(reject);
    });
  }

  /**
   * 自分の申請履歴をリアルタイム購読
   */
  function subscribeMyRequests(userId, callback) {
    if (activeMyRequestsUnsubscribe) {
      try { activeMyRequestsUnsubscribe(); } catch (_e) {}
      activeMyRequestsUnsubscribe = null;
    }
    var db = getDb();
    if (!db || userId == null) return;

    try {
      activeMyRequestsUnsubscribe = db.collection('externalRequests')
        .where('userId', '==', String(userId))
        .onSnapshot(function (snapshot) {
          var list = [];
          snapshot.forEach(function (doc) {
            var d = doc.data() || {};
            d.id = doc.id;
            list.push(d);
          });
          list.sort(function (a, b) {
            return (b.requestedAt || '').localeCompare(a.requestedAt || '');
          });
          if (typeof callback === 'function') callback(list);
        }, function (err) {
          console.warn("My external requests snapshot error:", err);
          if (typeof callback === 'function') callback([]);
        });
    } catch (e) {
      console.warn("Failed to subscribe my requests:", e);
    }
  }

  function unsubscribeMyRequests() {
    if (activeMyRequestsUnsubscribe) {
      try { activeMyRequestsUnsubscribe(); } catch (_e) {}
      activeMyRequestsUnsubscribe = null;
    }
  }

  /**
   * 保護者用：未承認（pending / 申請中）申請のリアルタイム購読
   */
  function subscribePendingRequests(callback) {
    if (activeAdminUnsubscribe) {
      try { activeAdminUnsubscribe(); } catch (_e) {}
      activeAdminUnsubscribe = null;
    }
    var db = getDb();
    if (!db) {
      if (typeof callback === 'function') callback([]);
      return;
    }

    try {
      // status==pending のクエリがインデックス未作成でも動くよう、広めに取ってクライアント側で絞る
      activeAdminUnsubscribe = db.collection('externalRequests')
        .onSnapshot(function (snapshot) {
          var list = [];
          snapshot.forEach(function (doc) {
            var d = doc.data() || {};
            if (!isPendingStatus_(d.status)) return;
            d.id = doc.id;
            list.push(d);
          });
          list.sort(function (a, b) {
            return (b.requestedAt || '').localeCompare(a.requestedAt || '');
          });
          if (typeof callback === 'function') callback(list);
        }, function (err) {
          console.warn("Pending external requests snapshot error:", err);
          if (typeof callback === 'function') callback([]);
        });
    } catch (e) {
      console.warn("Failed to subscribe pending requests:", e);
      if (typeof callback === 'function') callback([]);
    }
  }

  function unsubscribePendingRequests() {
    if (activeAdminUnsubscribe) {
      try { activeAdminUnsubscribe(); } catch (_e) {}
      activeAdminUnsubscribe = null;
    }
  }

  function getMyRequests(userId) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (!db || userId == null) {
        resolve([]);
        return;
      }
      db.collection('externalRequests')
        .where('userId', '==', String(userId))
        .get()
        .then(function (snapshot) {
          var list = [];
          snapshot.forEach(function (doc) {
            var d = doc.data() || {};
            d.id = doc.id;
            list.push(d);
          });
          list.sort(function (a, b) {
            return (b.requestedAt || '').localeCompare(a.requestedAt || '');
          });
          resolve(list);
        })
        .catch(reject);
    });
  }

  function getPendingRequests(/* adminPin */) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (!db) {
        resolve([]);
        return;
      }
      db.collection('externalRequests')
        .get()
        .then(function (snapshot) {
          var list = [];
          snapshot.forEach(function (doc) {
            var d = doc.data() || {};
            if (!isPendingStatus_(d.status)) return;
            d.id = doc.id;
            list.push(d);
          });
          list.sort(function (a, b) {
            return (b.requestedAt || '').localeCompare(a.requestedAt || '');
          });
          resolve(list);
        })
        .catch(reject);
    });
  }

  function applyPointsLocally_(userId, amount) {
    try {
      var kid = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      if (kid && String(kid.id) === String(userId)) {
        kid.points = (Number(kid.points) || 0) + (Number(amount) || 0);
        if (typeof global.saveAppKidUserToLocal === 'function') {
          global.saveAppKidUserToLocal(kid);
        } else {
          localStorage.setItem('app_kid_user', JSON.stringify(kid));
        }
        var ptsEl = document.getElementById('user-points');
        if (ptsEl) ptsEl.innerText = String(kid.points);
      }
    } catch (_e) {}
  }

  /**
   * 申請の承認または却下
   */
  function decideRequest(requestId, approve, adminMemo) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (!db || !requestId) {
        reject(new Error("Firestore or requestId missing"));
        return;
      }

      var docRef = db.collection('externalRequests').doc(String(requestId));
      docRef.get().then(function (doc) {
        if (!doc.exists) {
          reject(new Error("Request not found"));
          return;
        }
        var data = doc.data() || {};
        if (!isPendingStatus_(data.status) && data.status !== undefined) {
          // すでに処理済みでも成功扱いで返す（二重押し対策）
          resolve({ id: requestId, userId: data.userId, points: data.points, status: data.status, alreadyDecided: true });
          return;
        }
        var newStatus = approve ? 'approved' : 'rejected';
        var pts = Number(data.points) || 0;

        docRef.update({
          status: newStatus,
          adminMemo: adminMemo || '',
          decidedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        }).then(function () {
          if (approve && data.userId && pts > 0) {
            applyPointsLocally_(data.userId, pts);
            var addP = (global.userStore && typeof global.userStore.addPoints === 'function')
              ? global.userStore.addPoints(data.userId, pts, '外部学習: ' + (data.category || ''))
              : Promise.resolve(false);
            return Promise.resolve(addP).then(function () {
              resolve({ id: requestId, userId: data.userId, points: pts, status: newStatus });
            });
          }
          resolve({ id: requestId, userId: data.userId, points: pts, status: newStatus });
        }).catch(reject);
      }).catch(reject);
    });
  }

  /** app.js インターセプト互換（rowIdx に docId が入る想定） */
  function processRequest(adminPin, rowIdx, decision, adminMemo) {
    var approve = String(decision || '') === '承認' || String(decision || '').toLowerCase() === 'approve';
    return decideRequest(rowIdx, approve, adminMemo || '');
  }

  function bulkApproveRequests(adminPin, requests) {
    var list = Array.isArray(requests) ? requests : [];
    var chain = Promise.resolve();
    list.forEach(function (item) {
      var id = item && (item.reqId || item.id || item.rowIdx);
      if (!id) return;
      chain = chain.then(function () {
        return decideRequest(id, true, item.adminMemo || '');
      });
    });
    return chain;
  }

  global.externalStore = {
    submitRequest: submitRequest,
    subscribeMyRequests: subscribeMyRequests,
    unsubscribeMyRequests: unsubscribeMyRequests,
    subscribePendingRequests: subscribePendingRequests,
    unsubscribePendingRequests: unsubscribePendingRequests,
    decideRequest: decideRequest,
    getMyRequests: getMyRequests,
    getPendingRequests: getPendingRequests,
    processRequest: processRequest,
    bulkApproveRequests: bulkApproveRequests
  };

})(typeof window !== 'undefined' ? window : this);
