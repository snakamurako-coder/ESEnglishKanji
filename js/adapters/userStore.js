/**
 * js/adapters/userStore.js
 * Firestore と GAS を統合するユーザー・ポイント管理ストア
 */
(function (global) {
  'use strict';

  var activePointsUnsubscribe = null;

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  /**
   * ユーザー一覧を取得（Firestore 優先、GAS フォールバック & 初回自動同期）
   */
  function fetchUsersList() {
    return new Promise(function (resolve, reject) {
      var db = getDb();
      if (db) {
        db.collection('users').get().then(function (snapshot) {
          if (snapshot && !snapshot.empty) {
            var users = [];
            snapshot.forEach(function (doc) {
              var data = doc.data();
              if (data) {
                if (data.id == null) data.id = doc.id;
                users.push(data);
              }
            });
            // id 順または自然順にソート
            users.sort(function (a, b) { return (a.id || 0) - (b.id || 0); });
            try { localStorage.setItem('app_child_users_cache', JSON.stringify(users)); } catch (_) {}
            resolve(users);
            return;
          }
          // Firestore が空の場合はローカルキャッシュを確認
          var cached = null;
          try { cached = JSON.parse(localStorage.getItem('app_child_users_cache') || 'null'); } catch (_) {}
          resolve(Array.isArray(cached) ? cached : []);
        }).catch(function (err) {
          console.warn("Firestore fetch users failed, using local cache:", err);
          var cached = null;
          try { cached = JSON.parse(localStorage.getItem('app_child_users_cache') || 'null'); } catch (_) {}
          resolve(Array.isArray(cached) ? cached : []);
        });
      } else {
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem('app_child_users_cache') || 'null'); } catch (_) {}
        resolve(Array.isArray(cached) ? cached : []);
      }
    });
  }

  function syncUsersToFirestore(users) {
    var db = getDb();
    if (!db || !Array.isArray(users)) return;
    var batch = db.batch();
    users.forEach(function (u) {
      if (u && u.id != null) {
        var docRef = db.collection('users').doc(String(u.id));
        batch.set(docRef, {
          id: u.id,
          name: u.name || '',
          points: typeof u.points === 'number' ? u.points : 0,
          updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        }, { merge: true });
      }
    });
    batch.commit().then(function () {
      console.log("Synced initial users from GAS to Firestore.");
    }).catch(function (e) {
      console.warn("Failed to sync users to Firestore:", e);
    });
  }

  /**
   * ユーザーのポイント変更を Firestore にリアルタイム監視
   */
  function subscribeUserPoints(userId, onPointsChanged) {
    if (activePointsUnsubscribe) {
      try { activePointsUnsubscribe(); } catch (_e) {}
      activePointsUnsubscribe = null;
    }
    var db = getDb();
    if (!db || userId == null) return;

    try {
      activePointsUnsubscribe = db.collection('users').doc(String(userId)).onSnapshot(function (doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data && typeof data.points === 'number') {
            if (typeof onPointsChanged === 'function') {
              onPointsChanged(data.points);
            }
          }
        }
      }, function (err) {
        console.warn("User points snapshot listener error:", err);
      });
    } catch (e) {
      console.warn("Failed to subscribe user points:", e);
    }
  }

  function unsubscribeUserPoints() {
    if (activePointsUnsubscribe) {
      try { activePointsUnsubscribe(); } catch (_e) {}
      activePointsUnsubscribe = null;
    }
  }

  /**
   * ポイントの加算（Firestore & ローカル即時反映）
   */
  function addPoints(userId, amount, reason) {
    return new Promise(function (resolve) {
      var db = getDb();
      if (db && userId != null && amount) {
        var docRef = db.collection('users').doc(String(userId));
        var inc = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
          firebase.firestore.FieldValue.increment(amount) : amount;
        docRef.set({
          points: inc,
          lastReason: reason || '',
          updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        }, { merge: true }).then(function () {
          resolve(true);
        }).catch(function (e) {
          console.warn("Failed to update points in Firestore:", e);
          resolve(false);
        });
      } else {
        resolve(false);
      }
    });
  }

  global.userStore = {
    fetchUsersList: fetchUsersList,
    syncUsersToFirestore: syncUsersToFirestore,
    subscribeUserPoints: subscribeUserPoints,
    unsubscribeUserPoints: unsubscribeUserPoints,
    addPoints: addPoints
  };

})(typeof window !== 'undefined' ? window : this);
