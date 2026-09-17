/* ===================================================================
   えにわ愛ポイント｜加盟店の一覧・詳細 表示
   -------------------------------------------------------------------
   site/assets/shops-data.js のデータから、
     ・加盟店のご案内（/shops/）      … カード一覧
     ・店舗詳細（/shops/<slug>/）      … 1店舗の詳細
   を組み立てます。

   管理画面（microCMS）を接続した場合は cms.js が一覧を差し替えるため、
   このファイルは「CMS未接続時の表示」と「詳細ページ」を担当します。
   =================================================================== */
(function () {
  'use strict';

  var SHOPS = window.AIPOINT_SHOPS || [];
  if (!SHOPS.length) return;

  var CAT_ICON = { '飲食': '🍴', '小売': '🛍️', 'サービス': '✂️', 'その他': '✨' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function telHref(t) { return 'tel:' + String(t || '').replace(/[^0-9]/g, ''); }
  function mapHref(addr) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr || '');
  }
  /* 未入力の項目は「準備中」と薄く表示する */
  function orPrep(v) {
    return v ? esc(v) : '<span style="color:#a58b9a;">準備中</span>';
  }

  /* ======================== 一覧（/shops/） ======================== */
  function renderList(grid, base) {
    grid.innerHTML = SHOPS.map(function (s) {
      var ic = CAT_ICON[s.category] || '✨';
      var photo = s.photo
        ? '<img src="' + esc(s.photo) + '" alt="' + esc(s.name) + '" loading="lazy" ' +
          'style="width:100%;aspect-ratio:16/10;object-fit:cover;">'
        : '<div class="ph">写真準備中</div>';
      return '' +
        '<a class="shop" data-cat="' + esc(s.category) + '" href="' + base + esc(s.slug) + '/">' +
          photo +
          '<div class="body">' +
            '<span class="cat-tag">' + ic + esc(s.category) + '</span>' +
            '<div class="nm">' + esc(s.name) + '</div>' +
            '<p style="font-size:13.5px;color:#6a5560;margin:2px 0 4px;line-height:1.7;">' +
              esc(s.description) + '</p>' +
            '<div class="meta">' +
              '<b style="color:var(--ink-d);">' + esc(s.genre) + '</b><br>' +
              '所在地：' + esc(s.address) + '<br>' +
              '営業時間：' + orPrep(s.hours) +
            '</div>' +
            '<span style="color:var(--pink-d);font-weight:800;font-size:13.5px;margin-top:auto;">' +
              'くわしく見る ›</span>' +
          '</div>' +
        '</a>';
    }).join('');
  }

  /* ==================== 詳細（/shops/<slug>/） ==================== */
  function renderDetail(root) {
    var slug = root.getAttribute('data-shop');
    var s = SHOPS.filter(function (x) { return x.slug === slug; })[0];
    if (!s) {
      root.innerHTML = '<div class="prep">お探しの加盟店が見つかりませんでした。' +
        '<a href="../">加盟店のご案内へ戻る</a></div>';
      return;
    }

    /* ページ見出し・パンくず・メタ情報をこの店舗のものにする */
    document.title = s.name + '｜加盟店のご案内｜えにわ愛ポイント';
    var h1 = document.querySelector('.pagehead h1');
    if (h1) h1.textContent = s.name;
    var lead = document.querySelector('.pagehead .ph-lead');
    if (lead) lead.textContent = s.genre;
    var last = document.querySelector('.pagehead .crumb span:last-child');
    if (last) last.textContent = s.name;
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', s.name + '（' + s.genre + '）｜' + s.description);

    var photo = s.photo
      ? '<img src="' + esc(s.photo) + '" alt="' + esc(s.name) + '" ' +
        'style="width:100%;border-radius:16px;aspect-ratio:16/10;object-fit:cover;">'
      : '<div class="ph" style="border-radius:16px;aspect-ratio:16/10;">写真準備中</div>';

    var rows = [
      ['カテゴリ', (CAT_ICON[s.category] || '') + s.category],
      ['業種・ジャンル', s.genre],
      ['所在地', esc(s.address) +
        ' <a href="' + mapHref(s.address) + '" target="_blank" rel="noopener" ' +
        'style="color:var(--pink-d);font-weight:800;white-space:nowrap;">地図を見る ›</a>'],
      ['電話番号', s.tel
        ? '<a href="' + telHref(s.tel) + '" style="color:var(--pink-d);font-weight:800;">' + esc(s.tel) + '</a>'
        : '準備中'],
      ['営業時間', orPrep(s.hours)],
      ['定休日', orPrep(s.holiday)],
      ['アクセス', orPrep(s.access)],
      ['ホームページ', s.url
        ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" ' +
          'style="color:var(--pink-d);font-weight:800;">' + esc(s.url) + '</a>'
        : '<span style="color:#a58b9a;">準備中</span>']
    ];
    var table = '<div class="tbl-wrap"><table class="tbl">' +
      rows.map(function (r) {
        /* 値に自前のHTML（リンク等）を含むため、ラベルのみエスケープ */
        return '<tr><th>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>';
      }).join('') + '</table></div>';

    var tags = (s.keywords && s.keywords.length)
      ? '<div class="chips" style="margin:18px 0 0;">' +
          s.keywords.map(function (k) {
            return '<span class="chip" style="cursor:default;">' + esc(k) + '</span>';
          }).join('') +
        '</div>'
      : '';

    root.innerHTML =
      '<div class="shop-detail">' +
        '<div>' + photo + '</div>' +
        '<div>' +
          '<span class="cat-tag">' + (CAT_ICON[s.category] || '') + esc(s.category) + '</span>' +
          '<p style="margin:10px 0 16px;line-height:1.95;">' + esc(s.description) + '</p>' +
          table +
        '</div>' +
      '</div>' +
      tags +
      '<div class="prep" style="margin-top:20px;">' +
        'このお店で <b>えにわ愛ポイント</b> がご利用いただけます。' +
        '100円のお買い物で1ポイント、1ポイント＝1円としてお支払いに使えます。' +
      '</div>';
  }

  /* ============================ 起動 ============================ */
  function init() {
    var detail = document.getElementById('shop-detail');
    if (detail) { renderDetail(detail); return; }

    var grid = document.querySelector('.shop-grid');
    if (grid) {
      renderList(grid, grid.getAttribute('data-base') || './');
      /* 件数表示・検索を再計算（search.js が読み込まれている場合） */
      if (window.aipointRefreshShops) window.aipointRefreshShops();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
