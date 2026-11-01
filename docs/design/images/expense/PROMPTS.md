# ドヤ支出管理 画像プロンプト記録（ADDON-SERVICES §12.3）

## 共通事項

- 生成日: 2026-10-18
- 生成手段: Codex 内蔵画像生成（`codex exec`、ChatGPT 定額枠）。OpenAI Images API / Gemini / fal / Higgsfield など従量課金 API は未使用
- 課金確認（毎回の実行前に実施）: `~/.codex/auth.json` が `auth_mode=chatgpt` かつ `OPENAI_API_KEY` なし、であることを python で assert。実行は `env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -C <scratch> -i <参照> -`（プロンプトは標準入力）。Codex の設定ファイルは変更していない
- モデル指定について: 既定の `gpt-6.1-sol` と `gpt-5.5` は「ChatGPT アカウントでは未対応」で 400 エラーになったため（画像は生成されず課金なし）、`~/.codex/models_cache.json` に載っている `gpt-5.6-sol` を `-m` で指定した（設定ファイルは未変更）
- 各プロンプトの末尾に自動で付けた文: `Save the generated image file as ./out/<name>.png (PNG). Do not write any text, letters or numbers inside the image.`
- 参照画像（スクラッチ `/private/tmp/claude-501/expense-images/ref/`）: `bear-hero.png`=`public/renewal/bear-hero.webp`、`mascot-sfa.png`=`~/Code/09_Cursol-ui-renewal/public/ui-renewal/mascots/sfa.webp`、`icon-sfa.png`=`public/renewal/icons/sfa.webp`、`icon-quote.png`=`public/renewal/icons/quote.webp`、`empty-style.png`=本件 `empty-payables`（空状態の画風そろえ用）
- 後処理: sharp で書き出し（WebP、cover リサイズ、300KB 以下）。マスコットとアイコンは生成物の外側の白を端から塗りつぶして透過化（フォールバックの白背景を使用）
- 作り直すときは同じプロンプトから始める
- OGP（`public/og/expense.png`）: このブランチに `public/og` の規約は無く、既存サービスは `src/app/<svc>/opengraph-image.tsx`（next/og）で動的生成しているため、画像ファイルは作らずスキップ。必要なら expense 用の `opengraph-image.tsx` を担当が追加する
- 採用版はすべて表中の版。ファイル数 11、有効な生成実行 12 回（step-2 のみ 2 回）

### 空状態・処理中の共通スタイル文（下の `{STYLE_A}` / `{STYLE_B}`）

- STYLE_A（empty-payables / empty-contracts）: `Style: flat line-art illustration with consistent medium navy-blue (#0047d6) outline stroke and pale blue (#e8f0ff) fills, plain pure white background with no shadows, no gradients, 4:3 landscape (640x480 proportion). A small cute polar bear (white body, blue goggles on forehead or face, white hoodie with a small blue </> mark) in the same simplified line-art style, smiling happily and calm, never sad. Generous empty space around. One small pink (#ff1e72) accent only. Absolutely no letters, numbers or text, no photos.`
- STYLE_B（empty-contractors / empty-calendar）: `Style: match the second reference image exactly (flat line-art illustration with consistent medium navy-blue (#0047d6) outline stroke and pale blue (#e8f0ff) fills, plain pure white background, no shadows, no gradients, 4:3 landscape 640x480 proportion). A small cute polar bear (white body, blue goggles, white hoodie with small blue </> mark) in the same simplified line-art style, smiling happily, never sad. Generous empty space. One small pink (#ff1e72) accent only. Absolutely no letters, numbers or text, no photos.`

## 1. public/renewal/icons/expense.webp（256x256、ステッカー外側は透過）

- 経緯: 当初はグラデーションの角丸正方形アイコン（icon_a1）で作ったが、§12.1 の訂正（既存アイコンの多数派であるシロクマのステッカー型にそろえる）により差し替えた。旧版は不採用
- プロンプト: `Use your image generation tool to create a tool icon in the polar-bear STICKER style of the two reference images (adimage and hr icons): the DoyaAI polar bear (white body, blue goggles with happy eyes, white hoodie with blue </> mark) shown from the chest/waist up, smiling, holding exactly ONE object representing the tool: a blue leather wallet with a small calendar badge on it. Sticker cut-out look: a thick clean white outline border around the whole silhouette, flat simple blue/navy outlined cartoon rendering matching the references, on a plain pure white background, centered with margin, square 1024x1024. No text, no letters, no numbers, no other props, no background shapes.`
- 参照画像: public/renewal/icons/adimage.webp, public/renewal/icons/hr.webp
- 生成日: 2026-10-18 / 採用版: 1 回目（icon_b1、外側の白を後処理で透過）/ 生成手段: Codex 内蔵画像生成、auth_mode=chatgpt、APIキーなし（実行前に再確認済み）

## 2. public/ui-renewal/mascots/expense.webp（720x600、透過）

- プロンプト: `Use your image generation tool to create a mascot illustration of the same polar bear character as the first reference image (soft 3D render, white body, glowing blue goggles with happy ^ ^ eyes, white hoodie with a blue </> mark, navy accents), front to 3/4 view, smiling, full body, on a fully transparent background (if transparency is unsupported use a flat pure white background). This time the bear holds a blue leather wallet in one hand and a small wall calendar page with a highlighted payment date mark in the other, with a small stack of gold coins at its feet and one small receipt slip. No other background elements. Landscape canvas about 720x600 proportion. Only blue/white palette plus one yellow (#ffd400) accent on the coins.`
- 参照画像: bear-hero.png, mascot-sfa.png
- 生成日: 2026-10-18 / 採用版: 1 回目（mascot_a1、透過は後処理）/ 生成手段: 同上

## 3. public/expense/hero.webp（1600x900）

- プロンプト: `Use your image generation tool to create a wide 16:9 hero key visual (1600x900 proportion). Bright clean white-to-#f4f7fd background with soft blue light gradients and gentle glow. Right side: the same polar bear mascot as the reference (soft 3D, white body, blue goggles, white hoodie with blue </>), smiling, 3/4 view, holding a small blue wallet. Left/center: a large floating app UI mock window in clean flat style with rounded corners showing a payment schedule list (rows as abstract gray-blue bars with small round status dots and tiny pill tags, NO real text) and a monthly bar chart of 12 blue bars of varying height; one small yellow (#ffd400) accent only (a few coins). No photos, no people, no text, no letters, no numbers anywhere. Everything else in blue/white.`
- 参照画像: bear-hero.png, mascot-sfa.png / 採用版: 1 回目（hero_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 4. public/expense/step-1.webp（1200x800）契約の登録

- プロンプト: `Use your image generation tool to create a 3:2 landscape illustration (1200x800 proportion) for step 1 'register contracts'. The same polar bear mascot as the reference (soft 3D render, white body, blue goggles, white hoodie with blue </>), smiling, placing three document cards onto a board/tray: card 1 with a small cloud/app-window icon (SaaS), card 2 with a small handshake or wrench icon (contractor), card 3 with a small house/building icon (rent). Cards are white rounded sheets with blue accent line bars, no text. Background bright white to #f4f7fd with soft blue glow. One yellow (#ffd400) accent only (a small coin or highlight). Absolutely no letters, numbers or text. No photos.`
- 参照画像: bear-hero.png, mascot-sfa.png / 採用版: 1 回目（step1_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 5. public/expense/step-2.webp（1200x800）12 か月の支払予定

- 1 回目（不採用: カレンダーでなく人物アイコンのカードになった）: `Use your image generation tool to create a 3:2 landscape illustration (1200x800 proportion) for step 2 '12 months of payment schedule automatically lined up'. A wide clean calendar/timeline strip with 12 month tiles arranged in two rows of six (or one horizontal timeline), each tile a rounded white card with a small blue dot/bar marker showing a payment, with a glowing blue sweep/sparkle suggesting automation filling them in, and the same polar bear mascot as the reference (soft 3D, white body, blue goggles, white hoodie with blue </>) smiling at the corner pointing at the timeline. Background bright white to #f4f7fd with soft blue gradients. One cyan (#00e0ff) accent only. Absolutely no letters, numbers or text. No photos.`
- 2 回目（採用）: `Use your image generation tool to create a 3:2 landscape illustration (1200x800 proportion) for '12 months of payment schedule automatically lined up on a calendar'. Show ONE large calendar-style panel with a top header strip with two binder rings, containing a grid of 12 month cells (3 rows by 4 columns). Each cell is a pale blue rounded tile with a small blue coin or a short blue bar marker (a payment) and some cells with a tiny blue check mark; NO people or user/avatar icons anywhere. A soft glowing blue sweep with sparkles passes across the grid to suggest automatic filling. The same polar bear mascot as the reference (soft 3D, white body, blue goggles, white hoodie with blue </>) stands at the left smiling and gesturing toward the calendar. Background bright white to #f4f7fd with soft blue gradients. One cyan (#00e0ff) accent only. Absolutely no letters, numbers or text. No photos.`
- 参照画像: bear-hero.png, mascot-sfa.png / 採用版: 2 回目（step2_a2）/ 生成日: 2026-10-18 / 生成手段: 同上

## 6. public/expense/step-3.webp（1200x800）外注先の管理

- プロンプト: `Use your image generation tool to create a 3:2 landscape illustration (1200x800 proportion) for 'managing contractors: invoice received, approve, paid'. A left-to-right flow of three stages connected by blue arrows: (1) an envelope/invoice sheet arriving (document with an arrow coming in), (2) the same sheet with a large blue check-mark stamp (approve), (3) a wallet or coin stack with a green-free blue check badge (paid). The same polar bear mascot as the reference (soft 3D, white body, blue goggles, white hoodie with blue </>) smiling and giving a thumbs-up at the right or bottom corner. Background bright white to #f4f7fd with soft blue gradients, soft 3D style matching the reference. One yellow (#ffd400) accent only (coins). Absolutely no letters, numbers, text, or people/avatar icons. No photos.`
- 参照画像: bear-hero.png, mascot-sfa.png / 採用版: 1 回目（step3_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 7. public/expense/empty-payables.webp（640x480）今月の支払予定なし

- プロンプト: `Use your image generation tool to create an empty-state illustration: 'no payments scheduled this month'. A tidy empty tray/inbox with a blank calendar page beside it and a little bear sitting relaxed holding a small flag or waving. {STYLE_A}`
- 参照画像: mascot-sfa.png / 採用版: 1 回目（empty-payables_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 8. public/expense/empty-contracts.webp（640x480）支出契約なし

- プロンプト: `Use your image generation tool to create an empty-state illustration: 'no expense contracts registered yet'. An empty folder / blank contract sheet with a dotted outline and a plus sign badge, and a small bear peeking over it, inviting. {STYLE_A}`
- 参照画像: mascot-sfa.png / 採用版: 1 回目（empty-contracts_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 9. public/expense/empty-contractors.webp（640x480）外注先なし

- プロンプト: `Use your image generation tool to create an empty-state illustration: 'no contractors (business partners) registered yet'. An empty address-card holder / blank business-card slots with dotted outlines and a small plus badge, a bear holding one blank card, no person/avatar silhouettes. {STYLE_B}`
- 参照画像: mascot-sfa.png, empty-style.png（= empty-payables）/ 採用版: 1 回目（empty-contractors_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 10. public/expense/empty-calendar.webp（640x480）支払カレンダーの空状態（§12.2 の支出管理の追加分）

- プロンプト: `Use your image generation tool to create an empty-state illustration: 'payment calendar is empty'. A large blank monthly calendar grid with binder rings, all cells empty and light, a small coin icon outline in one corner, and the bear sitting on top of the calendar edge waving cheerfully. {STYLE_B}`
- 参照画像: mascot-sfa.png, empty-style.png / 採用版: 1 回目（empty-calendar_a1）/ 生成日: 2026-10-18 / 生成手段: 同上

## 11. public/expense/working.webp（640x480）処理中

- プロンプト: `Use your image generation tool to create a 'processing / working' illustration, 4:3 landscape (640x480 proportion), matching the style of the second reference image (flat line-art, medium navy-blue #0047d6 outline, pale blue #e8f0ff fills, plain pure white background, no shadows). A small cute polar bear (white body, blue goggles, white hoodie with blue </> mark), smiling and focused, sitting at a small desk with a laptop, with a few documents/receipts floating up into a loop of circular arrows and small sparkles suggesting processing, plus a tiny coin. Not sad. One small cyan (#00e0ff) accent only. Absolutely no letters, numbers or text, no photos.`
- 参照画像: mascot-sfa.png, empty-style.png / 採用版: 1 回目（working_a1）/ 生成日: 2026-10-18 / 生成手段: 同上
