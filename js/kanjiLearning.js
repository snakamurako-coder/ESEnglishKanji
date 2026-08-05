    function setKanjiHwDominantHand(which) {
      setUserPref(USER_PREF_KANJI_HW_DOMINANT, which === 'left' ? 'left' : 'right');
      applyKanjiHwDominantHandToBody();
      syncKanjiHwHandSwitchUI();
    }

    // （いつもの学習のロード関連）