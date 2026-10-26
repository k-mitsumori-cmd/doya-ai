# 経営ホームの新しい体験のドヤくん（5ポーズ）

経営ホームの「ドヤくんに頼む」の演出（設計書 docs/architecture/management-agent/HOME-AGENT-EXPERIENCE-2026-10-25.md）で、足りなかったポーズです。

- 置き場所: `public/character/<名前>-512.webp`（run・throw・ponder・finish・launch）
- 大きさ: 512×512（表示の 256px の2倍）、背景は透過、WebP（品質88）。1枚 79〜100KB
- 使う場面: ponder＝考える、throw＝作戦の柱を出す、launch＝実行を始める、run＝実行中、finish＝完了の決めポーズ
- 作成日: 2026-10-25。採用した版: 1回目（5枚とも）

## 作り方

1. Codex CLI の内蔵の画像生成で、5枚を1回で作った。ChatGPT の定額の枠で動かし、従量課金の API キーは使っていない。
   - 事前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` で、API キーが無いことを確かめた。
   - 実行: `env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -i ref-thinking.png -i ref-success.png -i ref-point.png -`（プロンプトは stdin）
   - 既定のモデル（config.toml の gpt-6.1-sol）は、ChatGPT のアカウントでは使えずに止まった（400 model_not_found）。課金は発生していない。
2. 参照画像は、既存のドヤくんの絵 `public/character/thinking-512.webp`・`success-512.webp`・`point-512.webp` の3枚（コミックのステッカーの画風・ゴーグルの中だけが光る目・胸の `</>`）。
3. 背景を真っ平らなマゼンタ（#ff00ff）で描かせ、Pillow でマゼンタの度合いから透明度を決めて抜いた（縁のにじみも抑えた）。抜いたあとの縁に、マゼンタの点が残っていないことを数えて確かめた（5枚とも0）。
4. 余白を詰め、まわりに4%の余白を足して正方形にし、512×512 に縮めて WebP で書き出した。
5. 画像の中に文字が無いことを、目で確かめた（胸の `</>` だけ）。

## プロンプト（5枚とも、この1回で作った）

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate FIVE separate images and save them as PNG files in the folder raw/ with exactly these names: raw/run.png, raw/throw.png, raw/ponder.png, raw/finish.png, raw/launch.png.

Character and style for ALL five (match the attached references ref-thinking.png, ref-success.png, ref-point.png exactly):
- The ドヤAI polar bear mascot "Doya-kun": white fluffy polar bear, wide blue visor goggles (blue frame, cyan rim, dark navy lens), the eyes are ONLY glowing cyan shapes inside the goggle lens (no visible pupils outside the lens), white hoodie with a blue </> symbol on the chest.
- The same comic sticker illustration style as the references: bold navy outlines, blue halftone dots, small blue code-bracket and gear doodles around, a little yellow and pink accent.
- Full body or three-quarter body, centered, filling about 80% of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and its doodles (no gradient, no shadow on the background, no floor). It will be keyed out, so do not use magenta or pink-purple on the character itself.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed).

Poses:
1. raw/run.png — running fast to the right with big strides, speed lines behind, one paw forward, determined happy eyes (glowing ^ ^ arcs).
2. raw/throw.png — throwing a fan of small blank rectangular task cards (white cards with a blue edge, no writing on them) up and outward with both paws, cards flying in an arc, excited eyes.
3. raw/ponder.png — deep in thought, sitting cross-legged, one paw on the chin, the other holding a small blank card, a few floating question-mark-free sparkles and gears above the head, focused eyes (glowing straight lines).
4. raw/finish.png — triumphant signature pose: standing tall, one fist raised high, the other paw giving a thumbs up, small burst of stars and confetti shapes around, proud eyes (glowing ^ ^ arcs).
5. raw/launch.png — sending work off: both paws pushing forward a small paper airplane and a stack of blank cards that fly away to the upper right with motion trails, cheerful eyes.

Save the five files and then list the raw/ folder.
```
