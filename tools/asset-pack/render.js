/* えにわ愛ポイント｜サイト使用素材一式：スクリーンショット・README PDF の作成
 *
 *   node tools/asset-pack/render.js <作業フォルダ> [--site]
 *   （build.py の後に実行。手順は build.py の先頭を参照）
 *
 *   ・素材フォルダの 09_reference にトップページの画面（PC／スマホ）を保存
 *   ・_work/readme.html を 00_README.pdf にする
 *   ・SVG（QR・アイコン）を画像に書き出して、確認用に _work/verify/ へ保存
 *   ・--site を付けると、サイト側の OGP 画像・資料用スクリーンショットも撮り直す
 *     （トップページの見た目が変わったときに使う）
 *
 *   必要なもの：npm i --no-save playwright-core @fontsource/zen-maru-gothic ／ Chromium
 *   画面は iPhone・Mac の表示（ヒラギノ丸ゴ）に近づけるため、丸ゴシック体（Zen Maru Gothic）で撮影する
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const req = m => { try { return require(path.join(ROOT, 'node_modules', m)); } catch (e) { return null; } };
const pw = req('playwright-core');
if (!pw) { console.error('✗ playwright-core がありません（npm i --no-save playwright-core）'); process.exit(1); }

const WORK = path.resolve(process.argv[2] || '');
const PACK = path.join(WORK, 'eniwa-aipoint_site-assets');
const W = path.join(WORK, '_work');
const SITE = process.argv.includes('--site');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TOP = 'file://' + path.join(ROOT, 'site', 'index.html');
const FONT_CSS = [400, 500, 700, 900].map(w =>
  path.join(ROOT, 'node_modules', '@fontsource', 'zen-maru-gothic', `${w}.css`));

/* 何かを書き換える前に、必要なものが揃っているか確かめる */
for (const f of ['.asset-pack', '_work/readme.html', 'eniwa-aipoint_site-assets/04_icons/icon_01_touroku.svg',
                 'eniwa-aipoint_site-assets/07_qr/app-download-qr.svg']) {
  if (!fs.existsSync(path.join(WORK, f))) {
    console.error(`✗ ${path.join(WORK, f)} がありません。先に build.py を実行してください`);
    process.exit(1);
  }
}
if (!fs.existsSync(EXE)) { console.error(`✗ Chromium がありません: ${EXE}（環境変数 CHROME で指定）`); process.exit(1); }
const ROUNDED = FONT_CSS.every(f => fs.existsSync(f));
if (!ROUNDED) console.warn('! @fontsource/zen-maru-gothic が無いため、標準のフォントで撮影します');

async function settle(p) {
  if (ROUNDED) {
    for (const f of FONT_CSS) await p.addStyleTag({ url: 'file://' + f });
    await p.addStyleTag({ content: 'html body, html body *{font-family:"Hiragino Maru Gothic ProN","Zen Maru Gothic",sans-serif !important;}' });
  }
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
    await Promise.all([...document.images].filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready;
  });
  await p.waitForTimeout(400);
}

async function open(b, w, h, dsf, url) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(url, { waitUntil: 'networkidle' });
  await settle(p);
  const broken = await p.evaluate(() =>
    [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
  if (errs.length || broken.length) throw new Error(`${url}: エラー ${errs} / 画像欠け ${broken}`);
  return { c, p };
}

(async () => {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  fs.mkdirSync(path.join(W, 'thumbs'), { recursive: true });
  fs.mkdirSync(path.join(W, 'verify'), { recursive: true });

  /* 1) トップページの画面（素材フォルダ用）＋README の見本用（最初の1画面を縮小） */
  for (const [w, h, dsf, name] of [[1280, 900, 1, 'pc'], [390, 844, 2, 'sp']]) {
    let { c, p } = await open(b, w, h, dsf, TOP);
    await p.screenshot({ path: path.join(PACK, '09_reference', `site-top_${name}.jpg`),
      fullPage: true, type: 'jpeg', quality: 85 });
    await c.close();
    ({ c, p } = await open(b, w, h, 220 / w, TOP));
    await p.screenshot({ path: path.join(W, 'thumbs', `09_reference_site-top_${name}.jpg`), type: 'jpeg', quality: 85 });
    await c.close();
  }

  /* 2) サイト側の画像（--site のときだけ） */
  if (SITE) {
    for (const [w, h, dsf, out] of [[1280, 900, 1, 'docs/assets/top-desktop.png'],
                                    [390, 844, 2, 'docs/assets/top-mobile.png']]) {
      const { c, p } = await open(b, w, h, dsf, TOP);
      await p.screenshot({ path: path.join(ROOT, out), fullPage: true });
      await c.close();
    }
    let { c, p } = await open(b, 1200, 630, 1, TOP);
    await p.screenshot({ path: path.join(ROOT, 'site/ogp.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await c.close();
    /* ご説明資料に載せている縮小プレビュー（PC：幅1280・高さ3302まで／スマホ：幅460・高さ4736まで） */
    ({ c, p } = await open(b, 1280, 900, 1, TOP));
    let H = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: path.join(ROOT, 'site/images/preview-pc-0718.jpg'), type: 'jpeg', quality: 82,
      fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(H, 3302) } });
    await c.close();
    const s = 460 / 390;
    ({ c, p } = await open(b, 390, 844, s, TOP));
    H = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: path.join(ROOT, 'site/images/preview-sp-0718.jpg'), type: 'jpeg', quality: 82,
      fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.min(H, Math.floor(4736 / s)) } });
    await c.close();
  }

  /* 3) SVGを画像に書き出して確認用に保存 */
  for (const [svg, px, out] of [['04_icons/icon_01_touroku.svg', 1600, 'touroku_svg.png'],
                                ['07_qr/app-download-qr.svg', 990, 'qr_svg.png']]) {
    const c = await b.newContext({ viewport: { width: px, height: px } });
    const p = await c.newPage();
    const html = path.join(W, 'verify', out + '.html');   // file:// の画像は file:// のページからしか読めない
    fs.writeFileSync(html, `<html><body style="margin:0;background:transparent"><img src="file://${path.join(PACK, svg)}"
      style="width:${px}px;height:${px}px;display:block"></body></html>`);
    await p.goto('file://' + html);
    await p.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0,
      null, { timeout: 10000 });
    await p.screenshot({ path: path.join(W, 'verify', out), omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
    await c.close();
  }

  /* 4) README を PDF に */
  const c = await b.newContext({ viewport: { width: 794, height: 1123 } });
  const p = await c.newPage();
  await p.goto('file://' + path.join(W, 'readme.html'), { waitUntil: 'networkidle' });
  const broken = await p.evaluate(() =>
    [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
  if (broken.length) throw new Error('README の見本画像が読めません: ' + broken);
  await p.pdf({ path: path.join(PACK, '00_README.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await c.close();

  await b.close();
  console.log('render ok' + (SITE ? '（サイト側の画像も更新）' : '') + (ROUNDED ? '・丸ゴシック体で撮影' : ''));
})().catch(e => { console.error(e); process.exit(1); });
