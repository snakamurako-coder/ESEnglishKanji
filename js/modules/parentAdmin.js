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
    if (!btn) return '';
    if (isLoading) {
      const text = btn.innerHTML;
      btn.innerHTML = '⏳ よみこみ中...';
      btn.classList.add('btn-loading');
      return text;
    } else {
      btn.innerHTML = origText || '';
      btn.classList.remove('btn-loading');
    }
    return '';
  }

  function callSwitchSection(secId) {
    if (typeof global.switchSection === 'function') {
      global.switchSection(secId);
    }
  }

  function switchParentAdminSection(secId) {
    if (!parentAdminPinSession) {
      openParentAdminMenu();
      return false;
    }
    callSwitchSection(secId);
    return true;
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
    global.parentAdminPinSession = "";
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
          global.parentAdminPinSession = pin;
          syncAdminPinInputs(pin);
          showParentAdminHub();
        })
        .catch(err => {
          if (msg) { msg.innerText = err.message || "PINが正しくありません"; msg.style.color = "#ff8a80"; }
        });
      return;
    }

    if (msg) { msg.innerText = "管理機能が初期化されていません"; msg.style.color = "#ff8a80"; }
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
    global.parentAdminPinSession = "";
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

    if (container) container.innerHTML = '<p style="color:#ff8a80;text-align:center;">管理機能が初期化されていません</p>';
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

    onError(new Error("管理機能が初期化されていません"));
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

    if (msg) { msg.innerText = '管理機能が初期化されていません'; msg.style.color = '#ff8a80'; }
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

    if (msg) { msg.innerText = '管理機能が初期化されていません'; msg.style.color = '#ff8a80'; }
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

    setTrainingAdminMessage("管理機能が初期化されていません", false);
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

    setTrainingAdminMessage("管理機能が初期化されていません", false);
    stopLoading();
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

    setTrainingAdminMessage("管理機能が初期化されていません", false);
    if (saveBtn && saveBtn.isConnected) callToggleBtnLoading(saveBtn, false, orig);
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

    return Promise.reject(new Error("管理機能が初期化されていません"));
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

    setTrainingAdminMessage("管理機能が初期化されていません", false);
    if (btn && btn.isConnected) callToggleBtnLoading(btn, false, orig);
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

  // ========================================================================
  // 1. 👥 ユーザー管理 (Users CRUD)
  // ========================================================================
  let cachedAdminUsers = [];

  function enterParentAdminUsers() {
    if (!switchParentAdminSection('section-parent-admin-users')) return;
    loadParentAdminUsers();
  }

  function loadParentAdminUsers() {
    const pin = getTrainingAdminPin();
    const container = document.getElementById('parent-admin-users-list');
    const msg = document.getElementById('parent-admin-users-msg');
    if (msg) msg.innerText = "";
    if (container) container.innerHTML = `<p style="color:#aaa;text-align:center;">読み込み中...</p>`;

    if (!global.parentAdminStore || typeof global.parentAdminStore.getUsersList !== 'function') {
      if (container) container.innerHTML = `<p style="color:#ff8a80;text-align:center;">ストア未対応</p>`;
      return;
    }

    global.parentAdminStore.getUsersList(pin).then(function (users) {
      cachedAdminUsers = users || [];
      renderAdminUsersList();
    }).catch(function (err) {
      if (container) container.innerHTML = `<p style="color:#ff8a80;text-align:center;">読み込み失敗: ${escapeHtml(err.message)}</p>`;
    });
  }

  function renderAdminUsersList() {
    const container = document.getElementById('parent-admin-users-list');
    if (!container) return;
    if (!cachedAdminUsers || cachedAdminUsers.length === 0) {
      container.innerHTML = `<p style="color:#888;text-align:center;">登録されているユーザーはいません</p>`;
      return;
    }

    container.innerHTML = cachedAdminUsers.map(function (u) {
      const isKid = String(u.id).indexOf("user_") === 0;
      const avatar = isKid ? "👦" : "👤";
      return `<div style="background:#252538;border:1px solid #3d3d5c;border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">${avatar}</span>
          <div>
            <div style="font-weight:bold;color:#fff;font-size:15px;">${escapeHtml(u.name || "名称未設定")} <span style="font-size:12px;color:#888;">(${escapeHtml(u.id)})</span></div>
            <div style="font-size:12px;color:#bbb;">PIN: <b style="color:#ffd54f;">${escapeHtml(u.pin || "----")}</b> ｜ 現在Pt: <b style="color:#4caf50;">${Number(u.points || 0).toLocaleString()} Pt</b></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="submit-btn btn-blue" style="margin:0;padding:6px 10px;font-size:12px;" onclick="openEditUserModal('${escapeHtml(u.id)}')">✏️ 編集</button>
          <button type="button" class="submit-btn btn-red" style="margin:0;padding:6px 10px;font-size:12px;background:#c62828;" onclick="deleteUserConfirm('${escapeHtml(u.id)}', '${escapeHtml(u.name || "")}')">🗑️ 削除</button>
        </div>
      </div>`;
    }).join("");
  }

  function openCreateUserModal() {
    const modal = document.getElementById('modal-admin-user-create');
    if (modal) modal.style.display = "flex";
    const idInput = document.getElementById('new-user-id');
    const nameInput = document.getElementById('new-user-name');
    const pinInput = document.getElementById('new-user-pin');
    const ptsInput = document.getElementById('new-user-points');
    // 自動で user_{連番} を提案
    let maxNum = 0;
    (cachedAdminUsers || []).forEach(function (u) {
      const m = String(u.id).match(/^user_(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
    if (idInput) idInput.value = "user_" + (maxNum + 1);
    if (nameInput) nameInput.value = "";
    if (pinInput) pinInput.value = "1234";
    if (ptsInput) ptsInput.value = "0";
  }

  function closeCreateUserModal() {
    const modal = document.getElementById('modal-admin-user-create');
    if (modal) modal.style.display = "none";
  }

  function submitCreateUser() {
    const pin = getTrainingAdminPin();
    const id = (document.getElementById('new-user-id').value || "").trim();
    const name = (document.getElementById('new-user-name').value || "").trim();
    const userPin = (document.getElementById('new-user-pin').value || "").trim();
    const points = Number(document.getElementById('new-user-points').value) || 0;
    if (!id || !name) { alert("IDと名前を入力してください"); return; }

    global.parentAdminStore.createUser(pin, { id: id, name: name, pin: userPin, points: points })
      .then(function () {
        closeCreateUserModal();
        loadParentAdminUsers();
      })
      .catch(function (err) { alert("追加失敗: " + err.message); });
  }

  function openEditUserModal(userId) {
    const u = (cachedAdminUsers || []).find(function (x) { return x.id === userId; });
    if (!u) return;
    const modal = document.getElementById('modal-admin-user-edit');
    if (modal) modal.style.display = "flex";
    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-name').value = u.name || "";
    document.getElementById('edit-user-pin').value = u.pin || "";
  }

  function closeEditUserModal() {
    const modal = document.getElementById('modal-admin-user-edit');
    if (modal) modal.style.display = "none";
  }

  function submitEditUser() {
    const pin = getTrainingAdminPin();
    const id = document.getElementById('edit-user-id').value;
    const name = (document.getElementById('edit-user-name').value || "").trim();
    const userPin = (document.getElementById('edit-user-pin').value || "").trim();
    if (!name) { alert("名前を入力してください"); return; }

    global.parentAdminStore.updateUserProfile(pin, id, { name: name, pin: userPin })
      .then(function () {
        closeEditUserModal();
        loadParentAdminUsers();
      })
      .catch(function (err) { alert("保存失敗: " + err.message); });
  }

  function deleteUserConfirm(userId, userName) {
    if (!confirm(`ユーザー「${userName} (${userId})」を本当に削除しますか？\n（この操作は元に戻せません）`)) return;
    const pin = getTrainingAdminPin();
    global.parentAdminStore.deleteUser(pin, userId)
      .then(function () { loadParentAdminUsers(); })
      .catch(function (err) { alert("削除失敗: " + err.message); });
  }

  // ========================================================================
  // 2. 🎁 ご褒美マスター管理 (Rewards CRUD)
  // ========================================================================
  let cachedRewards = [];

  function enterParentAdminRewards() {
    if (!switchParentAdminSection('section-parent-admin-rewards')) return;
    loadParentAdminRewards();
  }

  function loadParentAdminRewards() {
    const pin = getTrainingAdminPin();
    const container = document.getElementById('parent-admin-rewards-list');
    if (container) container.innerHTML = `<p style="color:#aaa;text-align:center;">読み込み中...</p>`;

    global.parentAdminStore.getRewardsMaster(pin).then(function (list) {
      cachedRewards = list || [];
      renderAdminRewardsList();
    }).catch(function (err) {
      if (container) container.innerHTML = `<p style="color:#ff8a80;text-align:center;">読み込み失敗: ${escapeHtml(err.message)}</p>`;
    });
  }

  function renderAdminRewardsList() {
    const container = document.getElementById('parent-admin-rewards-list');
    if (!container) return;
    if (!cachedRewards || cachedRewards.length === 0) {
      container.innerHTML = `<p style="color:#888;text-align:center;">登録されているご褒美はありません</p>`;
      return;
    }

    container.innerHTML = cachedRewards.map(function (r) {
      const timeStr = r.timeMinutes ? `⏱️ 制限時間 ${r.timeMinutes}分` : `（時間制限なし）`;
      return `<div style="background:#252538;border:1px solid #3d3d5c;border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">${escapeHtml(r.icon || "🎁")}</span>
          <div>
            <div style="font-weight:bold;color:#fff;font-size:15px;">
              ${escapeHtml(r.name)}
              <span style="margin-left:8px;font-size:12px;background:#388e3c;color:#fff;padding:2px 8px;border-radius:10px;">${Number(r.points).toLocaleString()} Pt</span>
            </div>
            <div style="font-size:12px;color:#aaa;margin-top:2px;">${escapeHtml(r.desc || "")} ｜ ${timeStr}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="submit-btn btn-blue" style="margin:0;padding:6px 10px;font-size:12px;" onclick="openRewardModal('${escapeHtml(r.id)}')">✏️ 編集</button>
          <button type="button" class="submit-btn btn-red" style="margin:0;padding:6px 10px;font-size:12px;background:#c62828;" onclick="deleteRewardConfirm('${escapeHtml(r.id)}')">🗑️ 削除</button>
        </div>
      </div>`;
    }).join("");
  }

  function openRewardModal(rewardId) {
    const modal = document.getElementById('modal-admin-reward');
    if (modal) modal.style.display = "flex";
    const titleEl = document.getElementById('modal-reward-title');
    const idInput = document.getElementById('reward-input-id');
    const nameInput = document.getElementById('reward-input-name');
    const ptsInput = document.getElementById('reward-input-points');
    const timeInput = document.getElementById('reward-input-time');
    const iconInput = document.getElementById('reward-input-icon');
    const descInput = document.getElementById('reward-input-desc');

    if (rewardId) {
      const r = (cachedRewards || []).find(function (x) { return x.id === rewardId; });
      if (r) {
        if (titleEl) titleEl.innerText = "景品の編集";
        idInput.value = r.id;
        nameInput.value = r.name || "";
        ptsInput.value = r.points || 0;
        timeInput.value = r.timeMinutes || 0;
        iconInput.value = r.icon || "🎁";
        descInput.value = r.desc || "";
        return;
      }
    }
    if (titleEl) titleEl.innerText = "新しい景品を追加";
    idInput.value = "";
    nameInput.value = "";
    ptsInput.value = "100";
    timeInput.value = "30";
    iconInput.value = "🎮";
    descInput.value = "";
  }

  function closeRewardModal() {
    const modal = document.getElementById('modal-admin-reward');
    if (modal) modal.style.display = "none";
  }

  function submitSaveReward() {
    const pin = getTrainingAdminPin();
    const id = document.getElementById('reward-input-id').value;
    const name = (document.getElementById('reward-input-name').value || "").trim();
    const points = Number(document.getElementById('reward-input-points').value) || 0;
    const timeMinutes = Number(document.getElementById('reward-input-time').value) || 0;
    const icon = (document.getElementById('reward-input-icon').value || "🎁").trim();
    const desc = (document.getElementById('reward-input-desc').value || "").trim();
    if (!name) { alert("景品名を入力してください"); return; }

    global.parentAdminStore.saveRewardItem(pin, { id: id, name: name, points: points, timeMinutes: timeMinutes, icon: icon, desc: desc, enabled: true })
      .then(function () {
        closeRewardModal();
        loadParentAdminRewards();
      })
      .catch(function (err) { alert("保存失敗: " + err.message); });
  }

  function deleteRewardConfirm(rewardId) {
    if (!confirm("この景品を削除しますか？")) return;
    const pin = getTrainingAdminPin();
    global.parentAdminStore.deleteRewardItem(pin, rewardId)
      .then(function () { loadParentAdminRewards(); })
      .catch(function (err) { alert("削除失敗: " + err.message); });
  }

  // ========================================================================
  // 3. 📚 外部学習メニューマスター管理 (External Menus CRUD)
  // ========================================================================
  let cachedExtMenus = [];

  function enterParentAdminExtMenu() {
    if (!switchParentAdminSection('section-parent-admin-extmenu')) return;
    loadParentAdminExtMenu();
  }

  function loadParentAdminExtMenu() {
    const container = document.getElementById('parent-admin-extmenu-list');
    if (container) container.innerHTML = `<p style="color:#aaa;text-align:center;">読み込み中...</p>`;

    global.parentAdminStore.getExternalMenusMaster().then(function (list) {
      cachedExtMenus = list || [];
      renderAdminExtMenuList();
    }).catch(function (err) {
      if (container) container.innerHTML = `<p style="color:#ff8a80;text-align:center;">読み込み失敗: ${escapeHtml(err.message)}</p>`;
    });
  }

  function renderAdminExtMenuList() {
    const container = document.getElementById('parent-admin-extmenu-list');
    if (!container) return;
    if (!cachedExtMenus || cachedExtMenus.length === 0) {
      container.innerHTML = `<p style="color:#888;text-align:center;">登録されている外部学習メニューはありません</p>`;
      return;
    }

    container.innerHTML = `<table style="width:100%;border-collapse:collapse;color:#fff;font-size:14px;background:#252538;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#1e1e2f;color:#aaa;text-align:left;">
          <th style="padding:10px 12px;">カテゴリ</th>
          <th style="padding:10px 12px;">分量</th>
          <th style="padding:10px 12px;">付与Pt</th>
          <th style="padding:10px 12px;text-align:right;">操作</th>
        </tr>
      </thead>
      <tbody>
        ${cachedExtMenus.map(function (m) {
          return `<tr style="border-top:1px solid #3d3d5c;">
            <td style="padding:10px 12px;font-weight:bold;">${escapeHtml(m.category)}</td>
            <td style="padding:10px 12px;">${escapeHtml(m.volume)}</td>
            <td style="padding:10px 12px;color:#4caf50;font-weight:bold;">+${m.points} Pt</td>
            <td style="padding:10px 12px;text-align:right;">
              <button type="button" class="submit-btn btn-red" style="margin:0;padding:4px 8px;font-size:11px;background:#c62828;" onclick="deleteExtMenuConfirm('${escapeHtml(m.id)}')">🗑️ 削除</button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  }

  function submitAddExtMenu() {
    const pin = getTrainingAdminPin();
    const cat = (document.getElementById('new-extmenu-cat').value || "").trim();
    const vol = (document.getElementById('new-extmenu-vol').value || "").trim();
    const pts = Number(document.getElementById('new-extmenu-pts').value) || 1;
    if (!cat || !vol) { alert("カテゴリと分量を入力してください"); return; }

    global.parentAdminStore.saveExternalMenuItem(pin, { category: cat, volume: vol, points: pts })
      .then(function () {
        document.getElementById('new-extmenu-cat').value = "";
        document.getElementById('new-extmenu-vol').value = "";
        loadParentAdminExtMenu();
      })
      .catch(function (err) { alert("追加失敗: " + err.message); });
  }

  function deleteExtMenuConfirm(menuId) {
    if (!confirm("この項目を削除しますか？")) return;
    const pin = getTrainingAdminPin();
    global.parentAdminStore.deleteExternalMenuItem(pin, menuId)
      .then(function () { loadParentAdminExtMenu(); })
      .catch(function (err) { alert("削除失敗: " + err.message); });
  }

  // ========================================================================
  // 4. ⚙️ アプリ詳細・配点設定 (Sys Config)
  // ========================================================================
  function enterParentAdminSysConfig() {
    if (!switchParentAdminSection('section-parent-admin-sysconfig')) return;
    loadParentAdminSysConfig();
  }

  function loadParentAdminSysConfig() {
    const msg = document.getElementById('parent-admin-sysconfig-msg');
    if (msg) msg.innerText = "";
    global.parentAdminStore.getSysConfig().then(function (cfg) {
      document.getElementById('sys-pass-score').value = cfg.passScore || 70;
      document.getElementById('sys-tome-weight').value = cfg.tomeWeight || 15;
      document.getElementById('sys-hane-weight').value = cfg.haneWeight || 15;
      document.getElementById('sys-harai-weight').value = cfg.haraiWeight || 15;
      document.getElementById('sys-balance-weight').value = cfg.balanceWeight || 30;
      document.getElementById('sys-shape-weight').value = cfg.shapeWeight || 25;
      document.getElementById('sys-weak-bonus').value = cfg.weakBonus || 1.4;
      document.getElementById('sys-random-bonus').value = cfg.randomBonus || 1.1;
    });
  }

  function submitSaveSysConfig() {
    const pin = getTrainingAdminPin();
    const payload = {
      passScore: Number(document.getElementById('sys-pass-score').value) || 70,
      tomeWeight: Number(document.getElementById('sys-tome-weight').value) || 15,
      haneWeight: Number(document.getElementById('sys-hane-weight').value) || 15,
      haraiWeight: Number(document.getElementById('sys-harai-weight').value) || 15,
      balanceWeight: Number(document.getElementById('sys-balance-weight').value) || 30,
      shapeWeight: Number(document.getElementById('sys-shape-weight').value) || 25,
      weakBonus: Number(document.getElementById('sys-weak-bonus').value) || 1.4,
      randomBonus: Number(document.getElementById('sys-random-bonus').value) || 1.1
    };
    const msg = document.getElementById('parent-admin-sysconfig-msg');
    global.parentAdminStore.saveSysConfig(pin, payload)
      .then(function () {
        if (msg) { msg.innerText = "設定を保存しました 🎉"; msg.style.color = "#8bc34a"; }
      })
      .catch(function (err) {
        if (msg) { msg.innerText = "保存失敗: " + err.message; msg.style.color = "#ff8a80"; }
      });
  }

  function submitChangeAdminPin() {
    const currentPin = getTrainingAdminPin();
    const newPin = (document.getElementById('sys-new-admin-pin').value || "").trim();
    if (!newPin || newPin.length < 4) { alert("新しいPINは4桁以上の数字を入力してください"); return; }
    if (!confirm(`管理者PINを「${newPin}」に変更しますか？`)) return;

    global.parentAdminStore.updateAdminPin(currentPin, newPin)
      .then(function () {
        parentAdminPinSession = newPin;
        global.parentAdminPinSession = newPin;
        alert("管理者PINを変更しました。次回ログイン時から有効になります。");
        document.getElementById('sys-new-admin-pin').value = "";
      })
      .catch(function (err) { alert("PIN変更失敗: " + err.message); });
  }

  // ========================================================================
  // 5. 💾 データ管理＆仲介GASバックアップ一括出力連携
  // ========================================================================
  function enterParentAdminBackup() {
    if (!switchParentAdminSection('section-parent-admin-backup')) return;
    const resBox = document.getElementById('parent-admin-backup-result');
    if (resBox) resBox.style.display = "none";
  }

  function triggerMediatorBackup() {
    const pin = getTrainingAdminPin();
    const btn = document.getElementById('btn-mediator-backup');
    const resBox = document.getElementById('parent-admin-backup-result');
    const orig = btn ? callToggleBtnLoading(btn, true) : null;
    if (resBox) resBox.style.display = "none";

    global.parentAdminStore.triggerSpreadsheetFullBackup(pin)
      .then(function (res) {
        if (resBox) {
          resBox.style.display = "block";
          resBox.innerHTML = `<div style="background:#1b5e20;border:1px solid #4caf50;color:#e8f5e9;padding:16px;border-radius:10px;line-height:1.6;">
            <h3 style="margin:0 0 8px 0;font-size:16px;color:#a5d6a7;">🎉 バックアップスプレッドシートを生成しました！</h3>
            <p style="margin:0 0 12px 0;font-size:13px;">Googleドライブに見出し・書式付きで全設定・全教材ブックを出力しました。</p>
            <a href="${escapeHtml(res.folderUrl || '#')}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#4caf50;color:#fff;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:8px;font-size:14px;">📁 ドライブのバックアップフォルダを開く</a>
          </div>`;
        }
      })
      .catch(function (err) {
        if (resBox) {
          resBox.style.display = "block";
          resBox.innerHTML = `<div style="background:#b71c1c;border:1px solid #ef5350;color:#ffebee;padding:14px;border-radius:10px;font-size:13px;">
            ⚠️ バックアップ生成に失敗しました: ${escapeHtml(err.message)}
          </div>`;
        }
      })
      .finally(function () {
        if (btn && btn.isConnected) callToggleBtnLoading(btn, false, orig);
      });
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

  // 新規公開ハンドラ
  global.enterParentAdminUsers = enterParentAdminUsers;
  global.loadParentAdminUsers = loadParentAdminUsers;
  global.openCreateUserModal = openCreateUserModal;
  global.closeCreateUserModal = closeCreateUserModal;
  global.submitCreateUser = submitCreateUser;
  global.openEditUserModal = openEditUserModal;
  global.closeEditUserModal = closeEditUserModal;
  global.submitEditUser = submitEditUser;
  global.deleteUserConfirm = deleteUserConfirm;

  global.enterParentAdminRewards = enterParentAdminRewards;
  global.loadParentAdminRewards = loadParentAdminRewards;
  global.openRewardModal = openRewardModal;
  global.closeRewardModal = closeRewardModal;
  global.submitSaveReward = submitSaveReward;
  global.deleteRewardConfirm = deleteRewardConfirm;

  global.enterParentAdminExtMenu = enterParentAdminExtMenu;
  global.loadParentAdminExtMenu = loadParentAdminExtMenu;
  global.submitAddExtMenu = submitAddExtMenu;
  global.deleteExtMenuConfirm = deleteExtMenuConfirm;

  global.enterParentAdminSysConfig = enterParentAdminSysConfig;
  global.loadParentAdminSysConfig = loadParentAdminSysConfig;
  global.submitSaveSysConfig = submitSaveSysConfig;
  global.submitChangeAdminPin = submitChangeAdminPin;

  global.enterParentAdminBackup = enterParentAdminBackup;
  global.triggerMediatorBackup = triggerMediatorBackup;
  global.switchParentAdminSection = switchParentAdminSection;

})(window);

