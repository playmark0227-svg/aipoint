/* ===================================================================
   えにわ愛ポイント｜管理画面（ヘッドレスCMS）連携
   -------------------------------------------------------------------
   お知らせ・加盟店を microCMS の管理画面から取得して表示します。
   事務局様は管理画面で入力するだけで、HTMLを触らずに更新できます。

   ■ 設定方法（納品時に実施）
     site/assets/cms-config.js の SERVICE_DOMAIN と API_KEY を
     microCMS の管理画面で発行した値に書き換えてください。
     未設定の場合は、HTMLに書かれているサンプル内容がそのまま表示されます
     （＝設定前でもサイトは正常に表示されます）。

   ■ microCMS 側のAPI設計（cms-schema.md 参照）
     news : タイトル / 日付 / カテゴリ / 本文
     shops: 店名 / カテゴリ / 所在地 / 営業時間 / 写真 / 地図リンク
   =================================================================== */
(function () {
  'use strict';

  var CFG = window.AIPOINT_CMS || {};
  var READY = CFG.serviceDomain && CFG.apiKey &&
              CFG.serviceDomain.indexOf('YOUR-') !== 0 &&
              CFG.apiKey.indexOf('YOUR-') !== 0;

  /* CMS未設定なら何もしない（HTMLのサンプル表示を維持） */
  if (!READY) {
    if (window.console && CFG.debug) {
      console.info('[えにわ愛ポイント] CMS未設定のため、サンプル内容を表示しています。');
    }
    return;
  }

  var BASE = 'https://' + CFG.serviceDomain + '.microcms.io/api/v1/';

  function api(endpoint, query) {
    return fetch(BASE + endpoint + (query ? '?' + query : ''), {
      headers: { 'X-MICROCMS-API-KEY': CFG.apiKey }
    }).then(function (r) {
      if (!r.ok) throw new Error(endpoint + ' ' + r.status);
      return r.json();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 2026-08-04T00:00:00.000Z -> 2026.08.04 */
  function ymd(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d)) return esc(v);
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '.' + m + '.' + day;
  }

  /* カテゴリ名 -> バッジ配色（未知のカテゴリはピンク系） */
  var TAG_COLOR = {
    '説明会':      ['#fff0d9', '#a5701a'],
    'イベント':    ['#e4f5e6', '#2f7a3d'],
    '新規加盟店':  ['#ffe3ef', '#c02b74'],
    '新規加盟':    ['#ffe3ef', '#c02b74'],
    'メンテナンス': ['#eceaf5', '#4b4585'],
    'キャンペーン': ['#fff0d9', '#a5701a']
  };
  function tagStyle(name) {
    var c = TAG_COLOR[name] || ['#ffe3ef', '#c02b74'];
    return 'background:' + c[0] + ';color:' + c[1] + ';';
  }
  function tagHtml(name) {
    if (!name) return '';
    return '<span style="display:inline-block;' + tagStyle(name) +
      'font-size:11.5px;font-weight:800;padding:2px 10px;border-radius:999px;margin-right:10px;">' +
      esc(name) + '</span>';
  }

  /* カテゴリ値の取り出し（文字列／セレクト配列／参照オブジェクトに対応） */
  function catOf(item) {
    var c = item.category;
    if (!c) return '';
    if (Array.isArray(c)) return c[0] || '';
    if (typeof c === 'object') return c.name || c.title || '';
    return c;
  }

  /* ============================ お知らせ ============================ */
  function renderNews() {
    /* トップページの新着（.news） と 一覧ページ（.news-page） の両方に対応 */
    var top = document.querySelector('.news-latest');
    var page = document.querySelector('.news-page');
    if (!top && !page) return;

    var limit = page ? 20 : 3;
    api('news', 'limit=' + limit + '&orders=-publishedAt')
      .then(function (res) {
        var items = res.contents || [];
        if (!items.length) return;

        if (page) {
          page.innerHTML = items.map(function (n) {
            var href = n.id ? './' + esc(n.id) + '/' : '#';
            return '<a class="row" href="' + href + '" style="text-decoration:none;">' +
              '<span class="d">' + ymd(n.date || n.publishedAt) + '</span>' +
              '<span class="t">' + tagHtml(catOf(n)) + esc(n.title) + '</span></a>';
          }).join('');
        }
        if (top) {
          top.innerHTML = items.slice(0, 3).map(function (n) {
            return '<a href="news/" style="display:flex;gap:14px;align-items:center;padding:14px 4px;border-bottom:1px solid var(--line);">' +
              '<span style="color:var(--pink-d);font-weight:800;font-size:13px;width:92px;flex:none;">' +
                ymd(n.date || n.publishedAt) + '</span>' +
              '<span style="' + tagStyle(catOf(n)) +
                'font-weight:800;font-size:12px;padding:3px 10px;border-radius:999px;flex:none;">' +
                esc(catOf(n)) + '</span>' +
              '<span style="font-weight:700;">' + esc(n.title) + '</span></a>';
          }).join('');
        }
        /* サンプル表示の注記を消す */
        document.querySelectorAll('[data-cms-note="news"]').forEach(function (el) { el.remove(); });
      })
      .catch(function (e) { if (window.console) console.warn('[CMS] お知らせの取得に失敗:', e.message); });
  }

  /* ============================ 加盟店 ============================ */
  function renderShops() {
    var grid = document.querySelector('.shop-grid');
    if (!grid) return;

    api('shops', 'limit=100')
      .then(function (res) {
        var items = res.contents || [];
        if (!items.length) return;

        grid.innerHTML = items.map(function (s) {
          var img = s.photo && s.photo.url;
          var ph = img
            ? '<img src="' + esc(img) + '?w=640&fit=crop" alt="' + esc(s.name) +
              '" loading="lazy" style="width:100%;aspect-ratio:16/10;object-fit:cover;">'
            : '<div class="ph">写真準備中</div>';
          var map = s.map
            ? '<a href="' + esc(s.map) + '" target="_blank" rel="noopener" style="color:var(--pink-d);font-weight:800;">地図を見る ›</a>'
            : '';
          return '<div class="shop" data-cat="' + esc(catOf(s)) + '">' + ph +
            '<div class="body">' +
            (catOf(s) ? '<span class="cat-tag">' + esc(catOf(s)) + '</span>' : '') +
            '<div class="nm">' + esc(s.name) + '</div>' +
            '<div class="meta">' +
            (s.address ? '所在地：' + esc(s.address) + '<br>' : '') +
            (s.hours ? '営業時間：' + esc(s.hours) + '<br>' : '') +
            map + '</div></div></div>';
        }).join('');

        document.querySelectorAll('[data-cms-note="shops"]').forEach(function (el) { el.remove(); });
        wireFilter();
      })
      .catch(function (e) { if (window.console) console.warn('[CMS] 加盟店の取得に失敗:', e.message); });
  }

  /* カテゴリ絞り込み（CMSデータ表示後に有効化） */
  function wireFilter() {
    var chips = document.querySelectorAll('.chips .chip');
    if (!chips.length) return;
    chips.forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.preventDefault();
        chips.forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        var label = chip.textContent.replace(/[^぀-ヿ一-鿿]/g, '').trim();
        document.querySelectorAll('.shop').forEach(function (card) {
          var show = !label || label === 'すべて' || card.getAttribute('data-cat') === label;
          card.style.display = show ? '' : 'none';
        });
      });
    });
    var note = document.querySelector('[data-cms-note="filter"]');
    if (note) note.remove();
  }

  /* ============================ 実行 ============================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { renderNews(); renderShops(); });
  } else {
    renderNews(); renderShops();
  }
})();
