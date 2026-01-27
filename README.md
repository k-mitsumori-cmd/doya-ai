# ドヤAI

SEO記事とバナーをAIで自動作成するプラットフォーム

## 概要

ドヤAIは、2つのAIツールでコンテンツ制作を効率化します。

### ドヤライティングAI
SEO記事をAIが自動作成。アウトラインから本文まで一括生成。

- 最大20,000字の記事生成
- アウトライン自動生成
- 画像生成（図解/サムネ）対応
- 品質監査・自動修正

### ドヤバナーAI
プロ品質のバナーを自動生成。A/B/Cの3案を同時作成。

- 3案同時生成（ベネフィット、緊急性、社会的証明）
- 日本語特化レイアウト
- AIアドバイザーで微調整可能

## 技術スタック

- **フロントエンド**: Next.js 14, React 18, Tailwind CSS
- **認証**: NextAuth.js (Google OAuth)
- **データベース**: PostgreSQL (Supabase)
- **決済**: Stripe
- **AI**: Google Gemini API

## URL固定ルール（重要）

- **バナー生成ツールのURLは `https://doya-ai.vercel.app/banner` に固定**
- 広告/資料/外部導線で参照されるため、**`/banner` は変更しない**
- LP（紹介ページ）は `https://doya-ai.vercel.app/banner/landing` に配置

## 料金プラン

### ドヤライティングAI
| プラン | 料金 | 内容 |
|-------|------|------|
| フリー | ¥0 | ゲスト1回 / ログイン1日1回 / 10,000字まで |
| プロ | ¥9,980/月 | 1日3回 / 20,000字まで / 画像生成対応 |
| エンタープライズ | ¥49,980/月 | 1日30回 / 50,000字まで |

### ドヤバナーAI
| プラン | 料金 | 内容 |
|-------|------|------|
| おためし | ¥0 | ゲスト1日3枚 / ログイン1日9枚 |
| プロ | ¥9,980/月 | 1日30枚 / サイズ自由指定 |
| エンタープライズ | ¥49,800/月 | 1日200枚 |

## 環境変数

```env
# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=postgresql://...

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build
```

## ディレクトリ構造

```
doya-ai/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── seo/       # ドヤライティングAI
│   │   ├── banner/    # ドヤバナーAI
│   │   ├── api/       # REST API
│   │   └── admin/     # 管理画面
│   ├── components/    # Reactコンポーネント
│   └── lib/           # ユーティリティ・設定
├── prisma/            # Prismaスキーマ
└── public/            # 静的ファイル
```

## ライセンス

© 2025 ドヤAI
