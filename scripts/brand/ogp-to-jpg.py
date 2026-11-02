#!/usr/bin/env python3
"""OGP の PNG（render-logos.cjs の native で書き出したもの）のうち、ツールごとの画像を JPG にする。portal.png はそのまま。
使い方: python3 scripts/brand/ogp-to-jpg.py <assets フォルダ>。ツールごとの PNG は JPG にしたあと消す（生成物のみ。SVG は残す）。"""
import sys
from pathlib import Path
from PIL import Image

ogp = Path(sys.argv[1]) / 'ogp'
n = 0
for p in sorted(ogp.glob('*.png')):
    if p.stem == 'portal':
        continue
    Image.open(p).convert('RGB').save(ogp / f'{p.stem}.jpg', quality=88, optimize=True)
    p.unlink()
    n += 1
print('jpg', n)
