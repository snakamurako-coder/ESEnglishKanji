/**
 * codereduction 起動エントリ（マイグレーション → app.js の onload へ）。
 */
(function (global) {
  if (global.AppMigrate && typeof global.AppMigrate.migrateLocalOnce === 'function') {
    global.AppMigrate.migrateLocalOnce();
  }

  // verify_kid_pin / get_app_settings の正規化フック（app.js ロード後も有効）
  global.__crNormalizeUserOnVerify = function (user) {
    return global.AppNormalizeUser ? global.AppNormalizeUser.normalizeUser(user) : user;
  };
  global.__crNormalizeSettings = function (resp) {
    return global.AppNormalizeSettings ? global.AppNormalizeSettings.normalizeSettingsResponse(resp) : resp;
  };
})(typeof window !== 'undefined' ? window : globalThis);
