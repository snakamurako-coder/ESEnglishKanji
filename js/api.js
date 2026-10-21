/**
 * GAS API クライアント（action 互換維持）。
 * gasApiFetchJson は app.js 内の実装をラップする。
 */
(function (global) {
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxPVGeRj3lGtFj7qJnNtP-XbovUt0S7nDw-6ZeSn9iP8KfomZwKCrMQIAKS7zoIGmIgew/exec';
  const MEDIATOR_API_URL = 'https://script.google.com/macros/s/AKfycbw3kHj3mGXxB3tDUBtbnA0D2SqDdlsD9T0ef9oO3GRf3-QqqFdBPyBNcPvdXxxFnbqXfQ/exec';

  function postAction(action, payload, opts) {
    const body = Object.assign({ action: action }, payload || {});
    if (typeof global.gasApiFetchJson === 'function') {
      return global.gasApiFetchJson(body, opts);
    }
    if (action === 'export_full_backup' || action === 'import_full_config') {
      return fetch(global.MEDIATOR_API_URL || MEDIATOR_API_URL, {
        method: 'POST',
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); });
    }
    return Promise.resolve({ status: 'success' });
  }

  function postActionNormalized(action, payload, opts) {
    return postAction(action, payload, opts).then(function (resp) {
      if (action === 'get_app_settings' && global.AppNormalizeSettings) {
        return global.AppNormalizeSettings.normalizeSettingsResponse(resp);
      }
      if (action === 'verify_kid_pin' && resp && resp.status === 'success' && resp.user && global.AppNormalizeUser) {
        return Object.assign({}, resp, { user: global.AppNormalizeUser.normalizeUser(resp.user) });
      }
      return resp;
    });
  }

  global.AppApi = {
    GAS_API_URL,
    postAction,
    postActionNormalized
  };
})(typeof window !== 'undefined' ? window : globalThis);
