# トップ LP リニューアルの見本の絵（ドヤくん 6枚）

LP リニューアルの見本（`/renewal-preview/lp`）で使う絵です。左のメニューのアイコン（`docs/design/images/shell-bear/`）と同じ「線の太いステッカー型」にそろえました（2026-10-27 本人の指示。メイン経由）。

| ファイル | 大きさ | 使う所 |
|---|---|---|
| `public/renewal-lp/hero.webp` | 480×480 | ファーストビューのキービジュアル（タブレットのやることの一覧を持ち、前を指さす） |
| `public/renewal-lp/dept-marketing.webp` | 300×300 | ドヤマーケAI（メガホンと棒グラフ） |
| `public/renewal-lp/dept-sales.webp` | 300×300 | ドヤセールスAI（かばんと上向きの矢印の板） |
| `public/renewal-lp/dept-hr.webp` | 300×300 | ドヤ人事AI（組織図のクリップボードと手を振る） |
| `public/renewal-lp/dept-admin.webp` | 300×300 | ドヤ管理AI（電卓とコイン） |
| `public/renewal-lp/cta.webp` | 400×400 | 最後の CTA（跳んで親指を立てる） |
| `public/renewal-lp/tools/*.webp` | 128×128 | 課題の段の小さな絵。`claude/bear-tool-icons-ec9201` の `public/shell/bear/` から写した（main に入ったら、そちらを参照に替える） |

- 作成日: 2026-10-27。採用した版: 1回目
- 作り方: Codex CLI の内蔵の画像生成（ChatGPT の定額の枠）。事前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` で、API キーが無いことを確かめた。従量課金の API は使っていない。
  - 実行: `env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -i ref-hello.png -i ref-point.png -i ref-working.png -i ref-menu.png -`（プロンプトは stdin）
  - 参照画像: `public/character/hello-512.webp`・`point-512.webp`・`working-512.webp`（顔と服の基準）と、メニューのアイコン `public/shell/bear/sfa.webp`（線の基準）
- 背景はマゼンタで描かせ、`docs/design/images/shell-bear/tools/process.py`（`claude/bear-tool-icons-ec9201`）で抜いて、白い縁取りをつけた。残ったマゼンタの点は全部0。
- 画像の中に文字が無いことを目で確かめた（胸の `</>` だけ）。

## プロンプト（全文）

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 6 separate images and save them as PNG files in the folder raw/ with exactly these names: raw/hero.png, raw/marketing.png, raw/sales.png, raw/hr.png, raw/admin.png, raw/cta.png.

These are illustrations for a landing page of the ドヤAI polar bear mascot "Doya-kun". Character for ALL images (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit, and ref-menu.png for the line style):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Style for ALL images (keep identical across the set, same as the app menu icon ref-menu.png but drawn larger with a little more detail):
- Comic sticker illustration with bold thick navy #1a2b5f outlines, flat colors with soft light blue shading, NO halftone dots, NO background doodles, NO code windows, NO clouds, NO gears, NO floating sparkles.
- Only the bear plus the props described, nothing else. Chibi proportions (head about 40 percent of the figure), full body, lively pose readable as a silhouette.
- Colors: white, navy outlines, blue #0066ff and cyan #00c8ff for props, plus at most one small accent in yellow #ffd400.
- Centered, the bear and props together fill about 86 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and props (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or props.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards must be blank or show only simple lines, checkmarks and shapes.

Images:
1. raw/hero.png — the hero key visual: Doya-kun standing confidently in a dynamic three-quarter view, one paw raised high and pointing forward-up like a team leader giving direction, the other paw holding a large tablet whose screen shows a simple checklist of four rows with blue checkmarks. Excited eyes (glowing ^ ^ arcs). A little bigger and more detailed than the others.
2. raw/marketing.png — shouting happily into a big blue megaphone held in one paw, the other paw holding a small card with a rising blue bar chart, three short motion lines coming out of the megaphone.
3. raw/sales.png — holding a blue briefcase in one paw and pointing with the other paw at a small presentation board on a stand that shows an upward blue arrow line chart, confident smile.
4. raw/hr.png — holding a clipboard that shows a simple organization chart (one box on top connected to three boxes below), waving with the other paw, friendly eyes.
5. raw/admin.png — pressing the keys of a big blue calculator held in front of the chest, a small stack of yellow coins next to its feet, focused eyes (glowing straight lines).
6. raw/cta.png — jumping joyfully in the air with both arms raised, one paw making a thumbs up, very happy eyes (glowing ^ ^ arcs).

Save all files and then list the raw/ folder.
```
