/* ===================================================================
   えにわ愛ポイント｜フォーム送信・入力チェック
   -------------------------------------------------------------------
   対象：お問い合わせフォーム（data-form="contact"）
         愛称投票フォーム（data-form="vote"）

   送信先は site/assets/config.js の forms.contactEndpoint /
   forms.voteEndpoint に設定します。未設定の場合は送信せず、
   メールでのご連絡先を案内します（画面は正常に動作します）。
   =================================================================== */
(function () {
  'use strict';

  var CFG = (window.AIPOINT_CONFIG || {});
  var F = CFG.forms || {};
  var OFFICE = CFG.office || {};
  var MAIL = F.fallbackMail || OFFICE.mail || 'info@eniwa-point.com';

  /* ------------------------------------------------------------ 共通UI */
  function ensureMsgBox(form) {
    var box = form.querySelector('.form-msg');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-msg';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      form.appendChild(box);
    }
    return box;
  }

  function showMsg(form, type, html) {
    var box = ensureMsgBox(form);
    box.className = 'form-msg ' + type;
    box.innerHTML = html;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function fieldError(el, message) {
    clearError(el);
    if (!el) return;
    var row = el.closest('.form-row') || el.parentElement;
    el.setAttribute('aria-invalid', 'true');
    var p = document.createElement('p');
    p.className = 'field-err';
    p.textContent = message;
    row.appendChild(p);
  }

  function clearError(el) {
    if (!el) return;
    el.removeAttribute('aria-invalid');
    var row = el.closest('.form-row') || el.parentElement;
    if (!row) return;
    var e = row.querySelector('.field-err');
    if (e) e.remove();
  }

  function clearAllErrors(form) {
    form.querySelectorAll('.field-err').forEach(function (e) { e.remove(); });
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
  }

  function isMail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function setBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = '.6';
      btn.textContent = '送信しています…';
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  /* 未設定時の案内（メールでのご連絡） */
  function noEndpointNotice(form, subject, body) {
    var href = 'mailto:' + MAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    showMsg(form, 'warn',
      '<b>送信先が未設定のため、この画面からは送信されません。</b><br>' +
      'お手数ですが、下記よりメールでご連絡ください。<br>' +
      '<a class="btn btn-pink btn-sm" style="margin-top:10px;" href="' + href + '">' +
      '✉️ メールで送る（' + MAIL + '）</a>');
  }

  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    });
  }

  /* ==================================================== お問い合わせ */
  function initContact(form) {
    form.setAttribute('novalidate', 'novalidate');

    form.addEventListener('input', function (e) {
      if (e.target.matches('input,textarea,select')) clearError(e.target);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAllErrors(form);

      var kind = form.querySelector('input[name="kind"]:checked');
      var name = form.querySelector('#f-name');
      var org = form.querySelector('#f-org');
      var mail = form.querySelector('#f-mail');
      var tel = form.querySelector('#f-tel');
      var body = form.querySelector('#f-body');
      var agree = form.querySelector('input[type="checkbox"]');

      var ok = true, first = null;
      function ng(el, msg) { fieldError(el, msg); if (!first) first = el; ok = false; }

      if (!kind) {
        var kindRow = form.querySelector('.radio-row');
        if (kindRow) {
          var p = document.createElement('p');
          p.className = 'field-err'; p.textContent = 'お問い合わせ種別を選択してください。';
          kindRow.parentElement.appendChild(p);
        }
        if (!first) first = form.querySelector('input[name="kind"]');
        ok = false;
      }
      if (!name || !name.value.trim()) ng(name, 'お名前をご入力ください。');
      if (!mail || !mail.value.trim()) ng(mail, 'メールアドレスをご入力ください。');
      else if (!isMail(mail.value.trim())) ng(mail, 'メールアドレスの形式をご確認ください。');
      if (!body || !body.value.trim()) ng(body, 'お問い合わせ内容をご入力ください。');
      if (agree && !agree.checked) ng(agree, 'プライバシーポリシーへの同意が必要です。');

      if (!ok) {
        if (first && first.focus) first.focus();
        showMsg(form, 'err', '未入力・誤りのある項目があります。ご確認ください。');
        return;
      }

      var kindLabel = kind ? (kind.closest('label') ? kind.closest('label').textContent.trim() : kind.value) : '';
      var data = {
        _subject: '【えにわ愛ポイント】お問い合わせ（' + kindLabel + '）',
        種別: kindLabel,
        お名前: name.value.trim(),
        会社名店舗名: org ? org.value.trim() : '',
        メールアドレス: mail.value.trim(),
        電話番号: tel ? tel.value.trim() : '',
        お問い合わせ内容: body.value.trim(),
        送信元ページ: location.href
      };

      if (!F.contactEndpoint) {
        noEndpointNotice(form, data._subject,
          ['種別：' + data.種別, 'お名前：' + data.お名前,
           '会社名・店舗名：' + data.会社名店舗名, 'メール：' + data.メールアドレス,
           '電話番号：' + data.電話番号, '', data.お問い合わせ内容].join('\n'));
        return;
      }

      setBusy(form, true);
      post(F.contactEndpoint, data)
        .then(function () {
          form.reset();
          showMsg(form, 'ok',
            '<b>送信しました。</b><br>お問い合わせありがとうございます。' +
            '事務局より折り返しご連絡いたします。');
        })
        .catch(function (err) {
          showMsg(form, 'err',
            '<b>送信に失敗しました。</b><br>時間をおいて再度お試しいただくか、' +
            '<a href="mailto:' + MAIL + '">' + MAIL + '</a> までご連絡ください。' +
            '<br><span style="font-size:12px;opacity:.7;">（' + err.message + '）</span>');
        })
        .then(function () { setBusy(form, false); });
    });
  }

  /* ====================================================== 愛称投票 */
  function initVote(form) {
    form.setAttribute('novalidate', 'novalidate');

    form.addEventListener('change', function () {
      var e = form.querySelector('.field-err'); if (e) e.remove();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAllErrors(form);

      var picked = form.querySelector('input[name="nickname"]:checked');
      if (!picked) {
        var p = document.createElement('p');
        p.className = 'field-err';
        p.textContent = 'A〜Cのいずれかを選択してください。';
        form.appendChild(p);
        showMsg(form, 'err', '投票する案を選んでください。');
        return;
      }

      var label = picked.closest('label');
      var text = label ? label.textContent.replace(/\s+/g, ' ').trim() : picked.value;

      var data = {
        _subject: '【えにわ愛ポイント】愛称投票',
        投票案: picked.value,
        表示名: text,
        送信元ページ: location.href
      };

      if (!F.voteEndpoint) {
        showMsg(form, 'warn',
          '<b>「' + picked.value + '」を選択しました。</b><br>' +
          '※ 本ページはデザインモックのため、投票はまだ記録されません。' +
          '投票の受付開始までお待ちください。');
        return;
      }

      setBusy(form, true);
      post(F.voteEndpoint, data)
        .then(function () {
          showMsg(form, 'ok',
            '<b>投票を受け付けました。</b><br>ご協力ありがとうございます！<br>' +
            '本年10月末に愛称を決定し、当選者の方へご連絡いたします。');
          form.querySelectorAll('input[name="nickname"]').forEach(function (i) { i.disabled = true; });
          var btn = form.querySelector('button[type="submit"]');
          if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
        })
        .catch(function (err) {
          showMsg(form, 'err',
            '<b>送信に失敗しました。</b><br>時間をおいて再度お試しください。' +
            '<br><span style="font-size:12px;opacity:.7;">（' + err.message + '）</span>');
        })
        .then(function () { setBusy(form, false); });
    });
  }

  /* ========================================================== 起動 */
  function init() {
    document.querySelectorAll('form[data-form="contact"]').forEach(initContact);
    document.querySelectorAll('form[data-form="vote"]').forEach(initVote);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
