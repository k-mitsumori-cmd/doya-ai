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

## スマホのファーストビューの縦の絵（2026-10-27 11:00）

- `public/renewal-lp/scene-hero-portrait.webp`（1024×1536）。横の `scene-hero` を、スマホ用に縦に描き直した。作り方は上と同じ（Codex の内蔵の画像生成、定額）。採用した版: 1回目。

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 1 image and save it as a PNG file named raw2/scene-hero-portrait.png. PORTRAIT 2:3, 1024x1536.

Recreate the attached landscape key visual ref-scene-hero.png as a vertical smartphone version, in exactly the same art style, colors, lighting and character design (Doya-kun the polar bear with blue visor goggles and the white </> hoodie, bold navy comic outlines, standing on a glass skyscraper rooftop, pointing up, holding a checklist tablet, four glowing floating panels in cyan, hot pink, yellow and violet with simple white line icons: megaphone, briefcase, group of people, calculator; anime-film sunset sky with towering clouds; city skyline in haze).
Composition for portrait: Doya-kun and the four panels in the UPPER 55 percent of the frame (bear centered slightly right, about 38 percent of the frame height). The LOWER 45 percent is the city skyline fading into deep blue haze and darker sky tones, calm and uncluttered, because headline text will be placed over it.
ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed).
Save the file and then list the raw2/ folder.
```

## 背景の動画（MiniMax H3、2026-10-27 11:20）

| ファイル | 元 | 中身 |
|---|---|---|
| `public/renewal-lp/video/lp-hero-desktop.mp4` | `scene-hero` を最初の1コマに | ファーストビュー（横） |
| `public/renewal-lp/video/lp-hero-mobile.mp4` | `scene-hero-portrait` を最初の1コマに | ファーストビュー（縦、スマホ） |
| `public/renewal-lp/video/lp-finale.mp4` | `scene-finale` を最初の1コマに | 最後の CTA |

- モデル: MiniMax 公式 API の `MiniMax-H3`、768P、10秒、音なし。本人の承認（2026-10-27、このセッションで直接。最大6回・合計 $6.80 まで）のあとに作った。
- 呼んだ回数: 3回（作り直しなし）。task_id は hero-desktop 456755481543220、hero-mobile 456760234779136、finale 456758339736052。
- 見込みの額: 1回 $0.84（$0.08×10秒＋入力の画像 $0.04 を念のため足した値）×3回＝$2.52。実際の請求額は MiniMax の管理画面で確かめる。
- 呼び出しの台本: `~/Code/sandbox/doya-lp-video/minimax-video.mjs`（既定は dry-run。`jobs/<id>/job.json` があれば作成を二度と呼ばない）。鍵は `~/.config/carryme/minimax.env` から読み、値は書き出していない。
- LP 用の加工: 10秒の動画を前に再生してから逆に戻す往復にして（20秒）、つなぎ目を無くした。H.264、CRF 27、faststart。
- プロンプト（英語、最初の1コマの絵と一緒に送った）:
  - hero-desktop: Slow cinematic camera push-in. The clouds drift gently, sunset light rays shimmer, the four glowing floating panels bob softly and their light ribbons flow across the sky. The polar bear mascot keeps his pose with a subtle breathing motion and a small confident nod. City lights twinkle in the haze. Smooth, calm, loopable motion. No text.
  - hero-mobile: Slow cinematic camera push-in on a vertical frame. The clouds drift gently, light rays shimmer, the four glowing floating panels bob softly and trail light ribbons. The polar bear mascot keeps his pose with a subtle breathing motion. City lights twinkle below. Smooth, calm, loopable motion. No text.
  - finale: Colorful fireworks keep bursting and fading in the sky at the edges of the frame, sparkles fall slowly, the light ribbons swirl around the jumping polar bear mascot who floats gently up and down in mid-air with joy. City lights glow below. Smooth, festive, loopable motion. No text.

## システムの空間の絵と 2K の動画（2026-10-28）

本人の指示: 「2Kで動画を作成してクオリティをアップしてください」「背景がビルみたいな感じになってるんですが、もっとシステムっぽい感じでオシャレにしてください」。ビルの街の絵（scene-*）と 768P の動画は、ブランチから外した（元は `~/Code/sandbox/doya-lp-video/` に残す）。

| ファイル | 大きさ | 使う所 |
|---|---|---|
| `public/renewal-lp/sys-hero.webp` | 1536×1024 | ファーストビュー（横）。暗いデジタル空間、光の格子、操作盤の前のドヤくん、光の線でつながる4つの板 |
| `public/renewal-lp/sys-hero-portrait.webp` | 1024×1536 | ファーストビュー（縦、スマホ） |
| `public/renewal-lp/sys-finale.webp` | 1536×1024 | 最後の CTA（光の線とチェックの板の中で跳ぶドヤくん）。動画は作っていない |
| `public/renewal-lp/video/lp-sys-hero-desktop.mp4` | 1920×1270、20秒 | ファーストビュー（横）の背景動画 |
| `public/renewal-lp/video/lp-sys-hero-mobile.mp4` | 1080×1632、20秒 | ファーストビュー（縦）の背景動画 |

- 絵: Codex の内蔵の画像生成（定額）。参照は `hero`（ステッカー型のドヤくん）と `hello`・`point`。採用した版: 1回目。
- 動画: MiniMax 公式 API の `MiniMax-H3`、2K、10秒、最初の1コマに上の絵。task_id は sys-hero-2k 457092608184838、sys-hero-mobile-2k 457089813852536。往復の再生で20秒のループにし、横は幅1920、縦は幅1080に縮めた（CRF 26）。
- MiniMax を呼んだ回数の合計（10-27〜28）: 6回、見込み $6.54（上限 $6.80 の中）。768P×3 $2.52、2K のビルの絵×1 $1.34（指示の変更の前に受け付け済み。使っていない）、2K の新しい絵×2 $2.68。実際の請求額は MiniMax の管理画面で確かめる。
- 動きのプロンプト（2本共通）: Very slow cinematic camera push-in. Light pulses travel along the thin glowing network lines into the bright central node, the four floating glass panels gently bob and pulse with light, the glowing perspective grid floor lines glide slowly toward the viewer, fine particles drift, the holographic console flickers softly. The polar bear mascot keeps his pose with a subtle breathing motion and a small confident nod. Smooth, calm, premium, loopable motion. No text.

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 3 separate images and save them as PNG files with exactly these names: raw3/sys-hero.png (LANDSCAPE 3:2, 1536x1024), raw3/sys-hero-portrait.png (PORTRAIT 2:3, 1024x1536), raw3/sys-finale.png (LANDSCAPE 3:2, 1536x1024).

These are full-bleed key visuals for the landing page of "ドヤAI", a Japanese AI agent that runs work tools for marketing, sales, HR and back office. The mascot is the polar bear "Doya-kun". Draw Doya-kun exactly like the attached references (ref-hero-sticker.png for the line style and pose, ref-hello.png and ref-point.png for the face and outfit): white fluffy polar bear, round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens; the eyes are only glowing cyan shapes inside the lens), small black nose, open happy mouth, white hoodie with a blue </> symbol on the chest. Keep his bold thick navy comic outlines and flat colors so he looks like the same sticker character.

Art direction for ALL three (very important): NO city, NO buildings, NO skyline, NO sky, NO clouds, NO sunset. Instead a sleek, stylish, high-tech "AI system" space: a deep dark navy-to-black void (#050b24) with a subtle perspective grid floor of thin glowing cyan lines fading into the distance, floating translucent glassmorphism UI panels with soft blur showing only abstract shapes (bars, toggles, progress rings, node graphs, checkmarks), a glowing network of thin light lines and nodes connecting things, fine light particles, soft volumetric glow. Colors: electric blue #0066ff, cyan #00e0ff, violet #6a4cff and hot pink #ff1e72 as neon light and gradients, with a tiny touch of yellow #ffd400. Premium, minimal, cinematic, like a high-end SaaS product launch key visual (Apple / Linear / Vercel style), lots of dark negative space. Fine film grain. ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed).

1. raw3/sys-hero.png — Composition: the LEFT 55 percent of the frame is calm dark space with only the faint grid and a few soft particles (a big headline will be placed there). On the RIGHT side, Doya-kun stands confidently in front of a large curved holographic command console, full body, about 50 percent of the frame height, one paw pointing up and forward like a leader directing, the other paw holding a glowing tablet with four checkmark rows. Around him, four floating glass panels arranged in an arc, each glowing in one color (cyan, hot pink, yellow, violet) with one simple white line icon: a megaphone, a briefcase, a group of three people, a calculator. Thin glowing light lines connect the four panels to a bright central node near his tablet, like an AI orchestrating the departments. Rim light on Doya-kun in cyan and pink.

2. raw3/sys-hero-portrait.png — the same scene as image 1 recomposed vertically for a smartphone: Doya-kun, the console glow and the four connected panels in the UPPER 55 percent of the frame (bear centered slightly right, about 38 percent of the frame height); the LOWER 45 percent is calm dark space with the glowing perspective grid floor fading out, uncluttered, because headline text will be placed over it.

3. raw3/sys-finale.png — Composition: the TOP 50 percent of the frame is calm dark space with soft violet-to-blue glow, uncluttered in the upper center for a headline. In the lower center, Doya-kun jumps joyfully in the air, both arms raised, one paw making a thumbs up, about 35 percent of the frame height, above the glowing grid floor. Around him, a burst of light: many thin neon light lines and glowing nodes radiate outward like a network celebrating completion, with small floating glass panels showing checkmarks, in cyan, pink, violet and a little yellow.

Save all three files and then list the raw3/ folder.
```
