# ドヤLP AI (Landing Page)

## 概要
- **パス**: `/lp`
- **サービスID**: `lp`
- **説明**: 商品情報からLP構成案・セクション別コピー・デザインを自動生成
- **ステータス**: active
- **カテゴリ**: text

## 機能
- 商品URL or 手動入力 → 情報自動抽出
- 3パターンのLP構成案をAI生成
- セクション別コピー自動生成 (hero, problem, solution, features, testimonial, pricing, faq, cta, footer)
- 8種類のデザインテーマから選択
- セクション単位でブラッシュアップ
- HTML / PDFエクスポート

### 生成フロー (4ステップ)
1. **情報入力** — URL分析 or 手動入力で商品情報・ペルソナを取得
2. **構成選択** — AIが3パターンのLP構成案を生成、1つを選択
3. **コピー生成** — 選択構成に基づきセクション別コピーを生成
4. **デザイン選択** — 8テーマから選択 → HTML出力

### デザインテーマ (8種)
Corporate, Minimal, Dark, Gradient, Bold, Elegant, Playful, Tech

### セクションタイプ
hero, problem, solution, features, testimonial, pricing, faq, cta, footer

### レイアウトオプション
center, left-right, right-left, grid, cards

## 料金
統一プラン方式。ドヤマーケAIに課金で全サービスPRO利用可能。

| プラン | 月間上限 | 月額 |
|--------|---------|------|
| 無料 | 3ページ | ¥0 |
| PRO | 30ページ | 統一プラン |
| Enterprise | 200ページ | 統一プラン |

## APIエンドポイント (9件)

| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/lp/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/lp/projects/[id]` | プロジェクト詳細・更新・削除 |
| POST | `/api/lp/analyze-url` | 商品URL分析 |
| POST | `/api/lp/suggest-fields` | 入力フィールド自動提案 |
| POST | `/api/lp/generate-structure` | LP構成案3パターン生成 |
| POST | `/api/lp/generate-copy` | セクション別コピー生成 |
| POST | `/api/lp/brushup-section` | セクションブラッシュアップ |
| POST | `/api/lp/export-html` | HTML/PDFエクスポート |
| GET | `/api/lp/themes` | デザインテーマ一覧 |

## DBモデル

### LpProject (`lp_projects`)
```
id, userId (必須), guestId, name
status: draft | generating | editing | completed
purpose[] (LP目的、複数可)
productUrl, productInfo (JSON), persona (JSON)
structures (JSON — AI生成3案), selectedStructure (0-based index)
themeId (default: "minimal"), customColors (JSON), customFonts (JSON)
sections → LpSection[]
htmlUrl, pdfUrl, previewUrl (出力)
```

### LpSection (`lp_sections`)
```
id, projectId → LpProject, order
type: hero | problem | solution | features | testimonial | pricing | faq | cta | footer
name, purpose
headline, subheadline, body (TEXT), ctaText, ctaUrl
layout: center | left-right | right-left | grid | cards
bgColor, bgImage, items (JSON)
revisions (JSON[])
```

## ファイル構成
```
src/app/lp/                     # フロントエンド (9ページ)
  ├── page.tsx                  # ダッシュボード
  ├── new/page.tsx              # 新規作成ウィザード
  ├── new/input/page.tsx        # Step 1: 情報入力
  ├── new/structure/page.tsx    # Step 2: 構成選択
  ├── new/copy/page.tsx         # Step 3: コピー生成
  ├── new/design/page.tsx       # Step 4: デザイン選択
  ├── [projectId]/page.tsx      # プロジェクト詳細
  ├── history/page.tsx          # 履歴
  ├── guide/page.tsx            # ガイド
  └── pricing/page.tsx          # 料金

src/app/api/lp/                 # API (9エンドポイント)

src/lib/lp/                     # ビジネスロジック
  ├── wireframe.ts              # LP構成・ワイヤーフレーム生成 (22.8KB)
  ├── prompts.ts                # AIプロンプトテンプレート (16.3KB)
  ├── html-export.ts            # HTML/PDFエクスポート (10.4KB)
  ├── themes.ts                 # 8デザインテーマ定義 (6.2KB)
  └── types.ts                  # TypeScript型定義

src/components/
  ├── LpAppLayout.tsx           # レイアウト
  └── LpSidebar.tsx             # サイドバー
```

## デザイン
- **カラー**: cyan
- **グラデーション**: `from-cyan-500 to-blue-500`
- **アイコン**: `🖥️`
