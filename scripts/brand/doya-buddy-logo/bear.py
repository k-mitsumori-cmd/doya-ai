# ドヤバディのロゴ（案1 ドヤ顔のバッジ）のクマの顔を、SVG の図形で描く。
# 元の絵（../doya-buddy-bear/_gen/out/b1-face.png、1254px 四方）を下敷きに、線で描き直したもの。
# 座標は 1254 四方の枠。左右対称の所は x=627 を軸に折り返す。
BLUE, NAVY, WHITE, LENS = "#0066FF", "#101B3E", "#FFFFFF", "#6FA8FF"
SW = 22  # 輪郭の太さ

def mirror(d):
    """パスの x を折り返す（数字の対だけのパス用）。"""
    import re
    toks = re.findall(r"[A-Za-z]|-?\d+(?:\.\d+)?", d)
    out, i, cmd, idx = [], 0, "", 0
    for t in toks:
        if t.isalpha():
            cmd = t; idx = 0; out.append(t); continue
        v = float(t)
        if cmd in "MLCSQT":
            if idx % 2 == 0: v = 1254 - v
        elif cmd == "H":
            v = 1254 - v
        out.append(f"{v:g}"); idx += 1
    return " ".join(out)

HEAD = ("M350 205 C420 165 470 148 505 138 C560 82 640 46 690 47 C706 76 670 122 628 162 "
        "C690 116 745 98 790 101 C806 132 762 170 708 186 C860 215 1080 330 1138 590 "
        "C1175 820 940 968 627 968 C314 968 79 820 116 590 C140 440 230 285 350 205 Z")
EAR_L = "M55 255 C55 172 122 105 205 105 C288 105 355 172 355 255 C355 338 288 405 205 405 C122 405 55 338 55 255 Z"
EAR_IN_L = "M195 352 C150 330 150 260 180 230 C220 195 270 205 296 245 C250 270 220 305 195 352 Z"
HOOD = ("M150 885 C70 960 70 1090 140 1150 C300 1235 954 1235 1114 1150 C1184 1090 1184 960 1104 885 "
        "C980 980 820 1030 627 1030 C434 1030 274 980 150 885 Z")
COLLAR = "M178 945 C340 1012 520 1045 627 1105 C734 1045 914 1012 1076 945"
LINING_L = "M205 955 C262 932 330 940 392 1028 C300 1012 232 990 205 955 Z"
STRAP_L = "M78 512 C120 500 160 492 200 488 L200 620 C160 622 120 628 78 634 C62 600 62 546 78 512 Z"
FRAME = ("M240 360 C450 328 804 328 1014 360 C1060 368 1076 420 1076 470 L1076 600 C1076 680 1040 706 980 706 "
         "L800 706 C740 706 720 604 627 600 C534 604 514 706 454 706 L274 706 C214 706 178 680 178 600 "
         "L178 470 C178 420 194 368 240 360 Z")
LENS_P = ("M272 404 C462 380 792 380 982 404 C1014 409 1030 440 1030 480 L1030 610 C1030 650 1010 663 975 663 "
          "L792 663 C736 663 716 566 627 561 C538 566 518 663 462 663 L279 663 C244 663 224 650 224 610 "
          "L224 480 C224 440 240 409 272 404 Z")
NOSE = "M550 668 C550 636 704 636 704 668 C704 708 662 736 627 736 C592 736 550 708 550 668 Z"
MOUTH = ("M627 736 V762 M510 760 C520 802 562 812 592 796 C612 786 627 772 627 762 "
         "M627 762 C640 788 684 794 724 778 C752 766 772 752 786 738")

def face(p=None, rim=0, small=False, uid="b"):
    """p は色の割り当て（ink=輪郭, fill=白い所, blue=ゴーグル, lens=レンズ, eye=目, hi=光, rim=ふち）。
    色に "clear" を指定した所は、それより下に描いた物を消す（一色の版で、重なりを正しく見せるため）。
    rim>0 で外側に白いふちを付ける。small=True は 16〜64px 用に細部を省いた形。"""
    p = p or PALETTES["color"]
    sw = SW * (1.6 if small else 1)
    items = []  # (d, fill, stroke, width)
    def add(d, fill, stroke=None, w=None):
        items.append((d, fill, stroke, w or sw))
    ink = p["ink"]
    sil = [EAR_L, mirror(EAR_L), HEAD, STRAP_L, mirror(STRAP_L)] + ([] if small else [HOOD])
    if rim:  # 白いふち：形の全体を太い線でなぞって一番下に敷く
        for d in sil:
            add(d, p["rim"], p["rim"], sw + rim * 2)
    if not small:
        add(HOOD, p["fill"], ink)
        for d in (LINING_L, mirror(LINING_L)):
            add(d, p["blue"], ink, sw * 0.7)
        add(COLLAR, "none", ink)
        for x in (470, 784):  # パーカーのひも
            add(f"M{x - 26} 1100 C{x - 26} 1070 {x + 26} 1070 {x + 26} 1100 L{x + 22} 1205 "
                f"C{x + 22} 1232 {x - 22} 1232 {x - 22} 1205 Z", p["blue"], ink, sw * 0.8)
    for e, i in ((EAR_L, EAR_IN_L), (mirror(EAR_L), mirror(EAR_IN_L))):
        add(e, p["fill"], ink); add(i, ink)
    add(HEAD, p["fill"], ink)
    if not small:  # 頭の毛の中の線
        add("M628 162 C600 190 590 205 585 212", "none", ink, sw * 0.8)
    for d in (STRAP_L, mirror(STRAP_L)):
        add(d, p["blue"], ink)
    add(FRAME, p["blue"], ink)
    add(LENS_P, p["lens"], p["hi"], 16 if not small else 22)
    # 目：斜めの眉と、しずく形の瞳（にやりとした半目）
    ew = 34 if not small else 48
    brow = "M356 496 L522 538"
    pupil = "M432 536 C432 600 446 612 455 612 C468 612 480 596 480 548 Z"
    for d in (brow, mirror(brow)):
        add(d, "none", p["eye"], ew)
    for d in (pupil, mirror(pupil)):
        add(d, p["eye"], p["eye"], 10)
    if not small:
        for d in ("M306 446 C292 456 288 470 290 480", "M290 600 C292 612 300 622 308 628"):
            add(d, "none", p["eye"], 14); add(mirror(d), "none", p["eye"], 14)
    add(NOSE, ink)
    if not small:
        add("M570 662 C570 650 626 650 626 662 C626 674 570 674 570 662 Z", p["hi"])
    add(MOUTH, "none", ink, sw * (0.9 if not small else 1.1))
    return _assemble(items, uid)

def _el(d, fill, stroke, w):
    s = f' stroke="{stroke}" stroke-width="{w:g}" stroke-linejoin="round" stroke-linecap="round"' if stroke and stroke != "none" else ""
    return f'<path d="{d}" fill="{fill}"{s}/>'

def _assemble(items, uid):
    """上から順に重ねる。clear の塗り・線は、それまでに描いた物をその形で消す（マスクを入れ子にする）。"""
    body, defs, n = "", "", 0
    for d, fill, stroke, w in items:
        cf, cs = fill == "clear", stroke == "clear"
        if cf or cs:
            n += 1; mid = f"{uid}{n}"
            cut = _el(d, "#000" if cf else "none", "#000" if cs else None, w)
            defs += (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="-300" y="-300" width="1854" height="1854">'
                     f'<rect x="-300" y="-300" width="1854" height="1854" fill="#fff"/>{cut}</mask>')
            body = f'<g mask="url(#{mid})">{body}</g>'
        f2 = "none" if cf else fill
        s2 = None if cs else stroke
        if f2 != "none" or (s2 and s2 != "none"):
            body += _el(d, f2, s2, w)
    return (f"<defs>{defs}</defs>" if defs else "") + body

PALETTES = {
    "color": dict(ink=NAVY, fill=WHITE, blue=BLUE, lens=NAVY, eye=LENS, hi=WHITE, rim=WHITE),
    # 白一色：紺と青の所を白に、白の所を抜く。濃い地・写真の上・刻印用
    "mono-white": dict(ink=WHITE, fill="clear", blue=WHITE, lens=WHITE, eye="clear", hi="clear", rim=WHITE),
    # 紺一色：白い地の印刷・FAX・はんこ用
    "mono-navy": dict(ink=NAVY, fill="clear", blue=NAVY, lens=NAVY, eye="clear", hi="clear", rim=NAVY),
}

def svg(body, size=1254, vb="0 0 1254 1254"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{size}" height="{size}">{body}</svg>'
