/**
 * js/modules/parentAdmin.js
 * 保護者管理メニュー（PINログイン、通知メール設定、特訓メニュー管理・ルート編集・点数設定）の独立モジュール
 */
(function (global) {
  'use strict';

  let parentAdminPinSession = "";

  // 特訓メニュー管理用ステート
  let trainingAdminData = null;
  let trainingAdminEditingMenuId = null;
  let trainingAdminDraftRoutes = [];
  let trainingAdminEditingDraftIdx = null;
  let trainingAdminRoutesDirty = false;

  const DEFAULT_COLORS = ["#9C27B0", "#2196F3", "#4CAF50", "#FF9800", "#F44336", "#009688", "#E91E63", "#3F51B5", "#795548", "#607D8B", "#00BCD4", "#FFC107"];

  function getGasUrl() {
    return global.GAS_API_URL || "https://script.google.com/macros/s/AKfycbwzthKF9ZpIXPzaIY6rSXyoSN9XVrPml05KP-f-rTfYnxRqsBBzMpBxYe6NEoNcxdTA_A/exec";
  }

  function escapeHtml(str) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(str);
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function callToggleBtnLoading(btn, isLoading, origText) {
    if (typeof global.toggleBtnLoading === 'function') {
      return global.toggleBtnLoading(btn, isLoading, origText);
    }
    return '';
  }

  function callSwitchSection(secId) {
    if (typeof global.switchSection === 'function') {
      global.switchSection(secId);
    }
  }

  function syncAdminPinInputs(pin) {
    const p = String(pin || "");
    const ext = document.getElementById('external-admin-pin-input');
    const train = document.getElementById('training-admin-pin-input');
    if (ext) ext.value = p;
    if (train) train.value = p;
  }

  function openParentAdminMenu() {
    parentAdminPinSession = "";
    syncAdminPinInputs("");
    const pinPanel = document.getElementById('parent-admin-pin-panel');
    const hubPanel = document.getElementById('parent-admin-hub-panel');
    const msg = document.getElementById('parent-admin-message');
    const pinInput = document.getElementById('parent-admin-pin-input');
    if (pinInput) pinInput.value = "";
    if (pinPanel) pinPanel.style.display = "block";
    if (hubPanel) hubPanel.style.display = "none";
    if (msg) msg.innerText = "";
    callSwitchSection('section-parent-admin');
  }

  function showParentAdminHub() {
    const pinPanel = document.getElementById('parent-admin-pin-panel');
    const hubPanel = document.getElementById('parent-admin-hub-panel');
    const msg = document.getElementById('parent-admin-message');
    if (pinPanel) pinPanel.style.display = "none";
    if (hubPanel) hubPanel.style.display = "flex";
    if (msg) msg.innerText = "";
  }

  function loginParentAdmin() {
    const pinInput = document.getElementById('parent-admin-pin-input');
    const msg = document.getElementById('parent-admin-message');
    const pin = pinInput ? String(pinInput.value || "").trim() : "";
    if (!pin) {
      if (msg) msg.innerText = "PINを入力してください。";
      return;
    }
    if (msg) { msg.innerText = "確認中..."; msg.style.color = "#aaa"; }

    if (global.parentAdminStore && typeof global.parentAdminStore.verifyAdminPin === 'function') {
      global.parentAdminStore.verifyAdminPin(pin)
        .then(() => {
          parentAdminPinSession = pin;
          syncAdminPinInputs(pin);
          showParentAdminHub();
        })
        .catch(err => {
          if (msg) { msg.innerText = err.message || "PINが正しくありません"; msg.style.color = "#ff8a80"; }
        });
      return;
    }

    fetch(getGasUrl(), { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          if (msg) { msg.innerText = d.message || "PINが正しくありません"; msg.style.color = "#ff8a80"; }
          return;
        }
        parentAdminPinSession = pin;
        syncAdminPinInputs(pin);
        showParentAdminHub();
      }).catch(function () {
        if (msg) { msg.innerText = "通信エラー"; msg.style.color = "#ff8a80"; }
      });
  }

  function backToParentAdminHub() {
    if (!parentAdminPinSession) {
      openParentAdminMenu();
      return;
    }
    logoutTrainingMenuAdmin(true);
    const extMsg = document.getElementById('external-admin-message');
    const extList = document.getElementById('external-admin-list');
    const extPinPanel = document.getElementById('external-admin-pin-panel');
    if (extMsg) extMsg.innerText = "";
    if (extList) { extList.style.display = "none"; extList.innerHTML = ""; }
    if (extPinPanel) extPinPanel.style.display = "none";
    callSwitchSection('section-parent-admin');
    showParentAdminHub();
  }

  function logoutParentAdmin() {
    parentAdminPinSession = "";
    syncAdminPinInputs("");
    logoutTrainingMenuAdmin(true);
    const extMsg = document.getElementById('external-admin-message');
    const extList = document.getElementById('external-admin-list');
    const pinInput = document.getElementById('parent-admin-pin-input');
    if (extMsg) extMsg.innerText = "";
    if (extList) { extList.style.display = "none"; extList.innerHTML = ""; }
    if (pinInput) pinInput.value = "";
    openParentAdminMenu();
  }

  function enterParentAdminExternal() {
    if (!parentAdminPinSession) { openParentAdminMenu(); return; }
    syncAdminPinInputs(parentAdminPinSession);
    const extPinPanel = document.getElementById('external-admin-pin-panel');
    const extMsg = document.getElementById('external-admin-message');
    const extList = document.getElementById('external-admin-list');
    if (extPinPanel) extPinPanel.style.display = "none";
    if (extMsg) extMsg.innerText = "";
    if (extList) { extList.style.display = "none"; extList.innerHTML = ""; }
    callSwitchSection('section-external-admin');
    if (typeof global.loadExternalAdminPending === 'function') {
      global.loadExternalAdminPending();
    }
  }

  function enterParentAdminTraining() {
    if (!parentAdminPinSession) { openParentAdminMenu(); return; }
    syncAdminPinInputs(parentAdminPinSession);
    const trainPinPanel = document.getElementById('training-admin-pin-panel');
    const trainMain = document.getElementById('training-admin-main');
    if (trainPinPanel) trainPinPanel.style.display = "none";
    if (trainMain) trainMain.style.display = "none";
    closeTrainingAdminRoutePanel();
    callSwitchSection('section-training-admin');
    loadTrainingMenuAdmin();
  }

  function enterParentAdminNotify() {
    if (!parentAdminPinSession) { openParentAdminMenu(); return; }
    callSwitchSection('section-parent-admin-notify');
    loadParentNotifyEmails();
  }

  function enterParentAdminUserPoints() {
    if (!parentAdminPinSession) { openParentAdminMenu(); return; }
    callSwitchSection('section-parent-admin-points');
    loadParentAdminUserPoints();
  }

  function loadParentAdminUserPoints() {
    const container = document.getElementById('parent-admin-points-container');
    const msg = document.getElementById('parent-admin-points-message');
    if (msg) msg.innerText = "";
    if (container) container.innerHTML = '<p style="color:#aaa;text-align:center;">読み込み中...</p>';

    const onData = (users) => {
      if (!container) return;
      if (!users || !users.length) {
        container.innerHTML = '<p style="color:#aaa;text-align:center;">ユーザーが見つかりませんでした。</p>';
        return;
      }
      let html = '';
      users.forEach(u => {
        const uid = escapeHtml(String(u.id));
        const uname = escapeHtml(String(u.name || ''));
        const curPts = Number(u.points) || 0;
        html += `
          <div class="user-point-card" style="background:#222;border:1px solid #444;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;text-align:left;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
              <span style="font-size:17px;font-weight:bold;color:#fff;">👤 ${uname} <span style="font-size:12px;color:#888;">(${uid})</span></span>
              <span style="font-size:16px;color:gold;font-weight:bold;">現在: <span id="current-pts-disp-${uid}">${curPts}</span> Pt</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <input type="number" id="input-pts-${uid}" value="${curPts}" step="any" min="0" style="flex:1;min-width:120px;padding:10px;font-size:18px;border-radius:8px;border:2px solid #555;background:#1a1a1a;color:#fff;box-sizing:border-box;">
              <button type="button" class="submit-btn btn-orange" style="margin:0;padding:10px 16px;font-size:16px;white-space:nowrap;" onclick="submitUpdateUserPoint('${uid}', this)">変更を保存</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="menu-btn btn-gray" style="width:auto;margin:0;padding:4px 10px;font-size:13px;" onclick="adjustUserPointInput('${uid}', 10)">+10</button>
              <button type="button" class="menu-btn btn-gray" style="width:auto;margin:0;padding:4px 10px;font-size:13px;" onclick="adjustUserPointInput('${uid}', 50)">+50</button>
              <button type="button" class="menu-btn btn-gray" style="width:auto;margin:0;padding:4px 10px;font-size:13px;" onclick="adjustUserPointInput('${uid}', 100)">+100</button>
              <button type="button" class="menu-btn btn-gray" style="width:auto;margin:0;padding:4px 10px;font-size:13px;" onclick="adjustUserPointInput('${uid}', -10)">-10</button>
              <button type="button" class="menu-btn btn-gray" style="width:auto;margin:0;padding:4px 10px;font-size:13px;" onclick="adjustUserPointInput('${uid}', -50)">-50</button>
            </div>
            <div id="user-pt-msg-${uid}" style="font-size:13px;min-height:1.2em;"></div>
          </div>
        `;
      });
      container.innerHTML = html;
    };

    if (global.parentAdminStore && typeof global.parentAdminStore.getUsersPoints === 'function') {
      global.parentAdminStore.getUsersPoints(parentAdminPinSession)
        .then(onData)
        .catch(err => {
          if (container) container.innerHTML = '<p style="color:#ff8a80;text-align:center;">' + escapeHtml(err.message || '取得に失敗しました') + '</p>';
        });
      return;
    }

    fetch(getGasUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'get_users_points_admin', adminPin: parentAdminPinSession })
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.status === 'success') onData(d.users || []);
        else throw new Error((d && d.message) || '取得失敗');
      })
      .catch(err => {
        if (container) container.innerHTML = '<p style="color:#ff8a80;text-align:center;">' + escapeHtml(err.message || '取得に失敗しました') + '</p>';
      });
  }

  function adjustUserPointInput(userId, delta) {
    const inp = document.getElementById('input-pts-' + userId);
    if (!inp) return;
    let v = Number(inp.value) || 0;
    v = Math.max(0, Math.round((v + delta) * 100) / 100);
    inp.value = v;
  }

  function submitUpdateUserPoint(userId, btn) {
    const inp = document.getElementById('input-pts-' + userId);
    const msg = document.getElementById('user-pt-msg-' + userId);
    const disp = document.getElementById('current-pts-disp-' + userId);
    if (!inp) return;
    const newPts = Number(inp.value);
    if (isNaN(newPts) || newPts < 0) {
      if (msg) { msg.innerText = "0以上の数値を入力してください。"; msg.style.color = "#ff8a80"; }
      return;
    }
    const orig = callToggleBtnLoading(btn, true, "変更を保存");
    if (msg) { msg.innerText = "保存中..."; msg.style.color = "#aaa"; }

    const onSuccess = (res) => {
      callToggleBtnLoading(btn, false, orig);
      const finalPts = res.newPoints != null ? res.newPoints : newPts;
      if (disp) disp.innerText = String(finalPts);
      if (msg) { msg.innerText = (res && res.message) || "保存しました！"; msg.style.color = "#4CAF50"; }
      try {
        const kid = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
        if (kid && String(kid.id) === String(userId)) {
          kid.points = finalPts;
          if (typeof global.saveAppKidUserToLocal === 'function') {
            global.saveAppKidUserToLocal(kid);
          } else {
            localStorage.setItem('app_kid_user', JSON.stringify(kid));
          }
          const pEl = document.getElementById('user-points');
          if (pEl) pEl.innerText = String(kid.points);
        }
      } catch (_) {}
    };

    const onError = (err) => {
      callToggleBtnLoading(btn, false, orig);
      if (msg) { msg.innerText = err.message || "更新に失敗しました"; msg.style.color = "#ff8a80"; }
    };

    if (global.parentAdminStore && typeof global.parentAdminStore.updateUserPoints === 'function') {
      global.parentAdminStore.updateUserPoints(parentAdminPinSession, userId, newPts)
        .then(onSuccess)
        .catch(onError);
      return;
    }

    fetch(getGasUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'update_user_points_admin', adminPin: parentAdminPinSession, userId: userId, newPoints: newPts })
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.status === 'success') onSuccess(d);
        else throw new Error((d && d.message) || "更新失敗");
      })
      .catch(onError);
  }

  function enterParentAdminPiperTTS() {
    if (!parentAdminPinSession) { openParentAdminMenu(); return; }
    callSwitchSection('section-parent-admin-piper');
    if (global.PiperTtsStore && typeof global.PiperTtsStore.bindParentAdminUI === 'function') {
      global.PiperTtsStore.bindParentAdminUI();
    }
  }

  function loadParentNotifyEmails() {
    const msg = document.getElementById('parent-notify-message');
    if (msg) { msg.innerText = "読み込み中..."; msg.style.color = "#aaa"; }

    if (global.parentAdminStore && typeof global.parentAdminStore.getNotifyEmails === 'function') {
      global.parentAdminStore.getNotifyEmails(parentAdminPinSession)
        .then(emails => {
          for (let i = 1; i <= 4; i++) {
            const el = document.getElementById('parent-notify-email-' + i);
            if (el) el.value = emails[i - 1] || '';
          }
          if (msg) msg.innerText = '';
        })
        .catch(err => {
          if (msg) { msg.innerText = err.message || '読み込みに失敗しました'; msg.style.color = '#ff8a80'; }
        });
      return;
    }

    fetch(getGasUrl(), {
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

  function saveParentNotifyEmails() {
    const msg = document.getElementById('parent-notify-message');
    const emails = [];
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById('parent-notify-email-' + i);
      emails.push(el ? String(el.value || '').trim() : '');
    }
    if (msg) { msg.innerText = '保存中...'; msg.style.color = "#aaa"; }

    if (global.parentAdminStore && typeof global.parentAdminStore.saveNotifyEmails === 'function') {
      global.parentAdminStore.saveNotifyEmails(parentAdminPinSession, emails)
        .then(() => {
          if (msg) { msg.innerText = '保存しました（即時反映）'; msg.style.color = '#81C784'; }
        })
        .catch(err => {
          if (msg) { msg.innerText = err.message || '保存に失敗しました'; msg.style.color = '#ff8a80'; }
        });
      return;
    }

    fetch(getGasUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'save_parent_notify_emails', adminPin: parentAdminPinSession, emails: emails })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.status === 'success') {
        if (msg) { msg.innerText = d.message || '保存しました'; msg.style.color = '#81C784'; }
      } else {
        if (msg) { msg.innerText = d.message || '保存に失敗しました'; msg.style.color = '#ff8a80'; }
      }
    }).catch(function () {
      if (msg) { msg.innerText = '通信エラー'; msg.style.color = '#ff8a80'; }
    });
  }

  function getTrainingAdminPin() {
    const el = document.getElementById('training-admin-pin-input');
    const v = el ? String(el.value || "").trim() : "";
    return v || parentAdminPinSession || "";
  }

  function logoutTrainingMenuAdmin(skipPinPanel) {
    trainingAdminData = null;
    trainingAdminEditingMenuId = null;
    trainingAdminDraftRoutes = [];
    trainingAdminEditingDraftIdx = null;
    trainingAdminRoutesDirty = false;
    const trainMain = document.getElementById('training-admin-main');
    const trainPinPanel = document.getElementById('training-admin-pin-panel');
    const trainPinInput = document.getElementById('training-admin-pin-input');
    if (trainMain) trainMain.style.display = "none";
    if (!skipPinPanel) {
      if (trainPinPanel) trainPinPanel.style.display = "block";
      if (trainPinInput) trainPinInput.value = "";
    } else {
      if (trainPinPanel) trainPinPanel.style.display = "none";
    }
    closeTrainingAdminRoutePanel();
  }

  function setTrainingAdminMessage(text, isOk) {
    const el = document.getElementById('training-admin-message');
    if (!el) return;
    el.innerText = text || "";
    el.style.color = isOk ? "#8bc34a" : "#ff8a80";
  }

  function loadTrainingMenuAdmin() {
    const pin = getTrainingAdminPin();
    setTrainingAdminMessage("読み込み中...", true);

    if (global.parentAdminStore && typeof global.parentAdminStore.getTrainingAdminData === 'function') {
      global.parentAdminStore.getTrainingAdminData(pin)
        .then(d => {
          trainingAdminData = d;
          const pinPanel = document.getElementById('training-admin-pin-panel');
          const mainPanel = document.getElementById('training-admin-main');
          if (pinPanel) pinPanel.style.display = "none";
          if (mainPanel) mainPanel.style.display = "block";
          switchTrainingAdminTab('menus');
          renderTrainingAdminMenuGrid();
          setTrainingAdminMessage("", true);
        })
        .catch(err => {
          setTrainingAdminMessage(err.message || "エラー", false);
        });
      return;
    }

    fetch(getGasUrl(), { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          setTrainingAdminMessage(d.message || "エラー", false);
          return;
        }
        trainingAdminData = d;
        const pinPanel = document.getElementById('training-admin-pin-panel');
        const mainPanel = document.getElementById('training-admin-main');
        if (pinPanel) pinPanel.style.display = "none";
        if (mainPanel) mainPanel.style.display = "block";
        switchTrainingAdminTab('menus');
        renderTrainingAdminMenuGrid();
        setTrainingAdminMessage("", true);
      }).catch(() => setTrainingAdminMessage("通信エラー", false));
  }

  function switchTrainingAdminTab(tab) {
    const isMenus = tab === "menus";
    const tabMenus = document.getElementById('training-admin-tab-menus');
    const tabPoints = document.getElementById('training-admin-tab-points');
    const panelMenus = document.getElementById('training-admin-panel-menus');
    const panelPoints = document.getElementById('training-admin-panel-points');
    if (tabMenus) tabMenus.classList.toggle('active', isMenus);
    if (tabPoints) tabPoints.classList.toggle('active', !isMenus);
    if (panelMenus) panelMenus.style.display = isMenus ? "block" : "none";
    if (panelPoints) panelPoints.style.display = isMenus ? "none" : "block";
    if (!isMenus) renderTrainingAdminPointsForm();
  }

  function renderTrainingAdminMenuGrid() {
    const grid = document.getElementById('training-admin-menu-grid');
    if (!grid || !trainingAdminData || !Array.isArray(trainingAdminData.menus)) return;
    const colors = trainingAdminData.colorPresets || (global.TRAINING_MENU_DEFAULT_COLORS || DEFAULT_COLORS).map(function (c, i) { return { id: "c" + i, color: c }; });
    grid.innerHTML = trainingAdminData.menus.map(function (menu) {
      const colorOpts = colors.map(function (p) {
        const sel = p.color === menu.color ? " selected" : "";
        return `<option value="${escapeHtml(p.color)}"${sel}>${escapeHtml(p.color)}</option>`;
      }).join("");
      const routeCount = Array.isArray(menu.routes) ? menu.routes.length : 0;
      const sampleBadge = menu.isKanjiSample
        ? `<span style="margin-left:6px;font-size:11px;color:#CE93D8;border:1px solid #7B1FA2;border-radius:4px;padding:1px 6px;">漢字サンプル</span>`
        : (menu.isEnglishSample
          ? `<span style="margin-left:6px;font-size:11px;color:#90CAF9;border:1px solid #1976D2;border-radius:4px;padding:1px 6px;">英語サンプル</span>`
          : "");
      return `<div class="training-admin-card" style="border-left:4px solid ${escapeHtml(menu.color)};">
        <div class="training-admin-card-head">
          <span class="training-admin-color-dot" style="background:${escapeHtml(menu.color)};"></span>
          <span>メニュー ${menu.id}</span>${sampleBadge}
          <span style="margin-left:auto;font-size:12px;color:#888;">${routeCount} ステップ</span>
        </div>
        <div class="training-admin-field">
          <label>表示名</label>
          <input type="text" id="train-admin-name-${menu.id}" value="${escapeHtml(menu.displayName || "")}" placeholder="特訓メニュー${menu.id}">
        </div>
        <div class="training-admin-field">
          <label>ボタンの色</label>
          <select id="train-admin-color-${menu.id}">${colorOpts}</select>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#ccc;margin:8px 0;">
          <input type="checkbox" id="train-admin-enabled-${menu.id}" ${menu.enabled ? "checked" : ""}> 表示する（子ども画面に出す）
        </label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          <button type="button" class="submit-btn btn-green" style="margin:0;padding:8px 10px;font-size:13px;" onclick="saveTrainingAdminMenuMeta(${menu.id}, this)">設定を保存</button>
          <button type="button" class="submit-btn btn-blue" style="margin:0;padding:8px 10px;font-size:13px;" onclick="openTrainingAdminRouteEditor(${menu.id})">ルート編集</button>
        </div>
      </div>`;
    }).join("");
  }

  function saveTrainingAdminMenuMeta(menuId, btn) {
    const pin = getTrainingAdminPin();
    const nameEl = document.getElementById('train-admin-name-' + menuId);
    const colorEl = document.getElementById('train-admin-color-' + menuId);
    const enabledEl = document.getElementById('train-admin-enabled-' + menuId);
    const orig = btn ? callToggleBtnLoading(btn, true) : null;
    const stopLoading = function () {
      if (btn && btn.isConnected) callToggleBtnLoading(btn, false, orig);
    };

    if (global.parentAdminStore && typeof global.parentAdminStore.saveTrainingMenuMeta === 'function') {
      const meta = {
        displayName: nameEl ? nameEl.value : "",
        color: colorEl ? colorEl.value : "",
        enabled: !!(enabledEl && enabledEl.checked)
      };
      global.parentAdminStore.saveTrainingMenuMeta(pin, menuId, meta)
        .then(() => {
          if (trainingAdminData && Array.isArray(trainingAdminData.menus)) {
            const target = trainingAdminData.menus.find(m => m.id === menuId);
            if (target) {
              target.displayName = meta.displayName;
              target.color = meta.color;
              target.enabled = meta.enabled;
            }
          }
          if (typeof global.invalidateAppSettingsCache === 'function') global.invalidateAppSettingsCache();
          setTrainingAdminMessage("メニュー" + menuId + " の設定を保存しました", true);
          renderTrainingAdminMenuGrid();
          stopLoading();
        })
        .catch(err => {
          setTrainingAdminMessage(err.message || "エラー", false);
          stopLoading();
        });
      return;
    }

    fetch(getGasUrl(), { method: 'POST', body: JSON.stringify({
      action: "save_training_menu_meta",
      adminPin: pin,
      menuId: menuId,
      displayName: nameEl ? nameEl.value : "",
      color: colorEl ? colorEl.value : "",
      enabled: !!(enabledEl && enabledEl.checked)
    }) })
    .then(r => r.json()).then(d => {
      if (d.status !== "success") {
        setTrainingAdminMessage(d.message || "保存に失敗しました", false);
        stopLoading();
        return;
      }
      if (typeof global.invalidateAppSettingsCache === 'function') global.invalidateAppSettingsCache();
      const p = typeof global.fetchAppSettings === 'function' ? global.fetchAppSettings() : Promise.resolve();
      return p.then(function () {
        return reloadTrainingAdminData(null, "メニュー" + menuId + " の設定を保存しました");
      });
    }).catch(function () {
      setTrainingAdminMessage("通信エラー", false);
      stopLoading();
    });
  }

  function closeTrainingAdminRoutePanel() {
    trainingAdminEditingMenuId = null;
    trainingAdminDraftRoutes = [];
    trainingAdminEditingDraftIdx = null;
    trainingAdminRoutesDirty = false;
    const panel = document.getElementById('training-admin-route-panel');
    if (panel) panel.style.display = "none";
  }

  function cloneTrainingAdminDraftRoutes(routes) {
    return (routes || []).map(function (r) {
      return {
        targetUsers: String(r.targetUsers || "全員"),
        unitName: String(r.unitName || ""),
        qFormat: String(r.qFormat || ""),
        aFormat: String(r.aFormat || ""),
        mode: String(r.mode || "ランダム"),
        blankCount: r.blankCount != null ? r.blankCount : ""
      };
    });
  }

  function updateTrainingAdminAddButtonLabel() {
    const btn = document.getElementById('training-admin-route-add-btn');
    if (!btn) return;
    btn.innerText = trainingAdminEditingDraftIdx != null ? "リストに反映" : "リストに追加";
  }

  function updateTrainingAdminDraftHint() {
    const el = document.getElementById('training-admin-route-draft-hint');
    if (!el) return;
    const n = trainingAdminDraftRoutes.length;
    if (n === 0) {
      el.style.display = "none";
      el.innerText = "";
      return;
    }
    el.style.display = "block";
    el.innerText = trainingAdminRoutesDirty
      ? (n + " 件のルート（未保存の変更あり →「ルートを保存」でスプレッドシートに反映）")
      : (n + " 件のルート");
  }

  function getTrainingAdminMenuById(menuId) {
    if (!trainingAdminData || !Array.isArray(trainingAdminData.menus)) return null;
    return trainingAdminData.menus.find(function (m) { return m.id === menuId; }) || null;
  }

  function buildTrainingAdminUnitOptionsHtml(selected) {
    const sel = String(selected || "");
    let html = `<option value="">（単元を選択）</option>`;
    const mats = (trainingAdminData && trainingAdminData.materials) || [];
    mats.forEach(function (m) {
      (m.units || []).forEach(function (u) {
        const label = (m.modeName || "") + " / " + u;
        const val = String(u);
        html += `<option value="${escapeHtml(val)}"${val === sel ? " selected" : ""}>${escapeHtml(label)}</option>`;
      });
    });
    if (sel && html.indexOf('value="' + sel.replace(/"/g, "&quot;") + '"') < 0) {
      html += `<option value="${escapeHtml(sel)}" selected>${escapeHtml(sel)}（手入力）</option>`;
    }
    return html;
  }

  function renderTrainingAdminRouteList() {
    const listEl = document.getElementById('training-admin-route-list');
    if (!listEl) return;
    const routes = trainingAdminDraftRoutes || [];
    updateTrainingAdminDraftHint();
    if (!routes.length) {
      listEl.innerHTML = "<p style='color:#888;font-size:14px;margin:8px 0 0;'>ルートがまだありません。下のフォームから「リストに追加」してください。</p>";
      return;
    }
    const menuId = trainingAdminEditingMenuId;
    let rows = routes.map(function (r, idx) {
      const editingMark = trainingAdminEditingDraftIdx === idx ? " style='background:#2a1a32;'" : "";
      return `<tr${editingMark}>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.targetUsers || "全員")}</td>
        <td>${escapeHtml(r.unitName || "")}</td>
        <td>${escapeHtml(r.qFormat || "")}</td>
        <td>${escapeHtml(r.aFormat || "")}</td>
        <td>${escapeHtml(r.mode || "")}${(function () {
          const fn = global.trainingRouteLabelsToInternal;
          const isLegacy = global.isLegacyFillBlankAnswerType;
          if (typeof fn === 'function' && typeof isLegacy === 'function') {
            const p = fn(r.qFormat, r.aFormat);
            return isLegacy(p.ansType) && r.blankCount !== "" && r.blankCount != null ? "<br>隠す:" + escapeHtml(String(r.blankCount)) : "";
          }
          return "";
        })()}</td>
        <td style="white-space:nowrap;">
          <button type="button" class="submit-btn btn-blue" style="margin:0 4px 4px 0;padding:4px 8px;font-size:12px;" onclick="editTrainingAdminRoute(${menuId}, ${idx})">編集</button>
          <button type="button" class="cancel-btn" style="margin:0;padding:4px 8px;font-size:12px;" onclick="deleteTrainingAdminRoute(${menuId}, ${idx})">削除</button>
        </td>
      </tr>`;
    }).join("");
    listEl.innerHTML = `<table class="training-admin-route-table"><thead><tr><th>#</th><th>対象</th><th>単元</th><th>形式</th><th>こたえ方</th><th>出し方</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderTrainingAdminRouteForm(route) {
    const form = document.getElementById('training-admin-route-form');
    if (!form || !trainingAdminData) return;
    const r = route || {};
    const fnLabels = global.trainingRouteLabelsToInternal;
    const isLegacy = global.isLegacyFillBlankAnswerType;
    const parsed = typeof fnLabels === 'function' ? fnLabels(r.qFormat, r.aFormat) : { format: '', ansType: '' };
    const isFillBlankRoute = typeof isLegacy === 'function' ? isLegacy(parsed.ansType) : false;
    const blankDefault = isFillBlankRoute
      ? (r.blankCount != null && String(r.blankCount).trim() !== "" ? String(r.blankCount) : "1")
      : "";
    const mOpts = (trainingAdminData.modes || ["ランダム", "順番"]).map(function (m) {
      return `<option value="${escapeHtml(m)}"${m === (r.mode || "ランダム") ? " selected" : ""}>${escapeHtml(m)}</option>`;
    }).join("");
    const userOpts = [`<option value="全員"${(!r.targetUsers || r.targetUsers === "全員") ? " selected" : ""}>全員</option>`]
      .concat((trainingAdminData.childUsers || []).map(function (u) {
        const val = String(u.id);
        return `<option value="${escapeHtml(val)}"${val === String(r.targetUsers || "") ? " selected" : ""}>${escapeHtml(u.name || u.id)}</option>`;
      })).join("");
    form.innerHTML =
      `<div class="training-admin-field"><label>対象ユーザー</label><select id="train-admin-route-users">${userOpts}</select></div>` +
      `<div class="training-admin-field"><label>単元</label><select id="train-admin-route-unit">${buildTrainingAdminUnitOptionsHtml(r.unitName)}</select></div>` +
      `<div class="training-admin-route-steps">` +
      `<div class="training-admin-step-group training-admin-step-format"><h4>1. もんだいの形式</h4><select id="train-admin-route-format" class="training-admin-select"></select></div>` +
      `<div class="training-admin-step-group training-admin-step-answer"><h4>2. こたえ方</h4><select id="train-admin-route-a" class="training-admin-select"><option value="">（先に単元と形式を選んでください）</option></select><p id="train-admin-route-a-hint" class="training-admin-step-hint">単元を選ぶと、こたえ方の選択肢が表示されます。</p></div>` +
      `<div class="training-admin-step-group training-admin-step-mode"><h4>3. 出し方</h4><select id="train-admin-route-mode" class="training-admin-select">${mOpts}</select></div>` +
      `<div class="training-admin-step-group training-admin-step-mode" id="train-admin-route-blank-wrap" style="display:none;"><h4>4. 隠す文字数（穴埋め）</h4><input type="number" id="train-admin-route-blank" class="training-admin-select" min="1" max="20" value="${escapeHtml(blankDefault)}" placeholder="1以上"></div>` +
      `</div>`;
    bindTrainingAdminRouteFormEvents(parsed.format, parsed.ansType);
  }

  function bindTrainingAdminRouteFormEvents(initialFormat, initialAnsType) {
    const unitEl = document.getElementById('train-admin-route-unit');
    const formatEl = document.getElementById('train-admin-route-format');
    const ansEl = document.getElementById('train-admin-route-a');
    const blankWrap = document.getElementById('train-admin-route-blank-wrap');
    const blankEl = document.getElementById('train-admin-route-blank');
    const ansHintEl = document.getElementById('train-admin-route-a-hint');
    if (!unitEl || !formatEl || !ansEl) return;

    function setAnswerHint(text) {
      if (ansHintEl) ansHintEl.innerText = text || "";
    }

    function refreshFormatOptions(preferredFormat, preferredAns) {
      const unit = unitEl.value;
      const modeName = typeof global.getTrainingModeNameForUnit === 'function' ? global.getTrainingModeNameForUnit(unit, trainingAdminData.materials) : '';
      const category = typeof global.getTrainingCategoryForUnit === 'function' ? global.getTrainingCategoryForUnit(unit, trainingAdminData.materials) : '';
      const formats = (unit && typeof global.getLearnerFormatOptions === 'function') ? global.getLearnerFormatOptions(modeName, category) : [];
      if (!formats.length) {
        formatEl.innerHTML = `<option value="">（先に単元を選んでください）</option>`;
        ansEl.innerHTML = `<option value="">（先に単元と形式を選んでください）</option>`;
        setAnswerHint("単元を選ぶと、形式とこたえ方の選択肢が表示されます。");
        if (blankWrap) blankWrap.style.display = "none";
        return;
      }
      let selFormat = preferredFormat || formatEl.value;
      if (!formats.some(function (f) { return f.value === selFormat; })) selFormat = formats[0].value;
      formatEl.innerHTML = formats.map(function (f) {
        const sel = f.value === selFormat ? " selected" : "";
        return `<option value="${escapeHtml(f.value)}" data-qformat="${escapeHtml(f.qFormat)}"${sel}>${escapeHtml(f.label)}</option>`;
      }).join("");
      refreshAnswerOptions(preferredAns || "");
    }

    function refreshAnswerOptions(preferredAns) {
      const unit = unitEl.value;
      const format = formatEl.value;
      const modeName = typeof global.getTrainingModeNameForUnit === 'function' ? global.getTrainingModeNameForUnit(unit, trainingAdminData.materials) : '';
      const answers = (format && typeof global.getLearnerAnswerOptions === 'function') ? global.getLearnerAnswerOptions(format, modeName) : [];
      if (!format) {
        ansEl.innerHTML = `<option value="">（先に問題形式を選んでください）</option>`;
        setAnswerHint("問題形式を選ぶと、こたえ方の選択肢が表示されます。");
        updateBlankFieldVisibility();
        return;
      }
      if (!answers.length) {
        ansEl.innerHTML = `<option value="">（この形式ではこたえ方がありません）</option>`;
        setAnswerHint("この問題形式に対応するこたえ方がありません。形式を変えてください。");
        updateBlankFieldVisibility();
        return;
      }
      let selAns = preferredAns || ansEl.value;
      if (!answers.some(function (a) { return a.value === selAns; })) selAns = answers[0].value;
      ansEl.innerHTML = answers.map(function (a) {
        const sel = a.value === selAns ? " selected" : "";
        return `<option value="${escapeHtml(a.value)}" data-aformat="${escapeHtml(a.aFormat)}"${sel}>${escapeHtml(a.label)}</option>`;
      }).join("");
      setAnswerHint(answers.length + " 種類から選べます。");
      updateBlankFieldVisibility();
    }

    function updateBlankFieldVisibility() {
      const ansType = ansEl.value;
      const isLegacy = global.isLegacyFillBlankAnswerType;
      const show = typeof isLegacy === 'function' ? isLegacy(ansType) : false;
      if (blankWrap) blankWrap.style.display = show ? "block" : "none";
      if (blankEl) {
        if (!show) blankEl.value = "";
        else if (!String(blankEl.value || "").trim()) blankEl.value = "1";
      }
    }

    unitEl.onchange = function () { refreshFormatOptions("", ""); };
    formatEl.onchange = function () { refreshAnswerOptions(""); };
    ansEl.onchange = updateBlankFieldVisibility;
    refreshFormatOptions(initialFormat || "", initialAnsType || "");
  }

  function renderTrainingAdminPointsForm() {
    const form = document.getElementById('training-admin-points-form');
    if (!form) return;
    const fnCombos = global.getAllEnglishBasePointCombos;
    const combos = typeof fnCombos === 'function' ? fnCombos() : [];
    const formatMap = {};
    combos.forEach(function (c) {
      if (!formatMap[c.format]) formatMap[c.format] = c.formatLabel;
    });
    const formatItems = Object.keys(formatMap).map(function (k) { return { value: k, label: formatMap[k] }; });
    form.innerHTML =
      `<div class="training-admin-field"><label>1. もんだいの形式</label><select id="train-admin-point-format" class="large-select"></select></div>` +
      `<div class="training-admin-field"><label>2. こたえ方</label><select id="train-admin-point-answer" class="large-select"></select></div>` +
      `<div class="training-admin-field"><label>3. モード</label><select id="train-admin-point-mode" class="large-select"><option value="word">単語モード（単語列）</option><option value="expression">表現モード（表現列）</option></select></div>` +
      `<div class="training-admin-field"><label>基本ポイント（1問あたり）</label><input type="number" id="train-admin-point-value" min="0" max="999" step="1" value="20"></div>` +
      `<div id="train-admin-point-key" class="training-admin-points-key"></div>`;
    const formatEl = document.getElementById('train-admin-point-format');
    const ansEl = document.getElementById('train-admin-point-answer');
    const modeEl = document.getElementById('train-admin-point-mode');
    const valueEl = document.getElementById('train-admin-point-value');
    const keyEl = document.getElementById('train-admin-point-key');
    const settings = (trainingAdminData && trainingAdminData.basePointSettings) || {};

    function readPointForSelection(key, modeCategory) {
      if (!key) return null;
      const raw = settings[key];
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        const v = modeCategory === "expression" ? raw.expression : raw.word;
        if (v != null && String(v).trim() !== "") return String(v);
      } else if (raw != null && String(raw).trim() !== "") {
        return String(raw);
      }
      return null;
    }

    function refreshAnswerOptions() {
      const format = formatEl.value;
      const modeCategory = modeEl ? modeEl.value : "word";
      const answers = combos.filter(function (c) {
        return c.format === format && c.modeCategory === modeCategory;
      });
      ansEl.innerHTML = answers.map(function (a, idx) {
        return `<option value="${escapeHtml(a.ansType)}" data-key="${escapeHtml(a.settingKey)}" data-mode="${escapeHtml(a.modeCategory)}"${idx === 0 ? " selected" : ""}>${escapeHtml(a.ansLabel)}</option>`;
      }).join("");
      syncPointValueFromSelection();
    }

    function syncPointValueFromSelection() {
      const opt = ansEl.options[ansEl.selectedIndex];
      const key = opt ? opt.getAttribute('data-key') : "";
      const modeCategory = modeEl ? modeEl.value : "word";
      const modeLabel = modeCategory === "expression" ? "表現列" : "単語列";
      if (keyEl) keyEl.innerText = key ? ("設定キー: " + key + " / " + modeLabel) : "";
      const stored = readPointForSelection(key, modeCategory);
      if (stored != null && valueEl) valueEl.value = stored;
    }

    formatEl.innerHTML = formatItems.map(function (f, idx) {
      return `<option value="${escapeHtml(f.value)}"${idx === 0 ? " selected" : ""}>${escapeHtml(f.label)}</option>`;
    }).join("");
    formatEl.onchange = refreshAnswerOptions;
    if (modeEl) modeEl.onchange = refreshAnswerOptions;
    ansEl.onchange = syncPointValueFromSelection;
    refreshAnswerOptions();
  }

  function saveTrainingAdminBasePoint(btn) {
    const formatEl = document.getElementById('train-admin-point-format');
    const ansEl = document.getElementById('train-admin-point-answer');
    const modeEl = document.getElementById('train-admin-point-mode');
    const valueEl = document.getElementById('train-admin-point-value');
    if (!formatEl || !ansEl || !valueEl) return;
    const opt = ansEl.options[ansEl.selectedIndex];
    const settingKey = opt ? opt.getAttribute('data-key') : "";
    const modeCategory = modeEl ? modeEl.value : "word";
    const pointValue = valueEl.value;
    if (!settingKey) {
      setTrainingAdminMessage("形式とこたえ方を選んでください", false);
      return;
    }
    const pin = getTrainingAdminPin();
    const saveBtn = btn || document.getElementById('training-admin-point-save-btn');
    const orig = saveBtn ? callToggleBtnLoading(saveBtn, true) : null;

    if (global.parentAdminStore && typeof global.parentAdminStore.saveTrainingBasePoint === 'function') {
      global.parentAdminStore.saveTrainingBasePoint(pin, settingKey, modeCategory, pointValue)
        .then(() => {
          if (!trainingAdminData.basePointSettings) trainingAdminData.basePointSettings = {};
          const prev = trainingAdminData.basePointSettings[settingKey];
          if (prev != null && typeof prev === "object" && !Array.isArray(prev)) {
            if (modeCategory === "expression") prev.expression = pointValue;
            else prev.word = pointValue;
          } else {
            trainingAdminData.basePointSettings[settingKey] = modeCategory === "expression"
              ? { word: prev != null ? prev : "", expression: pointValue }
              : { word: pointValue, expression: "" };
          }
          if (typeof global.invalidateAppSettingsCache === 'function') global.invalidateAppSettingsCache();
          const modeLabel = modeCategory === "expression" ? "表現" : "単語";
          setTrainingAdminMessage("点数を保存しました（" + settingKey + " / " + modeLabel + " = " + pointValue + "）", true);
        })
        .catch(function (err) { setTrainingAdminMessage(err.message || "エラー", false); })
        .finally(function () {
          if (saveBtn && saveBtn.isConnected) callToggleBtnLoading(saveBtn, false, orig);
        });
      return;
    }

    fetch(getGasUrl(), { method: 'POST', body: JSON.stringify({
      action: "save_training_base_point",
      adminPin: pin,
      settingKey: settingKey,
      modeCategory: modeCategory,
      value: pointValue
    }) })
    .then(r => r.json()).then(d => {
      if (d.status !== "success") {
        setTrainingAdminMessage(d.message || "保存に失敗しました", false);
        return;
      }
      if (!trainingAdminData.basePointSettings) trainingAdminData.basePointSettings = {};
      const prev = trainingAdminData.basePointSettings[settingKey];
      if (prev != null && typeof prev === "object" && !Array.isArray(prev)) {
        if (modeCategory === "expression") prev.expression = pointValue;
        else prev.word = pointValue;
      } else {
        trainingAdminData.basePointSettings[settingKey] = modeCategory === "expression"
          ? { word: prev != null ? prev : "", expression: pointValue }
          : { word: pointValue, expression: "" };
      }
      if (typeof global.invalidateAppSettingsCache === 'function') global.invalidateAppSettingsCache();
      const modeLabel = modeCategory === "expression" ? "表現" : "単語";
      setTrainingAdminMessage("点数を保存しました（" + settingKey + " / " + modeLabel + " = " + pointValue + "）", true);
    }).catch(function () { setTrainingAdminMessage("通信エラー", false); })
    .finally(function () {
      if (saveBtn && saveBtn.isConnected) callToggleBtnLoading(saveBtn, false, orig);
    });
  }

  function openTrainingAdminRouteEditor(menuId) {
    const menu = getTrainingAdminMenuById(menuId);
    if (!menu) return;
    trainingAdminEditingMenuId = menuId;
    trainingAdminDraftRoutes = cloneTrainingAdminDraftRoutes(menu.routes);
    trainingAdminEditingDraftIdx = null;
    trainingAdminRoutesDirty = false;
    const panel = document.getElementById('training-admin-route-panel');
    const title = document.getElementById('training-admin-route-title');
    if (title) title.innerText = "メニュー" + menuId + " のルート編集";
    renderTrainingAdminRouteList();
    renderTrainingAdminRouteForm(null);
    updateTrainingAdminAddButtonLabel();
    if (panel) {
      panel.style.display = "block";
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function editTrainingAdminRoute(menuId, draftIdx) {
    if (trainingAdminEditingMenuId !== menuId) return;
    const route = trainingAdminDraftRoutes[draftIdx];
    if (!route) return;
    trainingAdminEditingDraftIdx = draftIdx;
    renderTrainingAdminRouteForm(route);
    updateTrainingAdminAddButtonLabel();
    renderTrainingAdminRouteList();
    setTrainingAdminMessage("リスト " + (draftIdx + 1) + " 番を編集しています（反映するには「リストに反映」）", true);
  }

  function resetTrainingAdminRouteForm() {
    trainingAdminEditingDraftIdx = null;
    renderTrainingAdminRouteForm(null);
    updateTrainingAdminAddButtonLabel();
    renderTrainingAdminRouteList();
    setTrainingAdminMessage("入力をクリアしました", true);
  }

  function readTrainingAdminRouteFormPayload() {
    const unitName = (document.getElementById('train-admin-route-unit') || {}).value || "";
    const formatEl = document.getElementById('train-admin-route-format');
    const ansEl = document.getElementById('train-admin-route-a');
    const formatOpt = formatEl && formatEl.options[formatEl.selectedIndex];
    const ansOpt = ansEl && ansEl.options[ansEl.selectedIndex];
    const qFormat = formatOpt ? (formatOpt.getAttribute('data-qformat') || "") : "";
    const aFormat = ansOpt ? (ansOpt.getAttribute('data-aformat') || "") : "";
    const ansType = ansEl ? ansEl.value : "";
    const blankEl = document.getElementById('train-admin-route-blank');
    const isLegacy = global.isLegacyFillBlankAnswerType;
    const isFillBlank = typeof isLegacy === 'function' ? isLegacy(ansType) : false;
    const payload = {
      targetUsers: (document.getElementById('train-admin-route-users') || {}).value || "全員",
      unitName: unitName,
      qFormat: qFormat,
      aFormat: aFormat,
      mode: (document.getElementById('train-admin-route-mode') || {}).value || "ランダム",
      blankCount: isFillBlank && blankEl ? (blankEl.value || "") : ""
    };
    if (!payload.unitName || !payload.qFormat || !payload.aFormat) {
      setTrainingAdminMessage("単元・問題形式・こたえ方を選んでください", false);
      return null;
    }
    const isValidCombo = global.isValidTrainingRouteCombo;
    if (typeof isValidCombo === 'function' && !isValidCombo(payload.unitName, payload.qFormat, payload.aFormat, trainingAdminData.materials)) {
      setTrainingAdminMessage("選んだ組み合わせはこの単元では使えません。形式とこたえ方を確認してください", false);
      return null;
    }
    if (isFillBlank && (!payload.blankCount || Number(payload.blankCount) < 1)) {
      setTrainingAdminMessage("穴埋めのときは「隠す文字数」を1以上で入力してください", false);
      return null;
    }
    return payload;
  }

  function addTrainingAdminRouteToDraft() {
    if (!trainingAdminEditingMenuId) return;
    const payload = readTrainingAdminRouteFormPayload();
    if (!payload) return;
    if (trainingAdminEditingDraftIdx != null) {
      trainingAdminDraftRoutes[trainingAdminEditingDraftIdx] = payload;
      setTrainingAdminMessage("リスト " + (trainingAdminEditingDraftIdx + 1) + " 番を更新しました（まだ未保存）", true);
      trainingAdminEditingDraftIdx = null;
    } else {
      trainingAdminDraftRoutes.push(payload);
      setTrainingAdminMessage("リストに追加しました（あと " + (trainingAdminDraftRoutes.length) + " 件・「ルートを保存」で反映）", true);
    }
    trainingAdminRoutesDirty = true;
    updateTrainingAdminAddButtonLabel();
    renderTrainingAdminRouteList();
  }

  function reloadTrainingAdminData(menuIdToReopen, successMsg, keepForm) {
    const pin = getTrainingAdminPin();

    const applyData = function (d) {
      trainingAdminData = d;
      renderTrainingAdminMenuGrid();
      if (menuIdToReopen) {
        const menu = getTrainingAdminMenuById(menuIdToReopen);
        trainingAdminEditingMenuId = menuIdToReopen;
        trainingAdminDraftRoutes = cloneTrainingAdminDraftRoutes(menu ? menu.routes : []);
        trainingAdminEditingDraftIdx = null;
        trainingAdminRoutesDirty = false;
        const panel = document.getElementById('training-admin-route-panel');
        const title = document.getElementById('training-admin-route-title');
        if (title) title.innerText = "メニュー" + menuIdToReopen + " のルート編集";
        if (panel) panel.style.display = "block";
        renderTrainingAdminRouteList();
        updateTrainingAdminAddButtonLabel();
        if (!keepForm) {
          renderTrainingAdminRouteForm(null);
        }
      }
      if (successMsg) setTrainingAdminMessage(successMsg, true);
      return d;
    };

    if (global.parentAdminStore && typeof global.parentAdminStore.getTrainingAdminData === 'function') {
      return global.parentAdminStore.getTrainingAdminData(pin).then(applyData);
    }

    return fetch(getGasUrl(), { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") throw new Error(d.message || "再読み込み失敗");
        return applyData(d);
      });
  }

  function saveTrainingAdminRoutesBatch() {
    if (!trainingAdminEditingMenuId) return;
    const menuId = trainingAdminEditingMenuId;
    const pin = getTrainingAdminPin();
    const btn = document.getElementById('training-admin-route-save-btn');
    const orig = btn ? callToggleBtnLoading(btn, true) : null;

    if (global.parentAdminStore && typeof global.parentAdminStore.saveTrainingRoutesBatch === 'function') {
      global.parentAdminStore.saveTrainingRoutesBatch(pin, menuId, trainingAdminDraftRoutes)
        .then(function (res) {
          if (trainingAdminData && Array.isArray(trainingAdminData.menus)) {
            const target = trainingAdminData.menus.find(function (m) { return m && m.id === menuId; });
            if (target) {
              target.routes = cloneTrainingAdminDraftRoutes(trainingAdminDraftRoutes);
            }
          }
          trainingAdminRoutesDirty = false;
          if (typeof global.invalidateTrainingRouteCache === 'function') global.invalidateTrainingRouteCache(menuId);
          renderTrainingAdminRouteList();
          renderTrainingAdminMenuGrid();
          setTrainingAdminMessage("ルートを保存しました（" + (res.count || trainingAdminDraftRoutes.length) + " 件）", true);
        })
        .catch(function (e) { setTrainingAdminMessage(e.message || "エラー", false); })
        .finally(function () {
          if (btn && btn.isConnected) callToggleBtnLoading(btn, false, orig);
        });
      return;
    }

    fetch(getGasUrl(), { method: 'POST', body: JSON.stringify({
      action: "save_training_menu_routes_batch",
      adminPin: pin,
      menuId: menuId,
      routes: trainingAdminDraftRoutes
    }) })
    .then(r => r.json()).then(d => {
      if (d.status !== "success") {
        setTrainingAdminMessage(d.message || "保存に失敗しました", false);
        return;
      }
      if (typeof global.invalidateTrainingRouteCache === 'function') global.invalidateTrainingRouteCache(menuId);
      return reloadTrainingAdminData(menuId, d.message || "ルートを保存しました", true);
    }).catch(function (e) { setTrainingAdminMessage(e.message || "通信エラー", false); })
    .finally(function () {
      if (btn && btn.isConnected) callToggleBtnLoading(btn, false, orig);
    });
  }

  function deleteTrainingAdminRoute(menuId, draftIdx) {
    if (trainingAdminEditingMenuId !== menuId) return;
    if (!confirm("リスト " + (draftIdx + 1) + " 番を削除しますか？（「ルートを保存」するまでスプレッドシートは変わりません）")) return;
    trainingAdminDraftRoutes.splice(draftIdx, 1);
    if (trainingAdminEditingDraftIdx === draftIdx) {
      trainingAdminEditingDraftIdx = null;
      updateTrainingAdminAddButtonLabel();
    } else if (trainingAdminEditingDraftIdx != null && trainingAdminEditingDraftIdx > draftIdx) {
      trainingAdminEditingDraftIdx -= 1;
    }
    trainingAdminRoutesDirty = true;
    renderTrainingAdminRouteList();
    setTrainingAdminMessage("リストから削除しました（「ルートを保存」で反映）", true);
  }

  function openExternalAdminApproval() { openParentAdminMenu(); }
  function openTrainingMenuAdmin() { openParentAdminMenu(); }

  // グローバル公開
  global.openParentAdminMenu = openParentAdminMenu;
  global.showParentAdminHub = showParentAdminHub;
  global.loginParentAdmin = loginParentAdmin;
  global.backToParentAdminHub = backToParentAdminHub;
  global.logoutParentAdmin = logoutParentAdmin;
  global.enterParentAdminExternal = enterParentAdminExternal;
  global.enterParentAdminTraining = enterParentAdminTraining;
  global.enterParentAdminNotify = enterParentAdminNotify;
  global.enterParentAdminUserPoints = enterParentAdminUserPoints;
  global.loadParentAdminUserPoints = loadParentAdminUserPoints;
  global.adjustUserPointInput = adjustUserPointInput;
  global.submitUpdateUserPoint = submitUpdateUserPoint;
  global.enterParentAdminPiperTTS = enterParentAdminPiperTTS;
  global.loadParentNotifyEmails = loadParentNotifyEmails;
  global.saveParentNotifyEmails = saveParentNotifyEmails;
  global.openExternalAdminApproval = openExternalAdminApproval;
  global.openTrainingMenuAdmin = openTrainingMenuAdmin;
  global.loadTrainingMenuAdmin = loadTrainingMenuAdmin;
  global.switchTrainingAdminTab = switchTrainingAdminTab;
  global.renderTrainingAdminMenuGrid = renderTrainingAdminMenuGrid;
  global.saveTrainingAdminMenuMeta = saveTrainingAdminMenuMeta;
  global.closeTrainingAdminRoutePanel = closeTrainingAdminRoutePanel;
  global.openTrainingAdminRouteEditor = openTrainingAdminRouteEditor;
  global.editTrainingAdminRoute = editTrainingAdminRoute;
  global.resetTrainingAdminRouteForm = resetTrainingAdminRouteForm;
  global.addTrainingAdminRouteToDraft = addTrainingAdminRouteToDraft;
  global.saveTrainingAdminRoutesBatch = saveTrainingAdminRoutesBatch;
  global.saveTrainingAdminBasePoint = saveTrainingAdminBasePoint;
  global.deleteTrainingAdminRoute = deleteTrainingAdminRoute;

})(window);
