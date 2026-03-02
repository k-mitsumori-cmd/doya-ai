# ドヤAI プロジェクト — 完全リファレンス

> このフォルダを Claude Code に読み込ませれば、プロジェクト全体を理解できます。

## ドキュメント構成

| ファイル | 内容 |
|---------|------|
| [01-overview.md](./01-overview.md) | プロジェクト概要・技術スタック・ディレクトリ構成 |
| [02-architecture.md](./02-architecture.md) | アーキテクチャ全体像・データフロー・デプロイ |
| **サービス別** | |
| [services/kantan.md](./services/kantan.md) | カンタンマーケAI |
| [services/seo.md](./services/seo.md) | ドヤライティングAI (SEO記事生成) |
| [services/banner.md](./services/banner.md) | ドヤバナーAI |
| [services/logo.md](./services/logo.md) | ドヤロゴ |
| [services/interview.md](./services/interview.md) | ドヤインタビューAI |
| [services/persona.md](./services/persona.md) | ドヤペルソナAI |
| [services/shindan.md](./services/shindan.md) | ドヤ診断AI |
| [services/swipe.md](./services/swipe.md) | ドヤSwipe (SEO記事 Tinder風UI) |
| [services/slide.md](./services/slide.md) | ドヤスライド + SlashSlide |
| services/tenkai.md | ドヤ展開AI (※未作成) |
| services/opening.md | ドヤオープニングAI (※未作成) |
| **共通基盤** | |
| [03-api-reference.md](./03-api-reference.md) | 全APIエンドポイント一覧 |
| [04-database.md](./04-database.md) | Prismaスキーマ・テーブル設計 (38モデル) |
| [05-auth-payments.md](./05-auth-payments.md) | 認証 (NextAuth・Admin Auth) ・決済 (Stripe) ・アクセス制御 |
| [06-ui-patterns.md](./06-ui-patterns.md) | UIコンポーネント・デザインパターン |
| [07-dev-guide.md](./07-dev-guide.md) | 開発パターン・コーディング規約・ビルド・デプロイ・トラブルシューティング |
| [08-environment.md](./08-environment.md) | 環境変数一覧・セットアップ手順 |
| [09-bootstrap.md](./09-bootstrap.md) | バナーテンプレート一括生成 (Bootstrap) |
| [10-service-status.md](./10-service-status.md) | サービスステータス一元管理 (実装状態・課金・ドキュメント) |

## クイックリファレンス

### 技術スタック
- **フレームワーク**: Next.js 14 (App Router) + React 18 + TypeScript
- **DB**: Prisma ORM + PostgreSQL (Supabase)
- **認証**: NextAuth.js (Google OAuth)
- **UI**: Tailwind CSS + Framer Motion + Zustand
- **AI**: Google Gemini (primary) + OpenAI (fallback) + AssemblyAI (文字起こし)
- **決済**: Stripe
- **ストレージ**: Supabase Storage
- **アナリティクス**: Google Tag Manager + HubSpot
- **通知**: Slack Incoming Webhooks
- **デプロイ**: Vercel (Cron Jobs: 日次/週次/月次レポート)

### サービス一覧 (13サービス + 管理画面)

| サービス | パス | 説明 | 月額 (PRO) |
|---------|------|------|-----------|
| ドヤバナーAI | `/banner` | プロ品質バナー自動生成 | ¥9,980 |
| ドヤライティングAI | `/seo` | SEO + LLMO 長文記事生成 | ¥9,980 |
| ドヤインタビューAI | `/interview` | 音声→インタビュー記事 | ¥9,980 |
| ドヤ展開AI | `/tenkai` | 1コンテンツ→9プラットフォーム展開 | ¥9,980 |
| ドヤペルソナAI | `/persona` | URL→ペルソナ分析 | - |
| ドヤオープニングAI | `/opening` | URL→アニメーション生成 | - |
| カンタンマーケAI | `/kantan` | → /seo リダイレクト | - |
| ドヤロゴ | `/logo` | ロゴ3パターン生成 | - |
| ドヤSwipe | `/swipe` | Tinder風UI→記事生成 | (SEOと共通) |
| ドヤ診断AI | `/shindan` | Web7軸スコアリング診断 | - |
| ドヤスライド | `/slide` | AI→スライド生成 | - |
| SlashSlide | `/slashslide` | AIスライド (別ブランド) | - |
| 管理画面 | `/admin` | ユーザー・KPI・請求・テンプレート管理 (15+ページ) | - |

### バンドルプラン

| プラン | 月額 | 内容 |
|--------|------|------|
| オールインワン | ¥5,980 (約25%OFF) | SEO PRO + バナー PRO + 今後の新サービス |

### ブランドカラー
- メイン: `#7f19e6` (紫)
- アイコン: Material Symbols Outlined
- フォント: Inter + Noto Sans JP
