#!/usr/bin/env python3
"""えにわ愛ポイント｜サイト使用素材一式（フライヤー等の制作用）を組み立てる

  python3 tools/asset-pack/build.py <出力フォルダ>

・サイト掲載用に縮小・圧縮する前の「元データ」を git 履歴から取り出して同梱する
  （アップロード時の元ファイルは、サイト組み込み後にリポジトリ直下から整理済みのため）
・サイトで実際に使っている画像だけを対象にする（未使用の旧素材は含めない）
・ZIP内のファイル名は英数字のみ（Windows標準の解凍で文字化けしないように）

画像の準備だけを行う。スクリーンショットと 00_README.pdf は render.js が作成する。
"""
import io
import json
import os
import shutil
import subprocess
import sys
import unicodedata

from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'asset-pack')

# ---------------------------------------------------------------- 元データの所在
# 6/27 アップロード（背景・アイコン・枠・ハート・スタンプ）
UP_0627 = 'd054311'
HERO = '4f9cf4bda68515757a7e24d00cefadb9435f655b31c9215c3203d4d0f46ebe2d.png'
ICONS = '8fa082a50cbd56a7a4b930a97e99f4844107557c38b1b44301f69ba3c2bc3d4b.png'
FRAME = 'a7a53734b4628b42226ceb89d2279f9afa4cbee28ebf39e8a513412d6bb4b030.png'
HEART = 'ad1002a6040661001c1a89cfa9f49dd1cb999bbca4d3184954df99c424e72ec1.png'
STAMP = 'c047ccd4e4f5a51fce1d8b001a53865cd546b63862fb15a8a872d210641dc52e.png'
# 6/30 ご支給の公式ロゴ（5色）
UP_LOGO = '522bb40'
LOGOS = [('pink', 'ピンク'), ('orange', 'オレンジ'), ('cyan', 'シアン'),
         ('green', '緑'), ('blue', '青')]
# 7/1 ご支給の公式キャラクター（LINEで受領）
UP_CHAR = 'ac2b623'
CHAR = 'LINE_20260629_134111.jpg'

# サイト掲載時と同じ切り抜き位置（アイコンシート 1536x1024 の1段目）
ICON_BOXES = [('02_tameru', (60, 12, 470, 422)),     # ポイントが貯まる
              ('03_tsukaeru', (572, 12, 982, 422))]  # お店で使える

# サイトで使っている色（site/assets/site.css の :root）
PALETTE = [
    ('--pink', '#e85a9c', 'メインピンク（ボタン・アクセント）'),
    ('--pink-d', '#d63f86', '濃いピンク（リンク・小見出し）'),
    ('--magenta', '#e4007f', '強調色（キャッチコピーの強調）'),
    ('--pink-soft', '#ffd6e6', '淡いピンク（枠線・区切り）'),
    ('--pink-bg', '#ffeef5', '背景ピンク（面・カード）'),
    ('--pink-bg2', '#ffe1ee', '背景ピンク（やや濃い）'),
    ('--line', '#f6d9e6', '罫線'),
    ('--cream', '#fff7da', 'クリーム（学生向けバナー）'),
    ('--cream-line', '#f1e3a0', 'クリームの枠線'),
    ('--ink', '#534a4f', '本文の文字色'),
    ('--ink-d', '#3f383c', '見出しの文字色'),
]


def git_blob(rev, path):
    return subprocess.run(['git', '-C', ROOT, 'show', f'{rev}:{path}'],
                          check=True, capture_output=True).stdout


def write(rel, data):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'wb') as f:
        f.write(data)
    return p


def copy_site(src, rel):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    shutil.copyfile(os.path.join(ROOT, 'site', 'images', src), p)
    return p


def mean_diff(a, b):
    """2枚の画像の平均差（0〜255）。元データとサイト画像の対応確認に使う"""
    def flat(im):   # 透過部分の色は不定なので、白背景に合成してから比べる
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        return bg.convert('RGB')
    a = flat(a)
    b = flat(b).resize(a.size, Image.LANCZOS)
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3


def same_source(orig_bytes, site_name, crop=None):
    """取り出した元データが、サイトの画像の元になったものか確かめる"""
    o = Image.open(io.BytesIO(orig_bytes))
    if crop:
        o = o.crop(crop)
    s = Image.open(os.path.join(ROOT, 'site', 'images', site_name))
    d = mean_diff(o, s)
    assert d < 6, f'{site_name}: 元データと一致しません（平均差 {d:.1f}）'
    return d


def trim_alpha(im, pad, th=8):
    """透明の余白を詰める。元データは全面に目に見えないほど薄い半透明（不透明度1〜7）が
    散っていて、そのままだと印刷で薄い四角が出ることがあるため、th 未満は完全な透明にする"""
    im = im.convert('RGBA')
    a = im.getchannel('A').point(lambda v: v if v >= th else 0)
    im.putalpha(a)
    l, u, r, d = a.getbbox()
    return im.crop((max(0, l - pad), max(0, u - pad),
                    min(im.width, r + pad), min(im.height, d + pad)))


# ------------------------------------------- 公式キャラクター（CMYK → Web用RGB）
# 受領データは印刷用のCMYK（キャラのピンク＝C0 M65 Y0 K4、文字＝K80）で、ICCプロファイルは未埋め込み。
# 単純な計算式で変換すると紫がかったマゼンタ（#f456f4）になり、ロゴのピンク（#eb6ea5）と
# 揃わないため、印刷用プロファイル（SWOP）を通して印刷した時の色に合わせてRGBへ変換する。
CMYK_PROFILES = ['/usr/share/color/icc/ghostscript/default_cmyk.icc']


def character_rgb(data):
    from collections import deque
    from PIL import ImageCms
    prof = next((p for p in CMYK_PROFILES if os.path.exists(p)), None)
    assert prof, 'CMYKプロファイルがありません（apt-get install ghostscript）'
    src = Image.open(io.BytesIO(data))
    assert src.mode == 'CMYK'
    tf = ImageCms.buildTransform(ImageCms.getOpenProfile(prof), ImageCms.createProfile('sRGB'),
                                 'CMYK', 'RGB',
                                 renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC)
    im = ImageCms.applyTransform(src, tf).convert('RGBA')
    # 外周につながる白だけを透明にする（目の白は残す）＝サイト掲載時と同じ方法
    W, H = im.size
    px = im.load()
    white = lambda x, y: min(px[x, y][:3]) >= 236
    seen = bytearray(W * H)
    dq = deque((x, y) for x in range(W) for y in (0, H - 1))
    dq.extend((x, y) for y in range(H) for x in (0, W - 1))
    while dq:
        x, y = dq.popleft()
        if seen[y * W + x] or not white(x, y):
            continue
        seen[y * W + x] = 1
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                dq.append((nx, ny))
    return im.crop(im.getchannel('A').getbbox())


# ------------------------------------------------ ①会員登録アイコン（制作側で作図）
# サイトの step-touroku.png と同じ図形。印刷用に大きなPNGとSVG（ベクター）で出力する。
BG, PINK, OUTL = '#feedf3', '#fa6196', '#552819'
SCREEN, WHITE, YEL = '#ffe3ee', '#fefefe', '#ffc13c'
QR_X, QR_Y, QR_CELL = 130, 96, 8.6
FINDERS = [(0, 0), (4, 0), (0, 4)]
DATA = [(4, 4), (6, 4), (4, 6), (5, 5), (6, 6), (3, 2), (2, 3), (3, 4), (5, 3), (3, 6)]


def spark_pts(cx, cy, r):
    q = r * 0.28
    return [(cx, cy - r), (cx + q, cy - q), (cx + r, cy), (cx + q, cy + q),
            (cx, cy + r), (cx - q, cy + q), (cx - r, cy), (cx - q, cy - q)]


HEART_C = [(205.3, 205.3, 9.3), (216.7, 205.3, 9.3)]
HEART_TRI = [(196, 206.2), (226, 206.2), (211, 225.4)]


def touroku_png(size):
    S = size * 4
    k = S / 320.0
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    R = lambda *v: [x * k for x in v]
    d.ellipse(R(8, 8, 312, 312), fill=BG)
    d.rounded_rectangle(R(104, 46, 216, 276), radius=26 * k, fill=WHITE, outline=OUTL, width=int(9 * k))
    d.rounded_rectangle(R(120, 72, 200, 236), radius=10 * k, fill=SCREEN, outline=OUTL, width=int(5 * k))
    d.rounded_rectangle(R(146, 252, 174, 260), radius=4 * k, fill=OUTL)

    def blk(cx, cy, w=1, h=1):
        d.rectangle(R(QR_X + cx * QR_CELL, QR_Y + cy * QR_CELL,
                      QR_X + (cx + w) * QR_CELL, QR_Y + (cy + h) * QR_CELL), fill=OUTL)
    for fx, fy in FINDERS:
        blk(fx, fy, 3, 3)
        d.rectangle(R(QR_X + (fx + .6) * QR_CELL, QR_Y + (fy + .6) * QR_CELL,
                      QR_X + (fx + 2.4) * QR_CELL, QR_Y + (fy + 2.4) * QR_CELL), fill=SCREEN)
        blk(fx + 1, fy + 1)
    for cx, cy in DATA:
        blk(cx, cy)
    for cx, cy, r in HEART_C:
        d.ellipse(R(cx - r, cy - r, cx + r, cy + r), fill=PINK)
    d.polygon([(x * k, y * k) for x, y in HEART_TRI], fill=PINK)
    for cx, cy, r in [(238, 86, 26), (258, 128, 15)]:
        d.polygon([(x * k, y * k) for x, y in spark_pts(cx, cy, r)], fill=YEL)
    return im.resize((size, size), Image.LANCZOS)


def touroku_svg():
    f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
    pts = lambda ps: ' '.join(f'{f(x)},{f(y)}' for x, y in ps)
    c = QR_CELL
    parts = [
        f'<circle cx="160" cy="160" r="152" fill="{BG}"/>',
        # PIL の枠線は内側に描かれるため、線幅の半分だけ内側にずらして同じ見た目にする
        f'<rect x="108.5" y="50.5" width="103" height="221" rx="21.5" fill="{WHITE}" stroke="{OUTL}" stroke-width="9"/>',
        f'<rect x="122.5" y="74.5" width="75" height="159" rx="7.5" fill="{SCREEN}" stroke="{OUTL}" stroke-width="5"/>',
        f'<rect x="146" y="252" width="28" height="8" rx="4" fill="{OUTL}"/>',
    ]
    for fx, fy in FINDERS:
        parts.append(f'<rect x="{f(QR_X + fx * c)}" y="{f(QR_Y + fy * c)}" width="{f(3 * c)}" height="{f(3 * c)}" fill="{OUTL}"/>')
        parts.append(f'<rect x="{f(QR_X + (fx + .6) * c)}" y="{f(QR_Y + (fy + .6) * c)}" width="{f(1.8 * c)}" height="{f(1.8 * c)}" fill="{SCREEN}"/>')
        parts.append(f'<rect x="{f(QR_X + (fx + 1) * c)}" y="{f(QR_Y + (fy + 1) * c)}" width="{f(c)}" height="{f(c)}" fill="{OUTL}"/>')
    for cx, cy in DATA:
        parts.append(f'<rect x="{f(QR_X + cx * c)}" y="{f(QR_Y + cy * c)}" width="{f(c)}" height="{f(c)}" fill="{OUTL}"/>')
    for cx, cy, r in HEART_C:
        parts.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{PINK}"/>')
    parts.append(f'<polygon points="{pts(HEART_TRI)}" fill="{PINK}"/>')
    for cx, cy, r in [(238, 86, 26), (258, 128, 15)]:
        parts.append(f'<polygon points="{pts(spark_pts(cx, cy, r))}" fill="{YEL}"/>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<!-- えにわ愛ポイント 使い方①「会員登録」アイコン（拡大しても劣化しないベクター版） -->\n'
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">\n  '
            + '\n  '.join(parts) + '\n</svg>\n')


# --------------------------------------------- アプリDL用QR（ご支給のQRと同じ模様）
def qr_matrix():
    """ご支給のQR画像（qr-app.png）からモジュール（黒白のマス）を読み取る"""
    im = Image.open(os.path.join(ROOT, 'site', 'images', 'qr-app.png')).convert('L')
    px = im.load()
    bb = ImageChops.invert(im).point(lambda v: 255 if v > 128 else 0).getbbox()
    x0, y0, x1, y1 = bb
    run = 0
    while px[x0 + run, y0 + 2] < 128:
        run += 1
    mod = run / 7.0                          # 位置検出パターンは7モジュール幅
    n = round((x1 - x0) / mod)
    assert n in (21, 25, 29, 33), f'QRのサイズを判定できません（{n}）'
    return [[1 if px[int(x0 + (i + .5) * mod), int(y0 + (j + .5) * mod)] < 128 else 0
             for i in range(n)] for j in range(n)]


def qr_svg(m, quiet=4):
    n = len(m)
    full = n + quiet * 2
    runs = []
    for y, row in enumerate(m):              # 横に連続する黒マスを1本の四角にまとめる
        x = 0
        while x < n:
            if row[x]:
                s = x
                while x < n and row[x]:
                    x += 1
                runs.append(f'M{s + quiet} {y + quiet}h{x - s}v1h-{x - s}z')
            else:
                x += 1
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<!-- えにわ愛ポイント アプリダウンロード用QR（http://onelink.to/rmdmub）ベクター版 -->\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {full} {full}" width="{full * 10}" height="{full * 10}" shape-rendering="crispEdges">\n'
            f'  <rect width="{full}" height="{full}" fill="#ffffff"/>\n'
            f'  <path fill="#000000" d="{"".join(runs)}"/>\n</svg>\n')


def qr_png(m, size, quiet=4):
    n = len(m)
    full = n + quiet * 2
    unit = max(1, size // full)
    im = Image.new('L', (full * unit, full * unit), 255)
    d = ImageDraw.Draw(im)
    for y, row in enumerate(m):
        for x, v in enumerate(row):
            if v:
                d.rectangle([(x + quiet) * unit, (y + quiet) * unit,
                             (x + quiet + 1) * unit - 1, (y + quiet + 1) * unit - 1], fill=0)
    return im


# ------------------------------------------------------------------ カラー見本
def palette_png():
    from PIL import ImageFont
    font = None
    for fp in ['/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
               '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf']:
        if os.path.exists(fp):
            font = ImageFont.truetype(fp, 26)
            small = ImageFont.truetype(fp, 20)
            break
    cols, sw, sh, gap = 4, 360, 250, 24
    rows = (len(PALETTE) + cols - 1) // cols
    W = cols * sw + (cols + 1) * gap
    H = rows * sh + (rows + 1) * gap
    im = Image.new('RGB', (W, H), '#ffffff')
    d = ImageDraw.Draw(im)
    for i, (var, hx, label) in enumerate(PALETTE):
        x = gap + (i % cols) * (sw + gap)
        y = gap + (i // cols) * (sh + gap)
        d.rounded_rectangle([x, y, x + sw, y + 150], radius=18, fill=hx, outline='#e6d6de', width=2)
        r, g, b = (int(hx[j:j + 2], 16) for j in (1, 3, 5))
        d.text((x + 4, y + 160), hx.upper(), fill='#3f383c', font=font)
        d.text((x + 150, y + 164), f'R{r} G{g} B{b}', fill='#6a5560', font=small)
        d.text((x + 4, y + 200), label, fill='#6a5560', font=small)
    return im


# ------------------------------------------------------- 00_README.pdf の元（HTML）
LOGO_COLORS = [('ピンク（サイトで使用）', '#eb6ea5'), ('オレンジ', '#f39700'), ('シアン', '#00a0e9'),
               ('緑', '#5bb531'), ('青', '#4653a2')]
DPI = 350


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def print_size(x):
    if x['file'].endswith('.svg'):
        return '<b>拡大自由</b><br><small>（ベクター）</small>'
    if x['kind'] == 'ref' or not x['px']:
        return '—'
    w, h = (round(v * 25.4 / DPI) for v in x['px'])
    return f'約{w}×{h}mm'


def thumb_path(rel):
    """README の見本に使う縮小画像（PDFを軽くするため）。SVG はそのまま使う"""
    if rel.endswith('.svg'):
        return None
    return 'thumbs/' + rel.replace('/', '_').rsplit('.', 1)[0] + ('.png' if rel.endswith('.png') else '.jpg')


def make_thumbs(files, parent):
    os.makedirs(os.path.join(parent, 'thumbs'), exist_ok=True)
    for x in files:
        t = thumb_path(x['file'])
        src = os.path.join(OUT, x['file'])
        if not t or not os.path.exists(src):
            continue            # スクリーンショットの見本は render.js が作る
        im = Image.open(src)
        if im.mode == 'CMYK':   # 単純変換だと紫がかるため、印刷時の色で見本を作る
            from PIL import ImageCms
            prof = next(p for p in CMYK_PROFILES if os.path.exists(p))
            im = ImageCms.profileToProfile(im, prof, ImageCms.createProfile('sRGB'), outputMode='RGB')
        im = im.convert('RGBA') if t.endswith('.png') else im.convert('RGB')
        im.thumbnail((220, 220), Image.LANCZOS)
        im.save(os.path.join(parent, t), optimize=True, **({} if t.endswith('.png') else {'quality': 85}))


def readme_html(files, pack_dir):
    groups = [('01_logo', '公式ロゴ'), ('02_character', '公式キャラクター'), ('03_background', '背景'),
              ('04_icons', 'アイコン・マーク'), ('05_frame', 'キャンペーン枠'), ('06_stamp', 'スタンプラリー'),
              ('07_qr', 'アプリダウンロード用QRコード'), ('08_fighters', 'ファイターズ'),
              ('09_reference', '参考（色見本・サイト画面）')]
    rows = []
    no = 0
    for folder, title in groups:
        # 見出し行だけがページ末に残らないよう、グループごとに tbody でまとめて改ページさせない
        rows.append(f'</tbody><tbody class="g"><tr class="grp"><td colspan="7">{esc(folder)}／　{esc(title)}</td></tr>')
        for x in [f for f in files if f['file'].startswith(folder + '/')]:
            no += 1
            name = x['file'].split('/', 1)[1]
            px = f"{x['px'][0]}×{x['px'][1]}" if x['px'] else ('ベクター' if name.endswith('.svg') else '—')
            src_cls = 'own' if x['source'].startswith('制作側') else 'cli'
            note = f'<div class="note">※{esc(x["note"])}</div>' if x['note'] else ''
            rows.append(
                f'<tr><td class="no">{no}</td>'
                f'<td class="th"><img src="{esc(thumb_path(x["file"]) or pack_dir + "/" + x["file"])}" alt=""></td>'
                f'<td><code>{esc(name)}</code><div class="desc">{esc(x["desc"])}</div>{note}</td>'
                f'<td class="used">{esc(x["used"])}</td>'
                f'<td class="px">{px}</td><td class="pr">{print_size(x)}</td>'
                f'<td><span class="src {src_cls}">{esc(x["source"])}</span></td></tr>')

    sw = ''.join(
        f'<tr><td><span class="sw" style="background:{hx}"></span></td><td><code>{hx.upper()}</code></td>'
        f'<td>R{int(hx[1:3], 16)} G{int(hx[3:5], 16)} B{int(hx[5:7], 16)}</td><td>{esc(label)}</td></tr>'
        for _, hx, label in PALETTE)
    logo_sw = ''.join(
        f'<span class="chip"><span class="sw" style="background:{hx}"></span>{esc(n)} <code>{hx.upper()}</code></span>'
        for n, hx in LOGO_COLORS)

    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>えにわ愛ポイント サイト使用素材一式</title>
<style>
@page{{size:A4;margin:13mm 12mm 14mm;}}
*{{box-sizing:border-box;}}
body{{font-family:"Noto Sans CJK JP","IPAGothic",sans-serif;color:#3f383c;font-size:9.2pt;line-height:1.6;margin:0;}}
h1{{font-size:17pt;margin:0 0 2mm;color:#3f383c;letter-spacing:.02em;}}
h1 small{{display:block;font-size:10pt;color:#d63f86;font-weight:700;margin-bottom:1mm;}}
h2{{font-size:12pt;margin:7mm 0 2.5mm;padding:1.2mm 0 1.2mm 3.5mm;border-left:2.2mm solid #e85a9c;background:#ffeef5;}}
.meta{{color:#6a5560;font-size:8.8pt;}}
.lead{{background:#fff7da;border:1px solid #f1e3a0;border-radius:3mm;padding:3mm 4mm;margin:4mm 0 0;}}
table{{border-collapse:collapse;width:100%;}}
.list td{{border-bottom:1px solid #f6d9e6;padding:1.6mm 1.4mm;vertical-align:top;}}
.list thead th{{background:#e85a9c;color:#fff;font-size:8.2pt;padding:1.4mm;text-align:left;font-weight:700;}}
.list tr,.list tbody.g{{break-inside:avoid;page-break-inside:avoid;}}
.list .grp td{{background:#ffe1ee;font-weight:700;color:#d63f86;padding:1.2mm 2mm;font-size:8.8pt;}}
.no{{width:6mm;color:#a58b9a;text-align:center;}}
.th{{width:22mm;}}
.th img{{display:block;max-width:20mm;max-height:17mm;margin:auto;background:#eee6ea;
  background-image:linear-gradient(45deg,#f6f0f3 25%,transparent 25%,transparent 75%,#f6f0f3 75%),
  linear-gradient(45deg,#f6f0f3 25%,transparent 25%,transparent 75%,#f6f0f3 75%);
  background-size:6px 6px;background-position:0 0,3px 3px;}}
code{{font-family:"Noto Sans Mono CJK JP",monospace;font-size:8pt;color:#8a2a5c;word-break:break-all;}}
.desc{{margin-top:.6mm;}}
.note{{color:#b3005e;font-size:8pt;margin-top:.6mm;}}
.used{{width:30mm;font-size:8pt;color:#6a5560;}}
.px{{width:17mm;font-size:8pt;white-space:nowrap;}}
.pr{{width:21mm;font-size:8pt;white-space:nowrap;}}
.src{{display:inline-block;white-space:nowrap;font-size:7.6pt;border-radius:99px;padding:.3mm 2mm;font-weight:700;}}
.src.cli{{background:#e4f0fb;color:#1f5d96;}}
.src.own{{background:#ffe3ef;color:#c02b74;}}
ul{{margin:1mm 0;padding-left:5mm;}} li{{margin:1.2mm 0;}}
.warn{{border:1.5px solid #e85a9c;border-radius:3mm;padding:2.5mm 4mm;margin:2mm 0;}}
.warn b.t{{color:#d63f86;}}
.pal td{{padding:1.1mm 1.6mm;border-bottom:1px solid #f6d9e6;font-size:8.4pt;}}
.pal td:nth-child(-n+3){{white-space:nowrap;}}
.sw{{display:inline-block;width:9mm;height:5mm;border-radius:1.2mm;border:1px solid #e6d6de;vertical-align:middle;}}
.chip{{display:inline-block;margin:0 3mm 1.5mm 0;}} .chip .sw{{width:6mm;margin-right:1mm;}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:5mm;}}
.box{{border:1px solid #f6d9e6;border-radius:3mm;padding:2.5mm 3.5mm;}}
.box h3{{font-size:10pt;margin:0 0 1.5mm;color:#d63f86;}}
.pb{{page-break-before:always;}}
.foot{{margin-top:6mm;color:#6a5560;font-size:8.6pt;border-top:1px solid #f6d9e6;padding-top:2mm;}}
</style></head><body>

<h1><small>えにわ愛ポイント 公式ポータルサイト</small>サイト使用素材一式（フライヤー等の制作用）</h1>
<div class="meta">作成日：2026年9月25日　／　フォルダ名：{esc(os.path.basename(pack_dir))}</div>
<div class="lead">
ポータルサイトで使用している画像を、<b>サイト用に縮小・圧縮する前の元データ（手元にある最大サイズ）</b>でまとめました。<br>
あわせて、サイトの<b>色・書体・デザインのあしらい</b>を3章にまとめています。フライヤーとのテイスト統一にご活用ください。<br>
<span style="color:#6a5560;">提供元の表示：<span class="src cli">ご支給</span>＝先方様からお預かりしたデータ
<span class="src own">制作側で作成</span>＝サイト制作にあたり当方で用意した素材</span>
</div>

<h2>1. 印刷でお使いいただく際のご注意</h2>
<div class="warn"><b class="t">★ 公式キャラクター（02_character）</b><br>
当方の手元にあるのは、LINEでお預かりした画像（425×371px）のみです。印刷では<b>幅3cm程度が上限</b>のため、
フライヤーには<b>キャラクターをデザインされた方がお持ちの元データ（ai・psd等）</b>をご使用ください。<br>
なお、お預かりした画像は印刷用の色形式（CMYK）で、キャラクターのピンクは <b>C0 M65 Y0 K4</b>、文字は <b>K80</b> です。</div>
<ul>
<li><b>公式ロゴ（01_logo）</b>：お預かりしたデータ（3199×447px・350dpi）をそのまま同梱しています。幅23cm程度まで鮮明に印刷できます。
ベクター形式（ai・eps）の元データがある場合は、そちらが最適です。</li>
<li><b>背景・アイコン・枠・スタンプ（03〜06）</b>：同梱のPNGが最大サイズです（ベクター形式の元データはありません）。
350dpi換算で背景・枠は幅11cm程度までが目安です。<b>A4全面など大きく使う場合は、高解像度化や描き起こしで対応</b>できますのでご相談ください。
<br>※「①会員登録」アイコンのみ、拡大しても劣化しないベクター版（.svg）があります。</li>
<li><b>アプリダウンロード用QR（07_qr）</b>：ご支給のQRコードと<b>同じ模様</b>をベクター化したものです（読み取り先 <code>http://onelink.to/rmdmub</code>、iPhone／Android 両対応）。
印刷時は<b>1.5cm角以上</b>、周囲に白い余白を残し、刷り上がりをスマートフォンで読み取って確認してください。<br>
※ポータルサイト（ホームページ）用のQRコードは、本番URLの確定後に別途お作りします。<b>アプリ用QRとお間違えのないよう</b>ご注意ください。</li>
<li><b>ファイターズ（08_fighters）</b>：ご支給原稿から取り出した画像のため小さめです。印刷には先方様お手元の元データをご使用のうえ、掲載範囲は権利元のご許諾に従ってください。</li>
<li><b>色について</b>：画面（RGB）と印刷（CMYK）では発色が異なります。3章のカラーコードはサイト（画面）上の値です。印刷時は色校正でのご確認をおすすめします。</li>
</ul>

<h2 class="pb">2. 同梱素材一覧</h2>
<table class="list"><thead><tr><th>No.</th><th>見本</th><th>ファイル名・内容</th><th>サイトでの使用箇所</th>
<th>画素数(px)</th><th>印刷の目安<br>(350dpi)</th><th>提供元</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table>

<h2 class="pb">3. サイトのテイスト（色・書体・あしらい）</h2>
<div class="two">
<div>
<table class="pal"><tbody>{sw}</tbody></table>
<div style="font-size:8pt;color:#6a5560;margin-top:1.5mm;">
※強調色 #E4007F は、印刷のプロセスマゼンタ（C0 M100 Y0 K0）に近い色です。</div>
</div>
<div>
<div class="box"><h3>公式ロゴの色（ご支給データより）</h3>{logo_sw}
<div style="font-size:8pt;color:#6a5560;">公式キャラクター：C0 M65 Y0 K4（ロゴのピンクと同系色）</div></div>
<div class="box" style="margin-top:3mm;"><h3>書体</h3>
サイトは<b>丸ゴシック体</b>（iPhone・Mac では「ヒラギノ丸ゴ」）で表示しています。見出しは極太、本文は標準の太さです。<br>
フライヤーでも丸ゴシック体を使うと近い雰囲気になります（例：ヒラギノ丸ゴ、無料の「Zen Maru Gothic」「M PLUS Rounded 1c」）。</div>
<div class="box" style="margin-top:3mm;"><h3>あしらい</h3>
<ul style="margin:0;">
<li>白地に<b>淡いピンクの面</b>（#FFEEF5）を重ねる、やさしい配色</li>
<li>カードや枠は<b>角を大きく丸く</b>、ボタンは両端が丸い形</li>
<li>ボタンはピンクのグラデーション（#F06DAA → #E85A9C）</li>
<li>影はピンクがかった淡い影、<b>ハート</b>をモチーフに多用</li>
<li>見出しの左右に短い線やハートを添える</li>
</ul></div>
</div></div>

<div class="box" style="margin-top:4mm;"><h3>サイトで使っている主なコピー</h3>
キャッチコピー：<b>恵庭の「いいね！」が、ここに集まる。</b>　／　タグライン：<b>ポイントは、愛。</b><br>
ポイントの仕組み：<b>100円のお買い物で1ポイント／1ポイント＝1円</b>としてお支払いに使えます</div>

<h2>4. フォルダ構成</h2>
<div class="box" style="font-size:8.6pt;">
<code>00_README.pdf</code>（本書）／<code>01_logo</code> 公式ロゴ5色／<code>02_character</code> 公式キャラクター／<code>03_background</code> 背景／
<code>04_icons</code> アイコン・ハートマーク／<code>05_frame</code> キャンペーン枠／<code>06_stamp</code> スタンプラリー素材／
<code>07_qr</code> アプリ用QR／<code>08_fighters</code> ファイターズ／<code>09_reference</code> 色見本・サイト画面<br>
<span style="color:#6a5560;">※Windowsで展開しても文字化けしないよう、ファイル名は英数字にしています。</span>
</div>

<div class="foot">
・サイトで現在使っていない旧素材（仮のキャラクター等）は含めていません。アイコン一式の元データ（04_icons/icon-sheet_original.png）には、サイト未使用のカテゴリ用アイコンも写っています。<br>
・別のサイズ、背景の透過、色違いなど、追加で必要な素材があればお知らせください。
</div>
</body></html>'''


# ======================================================================== 実行
def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    for d in ['01_logo', '02_character', '03_background', '04_icons', '05_frame',
              '06_stamp', '07_qr', '08_fighters', '09_reference']:
        os.makedirs(os.path.join(OUT, d))
    files = []

    def add(rel, kind, desc, used, source, px=None, note=''):
        p = os.path.join(OUT, rel)
        if px is None and rel.lower().endswith(('.png', '.jpg')):
            px = Image.open(p).size
        files.append(dict(file=rel, kind=kind, desc=desc, used=used, source=source,
                          px=list(px) if px else None, bytes=os.path.getsize(p), note=note))

    # 01 公式ロゴ（ご支給データをそのまま）
    for en, ja in LOGOS:
        # Macからのアップロードのため、ファイル名は濁点・半濁点が分解された形（NFD）で保存されている
        data = git_blob(UP_LOGO, unicodedata.normalize('NFD', f'えにわ愛ポイント{ja}.png'))
        if en == 'pink':
            same_source(data, 'logo-pink.png')
        write(f'01_logo/eniwa-aipoint_logo_{en}.png', data)
        add(f'01_logo/eniwa-aipoint_logo_{en}.png', 'logo',
            f'公式ロゴ（ワードマーク）{ja}',
            '全ページのヘッダー・フッター' if en == 'pink' else '（サイトでは未使用）',
            'ご支給')

    # 02 公式キャラクター
    data = git_blob(UP_CHAR, CHAR)
    write('02_character/official-character_received.jpg', data)
    add('02_character/official-character_received.jpg', 'char',
        '公式キャラクター＋「ポイントは、愛。」（受領データそのまま・CMYK）',
        'トップページのメインビジュアル', 'ご支給',
        note='LINEで受領した画像。印刷には小さいため、デザイナー様の元データ（ai/psd等）をご使用ください')
    char = character_rgb(data)
    char.save(os.path.join(OUT, '02_character/official-character_transparent.png'), optimize=True)
    if '--update-site' in sys.argv:
        char.save(os.path.join(ROOT, 'site/images/character-official.png'), optimize=True)
    # サイト画像と同じ切り抜きになっているか（色は直したので大きさで確認）
    assert char.size == Image.open(os.path.join(ROOT, 'site/images/character-official.png')).size
    add('02_character/official-character_transparent.png', 'char',
        '同上・白背景を透過にしたWeb用（RGB）', 'トップページのメインビジュアル', 'ご支給を加工')

    # 03 背景
    data = git_blob(UP_0627, HERO)
    same_source(data, 'hero-bg.jpg')
    write('03_background/town-background.png', data)
    add('03_background/town-background.png', 'bg', 'まちなみ背景（ピンクの街並み・ハート）',
        'トップページのメインビジュアル背景', '制作側で作成')

    # 04 アイコン
    data = git_blob(UP_0627, ICONS)
    write('04_icons/icon-sheet_original.png', data)
    add('04_icons/icon-sheet_original.png', 'icon',
        'アイコン一式（元データ）：ポイントが貯まる／お店で使える／地域に役立つ／飲食店／お買い物／サービス',
        '「使い方」で上段2点を使用', '制作側で作成',
        note='下段のカテゴリ用3点はサイト未使用（サイトは絵文字で表示）')
    touroku_png(1600).save(os.path.join(OUT, '04_icons/icon_01_touroku.png'), optimize=True)
    add('04_icons/icon_01_touroku.png', 'icon', '使い方①「会員登録」アイコン（大きいサイズで書き出し）',
        '使い方①（トップ・ポイントとは・アプリ登録方法・クーポン）', '制作側で作成')
    write('04_icons/icon_01_touroku.svg', touroku_svg().encode('utf-8'))
    add('04_icons/icon_01_touroku.svg', 'icon', '同上・ベクター版（SVG・拡大しても劣化なし）',
        '同上', '制作側で作成', px=None)
    sheet = Image.open(io.BytesIO(data)).convert('RGBA')
    for name, box in ICON_BOXES:
        site_name = 'step-' + name.split('_')[1] + '.png'
        same_source(data, site_name, crop=box)
        sheet.crop(box).save(os.path.join(OUT, f'04_icons/icon_{name}.png'), optimize=True)
        label = {'tameru': '②「ポイントが貯まる」', 'tsukaeru': '③「お店で使える」'}[name.split('_')[1]]
        add(f'04_icons/icon_{name}.png', 'icon', f'使い方{label}アイコン（元データから切り出し・最大サイズ）',
            '使い方②③（トップ・ポイントとは・アプリ登録方法・クーポン）', '制作側で作成')
    data = git_blob(UP_0627, HEART)
    same_source(data, 'logo-mark.png')
    heart = trim_alpha(Image.open(io.BytesIO(data)), pad=12)
    heart.save(os.path.join(OUT, '04_icons/heart-mark.png'), optimize=True)
    add('04_icons/heart-mark.png', 'icon', 'ハートマーク（元データの余白を詰めたもの・透過PNG）',
        'ブラウザのタブのアイコン・トップページのアプリ欄', '制作側で作成',
        note='公式ロゴではありません')

    # 05 キャンペーン枠
    data = git_blob(UP_0627, FRAME)
    same_source(data, 'campaign.jpg')
    write('05_frame/campaign-frame.png', data)
    add('05_frame/campaign-frame.png', 'frame', 'キャンペーン用の枠（ギフト・リボン・ハート）',
        'トップページの「500ポイント」告知の背景', '制作側で作成')

    # 06 スタンプ
    data = git_blob(UP_0627, STAMP)
    same_source(data, 'stamp-rally.jpg')
    write('06_stamp/stamp-rally-set.png', data)
    add('06_stamp/stamp-rally-set.png', 'stamp', 'スタンプラリー素材（押す前の枠5種・押した後の絵柄5種・使い方イメージ）',
        'トップページ・北海道文教大学連携ページ', '制作側で作成')

    # 07 QR（ご支給のQRと同じ模様をベクター化）
    m = qr_matrix()
    write('07_qr/app-download-qr.svg', qr_svg(m).encode('utf-8'))
    add('07_qr/app-download-qr.svg', 'qr', 'アプリダウンロード用QR（ベクター版・拡大しても劣化なし）',
        'トップ・アプリ登録方法・クーポン', 'ご支給を加工', px=None,
        note='ご支給のQRと同じ模様です。読み取り先：http://onelink.to/rmdmub（iPhone／Android 両対応）')
    qr_png(m, 2000).save(os.path.join(OUT, '07_qr/app-download-qr.png'), optimize=True)
    add('07_qr/app-download-qr.png', 'qr', '同上・画像版（大きいサイズ）', '同上',
        'ご支給を加工', note='読み取り先：http://onelink.to/rmdmub')

    # 08 ファイターズ
    copy_site('fighters.jpg', '08_fighters/fighters-poster.jpg')
    add('08_fighters/fighters-poster.jpg', 'photo', 'ファイターズ2軍本拠地ポスター（サイト掲載版）',
        'トップ・ファイターズページ', 'ご支給',
        note='ご支給原稿から取り出した画像のため小さめです。元データは先方様のお手元のものをご使用ください')

    # 09 参考（色見本。サイトのスクリーンショットは render.js が追加）
    palette_png().save(os.path.join(OUT, '09_reference/color-palette.png'), optimize=True)
    add('09_reference/color-palette.png', 'ref', 'サイトで使っている色の見本（カラーコード付き）', '全ページ', '制作側で作成')

    # サイト画面のスクリーンショットは render.js が撮影する
    for n, label in [('pc', 'パソコン'), ('sp', 'スマートフォン')]:
        files.append(dict(file=f'09_reference/site-top_{n}.jpg', kind='ref',
                          desc=f'トップページの画面（{label}表示・全体）', used='参考',
                          source='制作側で作成', px=None, bytes=0, note=''))

    parent = os.path.dirname(OUT)
    meta = dict(files=files, palette=PALETTE, qr_modules=len(m))
    with open(os.path.join(parent, 'asset-pack-manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    make_thumbs(files, parent)
    with open(os.path.join(parent, 'readme.html'), 'w', encoding='utf-8') as f:
        f.write(readme_html(files, os.path.basename(OUT)))
    for x in files:
        print(f"{x['file']:48} {str(x['px']):14} {x['bytes'] // 1024:6} KB  {x['source']}")


if __name__ == '__main__':
    main()
