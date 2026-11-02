# 経営ホームの「ゴール・ToDo」のドヤくんの絵（6枚）

経営ホームで作戦を立てたあとの画面（ゴール・3つの柱・ToDo）に出す絵です。2026-11-01 の本人の言葉「わかりずらいです。クマのアイコンをちゃんとそれぞれ codex で画像生成してわかりやすくしてください」を受けて作りました。

- 置き場所: `public/shell/bear/todo/<名前>.webp`。背景は透過、白い縁取りのステッカー型、WebP（品質90）
- 出す部品: `src/components/home-agent/HomeAgent.tsx` の `TodoBear`（ToDo の左・実行中の一覧）と、ゴールの欄の左の絵
- 左のメニューの絵（`public/shell/bear/<ツールid>.webp`・`menu/`）とは別の絵です。そちらは変えていません
- 作成日: 2026-11-01

| ファイル | 出す所 | 仕事 |
|---|---|---|
| `shodan.webp` | ドヤ商談準備の ToDo | 虫めがねで相手の会社のビルを調べる |
| `quote.webp` | ドヤ見積もりAI の ToDo | 電卓を持ち、見積書の下書きを掲げる |
| `doyaslide.webp` | ドヤスライドの ToDo | 指し棒で、スライドの並びを書いたボードを説明する |
| `goal.webp` | ゴールの欄 | 旗を掲げ、的の真ん中に矢が当たっている |
| `power.webp` | 経営ホームのドヤパワーの欄 | 稲妻の印の電池を抱える |
| `history.webp` | 「ドヤくんが進めた仕事」（ホームの直近と /home/work） | できた書類のカードが出ているフォルダを持つ |

## 作り方

1. Codex CLI の内蔵の画像生成で作った。ChatGPT の定額の枠で動かし、従量課金の API キーは使っていない。
   - 事前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` で、環境変数に API キーが無いことを確かめた。
   - 実行: `env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -i ref-hello.png -i ref-point.png -i ref-working.png -`（プロンプトは stdin）。`~/Code/tools/pc-guard/heavy-slot.sh` を通した。PC の負荷を抑えるため、1枚ずつ6回に分けて順に流した（2026-11-01 統括の指示）。
2. 参照画像は、経営ホームのドヤくん `public/character/hello-512.webp`・`point-512.webp`・`working-512.webp`。顔・ゴーグル・胸の `</>` をそろえる基準にした。
3. 左のメニューの絵との違い: 64px 前後で出すので、道具を絵の半分ほどまで大きくし、「何の仕事か」が道具だけで分かるようにした（商談準備は、今までの絵だと青い箱を持っているだけに見えたため）。
4. 背景を真っ平らなマゼンタ（#ff00ff）で描かせ、`docs/design/images/shell-bear/tools/process.py` で抜いた。ToDo の3枚は 128×128、ほかの3枚は 160×160 に縮めた。残ったマゼンタの点は全枚0。採用した版はどれも1回目。
5. 画像の中に文字が無いことを目で確かめた（胸の `</>` だけ）。

## プロンプト（全文）

### shodan

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file at exactly raw/shodan.png.

These are TASK ICONS shown at about 56-64px next to to-do items in a business app. Each one must show at a glance WHAT JOB the polar bear mascot "Doya-kun" is doing. Character (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style:
- Comic sticker illustration like the references but SIMPLIFIED for small size: bold thick navy outlines, flat colors with light blue shading, NO halftone dots, NO background doodles, NO sparkles.
- Composition: the bear's head and upper body take about the left/back 55 percent, and the ONE prop is LARGE and clearly readable (about 45-50 percent of the image). The action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent.
- Centered, bear and prop together fill about 90 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards show only simple lines and shapes.

Image:
raw/shodan.png — RESEARCHING A CLIENT COMPANY: the bear holds a big blue magnifying glass in one paw and peers through it at a small blue office building (simple tower with window grid) standing next to it; curious eyes. The magnifying glass lens overlaps the building so it clearly reads as "investigating a company".

Save the file and then list the raw/ folder.
```

### quote

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file at exactly raw/quote.png.

These are TASK ICONS shown at about 56-64px next to to-do items in a business app. Each one must show at a glance WHAT JOB the polar bear mascot "Doya-kun" is doing. Character (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style:
- Comic sticker illustration like the references but SIMPLIFIED for small size: bold thick navy outlines, flat colors with light blue shading, NO halftone dots, NO background doodles, NO sparkles.
- Composition: the bear's head and upper body take about the left/back 55 percent, and the ONE prop is LARGE and clearly readable (about 45-50 percent of the image). The action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent.
- Centered, bear and prop together fill about 90 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards show only simple lines and shapes.

Image:
raw/quote.png — DRAFTING A PRICE ESTIMATE: the bear holds a large blue calculator in one paw and with the other paw holds up a white estimate sheet with a few horizontal line rows and a small yellow coin symbol (a plain circle, no currency sign) in the corner; focused eyes.

Save the file and then list the raw/ folder.
```

### doyaslide

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file at exactly raw/doyaslide.png.

These are TASK ICONS shown at about 56-64px next to to-do items in a business app. Each one must show at a glance WHAT JOB the polar bear mascot "Doya-kun" is doing. Character (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style:
- Comic sticker illustration like the references but SIMPLIFIED for small size: bold thick navy outlines, flat colors with light blue shading, NO halftone dots, NO background doodles, NO sparkles.
- Composition: the bear's head and upper body take about the left/back 55 percent, and the ONE prop is LARGE and clearly readable (about 45-50 percent of the image). The action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent.
- Centered, bear and prop together fill about 90 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards show only simple lines and shapes.

Image:
raw/doyaslide.png — BUILDING A PRESENTATION OUTLINE: the bear points with a pointer stick at a big presentation board on a stand; the board shows three stacked slide thumbnails (small rectangles with lines) and a simple rising blue bar chart; confident eyes.

Save the file and then list the raw/ folder.
```

### goal

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file at exactly raw/goal.png.

These are TASK ICONS shown at about 56-64px next to to-do items in a business app. Each one must show at a glance WHAT JOB the polar bear mascot "Doya-kun" is doing. Character (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style:
- Comic sticker illustration like the references but SIMPLIFIED for small size: bold thick navy outlines, flat colors with light blue shading, NO halftone dots, NO background doodles, NO sparkles.
- Composition: the bear's head and upper body take about the left/back 55 percent, and the ONE prop is LARGE and clearly readable (about 45-50 percent of the image). The action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent.
- Centered, bear and prop together fill about 90 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards show only simple lines and shapes.

Image:
raw/goal.png — AIMING AT TODAY'S GOAL: the bear holds a small yellow-and-blue flag raised high in one paw and stands beside a big round blue-and-white target (bullseye) with one blue arrow stuck in the center; determined happy eyes.

Save the file and then list the raw/ folder.
```

### power

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file at exactly raw/power.png.

These are TASK ICONS shown at about 56-64px next to to-do items in a business app. Each one must show at a glance WHAT JOB the polar bear mascot "Doya-kun" is doing. Character (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style:
- Comic sticker illustration like the references but SIMPLIFIED for small size: bold thick navy outlines, flat colors with light blue shading, NO halftone dots, NO background doodles, NO sparkles.
- Composition: the bear's head and upper body take about the left/back 55 percent, and the ONE prop is LARGE and clearly readable (about 45-50 percent of the image). The action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent.
- Centered, bear and prop together fill about 90 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards show only simple lines and shapes.

Image:
raw/power.png — DOYA POWER (the app's energy points): the bear hugs a big blue battery-shaped capsule with a large yellow lightning bolt on it, the battery is about three quarters full (cyan fill), cheerful energetic eyes.

Save the file and then list the raw/ folder.
```

### history

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file at exactly raw/history.png.

These are TASK ICONS shown at about 56-64px next to to-do items in a business app. Each one must show at a glance WHAT JOB the polar bear mascot "Doya-kun" is doing. Character (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style:
- Comic sticker illustration like the references but SIMPLIFIED for small size: bold thick navy outlines, flat colors with light blue shading, NO halftone dots, NO background doodles, NO sparkles.
- Composition: the bear's head and upper body take about the left/back 55 percent, and the ONE prop is LARGE and clearly readable (about 45-50 percent of the image). The action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent.
- Centered, bear and prop together fill about 90 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards show only simple lines and shapes.

Image:
raw/history.png — LOOKING BACK AT FINISHED WORK: the bear holds an open blue folder from which three white document cards with simple line rows and one cyan check mark circle fan out; satisfied smiling eyes.

Save the file and then list the raw/ folder.
```

## 画面写真

- 6枚の一覧（明るい背景と暗い背景、160px と 56px）: `screens/bears-sheet.png`
- 直す前: `screens/before-1280-full.png`・`screens/before-375-full.png`
- 直す前と後を並べたもの: `screens/compare-1280.png`・`screens/compare-375.png`
- 流れの動き（確認 → 飛んでいく → 実行中 → 紙吹雪 → 完成）: `screens/flow-1280.gif`・`screens/flow-375.gif`
- 場面ごと: `screens/flow-<幅>-03-confirm.png`（確認）・`08-run-2.png`（実行中）・`14-done-open.png`（完成・カードを開いた所）・`15-work.png`（進めた仕事の一覧）・`16-home.png`（経営ホーム全体）
- 撮り方: 開発用の見本ページ `/home/agent-preview`・`/home/work/preview`・`/home/preview`（API・DB・AI・ドヤパワーを使わない）で、例「商談の準備をまとめて進めたい」を選び、URL に https://doyamarke.surisuta.jp を入れて作戦の画面まで進めた。
