# 経営ホームの「ゴール・ToDo」のドヤくんの絵（4枚）

経営ホームで作戦を立てたあとの画面（ゴール・3つの柱・ToDo）に出す絵です。2026-11-01 の本人の言葉「わかりずらいです。クマのアイコンをちゃんとそれぞれ codex で画像生成してわかりやすくしてください」を受けて作りました。

- 置き場所: `public/shell/bear/todo/<名前>.webp`。背景は透過、白い縁取りのステッカー型、WebP（品質90）
- 出す部品: `src/components/home-agent/HomeAgent.tsx` の `TodoBear`（ToDo の左・実行中の一覧）と、ゴールの欄の左の絵
- 左のメニューの絵（`public/shell/bear/<ツールid>.webp`・`menu/`）とは別の絵です。そちらは変えていません
- 作成日: 2026-11-01

| ファイル | 出す所 | 仕事 |
|---|---|---|
| `shodan.webp` | ドヤ商談準備の ToDo | 虫めがねで相手の会社のビルを調べる |
| `quote.webp` | ドヤ見積もりAI の ToDo | 電卓を持ち、見積書の下書きを掲げる |
| `doyaslide.webp` | ドヤスライドの ToDo | 指し棒で、スライドの並びを書いたボードを説明する |
| `goal.webp` | ゴールの欄 | 旗を掲げ、的の真ん中に矢が当たっている |

## 作り方

1. Codex CLI の内蔵の画像生成で作った。ChatGPT の定額の枠で動かし、従量課金の API キーは使っていない。
   - 事前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` で、環境変数に API キーが無いことを確かめた。
   - 実行: `env -u OPENAI_API_KEY codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -i ref-hello.png -i ref-point.png -i ref-working.png -`（プロンプトは stdin）。`~/Code/tools/pc-guard/heavy-slot.sh` を通した。
2. 参照画像は、経営ホームのドヤくん `public/character/hello-512.webp`・`point-512.webp`・`working-512.webp`。顔・ゴーグル・胸の `</>` をそろえる基準にした。
3. 左のメニューの絵との違い: 64px 前後で出すので、道具を絵の半分ほどまで大きくし、「何の仕事か」が道具だけで分かるようにした（商談準備は、今までの絵だと青い箱を持っているだけに見えたため）。
4. 背景を真っ平らなマゼンタ（#ff00ff）で描かせ、`docs/design/images/shell-bear/tools/process.py` で抜いた。ToDo の3枚は 128×128、ゴールは 160×160 に縮めた。
5. 画像の中に文字が無いことを目で確かめた（胸の `</>` だけ）。

## プロンプト（全文）

```
（生成のあとに、実際に使った全文をここに貼る）
```

## 画面写真

- 直す前: `screens/before-1280-full.png`・`screens/before-375-full.png`
- 直したあと: `screens/after-1280-full.png`・`screens/after-375-full.png`
- 撮り方: 開発用の見本ページ `/home/agent-preview`（API・DB・AI・ドヤパワーを使わない）で、例「商談の準備をまとめて進めたい」を選び、URL に https://doyamarke.surisuta.jp を入れて作戦の画面まで進めた。
