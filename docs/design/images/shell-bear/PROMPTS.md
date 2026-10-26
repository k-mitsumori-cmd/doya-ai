# 左のメニューのツールのアイコン（ドヤくんの行動の絵・23枚）

左のメニュー（経営ホームの下に並ぶツール）のアイコンです。ドヤくんが、ツールに合った行動をしています（2026-10-26 ユーザーの指示）。

- 置き場所: `public/shell/bear/<ツールid>.webp`。出すのは `src/components/shell/ToolBearIcon.tsx`（絵の無いツールは今までの lucide のアイコン）
- 大きさ: 128×128（表示は 32px）、背景は透過、白い縁取りのステッカー型、WebP（品質90）。1枚 約9〜11KB
- `public/renewal/icons/`（LP とトップのサービス一覧の絵）とは別の絵です。そちらは変えていません
- 作成日: 2026-10-26。採用した版: 1回目

## 作り方

1. Codex CLI の内蔵の画像生成で作った。ChatGPT の定額の枠で動かし、従量課金の API キーは使っていない。
   - 事前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` で、API キーが無いことを確かめた。
   - 実行: `env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -i ref-hello.png -i ref-point.png -i ref-working.png -`（プロンプトは stdin）。6枚ずつ4回。
2. 参照画像は、経営ホームのドヤくん `public/character/hello-512.webp`・`point-512.webp`・`working-512.webp`。顔・ゴーグル・胸の `</>` をそろえる基準にした。
3. 小さく出しても分かるように、背景の飾りを描かせず、クマと道具1つだけにし、線を太くした。
4. 背景を真っ平らなマゼンタ（#ff00ff）で描かせ、`tools/process.py` で抜いた。余白を詰め、白い縁取りとごく薄い紺の外側の線を足して、128×128 に縮めた。残ったマゼンタの点は全枚0。
5. 画像の中に文字が無いことを、目で確かめた（胸の `</>` だけ）。

プロンプトは `tools/make_prompt.py` が `tools/items.json`（ツールごとの行動）から作る。共通の部分と行動の一覧は次のとおり。

## ツールごとの行動

| id | ツール | 行動 |
|---|---|---|
| aio | AIO | 双眼鏡でAIの吹き出しをのぞく |
| seo | 記事作成 | 大きな鉛筆で原稿を書く |
| banner | バナー | 筆でキャンバスに描く |
| adimage | 広告画像 | メガホンで呼びかける |
| persona | ペルソナ | 人物のカードを手に取って見つめる |
| interview | インタビュー | マイクを差し出して取材する |
| asklink | AI質問リンク | 鎖の輪をつなぐ |
| popup | ポップアップ | 画面から飛び出す小窓を受け止める |
| tenjikai | 展示会 | ブースの前で旗を振る |
| sfa | 営業管理 | ボードのカードを動かす |
| shodan | 商談準備 | 虫めがねでビルを調べる |
| aishodan | AI商談 | ヘッドセットで話す |
| cunning | カンニング | ヘッドホンに手を当てて聞き取る |
| doyalist | リスト | 長いリストにチェックを入れる |
| doyaslide | スライド | 指し棒でスライドを説明する |
| hr | 人事 | 組織図を指さす |
| mensetsu | 面接官 | 机に座りクリップボードに書く |
| shanai | 社内インタビュー | カメラで写真を撮る |
| kintai | 勤怠 | タイムカードを押す |
| quote | 見積 | 電卓を打つ |
| promane | プロマネ | 予定の板に付箋を貼る |
| income | 収入 | 貯金箱にコインを入れる |
| expense | 支出 | 財布からお札を出す |

## プロンプト（1回目の6枚の例。ほかの回は Images の行だけが違う）

```
Use your built-in image generation tool (not any API key, not a script, no network calls) to generate 6 separate images and save them as PNG files in the folder raw/ with exactly these names: raw/aio.png, raw/seo.png, raw/banner.png, raw/adimage.png, raw/persona.png, raw/interview.png.

These are small APP MENU ICONS (shown at 32-40px) of the ドヤAI polar bear mascot "Doya-kun". Character for ALL images (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style for ALL images (keep identical across the set):
- Same comic sticker illustration as the references but SIMPLIFIED for small size: bold thick navy outlines (about 3x thicker than the references), flat colors with only light blue shading, NO halftone dots, NO background doodles, NO code windows, NO clouds, NO gears, NO sparkles.
- Only the bear plus the ONE prop described, nothing else. The bear's head is large (chibi proportions, head about 45 percent of the figure), upper body or three-quarter body, the action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent. 
- Centered, the bear and prop together fill about 88 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards must be blank or show only simple lines and shapes.

Images:
1. raw/aio.png — looking through a pair of binoculars held with both paws at a floating blue chat speech bubble with a small sparkle-star shape inside it.
2. raw/seo.png — writing on a large blank sheet of paper with an oversized blue pencil held in both paws, focused eyes (glowing straight lines).
3. raw/banner.png — painting with a big paintbrush on a small easel canvas that shows a simple blue mountain and yellow sun shape, cheerful eyes (glowing ^ ^ arcs).
4. raw/adimage.png — shouting happily into a big blue megaphone held in one paw, the other paw raised, three short motion lines coming out of the megaphone.
5. raw/persona.png — holding up a blue ID card showing a simple person silhouette (round head and shoulders) and looking at it closely with curious eyes.
6. raw/interview.png — leaning forward and holding out a blue handheld microphone toward the viewer as if interviewing someone, friendly eyes.

Save all files and then list the raw/ folder.

```
