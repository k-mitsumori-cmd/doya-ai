# ドヤ展示会の画像（統合仕様 ADDON-SERVICES-2026-10-18 §12）

- 生成日: 2026-10-18
- 手段: Codex の内蔵画像生成（`codex exec -m gpt-5.6-sol`、ChatGPT の定額枠）。実行前に `~/.codex/auth.json` が `auth_mode=chatgpt`・API キー無しであることを確かめた。`OPENAI_API_KEY` は渡していない（`env -u OPENAI_API_KEY`）。従量課金の画像 API は使っていない
- 書き出し: sharp で指定の大きさに縮小し、中央で切り出して WebP にした（品質86、各300KB以下）。アイコンは角丸の外側を透過にした。OGP は既存の `public/ogp/<id>.jpg` に合わせて JPEG にした
- 作り直すときは、下の「依頼文の全文」から始める

## 一覧

| 置き場所 | 大きさ | 依頼文の番号 | 採用した版 | 使うところ |
| --- | --- | --- | --- | --- |
| `public/renewal/icons/tenjikai.webp` | 256×256 | 1（icon.png） | 1版目 | AppShell のサイドバー・⌘K・ホームのカード |
| `public/ui-renewal/mascots/tenjikai.webp` | 720×600 | 2（mascot.png） | 1版目 | ツールのトップ（入力画面の左）・ホームの提案カード |
| `public/tenjikai/hero.webp` | 1600×900 | 3（hero.png） | 1版目 | 公開 LP のヒーロー・ツールのトップ |
| `public/tenjikai/step-1.webp` | 1200×800 | 4 | 1版目 | LP の使い方・初回ガイド（URLと条件を入れる） |
| `public/tenjikai/step-2.webp` | 1200×800 | 5 | 1版目 | 同（ブース案と制作物の提案） |
| `public/tenjikai/step-3.webp` | 1200×800 | 6 | 1版目 | 同（発注と締切の管理） |
| `public/tenjikai/empty-projects.webp` | 640×480 | 7 | 1版目 | 出展プロジェクトの一覧が空のとき |
| `public/tenjikai/working.webp` | 640×480 | 8 | 1版目 | 準備一式を作っている間（処理中の画面） |
| `public/tenjikai/booth-sample.webp` | 1200×900 | 9 | 1版目 | ブース設計で、完成予想図がまだ無いときの見本 |
| `public/tenjikai/empty-venue-map.webp` | 640×480 | 10 | 1版目 | 資料庫・締切で、主催者の資料（会場図など）がまだ無いとき |
| `public/ogp/tenjikai.jpg` | 1200×630 | 11（ogp.png） | 1版目（文言3つを目で見て一字ずつ確かめた） | SNS 共有。`src/lib/ogp.ts` の `STATIC_OGP_IDS` |

- §12.1 の画風との照合: クマの体型・青いゴーグル・パーカー胸の `</>` は `public/renewal/bear-hero.webp` と、既存のマスコットに合わせた。主色は青で、アクセントは1枚1色まで（黄の小さな光）。1〜10 には文字が無い
- マスコットは透過ではなく白背景で作った。白い面に置く前提で使う

## 参照画像（Codex に `-i` で渡したもの）

| 名前 | 元 |
| --- | --- |
| `in/bear.png` | `public/renewal/bear-hero.webp`（シリーズのクマ） |
| `in/mascot_ref.png` | `public/ui-renewal/mascots/adimage.webp`（ui-renewal ブランチ。マスコットの画風の見本） |
| `in/icon_ref.png` | `public/renewal/icons/asklink.webp`（アイコンの型） |
| `in/ogp_layout_ref.png` | `public/ogp/asklink.jpg`（採用済みの OGP の型） |
| `in/empty_ref.png` | `public/empty/zero.svg`（空状態の画風の見本） |

## 実行したコマンド

```bash
env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -C <作業フォルダ> \
  -i in/bear.png -i in/mascot_ref.png -i in/icon_ref.png -i in/ogp_layout_ref.png -i in/empty_ref.png - < prompt.md
```

## 依頼文の全文

```text
Use your built-in image generation tool. Create the following 11 images, one image per file, and save each PNG in the current directory with exactly the file name given. Attached reference images: in/bear.png (the DoyaAI polar bear character), in/mascot_ref.png (mascot render style), in/icon_ref.png (app icon style), in/ogp_layout_ref.png (OGP card layout), in/empty_ref.png (empty-state illustration style).

Common rules for every image:
- Series style: bright white to very light blue (#f4f7fd) background, brand blue #0066ff with deep blue #0047d6 and navy #0a0f3c. At most ONE accent color per image, used only for a small highlight: yellow #ffd400.
- No text, no letters, no numbers, no logos in the images (except the "</>" mark on the bear's hoodie, and except image 11 which is the OGP card). No emoji. No photographs of real people.
- The bear must match in/bear.png and in/mascot_ref.png exactly: white fluffy body, blue goggles on the head, white hoodie with a "</>" mark, soft 3D render, smiling. Never sad.
- Theme of the tool: "Doya Tenjikai" helps a company prepare for a trade-show exhibition: booth layout, printed graphics, novelty goods, budget, vendors and deadlines.

1. icon.png — 1024x1024. App icon matching in/icon_ref.png exactly: rounded square, diagonal gradient #0066ff (top-left) to #0047d6 (bottom-right), one white line-art glyph centered with the same stroke width as the reference. Glyph: a small isometric exhibition booth (a back wall with a counter in front). No text.
2. mascot.png — 1440x1200. The bear standing next to a small trade-show booth model, holding a stack of business cards in one hand and pointing at the booth with the other. Plain white background. Front to 3/4 view.
3. hero.png — 1600x900. Key visual: a clean exhibition hall scene rendered in soft 3D, a modern booth in blue and white in the center, next to it a floating UI mockup card showing an isometric booth plan and a simple budget bar chart (shapes only, no text). The bear stands at the booth counter, welcoming. Blue light gradients, bright and airy.
4. step-1.png — 1200x800. Step 1 (enter your service URL and exhibition conditions): a UI mockup of a form with a URL field, a calendar, and a small grid of booth squares being selected; the bear typing on a laptop. Shapes only, no text.
5. step-2.png — 1200x800. Step 2 (the AI proposes booth layouts and graphics): three isometric booth layout cards side by side, one highlighted with a blue outline; small printed items (roll-up banner, flyer, clear file) floating nearby. The bear presenting them.
6. step-3.png — 1200x800. Step 3 (order and manage deadlines): a vendor comparison card list and a timeline with check marks leading to an event day flag; the bear holding a checklist clipboard.
7. empty-projects.png — 1280x960. Empty-state illustration matching in/empty_ref.png style: line art plus pale blue fills (#e8f0ff), no background. An empty booth floor plan grid with a small "+" shaped marker, and the small bear peeking from the side, smiling.
8. working.png — 1280x960. Processing illustration in the same empty-state style: the small bear assembling a booth model with blocks, a blueprint unrolled, small sparkles in blue. Calm, cheerful.
9. booth-sample.png — 1600x1200. A finished trade-show booth example, soft 3D render (not photographic): 3m x 3m booth with a large blue back-wall graphic (abstract shapes only, no text), a reception counter, a monitor showing an abstract chart, a roll-up banner, carpet, ceiling lights. Viewed from the aisle at a 3/4 angle. No people except optionally the bear at the counter.
10. empty-venue-map.png — 1280x960. Empty-state illustration in the same style as image 7: a simple top-down exhibition hall map in line art with empty booth rectangles and aisles, pale blue fills, a small map pin, the small bear holding a folded map. No text.
11. ogp.png — 1200x630. OGP card following the layout of in/ogp_layout_ref.png (same composition, same typography style, same placement of the bear and the brand area), but for this tool: main title in Japanese 「ドヤ展示会」, sub copy in Japanese 「URLを入れるだけで、展示会の準備を一式そろえる」, and the small brand label 「ドヤAI」. Use the booth scene and the bear from the hero. Japanese characters must be exactly as given.

After saving all files, reply only with the list of file names.
```
