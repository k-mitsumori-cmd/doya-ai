# ドヤくんの成長の3段階と衣装（2026-10-24）

成長の段階ごとに衣装を変え、ひと目で見分けられるようにした（ドヤパワーの点検表 C3）。

| 段階 | 衣装 | ファイル |
|---|---|---|
| 見習い | パーカーに黄色い初心者の帽子、メモとえんぴつ | public/ui-renewal/mascots/growth-apprentice.webp |
| 一人前 | パーカーの上に紺のジャケット、社員証、ノートパソコン | public/ui-renewal/mascots/growth-pro.webp |
| 社長 | 紺のスーツとネクタイ、かばん（前のまま） | public/ui-renewal/mascots/growth-president.webp |

- 作り方: Codex の定額の画像生成（gpt-5.6-sol、ChatGPT ログイン）。従量の API は使っていない。
- マゼンタの背景で作り、sharp で透過にした。720x600 の WebP。
- 参考の絵: ドヤくんの見本（bear-hero・icon-sample・expressions）と、前の見習い・社長の絵。

## プロンプト（見習い）

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as raw/growth-apprentice-v2.png. Growth stage 1 "apprentice": Doya-kun wears the white hoodie with a small white </> symbol on the chest, plus a bright yellow #ffd400 beginner cap (a soft round cap with a small brim) on the head between the ears, holding a small notebook and pencil, eager smile, eye lights ^ ^. on a perfectly flat solid pure magenta #ff00ff background (no ground shadow, no gradient; it will be keyed out). Full body, front three-quarter view, same size, pose scale and soft glossy 3D sticker render as the attached growth-president.webp and growth-apprentice.webp, so the three growth stages line up as a set. The ドヤAI polar bear mascot Doya-kun exactly like the references: white fluffy bear, blue visor goggles (#0066ff frame, cyan #00e0ff rim, dark navy lens) with glowing cyan eye lights inside the lens following expressions.png. Brand colors only: #0066ff, #00e0ff, navy #0a1446, white, plus at most one accent. 720x600 landscape canvas, the bear centered and filling about 85% of the height. ABSOLUTELY NO text, letters, numerals, logos or watermarks.
```

## プロンプト（一人前）

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as raw/growth-regular-v2.png. Growth stage 2 "competent member": Doya-kun wears a smart navy #0a1446 short business jacket open over the white hoodie, with a blue lanyard and a white ID badge card (blank, no text) on the chest, holding a blue laptop under one arm and giving a confident thumbs up, eye lights confident ^ ^ with one small sparkle. Clearly more grown-up than the apprentice but more casual than the president suit. on a perfectly flat solid pure magenta #ff00ff background (no ground shadow, no gradient; it will be keyed out). Full body, front three-quarter view, same size, pose scale and soft glossy 3D sticker render as the attached growth-president.webp and growth-apprentice.webp, so the three growth stages line up as a set. The ドヤAI polar bear mascot Doya-kun exactly like the references: white fluffy bear, blue visor goggles (#0066ff frame, cyan #00e0ff rim, dark navy lens) with glowing cyan eye lights inside the lens following expressions.png. Brand colors only: #0066ff, #00e0ff, navy #0a1446, white, plus at most one accent. 720x600 landscape canvas, the bear centered and filling about 85% of the height. ABSOLUTELY NO text, letters, numerals, logos or watermarks.
```
