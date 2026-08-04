/* ===================================================================
   えにわ愛ポイント｜お知らせ 記事詳細
   -------------------------------------------------------------------
   /news/article/?id=xxxx で個別記事を表示します。
   管理画面（microCMS）の「お知らせ」から本文を取得します。
   CMS未設定・記事が見つからない場合は、一覧へ戻る案内を表示します。
   =================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('article');
  if (!root) return;

  var CFG = (window.AIPOINT_CONFIG || {});
  var C = CFG.cms || {};
  var READY = C.serviceDomain && C.apiKey &&
              C.serviceDomain.indexOf('YOUR-') !== 0 && C.apiKey.indexOf('YOUR-') !== 0;

  var TAG_COLOR = {
    '説明会': ['#fff0d9', '#a5701a'], 'イベント': ['#e4f5e6', '#2f7a3d'],
    '新規加盟店': ['#ffe3ef', '#c02b74'], '新規加盟': ['#ffe3ef', '#c02b74'],
    'メンテナンス': ['#eceaf5', '#4b4585'], 'キャンペーン': ['#fff0d9', '#a5701a']
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ymd(v) {
    if (!v) return '';
    var d = new Date(v); if (isNaN(d)) return esc(v);
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  }
  function catOf(x) {
    var c = x.category; if (!c) return '';
    if (Array.isArray(c)) return c[0] || '';
    if (typeof c === 'object') return c.name || c.title || '';
    return c;
  }
  function notice(html) {
    root.innerHTML = '<div class="prep">' + html + '</div>';
  }

  var id = new URLSearchParams(location.search).get('id');

  if (!id) { notice('記事が指定されていません。<a href="../">お知らせ一覧</a>からお選びください。'); return; }
  if (!READY) {
    notice('※ 管理画面（CMS）の設定前のため、記事本文は表示されません。<br>' +
           '公開後は、管理画面に登録したお知らせがこのページに表示されます。<br>' +
           '<a href="../">お知らせ一覧へ戻る</a>');
    return;
  }

  fetch('https://' + C.serviceDomain + '.microcms.io/api/v1/' +
        (C.newsEndpoint || 'news') + '/' + encodeURIComponent(id),
        { headers: { 'X-MICROCMS-API-KEY': C.apiKey } })
    .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? 'notfound' : 'HTTP ' + r.status); return r.json(); })
    .then(function (n) {
      var cat = catOf(n);
      var col = TAG_COLOR[cat] || ['#ffe3ef', '#c02b74'];
      document.title = n.title + '｜お知らせ｜えにわ愛ポイント';
      /* 見出し(h1)はページ上部の1つだけに保つ（記事タイトルをそこに表示） */
      var h1 = document.querySelector('.pagehead h1');
      if (h1) h1.textContent = n.title;
      var lead = document.querySelector('.pagehead .ph-lead');
      if (lead) lead.remove();
      var crumbLast = document.querySelector('.pagehead .crumb span:last-child');
      if (crumbLast) crumbLast.textContent = n.title;
      root.innerHTML =
        '<div class="meta-row">' +
          '<span class="date">' + ymd(n.date || n.publishedAt) + '</span>' +
          (cat ? '<span style="background:' + col[0] + ';color:' + col[1] +
                 ';font-size:12px;font-weight:800;padding:3px 12px;border-radius:999px;">' +
                 esc(cat) + '</span>' : '') +
        '</div>' +
        '<div class="article-body">' + (n.body || '<p>本文は準備中です。</p>') + '</div>';
      /* 本文はCMSのリッチエディタ出力（管理画面で入力した内容）をそのまま表示 */
    })
    .catch(function (e) {
      if (e.message === 'notfound') {
        notice('お探しの記事は見つかりませんでした。<br><a href="../">お知らせ一覧へ戻る</a>');
      } else {
        notice('記事の取得に失敗しました。時間をおいて再度お試しください。<br>' +
               '<a href="../">お知らせ一覧へ戻る</a>');
      }
    });
})();
