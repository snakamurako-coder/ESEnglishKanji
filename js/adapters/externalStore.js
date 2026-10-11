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
          resolve({ id: docRef.id, ...payload });
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
        .where('userId', '==', userId)
        .onSnapshot(function (snapshot) {
          var list = [];
          snapshot.forEach(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            list.push(d);
          });
          // requestedAt 降順ソート
          list.sort(function (a, b) {
            return (b.requestedAt || '').localeCompare(a.requestedAt || '');
          });
          if (typeof callback === 'function') callback(list);
        }, function (err) {
          console.warn("My external requests snapshot error:", err);
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
   * 保護者用：未承認（pending）申請のリアルタイム購読
   */
  function subscribePendingRequests(callback) {
    if (activeAdminUnsubscribe) {
      try { activeAdminUnsubscribe(); } catch (_e) {}
      activeAdminUnsubscribe = null;
    }
    var db = getDb();
    if (!db) return;

    try {
      activeAdminUnsubscribe = db.collection('externalRequests')
        .where('status', '==', 'pending')
        .onSnapshot(function (snapshot) {
          var list = [];
          snapshot.forEach(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            list.push(d);
          });
          list.sort(function (a, b) {
            return (b.requestedAt || '').localeCompare(a.requestedAt || '');
          });
          if (typeof callback === 'function') callback(list);
        }, function (err) {
          console.warn("Pending external requests snapshot error:", err);
        });
    } catch (e) {
      console.warn("Failed to subscribe pending requests:", e);
    }
  }

  function unsubscribePendingRequests() {
    if (activeAdminUnsubscribe) {
      try { activeAdminUnsubscribe(); } catch (_e) {}
      activeAdminUnsubscribe = null;
    }
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
        var data = doc.data();
        var newStatus = approve ? 'approved' : 'rejected';

        docRef.update({
          status: newStatus,
          adminMemo: adminMemo || '',
          decidedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        }).then(function () {
          // 承認の場合はポイントを加算
          if (approve && data.userId && data.points) {
            if (global.userStore && typeof global.userStore.addPoints === 'function') {
              global.userStore.addPoints(data.userId, data.points, '外部学習: ' + (data.category || ''));
            }
          }
          resolve({ id: requestId, userId: data.userId, points: data.points, status: newStatus });
        }).catch(reject);
      }).catch(reject);
    });
  }

  global.externalStore = {
    submitRequest: submitRequest,
    subscribeMyRequests: subscribeMyRequests,
    unsubscribeMyRequests: unsubscribeMyRequests,
    subscribePendingRequests: subscribePendingRequests,
    unsubscribePendingRequests: unsubscribePendingRequests,
    decideRequest: decideRequest
  };

})(typeof window !== 'undefined' ? window : this);
