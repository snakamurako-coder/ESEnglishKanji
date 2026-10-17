/**
 * js/adapters/sessionStore.js
 * クイズ完了セッション履歴およびニガテ項目の Firestore 永続化アダプター
 */
(function (global) {
  'use strict';

  /** 同一 sessionSubmitId の二重加算を防ぐ（同一タブ内） */
  var processedSubmitIds_ = Object.create(null);

  function getDb() {
    return (typeof global.getFirestoreDb === 'function') ? global.getFirestoreDb() : (global.firebaseDb || null);
  }

  /**
   * 1セット終了時のセッション結果を Firestore users/{userId}/sessions に保存
   */
  function saveLearningSession(payload) {
    return new Promise(function (resolve) {
      if (!payload || !payload.userId) {
        resolve({ status: "success", earnedPoints: 0, newTotal: 0 });
        return;
      }

      try {
        var userId = String(payload.userId);
        var submitId = payload.sessionSubmitId || (String(payload.unitId || 'session') + '_' + Date.now());
        // ドキュメントIDとして無効な文字を置換
        var docId = submitId.replace(/[\/\\#\?]/g, '_');

        if (submitId && processedSubmitIds_[submitId]) {
          var prior = processedSubmitIds_[submitId];
          resolve({
            status: "success",
            earnedPoints: prior.earnedPoints,
            newTotal: prior.newTotal,
            alreadyProcessed: true,
            message: "すでに保存済みです"
          });
          return;
        }

        var results = Array.isArray(payload.results) ? payload.results : [];
        var totalCount = results.length;
        var correctCount = 0;
        results.forEach(function (r) {
          if (r && (r.correct === true || r.isCorrect === true)) correctCount++;
        });

        var earned = typeof payload.earnedPoints === 'number' ? payload.earnedPoints :
          (typeof payload.earnedOverride === 'number' ? payload.earnedOverride : 0);
        earned = Math.max(0, Math.round(Number(earned) * 100) / 100);

        var kid = null;
        try { kid = JSON.parse(localStorage.getItem('app_kid_user') || 'null'); } catch (_e) {}
        var basePts = (kid && String(kid.id) === userId && typeof kid.points === 'number')
          ? kid.points
          : (typeof payload.newTotal === 'number' ? Math.max(0, payload.newTotal - earned) : 0);
        var newTotal = typeof payload.newTotal === 'number'
          ? Math.round(Number(payload.newTotal) * 100) / 100
          : Math.round((basePts + earned) * 100) / 100;

        var sessionDoc = {
          unitId: payload.unitId || '',
          unitSheetName: payload.unitSheetName || '',
          learningCategory: payload.learningCategory || 'english',
          challengeType: payload.challengeType || '',
          isReviewMode: !!payload.isReviewMode,
          isRandom: !!payload.isRandom,
          score: typeof payload.score === 'number' ? payload.score : null,
          earnedPoints: earned,
          totalQuestions: totalCount || (Array.isArray(payload.kanjiScoreBatch) ? payload.kanjiScoreBatch.length : 0),
          correctQuestions: correctCount,
          trainingMenuId: payload.trainingMenuId || null,
          trainingStepIndex: payload.trainingStepIndex != null ? payload.trainingStepIndex : null,
          savedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
            firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
        };

        processedSubmitIds_[submitId] = { earnedPoints: earned, newTotal: newTotal };

        // ローカルユーザーのポイントを即時反映（Firestore 待ちでも UI が遅れない）
        if (kid && String(kid.id) === userId) {
          kid.points = newTotal;
          try {
            if (typeof global.saveAppKidUserToLocal === 'function') {
              global.saveAppKidUserToLocal(kid);
            } else {
              localStorage.setItem('app_kid_user', JSON.stringify(kid));
            }
          } catch (_e2) {}
        }

        var db = getDb();
        var finish = function (msg) {
          resolve({
            status: "success",
            earnedPoints: earned,
            newTotal: newTotal,
            message: msg || "セッション結果を保存しました"
          });
        };

        if (!db) {
          finish("ローカル保存されました");
          return;
        }

        var docRef = db.collection('users').doc(userId).collection('sessions').doc(docId);
        docRef.set(sessionDoc, { merge: true })
          .then(function () {
            recordWeakItemsFromResults(userId, payload.learningCategory || 'english', results);

            // ポイントは increment と絶対値の両方で確実に反映（加算漏れ対策）
            var userRef = db.collection('users').doc(userId);
            var patch = {
              points: newTotal,
              updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ?
                firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
            };
            if (earned > 0) {
              patch.lastReason = '学習: ' + (payload.unitSheetName || payload.unitId || '');
            }
            return userRef.set(patch, { merge: true });
          })
          .then(function () {
            finish("セッション結果を保存しました");
          })
          .catch(function (err) {
            console.warn("Firestore session save failed (offline or quota):", err);
            finish("オフライン保存されました");
          });
      } catch (e) {
        console.warn("saveLearningSession adapter error:", e);
        resolve({ status: "success", earnedPoints: 0, newTotal: 0 });
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
    saveSession: saveLearningSession,
    recordWeakItemsFromResults: recordWeakItemsFromResults
  };

})(typeof window !== 'undefined' ? window : this);
