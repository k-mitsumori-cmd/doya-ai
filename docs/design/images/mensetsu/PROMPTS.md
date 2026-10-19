# mensetsu 画像プロンプト集

- 生成手段: Codex CLI の内蔵画像生成（ChatGPT 定額枠）。`~/.codex/auth.json` の auth_mode=chatgpt・API キー無しを毎回確認し、`env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol -i ref/bear-hero.png -i ref/aio.png -`（プロンプトは stdin）で実行
- 参照画像: `public/renewal/bear-hero.webp`、`public/ui-renewal/mascots/aio.webp`（PNG に変換して添付）
- 後処理: sharp で 640×480 に contain（白い余白で 4:3 にそろえる。切り抜かない）、WebP 品質88
- 画風: ADDON-SERVICES-2026-10-18.md §12.1 の「空状態のイラスト」。画像の中に文字なし
- 作り直すときは下記プロンプトから始める

## empty-interviews.webp

| 項目 | 内容 |
|---|---|
| ファイル名 | `public/mensetsu/empty-interviews.webp`（640×480） |
| 参照画像 | bear-hero.png, aio.png |
| 生成日 | 2026-10-19 |
| 採用した版 | v1（1回目で採用） |

プロンプト全文:

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as raw/mensetsu-empty-v1.png. 4:3 landscape EMPTY-STATE illustration, line art with dark navy outlines and pale blue fills (#e8f0ff), plain white background with no scene background. Subject: an empty interview setting: two simple chairs facing each other across a small table with a blank candidate profile card (empty photo circle and light bars) lying on it. A very small ドヤAI polar bear mascot exactly like the attached reference images (bear-hero.png, aio.png): white fluffy body, blue visor goggles, white hoodie with a small </> symbol on the chest, soft glossy 3D sticker-like render with a thin outline, friendly smile, peeks from a corner, smiling (never sad). Lots of whitespace, minimal, centered composition with generous margins so it can be cropped to 4:3. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere in the image (use plain gray or blue bars/shapes where text would be). At most one accent color (pink #ff1e72 OR yellow #ffd400 OR cyan #00e0ff) besides blue/white.
```
