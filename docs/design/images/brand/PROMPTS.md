# ドヤAI ロゴの記号（2026-10-24）

ユーザーが4案から「案A 青い角丸」を選んだ。

- 作り方: Codex の定額の画像生成（gpt-5.6-sol、ChatGPT ログイン）。従量の API は使っていない。
- マゼンタの背景で作り、sharp で透過にした。「ドヤAI」の文字は画像に描かず、フォントで組む。
- 参考の絵: ドヤくんの見本（bear-hero.png・icon-sample.png・expressions.png）
- 4案の比較: logo-candidates-2026-10-24.png
- 書き出し: public/brand/doya-logo-mark-{64,128,256,512}.{png,webp}（透過）、public/icon-{192,512,1024}.png と public/brand/apple-icon-180.png・favicon-48.png（青い地に敷いたもの）

## 案Aのプロンプト

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE 1:1 square image and save it as raw/logo-a.png. Design A, "refined flat app icon": a rounded-square tile filled with #0066ff (the tile itself sits on the magenta background), with the bear head in white and navy flat vector style, goggles with confident smug "doya" eye lights (a cyan ^ ^ with a small sparkle), a tiny proud smile. Premium, like a top App Store icon. on a perfectly flat solid pure magenta #ff00ff background (no shadow, no gradient in the background; it will be keyed out). It is a LOGO MARK for the Japanese AI SaaS brand "ドヤAI", based on the polar bear mascot Doya-kun in the attached references (white bear, blue visor goggles with #0066ff frame, cyan #00e0ff rim, dark navy #0a1446 lens, cyan glowing eye lights inside the lens). It will be shown as small as 28x28 pixels in a web header and as 512px app icon, so: bold simple shapes, strong silhouette, perfectly symmetric, crisp vector-like edges, no tiny details, no thin lines, no texture, no gradients except one subtle highlight. Brand colors only: #0066ff blue, #00e0ff cyan, #0a1446 navy, white. Centered, the mark fills about 80% of the square canvas. ABSOLUTELY NO text, letters, numerals or watermarks.
```
