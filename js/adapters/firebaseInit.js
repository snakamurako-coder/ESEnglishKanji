/**
 * js/adapters/firebaseInit.js
 * Firebase SDK 初期化・Firestore 接続・オフライン永続化設定
 */
(function (global) {
  'use strict';

  var firebaseConfig = {
    projectId: "jikkenfirebasekankyo",
    appId: "1:486733309657:web:ff4fe6df377d153eff40c8",
    databaseURL: "https://jikkenfirebasekankyo-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "jikkenfirebasekankyo.firebasestorage.app",
    apiKey: "AIzaSyCyAo_zwpXKageCV-p_LXXmd3K-OD9ihLc",
    authDomain: "jikkenfirebasekankyo.firebaseapp.com",
    messagingSenderId: "486733309657",
    measurementId: "G-1LQ6KE37ZV"
  };

  var app = null;
  var db = null;

  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps || firebase.apps.length === 0) {
        app = firebase.initializeApp(firebaseConfig);
      } else {
        app = firebase.app();
      }

      if (typeof firebase.firestore === 'function') {
        db = firebase.firestore();

        // オフラインキャッシュ有効化（マルチタブ対応）
        if (typeof db.enablePersistence === 'function') {
          db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
            if (err.code === 'failed-precondition') {
              console.warn("Firestore persistence failed: Multiple tabs open");
            } else if (err.code === 'unimplemented') {
              console.warn("Firestore persistence not supported by browser");
            } else {
              console.warn("Firestore persistence error:", err);
            }
          });
        }
      }
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }

  global.firebaseApp = app;
  global.firebaseDb = db;
  global.getFirestoreDb = function () {
    return global.firebaseDb || db || null;
  };

})(typeof window !== 'undefined' ? window : this);
