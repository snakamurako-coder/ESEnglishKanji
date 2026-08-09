    function loadExternalLearning(btn) {
      const origText = toggleBtnLoading(btn, true);
      document.getElementById('external-container').innerHTML = "<p>さがしています...</p>";
      document.getElementById('external-my-requests').innerHTML = "";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_external_learning" }) })
      .then(r=>r.json()).then(d=>{
        toggleBtnLoading(btn, false, origText);
        if(d.status === "success") {
          switchSection('section-external');
          externalMenus = d.list || [];
          renderExternalLearningForm();
          refreshMyExternalRequests();
          const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
          if (user && user.stopwatchJson && user.stopwatchJson.external) {
            applyStopwatchState_('external', user.stopwatchJson.external);
          }
          if (user) loadStopwatchFromServer(user);
        }
      }).catch(e => toggleBtnLoading(btn, false, origText));
    }

    function renderExternalLearningForm() {
      const c = document.getElementById('external-container'); 
      c.innerHTML = "";
      if (externalMenus.length === 0) {
        c.innerHTML = "<p>登録されているメニューがありません。</p>";
        return;
      }
      const categories = [...new Set(externalMenus.map(m => m.category || ""))].filter(v => v);
      if (categories.length === 0) { c.innerHTML = "<p>カテゴリが設定されていません。</p>"; return; }
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
      categories.forEach(cat => { const opt = document.createElement('option'); opt.value = cat; opt.innerText = cat; catSelect.appendChild(opt); });
      catSelect.onchange = () => updateExternalVolumeOptions();
      updateExternalVolumeOptions();
    }

    function updateExternalVolumeOptions() {
      const cat = document.getElementById('external-category').value;
      const volSelect = document.getElementById('external-volume');
      volSelect.innerHTML = "";
      const vols = externalMenus.filter(m => m.category === cat);
      vols.forEach(v => { const opt = document.createElement('option'); opt.value = v.volume; opt.innerText = v.volume; opt.dataset.points = v.points; volSelect.appendChild(opt); });
      const pts = document.getElementById('external-points-display');
      const first = vols[0];
      pts.innerText = first ? first.points : 0;
      volSelect.onchange = () => {
        const selected = vols.find(v => v.volume === volSelect.value);
        pts.innerText = selected ? selected.points : 0;
      };
    }

    function getSelectedExternalMenu() {
      const cat = document.getElementById('external-category').value;
      const vol = document.getElementById('external-volume').value;
      const match = externalMenus.find(m => m.category === cat && m.volume === vol);
      const points = match ? match.points : 0;
      return { category: cat, volume: vol, points };
    }

    function refreshMyExternalRequests() {
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      if (!user) return;
      const box = document.getElementById('external-my-requests');
      box.innerHTML = "<p style='color:#888;'>あなたの申請を読み込み中...</p>";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_my_external_learning_requests", userId: user.id }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success" || !d.list || d.list.length === 0) {
          box.innerHTML = "<p style='color:#888;'>※まだ申請履歴はありません。</p>";
          return;
        }
        const label = { "申請中": "⏳ 申請中", "承認済み": "✅ 承認済み", "却下": "❌ 却下" };
        let html = "<strong style='color:#fff;'>あなたの申請</strong><ul style='margin:8px 0 0;padding-left:18px;'>";
        d.list.forEach(r => {
          const st = label[r.status] || r.status;
          const memoHtml = r.childMemo ? `<br><span style='font-size:12px;color:#ddd;'>メモ: ${r.childMemo}</span>` : "";
          html += `<li style='margin-bottom:8px;'>${r.category} / ${r.volume}（+${r.points} Pt）<br><span style='font-size:12px;color:#aaa;'>${r.requestedAt} — ${st}</span>${memoHtml}</li>`;
        });
        html += "</ul>";
        box.innerHTML = html;
      }).catch(() => { box.innerHTML = ""; });
    }

    function submitExternalLearningRequestSelected() {
      const menu = getSelectedExternalMenu();
      if(!menu.category || !menu.volume) { alert("カテゴリと分量を選んでください。"); return; }
      if(!confirm(`「${menu.category} / ${menu.volume}」を申請する？\n（おうちの人が管理者PINで承認するまでポイントは付きません）`)) return;
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      const childMemo = document.getElementById('external-child-memo').value || "";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "submit_external_learning_request", userId: user.id, category: menu.category, volume: menu.volume, points: menu.points, childMemo: childMemo }) })
      .then(r=>r.json()).then(d=>{
        if(d.status === "success") {
          alert(d.message);
          refreshMyExternalRequests();
        } else {
          alert(d.message || "申請に失敗しました");
        }
      }).catch(() => alert("通信エラーが発生しました。"));
    }

    // ====== 学習形式・こたえ方（学習者UIと特訓管理で共通） ======
    const TRAINING_QFORMAT_TO_INTERNAL = {
      "日本語→英単語": "ja_to_en",
      "日本語→英語（並び替え）": "ja_to_en_sort",
      "並び替え（日本語付き）": "ja_to_en_sort",
      "英単語→日本語": "en_to_ja",
      "音声→日本語": "en_audio_to_ja",
      "音声→英単語": "qaudio_to_en",
      "疑問文→英語": "qtext_to_en",
      "英語→英語": "en_to_en",
      "英単語→英単語": "en_to_en",
      "英語読み上げ→英語": "en_audio_to_en",
      "漢字→採点チャレンジ": "kanji_hand"
    };
    const TRAINING_AFORMAT_TO_INTERNAL = {
      "4択": "4choice",
      "タイピング": "typing",
      "音声": "voice",
      "穴埋め4択": "fill_4choice",
      "穴埋めタイピング": "fill_typing",
      "タイピング（イニシャル）": "initial_typing",
      "タイピング（穴埋め）": "sheet_fill_typing",
      "音声入力（イニシャル）": "initial_voice",
      "音声入力（穴埋め）": "sheet_fill_voice",
      "タイピング（フラッシュ）": "flash_typing",
      "音声入力（フラッシュ）": "flash_voice",
      "すべて用いる": "sort_all",
      "不要語混入": "sort_dummy",
      "不足語補足": "sort_missing",
      "採点": "hand_grade"
    };

    function trainingRouteLabelsToInternal(qFormat, aFormat) {
      const format = TRAINING_QFORMAT_TO_INTERNAL[String(qFormat || "").trim()] || "";
      let ansType = TRAINING_AFORMAT_TO_INTERNAL[String(aFormat || "").trim()] || "";
      if (format === "en_to_ja" || format === "en_audio_to_ja") ansType = "4choice";
      return { format: format, ansType: ansType };
    }

    function findTrainingMaterialForUnit(unitName, materials) {
      const unit = String(unitName || "").trim();
      if (!unit) return null;
      const mats = materials || (trainingAdminData && trainingAdminData.materials) || materialsData || [];
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if ((m.units || []).some(function (u) { return String(u) === unit; })) return m;
      }
      return null;
    }

    function getTrainingModeNameForUnit(unitName, materials) {
      const m = findTrainingMaterialForUnit(unitName, materials);
      return m ? String(m.modeName || "") : "";
    }

    function getTrainingCategoryForUnit(unitName, materials) {
      const m = findTrainingMaterialForUnit(unitName, materials);
      if (!m) return "english";
      if (m.category === "kanji" || /漢字/.test(String(m.modeName || ""))) return "kanji";
      return "english";
    }

    function getLearnerFormatOptions(modeName, category) {
      if (category === "kanji" || /漢字/.test(String(modeName || ""))) {
        return [{ value: "kanji_hand", label: "漢字 → 採点チャレンジ", qFormat: "漢字→採点チャレンジ" }];
      }
      const isWord = String(modeName || "").includes("単語");
      if (isWord) {
        return [
          { value: "ja_to_en", label: "日本語 ➔ 英語にする", qFormat: "日本語→英単語" },
          { value: "en_to_ja", label: "英語 ➔ 日本語にする", qFormat: "英単語→日本語" },
          { value: "en_audio_to_ja", label: "英語読み上げ ➔ 日本語にする", qFormat: "音声→日本語" },
          { value: "en_audio_to_en", label: "英語読み上げ ➔ 英語にする", qFormat: "英語読み上げ→英語" },
          { value: "en_to_en", label: "英語 ➔ 英語にする", qFormat: "英語→英語" }
        ];
      }
      return [
        { value: "ja_to_en", label: "日本語 ➔ 英語にする", qFormat: "日本語→英単語" },
        { value: "ja_to_en_sort", label: "並び替え（日本語付き）", qFormat: "日本語→英語（並び替え）" },
        { value: "en_to_ja", label: "英語 ➔ 日本語にする", qFormat: "英単語→日本語" },
        { value: "qtext_to_en", label: "疑問文 ➔ 英語にする", qFormat: "疑問文→英語" },
        { value: "qaudio_to_en", label: "疑問文(読み上げ) ➔ 英語にする", qFormat: "音声→英単語" },
        { value: "en_audio_to_en", label: "英語読み上げ ➔ 英語にする", qFormat: "英語読み上げ→英語" },
        { value: "en_to_en", label: "英語 ➔ 英語にする", qFormat: "英語→英語" }
      ];
    }

    function getLearnerAnswerOptions(format, modeName) {
      const isWord = String(modeName || "").includes("単語");
      const opts = [];
      function add(value, label, aFormat) { opts.push({ value: value, label: label, aFormat: aFormat }); }
      if (format === "kanji_hand") {
        add("hand_grade", "採点", "採点");
        return opts;
      }
      if (format === "ja_to_en_sort") {
        add("sort_all", "すべて用いる", "すべて用いる");
        add("sort_dummy", "不要語混入", "不要語混入");
        add("sort_missing", "不足語補足", "不足語補足");
        return opts;
      }
      if (format === "ja_to_en") {
        add("4choice", "４択（えらぶ）", "4択");
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        if (isWord) {
          add("fill_4choice", "🔠 穴埋め（４択）", "穴埋め4択");
          add("fill_typing", "⌨️ 穴埋め（タイピング）", "穴埋めタイピング");
        }
        return opts;
      }
      if (format === "qtext_to_en" || format === "qaudio_to_en") {
        if (format !== "qaudio_to_en") add("4choice", "４択（えらぶ）", "4択");
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        return opts;
      }
      if (format === "en_to_ja" || format === "en_audio_to_ja") {
        add("4choice", "４択（えらぶ）", "4択");
        return opts;
      }
      if (format === "en_audio_to_en") {
        add("4choice", "４択（えらぶ）", "4択");
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        if (isWord) {
          add("fill_4choice", "🔠 穴埋め（４択）", "穴埋め4択");
          add("fill_typing", "⌨️ 穴埋め（タイピング）", "穴埋めタイピング");
        }
        return opts;
      }
      if (format === "en_to_en") {
        add("typing", "タイピング（入力する）", "タイピング");
        add("voice", "🎙️ 音声入力（マイク）", "音声");
        add("flash_typing", "タイピング（フラッシュ）", "タイピング（フラッシュ）");
        add("flash_voice", "🎙️ 音声入力（フラッシュ）", "音声入力（フラッシュ）");
        if (!isWord) {
          add("initial_typing", "タイピング（イニシャル）", "タイピング（イニシャル）");
          add("sheet_fill_typing", "タイピング（穴埋め）", "タイピング（穴埋め）");
          add("initial_voice", "🎙️ 音声入力（イニシャル）", "音声入力（イニシャル）");
          add("sheet_fill_voice", "🎙️ 音声入力（穴埋め）", "音声入力（穴埋め）");
        }
        return opts;
      }
      return opts;
    }

    function isValidTrainingRouteCombo(unitName, qFormat, aFormat, materials) {
      const parsed = trainingRouteLabelsToInternal(qFormat, aFormat);
      if (!parsed.format || !parsed.ansType) return false;
      const modeName = getTrainingModeNameForUnit(unitName, materials);
      const category = getTrainingCategoryForUnit(unitName, materials);
      if (!modeName && category !== "kanji") return false;
      const formats = getLearnerFormatOptions(modeName, category);
      const fmt = formats.find(function (f) { return f.qFormat === String(qFormat || "").trim(); });
      if (!fmt) return false;
      const answers = getLearnerAnswerOptions(fmt.value, modeName);
      return answers.some(function (a) { return a.aFormat === String(aFormat || "").trim(); });
    }

    function getAllEnglishBasePointCombos() {
      const out = [];
      ["単語モード", "表現モード"].forEach(function (modeName) {
        const modeCategory = modeName.includes("単語") ? "word" : "expression";
        getLearnerFormatOptions(modeName, "english").forEach(function (f) {
          getLearnerAnswerOptions(f.value, modeName).forEach(function (a) {
            out.push({
              format: f.value,
              formatLabel: f.label,
              ansType: a.value,
              ansLabel: a.label,
              settingKey: "基本Pt_" + f.value + "_" + a.value,
              modeCategory: modeCategory,
              modeLabel: modeName
            });
          });
        });
      });
      return out;
    }

    // ====== おうちの人：統合管理メニュー ======
    let parentAdminPinSession = "";

    function syncAdminPinInputs(pin) {
      const p = String(pin || "");
      const ext = document.getElementById('external-admin-pin-input');
      const train = document.getElementById('training-admin-pin-input');
      if (ext) ext.value = p;
      if (train) train.value = p;
    }

    function loadExternalAdminPending() {
      const pin = getExternalAdminPin();
      const msg = document.getElementById('external-admin-message');
      const listEl = document.getElementById('external-admin-list');
      msg.innerText = "";
      if (!pin) {
        msg.innerText = "PINを入力してください。";
        return;
      }
      listEl.style.display = "none";
      listEl.innerHTML = "<p>よみこみ中...</p>";
      listEl.style.display = "flex";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_pending_external_requests", adminPin: pin }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          listEl.style.display = "none";
          msg.innerText = d.message || "エラー";
          return;
        }
        document.getElementById('external-admin-pin-panel').style.display = "none";
        msg.innerText = "";
        renderExternalAdminList(d.list || [], pin);
      }).catch(() => {
        listEl.style.display = "none";
        msg.innerText = "通信エラーが発生しました。";
      });
    }

    function renderExternalAdminList(list, pin) {
      const listEl = document.getElementById('external-admin-list');
      listEl.style.display = "flex";
      if (list.length === 0) {
        listEl.innerHTML = "<p style='text-align:center;color:#888;'>申請中のものはありません。</p>";
        const retry = document.createElement('button');
        retry.type = "button";
        retry.className = "submit-btn btn-gray";
        retry.innerText = "管理メニューにもどる";
        retry.onclick = () => { backToParentAdminHub(); };
        listEl.appendChild(retry);
        return;
      }
      listEl.innerHTML = "";
      list.forEach(item => {
        const card = document.createElement('div');
        card.style.cssText = "background:#2a2a2a;border-radius:12px;padding:14px;border:1px solid #444;";
        card.innerHTML = `<div style="font-weight:bold;margin-bottom:6px;">${item.userName} <span style="font-size:12px;color:#aaa;">(${item.userId})</span></div>
          <div style="font-size:15px;margin-bottom:4px;">${item.category || ""} / ${item.volume || ""}</div>
          <div style="color:gold;margin-bottom:8px;">+${item.points} Pt</div>
          <div style="font-size:12px;color:#888;margin-bottom:6px;">${item.requestedAt}</div>
          ${item.childMemo ? `<div style="font-size:13px;color:#ddd;margin-bottom:8px;">こどもメモ: ${item.childMemo}</div>` : ""}
          <textarea class="external-admin-memo" rows="2" placeholder="おとなメモ（任意）" style="width:100%;box-sizing:border-box;border-radius:8px;padding:8px;background:#222;color:#fff;border:1px solid #555;margin-bottom:8px;"></textarea>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="submit-btn btn-green" style="flex:1;min-width:100px;">承認する</button>
            <button type="button" class="cancel-btn" style="flex:1;min-width:100px;background:#663333;color:#fcc;">却下</button>
          </div>`;
        const btns = card.querySelectorAll('button');
        const memoField = card.querySelector('.external-admin-memo');
        btns[0].onclick = () => decideExternalRequest(item.rowIdx, pin, true, memoField ? memoField.value : "");
        btns[1].onclick = () => decideExternalRequest(item.rowIdx, pin, false, memoField ? memoField.value : "");
        listEl.appendChild(card);
      });
      const back = document.createElement('button');
      back.type = "button";
      back.className = "submit-btn btn-gray";
      back.style.marginTop = "8px";
      back.innerText = "管理メニューにもどる";
      back.onclick = () => { backToParentAdminHub(); };
      listEl.appendChild(back);
    }

    function decideExternalRequest(rowIdx, pin, approve, memo = "") {
      if (!confirm(approve ? "この申請を承認してポイントを付与しますか？" : "この申請を却下しますか？")) return;
      const action = approve ? "approve_external_request" : "reject_external_request";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, adminPin: pin, rowIdx: rowIdx, adminMemo: memo }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          alert(d.message || "エラー");
          return;
        }
        alert(d.message);
        const user = JSON.parse(localStorage.getItem('app_kid_user') || "{}");
        if (approve && d.userId && user.id === d.userId && typeof d.newTotal === "number") {
          user.points = d.newTotal;
          saveAppKidUserToLocal(user);
          const pts = document.getElementById('user-points');
          if (pts) pts.innerText = user.points;
        }
        loadExternalAdminPendingAfterPin(pin);
      }).catch(() => alert("通信エラーが発生しました。"));
    }

    function loadExternalAdminPendingAfterPin(pin) {
      const msg = document.getElementById('external-admin-message');
      const listEl = document.getElementById('external-admin-list');
      msg.innerText = "";
      listEl.innerHTML = "<p>更新中...</p>";
      listEl.style.display = "flex";
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_pending_external_requests", adminPin: pin }) })
      .then(r=>r.json()).then(d=>{
        if(d.status !== "success") {
          msg.innerText = d.message || "エラー";
          listEl.innerHTML = "";
          return;
        }
        renderExternalAdminList(d.list || [], pin);
      }).catch(() => { msg.innerText = "通信エラー"; });
    }

    const USER_PREF_KANJI_HW_DOMINANT = 'kanji_quiz_hw_dominant_hand';
    function getKanjiHwDominantHand() {
      const v = getUserPref(USER_PREF_KANJI_HW_DOMINANT, null);
      return v === 'left' ? 'left' : 'right';
    }
    function applyKanjiHwDominantHandToBody() {
      document.body.classList.toggle('kanji-hw-dominant-left', getKanjiHwDominantHand() === 'left');
    }
    function syncKanjiHwHandSwitchUI() {
      const lefty = getKanjiHwDominantHand() === 'left';
      const bR = document.getElementById('kanji-hw-hand-right');
      const bL = document.getElementById('kanji-hw-hand-left');
      if (bR) {
        bR.classList.toggle('active', !lefty);
        bR.setAttribute('aria-pressed', !lefty ? 'true' : 'false');
      }
      if (bL) {
        bL.classList.toggle('active', lefty);
        bL.setAttribute('aria-pressed', lefty ? 'true' : 'false');
      }
    }