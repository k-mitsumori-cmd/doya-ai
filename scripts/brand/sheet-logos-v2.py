#!/usr/bin/env python3
"""ロゴ案（v2）を1枚に並べる確認用の画像を作る。使い方: python3 scripts/brand/sheet-logos-v2.py <案のフォルダ> <出力 png>
各案の行: 白い背景（大）・暗い背景（大）・白黒（中）・小（高さ32px、白と暗）。PNG は render-logos.cjs で先に書き出しておく。"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
rows = sorted(p for p in src.iterdir() if p.is_dir())
desc = {l.split('\t')[0]: l.split('\t')[1:] for l in (src / 'descriptions.txt').read_text(encoding='utf-8').splitlines()}
NAVY = (16, 22, 51)
font = lambda s: ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', s)
fontn = lambda s: ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc', s)
CW, CH, GAP, LABEL = 520, 190, 12, 96
W = 40 + CW * 2 + 300 + 220 + GAP * 5
H = 30 + (CH + LABEL + 30) * len(rows)
sheet = Image.new('RGB', (W, H), (245, 247, 252))
d = ImageDraw.Draw(sheet)


def fit(im, w, h):
    im = im.copy()
    im.thumbnail((w, h), Image.LANCZOS)
    return im


def put(im, box, bg):
    x, y, w, h = box
    d.rectangle([x, y, x + w, y + h], fill=bg, outline=(215, 222, 238))
    f = fit(im, w - 24, h - 24)
    sheet.paste(f, (x + (w - f.width) // 2, y + (h - f.height) // 2), f)


y = 20
for r in rows:
    k = r.name
    light, dark, mono = (Image.open(r / f'{n}.png').convert('RGBA') for n in ('light', 'dark', 'mono'))
    d.text((20, y), f'{k.upper()}  {desc[k][0]}', font=font(20), fill=NAVY)
    d.text((20, y + 30), desc[k][1], font=fontn(15), fill=(70, 80, 110))
    y += LABEL - 20
    x = 20
    put(light, (x, y, CW, CH), (255, 255, 255)); x += CW + GAP
    put(dark, (x, y, CW, CH), NAVY); x += CW + GAP
    put(mono, (x, y, 300, CH), (255, 255, 255)); x += 300 + GAP
    # 小: 高さ 32px の見え方（白・暗）
    for im, bg in ((light, (255, 255, 255)), (dark, NAVY)):
        s = im.resize((max(1, round(im.width * 32 / im.height)), 32), Image.LANCZOS)
        cell = Image.new('RGB', (220, 74), bg)
        cell.paste(s, ((220 - s.width) // 2, 21), s)
        sheet.paste(cell, (x, y + (0 if bg == (255, 255, 255) else 84)))
        d.rectangle([x, y + (0 if bg == (255, 255, 255) else 84), x + 220, y + (74 if bg == (255, 255, 255) else 158)], outline=(215, 222, 238))
    y += CH + 60
sheet = sheet.crop((0, 0, W, y))
sheet.save(out)
print(out, sheet.size)
