#!/usr/bin/env python3
"""ドヤバディのロゴ案（文字入り）を作る。文字は書体の字形を SVG のパス（ベクター）にして置くので、書体が無くても同じ形で開ける。

使い方: FONT_DIR=<書体のフォルダ> python3 scripts/brand/build-logos.py [出力フォルダ]
  書体（すべて SIL Open Font License 1.1 = 商用で使える。github.com/google/fonts の ofl/ から取得）:
    zen-maru-black.ttf / zen-maru-bold.ttf  = Zen Maru Gothic（Black・Bold）
    dela.ttf                                 = Dela Gothic One
    mplus-rounded-black.ttf                  = M PLUS Rounded 1c（Black）
- 出力: <フォルダ>/<案>/<名前>.svg（案 = a・b・c。名前 = jp-horizontal・jp-vertical・jp-white・en-horizontal・en-vertical・en-white）
- クマのマークは、いまの public/brand/doya-logo-mark-256.png を、そのまま埋め込む（ラスターの絵）。文字だけがベクター。
- PNG への書き出しは scripts/brand/render-logos.cjs（@resvg/resvg-js）。
有料の API は使わない。
"""
import base64
import os
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent.parent
FONT_DIR = Path(os.environ.get('FONT_DIR', '.'))
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/design/brand/doya-buddy-logo-proposals'
MARK = base64.b64encode((ROOT / 'public/brand/doya-logo-mark-256.png').read_bytes()).decode()

def brand_names():
    """サービス名の正本（src/lib/brand/index.ts の BRAND_NAME_NEW・BRAND_EN_NEW）から、ロゴの文字を読む。名前が変わっても、この読み方は変えなくてよい"""
    import re as _re
    src = (ROOT / 'src/lib/brand/index.ts').read_text(encoding='utf-8')
    jp = _re.search(r"BRAND_NAME_NEW = '([^']+)'", src).group(1)
    en = _re.search(r"BRAND_EN_NEW = '([^']+)'", src).group(1)
    en1, en2 = en.split(' ', 1)
    return jp, (jp[:2], jp[2:]), en, (en1, en2)


JP_FULL, (JP1, JP2), EN_FULL, (EN1, EN2) = brand_names()
NAVY, BLUE, SKY = '#101633', '#0066ff', '#00d4ff'
WHITE, LIGHT = '#ffffff', '#8fb8ff'

_fonts: dict[str, TTFont] = {}


def font(name: str) -> TTFont:
    if name not in _fonts:
        _fonts[name] = TTFont(str(FONT_DIR / name))
    return _fonts[name]


def text_path(fname: str, text: str, size: float, x: float, base: float, tracking: float = 0.0):
    """文字列を SVG のパス（d）にする。戻り値 = (d, 幅)。tracking は字間（em 単位）"""
    f = font(fname)
    cmap = f.getBestCmap()
    gs = f.getGlyphSet()
    upm = f['head'].unitsPerEm
    sc = size / upm
    d_parts = []
    cur = x
    for ch in text:
        gn = cmap.get(ord(ch))
        if gn is None:
            raise SystemExit(f'{fname} に {ch!r} の字形が無い')
        pen = SVGPathPen(gs)
        gs[gn].draw(TransformPen(pen, (sc, 0, 0, -sc, cur, base)))
        d_parts.append(pen.getCommands())
        cur += f['hmtx'][gn][0] * sc + tracking * size
    return ' '.join(p for p in d_parts if p), cur - x - tracking * size


def spark(cx: float, cy: float, r: float, color: str) -> str:
    """4つの先のきらめき"""
    k = r * 0.28
    return (f'<path d="M{cx},{cy-r} Q{cx+k},{cy-k} {cx+r},{cy} Q{cx+k},{cy+k} {cx},{cy+r} Q{cx-k},{cy+k} {cx-r},{cy} Q{cx-k},{cy-k} {cx},{cy-r}Z" fill="{color}"/>')


def mark(x: float, y: float, s: float) -> str:
    return f'<image x="{x}" y="{y}" width="{s}" height="{s}" href="data:image/png;base64,{MARK}"/>'


def svg(w: float, h: float, body: str, title: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>')


# 案ごとの設定: 書体・色・飾り
PROPOSALS = {
    'a': dict(name='ふっくら丸ゴ', jp='zen-maru-black.ttf', en='zen-maru-bold.ttf', jp_track=0.02, en_track=0.2,
              c1=NAVY, c2=BLUE, sub=NAVY, deco='none'),
    'b': dict(name='どっしり太字', jp='dela.ttf', en='dela.ttf', jp_track=0.0, en_track=0.14,
              c1=NAVY, c2=NAVY, sub=BLUE, deco='underline'),
    'c': dict(name='やさしい角丸', jp='mplus-rounded-black.ttf', en='mplus-rounded-black.ttf', jp_track=0.02, en_track=0.16,
              c1=BLUE, c2=NAVY, sub=BLUE, deco='spark'),
}


def build(key: str, p: dict, lang: str, layout: str, white: bool) -> str:
    c1 = WHITE if white else p['c1']
    c2 = LIGHT if white else p['c2']
    sub = LIGHT if white else p['sub']
    deco_c = LIGHT if white else (BLUE if p['deco'] == 'underline' else SKY)
    M = 150  # マークの大きさ
    PAD = 24
    parts = []
    if lang == 'jp':
        big1, big2 = (JP1, JP2)
        S = 104
        d1, w1 = text_path(p['jp'], big1, S, 0, 0, p['jp_track'])
        d2, w2 = text_path(p['jp'], big2, S, 0, 0, p['jp_track'])
        gap = S * 0.04
        main_w = w1 + gap + w2
        en_size = 30
        d3, w3 = text_path(p['en'], EN_FULL, en_size, 0, 0, p['en_track'])
        block_w = max(main_w, w3)
        asc = S * 0.86
        if layout == 'horizontal':
            tx = PAD + M + 28
            ty = PAD + 8 + asc  # 日本語の基線
            parts.append(mark(PAD, PAD, M))
            parts.append(f'<path transform="translate({tx},{ty})" d="{d1}" fill="{c1}"/>')
            parts.append(f'<path transform="translate({tx + w1 + gap},{ty})" d="{d2}" fill="{c2}"/>')
            ey = ty + en_size + 20
            parts.append(f'<path transform="translate({tx + 4},{ey})" d="{d3}" fill="{sub}"/>')
            if p['deco'] == 'underline':
                parts.append(f'<rect x="{tx + w1 + gap}" y="{ty + 12}" width="{w2}" height="9" rx="4.5" fill="{deco_c}"/>')
                # 下線の分だけ英字を下げる
                parts[-2] = f'<path transform="translate({tx + 4},{ey + 16})" d="{d3}" fill="{sub}"/>'
            if p['deco'] == 'spark':
                parts.append(spark(tx + main_w + 22, ty - asc + 6, 18, deco_c))
            W = tx + block_w + PAD + (44 if p['deco'] == 'spark' else 0)
            H = PAD * 2 + M
            if p['deco'] == 'underline':
                H += 14
        else:
            cx_total = max(block_w, M) + PAD * 2 + (56 if p['deco'] == 'spark' else 0)
            W = cx_total
            mx = (W - M) / 2
            parts.append(mark(mx, PAD, M))
            ty = PAD + M + 24 + asc
            tx = (W - main_w) / 2
            parts.append(f'<path transform="translate({tx},{ty})" d="{d1}" fill="{c1}"/>')
            parts.append(f'<path transform="translate({tx + w1 + gap},{ty})" d="{d2}" fill="{c2}"/>')
            ey = ty + en_size + 20
            if p['deco'] == 'underline':
                parts.append(f'<rect x="{tx + w1 + gap}" y="{ty + 12}" width="{w2}" height="9" rx="4.5" fill="{deco_c}"/>')
                ey += 16
            parts.append(f'<path transform="translate({(W - w3) / 2},{ey})" d="{d3}" fill="{sub}"/>')
            if p['deco'] == 'spark':
                parts.append(spark(tx + main_w + 20, ty - asc + 6, 18, deco_c))
            H = ey + PAD + 8
    else:
        S = 76
        d1, w1 = text_path(p['en'], EN1, S, 0, 0, p['en_track'])
        d2, w2 = text_path(p['en'], EN2, S, 0, 0, p['en_track'])
        gap = S * 0.30
        main_w = w1 + gap + w2
        asc = S * 0.76
        if layout == 'horizontal':
            tx = PAD + M + 28
            ty = PAD + M / 2 + asc / 2
            parts.append(mark(PAD, PAD, M))
            parts.append(f'<path transform="translate({tx},{ty})" d="{d1}" fill="{c1}"/>')
            parts.append(f'<path transform="translate({tx + w1 + gap},{ty})" d="{d2}" fill="{c2}"/>')
            if p['deco'] == 'underline':
                parts.append(f'<rect x="{tx + w1 + gap}" y="{ty + 16}" width="{w2}" height="9" rx="4.5" fill="{deco_c}"/>')
            if p['deco'] == 'spark':
                parts.append(spark(tx + main_w + 22, ty - asc + 4, 16, deco_c))
            W = tx + main_w + PAD + (44 if p['deco'] == 'spark' else 0)
            H = PAD * 2 + M
        else:
            W = max(main_w, M) + PAD * 2 + (48 if p['deco'] == 'spark' else 0)
            mx = (W - M) / 2
            parts.append(mark(mx, PAD, M))
            ty = PAD + M + 22 + asc
            tx = (W - main_w) / 2
            parts.append(f'<path transform="translate({tx},{ty})" d="{d1}" fill="{c1}"/>')
            parts.append(f'<path transform="translate({tx + w1 + gap},{ty})" d="{d2}" fill="{c2}"/>')
            if p['deco'] == 'underline':
                parts.append(f'<rect x="{tx + w1 + gap}" y="{ty + 16}" width="{w2}" height="9" rx="4.5" fill="{deco_c}"/>')
            if p['deco'] == 'spark':
                parts.append(spark(tx + main_w + 18, ty - asc + 4, 16, deco_c))
            H = ty + 26 + PAD
    title = JP_FULL if lang == 'jp' else EN_FULL
    return svg(W, H, ''.join(parts), title)


def main() -> None:
    for key, p in PROPOSALS.items():
        for lang in ('jp', 'en'):
            for layout in ('horizontal', 'vertical'):
                out = OUT / key
                out.mkdir(parents=True, exist_ok=True)
                (out / f'{lang}-{layout}.svg').write_text(build(key, p, lang, layout, False), encoding='utf-8')
            (OUT / key / f'{lang}-white.svg').write_text(build(key, p, lang, 'horizontal', True), encoding='utf-8')
        print(key, p['name'])


if __name__ == '__main__':
    main()
