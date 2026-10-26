# 使い方: python3 process.py <raw.png> <out.webp> [大きさ(既定128)]
import sys
import numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
# マゼンタの度合い: R と B が高く G が低い
mag = np.clip(((np.minimum(r, b) - g) - 60) / 120, 0, 1)
alpha = 1 - mag
# 縁のマゼンタのにじみを消す（G に寄せる）
spill = (np.minimum(r, b) > g + 30)
a2 = a.copy()
m = np.minimum(r, b)
a2[..., 0] = np.where(spill, np.minimum(r, g + (r - m) + 0), r)
a2[..., 2] = np.where(spill, np.minimum(b, g + (b - m) + 0), b)
# にじみのある画素は、R・B を G と同じ程度に下げる
a2[..., 0] = np.where(spill, g + (r - m), a2[..., 0])
a2[..., 2] = np.where(spill, g + (b - m), a2[..., 2])
rgba = np.dstack([np.clip(a2, 0, 255), alpha * 255]).astype(np.uint8)
img = Image.fromarray(rgba, 'RGBA')
# 小さなごみを消す
al = img.getchannel('A').point(lambda v: 255 if v > 40 else 0)
bbox = al.getbbox()
img = img.crop(bbox)
w, h = img.size
k = 400 / max(w, h)
img = img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
w, h = img.size
side = max(w, h)
# 白い縁取り（ステッカー型）。縁の太さは絵の大きさの 2.6%
border = max(6, int(side * 0.026))
pad = border + int(side * 0.03)
S = side + pad * 2
canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
canvas.paste(img, ((S - w) // 2, (S - h) // 2), img)
A = canvas.getchannel('A').point(lambda v: 255 if v > 100 else 0)
dil = A.filter(ImageFilter.MaxFilter(border * 2 + 1 if border * 2 + 1 <= 25 else 25)).filter(ImageFilter.GaussianBlur(1.2))
white = Image.new('RGBA', (S, S), (255, 255, 255, 0))
white.putalpha(dil)
final = Image.alpha_composite(white, canvas)
# 縁取りの外側に、ごく薄い紺の線（明るい背景で白い縁が消えないように）
ring = dil.filter(ImageFilter.MaxFilter(5))
navy = Image.new('RGBA', (S, S), (26, 43, 95, 0))
navy.putalpha(ring.point(lambda v: int(v * 0.35)))
final = Image.alpha_composite(navy, final)
size = int(sys.argv[3]) if len(sys.argv) > 3 else 128
final = final.resize((size, size), Image.LANCZOS)
final.save(out, 'WEBP', quality=90, method=6)
# 残ったマゼンタの数
f = np.asarray(final).astype(int)
left = ((f[..., 3] > 30) & (f[..., 0] > 180) & (f[..., 2] > 180) & (f[..., 1] < 90)).sum()
print(out, 'magenta_left=', left)
