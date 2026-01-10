# ドヤサイト（LP自動生成ツール）

商品URLまたは商品情報を入力するだけで、LP構成案・ワイヤーフレーム・画像を自動生成するツールです。

## 機能

- **商品理解フェーズ**: URLから商品情報を抽出、またはフォーム入力から商品情報を構造化
- **LP構成生成フェーズ**: LPタイプとトーンに基づいてLP構成を生成
- **ワイヤーフレーム生成フェーズ**: PC/SP別のワイヤーフレーム構造を生成
- **画像生成フェーズ**: 各セクションのPC/SP画像をGemini Pro 3で生成
- **プレビュー・ダウンロード**: 生成結果のプレビュー、再生成、ダウンロード機能

## ディレクトリ構成

```
src/lib/lp-site/
├── types.ts                    # 型定義
├── product-understanding.ts    # Step 1: 商品理解
├── structure-generation.ts     # Step 2: LP構成生成
├── wireframe-generation.ts     # Step 3: ワイヤーフレーム生成
├── image-generation.ts         # Step 4: 画像生成
└── pipeline.ts                 # メインパイプライン
```

## APIエンドポイント

- `POST /api/lp-site/generate` - LP生成
- `POST /api/lp-site/regenerate-section` - セクション画像再生成
- `POST /api/lp-site/download` - ダウンロード（単一画像/セクションZIP/全体ZIP）

## 使用方法

1. `/lp-site` にアクセス
2. URL入力またはフォーム入力を選択
3. LPタイプ（SaaS/EC/無形サービス/採用・広報）を選択
4. トーン（信頼感/ポップ/高級感/シンプル）を選択
5. 「生成する」ボタンをクリック
6. 生成結果をプレビュー、再生成、ダウンロード

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Gemini Pro 3 (画像生成)
- Gemini 2.0 Flash (テキスト生成)
- Framer Motion (アニメーション)
- Tailwind CSS



