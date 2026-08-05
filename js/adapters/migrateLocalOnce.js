/**
 * 旧 localStorage を canonical 形式へ一度だけ変換する。
 * コアは app_schema_version >= SCHEMA_VERSION 以降、旧キーを読まない。
 */
(function (global) {
  const SCHEMA_VERSION = 2;
  const FLAG = 'app_schema_version';

  const LEGACY_PREF_KEYS = [
    'input_method_mode', 'vk_scale_pct', 'vk_key_font_px', 'answer_sound_enabled',
    'pen_width', 'pen_mode', 'pen_guide_spread_pct', 'pen_guide_show', 'pen_canvas_max_width_px',
    'pen_advanced_visible', 'ipad_stylus_optimize', 'kanji_quiz_hw_dominant_hand',
    'app_kanji_quiz_format_v1', 'pen_canvas_height_px'
  ];

  const LEGACY_CACHE_PREFIXES = [
    'app_cached_kanji_quiz_sets_',
  ];

  function migratePrefsForAllUsers() {
    let userIds = [];
    try {
      const raw = localStorage.getItem('app_kid_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.id) userIds.push(String(u.id));
      }
    } catch (_e) {}
    // 旧: 接頭辞なし pref → 現在ログイン中ユーザーへ移す
    if (!userIds.length) return;
    const uid = userIds[0];
    LEGACY_PREF_KEYS.forEach(function (key) {
      const legacyVal = localStorage.getItem(key);
      if (legacyVal === null) return;
      const scoped = `${uid}_${key}`;
      if (localStorage.getItem(scoped) === null) {
        localStorage.setItem(scoped, legacyVal);
      }
      localStorage.removeItem(key);
    });
  }

  function migrateKanjiSetCacheKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf('app_cached_kanji_quiz_sets_') === 0 && k.indexOf('_v2_') < 0) {
        keys.push(k);
      }
    }
    keys.forEach(function (oldKey) {
      const neu = oldKey.replace('app_cached_kanji_quiz_sets_', 'app_cached_kanji_quiz_sets_v2_std_');
      if (localStorage.getItem(neu) === null) {
        localStorage.setItem(neu, localStorage.getItem(oldKey));
      }
      localStorage.removeItem(oldKey);
    });
  }

  function migrateHandScoreWeightsFromSettings() {
    if (localStorage.getItem('app_cached_kanji_hand_score_weights')) return;
    const legacy = localStorage.getItem('app_cached_settings');
    if (!legacy) return;
    try {
      const d = JSON.parse(legacy);
      const w = d && d.settings && d.settings['漢字手書き配点'];
      if (w) localStorage.setItem('app_cached_kanji_hand_score_weights', JSON.stringify(w));
    } catch (_e) {}
  }

  function migrateQuizDraftV1() {
    ['quiz_recovery_draft_v1', 'kanji_quiz_recovery_draft_v1'].forEach(function (key) {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (!d || d.version >= 2) return;
        if (Array.isArray(d.filteredQuestions) && !d.filteredQuestionIds) {
          d.filteredQuestionIds = d.filteredQuestions.map(function (q, i) {
            return String((q && (q.id || q.通し番号)) || ('q_' + i));
          });
          delete d.filteredQuestions;
          d.version = 2;
          localStorage.setItem(key, JSON.stringify(d));
        }
      } catch (_e) {}
    });
  }

  function migrateLocalOnce() {
    try {
      const ver = parseInt(localStorage.getItem(FLAG) || '0', 10);
      if (ver >= SCHEMA_VERSION) return;
      migratePrefsForAllUsers();
      migrateKanjiSetCacheKeys();
      migrateHandScoreWeightsFromSettings();
      migrateQuizDraftV1();
      localStorage.setItem(FLAG, String(SCHEMA_VERSION));
    } catch (e) {
      console.warn('migrateLocalOnce failed:', e);
    }
  }

  global.AppMigrate = { migrateLocalOnce, SCHEMA_VERSION };
})(typeof window !== 'undefined' ? window : globalThis);
