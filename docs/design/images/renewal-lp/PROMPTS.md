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

## v2（ド派手版）の画面いっぱいの絵（2026-10-27 10:30）

参考の作品集（elayadesigns の X の動画）にならい、ファーストビューと最後の CTA を、画面いっぱいの絵にしました。

| ファイル | 大きさ | 使う所 |
|---|---|---|
| `public/renewal-lp/scene-hero.webp` | 1536×1024 | ファーストビューの背景（左に空、右にビルの屋上で指さすドヤくん、4つの部署の札が光る） |
| `public/renewal-lp/scene-finale.webp` | 1536×1024 | 最後の CTA の背景（花火の空と、丘の上で跳ぶドヤくん） |

- 作り方は上と同じ（Codex の内蔵の画像生成、定額）。参照画像は、上で作った `hero` の絵（線の基準）と `hello`・`point`。
- 採用した版: 1回目。画像の中に文字が無いことを目で確かめた。

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 2 separate images and save them as PNG files with exactly these names: raw2/scene-hero.png and raw2/scene-finale.png. Both are LANDSCAPE 3:2, 1536x1024.

These are full-bleed cinematic key visuals for the landing page of "ドヤAI", a Japanese AI work-tool brand. The mascot is the polar bear "Doya-kun". Draw Doya-kun exactly like the attached references (ref-hero-sticker.png for the line style and pose, ref-hello.png and ref-point.png for the face and outfit): white fluffy polar bear, round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens, the eyes are only glowing cyan shapes inside the lens), small black nose, open happy mouth, white hoodie with a blue </> symbol on the chest. Keep his bold thick navy comic outlines and flat colors so he looks like the same sticker character, placed inside a richly painted scene.

Scene style for both: high-end anime film background art (painterly, luminous, very saturated), dramatic sky with towering cumulus clouds and light rays, rich gradients in the brand colors: deep electric blue #0066ff, violet #6a4cff, hot pink #ff1e72, cyan #00e0ff, with a warm yellow #ffd400 glow near the horizon. Spectacular, energetic, premium, like a movie poster. Fine film grain. ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Any screens or panels show only simple shapes.

1. raw2/scene-hero.png — Composition: the LEFT 55 percent of the frame is open luminous sky with soft clouds and a smooth gradient (this area must stay calm and uncluttered because a big headline will be placed over it). On the RIGHT third, Doya-kun stands confidently on the edge of a futuristic glass skyscraper rooftop, full body, about 45 percent of the frame height, one paw pointing up and forward like a leader giving direction, the other paw holding a tablet showing four rows with checkmarks. Around and behind him, four glowing translucent floating panels trail ribbons of light across the sky, one each in cyan, hot pink, yellow and violet; each panel shows one simple white line icon: a megaphone, a briefcase, a group of three people, a calculator. Below, a dense modern city skyline fades into blue haze. Sunset light from behind lights up his outline with a rim glow.

2. raw2/scene-finale.png — Composition: the TOP 50 percent of the frame is open night-to-dusk gradient sky (deep blue to violet to pink at the horizon) with big colorful fireworks bursting in cyan, pink, yellow and violet, kept toward the edges so the upper center stays readable for a headline. In the lower center, Doya-kun jumps joyfully in the air above a grassy hilltop overlooking a glowing city at dusk, both arms raised, one paw making a thumbs up, about 35 percent of the frame height. Light ribbons swirl upward around him.

Save both files and then list the raw2/ folder.
```
