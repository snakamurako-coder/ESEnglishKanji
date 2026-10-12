/**
 * js/modules/externalLearning.js
 * 外部学習の申請（子ども画面）および承認・却下（保護者管理画面）の独立モジュール
 */
(function (global) {
  'use strict';

  let externalMenus = [];

  function saveKidUser(user) {
    if (typeof global.saveAppKidUserToLocal === 'function') {
      try { return global.saveAppKidUserToLocal(user); } catch (_) {}
    }
    try {
      localStorage.setItem('app_kid_user', JSON.stringify(user));
      return true;
    } catch (_) {
      return false;
    }
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

  function callBackToParentAdminHub() {
    if (typeof global.backToParentAdminHub === 'function') {
      global.backToParentAdminHub();
    }
  }

  function callGetExternalAdminPin() {
    if (typeof global.getExternalAdminPin === 'function') {
      return global.getExternalAdminPin();
    }
    const pinEl = document.getElementById('external-admin-pin-input') || document.getElementById('parent-admin-pin-input');
    return pinEl ? pinEl.value.trim() : '';
  }

  // =========================================================================
  // 子ども側：外部学習メニュー読み込み ＆ 申請
  // =========================================================================
  function loadExternalLearning(btn) {
    const origText = callToggleBtnLoading(btn, true);
    const contEl = document.getElementById('external-container');
    const myReqEl = document.getElementById('external-my-requests');
    if (contEl) contEl.innerHTML = "<p>さがしています...</p>";
    if (myReqEl) myReqEl.innerHTML = "";

    const onMenusLoaded = function (menus) {
      callToggleBtnLoading(btn, false, origText);
      callSwitchSection('section-external');
      externalMenus = menus || [];
      renderExternalLearningForm();
      refreshMyExternalRequests();
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      if (user && user.stopwatchJson && user.stopwatchJson.external && typeof global.applyStopwatchState_ === 'function') {
        global.applyStopwatchState_('external', user.stopwatchJson.external);
      }
      if (user && typeof global.loadStopwatchFromServer === 'function') {
        global.loadStopwatchFromServer(user);
      }
    };

    if (global.appSettingsStore && typeof global.appSettingsStore.getExternalLearningMenus === 'function') {
      global.appSettingsStore.getExternalLearningMenus()
        .then(res => onMenusLoaded((res && res.list) || []))
        .catch(() => {
          callToggleBtnLoading(btn, false, origText);
          onMenusLoaded([]);
        });
      return;
    }

    // キャッシュまたはローカル設定フォールバック
    callToggleBtnLoading(btn, false, origText);
    onMenusLoaded([]);
  }

  function renderExternalLearningForm() {
    const c = document.getElementById('external-container');
    if (!c) return;
    c.innerHTML = "";
    if (externalMenus.length === 0) {
      c.innerHTML = "<p>登録されているメニューがありません。</p>";
      return;
    }
    const categories = [...new Set(externalMenus.map(m => m.category || ""))].filter(Boolean);
    if (categories.length === 0) {
      c.innerHTML = "<p>カテゴリが設定されていません。</p>";
      return;
    }
    c.innerHTML = `
      <div class="setting-group">
        <h3>カテゴリ</h3>
        <select id="external-category" class="large-select"></select>
      </div>
      <div class="setting-group">
        <h3>分量</h3>
        <select id="external-volume" class="large-select"></select>
        <p style="margin:6px 0 0; color:gold;">獲得ポイント: <span id="external-points-display">0</span> Pt</p>
      </div>
      <div class="setting-group">
        <h3>こどもメモ（自由記述）</h3>
        <textarea id="external-child-memo" rows="3" style="width:100%; box-sizing:border-box; border-radius:10px; padding:10px; background:#222; color:#fff; border:1px solid #555;" placeholder="がんばった内容やメモを書こう（空欄でもOK）"></textarea>
        <button type="button" class="submit-btn btn-blue" style="margin-top:8px; width:100%;" onclick="startJaSpeechToField('external-child-memo')">🎙️ 日本語で入力（マイク）</button>
      </div>
      <button type="button" class="submit-btn btn-green" style="width:100%;" onclick="submitExternalLearningRequestSelected()">申請する</button>
    `;
    const catSelect = document.getElementById('external-category');
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      catSelect.appendChild(opt);
    });
    catSelect.onchange = () => updateExternalVolumeOptions();
    updateExternalVolumeOptions();
  }

  function updateExternalVolumeOptions() {
    const catSelect = document.getElementById('external-category');
    const volSelect = document.getElementById('external-volume');
    if (!catSelect || !volSelect) return;
    const cat = catSelect.value;
    volSelect.innerHTML = "";
    const vols = externalMenus.filter(m => m.category === cat);
    vols.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.volume;
      opt.innerText = v.volume;
      opt.dataset.points = v.points;
      volSelect.appendChild(opt);
    });
    const pts = document.getElementById('external-points-display');
    const first = vols[0];
    if (pts) pts.innerText = first ? first.points : 0;
    volSelect.onchange = () => {
      const selected = vols.find(v => v.volume === volSelect.value);
      if (pts) pts.innerText = selected ? selected.points : 0;
    };
  }

  function getSelectedExternalMenu() {
    const catEl = document.getElementById('external-category');
    const volEl = document.getElementById('external-volume');
    const cat = catEl ? catEl.value : '';
    const vol = volEl ? volEl.value : '';
    const match = externalMenus.find(m => m.category === cat && m.volume === vol);
    const points = match ? match.points : 0;
    return { category: cat, volume: vol, points };
  }

  function refreshMyExternalRequests() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('app_kid_user')); } catch (_) {}
    if (!user) return;
    const box = document.getElementById('external-my-requests');
    if (!box) return;

    const renderList = function (list) {
      if (!list || list.length === 0) {
        box.innerHTML = "<p style='color:#888;'>※まだ申請履歴はありません。</p>";
        return;
      }
      const label = { "申請中": "⏳ 申請中", "pending": "⏳ 申請中", "承認済み": "✅ 承認済み", "approved": "✅ 承認済み", "却下": "❌ 却下", "rejected": "❌ 却下" };
      let html = "<strong style='color:#fff;'>あなたの申請</strong><ul style='margin:8px 0 0;padding-left:18px;'>";
      list.forEach(r => {
        const st = label[r.status] || r.status;
        const memoHtml = r.childMemo ? `<br><span style='font-size:12px;color:#ddd;'>メモ: ${r.childMemo}</span>` : "";
        html += `<li style='margin-bottom:8px;'>${r.category} / ${r.volume}（+${r.points} Pt）<br><span style='font-size:12px;color:#aaa;'>${r.requestedAt} — ${st}</span>${memoHtml}</li>`;
      });
      html += "</ul>";
      box.innerHTML = html;
    };

    if (global.externalStore && typeof global.externalStore.subscribeMyRequests === 'function') {
      global.externalStore.subscribeMyRequests(user.id, renderList);
    } else {
      box.innerHTML = "<p style='color:#888;'>※まだ申請履歴はありません。</p>";
    }
  }

  function submitExternalLearningRequestSelected() {
    const menu = getSelectedExternalMenu();
    if (!menu.category || !menu.volume) {
      alert("カテゴリと分量を選んでください。");
      return;
    }
    if (!confirm(`「${menu.category} / ${menu.volume}」を申請する？\n（おうちの人が管理者PINで承認するまでポイントは付きません）`)) return;
    let user = null;
    try { user = JSON.parse(localStorage.getItem('app_kid_user')); } catch (_) {}
    if (!user) return;
    const memoEl = document.getElementById('external-child-memo');
    const childMemo = memoEl ? memoEl.value : "";

    const reqPayload = {
      userId: user.id,
      userName: user.name,
      category: menu.category,
      volume: menu.volume,
      points: menu.points,
      childMemo: childMemo
    };

    if (global.externalStore && typeof global.externalStore.submitRequest === 'function') {
      global.externalStore.submitRequest(reqPayload)
        .then(() => {
          alert("申請しました！おうちの人の承認をお待ちください。");
          refreshMyExternalRequests();
          if (memoEl) memoEl.value = "";
        })
        .catch(err => {
          console.error("Firestore submitRequest error:", err);
          alert("申請の保存に失敗しました。");
        });
    } else {
      alert("外部学習機能が初期化されていません。");
    }
  }

  // =========================================================================
  // 保護者側：未承認一覧 ＆ 個別・一括承認
  // =========================================================================
  function loadExternalAdminPending() {
    const pin = callGetExternalAdminPin();
    const msg = document.getElementById('external-admin-message');
    const listEl = document.getElementById('external-admin-list');
    if (msg) msg.innerText = "";
    if (!pin) {
      if (msg) msg.innerText = "PINを入力してください。";
      return;
    }
    if (listEl) {
      listEl.style.display = "flex";
      listEl.innerHTML = "<p>よみこみ中...</p>";
    }

    const pinPanel = document.getElementById('external-admin-pin-panel');
    if (pinPanel) pinPanel.style.display = "none";

    // Firestore リアルタイム監視
    if (global.externalStore && typeof global.externalStore.subscribePendingRequests === 'function') {
      global.externalStore.subscribePendingRequests(function (list) {
        if (msg) msg.innerText = "";
        renderExternalAdminList(list, pin);
      });
    } else {
      if (listEl) listEl.innerHTML = "<p style='text-align:center;color:#888;'>申請中のものはありません。</p>";
    }
  }

  function renderExternalAdminList(list, pin) {
    const listEl = document.getElementById('external-admin-list');
    if (!listEl) return;
    listEl.style.display = "flex";
    if (!list || list.length === 0) {
      listEl.innerHTML = "<p style='text-align:center;color:#888;'>申請中のものはありません。</p>";
      const retry = document.createElement('button');
      retry.type = "button";
      retry.className = "submit-btn btn-gray";
      retry.innerText = "管理メニューにもどる";
      retry.onclick = () => { callBackToParentAdminHub(); };
      listEl.appendChild(retry);
      return;
    }
    listEl.innerHTML = "";

    const bulkApproveBtn = document.createElement('button');
    bulkApproveBtn.type = "button";
    bulkApproveBtn.className = "submit-btn btn-orange";
    bulkApproveBtn.style.marginBottom = "12px";
    bulkApproveBtn.innerText = "☑の申請を一括で承認";
    bulkApproveBtn.onclick = () => bulkApproveExternalRequests(pin);
    listEl.appendChild(bulkApproveBtn);

    list.forEach(item => {
      const card = document.createElement('div');
      card.className = "external-admin-card";
      card.dataset.reqId = item.id || '';
      card.style.cssText = "background:#2a2a2a;border-radius:12px;padding:14px;border:1px solid #444;position:relative;";
      card.innerHTML = `<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
          <input type="checkbox" class="external-bulk-check" style="transform:scale(1.5);margin-top:4px;" checked>
          <div style="flex:1;">
            <div style="font-weight:bold;margin-bottom:6px;">${item.userName} <span style="font-size:12px;color:#aaa;">(${item.userId})</span></div>
            <div style="font-size:15px;margin-bottom:4px;">${item.category || ""} / ${item.volume || ""}</div>
            <div style="color:gold;margin-bottom:8px;">+${item.points} Pt</div>
            <div style="font-size:12px;color:#888;margin-bottom:6px;">${item.requestedAt}</div>
            ${item.childMemo ? `<div style="font-size:13px;color:#ddd;margin-bottom:8px;">こどもメモ: ${item.childMemo}</div>` : ""}
          </div>
        </label>
        <textarea class="external-admin-memo" rows="2" placeholder="おとなメモ（任意）" style="width:100%;box-sizing:border-box;border-radius:8px;padding:8px;background:#222;color:#fff;border:1px solid #555;margin-bottom:8px;margin-top:8px;"></textarea>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="submit-btn btn-green" style="flex:1;min-width:100px;">承認する</button>
          <button type="button" class="cancel-btn" style="flex:1;min-width:100px;background:#663333;color:#fcc;">却下</button>
        </div>`;
      const btns = card.querySelectorAll('button');
      const memoField = card.querySelector('.external-admin-memo');
      btns[0].onclick = () => decideExternalRequest(item.id, pin, true, memoField ? memoField.value : "");
      btns[1].onclick = () => decideExternalRequest(item.id, pin, false, memoField ? memoField.value : "");
      listEl.appendChild(card);
    });

    const back = document.createElement('button');
    back.type = "button";
    back.className = "submit-btn btn-gray";
    back.style.marginTop = "8px";
    back.innerText = "管理メニューにもどる";
    back.onclick = () => { callBackToParentAdminHub(); };
    listEl.appendChild(back);
  }

  function decideExternalRequest(reqId, pin, approve, memo = "") {
    if (!confirm(approve ? "この申請を承認してポイントを付与しますか？" : "この申請を却下しますか？")) return;

    if (reqId && global.externalStore && typeof global.externalStore.decideRequest === 'function') {
      global.externalStore.decideRequest(reqId, approve, memo)
        .then(() => {
          alert(approve ? "承認しました！ポイントが加算されました。" : "却下しました。");
        })
        .catch(err => {
          console.error("Firestore decideRequest error:", err);
          alert("処理に失敗しました。");
        });
    } else {
      alert("外部学習機能が初期化されていません。");
    }
  }

  function bulkApproveExternalRequests(pin) {
    const listEl = document.getElementById('external-admin-list');
    if (!listEl) return;
    const cards = Array.from(listEl.querySelectorAll('.external-admin-card'));
    const requestsToApprove = [];

    cards.forEach(card => {
      const checkbox = card.querySelector('.external-bulk-check');
      if (checkbox && checkbox.checked && card.dataset.reqId) {
        const memoField = card.querySelector('.external-admin-memo');
        requestsToApprove.push({
          reqId: card.dataset.reqId,
          adminMemo: memoField ? memoField.value : ""
        });
      }
    });

    if (requestsToApprove.length === 0) {
      alert("選択された申請がありません。");
      return;
    }

    if (!confirm(`選択された ${requestsToApprove.length} 件の申請を一括で承認してポイントを付与しますか？`)) return;

    if (global.externalStore && typeof global.externalStore.decideRequest === 'function') {
      const promises = requestsToApprove.map(item =>
        global.externalStore.decideRequest(item.reqId, true, item.adminMemo)
      );
      Promise.all(promises)
        .then(() => {
          alert("選択されたすべての申請を承認しました！");
        })
        .catch(err => {
          console.error("Bulk approve error:", err);
          alert("一括承認中にエラーが発生しました。");
        });
    } else {
      alert("外部学習機能が初期化されていません。");
    }
  }

  function loadExternalAdminPendingAfterPin(pin) {
    loadExternalAdminPending();
  }

  // グローバル公開
  global.loadExternalLearning = loadExternalLearning;
  global.renderExternalLearningForm = renderExternalLearningForm;
  global.updateExternalVolumeOptions = updateExternalVolumeOptions;
  global.getSelectedExternalMenu = getSelectedExternalMenu;
  global.refreshMyExternalRequests = refreshMyExternalRequests;
  global.submitExternalLearningRequestSelected = submitExternalLearningRequestSelected;
  global.loadExternalAdminPending = loadExternalAdminPending;
  global.renderExternalAdminList = renderExternalAdminList;
  global.decideExternalRequest = decideExternalRequest;
  global.bulkApproveExternalRequests = bulkApproveExternalRequests;
  global.loadExternalAdminPendingAfterPin = loadExternalAdminPendingAfterPin;

})(window);
