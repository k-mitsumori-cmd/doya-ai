# 01. プロジェクト概要

## ドヤAI とは

日本語マーケティング業務に特化したマルチサービスAIプラットフォーム。
1つのアカウントで全サービスを利用可能。サービスごとに個別のプラン管理。

## 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) | 14.2+ |
| UI | React + TypeScript | 18.2+ |
| ORM | Prisma Client | 5.7+ |
| DB | PostgreSQL (Supabase) | - |
| 認証 | NextAuth.js (Google OAuth) | 4.24+ |
| CSS | Tailwind CSS | 3.x |
| アニメーション | Framer Motion | 10.x |
| 状態管理 | Zustand | 4.4+ |
| AI (テキスト) | Google Gemini API 直接呼出 | gemini-2.0-flash / 1.5-flash |
| AI (画像) | Google Gemini 3 Pro Image Preview | gemini-3-pro-image-preview |
| AI (fallback) | OpenAI API | gpt-4o |
| 文字起こし | AssemblyAI | universal-2 |
| 決済 | Stripe | 14.x |
| ストレージ | Supabase Storage | - |
| 画像処理 | Sharp, Satori, resvg-js | - |
| PDF | jsPDF | 4.x |
| バリデーション | Zod | 3.22+ |
| アイコン | Lucide React + Material Symbols | - |
| デプロイ | Vercel | - |

## ディレクトリ構成

```
09_Cursol/                       # ★ Gitルート & Vercelデプロイ対象
├── src/                         # ★ 本番ソースコード（こちらを編集すること）
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # ルートレイアウト
│   │   ├── page.tsx             # トップページ
│   │   ├── auth/                # 認証ページ
│   │   ├── admin/               # 管理画面 (15ページ)
│   │   ├── pricing/             # 統一料金ページ
│   │   ├── og/                  # OG画像生成
│   │   │
│   │   ├── banner/              # ドヤバナーAI (16ページ)
│   │   ├── seo/                 # ドヤライティングAI (45ページ)
│   │   ├── interview/           # ドヤインタビューAI (15ページ)
│   │   ├── tenkai/              # ドヤ展開AI (10ページ)
│   │   ├── kantan/              # カンタンマーケAI (10ページ, →/seoにリダイレクト)
│   │   ├── persona/             # ドヤペルソナAI (5ページ)
│   │   ├── opening/             # ドヤオープニングAI
│   │   ├── logo/                # ドヤロゴ
│   │   ├── shindan/             # ドヤ診断AI (3ページ)
│   │   ├── slide/               # ドヤスライド (3ページ)
│   │   ├── slashslide/          # SlashSlide (3ページ)
│   │   │
│   │   └── api/                 # APIルート (150+エンドポイント)
│   │       ├── auth/            # NextAuth
│   │       ├── stripe/          # 決済API
│   │       ├── admin/           # 管理API (16+)
│   │       ├── health/          # ヘルスチェック
│   │       ├── banner/          # バナーAPI (17)
│   │       ├── seo/             # SEO API (35+)
│   │       ├── interview/       # インタビューAPI (15)
│   │       ├── tenkai/          # 展開AI API (23)
│   │       ├── swipe/           # Swipe API (11)
│   │       ├── persona/         # ペルソナAPI (3)
│   │       ├── opening/         # オープニングAPI (5)
│   │       ├── cron/            # Cronジョブ (3: 日次/週次/月次レポート)
│   │       ├── logo/            # ロゴAPI (1)
│   │       ├── slide/           # スライドAPI (2)
│   │       └── slashslide/      # SlashSlide API (2)
│   │
│   ├── components/              # 共通 + サービス別コンポーネント
│   │   ├── DashboardLayout.tsx
│   │   ├── DashboardSidebar.tsx
│   │   ├── PersonaAppLayout.tsx
│   │   ├── PersonaSidebar.tsx
│   │   ├── SeoAppLayout.tsx
│   │   ├── SeoSidebar.tsx
│   │   ├── ShindanAppLayout.tsx
│   │   ├── interview/           # インタビュー専用
│   │   ├── seo/                 # SEO専用
│   │   ├── shindan/             # 診断専用
│   │   ├── tenkai/              # 展開AI専用
│   │   └── ...
│   │
│   ├── lib/                     # ユーティリティ・ビジネスロジック
│   │   ├── auth.ts              # NextAuth設定 ★重要
│   │   ├── prisma.ts            # Prismaクライアント
│   │   ├── pricing.ts           # 全サービス料金設定 ★重要
│   │   ├── services.ts          # サービス定義 ★重要
│   │   ├── stripe.ts            # Stripe連携 (PlanId型, 全関数)
│   │   ├── seo.ts               # SEOユーティリティ
│   │   ├── seoAccess.ts         # SEOアクセス制御
│   │   ├── banners.ts           # バナー生成ロジック
│   │   ├── gemini-text.ts       # Gemini APIラッパー
│   │   ├── openai.ts            # OpenAI APIラッパー
│   │   ├── interview/           # インタビュー専用
│   │   │   ├── storage.ts       # Supabase Storage操作
│   │   │   ├── transcription.ts # AssemblyAI連携
│   │   │   ├── access.ts        # アクセス制御
│   │   │   ├── types.ts         # 型定義
│   │   │   ├── prompts.ts       # AIプロンプト
│   │   │   └── recipes-seed.ts  # レシピ初期データ
│   │   ├── tenkai/              # 展開AI専用
│   │   │   ├── generation-pipeline.ts  # 生成パイプライン
│   │   │   ├── access.ts        # アクセス制御・使用量管理
│   │   │   ├── validation.ts    # バリデーション
│   │   │   ├── scraper.ts       # URLスクレイピング
│   │   │   ├── brand-voice.ts   # ブランドボイス処理
│   │   │   ├── storage.ts       # ストレージ管理
│   │   │   └── prompts/         # プラットフォーム別プロンプト (9種)
│   │   ├── opening/             # オープニングAI専用
│   │   │   ├── animation-engine.ts  # アニメーションエンジン
│   │   │   ├── site-analyzer.ts     # Webサイト解析
│   │   │   ├── gemini.ts            # Gemini API連携
│   │   │   ├── templates.ts         # アニメーションテンプレート (12種)
│   │   │   ├── color-utils.ts       # カラーユーティリティ
│   │   │   └── usage.ts             # 使用量トラッキング
│   │   ├── notifications.ts    # Slack通知 (日次/週次/月次レポート, イベント通知)
│   │   ├── slide/               # スライド生成 (Gemini + Google Slides API)
│   │   ├── slashslide/          # SlashSlide (slide/と同構造)
│   │   └── ...
│   │
│   └── store/                   # Zustandストア
│
├── seo/                         # SEOサブプロジェクト (@seo/* エイリアス先)
│   ├── components/              # SEO専用Reactコンポーネント
│   │   └── ui/                  # Shadcn UIベースのプリミティブ
│   └── lib/                     # SEO専用ライブラリ
│       ├── gemini.ts            # Gemini API呼び出し
│       ├── pipeline.ts          # 記事生成パイプライン (175KB)
│       ├── extract.ts           # テキスト抽出・解析
│       ├── score.ts             # スコアリング
│       ├── audit.ts             # 監査機能
│       ├── markdown.ts          # Markdown処理
│       ├── types.ts             # 型定義
│       └── ...
│
├── scripts/                     # 運用・バッチスクリプト (10ファイル)
│
├── doya-ai/                     # ⚠️ 旧サブプロジェクト（デプロイされない）
│   ├── src/                     # ⚠️ ルートのsrc/とほぼ同内容だが本番で使われない
│   └── seo/                     # シンボリックリンク → seo-symlink-backup/
│
├── prisma/
│   └── schema.prisma            # DBスキーマ (38モデル)
│
├── middleware.ts                 # Next.jsミドルウェア (Slide専用ドメイン書換え)
├── next.config.js               # Next.js設定
├── tailwind.config.ts           # Tailwind設定
├── tsconfig.json                # TypeScript設定 (@/* → src/*, @seo/* → seo/*)
├── package.json                 # 依存関係
├── CLAUDE.md                    # Claude Code用ガイド
└── reference/                   # プロジェクトドキュメント
```

> **⚠️ 重要**: `doya-ai/src/` を編集しても本番に反映されません。
> Vercelは `09_Cursol/`（Gitルート）を直接ビルドします。
> 必ず `09_Cursol/src/` を編集してください。

## パスエイリアス

```typescript
// tsconfig.json
"@/*"   → "./src/*"     // メインソース
"@seo/*" → "./seo/*"    // SEOサブプロジェクト (seo/ディレクトリ)
```

## ビルド・起動コマンド

```bash
npm run dev        # 開発サーバー起動
npm run build      # prisma generate && db push && next build
npm run start      # 本番サーバー起動
npm run lint       # ESLint実行
npm run db:push    # Prismaスキーマ反映
```

## ミドルウェア

`middleware.ts` — Slide専用ドメインの書換え処理:
- `SLIDE_HOSTS` 環境変数でカンマ区切りドメイン指定
- 該当ドメインからのアクセスを `/slide` パスにリライト

## 重要な注意点

- `typescript.ignoreBuildErrors: true` — 既存の型エラーがある状態でビルド可能
- `eslint.ignoreDuringBuilds: true` — ESLintエラーもビルド時は無視
- APIルートはすべて `maxDuration = 300` (5分タイムアウト)
- ゲスト (未ログイン) ユーザーもCookieベースで利用可能
- Prismaモデル数: 38個 (認証3, ユーザー2, SEO12, Interview7, Swipe3, Tenkai6, 管理3, その他2)
