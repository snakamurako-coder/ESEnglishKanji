/**
 * get_app_settings 応答を canonical 形に正規化する。
 */
(function (global) {
  function normalizeEnglishBasePoint(raw) {
    if (raw && typeof raw === 'object' && ('word' in raw || 'expression' in raw)) {
      return {
        word: Number(raw.word) || 0,
        expression: Number(raw.expression) || 0
      };
    }
    const n = Number(raw);
    if (!isNaN(n)) return { word: n, expression: n };
    return { word: 0, expression: 0 };
  }

  function normalizeSettingsMap(settings) {
    if (!settings || typeof settings !== 'object') return {};
    const out = Object.assign({}, settings);
    Object.keys(out).forEach(function (key) {
      if (/^基本Pt_/.test(key) || key.indexOf('基本ポイント') >= 0) {
        out[key] = normalizeEnglishBasePoint(out[key]);
      }
    });
    return out;
  }

  function normalizeSettingsResponse(resp) {
    if (!resp || resp.status !== 'success') return resp;
    return Object.assign({}, resp, {
      settings: normalizeSettingsMap(resp.settings || {})
    });
  }

  global.AppNormalizeSettings = {
    normalizeSettingsMap,
    normalizeSettingsResponse,
    normalizeEnglishBasePoint
  };
})(typeof window !== 'undefined' ? window : globalThis);
