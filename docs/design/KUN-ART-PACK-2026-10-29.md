# 足りない絵の一覧と、作った絵（2026-10-29）

本人の指示（メイン経由「必要、あった方がいいアイコンやキャラ画像を Codex の内蔵画像生成で作ってください」）による作業です。
絵は Codex の内蔵の画像生成（ChatGPT の定額枠。`auth_mode=chatgpt`、API キー無し）だけで作ります。有料の API は使いません。

## 作り方（前回と同じ）

1. 手本の3枚（hello・working・present）を添付し、背景を単色の緑にして1枚ずつ作る。
2. `python3 scripts/kun-import-pose.py <緑の背景の png> <名前>` で背景を抜き、`public/character/<名前>-512.webp` と `-256.webp` に置く。
3. 重い処理は `~/Code/tools/pc-guard/heavy-slot.sh` を通して1つずつ回す。

## 今ある絵（ds/kun の KunPose）

hello・point・working・thinking・ponder・focus・present・success・thumbsup・love・jump・launch・finish・run・surprise・sleep・ramen・throw・bug・error、
mic・calendar・write・survey・camera・search・chart・money・clock・handshake・empty（計31）。
ツールごとの3D のクマは `public/ui-renewal/mascots/<ツール>.webp`（26枚）。

## 足りない絵の一覧と、作る絵（27枚）

| 区分 | 名前 | 絵 | 使う場所 |
|---|---|---|---|
| 小さく表示する用（72px 以下・飾りを減らす） | mini-hello | 手を上げてあいさつ | 経営ホームの見出しの右・サイドバー・通知 |
| 〃 | mini-point | 前を指さす | 〃 |
| 〃 | mini-working | ノートパソコンで作業 | 作業中の小さな表示 |
| AI 部署の部署長 | lead-marketing | メガホンと棒グラフの看板 | マーケ部のページ・サイドバー |
| 〃 | lead-sales | ビジネスバッグと挨拶 | 営業部 |
| 〃 | lead-hr | 名札と虫めがね・履歴書 | 人事部 |
| 〃 | lead-admin | ハンコと書類フォルダ | 管理部 |
| 状態 | waiting | 砂時計・判断待ち | 経営ホームの「判断が必要なこと」 |
| 〃 | report | クリップボードで報告 | 各部署からの報告 |
| 〃 | todo | チェックリストの巻物 | 今日やること |
| 〃 | locked | 南京錠・入れない | 権限なしの空の状態（今は surprise で代用） |
| 経営ホームの数字のカード | kpi-sales | 金貨を抱える | 今月の売上 |
| 〃 | kpi-incoming | お金の入った封筒 | 入金予定 |
| 〃 | kpi-spend | 長いレシート | 今月の支出 |
| 〃 | kpi-deals | 握手の手を差し出す | 進行中の商談 |
| 〃 | kpi-hiring | 応募者の顔写真カード | 採用の進み |
| ツール固有の空の状態 | tool-banner | 筆とパレット | ドヤバナーAI |
| 〃 | tool-adimage | 額縁 | ドヤ広告画像AI |
| 〃 | tool-persona | 横顔のカードの扇 | ドヤペルソナAI |
| 〃 | tool-asklink | 鎖の輪と吹き出し | ドヤAI質問リンク |
| 〃 | tool-popup | 窓からひょっこり | ドヤポップアップ |
| 〃 | tool-tenjikai | 展示ブースと旗 | ドヤ展示会 |
| 〃 | tool-aishodan | ヘッドセット | ドヤAI商談 |
| 〃 | tool-doyalist | 名簿の巻物 | ドヤリスト |
| 〃 | tool-promane | ガントチャートの板 | ドヤプロマネ |
| 〃 | tool-shanai | 2つの吹き出し | ドヤ社内（社内のやりとり） |
| 〃 | tool-income | 請求書に判を押す | ドヤ収入管理（請求書） |

すでに絵があり、新しく作らないもの: 勤怠（clock）・商談準備と AIO（search）・記事作成（write）・インタビュー（mic）・見積（write）・支出（money）・営業管理（handshake）・スライド（present）・人事（survey）。
展示会の待ち画面のローラーのクマ（paint-a・paint-b・paint-done）は、10/29 の時点では作り直さない予定だったが、10/30 に画風のずれが分かり、作り直した（下の「2026-10-30 の直し」）。

## 2026-10-30 の直し（本人の「進めてください」）

- kpi-deals（商談）: 親指を立てた手になっていたので、握手の手（画面の左から相手の手の先が見える）で作り直した。
- 展示会の待ち画面のクマ（paint-a・paint-b・paint-done）: 他の絵と並べると、線が細く、網点も飾りもなく、画風がずれていた。同じ画風で作り直し、同じ名前で置き換えた（元の絵は取っておいていない。git の履歴から戻せる）。待ち画面（/ds-preview/working）で、壁の絵とのならびが崩れないことを確かめた。
- 各ツールの空の画面: EmptyState が URL の最初の段からツールを判断し、固有の絵を出す（前日）。
- 見本のページ（/shell-sample）は、Vercel の preview でも開けるようにした（本番は 404 のまま）。
