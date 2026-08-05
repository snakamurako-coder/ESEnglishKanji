    function fetchUsers() {
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_child_users" }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.status === "success") renderUsers(d.users); })
        .catch(function () {
          const msg = document.getElementById('message');
          if (msg) msg.innerText = "ユーザー一覧の取得に失敗しました。通信を確認してください。";
        });
    }
    function renderUsers(users) { const c = document.getElementById('user-container'); c.innerHTML = ""; users.forEach(u => { const div = document.createElement('div'); div.className = 'user-card'; div.onclick = () => showPinScreen(u.id, u.name, false); div.innerHTML = `<div class="user-icon">${u.name.charAt(0)}</div><div>${u.name}</div>`; c.appendChild(div); }); }
    function showPinScreen(id, name, isReset) { selectedUserId = id; isPinResetMode = isReset; currentPin = ""; updatePinDisplay(); document.getElementById('selected-user-name').innerText = name; document.getElementById('pin-instruction').innerText = isReset ? "あたらしい暗証番号（4ケタ）" : "あんしょうばんごう（4ケタ）"; switchSection('section-pin'); }
    function addPin(num) { if(currentPin.length<4){ currentPin+=num; updatePinDisplay(); if(currentPin.length===4) { if(isPinResetMode) executePinReset(); else verifyPin(); } } }
    function deletePin() { currentPin = currentPin.slice(0,-1); updatePinDisplay(); }
    function clearPin() { currentPin = ""; updatePinDisplay(); }
    function updatePinDisplay() { let d=""; for(let i=0;i<4;i++) d+=(i<currentPin.length)?"● ":"_ "; document.getElementById('pin-dots').innerText=d.trim(); }
    function cancelPin() { if(isPinResetMode) showHome(JSON.parse(localStorage.getItem('app_kid_user'))); else switchSection('section-users'); }
    function verifyPin() {
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.innerText = "かくにん中...";
      fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "verify_kid_pin", userId: selectedUserId, pin: currentPin })
      })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; }); })
        .then(function (res) {
          var d = null;
          try { d = JSON.parse(res.text); } catch (_eParse) { d = null; }
          if (!d || typeof d !== "object") {
            throw new Error("サーバー応答が不正です (HTTP " + res.status + ")");
          }
          if (d.status === "success" && d.user) {
            try { saveAppKidUserToLocal(d.user); } catch (_eSave) {}
            // iPad: ログイン直後の UI 更新を fetch コールバックから切り離す
            setTimeout(function () {
              try { showHome(d.user); } catch (eHome) {
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
    function preparePinReset() { const user = JSON.parse(localStorage.getItem('app_kid_user')); showPinScreen(user.id, user.name, true); }
    function executePinReset() {
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.innerText = "へんこう中...";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "change_pin", userId: selectedUserId, newPin: currentPin }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === "success") {
            setTimeout(function () {
              try { alert(d.message); } catch (_eA) {}
              showHome(JSON.parse(localStorage.getItem('app_kid_user')));
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
      syncAllStopwatchesToServer(true);
      englishUnitHistoryCache = {};
      kanjiHistoryCache = {};
      localStorage.removeItem('app_kid_user');
      document.body.classList.remove('kanji-study-mode');
      document.getElementById('global-header').style.display = 'none';
      activeRewardTicket_ = null;
      if (rewardCountdownTimerId_) {
        clearInterval(rewardCountdownTimerId_);
        rewardCountdownTimerId_ = null;
      }
      ['home', 'external'].forEach(function (target) {
        const st = stopwatches[target];
        if (!st) return;
        if (st.timerId) {
          clearInterval(st.timerId);
          st.timerId = null;
        }
        st.running = false;
        st.startAt = 0;
        st.elapsed = 0;
      });
      switchSection('section-users');
      fetchUsers();
    }

    // ★ 特訓ルートの読み込み処理を追加
    function logoutParentAdmin() {
      parentAdminPinSession = "";
      syncAdminPinInputs("");
      logoutTrainingMenuAdmin(true);
      document.getElementById('external-admin-message').innerText = "";
      document.getElementById('external-admin-list').style.display = "none";
      document.getElementById('external-admin-list').innerHTML = "";
      const pinInput = document.getElementById('parent-admin-pin-input');
      if (pinInput) pinInput.value = "";
      openParentAdminMenu();
    }

    function enterParentAdminExternal() {
      if (!parentAdminPinSession) { openParentAdminMenu(); return; }
      syncAdminPinInputs(parentAdminPinSession);
      document.getElementById('external-admin-pin-panel').style.display = "none";
      document.getElementById('external-admin-message').innerText = "";
      document.getElementById('external-admin-list').style.display = "none";
      document.getElementById('external-admin-list').innerHTML = "";
      switchSection('section-external-admin');
      loadExternalAdminPending();
    }

    function enterParentAdminTraining() {
      if (!parentAdminPinSession) { openParentAdminMenu(); return; }
      syncAdminPinInputs(parentAdminPinSession);
      document.getElementById('training-admin-pin-panel').style.display = "none";
      document.getElementById('training-admin-main').style.display = "none";
      closeTrainingAdminRoutePanel();
      switchSection('section-training-admin');
      loadTrainingMenuAdmin();
    }

    function enterParentAdminNotify() {
      if (!parentAdminPinSession) { openParentAdminMenu(); return; }
      switchSection('section-parent-admin-notify');
      loadParentNotifyEmails();
    }

    function loadParentNotifyEmails() {
      const msg = document.getElementById('parent-notify-message');
      if (msg) { msg.innerText = "読み込み中..."; msg.style.color = "#aaa"; }
      fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_parent_notify_emails', adminPin: parentAdminPinSession })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.status !== 'success') {
          if (msg) { msg.innerText = d.message || '読み込みに失敗しました'; msg.style.color = '#ff8a80'; }
          return;
        }
        const emails = d.emails || [];
        for (let i = 1; i <= 4; i++) {
          const el = document.getElementById('parent-notify-email-' + i);
          if (el) el.value = emails[i - 1] || '';
        }
        if (msg) msg.innerText = '';
      }).catch(function () {
        if (msg) { msg.innerText = '通信エラー'; msg.style.color = '#ff8a80'; }
      });
    }

    function logoutTrainingMenuAdmin(skipPinPanel) {
      trainingAdminData = null;
      trainingAdminEditingMenuId = null;
      trainingAdminDraftRoutes = [];
      trainingAdminEditingDraftIdx = null;
      trainingAdminRoutesDirty = false;
      document.getElementById('training-admin-main').style.display = "none";
      if (!skipPinPanel) {
        document.getElementById('training-admin-pin-panel').style.display = "block";
        document.getElementById('training-admin-pin-input').value = "";
      } else {
        document.getElementById('training-admin-pin-panel').style.display = "none";
      }
      closeTrainingAdminRoutePanel();
    }

    function setTrainingAdminMessage(text, isOk) {
      const el = document.getElementById('training-admin-message');
      if (!el) return;
      el.innerText = text || "";
      el.style.color = isOk ? "#8bc34a" : "#ff8a80";
    }
