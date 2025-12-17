# カンタンドヤAI

文章作成がカンタンになるAIツール

## 概要

テンプレートを選んで情報を入れるだけで、AIが文章を作ります。

- ビジネスメール
- SNS投稿
- キャッチコピー
- ブログ記事
- 提案書
- など68種類のテンプレート

## 技術スタック

- **フロントエンド**: Next.js 14, React 18, Tailwind CSS
- **認証**: NextAuth.js (Google OAuth)
- **データベース**: PostgreSQL (Supabase)
- **決済**: Stripe
- **AI**: OpenAI GPT-4

## 料金プラン

### 無料プラン（¥0）
- 1日10回まで生成
- 全68種類のテンプレート
- 履歴保存

### プレミアム（¥2,980/月）
- 1日100回まで生成
- 全テンプレート使い放題
- 優先サポート

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
│   ├── components/    # Reactコンポーネント
│   └── lib/           # ユーティリティ・設定
├── prisma/            # Prismaスキーマ
└── public/            # 静的ファイル
```

## ライセンス

© 2024 カンタンドヤAI
