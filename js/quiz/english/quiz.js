    function renderCustomKeyboard(isFillMode = false, sortMissingMode = false, containerId = 'keyboard-container', targetInputId = 'type-answer', onEnterSubmit = null) {
      const container = document.getElementById(containerId); if(!container) return; container.innerHTML = "";
      window.__sortMissingModeActive = !!sortMissingMode;
      const keyOpts = { isFillMode: isFillMode, sortMissingMode: sortMissingMode, targetInputId: targetInputId };
      const scalePct = parseInt(getUserPref(LS_KBD_SCALE, '100'), 10);
      const fontPx = parseInt(getUserPref(LS_KBD_FONT, '18'), 10);
      const padPx = Math.max(8, Math.round(fontPx * 0.72));
      const wrap = document.createElement('div');
      wrap.className = 'keyboard-scale-wrap';
      wrap.style.setProperty('--kb-scale', String(Math.max(0.5, Math.min(2.5, scalePct / 100))));
      wrap.style.setProperty('--vk-font-px', String(fontPx));
      wrap.style.setProperty('--vk-pad-px', String(padPx));
      const rows = [ ['!', '"', '$', '%', '&', "'", '(', ')', '-', '¥'], ['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['z','x','c','v','b','n','m',',','.','?'] ];
      const board = document.createElement('div'); board.className = 'keyboard';
      
      rows.forEach((row, rIdx) => {
        const rowDiv = document.createElement('div'); rowDiv.className = 'key-row';
        if(rIdx === 3) {
          const shiftBtn = document.createElement('button'); shiftBtn.type = 'button'; shiftBtn.className = 'key key-wide'; shiftBtn.id = 'shift-btn'; shiftBtn.style.touchAction = 'none'; 
          shiftBtn.onpointerdown = (e) => { e.preventDefault(); if(e.button !== 0 && e.pointerType === 'mouse') return; if (shiftPressStartTime > 0) return; shiftPressStartTime = Date.now(); shiftTimer1s = setTimeout(() => { if (shiftBtn && !isShiftHoldMode) { shiftBtn.style.background = '#FF9800'; shiftBtn.innerText = '⇪'; } }, 1000); shiftTimer2s = setTimeout(() => { isShiftHoldMode = true; shiftMode = 0; updateKeyboardDisplay(); }, 2000); };
          const handlePointerUp = (e) => { e.preventDefault(); if (shiftPressStartTime === 0) return; clearTimeout(shiftTimer1s); clearTimeout(shiftTimer2s); const duration = Date.now() - shiftPressStartTime; shiftPressStartTime = 0; if (isShiftHoldMode) { isShiftHoldMode = false; shiftMode = 0; } else if (duration >= 1000) { shiftMode = (shiftMode === 2) ? 0 : 2; } else if (duration > 0 && duration < 1000) { shiftMode = (shiftMode === 1 || shiftMode === 2) ? 0 : 1; } updateKeyboardDisplay(); };
          shiftBtn.onpointerup = handlePointerUp; shiftBtn.onpointerleave = handlePointerUp; shiftBtn.onpointercancel = handlePointerUp; shiftBtn.oncontextmenu = (e) => { e.preventDefault(); return false; }; 
          rowDiv.appendChild(shiftBtn);
        }
        
        row.forEach(char => {
          const keyBtn = document.createElement('button'); keyBtn.type = 'button'; keyBtn.innerText = char;
          if (/[a-z]/.test(char)) { keyBtn.className = 'key key-char'; keyBtn.setAttribute('data-char', char); } else { keyBtn.className = 'key'; }
          bindQuizKeyHandler(keyBtn, function () {
            const isUpper = shiftMode > 0 || isShiftHoldMode;
            let inputChar = char;
            if (/[a-z]/.test(char) && isUpper) inputChar = char.toUpperCase();
            appendEnglishQuizKeyChar(inputChar, keyOpts);
            if (shiftMode === 1) { shiftMode = 0; updateKeyboardDisplay(); }
          });
          rowDiv.appendChild(keyBtn);
        });
        
        if(rIdx === 3) {
          const bsBtn = document.createElement('button'); bsBtn.type = 'button'; bsBtn.className = 'key key-wide'; bsBtn.innerText = '⌫';
          bindQuizKeyHandler(bsBtn, function () { backspaceEnglishQuizKey(keyOpts); });
          rowDiv.appendChild(bsBtn);
        }
        board.appendChild(rowDiv);
      });
      
      const bottomRow = document.createElement('div'); bottomRow.className = 'key-row';
      const spaceBtn = document.createElement('button'); spaceBtn.type = 'button'; spaceBtn.className = 'key'; spaceBtn.style.flex = "3"; spaceBtn.innerText = "Space";
      bindQuizKeyHandler(spaceBtn, function () { appendEnglishQuizKeyChar(" ", keyOpts); });
      
      if (sortMissingMode) {
        const cardBtn = document.createElement('button'); cardBtn.type = 'button'; cardBtn.className = 'key key-action'; cardBtn.innerText = "カードにする";
        bindQuizKeyHandler(cardBtn, function () { addSortMissingWordCard(); });
        bottomRow.appendChild(spaceBtn); bottomRow.appendChild(cardBtn);
      } else if (!isFillMode) {
        const enterBtn = document.createElement('button'); enterBtn.type = 'button'; enterBtn.className = 'key key-action'; enterBtn.innerText = "けってい";
        bindQuizKeyHandler(enterBtn, function () {
          if (isQuizAnswerSubmitting()) return;
          if (typeof onEnterSubmit === "function") {
            onEnterSubmit();
            return;
          }
          submitTypingAnswer();
        });
        bottomRow.appendChild(spaceBtn); bottomRow.appendChild(enterBtn);
      } else {
        const fillSubmitBtn = document.createElement('button'); fillSubmitBtn.type = 'button'; fillSubmitBtn.className = 'key key-action'; fillSubmitBtn.id = "fill-submit-btn"; fillSubmitBtn.innerText = "✨ これで回答する"; fillSubmitBtn.disabled = true;
        bindQuizKeyHandler(fillSubmitBtn, function () { if (!fillSubmitBtn.disabled) submitFillAnswer(); });
        bottomRow.appendChild(spaceBtn); bottomRow.appendChild(fillSubmitBtn);
      }
      
      board.appendChild(bottomRow);
      wrap.appendChild(board);
      container.appendChild(wrap);
      updateKeyboardDisplay();
    }

    function getPenTargetInput() {
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? ansTypeEl.value : '';
      if (isQuizFreeTypingAnswerType(ansType)) {
        return document.getElementById('type-answer');
      }
      if (ansType === "fill_typing") {
        return null;
      }
      return null;
    }

    function scrollPenTypeAnswerPreview_() {
      const target = getPenTargetInput();
      if (!target || target.tagName !== 'TEXTAREA') return;
      try { target.scrollTop = target.scrollHeight; } catch (_) {}
    }

    function composeWithAutoSpace(baseText, appendText) {
      const base = String(baseText || "");
      const add = String(appendText || "");
      if (!add) return base;
      if (!base) return add;
      const last = base.slice(-1);
      const first = add.charAt(0);
      if (last !== ' ' && first !== ' ') return base + ' ' + add;
      return base + add;
    }

    function appendTypeAnswerText(text) {
      const target = getPenTargetInput();
      if (target) {
        target.value = composeWithAutoSpace(target.value, text);
        target.classList.remove('type-answer-temp');
        handwritingState.pendingTempText = "";
        scrollPenTypeAnswerPreview_();
        return;
      }
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? String(ansTypeEl.value || '').trim() : '';
      if (ansType === 'fill_typing') {
        const chars = String(text || '').replace(/\s/g, '').split('');
        chars.forEach(ch => {
          if (/^[a-zA-Z]$/.test(ch)) handleFillInput(ch);
        });
      }
    }

    function setTypeAnswerTemporary(text) {
      const target = getPenTargetInput();
      if (!target) return;
      const before = target.value;
      target.value = composeWithAutoSpace(before, text);
      target.classList.add('type-answer-temp');
      handwritingState.pendingTempText = target.value.slice(before.length);
      scrollPenTypeAnswerPreview_();
    }

    function confirmTemporaryTypingInput() {
      const target = getPenTargetInput();
      if (!target || !handwritingState.pendingTempText) return;
      target.classList.remove('type-answer-temp');
      handwritingState.pendingTempText = "";
      handwritingState.pendingCandidates = [];
      clearPenCanvas();
      renderPenConfirmBox();
    }

    function removeTemporaryTypingInput() {
      const target = getPenTargetInput();
      if (!target || !handwritingState.pendingTempText) return;
      if (target.value.endsWith(handwritingState.pendingTempText)) {
        target.value = target.value.slice(0, -handwritingState.pendingTempText.length);
      }
      target.classList.remove('type-answer-temp');
      handwritingState.pendingTempText = "";
    }

    function renderPenConfirmBox() {
      const wrap = document.getElementById('pen-confirm-box');
      if (!wrap) return;
      const hasTemp = !!handwritingState.pendingTempText;
      const cands = handwritingState.pendingCandidates || [];
      if (!hasTemp && cands.length === 0) {
        wrap.style.display = 'none';
        wrap.innerHTML = '';
        return;
      }
      wrap.style.display = 'block';
      if (hasTemp) {
        wrap.innerHTML = `
          <div style="font-size:14px;color:#ddd;">うまく変換されましたか？</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button type="button" class="submit-btn btn-green" style="margin-top:0;padding:8px 14px;font-size:14px;" onclick="confirmTemporaryTypingInput()">はい</button>
            <button type="button" class="submit-btn btn-gray" style="margin-top:0;padding:8px 14px;font-size:14px;" onclick="showAlternativeCandidates()">いいえ</button>
          </div>
        `;
        return;
      }
      const htmlCand = cands.map(c => `<button type="button" class="pen-candidate-btn" onclick="chooseAlternativeCandidate('${String(c).replace(/'/g, "\\'")}')">${escapeHtml(String(c))}</button>`).join('');
      wrap.innerHTML = `
        <div style="font-size:14px;color:#ddd;">次の候補にありますか？</div>
        <div class="pen-candidates">${htmlCand || '<span style="color:#999;">候補なし</span>'}</div>
        <div style="margin-top:8px;">
          <button type="button" class="submit-btn btn-gray" style="margin-top:0;padding:8px 14px;font-size:14px;" onclick="retryPenInput()">入力をやり直す</button>
        </div>
      `;
    }

    function showAlternativeCandidates() {
      removeTemporaryTypingInput();
      renderPenConfirmBox();
    }

    function chooseAlternativeCandidate(text) {
      appendTypeAnswerText(text);
      handwritingState.pendingCandidates = [];
      clearPenCanvas();
      renderPenConfirmBox();
    }

    function retryPenInput() {
      handwritingState.pendingCandidates = [];
      removeTemporaryTypingInput();
      clearPenCanvas();
      renderPenConfirmBox();
      setPenStatus('手書きをやり直してください。');
    }

    function clearTypingInput() {
      const target = getPenTargetInput();
      if (!target) return;
      target.value = "";
      target.classList.remove('type-answer-temp');
      handwritingState.pendingTempText = "";
      handwritingState.pendingCandidates = [];
      renderPenConfirmBox();
    }

    function resetHandwritingInputState() {
      handwritingState.pendingCandidates = [];
      handwritingState.pendingTempText = "";
      handwritingState.currentStroke = [];
      handwritingState.allStrokes = [];
      handwritingState.strokesBackupBeforeClear = null;
      handwritingState.isDrawing = false;
      handwritingState.pointerId = null;
      clearTypingInput();
      clearPenCanvas();
    }

    function setPenMode(mode) {
      handwritingState.penMode = mode;
      setUserPref('pen_mode', mode);
      const btnPen = document.getElementById('btn-pen-mode');
      const btnEraser = document.getElementById('btn-eraser-mode');
      if (btnPen) btnPen.classList.toggle('active', mode === 'pen');
      if (btnEraser) btnEraser.classList.toggle('active', mode === 'eraser');
    }

    function setPenWidth(width) {
      const w = parseInt(width, 10);
      handwritingState.penWidth = w;
      setUserPref('pen_width', w);
      const label = document.getElementById('pen-width-label');
      if (label) label.innerText = w;
      const canvas = document.getElementById('pen-canvas');
      if (canvas && canvas.dataset.ready === "1") {
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = w;
      }
    }

    function setPenGuideSpread(val) {
      const n = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
      handwritingState.guideLineSpread = n;
      setUserPref(LS_PEN_GUIDE_SPREAD, String(n));
      const label = document.getElementById('pen-guide-spread-label');
      if (label) label.textContent = n;
      redrawAllStrokes();
    }

    function setPenGuideShow(checked) {
      handwritingState.showGuideLines = !!checked;
      setUserPref(LS_PEN_GUIDE_SHOW, checked ? '1' : '0');
      redrawAllStrokes();
    }

    function scalePenStrokes(oldW, oldH, newW, newH) {
      if (!oldW || !oldH) return;
      if (oldW === newW && oldH === newH) return;
      const sx = newW / oldW, sy = newH / oldH;
      const mapStroke = (st) => { st.forEach(p => { p.x *= sx; p.y *= sy; }); };
      handwritingState.allStrokes.forEach(mapStroke);
      if (handwritingState.strokesBackupBeforeClear) {
        handwritingState.strokesBackupBeforeClear.forEach(mapStroke);
      }
      if (handwritingState.currentStroke && handwritingState.currentStroke.length) {
        mapStroke(handwritingState.currentStroke);
      }
    }

    function relayoutPenCanvas() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas || canvas.dataset.ready !== '1') return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = handwritingState.penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#202124';
      canvas.dataset.logW = String(w);
      canvas.dataset.logH = String(h);
      redrawAllStrokes();
    }

    function setPenCanvasMaxWidth(val) {
      const px = Math.max(400, Math.min(1200, parseInt(val, 10) || 1000));
      handwritingState.canvasMaxWidthPx = px;
      setUserPref(LS_PEN_CANVAS_MAX_WIDTH, String(px));
      const wLabel = document.getElementById('pen-canvas-width-label');
      if (wLabel) wLabel.textContent = px;
      const wrap = document.getElementById('pen-canvas-wrap');
      if (wrap) wrap.style.maxWidth = px + 'px';
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      const oldW = parseFloat(canvas.dataset.logW) || 0;
      const oldH = parseFloat(canvas.dataset.logH) || 0;
      if (canvas.dataset.ready === '1' && oldW > 0 && oldH > 0) {
        const rect = canvas.getBoundingClientRect();
        scalePenStrokes(oldW, oldH, rect.width, rect.height);
      }
      relayoutPenCanvas();
    }

    function undoPenStroke() {
      if (handwritingState.strokesBackupBeforeClear != null) {
        const bak = handwritingState.strokesBackupBeforeClear;
        handwritingState.strokesBackupBeforeClear = null;
        handwritingState.allStrokes = Array.isArray(bak) ? bak.map(s => s.map(p => ({ x: p.x, y: p.y, t: p.t }))) : [];
        redrawAllStrokes();
        return;
      }
      if (handwritingState.allStrokes.length > 0) {
        handwritingState.allStrokes.pop();
        redrawAllStrokes();
      }
    }

    function redrawAllStrokes() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawEnglishGuideLines();
      
      handwritingState.allStrokes.forEach(stroke => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
    }

    function getGuideLineYs() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return null;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const s = typeof handwritingState.guideLineSpread === 'number' ? handwritingState.guideLineSpread : 50;
      /* 最下位（0）付近で狭い間隔、最上位（100）で広い帯。従来の最低幅 0.45 相当はスライダー約 55 付近 */
      const span = 0.14 + (s / 100) * 0.56;
      const mid = 0.5;
      const y0 = h * (mid - span / 2);
      const y3 = h * (mid + span / 2);
      const step = (y3 - y0) / 3;
      return { w, ys: [y0, y0 + step, y0 + 2 * step, y3] };
    }

    function drawEnglishGuideLines() {
      if (!handwritingState.showGuideLines) return;
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const pack = getGuideLineYs();
      if (!pack) return;
      const { w, ys } = pack;
      ctx.save();
      ys.forEach((y, idx) => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.lineWidth = idx === 2 ? 2.2 : 1;
        ctx.strokeStyle = idx === 2 ? 'rgba(120,120,120,0.55)' : 'rgba(160,160,160,0.3)';
        ctx.stroke();
      });
      ctx.restore();
    }

    function distSqToSegment(p1, p2, pt) {
      const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
      if (l2 === 0) return (pt.x - p1.x)**2 + (pt.y - p1.y)**2;
      let t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return (pt.x - (p1.x + t * (p2.x - p1.x)))**2 + (pt.y - (p1.y + t * (p2.y - p1.y)))**2;
    }

    function checkEraserCollision(pt) {
      const ERASER_RADIUS = 20;
      const ERASER_RADIUS_SQ = ERASER_RADIUS * ERASER_RADIUS;
      let hitIdx = -1;
      
      for (let i = handwritingState.allStrokes.length - 1; i >= 0; i--) {
        const stroke = handwritingState.allStrokes[i];
        let hit = false;
        for (let j = 0; j < stroke.length - 1; j++) {
          if (distSqToSegment(stroke[j], stroke[j+1], pt) <= ERASER_RADIUS_SQ) {
            hit = true;
            break;
          }
        }
        if (!hit && stroke.length === 1) {
          if ((stroke[0].x - pt.x)**2 + (stroke[0].y - pt.y)**2 <= ERASER_RADIUS_SQ) {
            hit = true;
          }
        }
        if (hit) {
          hitIdx = i;
          break;
        }
      }
      
      if (hitIdx !== -1) {
        handwritingState.allStrokes.splice(hitIdx, 1);
        redrawAllStrokes();
      }
    }

    function clearPenCanvas() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return;
      if (handwritingState.allStrokes.length > 0) {
        handwritingState.strokesBackupBeforeClear = handwritingState.allStrokes.map(s => s.map(p => ({ x: p.x, y: p.y, t: p.t })));
      }
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      drawEnglishGuideLines();
      handwritingState.currentStroke = [];
      handwritingState.allStrokes = [];
      handwritingState.isDrawing = false;
      handwritingState.pointerId = null;
      const status = document.getElementById('pen-status');
      if (status) status.innerText = "";
    }

    function setPenStatus(msg) {
      const status = document.getElementById('pen-status');
      if (status) status.innerText = msg || "";
    }

    function refreshPenStatusHint() {
      const status = document.getElementById('pen-status');
      if (!status) return;
      if (status.innerText && status.innerText !== '手書き入力の準備OK') return;
      status.innerText = isIpadStylusOptimizationEnabled()
        ? "iPad書きやすさ優先モード（誤タッチ防止を弱めています）"
        : "手書きペンのみ入力可（パームリジェクション有効）";
    }

    function shouldAcceptPenPointer(e) {
      if (!e) return false;
      if (e.pointerType === 'pen') return true;
      if (!isIpadStylusOptimizationEnabled()) return false;
      if (e.pointerType !== 'touch') return false;
      if (e.isPrimary === false) return false;
      const w = Number(e.width) || 0;
      const h = Number(e.height) || 0;
      const area = w * h;
      const pressure = Number(e.pressure) || 0;
      // iPad書き味優先: 細い接触面・圧力あり・サイズ不明は許容
      if (area === 0) return true;
      if (area <= 260) return true;
      if (pressure >= 0.15) return true;
      return false;
    }

    function getPenCoords(e, canvas) {
      const rect = handwritingState.activePenRect || canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: Date.now()
      };
    }

    function initializePenCanvas() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas || canvas.dataset.ready === "1") return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      
      ctx.lineWidth = handwritingState.penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#202124';
      drawEnglishGuideLines();

      canvas.addEventListener('pointerdown', (e) => {
        if (!shouldAcceptPenPointer(e)) {
          setPenStatus(isIpadStylusOptimizationEnabled() ? 'iPad書きやすさ優先モード: 大きい接触の誤タッチは無効です' : '手書きペンで入力してください（手・マウスは無効）');
          return;
        }
        e.preventDefault();
        const useIpadOpt = isIpadStylusOptimizationEnabled();
        handwritingState.activePenRect = useIpadOpt ? canvas.getBoundingClientRect() : null;
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }
        const pt = getPenCoords(e, canvas);

        if (handwritingState.penMode === 'eraser') {
          checkEraserCollision(pt);
          handwritingState.isDrawing = true;
          handwritingState.pointerId = e.pointerId;
          return;
        }

        handwritingState.isDrawing = true;
        handwritingState.currentStroke = [];
        handwritingState.pointerId = e.pointerId;
        handwritingState.pointerType = e.pointerType;
        handwritingState.currentStroke.push(pt);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!handwritingState.isDrawing || handwritingState.pointerId !== e.pointerId) return;
        if (!shouldAcceptPenPointer(e)) return;
        e.preventDefault();
        const pt = getPenCoords(e, canvas);

        if (handwritingState.penMode === 'eraser') {
          checkEraserCollision(pt);
          return;
        }

        handwritingState.currentStroke.push(pt);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      });

      const stopPenStroke = (e) => {
        if (!handwritingState.isDrawing || handwritingState.pointerId !== e.pointerId) return;
        if (handwritingState.penMode === 'pen' && handwritingState.currentStroke.length > 1) {
          handwritingState.allStrokes.push(handwritingState.currentStroke);
          handwritingState.strokesBackupBeforeClear = null;
        }
        if (canvas.releasePointerCapture) {
          try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        handwritingState.isDrawing = false;
        handwritingState.currentStroke = [];
        handwritingState.pointerId = null;
        handwritingState.activePenRect = null;
      };
      canvas.addEventListener('pointerup', stopPenStroke);
      canvas.addEventListener('pointercancel', stopPenStroke);
      canvas.addEventListener('pointerleave', (e) => {
        if (!handwritingState.isDrawing || handwritingState.pointerId !== e.pointerId) return;
        // iPad では高速筆記時に pointerleave が先に飛ぶことがあるため、
        // ペンがまだ接地中（buttons !== 0）は描画を継続する。
        if (e.buttons !== 0) return;
        stopPenStroke(e);
      });
      canvas.dataset.ready = "1";
      const r0 = canvas.getBoundingClientRect();
      canvas.dataset.logW = String(r0.width);
      canvas.dataset.logH = String(r0.height);
      setPenStatus('手書き入力の準備OK');
      refreshPenStatusHint();
    }

    function renderInputModeUi(targetMode) {
      const area = document.getElementById('quiz-answer-area');
      if (!area) return;
      const panel = area.querySelector('#answer-input-mode-switch');
      if (!panel) return;
      panel.querySelectorAll('.answer-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === targetMode);
      });
    }

    function buildTypingInputAreaMarkup(useFillMode) {
      return `
        <div id="answer-input-mode-switch" class="answer-input-mode-switch">
          <button type="button" class="answer-mode-btn" data-mode="keyboard" onclick="switchInputMethod('keyboard')">⌨️ キーボード</button>
          <button type="button" class="answer-mode-btn" data-mode="pen" onclick="switchInputMethod('pen')">✍️ 手書き</button>
        </div>
        <div id="input-method-body"></div>
      `;
    }

    function mountTypingMethodBody(useFillMode) {
      const body = document.getElementById('input-method-body');
      if (!body) return;
      if (inputMethodMode === 'pen') {
        const submitBtnHtml = useFillMode
          ? `<button type="button" id="fill-submit-btn" class="submit-btn btn-green" style="margin-top:0;padding:10px 20px;font-size:16px;" onclick="submitFillAnswer()" disabled>これで回答</button>`
          : '';
        const typingPreviewHtml = useFillMode
          ? `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
              <button type="button" id="pen-recognize-btn" class="submit-btn btn-blue pen-recognize-btn" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="recognizePenStrokes()">文字起こし</button>
              <span style="color:#bbb;font-size:13px;line-height:1.4;">かいたあと「文字起こし」でマスに入ります（サーバーへ送ります）</span>
            </div>
          `
          : `
            <div class="pen-typing-preview-row">
              <button type="button" id="pen-recognize-btn" class="submit-btn btn-blue pen-recognize-btn" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="recognizePenStrokes()">文字起こし</button>
              <button type="button" class="submit-btn btn-gray" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="appendTypeAnswerText(' ')">間をあける</button>
              <button type="button" id="pen-typing-submit-btn" class="submit-btn btn-green" style="margin-top:0;padding:10px 14px;font-size:14px;" onclick="submitTypingAnswer()">答えを送信</button>
            </div>
            <div class="pen-typing-preview-area">
              <textarea id="type-answer" class="large-input type-answer-pen-preview" readonly rows="2" placeholder="認識結果が入ります" aria-label="手書きの認識結果"></textarea>
            </div>
          `;
        const activePen = handwritingState.penMode === 'pen' ? 'active' : '';
        const activeEraser = handwritingState.penMode === 'eraser' ? 'active' : '';
        const wMax = handwritingState.canvasMaxWidthPx;
        body.innerHTML = `
          <div class="pen-panel">
            <div class="pen-settings pen-tool-row">
              <div class="pen-toggle-switch">
                <button type="button" id="btn-pen-mode" class="${activePen}" onclick="setPenMode('pen')">手書き</button>
                <button type="button" id="btn-eraser-mode" class="${activeEraser}" onclick="setPenMode('eraser')">線消しゴム</button>
              </div>
              <button type="button" id="pen-advanced-toggle-btn" class="cancel-btn" onclick="togglePenAdvancedSettings()" style="padding:4px 10px; font-size:14px; background:#1E88E5; color:#fff; border-radius:20px; border:1px solid #1565C0;">詳細設定ボタンを表示</button>
              <button type="button" class="cancel-btn" onclick="undoPenStroke()" style="padding:4px 10px; font-size:14px; background:#444; color:#fff; border-radius:20px; border:1px solid #555;">↩️ 1つ戻す</button>
              <button type="button" class="cancel-btn" onclick="clearPenCanvas()" style="padding:4px 10px; font-size:14px; background:#444; color:#fff; border-radius:20px; border:1px solid #555;">手書きを全部消す</button>
              <button type="button" class="cancel-btn" onclick="clearTypingInput()" style="padding:4px 10px; font-size:14px; background:#444; color:#fff; border-radius:20px; border:1px solid #555;">テキスト入力を全部消す</button>
            </div>
            <div id="pen-advanced-controls" class="pen-canvas-width-row" style="display:none; justify-content:center; align-items:center; flex-wrap:wrap; gap:10px;">
              <label style="color:#ccc; font-size:14px; display:flex; align-items:center; gap:5px; background:#222; padding:4px 8px; border-radius:20px;">
                太さ: <input type="range" id="pen-width-range" min="1" max="10" value="${handwritingState.penWidth}" onchange="setPenWidth(this.value)">
                <span id="pen-width-label" style="display:inline-block; width:16px; text-align:center;">${handwritingState.penWidth}</span>px
              </label>
              <label style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">手書きの幅
                <input type="range" id="pen-canvas-width-range" min="400" max="1200" step="20" value="${wMax}" oninput="setPenCanvasMaxWidth(this.value)" style="width:min(240px,50vw);">
                <span id="pen-canvas-width-label">${wMax}</span> px
              </label>
              <label style="color:#ccc;font-size:13px;display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:100%;">目印の間隔
                <input type="range" id="pen-guide-spread" class="pen-guide-hslider" min="0" max="100" value="${handwritingState.guideLineSpread}" oninput="setPenGuideSpread(this.value)" title="4本の目印の線の間隔">
                <span id="pen-guide-spread-label" style="min-width:22px;">${handwritingState.guideLineSpread}</span>
              </label>
              <label style="color:#ccc; font-size:13px; display:flex; align-items:center; gap:6px; background:#222; padding:4px 10px; border-radius:20px; cursor:pointer;">
                <input type="checkbox" id="pen-guide-show" ${handwritingState.showGuideLines ? 'checked' : ''} onchange="setPenGuideShow(this.checked)"> 目印の線を表示する
              </label>
              <label style="color:#ccc; font-size:13px; display:flex; align-items:center; gap:6px; background:#222; padding:4px 10px; border-radius:20px; cursor:pointer;">
                <input type="checkbox" id="pen-ipad-stylus-opt" ${isIpadStylusOptimizationEnabled() ? 'checked' : ''} onchange="syncIpadStylusSettingsFromCheckbox(this)"> iPad用のスタイラスペン設定にする
              </label>
            </div>
            ${typingPreviewHtml}
            <div id="pen-confirm-box" class="pen-confirm-box" style="display:none;"></div>
            <div class="pen-canvas-wrap" id="pen-canvas-wrap" style="max-width:${wMax}px;margin:0 auto;">
              <canvas id="pen-canvas" class="pen-canvas" oncontextmenu="event.preventDefault();return false" style="width:100%;height:min(50vh, 520px);max-height:85vh;touch-action:none;"></canvas>
            </div>
            ${useFillMode ? `<div class="pen-panel-controls" style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;justify-content:center;">${submitBtnHtml}</div>` : ``}
            <div id="pen-status" class="pen-status">手書きペンのみ入力可（パームリジェクション有効）</div>
          </div>
        `;
        initializePenCanvas();
        renderPenConfirmBox();
        syncPenAdvancedVisibility();
      } else {
        if (useFillMode) {
          body.innerHTML = `<div id="keyboard-container"></div>`;
          renderCustomKeyboard(true);
        } else {
          body.innerHTML = `
            <div class="keyboard-typing-top-row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;margin-bottom:8px;">
              <button type="button" id="keyboard-typing-submit-btn" class="submit-btn btn-green" style="margin-top:0;padding:10px 20px;font-size:16px;" onclick="submitTypingAnswer()">答えを送信</button>
            </div>
            <input type="text" id="type-answer" class="large-input" readonly inputmode="none" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="下のキーボードで入力">
            <div id="keyboard-container"></div>`;
          renderCustomKeyboard(false);
          focusQuizTypeAnswerInput();
        }
      }
      renderInputModeUi(inputMethodMode);
      syncQuizAnswerAreaPenModeClass();
    }

    function syncQuizAnswerAreaPenModeClass() {
      const a = document.getElementById('quiz-answer-area');
      const sec = document.getElementById('section-quiz');
      const isPen = inputMethodMode === 'pen';
      if (a) a.classList.toggle('pen-mode-active', isPen);
      if (sec) sec.classList.toggle('pen-mode-active', isPen);
    }

    let isPenTypingSubmitInFlight = false;
    function setPenTypingSubmitBusy(isBusy) {
      isPenTypingSubmitInFlight = !!isBusy;
      ['pen-typing-submit-btn', 'keyboard-typing-submit-btn'].forEach(function (id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !!isBusy;
        btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
        btn.innerText = isBusy ? '送信中...' : '答えを送信';
      });
    }
    function submitTypingAnswer() {
      if (isPenTypingSubmitInFlight || isQuizAnswerSubmitting()) return;
      if (inputMethodMode === 'pen' && handwritingState.pendingTempText) confirmTemporaryTypingInput();
      const target = document.getElementById('type-answer');
      const userA = target ? String(target.value || "") : "";
      if (!normalizeText(userA)) {
        if (inputMethodMode === 'pen') setPenStatus('先に文字起こしして入力してください。');
        return;
      }
      if (!Array.isArray(filteredQuestions) || currentQuestionIndex < 0 || currentQuestionIndex >= filteredQuestions.length) {
        if (inputMethodMode === 'pen') setPenStatus('問題データの読み込み待ちです。少し待って再度お試しください。');
        return;
      }
      const q = filteredQuestions[currentQuestionIndex];
      if (!q) {
        if (inputMethodMode === 'pen') setPenStatus('問題の取得に失敗しました。次の問題に進んでください。');
        return;
      }
      const formatEl = document.getElementById('setting-format');
      const format = formatEl ? String(formatEl.value || "") : "";
      const correctA = (format.includes("qtext") || format.includes("qaudio")) ? q["英文"] : (q["英単語"] || q["英文"]);
      setPenTypingSubmitBusy(true);
      checkAnswer(userA, correctA, q);
    }
    function submitTypingFromPen() {
      submitTypingAnswer();
    }

    function switchInputMethod(mode) {
      inputMethodMode = mode === 'pen' ? 'pen' : 'keyboard';
      setUserPref(LS_INPUT_MODE, inputMethodMode);
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? String(ansTypeEl.value || '').trim() : '';
      if (!isQuizFreeTypingAnswerType(ansType) && ansType !== "fill_typing") return;
      mountTypingMethodBody(ansType === "fill_typing");
      const answerArea = document.getElementById('quiz-answer-area');
      if (answerArea) placeQuizFeedbackAboveKeyboard(answerArea);
      if (inputMethodMode === 'keyboard') focusQuizTypeAnswerInput();
    }

    function getPenWritingGuideForApi() {
      const canvas = document.getElementById('pen-canvas');
      if (!canvas) return { width: 1000, height: 400 };
      const w = parseFloat(canvas.dataset.logW) || canvas.getBoundingClientRect().width || 1000;
      const h = parseFloat(canvas.dataset.logH) || canvas.getBoundingClientRect().height || 400;
      return {
        width: Math.round(Math.max(200, Math.min(2400, w))),
        height: Math.round(Math.max(200, Math.min(2400, h)))
      };
    }

    function collectInkForApi() {
      const apiInk = [];
      const MAX_POINTS_PER_STROKE = 180;
      handwritingState.allStrokes.forEach(stroke => {
        if (!stroke || stroke.length < 1) return;
        let strokeForApi = stroke;
        if (stroke.length === 1) {
          const p0 = stroke[0];
          strokeForApi = [p0, { x: p0.x, y: p0.y, t: (p0.t != null ? p0.t : Date.now()) + 1 }];
        }
        let sampled = strokeForApi;
        if (strokeForApi.length > MAX_POINTS_PER_STROKE) {
          const step = Math.ceil(strokeForApi.length / MAX_POINTS_PER_STROKE);
          sampled = strokeForApi.filter((_, idx) => idx % step === 0);
          if (sampled[sampled.length - 1] !== strokeForApi[strokeForApi.length - 1]) {
            sampled.push(strokeForApi[strokeForApi.length - 1]);
          }
        }
        const xArr = [];
        const yArr = [];
        const tArr = [];
        const t0 = (typeof sampled[0].t === 'number' && !isNaN(sampled[0].t)) ? sampled[0].t : 0;
        sampled.forEach((p, i) => {
          xArr.push(p.x);
          yArr.push(p.y);
          const t = (typeof p.t === 'number' && !isNaN(p.t)) ? p.t : t0 + i * 16;
          tArr.push(Math.max(0, t - t0));
        });
        apiInk.push([xArr, yArr, tArr]);
      });
      return apiInk;
    }

    function setPenRecognizeButtonState(isBusy) {
      const btn = document.getElementById('pen-recognize-btn');
      if (!btn) return;
      btn.classList.toggle('is-busy', !!isBusy);
      btn.disabled = !!isBusy;
      btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
      btn.innerText = isBusy ? '⏳ 文字起こし中...' : '文字起こし';
    }

    function recognizePenStrokes() {
      if (inputMethodMode !== 'pen') return;
      const ansTypeEl = document.getElementById('setting-answer-type');
      const ansType = ansTypeEl ? String(ansTypeEl.value || '').trim() : '';
      if (!isQuizFreeTypingAnswerType(ansType) && ansType !== "fill_typing") return;
      if (isPenRecognitionInFlight) {
        setPenStatus('文字起こし中です。少し待ってください。');
        return;
      }
      const apiInk = collectInkForApi();
      if (apiInk.length === 0) {
        setPenStatus('先に手書きで文字を書いてください。');
        return;
      }
      const writingGuide = getPenWritingGuideForApi();
      isPenRecognitionInFlight = true;
      setPenRecognizeButtonState(true);
      setPenStatus('文字起こし中（サーバーと通信）… 画数: ' + String(apiInk.length));
      const ac = new AbortController();
      const PEN_RECOGNIZE_TIMEOUT_MS = 38000;
      const timeoutId = setTimeout(() => ac.abort(), PEN_RECOGNIZE_TIMEOUT_MS);
      function postRecognizeWithRetry(retryCount) {
        return fetch(GAS_API_URL, {
          method: 'POST',
          body: JSON.stringify({ action: "recognize_handwriting", ink: apiInk, writingGuide: writingGuide }),
          signal: ac.signal
        })
        .then(r => {
          if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
          return r.json();
        })
        .catch(err => {
          if (err && err.name === 'AbortError') throw err;
          const msg = String((err && (err.message || err)) || "");
          const canRetry = retryCount > 0 && /Load failed|Failed to fetch|NetworkError|fetch/i.test(msg);
          if (!canRetry) throw err;
          setPenStatus('通信が不安定です。文字起こしを再試行中…');
          return new Promise(resolve => setTimeout(resolve, 450)).then(() => postRecognizeWithRetry(retryCount - 1));
        });
      }
      postRecognizeWithRetry(1)
      .then(d => {
        if (d.status !== "success") {
          setPenStatus(d.message || "認識に失敗しました。");
          return;
        }
        const text = String(
          d.text != null ? d.text :
          d.result != null ? d.result :
          d.recognizedText != null ? d.recognizedText :
          d.bestCandidate != null ? d.bestCandidate :
          d.candidate != null ? d.candidate :
          ""
        ).trim();
        if (!text) {
          const keys = d && typeof d === "object" ? Object.keys(d).slice(0, 8).join(", ") : "";
          setPenStatus("認識結果なし。もう一度書いてください。返却キー: " + (keys || "なし"));
          return;
        }
        const rawCandidates =
          Array.isArray(d.candidates) ? d.candidates :
          Array.isArray(d.alternatives) ? d.alternatives :
          Array.isArray(d.results) ? d.results :
          [];
        const candidates = rawCandidates.map(v => String(v || '').trim()).filter(v => v);
        handwritingState.pendingCandidates = candidates.filter(v => v !== text);
        const target = getPenTargetInput();
        if (target) {
          removeTemporaryTypingInput();
          setTypeAnswerTemporary(text);
          renderPenConfirmBox();
        } else {
          const chars = text.replace(/\s/g, '').split('');
          chars.forEach(ch => {
            if (/^[a-zA-Z]$/.test(ch)) handleFillInput(ch);
          });
        }
        setPenStatus(`仮入力: ${text}`);
      })
      .catch(err => {
        if (err && err.name === 'AbortError') {
          setPenStatus('時間がかかりすぎて止めました。通信やGASの状態を確認し、もう一度「文字起こし」を押してください。');
        } else {
          const msg = String((err && (err.message || err)) || "");
          setPenStatus('通信エラー（' + (msg || '応答を読めませんでした') + '）。ネットワークを確認して再度お試しください。');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        isPenRecognitionInFlight = false;
        setPenRecognizeButtonState(false);
      });
    }

    function startVoiceInput() {
      if (!recognition) recognition = createEnglishRecognition_();
      if (!recognition) { alert("お使いのブラウザは音声入力に対応していません。SafariかChromeを使ってね！"); return; }
      if (voiceRecognitionPendingStart_) return;
      releaseStuckQuizVoiceState_();
      if (isQuizVoiceMicBlocked_()) return;
      if (quizVoiceListening) return;
      const feedback = document.getElementById('voice-feedback');
      const btn = document.getElementById('voice-btn');
      const displayField = document.getElementById('voice-recognized-text');
      if (!feedback || !btn || !displayField) return;

      const beginListening = function () {
        voiceRecognitionPendingStart_ = null;
        if (isQuizVoiceMicBlocked_() || quizVoiceListening) return;
        if (!recognition) recognition = createEnglishRecognition_();
        if (!recognition) return;
        const sessionGen = ++voiceRecognitionGen_;
        displayField.value = "";
        btn.innerText = "🎙️ 聞き取り中...";
        btn.style.background = "#e50914";
        btn.disabled = false;
        feedback.innerHTML = "英語ではなしてください...";
        startQuizVoiceListening_();

        recognition.onresult = (event) => {
          if (sessionGen !== voiceRecognitionGen_) return;
          let interimTranscript = ''; let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; else interimTranscript += event.results[i][0].transcript; }
          let rawTranscript = finalTranscript || interimTranscript;
          const displayText = convertDigitsToWordsInText(rawTranscript);
          displayField.value = displayText;
          if (displayText) {
            const q = filteredQuestions[currentQuestionIndex]; const format = document.getElementById('setting-format').value; let correctA = (format.includes("qtext") || format.includes("qaudio")) ? q["英文"] : (q["英単語"] || q["英文"]);
            if(normalizeText(displayText) === normalizeText(correctA)) {
              stopEnglishRecognitionSafely_(null);
              displayField.value = displayText;
              checkAnswer(displayText, correctA, q);
            }
            else if (finalTranscript) {
              voiceFailCount++;
              stopEnglishRecognitionSafely_(function () {
                if (sessionGen !== voiceRecognitionGen_) return;
                if (voiceFailCount >= 5) {
                  displayField.value = displayText;
                  checkAnswer(displayText, correctA, q);
                } else {
                  displayField.value = displayText;
                  feedback.innerHTML = `聞き取った言葉：<br><b style='color:#FF9800;'>「${displayText}」</b><br>ちがうみたい！もう一度🎙️をおしてね。<br><span style="font-size:14px; color:#F44336;">（まちがい: ${voiceFailCount}回 / 5回で不正解）</span>`;
                  resetVoiceBtnIdle_(btn);
                }
              });
            }
          }
        };
        recognition.onerror = (event) => {
          if (sessionGen !== voiceRecognitionGen_) return;
          const errCode = event && event.error ? String(event.error) : "";
          stopEnglishRecognitionSafely_(function () {
            if (sessionGen !== voiceRecognitionGen_) return;
            recognition = createEnglishRecognition_();
            resetVoiceBtnIdle_(btn, feedback, errCode === "not-allowed"
              ? "マイクの使用が許可されていません。ブラウザの設定を確認してください。"
              : "聞き取れませんでした。もう一度おしてね。");
          });
        };
        recognition.onend = function () {
          if (sessionGen !== voiceRecognitionGen_) return;
          stopQuizVoiceListening_();
          if (btn.innerText.includes("聞き取り中")) resetVoiceBtnIdle_(btn);
        };
        try {
          recognition.start();
        } catch (err) {
          stopQuizVoiceListening_();
          recognition = createEnglishRecognition_();
          resetVoiceBtnIdle_(btn, feedback, "マイクを起動できませんでした。少し待ってからもう一度お試しください。");
          console.warn("recognition.start failed", err);
        }
      };

      stopEnglishRecognitionSafely_(function () {
        voiceRecognitionPendingStart_ = setTimeout(beginListening, 220);
      });
    }

    function startJaSpeechToField(fieldId) {
      const target = document.getElementById(fieldId);
      if (!target) return;
      if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) { alert("お使いのブラウザは日本語音声入力に対応していません。Chrome/Edgeを使ってね。"); return; }
      if (!recognitionJa) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionJa = new SpeechRecognition();
        recognitionJa.lang = 'ja-JP';
        recognitionJa.interimResults = false;
        recognitionJa.continuous = false;
      }
      const btnText = target.dataset && target.dataset.listeningLabel ? target.dataset.listeningLabel : "🎙️ 日本語で入力";
      recognitionJa.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; }
        if (finalTranscript) {
          target.value = (target.value ? target.value + " " : "") + finalTranscript;
        }
      };
      recognitionJa.onerror = () => { alert("聞き取れませんでした。もう一度試してください。"); };
      recognitionJa.onend = () => {};
      recognitionJa.start();
    }

    function startQuizAfterFilters(order) {
      if (order === 'random') filteredQuestions.sort(() => Math.random() - 0.5);
      currentQuestionIndex = 0; quizResults = [];
      captureEnglishQuizSessionMeta();
      switchSection('section-quiz'); saveQuizRecoveryDraft(0); showQuestion();
    }

    function prepareQuiz() {
      currentIsReviewMode = document.getElementById('setting-play-mode').value === 'review';
      const order = document.getElementById('setting-order').value; 
      const format = document.getElementById('setting-format').value;
      const ansType = syncAnswerTypeWithFormat(format);

      filteredQuestions = applyQuizQuestionFilters(currentQuestions, format, ansType);

      if (format === "ja_to_en_sort" && filteredQuestions.length === 0) {
        alert("並び替えの出題データがありません。\n並び替え語句が3語以上の行だけ出題します（1〜2語の行はスキップ）。\n「並び替え箇所」または「英文」と語句列を確認してください。\n不要語混入の場合は「並び替え語句ダミー」も必要です。");
        return;
      }

      if (isLegacyFillBlankAnswerType(ansType) && filteredQuestions.length === 0) {
        alert("選択した文字数を隠せる単語がありません！隠す数を減らしてください。");
        return;
      }

      if (isEnToEnClueAnswerType(ansType) && filteredQuestions.length === 0) {
        if (ansType === "initial_typing" || ansType === "initial_voice") {
          alert("イニシャル列にデータがある問題がありません。学習セットの「イニシャル」列を確認してください。");
        } else {
          alert("穴埋め１／穴埋め２列にデータがある問題がありません。学習セットを確認してください。");
        }
        return;
      }

      if (currentIsReviewMode) {
        const unitKey = getDetailedUnitId();
        fetchEnglishUnitHistory(unitKey).then(function (history) {
          filteredQuestions = filteredQuestions.filter(function (q) {
            return checkIsNigate(history[q["通し番号"]]);
          });
          if (filteredQuestions.length === 0) {
            alert("ニガテな問題はありません！通常モードでスタートします。");
            currentIsReviewMode = false;
            document.getElementById('setting-play-mode').value = 'normal';
            filteredQuestions = applyQuizQuestionFilters([...currentQuestions], format, ansType);
          }
          startQuizAfterFilters(order);
        });
        return;
      }
      startQuizAfterFilters(order);
    }

    /** 正誤表示を「つぎへ」ボタンの直前の定位置へ戻す（answerArea を空にする前に必須） */
    function restoreQuizFeedbackLocation() {
      const fb = document.getElementById('quiz-feedback');
      const nextBtn = document.getElementById('quiz-next-btn');
      if (!fb || !nextBtn || !nextBtn.parentNode) return;
      if (fb.nextElementSibling !== nextBtn) {
        nextBtn.parentNode.insertBefore(fb, nextBtn);
      }
    }

    /** 正誤表示は常に「入力欄の直下」優先で配置する（手書き/キーボード両対応） */
    function placeQuizFeedbackAboveKeyboard(answerAreaEl) {
      const fb = document.getElementById('quiz-feedback');
      if (!fb || !answerAreaEl) return;

      const typeInput = answerAreaEl.querySelector('#type-answer');
      if (typeInput) {
        const hostRow = typeInput.closest('div');
        const hostParent = hostRow && hostRow.parentNode ? hostRow.parentNode : typeInput.parentNode;
        if (hostParent) {
          hostParent.insertBefore(fb, hostRow ? hostRow.nextSibling : typeInput.nextSibling);
          return;
        }
      }

      const kbd = answerAreaEl.querySelector('#keyboard-container');
      if (kbd) {
        answerAreaEl.insertBefore(fb, kbd);
        return;
      }

      answerAreaEl.appendChild(fb);
    }

    function showQuestion() {
      if (currentQuestionIndex >= filteredQuestions.length) { finishQuiz(); return; }
      document.body.classList.remove('quiz-answer-submitting');
      setPenTypingSubmitBusy(false);
      maxDeduction = 0;
      voiceFailCount = 0;
      cancelVoiceRecognitionPendingStart_();
      stopEnglishRecognitionSafely_(null);
      resetQuizAudioVoiceMutex_();
      resetEnFlashQuestionState_();
      clearTimeout(autoNextTimer);
      destroySortQuizIfAny();
      
      const q = filteredQuestions[currentQuestionIndex]; 
      const format = document.getElementById('setting-format').value; 
      const answerType = syncAnswerTypeWithFormat(format);
      const isWord = currentModeName.includes("単語");

      const kbdPanel = document.getElementById('quiz-keyboard-settings-panel');
      if (kbdPanel) {
        kbdPanel.style.display = (isQuizFreeTypingAnswerType(answerType) || answerType === 'fill_typing' || (format === 'ja_to_en_sort' && answerType === 'sort_missing')) ? 'block' : 'none';
        const kbdBody = document.getElementById('quiz-keyboard-settings-body');
        if (kbdBody) kbdBody.style.display = 'none';
      }
      
      document.getElementById('quiz-progress').innerText = (isTrainingMode?"🎯 特訓ルート: ":"") + (currentIsReviewMode?"🔥特訓中! ":"") + `第 ${currentQuestionIndex + 1} 問 / 全 ${filteredQuestions.length} 問`;
      
      let qText = "", correctA = "", engTextForAudio = "";
      if (format === "ja_to_en") { qText = q["日本語"]; correctA = (q["英単語"] || q["英文"]).trim(); } 
      else if (format === "en_to_ja") { qText = (q["英単語"] || q["英文"]).trim(); correctA = q["日本語"]; }
      else if (format === "qtext_to_en") { qText = q["疑問文"]; correctA = q["英文"].trim(); }
      else if (format === "en_audio_to_ja") { engTextForAudio = q["英単語"] || q["英文"]; correctA = q["日本語"]; }
      else if (format === "qaudio_to_en") { engTextForAudio = q["疑問文"]; correctA = q["英文"]; }
      else if (format === "en_audio_to_en") { engTextForAudio = q["英単語"] || q["英文"]; correctA = (q["英単語"] || q["英文"]).trim(); }
      else if (format === "en_to_en") {
        correctA = (q["英単語"] || q["英文"]).trim();
        engTextForAudio = correctA;
        if (isEnToEnClueAnswerType(answerType)) {
          qText = getEnToEnCluePrompt(q, answerType);
        } else if (!isEnToEnFlashAnswerType(answerType)) {
          qText = correctA;
        }
      }

      if (format === "ja_to_en_sort") {
        const ja = String(q["日本語"] || "");
        const refEn = String(q["並び替え用英文"] || "").trim();
        document.getElementById('quiz-q-text').innerHTML = `<div style="font-size:36px;font-weight:bold;margin-bottom:8px;">${escapeHtml(ja)}</div>${refEn ? `<div style="font-size:22px;color:#aaa;line-height:1.4;">${escapeHtml(refEn)}</div>` : ''}`;
      } else if (format.includes("audio")) {
        document.getElementById('quiz-q-text').innerHTML = `<button id="quiz-listen-btn" onclick="speakQuizEnglishAudio('${engTextForAudio.replace(/'/g, "\\'")}')" class="submit-btn btn-blue" style="border-radius:50px;">🔊 英語をきく</button>`;
        if (isQuizVoiceAnswerType(answerType) && ('speechSynthesis' in window)) {
          quizEnglishAudioPending_ = true;
          armQuizEnglishAudioSafetyTimer_(20000);
          syncQuizAudioVoiceControls_();
        }
        setTimeout(() => speakText(engTextForAudio), 500);
      } else if (format === "en_to_en") {
        const safeText = qText || "";
        const clueLabel = (answerType === "initial_typing" || answerType === "initial_voice")
          ? "イニシャル"
          : (answerType === "sheet_fill_typing" || answerType === "sheet_fill_voice")
            ? "穴埋め"
            : "";
        if (isEnToEnClueAnswerType(answerType)) {
          const jaLine = String(q["日本語"] || "").trim();
          const clueBadge = clueLabel
            ? `<div style="font-size:14px;color:#90A4AE;margin-bottom:6px;">手がかり（${clueLabel}）</div>`
            : "";
          document.getElementById('quiz-q-text').innerHTML =
            (jaLine ? `<div style="font-size:clamp(26px,5.5vw,38px);font-weight:bold;margin-bottom:12px;line-height:1.45;">${escapeHtml(jaLine)}</div>` : "") +
            clueBadge +
            `<div style="font-size:clamp(22px,5vw,36px);font-weight:bold;letter-spacing:0.06em;line-height:1.45;color:#e8eaf0;">${escapeHtml(safeText)}</div>`;
        } else if (isEnToEnFlashAnswerType(answerType)) {
          enFlashCurrentEnglish = correctA;
          document.getElementById('quiz-q-text').innerHTML =
            buildEnFlashJaLineHtml_(q) +
            `<div id="en-flash-preview-text" class="en-flash-preview-text">${escapeHtml(correctA)}</div>`;
        } else {
          const clueBadge = clueLabel
            ? `<div style="font-size:14px;color:#90A4AE;margin-bottom:6px;">手がかり（${clueLabel}）</div>`
            : "";
          document.getElementById('quiz-q-text').innerHTML = clueBadge +
            `<div style="margin-bottom:8px;font-size:clamp(22px,5vw,36px);font-weight:bold;letter-spacing:0.06em;line-height:1.45;">${escapeHtml(safeText)}</div>` +
            `<button id="quiz-listen-btn" onclick="speakQuizEnglishAudio('${(correctA || "").replace(/'/g, "\\'")}')" class="submit-btn btn-blue" style="border-radius:50px;">🔊 英語をきく</button>`;
        }
      } else {
        document.getElementById('quiz-q-text').innerText = qText; 
      }

      document.getElementById('quiz-feedback').innerHTML = ""; 
      document.getElementById('quiz-next-btn').style.display = "none";
      
      const hintArea = document.getElementById('quiz-hint-area');
      const hintTextDisplay = document.getElementById('hint-display-text');
      const wordBlankArea = document.getElementById('quiz-word-blank-area');
      hintTextDisplay.style.display = "none"; hintTextDisplay.innerText = "";
      wordBlankArea.style.display = "none"; wordBlankArea.innerHTML = "";
      
      document.getElementById('hint-btn-2').innerText = isWord ? "💡 イニシャルと文字数を見る（-7 Pt）" : "💡 ヒントを見る（-7 Pt）";

      if (answerType === "4choice" || format.includes("en_to_ja") || format === "en_audio_to_ja" || isLegacyFillBlankAnswerType(answerType) || isEnToEnClueAnswerType(answerType) || isEnToEnFlashAnswerType(answerType)) {
        hintArea.style.display = "none";
      } else {
        hintArea.style.display = "flex";
        document.getElementById('hint-btn-1').disabled = false;
        document.getElementById('hint-btn-2').disabled = false;
        document.getElementById('hint-btn-3').disabled = false;
      }

      restoreQuizFeedbackLocation();
      const answerArea = document.getElementById('quiz-answer-area');
      answerArea.classList.remove('pen-mode-active');
      const quizSec = document.getElementById('section-quiz');
      if (quizSec) quizSec.classList.remove('pen-mode-active');
      answerArea.innerHTML = "";
      resetHandwritingInputState();
      if (!isEnToEnFlashAnswerType(answerType)) questionStartTime = Date.now();
      saveQuizRecoveryDraft(currentQuestionIndex);
      
      if (format === "ja_to_en_sort" && (answerType === "sort_all" || answerType === "sort_dummy" || answerType === "sort_missing")) {
        setupSortQuiz(q, answerType);
      }
      else if (answerType === "4choice") {
        let choices = [correctA]; 
        let others = currentQuestions.filter(item => { if(format === "ja_to_en" || format === "qtext_to_en" || format === "qaudio_to_en" || format === "en_audio_to_en" || format === "en_to_en") return (item["英単語"] || item["英文"]) !== correctA; else return item["日本語"] !== correctA; }).sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3 && i < others.length; i++) { choices.push((format === "ja_to_en" || format.includes("to_en")) ? (others[i]["英単語"] || others[i]["英文"]) : others[i]["日本語"]); }
        choices.sort(() => Math.random() - 0.5);
        choices.forEach(c => { const btn = document.createElement('button'); btn.innerText = c; btn.className = "choice-btn"; btn.onclick = () => checkAnswer(c, correctA, q); answerArea.appendChild(btn); });
      } 
      else if (isQuizFreeTypingAnswerType(answerType)) {
        if (isEnToEnFlashAnswerType(answerType)) {
          answerArea.innerHTML = `<button type="button" id="en-flash-start-btn" class="submit-btn btn-green en-flash-start-btn" onclick="startEnFlashAnswer()">回答を始める</button>`;
        } else {
          shiftMode = 0; isShiftHoldMode = false;
          answerArea.innerHTML = buildTypingInputAreaMarkup(false);
          if (inputMethodMode === 'pen') setPenMode('pen');
          mountTypingMethodBody(false);
          placeQuizFeedbackAboveKeyboard(answerArea);
        }
      }
      else if (isQuizVoiceAnswerType(answerType)) {
        if (isEnToEnFlashAnswerType(answerType)) {
          answerArea.innerHTML = `<button type="button" id="en-flash-start-btn" class="submit-btn btn-green en-flash-start-btn" onclick="startEnFlashAnswer()">回答を始める</button>`;
        } else {
          mountQuizVoiceAnswerArea_();
        }
      }
      else if (isLegacyFillBlankAnswerType(answerType)) {
        setupFillBlankQuiz(correctA, answerType);
      }
      syncQuizAudioVoiceControls_();
      updateSessionScoreDisplay();
    }

    function setupFillBlankQuiz(word, ansType) {
      const numBlanks = parseInt(document.getElementById('setting-blank-count').value) || 1;
      const wordBlankArea = document.getElementById('quiz-word-blank-area');
      const answerArea = document.getElementById('quiz-answer-area');
      
      wordBlankArea.style.display = "block";
      fillBlanksData = [];
      activeFillBlankIndex = 0;

      let availableIndices = [];
      for(let i=1; i<word.length; i++) {
        if(/[a-zA-Z]/.test(word[i])) availableIndices.push(i);
      }
      availableIndices.sort(() => Math.random() - 0.5);
      let hiddenIndices = availableIndices.slice(0, numBlanks).sort((a,b)=>a-b);

      let displayHtml = "";
      let blankCount = 0;

      for (let i=0; i<word.length; i++) {
        if (hiddenIndices.includes(i)) {
          displayHtml += `<span class="blank-box ${blankCount === 0 ? 'active' : ''}" id="fill-blank-${blankCount}" onclick="selectFillBlank(${blankCount})">_</span>`;
          fillBlanksData.push({ originalIndex: i, correctChar: word[i], userInput: '', uiIndex: blankCount });
          blankCount++;
        } else {
          displayHtml += `<span>${word[i]}</span>`;
        }
      }
      wordBlankArea.innerHTML = displayHtml;

      if (ansType === "fill_typing") {
        shiftMode = 0; isShiftHoldMode = false;
        answerArea.innerHTML = buildTypingInputAreaMarkup(true);
        if (inputMethodMode === 'pen') setPenMode('pen');
        mountTypingMethodBody(true);
        placeQuizFeedbackAboveKeyboard(answerArea);
      } else if (ansType === "fill_4choice") {
        answerArea.innerHTML = `
          <div id="fill-4choice-container" class="fill-choices"></div>
          <button id="fill-submit-btn" class="submit-btn btn-green" style="display:none; margin: 20px auto 0;" onclick="submitFillAnswer()">✨ これで回答する</button>
        `;
        renderFill4ChoiceButtons();
      }
    }

    function selectFillBlank(index) {
      document.querySelectorAll('.blank-box').forEach(b => b.classList.remove('active'));
      activeFillBlankIndex = index;
      document.getElementById(`fill-blank-${index}`).classList.add('active');
      
      const ansType = document.getElementById('setting-answer-type').value;
      if (ansType === "fill_4choice") {
        renderFill4ChoiceButtons();
      }
    }

    function renderFill4ChoiceButtons() {
      const container = document.getElementById('fill-4choice-container');
      container.innerHTML = "";
      
      let correctChar = fillBlanksData[activeFillBlankIndex].correctChar;
      let letters = "abcdefghijklmnopqrstuvwxyz";
      if (correctChar === correctChar.toUpperCase()) letters = letters.toUpperCase();
      
      let choices = [correctChar];
      while(choices.length < 4) {
        let r = letters[Math.floor(Math.random() * letters.length)];
        if(!choices.includes(r)) choices.push(r);
      }
      choices.sort(() => Math.random() - 0.5);

      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = "fill-choice-btn";
        btn.innerText = c;
        btn.onclick = () => { handleFillInput(c); };
        container.appendChild(btn);
      });
    }

    function handleFillInput(char) {
      fillBlanksData[activeFillBlankIndex].userInput = char;
      document.getElementById(`fill-blank-${activeFillBlankIndex}`).innerText = char;
      
      let nextIndex = fillBlanksData.findIndex(b => b.userInput === '');
      if (nextIndex !== -1) {
        selectFillBlank(nextIndex);
      } else {
        checkFillCompletion();
      }
    }

    function handleFillBackspace() {
      fillBlanksData[activeFillBlankIndex].userInput = '';
      document.getElementById(`fill-blank-${activeFillBlankIndex}`).innerText = "_";
      checkFillCompletion();
    }

    function checkFillCompletion() {
      const allFilled = fillBlanksData.every(b => b.userInput !== '');
      const submitBtn = document.getElementById('fill-submit-btn');
      if (submitBtn) {
        if (allFilled) {
          submitBtn.disabled = false;
          submitBtn.style.display = "block";
          submitBtn.classList.remove('btn-gray');
        } else {
          submitBtn.disabled = true;
          if (document.getElementById('setting-answer-type').value === "fill_4choice") {
            submitBtn.style.display = "none";
          }
        }
      }
    }

    function submitFillAnswer() {
      const q = filteredQuestions[currentQuestionIndex];
      let correctA = (q["英単語"] || q["英文"]).trim();
      
      let constructedAnswer = "";
      let fillIdx = 0;
      for(let i=0; i<correctA.length; i++) {
        let blankData = fillBlanksData.find(b => b.originalIndex === i);
        if (blankData) constructedAnswer += blankData.userInput;
        else constructedAnswer += correctA[i];
      }
      
      checkAnswer(constructedAnswer, correctA, q);
    }

    function useHint(type, penalty) {
      const q = filteredQuestions[currentQuestionIndex];
      const hintTextDisplay = document.getElementById('hint-display-text');
      const format = document.getElementById('setting-format').value;
      const isWord = currentModeName.includes("単語");
      maxDeduction = Math.max(maxDeduction, penalty);
      if (type !== 3) document.getElementById(`hint-btn-${type}`).disabled = true;
      if (type === 1 || type === 2) {
        let hintStr = "";
        if (type === 1) hintStr = q["イニシャル"] || "ヒントなし";
        else if (type === 2) hintStr = isWord ? (q["イニシャルと文字数"] || "ヒントなし") : (q["ヒント"] || q["イニシャルと文字数"] || "ヒントなし");
        hintTextDisplay.innerText = hintStr;
        hintTextDisplay.style.display = "block";
      } else if (type === 3) {
        let speakSrc = "";
        if (format === "ja_to_en_sort") speakSrc = q["英文"] || q["並び替え箇所"] || "";
        else if (format.includes("qtext") || format.includes("qaudio")) speakSrc = q["英文"];
        else speakSrc = q["英単語"] || q["英文"];
        speakText(speakSrc, 0.8);
      }
      updateSessionScoreDisplay();
    }
    function skipQuestion() {
      const q = filteredQuestions[currentQuestionIndex];
      const format = document.getElementById('setting-format').value;
      checkAnswer("[スキップしました]", getCorrectAnswerForQuestion(q, format), q);
    }

    function checkAnswer(userA, correctA, q) {
      document.body.classList.add('quiz-answer-submitting');
      document.querySelectorAll('#section-quiz button').forEach(function (b) {
        if (b.closest('#keyboard-container') && !b.classList.contains('key-action')) return;
        b.disabled = true;
      });
      let advanceScheduled = false;
      let resultRecorded = false;
      try {
        const format = document.getElementById('setting-format').value;
        const ansType = getActiveQuizAnswerType();
        const isWord = currentModeName.includes("単語");

        let resolvedCorrect = correctA;
        if (resolvedCorrect == null || (typeof resolvedCorrect === "string" && resolvedCorrect.trim() === "")) {
          resolvedCorrect = getCorrectAnswerForQuestion(q, format);
        }

        let isCorrect = false;
        if (format === "ja_to_en_sort") {
          resolvedCorrect = getSortPrimaryCorrectDisplay(q);
          isCorrect = isSortAnswerCorrect(userA, q);
        } else {
          const userVariants = expandTextVariants(userA).map(t => normalizeText(t));
          const correctVariants = expandTextVariants(resolvedCorrect).map(t => normalizeText(t));
          const correctSet = new Set(correctVariants);
          isCorrect = userVariants.some(u => correctSet.has(u));
        }
        const basePoint = computeQuizBasePoint(format, ansType, isWord);

        quizResults.push({ questionId: q["通し番号"], isCorrect: isCorrect, timeSec: Math.round((Date.now() - questionStartTime) / 1000), basePoint: basePoint, maxDeduction: maxDeduction });
        resultRecorded = true;
        saveQuizRecoveryDraft(currentQuestionIndex + 1);
        const feedback = document.getElementById('quiz-feedback');

        document.getElementById('quiz-word-blank-area').style.display = "none";

        const isSkip = userA === "[スキップしました]";
        const fillFeedback = isLegacyFillBlankAnswerType(ansType);
        if (!isSkip) playAnswerSound(isCorrect);
        let plusLine = "";
        if (isCorrect && !isSkip) {
          const mult = computePointsMultiplierClient();
          const sheetPct = parseUnitSheetPointPercentClient(currentUnitName);
          const rawBefore = rawPointsFromQuizResults(quizResults.slice(0, -1));
          const rawAfter = rawPointsFromQuizResults(quizResults);
          const eBefore = applySessionEarnedFromRaw(rawBefore, mult, sheetPct);
          const eAfter = applySessionEarnedFromRaw(rawAfter, mult, sheetPct);
          const d = Math.round((eAfter - eBefore) * 100) / 100;
          if (d > 0) plusLine = `<p class="quiz-feedback-points-plus">＋${formatPointDisplayNum(d)}点</p>`;
        }
        let feedbackUserA = userA;
        let feedbackCorrect = resolvedCorrect;
        if (format === "ja_to_en_sort" && !isSkip) {
          feedbackUserA = formatSortUserAnswerForDisplay(userA);
          feedbackCorrect = formatSortSentenceForDisplay(resolvedCorrect);
        }
        feedback.innerHTML = buildFeedbackContentHtml(feedbackUserA, feedbackCorrect, isCorrect, isSkip, computeEffectiveDeduction_(basePoint, maxDeduction), fillFeedback && !isSkip, ansType, plusLine);
        updateSessionScoreDisplay();
        if (isQuizFreeTypingAnswerType(ansType) || ansType === "fill_typing" || format === "ja_to_en_sort") {
          requestAnimationFrame(() => {
            try { feedback.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
          });
        }

        if (format === "ja_to_en_sort") destroySortQuizIfAny();
        const speakLine = (format === "ja_to_en_sort" && q["英文"]) ? q["英文"] : String(resolvedCorrect ?? "");
        const speakLang = (format === "en_to_ja" || format === "en_audio_to_ja") ? "ja" : "en";
        speakText(String(speakLine), 0.9, speakLang);
        advanceScheduled = true;
      } catch (e) {
        console.error(e);
        try { if (document.getElementById('setting-format') && document.getElementById('setting-format').value === 'ja_to_en_sort') destroySortQuizIfAny(); } catch (_) {}
        const feedback = document.getElementById('quiz-feedback');
        try { document.getElementById('quiz-word-blank-area').style.display = "none"; } catch (_) {}
        if (feedback) {
          feedback.innerHTML = `<span style='color:#F44336;font-size:30px;font-weight:bold;'>⚠️ エラー</span><br><span style="font-size:18px;">「つぎへ」でつづけてね。</span>`;
        }
        if (!resultRecorded) {
          try {
            const format = document.getElementById('setting-format').value;
            const ansType = getActiveQuizAnswerType();
            const isWord = currentModeName.includes("単語");
            const basePoint = computeQuizBasePoint(format, ansType, isWord);
            quizResults.push({ questionId: q["通し番号"], isCorrect: false, timeSec: Math.round((Date.now() - questionStartTime) / 1000), basePoint: basePoint, maxDeduction: maxDeduction });
            saveQuizRecoveryDraft(currentQuestionIndex + 1);
          } catch (_) {
            quizResults.push({ questionId: q["通し番号"] || 0, isCorrect: false, timeSec: 0, basePoint: 0, maxDeduction: 0 });
            saveQuizRecoveryDraft(currentQuestionIndex + 1);
          }
        }
        updateSessionScoreDisplay();
        advanceScheduled = true;
      } finally {
        setPenTypingSubmitBusy(false);
        const nextBtn = document.getElementById('quiz-next-btn');
        nextBtn.disabled = false;
        nextBtn.style.display = "block";
        document.querySelectorAll('#section-quiz .cancel-btn').forEach(btn => btn.disabled = false);
        if (advanceScheduled) {
          clearTimeout(autoNextTimer);
          autoNextTimer = setTimeout(() => { nextQuestion(); }, 3000);
        }
      }
    }

    function nextQuestion() {
      clearTimeout(autoNextTimer);
      cancelVoiceRecognitionPendingStart_();
      stopEnglishRecognitionSafely_(null);
      window.speechSynthesis.cancel();
      resetQuizAudioVoiceMutex_();
      resetEnFlashQuestionState_();
      resetHandwritingInputState();
      currentQuestionIndex++;
      showQuestion();
    }
    function quitQuiz() {
      clearTimeout(autoNextTimer);
      if (recognition) { try { recognition.stop(); } catch (_) {} }
      window.speechSynthesis.cancel();
      resetQuizAudioVoiceMutex_();
      resetEnFlashQuestionState_();
      resetHandwritingInputState();
      document.body.classList.remove('quiz-answer-submitting');
      const secQuizReset = document.getElementById('section-quiz');
      const ansAreaReset = document.getElementById('quiz-answer-area');
      if (secQuizReset) secQuizReset.classList.remove('pen-mode-active');
      if (ansAreaReset) ansAreaReset.classList.remove('pen-mode-active');
      openSettingsScreen();
    }
    
    function finishQuiz() {
      resetResultScreenActionButtons();
      document.body.classList.remove('kanji-study-mode');
      const secQuizFinish = document.getElementById('section-quiz');
      const ansAreaFinish = document.getElementById('quiz-answer-area');
      if (secQuizFinish) secQuizFinish.classList.remove('pen-mode-active');
      if (ansAreaFinish) ansAreaFinish.classList.remove('pen-mode-active');
      switchSection('section-result', { forceEnglishResult: true });
      document.getElementById('result-content').innerHTML = buildLocalFinishQuizSummaryHtml("結果を保存しています…");
      document.getElementById('result-retry-btn').style.display = "none"; document.getElementById('result-settings-btn').style.display = "none"; document.getElementById('result-home-btn').style.display = "none";
      (function () {
        var __kb = document.getElementById('result-kanji-same-book-btn');
        var __ko = document.getElementById('result-kanji-other-book-btn');
        if (__kb) __kb.style.display = "none";
        if (__ko) __ko.style.display = "none";
      })();

      const user = JSON.parse(localStorage.getItem('app_kid_user') || 'null');
      if (!user || !user.id) {
        document.getElementById('result-content').innerHTML = `<h2 style="color:#F44336;">ログイン情報が見つかりません</h2><p>ホームにもどってから再ログインしてください。</p>`;
        bindEnglishResultButtonHandlers();
        document.getElementById('result-home-btn').style.display = "block";
        return;
      }
      const meta = getEnglishQuizSessionMeta();
      const orderEl = document.getElementById('setting-order');
      const isRandom = meta.isRandom != null ? meta.isRandom : (orderEl ? orderEl.value === 'random' : false);
      const isReviewMode = meta.isReviewMode != null ? meta.isReviewMode : currentIsReviewMode;
      const detailedUnitId = meta.detailedUnitId || getDetailedUnitId();
      const unitSheetName = meta.unitSheetName || currentUnitName;
      const expectedCount = Array.isArray(filteredQuestions) ? filteredQuestions.length : 0;
      let resultsToSend = slimQuizResultsForSave(Array.isArray(quizResults) ? quizResults.slice() : []);
      if (expectedCount > 0 && resultsToSend.length > expectedCount) {
        console.warn("quizResults が問題数を超えています。集計用に先頭", expectedCount, "件に切り詰めます。", resultsToSend.length);
        resultsToSend = resultsToSend.slice(0, expectedCount);
      }
      const sessionSubmitId = buildQuizSessionSubmitId(user.id, detailedUnitId, resultsToSend);

      let payload = {
        action: "save_learning_session",
        userId: user.id,
        unitId: detailedUnitId,
        unitSheetName: unitSheetName,
        isReviewMode: isReviewMode,
        isRandom: isRandom,
        results: resultsToSend,
        sessionSubmitId: sessionSubmitId
      };
      if (isTrainingMode) {
        payload.trainingStepIndex = currentTrainingStepIndex;
        payload.trainingMenuId = currentTrainingMenuId;
      }

      let submitInFlight = false;
      let submitSucceeded = false;
      let lastSuccessData = null;

      // 失敗時に同じペイロードで再送できるよう、ボタンから呼ぶ用のリトライ関数。
      window.__retryFinishQuizSubmit = function () {
        if (submitSucceeded && lastSuccessData) {
          applySuccessResult(lastSuccessData);
          return;
        }
        if (submitInFlight) return;
        document.getElementById('result-content').innerHTML = buildLocalFinishQuizSummaryHtml("結果を保存しています…（再送）");
        document.getElementById('result-retry-btn').style.display = "none";
        document.getElementById('result-settings-btn').style.display = "none";
        document.getElementById('result-home-btn').style.display = "none";
        (function () {
          var __kb = document.getElementById('result-kanji-same-book-btn');
          var __ko = document.getElementById('result-kanji-other-book-btn');
          if (__kb) __kb.style.display = "none";
          if (__ko) __ko.style.display = "none";
        })();
        doSubmit();
      };

      function showSubmitError(title, detailHtml, allowRetry) {
        const safeTitle = escapeHtml(String(title || "エラー"));
        document.getElementById('result-content').innerHTML =
          buildLocalFinishQuizSummaryHtml("") +
          `<h2 style="color:#F44336;margin-top:14px;">⚠️ ${safeTitle}</h2>` +
          (detailHtml || "") +
          `<p style="margin-top:8px;">上の得点はこの端末での計算です。サーバー保存が完了していない場合は「もういちど結果を送る」をお試しください（同じ内容なら二重付与されません）。</p>` +
          `<p style="margin-top:8px;font-size:13px;color:#888;">回答ログは <strong>「ホームにもどる」</strong> 後の復帰データに保存されています。ホームを開くと未送信の結果を自動で再送します。</p>`;
        bindEnglishResultButtonHandlers({
          retryOnclick: allowRetry ? function () { window.__retryFinishQuizSubmit(); } : undefined
        });
        document.getElementById('result-home-btn').style.display = "block";
        if (allowRetry) {
          const retryBtn = document.getElementById('result-retry-btn');
          if (retryBtn) {
            retryBtn.style.display = "block";
            retryBtn.innerText = "🔁 もういちど結果を送る";
          }
        }
      }

      function renderFinishQuizSuccessHtml(d) {
        let bonusMsg = "";
        if (currentIsReviewMode) bonusMsg += `<p style="color:#FF9800;font-weight:bold;margin:5px 0;">🔥 ニガテ特訓ボーナス適用</p>`;
        if (d.bonusApplied) bonusMsg += `<p style="color:#e50914;font-weight:bold;margin:5px 0;">🎲 ランダム出題ボーナス（10%UP）</p>`;
        if (isTrainingMode) bonusMsg += `<p style="color:#9C27B0;font-weight:bold;margin:5px 0;">🎯 特訓ルートクリア！</p>`;
        if (d.sheetPointPercent != null && Number(d.sheetPointPercent) < 100) {
          var labelTry = "";
          try { labelTry = formatUnitSheetDisplayLabel(currentUnitName) || ""; } catch (_) { labelTry = String(currentUnitName || ""); }
          bonusMsg += `<p style="color:#90CAF9;font-size:15px;margin:6px 0;">📎 ${escapeHtml(labelTry)} のため、かくとくポイントは <strong>${d.sheetPointPercent}%</strong> になっています。</p>`;
        }
        if (d.alreadyProcessed) {
          bonusMsg += `<p style="color:#FF9800;font-size:13px;margin:6px 0;">※ すでに保存済みの結果を表示しています（ポイントの二重付与はしていません）。</p>`;
        }
        const correctCount = resultsToSend.filter(function (r) { return r && r.isCorrect; }).length;
        const totalCount = expectedCount || resultsToSend.length;
        const earnedTxt = escapeHtml(String(d.earnedPoints != null ? d.earnedPoints : 0));
        const totalTxt = escapeHtml(String(d.newTotal != null ? d.newTotal : user.points || 0));
        const scoreSummary = `<p style="font-size:15px;color:#bbb;margin:8px 0;">正解 ${correctCount} / ${totalCount} 問</p>`;
        return `<h2 style="color:#4CAF50;">✨ おつかれさま！ ✨</h2>` + bonusMsg + scoreSummary +
          `<p>かくとくポイント: <span style="color:gold;font-size:30px;">+${earnedTxt}</span></p>` +
          `<hr style="border-color:#444;"><p>合計ポイント: ${totalTxt}</p>`;
      }

      function mergeFinishQuizUserCache(d) {
        if (d.newTotal != null) user.points = d.newTotal;
        if (!user.historyJson) user.historyJson = {};
        if (d.historyUnitId && d.historyUnitPatch) {
          mergeHistoryUnitPatchClient(user, d.historyUnitId, d.historyUnitPatch);
        } else if (d.historyJson) {
          user.historyJson = d.historyJson;
        }
        if (d.kanjiChallengeChar && d.kanjiChallengePatch) {
          mergeKanjiChallengePatchClient(d.kanjiChallengeChar, d.kanjiChallengePatch);
          if (user.historyJson && user.historyJson.__kanjiChallenge) {
            delete user.historyJson.__kanjiChallenge[d.kanjiChallengeChar];
            if (Object.keys(user.historyJson.__kanjiChallenge).length === 0) {
              delete user.historyJson.__kanjiChallenge;
            }
          }
        }
        if (d.lastStudyKey && d.lastStudyAt) {
          if (!user.lastStudyJson) user.lastStudyJson = {};
          user.lastStudyJson[d.lastStudyKey] = d.lastStudyAt;
        }
        if (d.dailyPointsJson) user.dailyPointsJson = d.dailyPointsJson;
        if (d.trainingProgressJson) {
          user.trainingProgressJson = d.trainingProgressJson;
          if (isTrainingMode || currentTrainingMenuId) {
            invalidateTrainingRouteCache(currentTrainingMenuId);
            applyLocalTrainingProgress(d.trainingProgressJson, currentTrainingMenuId);
          }
        }
        try {
          saveAppKidUserToLocal(user);
        } catch (eUserSave) {
          console.warn("user info update failed (points were saved on server):", eUserSave);
        }
        const ptsEl = document.getElementById('user-points');
        if (ptsEl && d.newTotal != null) ptsEl.innerText = String(d.newTotal);
      }

      function applySuccessResult(d) {
        submitSucceeded = true;
        lastSuccessData = d;
        const wasTrainingMode = isTrainingMode;
        const trainingReturnMenuId = currentTrainingMenuId;
        const resultEl = document.getElementById('result-content');
        if (resultEl) resultEl.innerHTML = renderFinishQuizSuccessHtml(d);
        mergeFinishQuizUserCache(d);
        clearQuizRecoveryDraft();

        (function () {
          var __kb = document.getElementById('result-kanji-same-book-btn');
          var __ko = document.getElementById('result-kanji-other-book-btn');
          if (__kb) __kb.style.display = "none";
          if (__ko) __ko.style.display = "none";
        })();

        const retryBtn = document.getElementById('result-retry-btn');
        const settingsBtn = document.getElementById('result-settings-btn');
        if (!wasTrainingMode) {
          if (retryBtn) {
            retryBtn.style.display = "block";
            retryBtn.innerText = "🔄 もう一度やる";
          }
          if (settingsBtn) settingsBtn.style.display = "block";
          bindEnglishResultButtonHandlers();
        } else {
          if (retryBtn) retryBtn.style.display = "none";
          if (settingsBtn) {
            settingsBtn.style.display = "block";
            settingsBtn.innerText = "🎯 特訓ルートにもどる";
          }
          bindEnglishResultButtonHandlers({
            retryOnclick: null,
            settingsOnclick: function () {
              returnToCurrentTrainingMenuRoute({ menuId: trainingReturnMenuId, invalidateCache: false });
            },
            homeOnclick: function () {
              cancelTrainingRouteAutoReturn();
              showHome(JSON.parse(localStorage.getItem("app_kid_user")));
            }
          });
          scheduleTrainingRouteAutoReturn(2200, trainingReturnMenuId);
        }
        const homeBtn = document.getElementById('result-home-btn');
        if (homeBtn) homeBtn.style.display = "block";
      }

      function doSubmit() {
        if (submitSucceeded && lastSuccessData) {
          applySuccessResult(lastSuccessData);
          return;
        }
        if (submitInFlight) return;
        submitInFlight = true;

        gasApiFetchText(payload, { retries: 4, timeoutMs: 120000, xhrFallback: true })
          .then(function (res) {
            try {
              const httpStatus = res.status;
              const rawText = String(res.text || "");
              const d = gasApiParseJsonResponse(res);
              if (!d) {
                console.error("save_learning_session: 非JSON応答 status=" + httpStatus, rawText.slice(0, 500));
                savePendingFinishQuizPayload(payload);
                showSubmitError(
                  "サーバー応答が読めませんでした",
                  `<p style="font-size:13px;color:#666;">HTTP ${httpStatus}。<br>結果は端末に一時保存しました。ホームを開くと自動で再送します。</p>`,
                  true
                );
                return;
              }
              if (d.status === "success") {
                clearPendingFinishQuizPayload();
                if (sessionSubmitId) rememberFlushedSubmitId(sessionSubmitId);
                try {
                  applySuccessResult(d);
                } catch (eApply) {
                  console.error("結果表示中にエラー（保存自体は成功）:", eApply);
                  submitSucceeded = true;
                  lastSuccessData = d;
                  clearQuizRecoveryDraft();
                  const resultEl = document.getElementById('result-content');
                  if (resultEl) {
                    resultEl.innerHTML = renderFinishQuizSuccessHtml(d) +
                      `<p style="color:#FF9800;font-size:12px;">（表示の途中で軽微なエラーがありましたが、保存は完了しました。）</p>`;
                  }
                  try { mergeFinishQuizUserCache(d); } catch (_) {}
                  bindEnglishResultButtonHandlers();
                  const homeBtn = document.getElementById('result-home-btn');
                  if (homeBtn) homeBtn.style.display = "block";
                  (function () {
                    var __kb = document.getElementById('result-kanji-same-book-btn');
                    var __ko = document.getElementById('result-kanji-other-book-btn');
                    if (__kb) __kb.style.display = "none";
                    if (__ko) __ko.style.display = "none";
                  })();
                }
                return;
              }
              console.error("save_learning_session error:", d);
              savePendingFinishQuizPayload(payload);
              const detail = `<p style="font-size:13px;color:#666;">${escapeHtml(String(d.message || "サーバーが error を返しました。"))}<br>ホームを開くと自動で再送します。</p>`;
              showSubmitError("結果の保存に失敗しました", detail, true);
            } catch (eHandler) {
              console.error("save_learning_session handler error:", eHandler);
              savePendingFinishQuizPayload(payload);
              showSubmitError(
                "結果の表示中にエラーが発生しました",
                `<p style="font-size:13px;color:#666;">${escapeHtml(String((eHandler && eHandler.message) || eHandler || ""))}<br>保存処理は続行できます。「もういちど結果を送る」をお試しください。</p>`,
                true
              );
            }
          })
          .catch(function (e) {
            console.error("save_learning_session network/parse error:", e);
            savePendingFinishQuizPayload(payload);
            const netMsg = String((e && (e.message || e)) || "");
            let netHint;
            if (/non-JSON|Unexpected token|JSON/i.test(netMsg)) {
              netHint = "サーバーから想定外の応答が返りました。ページを再読み込みしてから「もういちど結果を送る」をお試しください。";
            } else if (/timeout|aborted|AbortError/i.test(netMsg)) {
              netHint = "サーバーへの応答が時間切れになりました。回線が遅いときやサーバーが混み合っているときに起きます。ページを再読み込みしてから「もういちど結果を送る」をお試しください。";
            } else if (/Load failed|Failed to fetch|NetworkError|XHR|CORS|socket/i.test(netMsg)) {
              netHint = "ブラウザがサーバーへ接続できませんでした。ページを再読み込み（スーパーリロード）してから、もう一度「もういちど結果を送る」をお試しください。";
            } else {
              netHint = "結果の送信が完了しなかった可能性があります。（" + netMsg + "）";
            }
            showSubmitError(
              "通信エラー",
              `<p>${escapeHtml(netHint)}<br>結果は端末に一時保存しました。ホームを開くと自動で再送します。</p>`,
              true
            );
          })
          .finally(function () {
            submitInFlight = false;
          });
      }

      doSubmit();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') syncAllStopwatchesToServer(true);
    });
    window.addEventListener('pagehide', function () {
      syncAllStopwatchesToServer(true);
    });

    document.addEventListener('keydown', (e) => {
      const answerInput = document.getElementById('type-answer');
      const quizSection = document.getElementById('section-quiz');
      if (!quizSection || !quizSection.classList.contains('active')) return;
      if (isQuizAnswerSubmitting()) return;
      if (e.isComposing || e.key === 'Process') return;

      const ansType = getActiveQuizAnswerType();

      if (isQuizFreeTypingAnswerType(ansType) && answerInput) {
        if (inputMethodMode === 'pen') return;
        if (['Enter', 'Backspace', ' ', 'Shift'].includes(e.key) || (e.key.length === 1 && /^[\x20-\x7E¥]$/.test(e.key))) { e.preventDefault(); }
        if (e.key === 'Enter') { const enterBtn = Array.from(document.querySelectorAll('.key-action')).find(btn => btn.innerText === "けってい"); if (enterBtn && !enterBtn.disabled) enterBtn.click(); } 
        else if (e.key === 'Backspace') { answerInput.value = answerInput.value.slice(0, -1); } 
        else if (e.key === ' ') { answerInput.value += ' '; } 
        else if (e.key.length === 1 && /^[\x20-\x7E¥]$/.test(e.key)) { answerInput.value += e.key; }
      }
      else if (ansType === "fill_typing") {
        if (inputMethodMode === 'pen') return;
        if (['Enter', 'Backspace', ' ', 'Shift'].includes(e.key) || (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key))) { e.preventDefault(); }
        if (e.key === 'Enter') { const enterBtn = document.getElementById('fill-submit-btn'); if (enterBtn && !enterBtn.disabled) enterBtn.click(); }
        else if (e.key === 'Backspace') { handleFillBackspace(); }
        else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) { handleFillInput(e.key); }
      }
    });