    function saveParentNotifyEmails() {
      const msg = document.getElementById('parent-notify-message');
      const emails = [];
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('parent-notify-email-' + i);
        emails.push(el ? String(el.value || '').trim() : '');
      }
      if (msg) { msg.innerText = '保存中...'; msg.style.color = '#aaa'; }
      fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'save_parent_notify_emails', adminPin: parentAdminPinSession, emails: emails })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.status === 'success') {
          if (msg) { msg.innerText = d.message || '保存しました'; msg.style.color = '#81C784'; }
        } else {
          if (msg) { msg.innerText = d.message || '保存に失敗しました'; msg.style.color = '#ff8a80'; }
        }
      }).catch(function () {
        if (msg) { msg.innerText = '通信エラー'; msg.style.color = '#ff8a80'; }
      });
    }

    function openExternalAdminApproval() { openParentAdminMenu(); }