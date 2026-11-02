/**
 * 入力欄＋隣接「確定」ボタンの Enter ショートカット（アプリ全体）
 * - 対象: 管理者PINログイン、設定・管理のテキスト入力など
 * - 除外: 学習モード中・クイズ中・漢字練習中・単語迷宮ゲーム中
 */
(function (global) {
  "use strict";

  var EXCLUDED_ACTIVE_SECTION_IDS = {
    "section-quiz": 1,
    "section-kanji-quiz-play": 1,
    "section-kanji-practice": 1,
    "section-result": 1,
    "section-dungeon": 1
  };

  function isVisible_(el) {
    if (!el || !el.getClientRects) return false;
    if (el.disabled) return false;
    var style = global.getComputedStyle ? getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return el.getClientRects().length > 0;
  }

  function isExcludedLearningOrGameContext_(input) {
    if (!input) return true;
    if (input.closest && input.closest(
      "#section-quiz, #section-kanji-quiz-play, #section-kanji-practice, #section-result, " +
      "#section-dungeon, #quizPane, #keyboardOverlay, .vk-keyboard, .vk-scale-wrap"
    )) {
      return true;
    }
    // 単語迷宮ゲーム本編中（塔選択は許可したいので game-main 表示中のみ除外）
    if (document.body.classList.contains("in-dungeon-game")) {
      var main = document.getElementById("dungeon-game-main");
      if (main) {
        var disp = main.style.display;
        if (disp !== "none" && disp !== "") return true;
        if ((!disp || disp === "") && isVisible_(main)) return true;
      }
    }
    var active = document.querySelector(".section.active");
    if (active && EXCLUDED_ACTIVE_SECTION_IDS[active.id]) return true;
    return false;
  }

  function isPrimaryActionButton_(btn) {
    if (!btn || btn.disabled) return false;
    if (!isVisible_(btn)) return false;
    if (btn.classList && btn.classList.contains("cancel-btn")) return false;
    var label = String(btn.textContent || btn.value || btn.getAttribute("aria-label") || "").replace(/\s+/g, "");
    if (/キャンセル|やめる|とじる|閉じる|もどる|戻る|中止/.test(label)) return false;
    if (btn.classList && btn.classList.contains("submit-btn")) return true;
    if (btn.type === "submit") return true;
    if (/ログイン|保存|追加|変更|表示|承認|確定|はじめる|スタート|編集|更新|送信|申請|けってい|決定/.test(label)) {
      return true;
    }
    return false;
  }

  function findEnterSubmitButton_(input) {
    var explicit = input.getAttribute("data-enter-submit");
    if (explicit) {
      try {
        var hit = document.querySelector(explicit);
        if (hit && isPrimaryActionButton_(hit)) return hit;
      } catch (_e) {}
    }

    // 直後の兄弟（例: PIN入力の下のログインボタン）
    var sib = input.nextElementSibling;
    while (sib) {
      if (sib.matches && sib.matches("button, input[type='submit'], [role='button']")) {
        if (isPrimaryActionButton_(sib)) return sib;
      }
      if (sib.querySelector) {
        var nested = sib.querySelector("button.submit-btn, button[type='submit'], input[type='submit'], .submit-btn");
        if (nested && isPrimaryActionButton_(nested)) return nested;
      }
      sib = sib.nextElementSibling;
    }

    // 親パネル／モーダル／フォーム内で、入力より後ろにある確定ボタン
    var scope = input.closest(
      "form, [id*='modal'], [id$='-pin-panel'], [id*='pin-panel'], .section, .menu-card, .dungeon-wrap"
    ) || input.parentElement;
    if (!scope) return null;

    var candidates = Array.prototype.slice.call(
      scope.querySelectorAll("button.submit-btn, button[type='submit'], input[type='submit']")
    );
    var following = candidates.filter(function (b) {
      if (!isPrimaryActionButton_(b)) return false;
      return !!(input.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (following.length) return following[0];

    // フォールバック: スコープ内の最初の確定ボタン
    for (var i = 0; i < candidates.length; i++) {
      if (isPrimaryActionButton_(candidates[i])) return candidates[i];
    }
    return null;
  }

  function isEligibleInput_(el) {
    if (!el || el.disabled || el.readOnly) return false;
    var tag = (el.tagName || "").toUpperCase();
    if (tag !== "INPUT") return false; // textarea は改行優先で対象外
    var type = String(el.type || "text").toLowerCase();
    return (
      type === "text" ||
      type === "password" ||
      type === "search" ||
      type === "email" ||
      type === "tel" ||
      type === "url" ||
      type === "number"
    );
  }

  function onKeyDown_(e) {
    if (!e || e.key !== "Enter") return;
    if (e.isComposing || e.keyCode === 229) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    var input = e.target;
    if (!isEligibleInput_(input)) return;
    if (isExcludedLearningOrGameContext_(input)) return;

    var btn = findEnterSubmitButton_(input);
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      btn.click();
    } catch (_err) {}
  }

  function bind_() {
    if (document.__enterSubmitShortcutBound) return;
    document.__enterSubmitShortcutBound = true;
    document.addEventListener("keydown", onKeyDown_, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind_);
  } else {
    bind_();
  }

  global.EnterSubmitShortcut = {
    findButton: findEnterSubmitButton_,
    isExcluded: isExcludedLearningOrGameContext_
  };
})(typeof window !== "undefined" ? window : this);
