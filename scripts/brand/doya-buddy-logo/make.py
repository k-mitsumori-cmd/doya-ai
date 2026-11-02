# ドヤバディのロゴ（案1 ドヤ顔のバッジ）を、本番で使う形にそろえて書き出す。
# 使い方: python3 make.py  → mark/ logo/ icon/ favicon/ og/ に SVG と PNG、確認用の check.png
# すべてベクター（文字もパス）。PNG は Chrome で1回だけ描いて切り分ける（PC の負荷を抑えるため）。
import os, re, subprocess, importlib.util
from PIL import Image
import bear

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("b", os.path.join(HERE, "..", "doya-buddy", "build.py"))
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
BLUE, NAVY, WHITE, BLUE_ON_DARK = B.BLUE, B.NAVY, B.WHITE, B.BLUE_ON_DARK
F = "NotoSansJP-Black.ttf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

MARK_VB = (10, 10, 1234, 1234)        # クマ全体（パーカーまで）
SMALL_VB = (36, -82, 1182, 1182)      # 小さい版（頭と耳だけ）
RIM = 34

def nested(body, vb, x, y, size):
    """クマの絵を、別の SVG の中の (x, y) に size 四方で置く。"""
    return (f'<svg x="{x:.1f}" y="{y:.1f}" width="{size:.1f}" height="{size:.1f}" '
            f'viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" overflow="visible">{body}</svg>')

def doc(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">'
            f'<title>{title}</title>{body}</svg>')

def words(x, base, ink, accent, size=112):
    d, a, _ = B.text_path(F, "ドヤバディ", size, tracking=-0.05)
    dl, al, _ = B.text_path(F, "DOYA BUDDY", size * 0.27, tracking=0.34)
    return (f'<path transform="translate({x:.1f} {base:.1f})" d="{d}" fill="{ink}"/>'
            f'<path transform="translate({x + 4:.1f} {base + size * 0.46:.1f})" d="{dl}" fill="{accent}"/>'), max(a, al)

def write(rel, s):
    p = os.path.join(HERE, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w").write(s); return rel

OUT = []  # (svg の相対パス, 書き出す PNG の [(名前, 幅)] )

# ---------- マーク（クマだけ） ----------
P = bear.PALETTES
marks = {
    "doya-buddy-mark": (bear.face(uid="m"), MARK_VB, "白地用"),
    "doya-buddy-mark-rim": (bear.face(rim=RIM, uid="r"), (MARK_VB[0] - RIM, MARK_VB[1] - RIM, MARK_VB[2] + RIM * 2, MARK_VB[3] + RIM * 2), "暗い地用（白いふち）"),
    "doya-buddy-mark-mono-white": (bear.face(P["mono-white"], uid="w"), MARK_VB, "白一色"),
    "doya-buddy-mark-mono-navy": (bear.face(P["mono-navy"], uid="n"), MARK_VB, "紺一色"),
    "doya-buddy-mark-small": (bear.face(small=True, uid="s"), SMALL_VB, "64px 以下用（細部を省いた形）"),
}
for name, (body, vb, note) in marks.items():
    rel = write(f"mark/{name}.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" width="1024" height="1024"><title>ドヤバディ {note}</title>{body}</svg>')
    OUT.append((rel, [(f"mark/{name}.png", 1024)]))

# ---------- 横長のロゴ ----------
def horizontal(kind):
    H = 280; m = 248
    if kind == "light":
        art, vb, ink, acc = bear.face(uid="hl"), MARK_VB, NAVY, BLUE
    elif kind == "dark":
        art, vb, ink, acc = bear.face(rim=RIM, uid="hd"), (MARK_VB[0] - RIM, MARK_VB[1] - RIM, MARK_VB[2] + RIM * 2, MARK_VB[3] + RIM * 2), WHITE, BLUE_ON_DARK
    elif kind == "mono-white":
        art, vb, ink, acc = bear.face(P["mono-white"], uid="hw"), MARK_VB, WHITE, WHITE
    else:
        art, vb, ink, acc = bear.face(P["mono-navy"], uid="hn"), MARK_VB, NAVY, NAVY
    body = nested(art, vb, 16, (H - m) / 2, m)
    t, w = words(16 + m + 28, 158, ink, acc)
    return doc(16 + m + 28 + w + 28, H, body + t, "ドヤバディ DOYA BUDDY")
for k in ("light", "dark", "mono-white", "mono-navy"):
    rel = write(f"logo/doya-buddy-logo-horizontal-{k}.svg", horizontal(k))
    w = float(re.search(r'viewBox="0 0 ([\d.]+)', open(os.path.join(HERE, rel)).read()).group(1))
    OUT.append((rel, [(f"logo/doya-buddy-logo-horizontal-{k}.png", int(w * 2))]))

# ---------- アイコン（正方形。角は OS が丸めるので四角のまま） ----------
def icon(small=False):
    vb = SMALL_VB if small else MARK_VB
    art = bear.face(small=small, uid="is" if small else "i")
    size, y = (440, 40) if small else (470, 70)
    return doc(512, 512, f'<rect width="512" height="512" fill="{BLUE}"/>' + nested(art, vb, (512 - size) / 2, y, size), "ドヤバディ")
rel = write("icon/doya-buddy-icon.svg", icon())
OUT.append((rel, [("icon/doya-buddy-icon-1024.png", 1024)]))
rel = write("icon/doya-buddy-icon-small.svg", icon(small=True))
OUT.append((rel, [("icon/_small-512.png", 512)]))

# ---------- ファビコン（透過。頭と耳だけの小さい版） ----------
rel = write("favicon/favicon.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{SMALL_VB[0]} {SMALL_VB[1]} {SMALL_VB[2]} {SMALL_VB[3]}" width="32" height="32">{bear.face(small=True, uid="f")}</svg>')
OUT.append((rel, [("favicon/_favicon-512.png", 512)]))

# ---------- OGP（1200×630） ----------
def og():
    W, H = 1200, 630
    body = f'<rect width="{W}" height="{H}" fill="{WHITE}"/><rect y="{H - 18}" width="{W}" height="18" fill="{BLUE}"/>'
    body += f'<circle cx="300" cy="315" r="232" fill="#EAF2FF"/>'
    body += nested(bear.face(uid="o"), MARK_VB, 300 - 215, 315 - 215, 430)
    d, a, _ = B.text_path(F, "ドヤバディ", 132, tracking=-0.05)
    body += f'<path transform="translate(566 300)" d="{d}" fill="{NAVY}"/>'
    d2, a2, _ = B.text_path(F, "（旧ドヤAI）", 46, tracking=0.0)
    body += f'<path transform="translate(560 374)" d="{d2}" fill="#4A5578"/>'
    d3, a3, _ = B.text_path(F, "DOYA BUDDY", 34, tracking=0.34)
    body += f'<path transform="translate(570 458)" d="{d3}" fill="{BLUE}"/>'
    return doc(W, H, body, "ドヤバディ（旧ドヤAI）")
rel = write("og/doya-buddy-og.svg", og())
OUT.append((rel, [("og/doya-buddy-og.png", 1200)]))

# ---------- PNG にする ----------
def render():
    items, y = [], 0
    for rel, outs in OUT:
        txt = open(os.path.join(HERE, rel)).read(600)
        vw, vh = map(float, re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', txt).groups())
        for name, w in outs:
            h = round(w * vh / vw); items.append((rel, name, y, w, h)); y += h + 4
    W = max(i[3] for i in items)
    html = "".join(f'<img src="{r}" style="position:absolute;left:0;top:{yy}px;width:{w}px;height:{h}px">' for r, _, yy, w, h in items)
    open(os.path.join(HERE, "_render.html"), "w").write(f'<html><body style="margin:0;background:transparent">{html}</body></html>')
    shot = os.path.join(HERE, "_render.png")
    subprocess.run(["nice", "-n", "15", CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={os.environ.get('TMPDIR', '/tmp')}/chr-logo",
                    "--hide-scrollbars", "--default-background-color=00000000", "--force-device-scale-factor=1",
                    f"--window-size={W},{y}", f"--screenshot={shot}", "file://" + os.path.join(HERE, "_render.html")], check=True, capture_output=True)
    big = Image.open(shot)
    for _, name, yy, w, h in items:
        big.crop((0, yy, w, yy + h)).save(os.path.join(HERE, name))
    os.remove(shot); os.remove(os.path.join(HERE, "_render.html"))

render()
ic = Image.open(os.path.join(HERE, "icon/doya-buddy-icon-1024.png")).convert("RGB")
for n in (512, 180):
    ic.resize((n, n), Image.LANCZOS).save(os.path.join(HERE, f"icon/doya-buddy-icon-{n}.png"))
sm = Image.open(os.path.join(HERE, "icon/_small-512.png")).convert("RGB")
sm.resize((64, 64), Image.LANCZOS).save(os.path.join(HERE, "icon/doya-buddy-icon-64.png"))
fv = Image.open(os.path.join(HERE, "favicon/_favicon-512.png"))
for n in (32, 16, 48):
    fv.resize((n, n), Image.LANCZOS).save(os.path.join(HERE, f"favicon/favicon-{n}.png"))
fv.resize((48, 48), Image.LANCZOS).save(os.path.join(HERE, "favicon/favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
for p in ("icon/_small-512.png", "favicon/_favicon-512.png", "favicon/favicon-48.png"):
    os.remove(os.path.join(HERE, p))
print("ok")

# App Store などは透明を嫌うので、アイコンと OGP は透明なしで保存し直す
for p in ("icon/doya-buddy-icon-1024.png", "og/doya-buddy-og.png"):
    Image.open(os.path.join(HERE, p)).convert("RGB").save(os.path.join(HERE, p))

# 16px は1マスずつ描いた版に差し替え、ico にまとめる
import favicon16, subprocess as _sp
_sp.run(["python3", os.path.join(HERE, "favicon16.py")], check=True)
