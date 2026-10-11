/**
 * js/modules/authPin.js
 * ユーザー一覧取得・選択、PINコード入力・検証、PINリセット、ログアウト管理モジュール
 */
(function (global) {
  'use strict';

  var selectedUserId = null;
  var currentPin = "";
  var isPinResetMode = false;

  function getGasUrl() {
    return global.GAS_API_URL || (typeof GAS_API_URL !== "undefined" ? GAS_API_URL : "");
  }

  function fetchUsers() {
    var box = document.getElementById('user-container');
    if (box) box.innerHTML = "<p>よみこみ中...</p>";

    if (global.userStore && typeof global.userStore.fetchUsersList === 'function') {
      global.userStore.fetchUsersList()
        .then(function (users) {
          if (Array.isArray(users) && users.length > 0) {
            renderUsers(users);
          } else {
            if (box) box.innerHTML = "<p style='color:#ff8a80;'>ユーザーが見つかりませんでした。</p>";
          }
        })
        .catch(function (err) {
          console.error("fetchUsersList failed:", err);
          if (box) box.innerHTML = "<p style='color:#ff8a80;'>ユーザー一覧の取得に失敗しました。<br>画面を再読み込みしてください。</p>";
        });
      return;
    }

    var done = function (d) {
      if (d && d.status === "success" && Array.isArray(d.users)) {
        renderUsers(d.users);
        return;
      }
      if (box) {
        box.innerHTML = "<p style='color:#ff8a80;'>ユーザー一覧の取得に失敗しました。<br>画面を再読み込みしてください。</p>";
      }
    };

    var fail = function (err) {
      console.error("fetchUsers failed:", err);
      if (box) {
        box.innerHTML = "<p style='color:#ff8a80;'>通信エラーです。しばらくして再読み込みしてください。</p>";
      }
    };

    if (typeof global.gasApiFetchJson === "function") {
      global.gasApiFetchJson({ action: "get_child_users" }, { retries: 2, timeoutMs: 90000 })
        .then(done)
        .catch(fail);
      return;
    }

    var gasUrl = getGasUrl();
    if (!gasUrl) {
      fail(new Error("GAS_API_URL is not defined"));
      return;
    }

    fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: "get_child_users" }) })
      .then(function (r) { return r.json(); })
      .then(done)
      .catch(fail);
  }

  function renderUsers(users) {
    var c = document.getElementById('user-container');
    if (!c) return;
    c.innerHTML = "";
    (users || []).forEach(function (u) {
      var div = document.createElement('div');
      div.className = 'user-card';
      div.onclick = function () { showPinScreen(u.id, u.name, false); };
      div.innerHTML = '<div class="user-icon">' + (u.name ? u.name.charAt(0) : '?') + '</div><div>' + (u.name || '') + '</div>';
      c.appendChild(div);
    });
  }

  function showPinScreen(id, name, isReset) {
    selectedUserId = id;
    global.selectedUserId = id;
    isPinResetMode = !!isReset;
    currentPin = "";
    updatePinDisplay();
    var nameEl = document.getElementById('selected-user-name');
    if (nameEl) nameEl.innerText = name || '';
    var instEl = document.getElementById('pin-instruction');
    if (instEl) instEl.innerText = isReset ? "あたらしい暗証番号（4ケタ）" : "あんしょうばんごう（4ケタ）";
    var msgEl = document.getElementById('message');
    if (msgEl) msgEl.innerText = "";
    if (typeof global.switchSection === 'function') {
      global.switchSection('section-pin');
    }
  }

  function addPin(num) {
    if (currentPin.length < 4) {
      currentPin += String(num);
      updatePinDisplay();
      if (currentPin.length === 4) {
        if (isPinResetMode) {
          executePinReset();
        } else {
          verifyPin();
        }
      }
    }
  }

  function deletePin() {
    currentPin = currentPin.slice(0, -1);
    updatePinDisplay();
  }

  function clearPin() {
    currentPin = "";
    updatePinDisplay();
  }

  function updatePinDisplay() {
    var d = "";
    for (var i = 0; i < 4; i++) {
      d += (i < currentPin.length) ? "● " : "_ ";
    }
    var dotsEl = document.getElementById('pin-dots');
    if (dotsEl) dotsEl.innerText = d.trim();
  }

  function cancelPin() {
    if (isPinResetMode) {
      var user = null;
      try { user = JSON.parse(localStorage.getItem('app_kid_user')); } catch (_e) {}
      if (typeof global.showHome === 'function') {
        global.showHome(user);
      }
    } else {
      if (typeof global.switchSection === 'function') {
        global.switchSection('section-users');
      }
    }
  }

  function verifyPin() {
    var msgEl = document.getElementById('message');
    if (msgEl) msgEl.innerText = "かくにん中...";

    var gasUrl = getGasUrl();
    fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({ action: "verify_kid_pin", userId: selectedUserId, pin: currentPin })
    })
      .then(function (r) {
        return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; });
      })
      .then(function (res) {
        var d = null;
        try { d = JSON.parse(res.text); } catch (_eParse) { d = null; }
        if (!d || typeof d !== "object") {
          throw new Error("サーバー応答が不正です (HTTP " + res.status + ")");
        }
        if (d.status === "success" && d.user) {
          if (typeof global.setAppKidUserSession_ === 'function') {
            global.setAppKidUserSession_(d.user);
          }
          var __kidSaved = false;
          try {
            if (typeof global.saveAppKidUserToLocal === 'function') {
              __kidSaved = global.saveAppKidUserToLocal(d.user);
            } else {
              localStorage.setItem('app_kid_user', JSON.stringify(d.user));
              __kidSaved = true;
            }
          } catch (_eSave) {}
          if (!__kidSaved) {
            console.warn("app_kid_user localStorage save failed; session fallback active");
          }
          // iPad: ログイン直後の UI 更新を fetch コールバックから切り離す
          setTimeout(function () {
            try {
              if (typeof global.showHome === 'function') {
                global.showHome(d.user);
              }
            } catch (eHome) {
              console.error("showHome failed:", eHome);
              if (msgEl) msgEl.innerText = "ホーム表示に失敗しました。ページを再読み込みしてください。";
            }
          }, 0);
          return;
        }
        if (msgEl) msgEl.innerText = d.message || "ログインに失敗しました";
        currentPin = "";
        updatePinDisplay();
      })
      .catch(function (e) {
        console.error("verifyPin failed:", e);
        if (msgEl) {
          msgEl.innerText = "通信エラーです。もういちど試すか、ページを再読み込みしてください。";
        }
        currentPin = "";
        updatePinDisplay();
      });
  }

  function preparePinReset() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('app_kid_user')); } catch (_e) {}
    if (user && user.id != null) {
      showPinScreen(user.id, user.name, true);
    }
  }

  function executePinReset() {
    var msgEl = document.getElementById('message');
    if (msgEl) msgEl.innerText = "へんこう中...";

    var gasUrl = getGasUrl();
    fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({ action: "change_pin", userId: selectedUserId, newPin: currentPin })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.status === "success") {
          setTimeout(function () {
            try { alert(d.message); } catch (_eA) {}
            var user = null;
            try { user = JSON.parse(localStorage.getItem('app_kid_user')); } catch (_e) {}
            if (typeof global.showHome === 'function') {
              global.showHome(user);
            }
          }, 0);
        } else {
          if (msgEl) msgEl.innerText = (d && d.message) || "変更に失敗しました";
          currentPin = "";
          updatePinDisplay();
        }
      })
      .catch(function () {
        if (msgEl) msgEl.innerText = "通信エラーです。もういちど試してください。";
        currentPin = "";
        updatePinDisplay();
      });
  }

  function logout() {
    if (typeof global.syncAllStopwatchesToServer === 'function') {
      try { global.syncAllStopwatchesToServer(true); } catch (_eSync) {}
    }
    if (typeof global.setAppKidUserSession_ === 'function') {
      global.setAppKidUserSession_(null);
    }
    global.englishUnitHistoryCache = {};
    global.kanjiHistoryCache = {};
    try { localStorage.removeItem('app_kid_user'); } catch (_eRem) {}
    if (global.userStore && typeof global.userStore.unsubscribeUserPoints === 'function') {
      try { global.userStore.unsubscribeUserPoints(); } catch (_eUnsub) {}
    }
    var gh = document.getElementById('global-header');
    if (gh) gh.style.display = 'none';

    if (typeof global.clearStopwatchOnLogout === 'function') {
      try { global.clearStopwatchOnLogout(); } catch (_eClear) {}
    }
    if (typeof global.switchSection === 'function') {
      global.switchSection('section-users');
    }
    fetchUsers();
  }

  // グローバル公開
  global.fetchUsers = fetchUsers;
  global.renderUsers = renderUsers;
  global.showPinScreen = showPinScreen;
  global.addPin = addPin;
  global.deletePin = deletePin;
  global.clearPin = clearPin;
  global.updatePinDisplay = updatePinDisplay;
  global.cancelPin = cancelPin;
  global.verifyPin = verifyPin;
  global.preparePinReset = preparePinReset;
  global.executePinReset = executePinReset;
  global.logout = logout;

})(typeof window !== 'undefined' ? window : this);
