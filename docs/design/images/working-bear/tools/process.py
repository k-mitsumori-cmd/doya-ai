# 使い方: python3 process.py <出力フォルダ> <paint_a.png> <paint_b.png> <paint_done.png>
# マゼンタの背景を透過にし、3枚に同じ切り出しの枠をかけて（入れ替えても絵が跳ねない）、512×512 の WebP（public/character の他のポーズと同じ名前の付け方: <名前>-512.webp） にする。
import sys, os
import numpy as np
from PIL import Image
out, *srcs = sys.argv[1:]
names = ['paint-a', 'paint-b', 'paint-done']

def key(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = np.clip(((np.minimum(r, b) - g) - 60) / 120, 0, 1)
    alpha = 1 - mag
    spill = (np.minimum(r, b) > g + 30)
    m = np.minimum(r, b)
    a2 = a.copy()
    a2[..., 0] = np.where(spill, g + (r - m), r)
    a2[..., 2] = np.where(spill, g + (b - m), b)
    rgba = np.dstack([np.clip(a2, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

imgs = [key(s) for s in srcs]
boxes = [im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for im in imgs]
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
w, h = x1 - x0, y1 - y0
side = int(max(w, h) * 1.04)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
os.makedirs(out, exist_ok=True)
for n, im in zip(names, imgs):
    c = im.crop(box).resize((512, 512), Image.LANCZOS)
    c.save(os.path.join(out, n + '-512.webp'), 'WEBP', quality=90, method=6)
    # マゼンタの残りの点を数える（0 であること）
    arr = np.asarray(c).astype(int)
    vis = arr[..., 3] > 200
    left = int(((np.minimum(arr[..., 0], arr[..., 2]) - arr[..., 1]) > 90)[vis].sum())
    print(n, os.path.getsize(os.path.join(out, n + '-512.webp')) // 1024, 'KB', 'マゼンタの残り', left)
