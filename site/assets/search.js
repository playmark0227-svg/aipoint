/* ===================================================================
   えにわ愛ポイント｜加盟店の検索・絞り込み
   -------------------------------------------------------------------
   キーワード検索（店名・カテゴリ・所在地）とカテゴリチップの
   両方を組み合わせて、加盟店カードを絞り込みます。
   CMS未設定でも、HTMLに書かれたサンプルカードに対して動作します。
   =================================================================== */
(function () {
  'use strict';
  var grid = document.querySelector('.shop-grid');
  if (!grid) return;

  var bar = document.querySelector('.searchbar');
  var input = bar && bar.querySelector('input');
  var clearBtn = bar && bar.querySelector('.clear');
  var countEl = document.querySelector('.result-count');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chips .chip'));

  function chipLabel(el) {
    return el.textContent.replace(/[^぀-ヿ一-鿿]/g, '').trim();
  }
  function cards() {
    return Array.prototype.slice.call(grid.querySelectorAll('.shop'));
  }
  function currentCat() {
    var on = document.querySelector('.chips .chip.on');
    var l = on ? chipLabel(on) : '';
    return (!l || l === 'すべて') ? '' : l;
  }

  function apply() {
    var q = (input && input.value || '').trim().toLowerCase();
    var cat = currentCat();
    var shown = 0;

    cards().forEach(function (card) {
      var cardCat = card.getAttribute('data-cat') ||
        (card.querySelector('.cat-tag') ? card.querySelector('.cat-tag').textContent.trim() : '');
      var text = card.textContent.toLowerCase();
      var okCat = !cat || cardCat.indexOf(cat) > -1;
      var okQ = !q || text.indexOf(q) > -1;
      var show = okCat && okQ;
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    });

    if (countEl) {
      countEl.textContent = (q || cat)
        ? shown + '件が該当しました' + (cat ? '（カテゴリ：' + cat + '）' : '')
        : '全' + cards().length + '件';
    }
    var nores = document.querySelector('.no-result');
    if (nores) nores.style.display = shown ? 'none' : '';
    if (clearBtn) clearBtn.style.display = (q ? '' : 'none');
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      chips.forEach(function (c) { c.classList.remove('on'); });
      chip.classList.add('on');
      apply();
    });
  });
  if (input) {
    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function () { if (input) { input.value = ''; input.focus(); } apply(); });
  }

  /* CMSが後からカードを差し替えても件数表示を更新する */
  if (window.MutationObserver) {
    new MutationObserver(function () { apply(); }).observe(grid, { childList: true });
  }
  apply();
})();
