/**
 * アプリ状態・localStorage（canonical のみ）。
 */
(function (global) {
  const KID_USER = 'app_kid_user';

  function getKidUser() {
    try {
      const raw = localStorage.getItem(KID_USER);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return global.AppNormalizeUser ? global.AppNormalizeUser.normalizeUser(u) : u;
    } catch (_e) {
      return null;
    }
  }

  function setKidUser(user) {
    const normalized = global.AppNormalizeUser ? global.AppNormalizeUser.normalizeUser(user) : user;
    localStorage.setItem(KID_USER, JSON.stringify(normalized));
    return normalized;
  }

  function getUserIdForPref() {
    const u = getKidUser();
    return u && u.id ? String(u.id) : 'guest';
  }

  function getUserPref(key, defaultVal) {
    const val = localStorage.getItem(`${getUserIdForPref()}_${key}`);
    return val !== null ? val : defaultVal;
  }

  function setUserPref(key, val) {
    localStorage.setItem(`${getUserIdForPref()}_${key}`, val);
  }

  function getCache(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function setCache(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  global.AppState = {
    KID_USER,
    getKidUser,
    setKidUser,
    getUserIdForPref,
    getUserPref,
    setUserPref,
    getCache,
    setCache
  };
})(typeof window !== 'undefined' ? window : globalThis);
