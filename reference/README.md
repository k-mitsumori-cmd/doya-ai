# ドヤAI プロジェクト — 完全リファレンス

> このフォルダを Claude Code に読み込ませれば、プロジェクト全体を理解できます。

## ドキュメント構成

| ファイル | 内容 |
|---------|------|
| [01-overview.md](./01-overview.md) | プロジェクト概要・技術スタック・ディレクトリ構成 |
| [02-architecture.md](./02-architecture.md) | アーキテクチャ全体像・データフロー・デプロイ |
| **サービス別** | `services/` 配下に21ファイル（adbanner / adsim / aio / banner / copy / cunning / doyaslide / interview / kantan / kintai / logo / lp / persona / promane / seo / sfa / shindan / shodan / slide / swipe / tenkai） |
| **共通基盤** | |
| [03-api-reference.md](./03-api-reference.md) | 全APIエンドポイント一覧 |
| [04-database.md](./04-database.md) | Prismaスキーマ・テーブル設計（※正本は `prisma/schema.prisma`＝103モデル。本ドキュメントは主要38モデル時点の解説） |
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
- **AI (テキスト)**: Google Gemini (gemini-2.0-flash) / fallback: OpenAI gpt-4o
- **AI (画像)**: gpt-image-2 (メイン) / nano-banana-pro-preview (フォールバック) — 必ず `src/lib/image-generator.ts` 経由
- **文字起こし**: AssemblyAI (universal-2)
- **決済**: Stripe
- **ストレージ**: Supabase Storage
- **アナリティクス**: Google Tag Manager + HubSpot
- **通知**: Slack Incoming Webhooks／**メール**: Resend
- **デプロイ**: Vercel (Cron Jobs 9本: 日次/週次/月次・ドリップ配信・AIOスキャン・アクセスレポート等)

### サービス一覧
**正本は `src/lib/services.ts` の `SERVICES` 配列**（id / 名前 / href / status / 料金）。ここに一覧表は持たない（drift防止）。実装状態のサマリは [10-service-status.md](./10-service-status.md) を参照。

### 課金: 統一プラン方式
無料 / プロ **¥9,980** の2プランのみ。1契約で全サービスのPRO利用可（個別課金・バンドル販売は廃止）。判定は `User.plan` 単一参照、定義は `src/lib/unified-plan.ts` / `UnifiedPricingPlans`。

### ブランドカラー
- メイン: `#0066ff`（青・2026-06 ドヤマーケAIリブランド）。アクセント: `#ff1e72` / `#ffd400` / `#00e0ff` / `#009bff`
- 旧 `#7f19e6`（紫）は一部既存サービス内UIに残存（順次置換中）
- アイコン: Material Symbols Outlined
- フォント: Inter + Noto Sans JP
