# codereduction Canonical Schema

このフォルダは `index.html` / `コード.js` の軽量化版です。**コアは最新フォーマットのみ**を前提とし、旧形式の解釈は `js/adapters/` と一回限りマイグレーションに閉じます。

## users 行 JSON

| フィールド | 形 |
|-----------|-----|
| `lastStudyJson` | `{ [unitOrScopeId]: ISO8601 }` |
| `dailyPointsJson` | `{ "YYYY-MM-DD": number }` |
| `trainingProgressJson` | `{ [date]: { [menuId "1".."12"]: { [stepIndex]: true } } }` |
| `stopwatchJson` | `{ home, external: { running, startedAtMs, elapsedMs } }` |
| `historyJson` | メタのみ（`__sessionSubmits` 等）。英語/漢字本体は別シート |

## サーバー側シート

- 英語履歴: `english_unit_history`（`userId, unitId, unitHistoryJson, updatedAt`）
- 漢字履歴: `kanji_history`（bucket: `__kanjiChallenge` / `__kanjiWeak` / `__kanjiNigatePass`）
- 設定: `アプリ設定` 3列（設定名, 単語, 表現）
- 特訓: `特訓メニュー1`〜`12` のみ

## クライアント localStorage

| キー | 用途 |
|------|------|
| `app_kid_user` | セッション |
| `app_schema_version` | マイグレーション完了フラグ（現在 `2`） |
| `app_cached_kanji_quiz_sets_v2_*` | 漢字セットキャッシュ |
| `{userId}_{prefKey}` | ユーザー別設定（接頭辞なしキーは非対応） |
| `quiz_recovery_draft_v1` | 英語復帰 draft（version>=2, ID列挙） |
| `kanji_quiz_recovery_draft_v1` | 漢字復帰 draft |

## 削除した互換（コアに存在しない）

- pref 接頭辞なしフォールバック
- `pen_canvas_height_px` 換算
- 基本点の旧1列数値
- `historyJson.__kanjiChallenge` ローカルフォールバック
- draft v1（全文 questions）
- 漢字キャッシュ v1 キー
- `window.KP_HTML` 埋め込み（→ `assets/kp-practice.html`）
- GAS: flat 特訓進捗、users JSON からの履歴 migrate ランタイム分岐

## ファイル構成

- `index.html` — 薄いシェル
- `css/app.css` — スタイル
- `js/main.js` — 起動・マイグレーション
- `js/adapters/*` — 旧データ正規化（一回限り + API 入口）
- `js/app.js` — アプリ本体（旧 index.html 内 JS から legacy 除去）
- `js/quiz/**`, `js/*.js` — 機能別分割（参照・今後の ES module 化用）
- `gas/コード.js` — slim GAS API
- `gas/migrateOnce.gs` — 管理者向け一括データ移行
