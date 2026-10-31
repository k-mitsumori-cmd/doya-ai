#!/usr/bin/env python3
"""ドヤバディのロゴ案・第2弾（ゼロベース）。青い角丸の四角のクマのマーク（doya-logo-mark）は使わない。

使い方: FONT_DIR=<書体のフォルダ> python3 scripts/brand/build-logos-v2.py [出力フォルダ]
- 出力: <フォルダ>/<案>/<light|dark|mono>.svg（案 = d1〜d6）。light = 白い背景用、dark = 暗い背景用、mono = 白黒（1色）。
- 文字は書体の字形をパス（ベクター）にして置く。書体は SIL Open Font License 1.1（商用で使える）。
  Dela Gothic One・Zen Maru Gothic（Black）・M PLUS Rounded 1c（Black）。
- クマ・名札・吹き出しなどの絵は、すべてこのファイルの中で SVG の図形として描く（ラスターの絵を埋め込まない）。
- PNG への書き出しは scripts/brand/render-logos.cjs（フォルダを渡す）。有料の API は使わない。
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib.util

_spec = importlib.util.spec_from_file_location('build_logos', Path(__file__).resolve().parent / 'build-logos.py')
bl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bl)

ROOT = bl.ROOT
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/design/brand/doya-buddy-logo-proposals-v2'
JP, EN = bl.JP_FULL, bl.EN_FULL
JP1, JP2 = bl.JP1, bl.JP2
NAVY, BLUE = bl.NAVY, bl.BLUE

PAL = {
    'light': dict(ink=NAVY, accent=BLUE, paper='#ffffff', eye=NAVY, nose=NAVY, muz='#ffffff', head=BLUE),
    'dark': dict(ink='#ffffff', accent='#4d94ff', paper=NAVY, eye=NAVY, nose=NAVY, muz='#ffffff', head='#4d94ff'),
    'mono': dict(ink='#000000', accent='#000000', paper='#ffffff', eye='#ffffff', nose='#000000', muz='#ffffff', head='#000000'),
}


def tp(fname, text, size, x, base, track=0.0, fill='#000', extra=''):
    d, w = bl.text_path(fname, text, size, x, base, track)
    return f'<path d="{d}" fill="{fill}" {extra}/>', w


def bear_head(cx, cy, r, p, smug=True):
    """クマの顔（円と円だけ）。ドヤ顔 = 目が半分閉じ、片方の口角が上がる"""
    er = r * 0.36
    s = []
    for sx in (-1, 1):
        s.append(f'<circle cx="{cx + sx * r * 0.74:.1f}" cy="{cy - r * 0.74:.1f}" r="{er:.1f}" fill="{p["head"]}"/>')
        s.append(f'<circle cx="{cx + sx * r * 0.74:.1f}" cy="{cy - r * 0.74:.1f}" r="{er * 0.5:.1f}" fill="{p["muz"]}" opacity="0.9"/>')
    s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{p["head"]}"/>')
    s.append(f'<ellipse cx="{cx}" cy="{cy + r * 0.34:.1f}" rx="{r * 0.46:.1f}" ry="{r * 0.36:.1f}" fill="{p["muz"]}"/>')
    s.append(f'<ellipse cx="{cx}" cy="{cy + r * 0.2:.1f}" rx="{r * 0.13:.1f}" ry="{r * 0.09:.1f}" fill="{p["nose"]}"/>')
    # 目: 半月（上のまぶたが下がっている）
    for sx in (-1, 1):
        ex, ey, rr = cx + sx * r * 0.42, cy - r * 0.12, r * 0.17
        s.append(f'<path d="M{ex - rr:.1f},{ey:.1f} A{rr:.1f},{rr:.1f} 0 0 0 {ex + rr:.1f},{ey:.1f}Z" fill="{p["eye"]}"/>')
        s.append(f'<path d="M{ex - rr * 1.3:.1f},{ey - rr * (0.5 if sx < 0 else 0.9):.1f} L{ex + rr * 1.3:.1f},{ey - rr * (0.9 if sx < 0 else 0.5):.1f}" stroke="{p["eye"]}" stroke-width="{r * 0.075:.1f}" stroke-linecap="round" fill="none"/>')
    # 口: 右の口角が上がるにやり
    m = r * 0.5
    s.append(f'<path d="M{cx - r * 0.2:.1f},{cy + r * 0.52:.1f} Q{cx + r * 0.05:.1f},{cy + r * 0.66:.1f} {cx + r * 0.3:.1f},{cy + r * 0.46:.1f}" stroke="{p["nose"]}" stroke-width="{r * 0.06:.1f}" stroke-linecap="round" fill="none"/>')
    return ''.join(s)


def sub(p, x, base, size=26, color=None, track=0.3, font='zen-maru-bold.ttf'):
    return tp(font, EN, size, x, base, track, color or p['accent'])


def d1(p):
    """文字だけ: ドヤ顔の勢いで少し傾けた字。「ドヤ」と「バディ」の間に点"""
    f = 'dela.ttf'
    a, wa = tp(f, JP1, 128, 40, 150, 0.0, p['accent'])
    dot = f'<circle cx="{40 + wa + 22:.1f}" cy="108" r="9" fill="{p["ink"]}"/>'
    b, wb = tp(f, JP2, 128, 40 + wa + 44, 150, 0.0, p['ink'])
    x_end = 40 + wa + 44 + wb
    rays = ''.join(f'<path d="M{x_end + 14 + i * 4:.1f},{40 + i * 22} l22,-{10 - i * 2}" stroke="{p["accent"]}" stroke-width="7" stroke-linecap="round"/>' for i in range(3))
    s, _ = sub(p, 44, 196, 24, p['ink'], 0.42, f)
    return 800, 220, f'<g transform="skewX(-7) translate(24,0)">{a}{dot}{b}</g>{rays}{s}'


def d2(p):
    """名札（社員証）の中に名前。首かけ紐つき"""
    t1, w1 = tp('zen-maru-black.ttf', JP1, 98, 0, 150, 0.02, p['accent'])
    t2, w2 = tp('zen-maru-black.ttf', JP2, 98, 0, 150, 0.02, p['ink'])
    W = w1 + w2
    x0 = (720 - W) / 2
    a, _ = tp('zen-maru-black.ttf', JP1, 98, x0, 172, 0.02, p['accent'])
    b, _ = tp('zen-maru-black.ttf', JP2, 98, x0 + w1 + 0.02 * 98, 172, 0.02, p['ink'])
    s, ws = sub(p, 0, 218, 24, p['accent'], 0.4)
    s, _ = sub(p, (720 - ws) / 2, 218, 24, p['accent'], 0.4)
    card = f'<rect x="60" y="44" width="600" height="200" rx="26" fill="none" stroke="{p["ink"]}" stroke-width="7"/>'
    slot = f'<rect x="318" y="60" width="84" height="12" rx="6" fill="{p["ink"]}"/>'
    lan = f'<path d="M318,44 L292,0 M402,44 L428,0" stroke="{p["accent"]}" stroke-width="7" stroke-linecap="round"/>'
    return 720, 260, f'{lan}{card}{slot}{a}{b}{s}'


def d3(p):
    """吹き出しとチェック: 頼んだら「了解」"""
    bub = (f'<path d="M80,30 H190 Q230,30 230,70 V120 Q230,160 190,160 H112 L72,196 L80,160 Q40,158 40,118 V70 Q40,30 80,30Z" fill="{p["accent"]}"/>')
    chk = f'<path d="M84,100 L122,134 L190,64" stroke="{"#ffffff" if p is not PAL["mono"] else "#ffffff"}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    a, wa = tp('zen-maru-black.ttf', JP1, 112, 262, 126, 0.02, p['accent'])
    b, wb = tp('zen-maru-black.ttf', JP2, 112, 262 + wa + 2, 126, 0.02, p['ink'])
    s, _ = sub(p, 266, 176, 26, p['ink'], 0.42)
    return 860, 216, f'{bub}{chk}{a}{b}{s}'


def d4(p):
    """敬礼するクマの顔（四角に入れない）"""
    cx, cy, r = 112, 118, 76
    head = bear_head(cx, cy, r, p)
    # 敬礼の手: おでこから右上へ
    hand = (f'<g transform="rotate(-24 {cx + r * 0.2:.1f} {cy - r * 0.9:.1f})">'
            f'<rect x="{cx + r * 0.1:.1f}" y="{cy - r * 1.18:.1f}" width="{r * 1.15:.1f}" height="{r * 0.34:.1f}" rx="{r * 0.17:.1f}" fill="{p["ink"]}"/>'
            f'<rect x="{cx + r * 1.0:.1f}" y="{cy - r * 1.24:.1f}" width="{r * 0.3:.1f}" height="{r * 0.46:.1f}" rx="{r * 0.08:.1f}" fill="{p["accent"]}"/></g>')
    a, wa = tp('mplus-rounded-black.ttf', JP1, 112, 236, 144, 0.02, p['accent'])
    b, wb = tp('mplus-rounded-black.ttf', JP2, 112, 236 + wa + 2, 144, 0.02, p['ink'])
    s, _ = sub(p, 240, 192, 26, p['ink'], 0.42, 'mplus-rounded-black.ttf')
    return 840, 216, f'{head}{hand}{a}{b}{s}'


def d5(p):
    """円の中のクマとネクタイ。たてに積む"""
    cx, cy = 290, 112
    clip = f'<clipPath id="c5"><circle cx="{cx}" cy="{cy}" r="84"/></clipPath>'
    ring = f'<circle cx="{cx}" cy="{cy}" r="90" fill="none" stroke="{p["ink"]}" stroke-width="8"/>'
    head = bear_head(cx, cy - 6, 56, p)
    tie = (f'<g clip-path="url(#c5)"><path d="M{cx - 14},{cy + 54} L{cx + 14},{cy + 54} L{cx + 20},{cy + 78} L{cx},{cy + 112} L{cx - 20},{cy + 78}Z" fill="{p["ink"]}"/>'
           f'<path d="M{cx - 20},{cy + 46} L{cx + 20},{cy + 46} L{cx + 12},{cy + 60} L{cx - 12},{cy + 60}Z" fill="{p["accent"]}"/></g>')
    a, wa = tp('zen-maru-black.ttf', JP1, 96, 0, 0, 0.02, p['accent'])
    b, wb = tp('zen-maru-black.ttf', JP2, 96, 0, 0, 0.02, p['ink'])
    W = wa + wb + 0.02 * 96
    x0 = (580 - W) / 2
    a, _ = tp('zen-maru-black.ttf', JP1, 96, x0, 306, 0.02, p['accent'])
    b, _ = tp('zen-maru-black.ttf', JP2, 96, x0 + wa + 2, 306, 0.02, p['ink'])
    s, ws = sub(p, 0, 348, 24, p['accent'], 0.4)
    s, _ = sub(p, (580 - ws) / 2, 348, 24, p['accent'], 0.4)
    return 580, 372, f'{clip}{ring}{head}{tie}{a}{b}{s}'


def d6(p):
    """文字と一体: 「バ」のうえからクマがのぞく"""
    f = 'zen-maru-black.ttf'
    size = 150
    a, wa = tp(f, JP1, size, 40, 232, 0.0, p['accent'])
    b, wb = tp(f, JP2, size, 40 + wa, 232, 0.0, p['ink'])
    bx = 40 + wa + size * 0.5
    head = bear_head(bx, 70, 44, p)
    paws = ''.join(f'<ellipse cx="{bx + sx * 40:.1f}" cy="116" rx="17" ry="12" fill="{p["head"]}"/>' for sx in (-1, 1))
    s, _ = sub(p, 46, 276, 24, p['ink'], 0.42)
    return 840, 300, f'{a}{b}{paws}{head}{s}'


DESIGNS = {
    'd1': (d1, '文字だけ（ドヤ顔の傾き）', '「ドヤ」と「バディ」の字を少し傾けて、ドヤ顔の勢いを出す。間の点は、頼んだ仕事に「了解」と答える間。'),
    'd2': (d2, '文字だけ（名札）', '社員証の形の枠に名前を入れる。いっしょに働く「バディ」という立ち位置を示す。'),
    'd3': (d3, 'シンボル（吹き出しとチェック）', '頼むと「了解」と返ってくることを、吹き出しとチェックで表す。四角を使わない。'),
    'd4': (d4, 'シンボル（敬礼するクマ）', 'ドヤくんの顔と敬礼で、「任せてください」を表す。顔だけを切り抜き、四角に入れない。'),
    'd5': (d5, 'シンボル（円・クマとネクタイ）', 'ネクタイを締めたクマを円で囲む。スタンプやアイコンとして小さくも使える、たて積みの形。'),
    'd6': (d6, '文字と一体（のぞくクマ）', '「バ」の字のうえからドヤくんがのぞく。文字の一部として、キャラクターが居場所を持つ。'),
}


def main():
    for key, (fn, name, desc) in DESIGNS.items():
        d = OUT / key
        d.mkdir(parents=True, exist_ok=True)
        for pk, p in PAL.items():
            w, h, body = fn(p)
            bg = ''
            (d / f'{pk}.svg').write_text(bl.svg(w, h, bg + body, f'{JP}（{EN}）ロゴ {key}'), encoding='utf-8')
    (OUT / 'descriptions.txt').write_text('\n'.join(f'{k}\t{v[1]}\t{v[2]}' for k, v in DESIGNS.items()), encoding='utf-8')
    print('wrote', len(DESIGNS) * len(PAL), 'svg ->', OUT)


if __name__ == '__main__':
    main()
