#!/usr/bin/env python3
"""ドヤくんの新しいポーズの絵を取り込む（緑の背景を透明にし、512px と 256px の webp にして public/character に置く）。

使い方: python3 scripts/kun-import-pose.py <緑の背景の png> <ポーズの名前>
  例: python3 scripts/kun-import-pose.py out/mic-g.png mic

- 絵は Codex の内蔵の画像生成（定額）で、背景を単色の緑にして作る（docs/design/KUN-NEW-POSES-CODEX-PROMPT-2026-10-29.md）。
- 緑の背景だけを消す。絵の中の水色（青の成分が強い色）は残す。縁のにじみの緑も落とす。
- 余白を約4%そろえた正方形にして、public/character/<名前>-512.webp と <名前>-256.webp に書く。
- 有料の API は使わない。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
NAME_OK = set('abcdefghijklmnopqrstuvwxyz-')


def cut_out(src: Path) -> Image.Image:
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 純粋な緑（G が R・B よりはっきり大きく、B と R が弱い）だけを背景にする
    pure = ((g - np.maximum(r, b)) > 60) & (b < 150) & (r < 170)
    # 背景に接する縁のにじみ（アンチエイリアスの薄い緑）も落とす
    fringe = ndi.binary_dilation(pure, iterations=2) & ((g - np.maximum(r, b)) > 18)
    bg = pure | fringe
    alpha = ndi.median_filter(np.where(bg, 0, 255).astype(np.uint8), size=3)
    out = np.asarray(im).copy()
    edge = ndi.binary_dilation(alpha == 0, iterations=3) & (alpha > 0)
    gg = out[..., 1].astype(int)
    lim = np.maximum(out[..., 0], out[..., 2]).astype(int)
    out[..., 1] = np.where(edge & (gg > lim), lim, out[..., 1]).astype(np.uint8)
    return Image.fromarray(np.dstack([out, alpha]).astype(np.uint8))


def square(res: Image.Image, pad: float = 1.08) -> Image.Image:
    bb = res.getbbox()
    if not bb:
        raise SystemExit('絵が見つかりません（全部が透明になりました）')
    l, t, r, b = bb
    w, h = r - l, b - t
    s = int(max(w, h) * pad)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(res.crop(bb), ((s - w) // 2, (s - h) // 2))
    return canvas


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, name = Path(sys.argv[1]), sys.argv[2]
    if not name or set(name) - NAME_OK:
        raise SystemExit('ポーズの名前は、英小文字と - だけにしてください')
    img = square(cut_out(src))
    dest = ROOT / 'public' / 'character'
    for size in (512, 256):
        out = dest / f'{name}-{size}.webp'
        img.resize((size, size), Image.LANCZOS).save(out, 'WEBP', quality=88, method=6)
        print('wrote', out.relative_to(ROOT), out.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
