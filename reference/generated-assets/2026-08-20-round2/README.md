# ドヤシリーズ アセット制作 第2弾

## 決定

- UIアイコンの正本: `lucide-react`。新規・移行は `src/components/icons.tsx` 経由。既存LPキットの Material Symbols は凍結互換。
- 呪い日記 / ゆるせん / ヒトリジメ: ドヤゲームポータル内の別カテゴリ「物語とセルフケア」に掲載。

## 成果物

- R2-A: 7サービスの固有モック、ドヤスライドLP、プロマネLP移行、H/C/O 21セット（`hero@2x` を含む実ファイル28点）。
- R2-B: 既存13サービスの正方形アイコン。公開用512pxと、このフォルダ内の1024pxマスター。
- R2-C: 17サービスの `src/app/<id>/icon.png`。
- R2-D: 約20種を超える共通Lucideアイコンと、優先3画面の絵文字置換。
- R2-E: `public/empty/` の400×320 SVG 6点と `src/components/EmptyState.tsx`。
- R2-F: ポータル用カード3点と別カテゴリのHTML実装。
- R2-G: 17サービス×3状態、合計51点の1280×800 WebP。

## 画像生成経路

正方形アイコンは `scripts/generate-round2-icons.ts` から必ず `generateImageWithFallback()` を呼び出した。参照画像編集は gpt-image-2 を優先し、現行編集エンドポイントの対応モデルへ gpt-image-1 で退避。直接API呼び出しはしていない。

基本プロンプト: 公式ロゴの白クマ同一性、太い濃紺アウトライン、サービス固有モチーフ、`#0066ff` + `#00e0ff`、文字・数字・透かし・外枠なし、透過背景、16px判別を指定。サービス固有モチーフはスクリプト内 `SPECS` を正本とする。

## 検証

```bash
npx tsc --noEmit --pretty false
node scripts/verify-round2-assets.mjs
```

検証項目: 寸法、容量上限、透過alpha、公開アイコンとファビコンのバイト一致、51スクリーンショット、SVGの文字なし、ゲームカード寸法、優先3画面の絵文字0件。
