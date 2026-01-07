# ドヤバナー

ワンボタンでプロ品質のバナーを自動生成するWebアプリ

## 🚀 機能

- **ワンボタン生成**: テンプレート選択→キーワード入力→生成
- **A/B/C 3案同時生成**: ベネフィット・緊急性・社会的証明の3パターン
- **豊富なテンプレート**: 通信・マーケティング・EC・採用向け
- **サイズプリセット**: SNS広告、ディスプレイ広告など
- **ブランドキット**: ロゴ・カラー・フォント設定
- **履歴管理**: 生成済みバナーの閲覧・ダウンロード

## 💰 料金プラン

| プラン | 価格 | 生成上限 |
|--------|------|----------|
| 無料 | ¥0 | 1日1枚 |
| プロ | ¥9,980/月 | 無制限 |

## 🛠 技術スタック

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Storage**: Cloudflare R2
- **Payment**: Stripe
- **Deploy**: Vercel

## 📦 セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

`.env.local` を作成:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

# NanoBananaPro API
NANOBANANAPRO_API_KEY="..."
NANOBANANAPRO_API_URL="https://api.nanobananapro.com/v1"

# Cloudflare R2
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="doya-banner"
R2_PUBLIC_URL="https://..."
```

### 3. データベース初期化

```bash
npx prisma db push
```

### 4. 開発サーバー起動

```bash
npm run dev
```

## 📁 ディレクトリ構成

```
src/
├── app/
│   ├── (auth)/          # 認証関連
│   ├── (main)/          # メインアプリ
│   │   └── app/
│   │       ├── page.tsx         # ダッシュボード
│   │       ├── result/          # 生成結果
│   │       ├── history/         # 履歴
│   │       ├── brand/           # ブランドキット
│   │       └── billing/         # 課金
│   ├── api/
│   │   ├── auth/               # 認証API
│   │   ├── generate/           # 生成API
│   │   ├── templates/          # テンプレートAPI
│   │   ├── history/            # 履歴API
│   │   ├── brand/              # ブランドAPI
│   │   └── stripe/             # Stripe API
│   └── page.tsx                # LP
├── components/
├── lib/
│   ├── prisma.ts              # Prismaクライアント
│   ├── auth.ts                # NextAuth設定
│   ├── stripe.ts              # Stripe設定
│   ├── quota.ts               # クォータ管理
│   ├── storage.ts             # R2ストレージ
│   ├── prompt-builder.ts      # プロンプト生成
│   └── nanobananapro/         # API抽象化
└── types/
```

## 🔧 Stripe Webhook設定

ローカル開発:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

本番: Stripeダッシュボードで以下のイベントを設定:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

## 📝 ライセンス

MIT

