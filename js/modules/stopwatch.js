/**
 * js/modules/stopwatch.js
 * ストップウォッチおよびご褒美タイマー機能の独立モジュール
 */
(function (global) {
  'use strict';

  const STOPWATCH_MAX_MS = 90 * 60 * 1000;

  const stopwatches = {
    home: { timerId: null, startAt: 0, elapsed: 0, running: false },
    external: { timerId: null, startAt: 0, elapsed: 0, running: false }
  };

  let activeRewardTicket = null;
  let rewardCountdownTimerId = null;

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

  function formatStopwatch(ms) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function formatRewardCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return m + ':' + s;
  }

  function getStopwatchElapsedMs(target) {
    const st = stopwatches[target];
    if (!st) return 0;
    if (st.timerId) return Date.now() - st.startAt;
    return st.elapsed || 0;
  }

  function normalizeStopwatchSlot(slot) {
    const out = { running: false, startAt: 0, elapsed: 0, timerId: null };
    const src = slot || {};
    out.running = !!src.running;
    out.startAt = Number(src.startAt || src.startedAtMs) || 0;
    out.elapsed = Math.max(0, Number(src.elapsed || src.elapsedMs) || 0);
    const now = Date.now();
    if (out.running) {
      if (!out.startAt) out.startAt = now;
      if (now - out.startAt >= STOPWATCH_MAX_MS) {
        out.running = false;
        out.startAt = 0;
        out.elapsed = 0;
      }
    } else if (out.elapsed >= STOPWATCH_MAX_MS) {
      out.elapsed = 0;
      out.startAt = 0;
    }
    return out;
  }

  function applyStopwatchState(target, slot) {
    const st = stopwatches[target];
    if (!st) return;
    if (st.timerId) {
      clearInterval(st.timerId);
      st.timerId = null;
    }
    const norm = normalizeStopwatchSlot(slot);
    st.running = norm.running;
    st.startAt = norm.startAt;
    st.elapsed = norm.elapsed;
    if (norm.running) {
      st.timerId = setInterval(function () {
        enforceStopwatchMaxDuration(target);
        renderStopwatch(target);
      }, 200);
    }
    renderStopwatch(target);
  }

  function applyStopwatchJson(json) {
    const src = json || {};
    applyStopwatchState('home', src.home);
    applyStopwatchState('external', src.external);
  }

  function buildStopwatchPayload(target) {
    const st = stopwatches[target];
    if (!st) return { running: false, startedAtMs: 0, elapsedMs: 0 };
    const running = !!st.timerId;
    return {
      running: running,
      startedAtMs: running ? st.startAt : 0,
      elapsedMs: running ? Math.max(0, Date.now() - st.startAt) : Math.max(0, st.elapsed || 0)
    };
  }

  function syncStopwatchToServer(target, opts) {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
    } catch (_) {}
    if (!user || !user.id) return;
    const payload = buildStopwatchPayload(target);
    if (!user.stopwatchJson) user.stopwatchJson = {};
    user.stopwatchJson[target] = payload;
    saveKidUser(user);

    // Firestore に非同期保存
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        firebase.firestore().collection('users').doc(String(user.id)).set({
          stopwatchJson: user.stopwatchJson
        }, { merge: true }).catch(function () {});
      } catch (_) {}
    }
  }

  function syncAllStopwatchesToServer(keepalive) {
    syncStopwatchToServer('home', { keepalive: keepalive });
    syncStopwatchToServer('external', { keepalive: keepalive });
  }

  function loadStopwatchFromServer(user) {
    if (!user || !user.id) return Promise.resolve();
    if (user.stopwatchJson) {
      applyStopwatchJson(user.stopwatchJson);
      return Promise.resolve();
    }
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore().collection('users').doc(String(user.id)).get()
        .then(function (snap) {
          if (snap.exists && snap.data().stopwatchJson) {
            user.stopwatchJson = snap.data().stopwatchJson;
            saveKidUser(user);
            applyStopwatchJson(user.stopwatchJson);
          }
        }).catch(function () {});
    }
    return Promise.resolve();
  }

  function enforceStopwatchMaxDuration(target) {
    const st = stopwatches[target];
    if (!st || !st.timerId) return;
    if (Date.now() - st.startAt >= STOPWATCH_MAX_MS) {
      if (st.timerId) clearInterval(st.timerId);
      st.timerId = null;
      st.running = false;
      st.startAt = 0;
      st.elapsed = 0;
      syncStopwatchToServer(target);
    }
  }

  function renderStopwatch(target) {
    const el = document.getElementById(`${target}-sw-display`);
    if (!el) return;
    const elapsed = getStopwatchElapsedMs(target);
    el.innerText = formatStopwatch(elapsed);
  }

  function renderHomeStopwatchOrCountdown_() {
    const normal = document.getElementById('home-stopwatch-normal');
    const countdown = document.getElementById('home-reward-countdown');
    if (!normal || !countdown) return;
    if (activeRewardTicket && activeRewardTicket.endsAt) {
      const remain = new Date(activeRewardTicket.endsAt).getTime() - Date.now();
      if (remain > 0) {
        normal.style.display = 'none';
        countdown.style.display = 'block';
        const nameEl = document.getElementById('home-reward-countdown-name');
        const dispEl = document.getElementById('home-reward-countdown-display');
        if (nameEl) nameEl.innerText = activeRewardTicket.rewardName || 'ご褒美';
        if (dispEl) dispEl.innerText = formatRewardCountdown(remain);
        return;
      }
      activeRewardTicket = null;
    }
    normal.style.display = 'block';
    countdown.style.display = 'none';
    renderStopwatch('home');
  }

  function startRewardCountdownTimer_() {
    if (rewardCountdownTimerId) clearInterval(rewardCountdownTimerId);
    rewardCountdownTimerId = setInterval(function () {
      renderHomeStopwatchOrCountdown_();
    }, 1000);
  }

  function setActiveRewardTicket_(ticket) {
    activeRewardTicket = ticket && ticket.endsAt ? ticket : null;
    try {
      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      if (user) {
        user.activeRewardTicket = activeRewardTicket;
        saveKidUser(user);
      }
    } catch (_) {}
    renderHomeStopwatchOrCountdown_();
    startRewardCountdownTimer_();
  }

  function fetchActiveRewardTicket_(user) {
    if (!user || !user.id) return Promise.resolve();
    if (user.activeRewardTicket && user.activeRewardTicket.endsAt) {
      const remain = new Date(user.activeRewardTicket.endsAt).getTime() - Date.now();
      if (remain > 0) {
        setActiveRewardTicket_(user.activeRewardTicket);
        return Promise.resolve();
      } else {
        user.activeRewardTicket = null;
        saveKidUser(user);
      }
    }
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore().collection('users').doc(String(user.id)).get()
        .then(function (snap) {
          if (snap.exists && snap.data().activeRewardTicket) {
            const ticket = snap.data().activeRewardTicket;
            if (ticket.endsAt && new Date(ticket.endsAt).getTime() > Date.now()) {
              setActiveRewardTicket_(ticket);
            }
          }
        }).catch(function () {});
    }
    return Promise.resolve();
  }

  function startStopwatch(target) {
    if (target === 'home' && activeRewardTicket) return;
    const st = stopwatches[target];
    if (!st || st.timerId) return;
    st.startAt = Date.now() - (st.elapsed || 0);
    st.running = true;
    st.timerId = setInterval(function () {
      enforceStopwatchMaxDuration(target);
      renderStopwatch(target);
    }, 200);
    renderStopwatch(target);
    syncStopwatchToServer(target);
  }

  function stopStopwatch(target) {
    const st = stopwatches[target];
    if (!st) return;
    if (st.timerId) {
      clearInterval(st.timerId);
      st.timerId = null;
      st.elapsed = Date.now() - st.startAt;
    }
    st.running = false;
    renderStopwatch(target);
    syncStopwatchToServer(target);
  }

  function resetStopwatch(target) {
    const st = stopwatches[target];
    if (!st) return;
    if (st.timerId) clearInterval(st.timerId);
    st.timerId = null;
    st.startAt = 0;
    st.elapsed = 0;
    st.running = false;
    renderStopwatch(target);
    syncStopwatchToServer(target);
  }

  function clearStopwatchOnLogout() {
    activeRewardTicket = null;
    if (rewardCountdownTimerId) {
      clearInterval(rewardCountdownTimerId);
      rewardCountdownTimerId = null;
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
  }

  // グローバル公開 (HTML のインラインイベントおよび他のJSモジュールから利用可能)
  global.startStopwatch = startStopwatch;
  global.stopStopwatch = stopStopwatch;
  global.resetStopwatch = resetStopwatch;
  global.clearStopwatchOnLogout = clearStopwatchOnLogout;
  global.renderStopwatch = renderStopwatch;
  global.loadStopwatchFromServer = loadStopwatchFromServer;
  global.syncStopwatchToServer = syncStopwatchToServer;
  global.syncAllStopwatchesToServer = syncAllStopwatchesToServer;
  global.formatStopwatch = formatStopwatch;
  global.formatRewardCountdown = formatRewardCountdown;
  global.renderHomeStopwatchOrCountdown_ = renderHomeStopwatchOrCountdown_;
  global.startRewardCountdownTimer_ = startRewardCountdownTimer_;
  global.setActiveRewardTicket_ = setActiveRewardTicket_;
  global.fetchActiveRewardTicket_ = fetchActiveRewardTicket_;

})(window);
