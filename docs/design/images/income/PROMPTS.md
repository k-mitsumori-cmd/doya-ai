# ドヤ収入管理（income）画像プロンプト集

- 生成日: 2026-10-18
- 生成手段: Codex CLI の内蔵画像生成（ChatGPT 定額枠）。`~/.codex/auth.json` の auth_mode=chatgpt・API キー無しを毎回確認し、`env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol ...`（config.toml 既定モデルは ChatGPT 枠で非対応のため -m で一時指定。設定は変更していない）で実行
- 参照画像はコマンドの `-i` で添付。参照元: `public/renewal/bear-hero.webp`、`public/ui-renewal/mascots/aio.webp`、`public/renewal/icons/{kintai,quote}.webp`（PNG に変換して添付）
- 後処理: sharp で所定サイズへ cover リサイズし WebP（品質88、各 300KB 以下）。画像内に文字なし
- 作り直すときは下記プロンプトから始める

## OGP（public/og/income.png）について

作成していない。このリポジトリの OGP は静的 JPG が `public/ogp/<id>.jpg`（`src/lib/ogp.ts` の `STATIC_OGP_IDS` に id を載せる方式）で、載っていない id は動的ルート `/og/[...slug]` にフォールバックする。`public/og/<svc>.png` という慣習は存在しない。必要なら `public/ogp/income.jpg`（1200×630）を別途作り、ogp.ts に `income` を足す。

## income.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/renewal/icons/income.webp`（256×256、透過、20KB） |
| 参照画像 | adimage.png, hr.png（public/renewal/icons の webp を PNG 化して `-i` で添付） |
| 生成日 | 2026-10-18 |
| 採用した版 | v3（1回目で採用。マゼンタ背景で生成し sharp でキーイング、暗背景でフリンジなしを確認） |

注: 先行の「青グラデ角丸四角」版は、仕様がシール風（白フチのシロクマ）に訂正されたため破棄した。実行は `cat prompt | codex exec -m gpt-5.6-sol -i ... -i ... -`（プロンプトは stdin。`-i` が可変長のため引数渡しだとプロンプトを飲み込む）。

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/icon-v3/raw1.png. A square tool-icon sticker on a perfectly flat solid pure magenta #ff00ff background (no shadow, no gradient; it will be keyed out). Subject: the ドヤAI polar bear mascot exactly like the attached reference images (adimage.png, hr.png): white fluffy bear, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D render, friendly smile, cute chibi proportions, upper body filling most of the canvas, holding ONE object in its hands: a white invoice sheet (folded top-right corner, gray bars as fake text lines) with a gold yen coin (a yen symbol as a symbol, not a letter) on it. The whole subject has a thick white die-cut sticker outline following the silhouette, with a thin blue edge line just inside like the references. Match the references closely in bear shape, goggle color, outline thickness, lighting and framing/scale. ABSOLUTELY NO text, letters or numerals anywhere (the yen symbol on the coin is the only glyph allowed).
```

## income.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/ui-renewal/mascots/income.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v2（v1は市松模様が焼き込まれ、胸が </> でなくひし形だったため不採用。v2はマゼンタ背景で生成し sharp で透過化） |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/mascot-v2.png. Mascot illustration, 6:5 landscape, perfectly flat solid pure magenta #ff00ff background (no shadow on the ground, no gradient, no checkerboard; it will be keyed out): the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile, standing in front-to-3/4 view, holding an invoice sheet (white paper with gray bars as fake text lines and a blue yen-sign badge) in one hand, and beside it a small rising bar chart (3 to 4 blue bars with an upward arrow) and two gold coins. The hoodie chest MUST show the white </> code symbol (not a diamond). Match the body shape and goggle color of the references. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## hero.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/hero.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1（1672×941 を 1600×900 に cover） |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/hero-v1.png. 16:9 hero key visual. Bright white to #f4f7fd background with a soft blue light gradient glow. Center-right: a clean SaaS revenue dashboard UI mock in a rounded window: 3 KPI tiles on top (each a tiny sparkline and gray bars as text), a monthly bar chart in blue, a small line chart. On the left foreground: the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile, 3/4 view, pointing to the dashboard. No photos, no people. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white. Use gray bars instead of any text in the UI mock.
```

## step-1.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/step-1.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/step-1-v1.png. 3:2 landscape illustration, white-to-#f4f7fd background with light blue accents, flat-modern-3D soft style. Step: registering a contract. A contract document with gray bars as text lines, a signature squiggle line and a blue seal stamp on the left, linked by a dotted arrow to a row of monthly calendar cards (12 small calendar tiles with only dots, no numbers) on the right. A small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile peeking in at the corner, holding a pen. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## step-2.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/step-2.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/step-2-v1.png. 3:2 landscape illustration, white-to-#f4f7fd background with light blue accents, flat-modern-3D soft style. Step: invoices generated automatically each month. A stack of invoice sheets (gray bars as text, blue yen badge) flying out of a blue calendar/laptop toward the right like paper airplanes, with motion lines and sparkles. A small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile on the left side cheering, operating the laptop. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## step-3.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/step-3.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/step-3-v1.png. 3:2 landscape illustration, white-to-#f4f7fd background with light blue accents, flat-modern-3D soft style. Step: a bank transfer payment arrives and is matched to an invoice. On the left a bank building icon with a stream of coins and a yen badge flowing along a dotted line to an invoice sheet on the right which gets a big green-free blue circular checkmark stamp. A small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile at the corner giving a thumbs up. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## empty-clients.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/empty-clients.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/empty-clients-v1.png. 4:3 landscape EMPTY-STATE illustration, line art with dark navy outlines and pale blue fills (#e8f0ff), plain white or transparent background with no scene background. Subject: a small office building with windows and next to it a blank business card / address card (gray bars only), plus a dotted outline suggesting an empty slot for adding a company. A very small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile peeks from a corner, smiling (never sad). Lots of whitespace, minimal. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## empty-contracts.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/empty-contracts.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/empty-contracts-v1.png. 4:3 landscape EMPTY-STATE illustration, line art with dark navy outlines and pale blue fills (#e8f0ff), plain white or transparent background with no scene background. Subject: a blank contract sheet (empty, with a few light gray bars) and a pen lying on it, with a dotted outline suggesting nothing is registered yet. A very small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile peeks from a corner, smiling (never sad). Lots of whitespace, minimal. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## empty-revenue.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/empty-revenue.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/empty-revenue-v1.png. 4:3 landscape EMPTY-STATE illustration, line art with dark navy outlines and pale blue fills (#e8f0ff), plain white or transparent background with no scene background. Subject: an empty calendar month grid (blank cells, no numbers, a blue header band) and a tiny empty bar chart outline with dashed bars. A very small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile peeks from a corner, smiling (never sad). Lots of whitespace, minimal. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## empty-invoices.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/empty-invoices.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/empty-invoices-v1.png. 4:3 landscape EMPTY-STATE illustration, line art with dark navy outlines and pale blue fills (#e8f0ff), plain white or transparent background with no scene background. Subject: a single blank invoice sheet with empty fields as light bars, a folded corner, and a dotted empty slot beside it. A very small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile peeks from a corner, smiling (never sad). Lots of whitespace, minimal. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## empty-payments.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/empty-payments.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/empty-payments-v1.png. 4:3 landscape EMPTY-STATE illustration, line art with dark navy outlines and pale blue fills (#e8f0ff), plain white or transparent background with no scene background. Subject: an empty open tray or wallet with a dotted coin outline floating above it, nothing inside. A very small the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile peeks from a corner, smiling (never sad). Lots of whitespace, minimal. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

## working.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/working.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/working-v1.png. 4:3 landscape processing/loading illustration, white or transparent background: the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile, sitting behind a desk calculating, with a blue calculator and a traditional abacus (soroban) in front, small sparkles and floating coin and gear shapes around, focused but happy expression. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white. No numbers on calculator (blank display with blue bars).
```

## invoice-sample.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/invoice-sample.webp` |
| 参照画像 | なし |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/invoice-v1.png. Portrait 3:4 flat top-down mockup of a clean professional A4 invoice document on a pale #f4f7fd background, drawn with ONLY layout blocks: blue header band with a small blue square logo placeholder, two address blocks as gray bars, a table with a blue header row and 5 rows of gray bars of varying length with columns, a totals box at lower right made of bars with a blue highlighted total bar, and a round blue seal at the bottom. Subtle shadow. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white. ABSOLUTELY no readable characters at all; every text line must be a plain gray rounded bar.
```

## paid-complete.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/income/paid-complete.webp` |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-18 |
| 採用した版 | v1 |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as /private/tmp/claude-501/income-img/raw/paid-v1.png. 4:3 landscape celebration illustration, white or transparent background: a large invoice sheet (gray bars as text lines) with a huge blue circular checkmark stamp, and the ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile cheering next to it with both arms raised, confetti and coins in blue and one accent color yellow #ffd400, sparkles. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```

