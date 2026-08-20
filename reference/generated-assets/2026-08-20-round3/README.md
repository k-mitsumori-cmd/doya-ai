# ドヤシリーズ アセット制作 第3弾

依頼書: `reference/asset-request-round3.md`

## 実施内容

- R3-0: 17サービスの `FeatureShowcase` に既存スクリーンショット51点を配線。
- R3-0: `EmptyState` をバナー履歴、ドヤスライド一覧、見積書一覧、SEO生成結果エラーへ配線。
- R3-A: `public/banner-samples/` のカテゴリ12点、目的7点、サイズ比率図12点を1200×628 WebPへ更新。
- R3-B: 17サービスの `src/app/<serviceId>/diagram.tsx` と共通 `ServiceFlowDiagram` を実装し、`HowItWorks` へ配線。
- R3-C: LPの3機能行に対して入力・処理・出力の3枚が一対一で揃ったため、任意の追加34点は今回は作らない。
- R3-D: 実在顧客・許諾・一次情報の判断が必要なため未着手。

## 画像生成経路

カテゴリ・目的の19点は `scripts/generate-round3-banner-samples.ts` から `generateImageWithFallback()` を呼び出して生成した。直接API呼び出しはしていない。生成マスターはこのフォルダの `banner-samples/`、公開用WebPは `public/banner-samples/` に保存する。

共通プロンプトは、完成バナーとしての視覚階層、HTMLテキスト用の余白、`#0066ff` と指定アクセント1色、文字・ロゴ・透かしなし、人物が出る場合は日本人または韓国系のEast Asianを指定している。カテゴリ・目的ごとの被写体定義を含む最終プロンプトは生成スクリプトを正本とする。

サイズ12点は正確な比率が必要なため、同スクリプト内でSVGソースを組み立て、SharpでWebP化したコード生成図版。写真生成は使用していない。

## 検証

```bash
npx tsc --noEmit --pretty false
node scripts/verify-round3-assets.mjs
npm run build
```

検証項目: バナー見本31点の寸法・容量、旧SVG参照0件、51スクリーンショットのLP参照、17仕組み図の実装・配線、主要4画面の空状態配線。
