/**
 * API から受け取ったユーザーオブジェクトを canonical 形に正規化する。
 */
(function (global) {
  function parseJsonField(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(String(raw)); } catch (_e) { return fallback; }
  }

  function normalizeTrainingProgress(raw) {
    const tp = parseJsonField(raw, {});
    if (!tp || typeof tp !== 'object') return {};
    const out = {};
    Object.keys(tp).forEach(function (dateKey) {
      const block = tp[dateKey];
      if (!block || typeof block !== 'object') return;
      // flat legacy: { stepIndex: true } → menu "1"
      const looksFlat = Object.keys(block).every(function (k) {
        return block[k] === true || block[k] === false;
      }) && !Object.keys(block).some(function (k) { return /^\d+$/.test(k) && typeof block[k] === 'object'; });
      if (looksFlat && Object.keys(block).length && typeof block['1'] !== 'object') {
        out[dateKey] = { '1': Object.assign({}, block) };
      } else {
        out[dateKey] = block;
      }
    });
    return out;
  }

  function stripHistoryToMeta(historyJson) {
    const h = parseJsonField(historyJson, {});
    if (!h || typeof h !== 'object') return {};
    const meta = {};
    Object.keys(h).forEach(function (k) {
      if (k.indexOf('__') === 0) meta[k] = h[k];
    });
    return meta;
  }

  function normalizeUser(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    return Object.assign({}, raw, {
      historyJson: stripHistoryToMeta(raw.historyJson),
      lastStudyJson: parseJsonField(raw.lastStudyJson, {}),
      dailyPointsJson: parseJsonField(raw.dailyPointsJson, {}),
      trainingProgressJson: normalizeTrainingProgress(raw.trainingProgressJson),
      stopwatchJson: parseJsonField(raw.stopwatchJson, { home: { running: false, startedAtMs: 0, elapsedMs: 0 }, external: { running: false, startedAtMs: 0, elapsedMs: 0 } })
    });
  }

  global.AppNormalizeUser = { normalizeUser, stripHistoryToMeta, normalizeTrainingProgress };
})(typeof window !== 'undefined' ? window : globalThis);
