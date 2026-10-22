/**
 * js/adapters/externalStore.js
 * 外部学習の申請・リアルタイム承認を司る Firestore アダプター（GAS 非依存）
 */
(function (global) {
  'use strict';

  var activeAdminUnsubscribe = null;
  var activeAdminUnsubLegacy = null;
  var activeMyRequestsUnsubscribe = null;

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  function isPendingStatus_(status) {
    var s = String(status || '').trim();
    return s === 'pending' || s === '申請中';
  }

  function serverNow_() {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      return firebase.firestore.FieldValue.serverTimestamp();
    }
    return new Date().toISOString();
  }

  function fieldIncrement_(n) {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      return firebase.firestore.FieldValue.increment(n);
    }
    return n;
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
        status: 'pending',
        requestedAt: reqData.requestedAt || dateStr,
        createdAt: serverNow_()
      };

      db.collection('externalRequests').add(payload)
        .then(function (docRef) {
          resolve(Object.assign({}, payload, { id: docRef.id }));
        })
        .catch(reject);
    });
  }

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
   * 未承認のみ購読（全件 onSnapshot は履歴が増えると承認のたびに重い）
   * pending と旧「申請中」を別クエリで監視しマージする。
   */
  function subscribePendingRequests(callback) {
    unsubscribePendingRequests();
    var db = getDb();
    if (!db) {
      if (typeof callback === 'function') callback([]);
      return;
    }

    var pendingMap = Object.create(null);
    var legacyMap = Object.create(null);

    function emitMerged_() {
      var byId = Object.create(null);
      Object.keys(pendingMap).forEach(function (id) { byId[id] = pendingMap[id]; });
      Object.keys(legacyMap).forEach(function (id) { byId[id] = legacyMap[id]; });
      var list = Object.keys(byId).map(function (id) { return byId[id]; });
      list.sort(function (a, b) {
        return (b.requestedAt || '').localeCompare(a.requestedAt || '');
      });
      if (typeof callback === 'function') callback(list);
    }

    function bindQuery_(query, bucket) {
      try {
        return query.onSnapshot(function (snapshot) {
          // 差分だけでなく snapshot 全体で bucket を作り直す（削除・status 変更を確実に反映）
          var next = Object.create(null);
          snapshot.forEach(function (doc) {
            var d = doc.data() || {};
            if (!isPendingStatus_(d.status)) return;
            d.id = doc.id;
            next[doc.id] = d;
          });
          if (bucket === 'pending') pendingMap = next;
          else legacyMap = next;
          emitMerged_();
        }, function (err) {
          console.warn("Pending external requests snapshot error:", err);
          if (bucket === 'pending') pendingMap = Object.create(null);
          else legacyMap = Object.create(null);
          emitMerged_();
        });
      } catch (e) {
        console.warn("Failed to bind pending query:", e);
        return null;
      }
    }

    try {
      var col = db.collection('externalRequests');
      activeAdminUnsubscribe = bindQuery_(col.where('status', '==', 'pending'), 'pending');
      // 旧スプシ由来の status。件数が少なければ軽い。不要なら後で外してよい。
      activeAdminUnsubLegacy = bindQuery_(col.where('status', '==', '申請中'), 'legacy');
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
    if (activeAdminUnsubLegacy) {
      try { activeAdminUnsubLegacy(); } catch (_e) {}
      activeAdminUnsubLegacy = null;
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
      var col = db.collection('externalRequests');
      Promise.all([
        col.where('status', '==', 'pending').get(),
        col.where('status', '==', '申請中').get().catch(function () { return { forEach: function () {} }; })
      ]).then(function (snaps) {
        var byId = Object.create(null);
        snaps.forEach(function (snapshot) {
          if (!snapshot || !snapshot.forEach) return;
          snapshot.forEach(function (doc) {
            var d = doc.data() || {};
            if (!isPendingStatus_(d.status)) return;
            d.id = doc.id;
            byId[doc.id] = d;
          });
        });
        var list = Object.keys(byId).map(function (id) { return byId[id]; });
        list.sort(function (a, b) {
          return (b.requestedAt || '').localeCompare(a.requestedAt || '');
        });
        resolve(list);
      }).catch(reject);
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
   * 申請の承認または却下（Firestore のみ・1 回の writeBatch）
   * @param {string} requestId
   * @param {boolean} approve
   * @param {string=} adminMemo
   * @param {Object=} hint 一覧カードのキャッシュ（get 往復を省略）
   */
  function decideRequest(requestId, approve, adminMemo, hint) {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (!db || !requestId) {
        reject(new Error("Firestore or requestId missing"));
        return;
      }

      var docRef = db.collection('externalRequests').doc(String(requestId));
      var hintData = hint && typeof hint === 'object' ? hint : null;

      function commitWithData_(data) {
        data = data || {};
        if (!isPendingStatus_(data.status) && data.status !== undefined && data.status !== null && data.status !== '') {
          resolve({
            id: requestId,
            userId: data.userId,
            points: data.points,
            status: data.status,
            alreadyDecided: true
          });
          return;
        }

        var newStatus = approve ? 'approved' : 'rejected';
        var pts = Number(data.points) || 0;
        var userId = data.userId != null ? String(data.userId) : '';

        var batch = db.batch();
        batch.update(docRef, {
          status: newStatus,
          adminMemo: adminMemo || '',
          decidedAt: serverNow_()
        });

        if (approve && userId && pts > 0) {
          applyPointsLocally_(userId, pts);
          var userRef = db.collection('users').doc(userId);
          batch.set(userRef, {
            points: fieldIncrement_(pts),
            lastReason: '外部学習: ' + (data.category || ''),
            updatedAt: serverNow_()
          }, { merge: true });
        }

        batch.commit()
          .then(function () {
            resolve({ id: requestId, userId: userId, points: pts, status: newStatus });
          })
          .catch(reject);
      }

      // 一覧に載っているデータがあれば get を省略（往復 1 回削減）
      if (hintData && (hintData.userId != null || hintData.points != null || hintData.status != null)) {
        commitWithData_({
          userId: hintData.userId,
          points: hintData.points,
          category: hintData.category,
          status: hintData.status != null ? hintData.status : 'pending'
        });
        return;
      }

      docRef.get().then(function (doc) {
        if (!doc.exists) {
          reject(new Error("Request not found"));
          return;
        }
        commitWithData_(doc.data() || {});
      }).catch(reject);
    });
  }

  function processRequest(adminPin, rowIdx, decision, adminMemo) {
    var approve = String(decision || '') === '承認' || String(decision || '').toLowerCase() === 'approve';
    return decideRequest(rowIdx, approve, adminMemo || '');
  }

  function bulkApproveRequests(adminPin, requests) {
    var list = Array.isArray(requests) ? requests : [];
    return Promise.all(list.map(function (item) {
      var id = item && (item.reqId || item.id || item.rowIdx);
      if (!id) return Promise.resolve(null);
      return decideRequest(id, true, item.adminMemo || '', item);
    }));
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
