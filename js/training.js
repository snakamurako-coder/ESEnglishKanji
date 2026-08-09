    function renderTrainingRoute() {
        const container = document.getElementById('route-container');
        container.innerHTML = "";
        
        if (dailyRouteData.length === 0) {
            container.innerHTML = "<p style='text-align:center;'>今日のミッションはないみたい！<br>いつもの学習をがんばろう。</p>";
            document.getElementById('next-route-btn').style.display = 'none';
            return;
        }

        let isLocked = false;
        let nextAvailableFound = false;

        dailyRouteData.forEach((route, index) => {
            const isCleared = currentProgressData[route.stepIndex] === true;
            
            const div = document.createElement('div');
            div.className = `route-item ${isCleared ? 'cleared' : ''} ${isLocked ? 'locked' : ''}`;
            div.setAttribute('data-step-index', String(route.stepIndex));
            
            const checkboxHtml = `<div class="checkbox">${isCleared ? '✔' : ''}</div>`;
            const infoHtml = `<div style="flex-grow:1; margin-left:10px;">
                                <div style="font-weight:bold;">${escapeHtml(formatUnitSheetDisplayLabel(route.unitName))}</div>
                                <div style="font-size:12px; color:#aaa;">${escapeHtml(route.qFormat)} / ${escapeHtml(route.aFormat)}</div>
                              </div>`;
            
            div.innerHTML = checkboxHtml + infoHtml;

            // クリックで直接挑戦（復習 or アンロック済みなら可能）
            if (isCleared || (!isCleared && !isLocked)) {
                div.style.cursor = "pointer";
                div.onclick = () => startRouteStep(route);
            }

            container.appendChild(div);

            // 未クリアを見つけたら、それ以降はロックする
            if (!isCleared) {
                isLocked = true;
                if (!nextAvailableFound) {
                    nextAvailableFound = true;
                }
            }
        });

        // 「次の内容に取り組む」ボタンの制御
        const nextBtn = document.getElementById('next-route-btn');
        if (!nextAvailableFound) {
            nextBtn.style.display = 'none'; // 全てクリア済み
        } else {
            nextBtn.style.display = 'block';
        }
        highlightNextTrainingRouteItem_();
    }

    function highlightNextTrainingRouteItem_() {
        const container = document.getElementById('route-container');
        if (!container) return;
        container.querySelectorAll('.route-item-next').forEach(function (el) {
            el.classList.remove('route-item-next');
        });
        const nextRoute = dailyRouteData.find(function (r) {
            return !currentProgressData[r.stepIndex];
        });
        if (!nextRoute) return;
        const target = container.querySelector('.route-item[data-step-index="' + String(nextRoute.stepIndex) + '"]');
        if (!target || target.classList.contains('locked')) return;
        target.classList.add('route-item-next');
        try {
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {}
    }

    // 「次の内容に取り組む」ボタンを押したとき
    function startNextRoute() {
        // 未クリアで一番上にあるものを探す
        const nextRoute = dailyRouteData.find(r => !currentProgressData[r.stepIndex]);
        if (nextRoute) {
            startRouteStep(nextRoute);
        }
    }

    function renderTrainingMenuPicker() {
      const box = document.getElementById('training-menu-picker');
      if (!box) return;
      box.innerHTML = "<p style='text-align:center;color:#888;'>よみこみ中...</p>";
      fetchAppSettings().then(d => {
        const settings = (d && d.status === 'success' && d.settings) ? d.settings : {};
        let html = "<div class='training-menu-picker-inner'>";
        let shown = 0;
        for (let m = 1; m <= 12; m++) {
          if (!parseTrainingMenuEnabledClient(settings['特訓メニュー' + m + '_有効'])) continue;
          shown++;
          const label = String(settings['特訓メニュー' + m + '_表示名'] || '').trim() || ('特訓メニュー' + m);
          const style = getTrainingMenuButtonStyle(getTrainingMenuColor(settings, m));
          html += `<button type="button" class="submit-btn training-menu-btn-colored" style="min-height:48px;padding:10px;font-size:15px;${style}" onclick="selectTrainingMenu(${m})">${escapeHtml(label)}</button>`;
        }
        html += "</div>";
        if (!shown) {
          box.innerHTML = "<p style='text-align:center;color:#888;'>表示できる特訓メニューがありません。<br>おうちの人に「管理メニュー」で登録してもらってね。</p>";
        } else {
          box.innerHTML = html;
        }
      }).catch(() => { box.innerHTML = "<p style='color:#f88;'>読み込みに失敗しました</p>"; });
    }

    function selectTrainingMenu(menuId) {
      currentTrainingMenuId = menuId;
      const user = JSON.parse(localStorage.getItem('app_kid_user'));
      document.getElementById('training-menu-picker').style.display = 'none';
      document.getElementById('route-container').style.display = 'block';
      document.getElementById('route-container').innerHTML = "<p>ルートを確認中...</p>";
      const titleHint = document.querySelector("#section-training > p");
      if (titleHint) titleHint.textContent = "つぎに取り組むセットをえらんでね";
      fetchTrainingRoute(user.id);
    }

    // 指定されたルートステップを開始する準備
    function startRouteStep(route) {
        document.getElementById('route-container').innerHTML = "<p>問題データを準備中...</p>";
        isTrainingMode = true;
        currentTrainingStepIndex = route.stepIndex;

        let mappedFormat = "en_to_ja";
        let mappedAnsType = "4choice";
        let mappedOrder = route.mode ? (route.mode === "ランダム" ? "random" : "normal") : "random";
        let mappedBlank = route.blankCount || "";
        
        if (route.qFormat === "日本語→英単語") mappedFormat = "ja_to_en";
        else if (route.qFormat === "日本語→英語（並び替え）" || route.qFormat === "並び替え（日本語付き）") mappedFormat = "ja_to_en_sort";
        else if (route.qFormat === "英単語→日本語") mappedFormat = "en_to_ja";
        else if (route.qFormat === "音声→日本語") mappedFormat = "en_audio_to_ja";
        else if (route.qFormat === "音声→英単語") mappedFormat = "qaudio_to_en";
        else if (route.qFormat === "疑問文→英語") mappedFormat = "qtext_to_en";
        else if (route.qFormat === "英語読み上げ→英語") mappedFormat = "en_audio_to_en";
        else if (route.qFormat === "英語→英語" || route.qFormat === "英単語→英単語") mappedFormat = "en_to_en";
        
        if (route.aFormat === "タイピング") mappedAnsType = "typing";
        else if (route.aFormat === "タイピング（イニシャル）") mappedAnsType = "initial_typing";
        else if (route.aFormat === "タイピング（穴埋め）") mappedAnsType = "sheet_fill_typing";
        else if (route.aFormat === "音声") mappedAnsType = "voice";
        else if (route.aFormat === "音声入力（イニシャル）") mappedAnsType = "initial_voice";
        else if (route.aFormat === "音声入力（穴埋め）") mappedAnsType = "sheet_fill_voice";
        else if (route.aFormat === "タイピング（フラッシュ）") mappedAnsType = "flash_typing";
        else if (route.aFormat === "音声入力（フラッシュ）") mappedAnsType = "flash_voice";
        else if (route.aFormat === "穴埋め4択") mappedAnsType = "fill_4choice";
        else if (route.aFormat === "穴埋めタイピング") mappedAnsType = "fill_typing";
        else if (route.aFormat === "すべて用いる") mappedAnsType = "sort_all";
        else if (route.aFormat === "不要語混入") mappedAnsType = "sort_dummy";
        else if (route.aFormat === "不足語補足") mappedAnsType = "sort_missing";

        prefetchMaterials().then(() => {
            let foundModeId = null;
            let foundModeName = "";
            let resolvedUnitName = "";
            const isKanjiRoute =
              (typeof isKanjiTrainingQFormat_ === "function" && isKanjiTrainingQFormat_(route.qFormat)) ||
              /漢字/.test(String(route.qFormat || "")) ||
              /採点/.test(String(route.aFormat || "")) ||
              /送り仮名選択|読み仮名タイプ|書いて問題に回答|書き順チェック|熟語読み方選択/.test(String(route.qFormat || ""));
            const routeUnitRaw = String(route.unitName || "");
            const routeUnitNorm = normalizeUnitNameForCompare(routeUnitRaw);
            const preferJukugo =
              (typeof isKanjiJukugoTrainingQFormat_ === "function" && isKanjiJukugoTrainingQFormat_(route.qFormat)) ||
              /漢字熟語|熟語読み方選択/.test(String(route.qFormat || ""));
            const preferStandardKanji = isKanjiRoute && !preferJukugo;
            let fallbackMat = null;
            for (let m of materialsData) {
                const units = Array.isArray(m.units) ? m.units : [];
                const exact = units.find(u => String(u) === routeUnitRaw);
                const fuzzy = exact || units.find(u => normalizeUnitNameForCompare(u) === routeUnitNorm);
                if (!fuzzy) continue;
                if (!fallbackMat) {
                  fallbackMat = { modeId: m.modeId, modeName: m.modeName, unit: String(fuzzy), category: m.category };
                }
                const isJuk = /熟語/.test(String(m.modeName || ""));
                if (preferJukugo && isJuk) {
                  foundModeId = m.modeId;
                  foundModeName = m.modeName;
                  resolvedUnitName = String(fuzzy);
                  break;
                }
                if (preferStandardKanji && (m.category === "kanji" || /漢字/.test(String(m.modeName || ""))) && !isJuk) {
                  foundModeId = m.modeId;
                  foundModeName = m.modeName;
                  resolvedUnitName = String(fuzzy);
                  break;
                }
                if (!isKanjiRoute) {
                  foundModeId = m.modeId;
                  foundModeName = m.modeName;
                  resolvedUnitName = String(fuzzy);
                  break;
                }
            }
            if (!foundModeId && fallbackMat) {
              foundModeId = fallbackMat.modeId;
              foundModeName = fallbackMat.modeName;
              resolvedUnitName = fallbackMat.unit;
            }
            if(!foundModeId) {
                alert(`「${formatUnitSheetDisplayLabel(route.unitName)}」のデータが見つかりませんでした。`);
                fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
                return;
            }
            currentUnitName = resolvedUnitName || route.unitName;
            currentModeName = foundModeName;

            if (isKanjiRoute) {
              const mappedKanji = (typeof trainingRouteLabelsToInternal === "function")
                ? trainingRouteLabelsToInternal(route.qFormat, route.aFormat)
                : { format: "write_kanji" };
              let kanjiFormatMode = mappedKanji.format || "write_kanji";
              if (kanjiFormatMode === "kanji_hand") kanjiFormatMode = "write_kanji";
              try {
                if (typeof LS_KANJI_QUIZ_FORMAT !== "undefined") {
                  localStorage.setItem(LS_KANJI_QUIZ_FORMAT, kanjiFormatMode);
                } else {
                  localStorage.setItem("app_kanji_quiz_format_v1", kanjiFormatMode);
                }
              } catch (_eFmt) {}
              const quizFetchBody = {
                action: "get_kanji_quiz_questions",
                modeId: foundModeId,
                unitName: currentUnitName,
                setId: "",
                formatMode: kanjiFormatMode,
                choiceCount: 4,
                includeNoneOption: false
              };
              fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_kanji_quiz_sets", modeId: foundModeId, unitName: currentUnitName }) })
              .then(r => r.json()).then(d => {
                if (d.status !== "success") throw new Error(d.message || "漢字セット取得失敗");
                const sets = Array.isArray(d.sets) ? d.sets : [];
                if (!sets.length) throw new Error("セットが見つかりません");
                const first = sets[0];
                quizFetchBody.setId = String(first.setId || "");
                return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify(quizFetchBody) });
              })
              .then(r => r.json()).then(q => {
                if (q.status !== "success") throw new Error(q.message || "漢字問題取得失敗");
                var raw = Array.isArray(q.questions) ? q.questions : [];
                var prep = prepareKanjiQuizQuestionsForPlay(raw, kanjiFormatMode);
                if (!prep) throw new Error("この形式の問題がありません");
                startKanjiQuizPlay({
                  modeId: foundModeId,
                  modeName: foundModeName,
                  unitName: currentUnitName,
                  setId: String((q.setId != null) ? q.setId : quizFetchBody.setId),
                  allQuestions: raw,
                  formatMode: prep.formatMode,
                  isTrainingMode: true,
                  trainingStepIndex: currentTrainingStepIndex,
                  trainingMenuId: currentTrainingMenuId
                });
              })
              .catch(e => {
                alert("特訓用の漢字問題取得に失敗しました: " + (e.message || e));
                fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
              });
              return;
            }

            const cacheKey = `app_cached_questions_${foundModeId}_${currentUnitName}`;
            const cached = localStorage.getItem(cacheKey);

            const processData = (d) => {
                if(d.status==="success"){ 
                    currentQuestions = d.questions;
                    
                    document.getElementById('setting-format').innerHTML = `<option value="${mappedFormat}">${route.qFormat}</option>`;
                    document.getElementById('setting-answer-type').innerHTML = `<option value="${mappedAnsType}">${route.aFormat}</option>`;
                    document.getElementById('setting-order').value = mappedOrder;
                    document.getElementById('setting-play-mode').value = "normal";
                    if (mappedAnsType.startsWith("fill_") && mappedBlank) {
                      const blankSelect = document.getElementById('setting-blank-count');
                      if (blankSelect) {
                        const exists = Array.from(blankSelect.options).some(o => o.value === String(mappedBlank));
                        if (!exists) blankSelect.insertAdjacentHTML('beforeend', `<option value="${mappedBlank}">${mappedBlank} 文字 かくす</option>`);
                        blankSelect.value = String(mappedBlank);
                      }
                    }
                    
                    prepareQuiz();
                } else {
                    alert("取得失敗: " + d.message);
                    fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
                }
            };

            if (cached) {
                try {
                    const d = JSON.parse(cached);
                    processData(d);
                    return;
                } catch(e) {}
            }

            fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_questions", modeId: foundModeId, unitName: currentUnitName }) })
            .then(r=>r.json()).then(d=>{ 
                if (d.status === "success") localStorage.setItem(cacheKey, JSON.stringify(d));
                processData(d);
            }).catch(e => {
                alert("通信エラーが発生しました。");
                fetchTrainingRoute(JSON.parse(localStorage.getItem('app_kid_user')).id);
            });
        });
    }


    // ====== 景品・もちもの（先に画面表示＋短いキャッシュで待ち時間を短縮） ======
    var __rewardsListCache = null;
    var __rewardsListCacheAt = 0;
    var __inventoryListCache = null;
    var __inventoryListCacheUserId = "";
    var __inventoryListCacheAt = 0;
    var REWARD_LIST_CACHE_MS_ = 120000;

    function invalidateInventoryListCache_() {
      __inventoryListCache = null;
      __inventoryListCacheUserId = "";
      __inventoryListCacheAt = 0;
    }

    function loadTrainingMenuAdmin() {
      const pin = getTrainingAdminPin();
      setTrainingAdminMessage("読み込み中...", true);
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") {
          setTrainingAdminMessage(d.message || "エラー", false);
          return;
        }
        trainingAdminData = d;
        document.getElementById('training-admin-pin-panel').style.display = "none";
        document.getElementById('training-admin-main').style.display = "block";
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
      const colors = trainingAdminData.colorPresets || TRAINING_MENU_DEFAULT_COLORS.map(function (c, i) { return { id: "c" + i, color: c }; });
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
      const orig = btn ? toggleBtnLoading(btn, true) : null;
      const stopLoading = function () {
        if (btn && btn.isConnected) toggleBtnLoading(btn, false, orig);
      };
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({
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
        invalidateAppSettingsCache();
        return fetchAppSettings().then(function () {
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
            const p = trainingRouteLabelsToInternal(r.qFormat, r.aFormat);
            return isLegacyFillBlankAnswerType(p.ansType) && r.blankCount !== "" && r.blankCount != null ? "<br>隠す:" + escapeHtml(String(r.blankCount)) : "";
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
      const parsed = trainingRouteLabelsToInternal(r.qFormat, r.aFormat);
      const isFillBlankRoute = isLegacyFillBlankAnswerType(parsed.ansType);
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
        const modeName = getTrainingModeNameForUnit(unit, trainingAdminData.materials);
        const category = getTrainingCategoryForUnit(unit, trainingAdminData.materials);
        const formats = unit ? getLearnerFormatOptions(modeName, category) : [];
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
        const modeName = getTrainingModeNameForUnit(unit, trainingAdminData.materials);
        const answers = format ? getLearnerAnswerOptions(format, modeName) : [];
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
        const show = isLegacyFillBlankAnswerType(ansType);
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
      const combos = getAllEnglishBasePointCombos();
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
      const orig = saveBtn ? toggleBtnLoading(saveBtn, true) : null;
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({
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
        invalidateAppSettingsCache();
        const modeLabel = modeCategory === "expression" ? "表現" : "単語";
        setTrainingAdminMessage("点数を保存しました（" + settingKey + " / " + modeLabel + " = " + pointValue + "）", true);
      }).catch(function () { setTrainingAdminMessage("通信エラー", false); })
      .finally(function () {
        if (saveBtn && saveBtn.isConnected) toggleBtnLoading(saveBtn, false, orig);
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
      const payload = {
        targetUsers: (document.getElementById('train-admin-route-users') || {}).value || "全員",
        unitName: unitName,
        qFormat: qFormat,
        aFormat: aFormat,
        mode: (document.getElementById('train-admin-route-mode') || {}).value || "ランダム",
        blankCount: isLegacyFillBlankAnswerType(ansType) && blankEl ? (blankEl.value || "") : ""
      };
      if (!payload.unitName || !payload.qFormat || !payload.aFormat) {
        setTrainingAdminMessage("単元・問題形式・こたえ方を選んでください", false);
        return null;
      }
      if (!isValidTrainingRouteCombo(payload.unitName, payload.qFormat, payload.aFormat, trainingAdminData.materials)) {
        setTrainingAdminMessage("選んだ組み合わせはこの単元では使えません。形式とこたえ方を確認してください", false);
        return null;
      }
      if (isLegacyFillBlankAnswerType(ansType) && (!payload.blankCount || Number(payload.blankCount) < 1)) {
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
      return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_training_menu_admin", adminPin: pin }) })
      .then(r => r.json()).then(d => {
        if (d.status !== "success") throw new Error(d.message || "再読み込み失敗");
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
      });
    }

    function saveTrainingAdminRoutesBatch() {
      if (!trainingAdminEditingMenuId) return;
      const menuId = trainingAdminEditingMenuId;
      const pin = getTrainingAdminPin();
      const btn = document.getElementById('training-admin-route-save-btn');
      const orig = btn ? toggleBtnLoading(btn, true) : null;
      fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({
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
        invalidateTrainingRouteCache(menuId);
        return reloadTrainingAdminData(menuId, d.message || "ルートを保存しました", true);
      }).catch(function (e) { setTrainingAdminMessage(e.message || "通信エラー", false); })
      .finally(function () {
        if (btn && btn.isConnected) toggleBtnLoading(btn, false, orig);
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

    function getExternalAdminPin() {
      const el = document.getElementById('external-admin-pin-input');
      const v = el ? String(el.value || "").trim() : "";
      return v || parentAdminPinSession || "";
    }
