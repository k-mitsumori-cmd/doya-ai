# 作っている間の待ち画面のドヤくん（3枚）

作っている間の待ち画面（`src/components/shell/DoyaWorking.tsx`）に出す、ドヤくんの絵です（2026-10-29 ユーザーの指示「画像を作っている時の待ち時間も、クマちゃんが作っているような絵にして、遊び心を」）。

- 置き場所: `public/character/paint-a-512.webp`・`paint-b-512.webp`・`paint-done-512.webp`（透過の WebP、512×512。ほかのポーズと同じ名前の付け方。ドヤくんの共通部品 DoyaKun が使える）
- 作業中は paint-a と paint-b を入れ替えて、ローラーを上げ下げしているように見せる。できたときは paint-done（親指を立てる）に替える
- 壁の面は、絵に描かず、コード（SVG）で描く。ブランドの色に塗り替えるため

## 作り方

1. Codex CLI の内蔵の画像生成で作った。ChatGPT の定額の枠で動かし、従量課金の API キーは使っていない（`~/.codex/auth.json` の `auth_mode` が `chatgpt`。`env -u OPENAI_API_KEY` で実行）。
2. 参照画像は、経営ホームのドヤくん `public/character/working-512.webp`・`hello-512.webp`、展示会の `public/tenjikai/working.webp`、バナーのドヤくん `public/shell/bear/banner.webp`。顔・ゴーグル・胸の `</>` をそろえる基準にした。
3. 背景を真っ平らなマゼンタ（#ff00ff）で描かせ、`docs/design/images/shell-bear/tools/process.py` と同じ考え方で抜いた（白い縁取りは付けない。壁の前に置くため）。
4. 画像の中に文字が無いことを、目で確かめる。

## 依頼文

`bear-paint/prompt.md`（作業場所）の全文を、下に残す。

```text
Use your built-in image generation tool. Create the following 3 images, one image per file, and save each PNG in the current directory with exactly the file name given. Attached reference images: in/ref_working.png and in/ref_hello.png (the DoyaAI polar bear character in the series style), in/ref_tenjikai.png (the same bear in a calm empty-state illustration style), in/ref_banner.png (the bear painting at an easel).

Common rules for every image:
- The bear must match the references exactly: white fluffy body, blue goggles on the head showing happy "^ ^" eyes, white hoodie with a small "</>" mark on the chest, soft clean cartoon render with blue (#0066ff, #0047d6, #0a0f3c navy) accents. Always smiling, never sad.
- Background: perfectly flat solid magenta #ff00ff (so it can be removed). No shadow on the background, no floor, no props except the ones listed.
- No text, no letters, no numbers, no logos, no emoji. At most one tiny yellow #ffd400 sparkle.
- 3/4 view, the bear faces to the RIGHT of the image. Full body, with some empty margin around it. Square 1280x1280.

1. paint_a.png — the bear stands holding a long-handled paint roller with both hands, the roller extended forward to the right at chest height as if painting a tall wall that is outside the image. The roller has a plain light-blue paint on it. A small open blue paint bucket stands at its feet. Cheerful, working.
2. paint_b.png — same bear and same outfit and same roller, but the roller is raised higher to the upper right, the body leaning slightly forward and up on tiptoes as if painting the top of a wall. The paint bucket at its feet.
3. paint_done.png — the same bear stepping back, holding the roller down in one hand, the other hand giving a proud thumbs-up, big smile. The paint bucket at its feet. One tiny yellow sparkle near the head.

After saving all files, reply only with the list of file names.
```
