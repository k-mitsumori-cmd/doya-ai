# ドヤシリーズ P0 画像制作メモ

要件正本: `reference/asset-gap-and-requirements.md`

## 今回の制作範囲

- `B-01`: 白クマ＋VRゴーグルに統一したブランドアイコン
  - マスター: `brand-icon/master.svg`
  - PNG: 16 / 32 / 180 / 192 / 512 / 1024px
- `L-01〜04`: 新4サービスの横長ロゴを検品し、`public/<serviceId>/logo.png` と `.webp` に配置
- `I-14〜17`: 新4サービスの文字なし正方形アイコン
- `H-14〜17`: ローカルで描画した製品モックを実画面キャプチャし、1x / 2x のヒーロー画像へ加工
- `C-14〜17`: ヒーロー画像から800×500のカード画像を派生
- `O-14〜17`: 左側に製品画、右側にテキスト合成余白を残した1200×630のOGP背景
- 既存サービス6件（`banner / hr / kintai / sfa / shodan / aio`）にも同じ `H/C/O` を追加
- `M-01`（画像側）: 既存15ポーズから256px／512pxの軽量WebPを30点書き出し

## サービス別モチーフ

| serviceId | ロゴ／アイコンのモチーフ | アクセント |
|---|---|---|
| `mensetsu` | 白クマ面接官＋評価クリップボード | `#ff1e72` |
| `quote` | 白クマ＋見積書＋根拠チェック付きタグ | `#00e0ff` |
| `aishodan` | 白クマとEast Asianの商談相手＋適合チェック | `#ffd400` |
| `adimage` | 白クマ＋縦横比の異なる3枚の画像フレーム | `#009bff` |

## 画像生成プロンプトの共通部分

Built-in `imagegen` を使用。各サービスを別プロンプトで生成した。

```text
Use case: logo-brand
Asset type: square app icon
Primary request: supplied horizontal logoから白クマの同一性と太いアウトラインの
pop-tech表現を維持し、サービス固有モチーフを持つ文字なしアイコンへ派生する。
Composition: centered, strong silhouette, readable at 16px, central 80% safe zone.
Palette: #0066ff, navy, white, cyan, plus one service accent.
Constraints: transparent background; no Japanese, letters, numbers, watermark, or extra characters.
```

`mensetsu` と `quote` の初回出力は市松模様が画像に焼き込まれたため不採用。`background-extraction` で背景のみを実透過へ修正し、アルファチャンネルを確認した。

## ヒーロー／カード／OGPの作り方

AI生成の架空UIは使わず、`http://localhost:3017/<serviceId>` で実際に描画された `MockWindow` をChromeで2xキャプチャした。キャプチャをブランド背景へ配置し、SharpでWebP化した。

## 配置先

対象10サービスの公開ディレクトリに以下を配置した。ロゴ／アイコンは新4サービスのみ。

```text
public/<serviceId>/logo.png
public/<serviceId>/logo.webp
public/<serviceId>/icon.png
public/<serviceId>/hero.webp
public/<serviceId>/hero@2x.webp
public/<serviceId>/card.webp
public/<serviceId>/og-bg.webp
```

ブランド共通PNGは `public/icon-192x192.png`、`public/icon-512x512.png`、`public/icon-1024x1024.png` に配置した。

マスコットの軽量版は `public/character/<pose>-256.webp` と `public/character/<pose>-512.webp` に配置した。既存PNGと重複ディレクトリは削除していない。

## 未着手

- 既存13サービスの `I`（正方形アイコン）
- `C/O/H` が未制作なのは `seo / interview / persona / doyalist / doyaslide / cunning / promane` の7件。前5件は汎用モック、後2件は有効なプロダクトショットを取得できず、要件に反するため保留した
- 約60点の機能スクリーンショット
- 仕組み図、空状態、ゲームカード、導入事例ビジュアル
- 画像を表示するためのReact／Next.js側の配線

## 検品結果

- 画像88項目を寸法・容量・アルファ・デコードで検査: `PASS`
- 新4サービスのロゴPNG／WebP: 2016×864、各150KB以下
- 新4サービスのアイコン: 512×512、透過あり、各80KB以下
- 10サービスの `hero / hero@2x / card / og-bg`: 指定寸法、`hero` 300KB以下、`card` 120KB以下
- ブランドアイコンPNG: 6サイズ
- マスコット軽量WebP: 15ポーズ×2サイズ＝30点
