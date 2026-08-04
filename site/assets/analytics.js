/* ===================================================================
   えにわ愛ポイント｜アクセス解析（Google Analytics 4）
   -------------------------------------------------------------------
   site/assets/config.js の analytics.ga4Id に測定ID（G-XXXXXXXXXX）を
   設定すると計測が有効になります。未設定なら何も読み込みません。

   ■ 計測しているコンバージョン（KPI）
     - app_download : アプリDL / QRコードのクリック
     - contact_send : お問い合わせフォームの送信
     - vote_submit  : 愛称投票の送信
   =================================================================== */
(function () {
  'use strict';
  var CFG = (window.AIPOINT_CONFIG || {});
  var ID = (CFG.analytics || {}).ga4Id;
  if (!ID || ID.indexOf('G-') !== 0) return;   /* 未設定なら何もしない */

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID, { anonymize_ip: true });

  function track(name, params) { try { gtag('event', name, params || {}); } catch (e) {} }
  window.aipointTrack = track;

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('onelink.to') > -1) {
      track('app_download', { link_url: href, location: location.pathname });
    } else if (href.indexOf('tel:') === 0) {
      track('tel_click', { location: location.pathname });
    } else if (href.indexOf('mailto:') === 0) {
      track('mail_click', { location: location.pathname });
    }
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.getAttribute) return;
    var kind = f.getAttribute('data-form');
    if (kind === 'contact') track('contact_send', { location: location.pathname });
    if (kind === 'vote') track('vote_submit', { location: location.pathname });
  }, true);
})();
