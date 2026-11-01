# E2E の結果

- 全体: failed
- テスト: 50 件（合格 9 / 失敗 41 / スキップ 0）
- 遮断した外部への通信: 166 件
  - Google (その他): 112
  - Google Tag Manager / Analytics: 54

## 画面ごと（h1 / 横はみ出し / CLS / 画像 / キービジュアル / 1文字の行）

| 画面 | 幅 | 結果 | h1 | 横 | CLS | 画像 | KV | 1文字 | 遮断 |
|---|---|---|---|---|---|---|---|---|---|
| /adimage | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /adimage | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /aio | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /aio | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /aishodan | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /aishodan | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /asklink | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /asklink | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /banner | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /banner | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /cunning | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /cunning | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| / | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /doyalist | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /doyalist | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /doyaslide | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /doyaslide | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /hr | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /hr | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /interview | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 5 |
| /interview | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 5 |
| /kintai | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /kintai | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /mensetsu | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /mensetsu | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| / | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /persona | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /persona | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /popup | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /popup | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /pricing | desktop-1280 | 合格 | OK 1 | OK | OK 0 | OK | OK | OK | 3 |
| /pricing | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | NG | NG | 3 |
| /promane | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /promane | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /quote | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /quote | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /seo | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /seo | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /sfa | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /sfa | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /shodan | desktop-1280 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |
| /shodan | mobile-375 | 失敗 | OK 1 | OK | OK 0 | OK | OK | NG | 3 |

## 画面の切り替え（背景の色）

| 切り替え | 幅 | 結果 | 移り方 | 前の色 | 後の色 | 見えたフレーム | 透明 | 別の色 |
|---|---|---|---|---|---|---|---|---|
| /banner → /seo | mobile-375 | 合格 | location | rgb(248, 250, 252) | rgb(248, 250, 252) | 66 | 0 | - |
| / → /banner | mobile-375 | 合格 | link | rgb(248, 250, 252) | rgb(248, 250, 252) | 189 | 0 | - |
| /seo → /pricing | mobile-375 | 合格 | link | rgb(248, 250, 252) | rgb(248, 250, 252) | 172 | 0 | - |
| /pricing → / | mobile-375 | 合格 | location | rgb(248, 250, 252) | rgb(248, 250, 252) | 82 | 0 | - |
| / → /banner | desktop-1280 | 合格 | link | rgb(248, 250, 252) | rgb(248, 250, 252) | 165 | 0 | - |
| /banner → /seo | desktop-1280 | 合格 | location | rgb(248, 250, 252) | rgb(248, 250, 252) | 2 | 0 | - |
| /seo → /pricing | desktop-1280 | 合格 | link | rgb(248, 250, 252) | rgb(248, 250, 252) | 110 | 0 | - |
| /pricing → / | desktop-1280 | 合格 | location | rgb(248, 250, 252) | rgb(248, 250, 252) | 45 | 0 | - |

## 失敗したテスト

### /banner ドヤバナーAI（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「ン」 in p.text-[8px].font-bold.opacity-90 「春の新作コレクション」（行: 春の / 新作コレクショ / ン） / 「を」 in p.text-[12px].font-black.leading-tight 「プロが選ぶ品質を」（行: プロが / 選ぶ品質 / を） / 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### / トップ（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /seo ドヤ記事作成（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /interview ドヤインタビュー（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /persona ドヤペルソナAI（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /hr ドヤHR（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「健」 in p.text-[12px].font-black.text-slate-800 「高橋 健」（行: 高橋 / 健） / 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /kintai ドヤ勤怠（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /doyalist ドヤリスト（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /promane ドヤプロマネ（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「作」 in p.mt-1.text-[10px].font-bold 「新サービスサイト制作」（行: 新サービスサイト制 / 作） / 「ジ」 in div.rounded-lg.border.border-slate-100 「トップページ」（行: トップペー / ジ） / 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /doyaslide ドヤスライド（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /cunning ドヤカンニング（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /sfa ドヤ営業管理（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「所」 in p.text-[10px].font-black.text-slate-800 「山田製作所」（行: 山田製作 / 所） / 「事」 in p.text-[10px].font-black.text-slate-800 「みらい商事」（行: みらい商 / 事） / 「ズ」 in p.text-[10px].font-black.text-slate-800 「青空フーズ」（行: 青空フー / ズ） / 「流」 in p.text-[10px].font-black.text-slate-800 「さくら物流」（行: さくら物 / 流） / 「

### /shodan ドヤ商談準備（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「所」 in span.text-[11px].font-black.text-slate-800 「株式会社みらい製作所」（行: 株式会社みらい製作 / 所） / 「p」 in span.text-[11px].font-black.text-slate-800 「mirai-seisaku.example.jp」（行: mirai- / seisaku.example.j / p） / 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /aio ドヤAIO（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /mensetsu ドヤ面接官（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /quote ドヤ見積もりAI（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /aishodan ドヤAI商談（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /adimage ドヤ広告画像AI（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /pricing 料金（mobile-375）
- Error: 最初の画面にキービジュアル（120px 以上の画像）がある
- Error: 1文字だけの行が無い: 「月」 in td 「月3プロジェクト / 20枚まで」（行: 月 / 3プロジェクト / /20枚まで）

### /asklink ドヤAI質問リンク（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /popup ドヤポップアップ（LP）（mobile-375）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### / トップ（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /banner ドヤバナーAI（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /seo ドヤ記事作成（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /interview ドヤインタビュー（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /persona ドヤペルソナAI（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /hr ドヤHR（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /kintai ドヤ勤怠（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /doyalist ドヤリスト（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /promane ドヤプロマネ（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /doyaslide ドヤスライド（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /cunning ドヤカンニング（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /sfa ドヤ営業管理（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /shodan ドヤ商談準備（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /aio ドヤAIO（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /mensetsu ドヤ面接官（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /quote ドヤ見積もりAI（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /aishodan ドヤAI商談（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /adimage ドヤ広告画像AI（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /asklink ドヤAI質問リンク（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

### /popup ドヤポップアップ（LP）（desktop-1280）
- Error: 1文字だけの行が無い: 「は」 in strong 「はじめ方ガイド」（行: は / じめ方ガイド）

## 遮断した宛先（ホストごと）

- fonts.googleapis.com: 112
- www.googletagmanager.com: 54
