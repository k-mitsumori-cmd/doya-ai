# ドヤバディ ロゴ（案1 ドヤ顔のバッジ）本番用（2026-10-31）

本人の決定：「ロゴは1のドヤ顔バッジで進めてください」（10/31）。
確認用の1枚：`check.png`

## ファイル
| 置き場所 | 中身 | 使う所 |
|---|---|---|
| `logo/doya-buddy-logo-horizontal-light.svg/.png` | 横長（クマ＋ドヤバディ／DOYA BUDDY） | 白い地のヘッダー・資料 |
| `logo/doya-buddy-logo-horizontal-dark.svg/.png` | 横長（クマに白いふち、文字は白） | 暗い地 |
| `logo/doya-buddy-logo-horizontal-mono-white.svg/.png` | 横長・白一色 | 写真や色の地の上 |
| `logo/doya-buddy-logo-horizontal-mono-navy.svg/.png` | 横長・紺一色 | 白黒の印刷 |
| `mark/doya-buddy-mark.svg/.png` | クマだけ（白地用） | 単独のマーク |
| `mark/doya-buddy-mark-rim.svg/.png` | クマだけ（白いふち） | 暗い地 |
| `mark/doya-buddy-mark-mono-white.svg/.png`・`-mono-navy` | クマだけの一色 | 刻印・印刷 |
| `mark/doya-buddy-mark-small.svg/.png` | 頭と耳だけの小さい版（線を太く、細部を省いた） | 64px 以下 |
| `icon/doya-buddy-icon.svg` と `-1024/-512/-180.png` | 正方形のアイコン（青地。角は OS が丸める） | アプリ・apple-touch-icon（180） |
| `icon/doya-buddy-icon-small.svg` と `-64.png` | 64px 用（小さい版） | 小さいアイコン |
| `favicon/favicon.svg`・`favicon-32.png` | ファビコン（小さい版、透明） | ブラウザのタブ |
| `favicon/favicon-16.png` | 16px は1マスずつ描いたドット | ブラウザのタブ |
| `favicon/favicon.ico` | 16px（ドット）と 32px を1つに | 古いブラウザ |
| `og/doya-buddy-og.svg/.png` | OGP 1200×630「ドヤバディ（旧ドヤAI）」 | SNS で共有したとき |

- 1024px のアイコンと OGP の PNG は、透明なし（App Store などの決まりに合わせた）。
- 色：青 #0066FF、紺 #101B3E、白、レンズの目 #6FA8FF（16px のドットだけ #8EBBFF）。
- 書体：Noto Sans JP Black（SIL Open Font License）。文字はパスにしてあるので、書体を入れる必要はない。

## 作り方
- クマは Codex の内蔵の画像生成（定額）で作った絵（`../doya-buddy-bear/_gen/out/b1-face.png`）を下敷きにして、SVG の図形で描き直した（`bear.py`）。PNG の埋め込みは無い。
- 作り直し：`python3 make.py`（全部の SVG・PNG）→ `python3 check.py`（確認の1枚）。16px のドットは `favicon16.py` の表を直す。
