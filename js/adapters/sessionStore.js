/**
 * js/adapters/sessionStore.js
 * クイズ完了セッション履歴およびニガテ項目の Firestore 永続化アダプター
 */
(function (global) {
  'use strict';

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  function getGasUrl() {
    return global.GAS_API_URL || (typeof GAS_API_URL !== "undefined" ? GAS_API_URL : "");
  }

  /**
   * 仲介GASへの非同期学習ログ送信（fire-and-forget、UIブロックなし）
   */
  function syncSessionToMediatorGas(payload) {
    try {
      var gasUrl = getGasUrl();
      if (!gasUrl) return;
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: 'log_learning_session' }, payload))
      }).catch(function (e) {
        console.warn("Mediator GAS session background sync ignored:", e);
      });
    } catch (_) {}
  }

  /**
   * 1セット終了時のセッション結果を Firestore users/{userId}/sessions に保存
   */
  function saveLearningSession(payload) {
    return new Promise(function (resolve) {
      var db = getDb();
      if (!db || !payload || !payload.userId) {
        resolve(false);
        return;
      }

      try {
        var userId = String(payload.userId);
        var submitId = payload.sessionSubmitId || (String(payload.unitId || 'session') + '_' + Date.now());
        // ドキュメントIDとして無効な文字を置換
        var docId = submitId.replace(/[\/\\#\?]/g, '_');

        var results = Array.isArray(payload.results) ? payload.results : [];
        var totalCount = results.length;
        var correctCount = 0;
        results.forEach(function (r) {
          if (r && (r.correct === true || r.isCorrect === true)) correctCount++;
        });

        var sessionDoc = {
          unitId: payload.unitId || '',
          unitSheetName: payload.unitSheetName || '',
          learningCategory: payload.learningCategory || 'english',
          challengeType: payload.challengeType || '',
          isReviewMode: !!payload.isReviewMode,
          isRandom: !!payload.isRandom,
          score: typeof payload.score === 'number' ? payload.score : null,
          earnedPoints: typeof payload.earnedOverride === 'number' ? payload.earnedOverride : 0,
          totalQuestions: totalCount,
          correctQuestions: correctCount,
          trainingMenuId: payload.trainingMenuId || null,
          trainingStepIndex: payload.trainingStepIndex != null ? payload.trainingStepIndex : null,
          savedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };

        var docRef = db.collection('users').doc(userId).collection('sessions').doc(docId);
        docRef.set(sessionDoc, { merge: true })
          .then(function () {
            // 不正解の項目があれば weakItems に記録
            recordWeakItemsFromResults(userId, payload.learningCategory || 'english', results);

            // 獲得ポイントがあれば Firestore の user.points も加算
            if (sessionDoc.earnedPoints > 0 && global.userStore && typeof global.userStore.addPoints === 'function') {
              global.userStore.addPoints(userId, sessionDoc.earnedPoints, '学習: ' + (payload.unitSheetName || payload.unitId));
            }

            // 仲介GASへ非同期バックグラウンド連携（UI待機ゼロ）
            syncSessionToMediatorGas(Object.assign({}, sessionDoc, {
              sessionSubmitId: submitId,
              userId: userId
            }));

            resolve(true);
          })
          .catch(function (err) {
            console.warn("Firestore session save failed (offline or quota):", err);
            resolve(false);
          });
      } catch (e) {
        console.warn("saveLearningSession adapter error:", e);
        resolve(false);
      }
    });
  }

  /**
   * 不正解の単語/漢字を users/{userId}/weakItems に記録
   */
  function recordWeakItemsFromResults(userId, category, results) {
    var db = getDb();
    if (!db || !Array.isArray(results) || results.length === 0) return;

    try {
      var batch = db.batch();
      var count = 0;

      results.forEach(function (r) {
        if (!r) return;
        var isCorrect = (r.correct === true || r.isCorrect === true || r.questionCorrect === true);
        var qKey = String(r.word || r.kanji || r.questionId || r.q || '').trim();
        if (!qKey) return;

        var docKey = (category + '_' + qKey).replace(/[\/\\#\?]/g, '_');
        var ref = db.collection('users').doc(String(userId)).collection('weakItems').doc(docKey);

        if (!isCorrect) {
          // 不正解: ミスカウント加算 & タイムスタンプ更新
          batch.set(ref, {
            key: qKey,
            category: category,
            lastWrongAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
            wrongCount: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.increment(1) : 1
          }, { merge: true });
          count++;
        } else {
          // 正解: 直近正解タイムスタンプを記録（ニガテ克服フラグ）
          batch.set(ref, {
            lastPassedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
              firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true });
          count++;
        }
      });

      if (count > 0) {
        batch.commit().catch(function (e) {
          console.warn("Failed to update weak items in Firestore:", e);
        });
      }
    } catch (e) {
      console.warn("recordWeakItemsFromResults error:", e);
    }
  }

  global.sessionStore = {
    saveLearningSession: saveLearningSession,
    recordWeakItemsFromResults: recordWeakItemsFromResults
  };

})(typeof window !== 'undefined' ? window : this);
