# ドヤ社内インタビュー 画像の記録

統合仕様 §12 に沿って作成。生成は **Codex の内蔵画像生成（ChatGPT の定額枠）**。
実行前に `~/.codex/auth.json` が `auth_mode=chatgpt`・API キー無しであることを確認し、`OPENAI_API_KEY` を渡さずに `codex exec -m gpt-5.6-sol -i <参照画像>` で実行した（API キーの従量課金は使っていない）。

- 生成日: 2026-10-18
- 参照画像: アイコンは `public/renewal/icons/interview.webp`、それ以外は `public/ui-renewal/mascots/interview.webp`（シロクマの画風合わせ）
- 書き出し: 元画像（PNG）を sharp で指定サイズの WebP（品質82、300KB以下）に変換。アイコンは角丸の外側を透過に切り抜き
- 作り直すときは、下のプロンプトの全文から始める
- `public/shanai/shots/1-input.webp`・`2-process.webp`・`3-output.webp` は LP（`components/lp/renewal`）が手順の画像として読む名前。中身は `step-1〜3.webp` と同じ

| ファイル | 大きさ | 使う場所 | 採用した版 |
|---|---|---|---|
| `public/renewal/icons/shanai.webp` | 256×256 | AppShell のサイドバー・⌘K・ホームのカード | 1回目 |
| `public/ui-renewal/mascots/shanai.webp` | 720×600 | ツールのトップ・ホームの提案カード | 1回目 |
| `public/shanai/hero.webp` | 1600×900 | LP のヒーロー・ツールのトップ | 1回目 |
| `public/shanai/step-1.webp` | 1200×800 | LP「3ステップ」・初回ガイド（会社URLの登録） | 2回目（1回目は赤・緑のアクセントが混ざり §12.1 の「1枚1色」に合わないため作り直し） |
| `public/shanai/step-2.webp` | 1200×800 | 同（録音・アンケート） | 1回目 |
| `public/shanai/step-3.webp` | 1200×800 | 同（記事とサムネの完成） | 1回目 |
| `public/shanai/empty-interviews.webp` | 640×480 | インタビュー一覧が空のとき | 1回目 |
| `public/shanai/working.webp` | 640×480 | 文字起こし・事実の抽出・記事生成の待ち | 1回目 |
| `public/shanai/answer-header.webp` | 2400×600 | 社員向け回答画面のヘッダー | 1回目 |
| `public/ogp/shanai.jpg` | 1200×630 | SNS 共有（OGP。既存の public/ogp/<id>.jpg の作りに合わせた） | 1回目 |

## プロンプト全文

各プロンプトの先頭に `Use your built-in image generation tool.`、末尾に `After saving, reply only with the file name.` を付けて実行した。

### icon（参照: interview のアイコン）

```
Create ONE image and save it as icon.png in the current directory. It is an app icon matching the attached reference icon's style exactly: rounded square, diagonal gradient from #0066ff (top-left) to #0047d6 (bottom-right), a single white line-art glyph centered with the same stroke width as the reference. Glyph: an ID badge / person card with a small speech bubble (employee interview). No text, no letters. Square 1024x1024.
```

### mascot（参照: ref-mascot.webp）

```
Create ONE image and save it as mascot.png. Match the attached reference mascot exactly in character design and render style: the DoyaAI polar bear (white fluffy body, blue goggles on the head, white hoodie with a "</>" mark), soft 3D render, smiling, front to 3/4 view, transparent or plain white background. Change only the props: the bear holds a small microphone in one hand and a clipboard with a photo card of a person in the other, as if interviewing a colleague. No text anywhere except the existing </> hoodie mark. Landscape 1440x1200.
```

### hero（参照: ref-mascot.webp）

```
Create ONE image and save it as hero.png. A bright key visual: white to very light blue (#f4f7fd) background with soft blue light glow gradients. In the center-right, a clean UI mockup of a web app showing an interview article editor: a left column with a portrait photo placeholder card, title bar, Q&A blocks with blurred grey placeholder lines (no readable text), and a small thumbnail image card. On the left side, the DoyaAI polar bear mascot from the reference (white body, blue goggles, white </> hoodie, soft 3D render, smiling) holding a microphone. One accent color only: blue (#0066ff). No readable text, no letters, no real people photos (use simple silhouettes). Wide 1600x900.
```

### step-1（参照: ref-mascot.webp）

採用版（2回目）:

```
Create ONE image and save it as step-1.png (overwrite). Illustration for step 1 'register company URL': bright clean scene, white background with soft blue glow. A browser window mockup showing a company website wireframe (header, hero block, cards) with a magnifier scanning it, and small cards flying out representing extracted facts (icons: flag, building, chart, heart). The DoyaAI polar bear mascot from the reference (white body, blue goggles, </> hoodie, soft 3D) small at the side, pointing. STRICT palette: only white, light blue and blue (#0066ff, #0047d6, #e8f0ff); every icon must be blue, no red, no green, no yellow. No readable text or letters. 1200x800.
```

1回目（不採用）:

```
Create ONE image and save it as step-1.png. Illustration for step 1 "register company URL": a bright, clean scene, white background with soft blue glow. A browser window mockup showing a company website wireframe (header, hero block, cards) with a magnifier scanning it, and small cards flying out representing extracted facts (icons: flag, building, chart, heart). The DoyaAI polar bear mascot from the reference (white body, blue goggles, </> hoodie, soft 3D) small at the side, pointing. Blue palette (#0066ff), no readable text or letters. 1200x800.
```

### step-2（参照: ref-mascot.webp）

```
Create ONE image and save it as step-2.png. Illustration for step 2 "upload a recording or send a survey": bright clean scene, white background with soft blue glow. Left: a smartphone showing an audio waveform with a microphone icon; right: a form card with several text fields and a send arrow; between them a few small photo cards of person silhouettes. The DoyaAI polar bear mascot from the reference (white body, blue goggles, </> hoodie, soft 3D) small, giving a thumbs up. Blue palette (#0066ff), no readable text or letters. 1200x800.
```

### step-3（参照: ref-mascot.webp）

```
Create ONE image and save it as step-3.png. Illustration for step 3 "article and thumbnail are ready": bright clean scene, white background with soft blue glow. A document page mockup with a header image card (person silhouette photo) and Q&A layout made of grey placeholder bars (no readable text), next to it a wide thumbnail card, and a download arrow badge. The DoyaAI polar bear mascot from the reference (white body, blue goggles, </> hoodie, soft 3D) small, cheering. Blue palette (#0066ff), no readable text or letters. 1200x800.
```

### empty-interviews（参照: ref-mascot.webp）

```
Create ONE image and save it as empty-interviews.png. Empty-state illustration, line art with pale blue fills (#e8f0ff) and blue lines (#0066ff), no background (plain white). An empty clipboard and a microphone on a desk, with a small friendly DoyaAI polar bear (simplified line-art version of the reference: white body, blue goggles) peeking from the side, smiling and curious (not sad). Minimal, airy. No text. 1280x960.
```

### working（参照: ref-mascot.webp）

```
Create ONE image and save it as working.png. Processing illustration, line art with pale blue fills (#e8f0ff) and blue lines (#0066ff), plain white background. A small friendly DoyaAI polar bear (simplified line-art version of the reference: white body, blue goggles) wearing headphones, typing on a laptop, with a sound waveform turning into document lines floating above. Cheerful, focused. No text. 1280x960.
```

### answer-header（参照: ref-mascot.webp）

```
Create ONE image and save it as answer-header.png. A calm, friendly wide header banner for an employee survey page: very light blue (#f4f7fd) to white background with soft blue glow on the right, simple abstract shapes (rounded speech bubbles, a pen, a notebook) in blue (#0066ff) and pale blue line art on the right third, left two-thirds mostly empty for HTML text overlay. Include a small DoyaAI polar bear (soft 3D, white body, blue goggles, </> hoodie) on the far right holding a pen, smiling. No text. Wide 2400x600.
```

### og（参照: ref-mascot.webp）

```
Create ONE image and save it as og.png. Social share image: bright white to light blue background with blue light glow, left half empty for text overlay later, right half shows the DoyaAI polar bear mascot from the reference (soft 3D, white body, blue goggles, </> hoodie) holding a microphone next to a floating article card mockup with a person silhouette photo and grey placeholder lines. One accent color: blue #0066ff. No readable text or letters. 1200x630.
```
