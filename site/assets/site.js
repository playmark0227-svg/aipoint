/* えにわ愛ポイント 公式ポータルサイト 共通スクリプト */
/* モバイル：ハンバーガーメニューの開閉 */
(function () {
  var btn = document.querySelector('.hamb');
  var nav = document.querySelector('.gnav');
  if (!btn || !nav) return;
  nav.id = 'gnav';
  btn.setAttribute('aria-controls', 'gnav');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();
