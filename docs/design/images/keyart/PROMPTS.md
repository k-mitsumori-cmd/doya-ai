# ツールのキービジュアル（keyart）

ツール画面の上の見出し（ToolHero）に出す絵です。左にドヤくん、右にツールの働きが一目で分かる大きな絵を置いています。

- 置き場所: `public/ui-renewal/keyart/<ツールのid>.webp`（22枚）
- 大きさ: 480×400（6:5）、背景は透過、WebP。22枚で約1.0MB
- 使う所: `src/components/ds/index.tsx` の `toolHeroArt()`。ここに無いツールは従来の `mascots/` を使う
- 作成日: 2026-10-23

## 作り方

1. Codex の内蔵の画像生成で1枚ずつ作った。ChatGPT の定額の枠で動かし、従量課金の API キーは使っていない（`env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol`、事前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` であることを確かめる）。
2. 参照画像は `bear-hero.png`・`icon-sample.png`・`expressions.png`（ドヤくんの見本と表情の決まり v2）の3枚。
3. 背景を真っ平らなマゼンタ（#ff00ff）で描かせ、sharp でその色を抜いて透過にした。
4. 480×400 に縮めて WebP で書き出した。

画像の中に文字・数字・ロゴを入れない決まりにしている。200×167 に縮めても読めるよう、細かい部品を避けた。

## 共通のプロンプト

```
Use your built-in image generation tool (not any API key, not a script) to generate ONE image and save it as raw/keyart-interview.png. A 6:5 landscape KEY ART illustration for a SaaS tool header, on a perfectly flat solid pure magenta #ff00ff background (no shadow on the ground, no gradient; it will be keyed out). Composition: on the left, the ドヤAI polar bear mascot "Doya-kun" exactly like the attached references (bear-hero.png, icon-sample.png): white fluffy body, blue visor goggles (#0066ff frame, cyan #00e0ff rim, dark navy lens) with glowing cyan eye lights inside the lens following expressions.png (cheerful ^ ^), white hoodie with a small white </> symbol on the chest, soft glossy 3D sticker render, about 40% of the width; on the right, <ツールごとの絵（下の表）>. Use large simple shapes, thick navy (#1b2a6b) outlines, white and blue (#0066ff, #e8f0ff) fills, at most one accent color (pink #ff1e72 OR yellow #ffd400). It must stay readable when shown at 200x167 pixels: no tiny details, no small UI screens, no fine lines. ABSOLUTELY NO text, letters, numerals, logos or watermarks anywhere (use simple bars or shapes where text would be).
```

## ツールごとの絵

| id | 目の光 | 右側の絵 |
|---|---|---|
| adimage | cheerful ^ ^ | three ad image cards of different sizes (square, wide, tall) fanned out with a sparkle — ad images in every size |
| aio | cheerful ^ ^ | a big search bar with a sparkle and an AI chat bubble showing a highlighted brand star — being seen in AI search |
| aishodan | cheerful ^ ^ | a headset and a laptop with two speech bubbles talking — practicing sales calls with AI voice |
| asklink | cheerful ^ ^ | a chain link connected to a speech bubble and a paper plane flying to a chat window — a link that sends a question to AI |
| banner | cheerful ^ ^ | a large blank banner board with a bold picture and a big button shape, plus a paint brush — making ad banners |
| doyalist | cheerful ^ ^ | a long list sheet of company rows with check marks and a magnifier — building a sales list |
| doyaslide | cheerful ^ ^ | a presentation screen on a stand showing a big chart and a title bar — making slides |
| expense | cheerful ^ ^ | a calendar with payment marks next to a wallet and coins going out — managing payments and expenses |
| hr | cheerful ^ ^ | an organization chart of person circles connected with lines and a star badge — managing people |
| income | cheerful ^ ^ | an invoice sheet with a gold yen coin and a rising bar chart — managing revenue and invoices |
| interview | cheerful ^ ^ | a big microphone emitting a sound wave that flows with an arrow into a clean article sheet (headline bar and a few paragraph bars) with a small photo frame — recording turns into an article draft |
| kintai | cheerful ^ ^ | a big round clock next to a time card with check marks — tracking attendance |
| mensetsu | cheerful ^ ^ | two chairs facing each other with a candidate card and a check badge — interviews for hiring |
| persona | cheerful ^ ^ | a large customer profile card with a face circle, a target and three trait chips — creating a customer persona |
| popup | cheerful ^ ^ | a website window with a friendly popup card in the corner and a pointer clicking it — popups on your site |
| promane | cheerful ^ ^ | a kanban board of three columns of cards and a progress bar — managing projects and profit |
| quote | cheerful ^ ^ | a quotation sheet with line items and a total bar plus a calculator — making a price quote |
| seo | cheerful ^ ^ | a big article sheet with a magnifier and a rising arrow chart — writing articles that rank in search |
| sfa | cheerful ^ ^ | a sales pipeline of three columns of deal cards moving right into a trophy — managing deals |
| shanai | cheerful ^ ^ | a company newsletter sheet with a photo of a smiling person silhouette and quote marks shape — employee interview articles |
| shodan | cheerful ^ ^ | a clipboard checklist next to a meeting table and a company building — preparing for a sales meeting |
| tenjikai | cheerful ^ ^ | a simple exhibition booth with a backdrop, a counter and a banner stand — preparing an exhibition booth |
