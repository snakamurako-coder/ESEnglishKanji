    function renderRewardsList_(rewards) {
        const c = document.getElementById('rewards-container');
        c.innerHTML = "";
        (rewards || []).forEach(r => {
            const div = document.createElement('div'); div.className = "item-card";
            const limitLine = r.limitMinutes > 0 ? `<div style="font-size:13px;color:#90CAF9;margin-bottom:8px;">制限時間: ${r.limitMinutes} 分</div>` : "";
            const safeId = String(r.id || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            const safeName = String(r.name || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            div.innerHTML = `<div class="item-title">🎁 ${r.name}</div><div style="color: gold; font-weight: bold; margin-bottom: 10px;">必要ポイント: ${r.points} Pt</div>${limitLine}<div style="font-size: 14px; color: #aaa; margin-bottom: 15px;">${r.desc}</div><button class="submit-btn btn-orange" style="width: 100%; padding: 10px; font-size: 18px;" onclick="exchangeReward('${safeId}', '${safeName}', ${Number(r.points) || 0}, this)">交換する</button>`;
            c.appendChild(div);
        });
        if (!(rewards || []).length) c.innerHTML = "<p>いま交換できる景品がありません。</p>";
    }

    function fetchRewardsList_() {
        return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_rewards" }) })
          .then(r => r.json())
          .then(d => {
            if (d && d.status === "success") {
              __rewardsListCache = d.rewards || [];
              __rewardsListCacheAt = Date.now();
            }
            return d;
          });
    }

    function loadRewards(btn) {
        const origText = toggleBtnLoading(btn, true);
        switchSection('section-rewards');
        const now = Date.now();
        const cacheFresh = __rewardsListCache && (now - __rewardsListCacheAt) < REWARD_LIST_CACHE_MS_;
        if (cacheFresh) {
            renderRewardsList_(__rewardsListCache);
            toggleBtnLoading(btn, false, origText);
            fetchRewardsList_().then(d => {
                const sec = document.getElementById('section-rewards');
                if (d && d.status === "success" && sec && sec.classList.contains('active')) {
                    renderRewardsList_(__rewardsListCache);
                }
            }).catch(() => {});
            return;
        }
        document.getElementById('rewards-container').innerHTML = "<p>よみこみ中...</p>";
        fetchRewardsList_()
        .then(d => {
            toggleBtnLoading(btn, false, origText);
            if (d && d.status === "success") renderRewardsList_(__rewardsListCache);
            else document.getElementById('rewards-container').innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
        }).catch(() => {
            toggleBtnLoading(btn, false, origText);
            document.getElementById('rewards-container').innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
        });
    }

    function exchangeReward(rewardId, rewardName, points, btn) { 
        const user = JSON.parse(localStorage.getItem('app_kid_user')); 
        if(user.points < points) { alert("ポイントが足りないよ！もっと勉強してポイントをためよう！"); return; } 
        if(!confirm(`「${rewardName}」と交換しますか？\n（${points} Ptへります）`)) return; 
        const origText = toggleBtnLoading(btn, true); 
        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "exchange_reward", userId: user.id, rewardId: rewardId }) })
        .then(r=>r.json()).then(d=>{ 
            toggleBtnLoading(btn, false, origText); 
            if(d.status==="success") { 
                alert(d.message); 
                user.points = d.newPoints; saveAppKidUserToLocal(user);
                invalidateInventoryListCache_();
                showHome(user); 
            } else { alert(d.message); } 
        }).catch(e => { alert("通信エラーが発生しました。"); toggleBtnLoading(btn, false, origText); }); 
    }

    function fetchInventoryList_(userId) {
        return fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "get_inventory", userId: userId }) })
          .then(r => r.json())
          .then(d => {
            if (d && d.status === "success") {
              __inventoryListCache = d.inventory || [];
              __inventoryListCacheUserId = String(userId);
              __inventoryListCacheAt = Date.now();
            }
            return d;
          });
    }

    function loadInventory(btn) { 
        const origText = toggleBtnLoading(btn, true);
        switchSection('section-inventory');
        const user = JSON.parse(localStorage.getItem('app_kid_user'));
        const now = Date.now();
        const cacheFresh = __inventoryListCache
          && __inventoryListCacheUserId === String(user.id)
          && (now - __inventoryListCacheAt) < REWARD_LIST_CACHE_MS_;
        if (cacheFresh) {
            userInventoryData = __inventoryListCache;
            showAllInventory = false;
            renderInventory();
            toggleBtnLoading(btn, false, origText);
            fetchInventoryList_(user.id).then(d => {
                if (d && d.status === "success") {
                  userInventoryData = __inventoryListCache;
                  const sec = document.getElementById('section-inventory');
                  if (sec && sec.classList.contains('active')) renderInventory();
                }
            }).catch(() => {});
            return;
        }
        document.getElementById('inventory-container').innerHTML = "<p>よみこみ中...</p>";
        fetchInventoryList_(user.id)
        .then(d => {
            toggleBtnLoading(btn, false, origText);
            if (d && d.status === "success") {
                userInventoryData = __inventoryListCache;
                showAllInventory = false;
                renderInventory();
            } else {
                document.getElementById('inventory-container').innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
            }
        }).catch(() => {
            toggleBtnLoading(btn, false, origText);
            document.getElementById('inventory-container').innerHTML = "<p>よみこみに失敗しました。もういちどためしてね。</p>";
        });
    }

    function renderInventory() { 
        const c = document.getElementById('inventory-container'); 
        c.innerHTML = ""; 
        const btn = document.getElementById('toggle-inventory-btn'); 
        btn.innerText = showAllInventory ? "未消化だけ表示する" : "すべて表示する"; 
        let filtered = userInventoryData; 
        if(!showAllInventory) filtered = filtered.filter(i => i.status !== "使用済み"); 
        if(filtered.length === 0) { c.innerHTML = "<p>表示できるアイテムがありません。</p>"; return; } 
        filtered.forEach(item => { 
            const div = document.createElement('div'); div.className = "item-card"; 
            const isUsed = item.status === "使用済み";
            const limitLine = item.limitMinutes > 0 ? `<div style="font-size:13px;color:#90CAF9;">制限時間: ${item.limitMinutes} 分</div>` : "";
            const usedLine = item.usedAt ? `<div style="font-size:12px;color:#aaa;">使用日時: ${new Date(item.usedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>` : "";
            const btnHtml = isUsed ? `<button class="submit-btn btn-gray" style="width: 100%; padding: 10px; font-size: 18px;" disabled>使用済み</button>` : `<button class="submit-btn btn-green" style="width: 100%; padding: 10px; font-size: 18px;" onclick="consumeReward(${item.rowIdx}, this)">使う！</button>`; 
            div.innerHTML = `<div class="item-title">🎒 ${item.rewardName}</div><div style="font-size: 12px; color: #aaa; margin-bottom: 6px;">交換日: ${new Date(item.date).toLocaleString()}</div>${limitLine}${usedLine}${btnHtml}`; 
            c.appendChild(div); 
        }); 
    }

    function toggleInventoryView() { showAllInventory = !showAllInventory; renderInventory(); }

    function consumeReward(rowIdx, btn) { 
        if(!confirm("本当にこの景品を使いますか？\n※おうちの人に確認してもらってから押してね！")) return; 
        const user = JSON.parse(localStorage.getItem('app_kid_user'));
        const origText = toggleBtnLoading(btn, true); 
        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: "consume_reward", rowIdx: rowIdx, userId: user.id }) })
        .then(r=>r.json()).then(d=>{ 
            toggleBtnLoading(btn, false, origText);
            if(d.status==="success") { 
                alert(d.message); 
                const item = userInventoryData.find(i => i.rowIdx === rowIdx);
                if (item) {
                  item.status = "使用済み";
                  item.usedAt = d.activeTicket ? d.activeTicket.usedAt : new Date().toISOString();
                }
                __inventoryListCache = userInventoryData;
                __inventoryListCacheAt = Date.now();
                if (d.activeTicket) setActiveRewardTicket_(d.activeTicket);
                renderInventory(); 
            } else {
                alert(d.message || "使用できませんでした");
            }
        }).catch(e => toggleBtnLoading(btn, false, origText)); 
    }

    // ====== 第2弾：外部学習（申請 → 管理者PIN承認） ======