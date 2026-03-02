# 08. 環境変数一覧

## 必須

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL接続URL (Supabase) | `postgresql://...` |
| `NEXTAUTH_SECRET` | NextAuth暗号化キー | ランダム文字列 |
| `NEXTAUTH_URL` | アプリURL | `https://doya.ai` |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth シークレット | `GOCSPX-xxx` |
| `GOOGLE_GENAI_API_KEY` | Gemini API キー | `AIza...` |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名キー | `whsec_xxx` |

## AI API

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `GOOGLE_GENAI_API_KEY` | Gemini API キー (メイン) | - |
| `GEMINI_API_KEY` | Gemini API キー (別名) | - |
| `OPENAI_API_KEY` | OpenAI API キー (fallback) | - |
| `ASSEMBLYAI_API_KEY` | AssemblyAI キー (文字起こし) | - |
| `DOYA_BANNER_IMAGE_MODEL` | バナー画像生成モデル | `gemini-3-pro-image-preview` |
| `SEO_GEMINI_TEXT_MODEL` | SEOテキスト生成モデル | `gemini-2.0-flash` |
| `SEO_GEMINI_TEXT_MODEL_TITLE_SUGGESTIONS` | タイトル提案モデル | (SEO_GEMINI_TEXT_MODEL) |

## Supabase / ストレージ

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (クライアント) | - |
| `SUPABASE_URL` | Supabase URL (サーバー) | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー | - |
| `INTERVIEW_STORAGE_BUCKET` | インタビュー素材バケット名 | `interview-materials` |
| `INTERVIEW_MAX_FILE_SIZE_MB` | 最大ファイルサイズ (MB) | `5120` (5GB) |

## Stripe (決済)

### 基本
| 変数名 | 説明 |
|--------|------|
| `STRIPE_SECRET_KEY` | Stripeシークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名キー |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開キー |

### バナー価格ID (5プラン x 月額/年額)
| 変数名 | 説明 |
|--------|------|
| `STRIPE_PRICE_BANNER_BASIC_MONTHLY` / `_YEARLY` | バナー Basic |
| `STRIPE_PRICE_BANNER_STARTER_MONTHLY` / `_YEARLY` | バナー Starter |
| `STRIPE_PRICE_BANNER_PRO_MONTHLY` / `_YEARLY` | バナー PRO |
| `STRIPE_PRICE_BANNER_BUSINESS_MONTHLY` / `_YEARLY` | バナー Business |
| `STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY` / `_YEARLY` | バナー Enterprise |

### SEO価格ID (2プラン x 月額/年額)
| 変数名 | 説明 |
|--------|------|
| `STRIPE_PRICE_SEO_PRO_MONTHLY` / `_YEARLY` | SEO PRO |
| `STRIPE_PRICE_SEO_ENTERPRISE_MONTHLY` / `_YEARLY` | SEO Enterprise |

### インタビュー価格ID (2プラン x 月額/年額)
| 変数名 | 説明 |
|--------|------|
| `STRIPE_PRICE_INTERVIEW_PRO_MONTHLY` / `_YEARLY` | インタビュー PRO |
| `STRIPE_PRICE_INTERVIEW_ENTERPRISE_MONTHLY` / `_YEARLY` | インタビュー Enterprise |

### バンドル価格ID
| 変数名 | 説明 |
|--------|------|
| `STRIPE_PRICE_BUNDLE_MONTHLY` / `_YEARLY` | オールインワンバンドル (¥5,980/月) |

### レガシー (NEXT_PUBLIC_ プレフィックス版)
| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_STRIPE_KANTAN_PRO_PRICE_ID` | カンタンマーケ PRO |
| `NEXT_PUBLIC_STRIPE_BANNER_PRO_PRICE_ID` | バナー PRO |
| `NEXT_PUBLIC_STRIPE_BANNER_ENTERPRISE_PRICE_ID` | バナー Enterprise |
| `NEXT_PUBLIC_STRIPE_SEO_PRO_PRICE_ID` | SEO PRO |
| `NEXT_PUBLIC_STRIPE_SEO_ENTERPRISE_PRICE_ID` | SEO Enterprise |
| `NEXT_PUBLIC_STRIPE_INTERVIEW_PRO_PRICE_ID` | インタビュー PRO |
| `NEXT_PUBLIC_STRIPE_INTERVIEW_ENTERPRISE_PRICE_ID` | インタビュー Enterprise |

## Cronジョブ

| 変数名 | 説明 |
|--------|------|
| `CRON_SECRET` | Cronジョブの認証シークレット (Vercel Cron → APIルートの Bearer トークン) |

## Slack通知

Webhook URLは環境変数ではなく、DBの `SystemSetting` テーブルで管理:
```sql
-- key: 'slack_webhook', value: 'https://hooks.slack.com/services/...'
```

## アプリ設定

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `NEXT_PUBLIC_APP_URL` | アプリのベースURL | リクエストorigin |
| `NODE_ENV` | 実行環境 | `production` |
| `SLIDE_HOSTS` | スライド専用ドメイン (カンマ区切り) | (未設定=無効) |

## 制限無効化 (テスト用)

| 変数名 | 説明 |
|--------|------|
| `DOYA_DISABLE_LIMITS` | `1` で全サービス制限無効化 |
| `SEO_DISABLE_LIMITS` | `1` でSEOのみ無効化 |
| `BANNER_DISABLE_LIMITS` | `1` でバナーのみ無効化 |
| `PERSONA_DISABLE_LIMITS` | `1` でペルソナのみ無効化 |
| `INTERVIEW_DISABLE_LIMITS` | `1` でインタビューのみ無効化 |
| `SHINDAN_DISABLE_LIMITS` | `1` で診断のみ無効化 |

## 管理画面

| 変数名 | 説明 |
|--------|------|
| `ADMIN_JWT_SECRET` | 管理者JWT秘密鍵 (未設定時は NEXTAUTH_SECRET を使用) |
| `ADMIN_USERNAME` | 管理者ユーザー名 |
| `ADMIN_PASSWORD_HASH` | 管理者パスワードハッシュ (bcrypt) |
| `ADMIN_BOOTSTRAP_EMAIL` | 初期管理者メール (管理者0人の場合のみ自動作成) |
| `ADMIN_BOOTSTRAP_PASSWORD` | 初期管理者パスワード |
| `ADMIN_BREAKGLASS_ENABLED` | 緊急復旧ログイン有効化 |
| `ADMIN_BREAKGLASS_EMAIL` | 緊急復旧メール |
| `ADMIN_BREAKGLASS_PASSWORD` | 緊急復旧パスワード |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile シークレットキー (管理画面CAPTCHA) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile サイトキー |
| `REQUIRE_TURNSTILE` | `true` でCAPTCHA必須化 |

## Google Slides (スライド生成)

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_SLIDES_CLIENT_EMAIL` | Google Slides API サービスアカウント |
| `GOOGLE_SLIDES_PRIVATE_KEY` | Google Slides API 秘密鍵 |

## Google Cloud / GCS

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントJSON |
| `GOOGLE_CLOUD_PROJECT_ID` | GCPプロジェクトID |
| `GOOGLE_PAGESPEED_API_KEY` | PageSpeed Insights APIキー |
| `GCS_BUCKET_NAME` | Google Cloud Storageバケット名 |

## SEO追加

| 変数名 | 説明 |
|--------|------|
| `SEO_SERPAPI_KEY` | SerpAPI キー (検索結果取得) |

## Cloud Run

| 変数名 | 説明 |
|--------|------|
| `CLOUDRUN_TRANSCRIBE_SERVICE_URL` | Cloud Run文字起こしサービスURL |

## Vercel

| 変数名 | 説明 |
|--------|------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blobストレージトークン |

## Stripe追加

| 変数名 | 説明 |
|--------|------|
| `STRIPE_PORTAL_CONFIGURATION_ID` | カスタマーポータル設定ID |
| `STRIPE_PRODUCT_BANNER_ID` | バナー商品ID |

## Google Analytics

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager ID |

## お問い合わせ

`src/lib/pricing.ts` 内の定数:
```typescript
export const SUPPORT_CONTACT_URL = '...'      // サポート連絡先
export const HIGH_USAGE_CONTACT_URL = '...'   // 大量利用相談
```

---

## セットアップ手順

### ローカル開発の最小構成

一括生成のみであれば、以下の **2つ** で十分:

| 変数 | 取得方法 |
|------|---------|
| `DATABASE_URL` | Supabase: プロジェクト設定 → Database → Connection string |
| `GOOGLE_GENAI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) → Get API key → Create |

### DATABASE_URL の接続例

```bash
# Supabase
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=public

# Vercel Postgres
DATABASE_URL=postgres://default:password@xxxxx.vercel-storage.com:5432/verceldb

# Neon
DATABASE_URL=postgresql://user:password@xxxx.neon.tech/neondb?schema=public

# ローカルPostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/doya_ai?schema=public
```

### セットアップ手順

```bash
# 1. 環境変数ファイルを作成
cd doya-ai
cp env.example.txt .env.local

# 2. .env.local を編集して DATABASE_URL と GOOGLE_GENAI_API_KEY を設定

# 3. 設定の確認
node -e "require('dotenv').config({ path: '.env.local' }); console.log('DATABASE_URL:', process.env.DATABASE_URL ? '設定済み' : '未設定'); console.log('GOOGLE_GENAI_API_KEY:', process.env.GOOGLE_GENAI_API_KEY ? '設定済み' : '未設定');"

# 4. 開発サーバー起動
npm run dev
```

### トラブルシューティング

| エラー | 対策 |
|--------|------|
| `Invalid value undefined for datasource` | `DATABASE_URL` が正しく設定されているか確認。`.env.local` が `doya-ai` ディレクトリに存在するか確認 |
| `バナーが生成されませんでした` | `GOOGLE_GENAI_API_KEY` が正しく設定されているか確認。APIキーが有効か確認 (Google AI Studio) |
| 環境変数が読み込まれない | `.env.local` が `doya-ai` ルートに存在するか確認。ローカルサーバーを再起動 |