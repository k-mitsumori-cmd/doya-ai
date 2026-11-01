# 確認用の1枚（check.png）。白地・暗い地・各サイズ・16px の見え方を並べる。使い方: python3 check.py
import os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.expanduser("~/Library/Fonts/NotoSansJP-Bold.ttf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
def tab(bg, fg):
    return (f'<div class="tab" style="background:{bg};color:{fg}"><img src="favicon/favicon-16.png" width="16">ドヤバディ（旧ドヤAI）'
            f'<span style="opacity:.5;margin-left:18px">×</span></div>')
html = f'''<html><head><meta charset="utf-8"><style>
@font-face{{font-family:J;src:url("file://{FONT}")}}
body{{margin:0;padding:28px 32px;background:#F3F6FB;font-family:J;color:#101B3E;width:1556px}}
h1{{font-size:28px;margin:0 0 6px}} h2{{font-size:17px;margin:22px 0 10px}} p{{margin:0;color:#4A5578;font-size:14px}}
.row{{display:flex;gap:16px;align-items:center;flex-wrap:wrap}}
.box{{border-radius:12px;padding:18px;display:flex;align-items:center;justify-content:center}}
.w{{background:#fff;border:1px solid #E1E7F2}} .d{{background:#101B3E}} .g{{background:#5B6B8C}}
.tab{{display:flex;align-items:center;gap:8px;font-size:13px;padding:8px 14px;border-radius:8px 8px 0 0;width:260px}}
.px{{image-rendering:pixelated}} small{{display:block;font-size:12px;color:#4A5578;text-align:center;margin-top:4px}}
</style></head><body>
<h1>ドヤバディ ロゴ（案1 ドヤ顔のバッジ）本番用の確認</h1>
<p>絵は線で描き直したベクター（SVG）。文字もパスにしてある。</p>
<h2>横長</h2><div class="row">
<div class="box w"><img src="logo/doya-buddy-logo-horizontal-light.svg" height="120"></div>
<div class="box d"><img src="logo/doya-buddy-logo-horizontal-dark.svg" height="120"></div>
<div class="box g"><img src="logo/doya-buddy-logo-horizontal-mono-white.svg" height="120"></div>
<div class="box w"><img src="logo/doya-buddy-logo-horizontal-mono-navy.svg" height="120"></div></div>
<h2>マーク（白地・暗い地の白いふち・白一色・紺一色・64px 以下用）</h2><div class="row">
<div class="box w"><img src="mark/doya-buddy-mark.svg" width="150"></div>
<div class="box d"><img src="mark/doya-buddy-mark-rim.svg" width="150"></div>
<div class="box g"><img src="mark/doya-buddy-mark-mono-white.svg" width="150"></div>
<div class="box w"><img src="mark/doya-buddy-mark-mono-navy.svg" width="150"></div>
<div class="box w"><img src="mark/doya-buddy-mark-small.svg" width="150"></div></div>
<h2>アイコン（1024・512・180・64px の書き出しを実寸の比で）とファビコン</h2><div class="row">
<div><img src="icon/doya-buddy-icon-1024.png" width="200" style="border-radius:44px"><small>1024</small></div>
<div><img src="icon/doya-buddy-icon-512.png" width="128" style="border-radius:28px"><small>512</small></div>
<div><img src="icon/doya-buddy-icon-180.png" width="90" style="border-radius:20px"><small>180</small></div>
<div><img src="icon/doya-buddy-icon-64.png" width="64" style="border-radius:14px"><small>64（実寸）</small></div>
<div><img src="favicon/favicon-32.png" width="32"><small>32</small></div>
<div><img src="favicon/favicon-16.png" width="16"><small>16</small></div>
<div class="box w"><img class="px" src="favicon/favicon-16.png" width="128"></div>
<div class="box d"><img class="px" src="favicon/favicon-16.png" width="128"></div>
<div class="box w"><img class="px" src="favicon/favicon-32.png" width="128"></div>
<div class="box w"><img class="px" src="favicon/_favicon-32-pixel.png" width="128"></div>
<div>{tab("#ffffff", "#202124")}{tab("#35363A", "#E8EAED")}<small>ブラウザのタブ（16px 実寸）</small></div></div>
<h2>OGP（1200×630）</h2><img src="og/doya-buddy-og.png" width="760" style="border:1px solid #E1E7F2;border-radius:8px">
</body></html>'''
open(os.path.join(HERE, "_check.html"), "w").write(html)
subprocess.run(["nice", "-n", "15", CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={os.environ.get('TMPDIR', '/tmp')}/chr-logo",
                "--hide-scrollbars", "--window-size=1620,1500", "--screenshot=" + os.path.join(HERE, "check.png"), "file://" + os.path.join(HERE, "_check.html")],
               check=True, capture_output=True)
print("ok")
