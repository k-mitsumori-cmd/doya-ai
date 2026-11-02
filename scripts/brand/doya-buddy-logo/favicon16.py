# 16px のファビコンを1マスずつ描く（縮小では目が溶けて、ドヤ顔に見えないため）。使い方: python3 favicon16.py
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
COL = {"N": (16, 27, 62), "W": (255, 255, 255), "B": (0, 102, 255), "K": (16, 27, 62), "L": (142, 187, 255)}
GRID = [  # N=紺の輪郭 W=白 B=ゴーグルの青 K=レンズ L=目（斜めの眉と瞳）
    ".NNN........NNN.",
    "NKKWN......NWKKN",
    "NKWWNNNNNNNNWWKN",
    ".NWWWWWWWWWWWWN.",
    "NBBBBBBBBBBBBBBN",
    "NBKLLKKKKKKLLKBN",
    "NBKKKLLKKLLKKKBN",
    "NBKKKLKKKKLKKKBN",
    "NBBBBBBWWBBBBBBN",
    ".NWWWWWNNWWWWWN.",
    ".NWWWWWWNWWNWWN.",
    ".NWWWWNNWNNWWWN.",
    "..NWWWWWWWWWWN..",
    "...NNNNNNNNNN...",
    "................",
    "................",
]
def write_ico(path, images):
    """16px と 32px を、それぞれの絵のまま1つの ico に入れる（PNG を中に入れる形式）。"""
    import io, struct
    blobs = []
    for im in images:
        b = io.BytesIO(); im.convert("RGBA").save(b, "PNG"); blobs.append((im.size[0], b.getvalue()))
    head = struct.pack("<HHH", 0, 1, len(blobs)); off = 6 + 16 * len(blobs); ent = b""
    for w, data in blobs:
        ent += struct.pack("<BBBBHHII", w % 256, w % 256, 0, 0, 1, 32, len(data), off); off += len(data)
    open(path, "wb").write(head + ent + b"".join(d for _, d in blobs))

def make():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    top = 1  # 上下の余白をそろえる
    for r, row in enumerate(GRID):
        for c, ch in enumerate(row):
            if ch != "." and 0 <= r + top < 16:
                im.putpixel((c, r + top), COL[ch] + (255,))
    return im
if __name__ == "__main__":
    im = make(); im.save(os.path.join(HERE, "favicon", "favicon-16.png"))
    im.resize((32, 32), Image.NEAREST).save(os.path.join(HERE, "favicon", "_favicon-32-pixel.png"))
    v32 = Image.open(os.path.join(HERE, "favicon", "favicon-32.png"))
    write_ico(os.path.join(HERE, "favicon", "favicon.ico"), [im, v32])
    ico = Image.open(os.path.join(HERE, "favicon", "favicon.ico")); print("ico sizes", sorted(ico.info.get("sizes")))
