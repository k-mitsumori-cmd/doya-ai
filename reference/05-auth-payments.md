# 05. 認証・決済・アクセス制御

## 認証 (NextAuth.js)

### 設定ファイル
`src/lib/auth.ts`

### プロバイダ
- **Google OAuth** のみ
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

### セッション設定
```typescript
session: {
  maxAge: 24 * 60 * 60,   // 24時間
  updateAge: 60,            // 1分ごとにDB再取得 → プラン変更即反映
}
```

### session callback
セッション更新のたびにDBから最新情報を取得:

```typescript
async session({ session, user }) {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id, role, plan, firstLoginAt,
      serviceSubscriptions: { select: { serviceId, plan } }
    }
  })

  session.user.id = dbUser.id
  session.user.role = dbUser.role || 'USER'
  session.user.plan = dbUser.plan || 'FREE'
  session.user.bannerPlan = byService['banner'] || 'FREE'
  session.user.seoPlan = byService['writing'] || byService['seo']
  session.user.interviewPlan = byService['interview']
  session.user.firstLoginAt = dbUser.firstLoginAt?.toISOString()
}
```

### signIn callback
初回ログイン時に `firstLoginAt` を記録:
```typescript
async signIn({ user, account }) {
  if (!existing?.firstLoginAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { firstLoginAt: new Date() },
    })
  }
}
```

### 認証ページ
- サインイン: `/auth/signin`
- エラー: `/auth/signin`

### 注意点
1. **ハンドラーは標準形式を維持する**
   ```typescript
   // ✅ 正しい
   import NextAuth from 'next-auth'
   import { authOptions } from '@/lib/auth'
   const handler = NextAuth(authOptions)
   export { handler as GET, handler as POST }

   // ❌ 間違い（500エラーの原因）
   // リクエストごとにauthOptionsを動的生成するとセッションが壊れる
   ```

2. **NEXTAUTH_URLは末尾スラッシュなし**
   ```
   ✅ https://doya-ai.surisuta.jp
   ❌ https://doya-ai.surisuta.jp/
   ```

3. **Google OAuth設定**
   - 承認済みリダイレクトURI: `https://doya-ai.surisuta.jp/api/auth/callback/google`

---

## 管理者認証 (Admin Auth)

ユーザー認証 (NextAuth) とは別に、管理画面 (`/admin`) 専用の認証システム。

### 前提条件
1. Prismaスキーマのマイグレーションが完了していること
2. データベースが正常に接続できること

### セットアップ手順

#### 1. 環境変数の設定

`.env.local` (またはVercel) に以下を追加:
```env
# 管理者認証用JWT秘密鍵（必須）
# NEXTAUTH_SECRETを使用することも可能
ADMIN_JWT_SECRET=your-super-secret-key-min-32-characters-long
```
※ `ADMIN_JWT_SECRET` は設定しなくても、`NEXTAUTH_SECRET` が使用される

#### 2. データベースマイグレーション
```bash
npx prisma generate
npx prisma db push
```

#### 3. 管理者ユーザーの作成
```bash
# 管理者ユーザー作成
npx tsx src/scripts/create-admin.ts <username> <password> [email] [name]

# 既存管理者の確認
npx tsx src/scripts/check-admin-users.ts

# パスワードリセット (存在しなければ作成)
npx tsx src/scripts/upsert-admin.ts <username> <password> [email] [name]
```

**パスワード要件**: 12文字以上、大文字・小文字・数字・記号を含む

### セキュリティ機能

| 機能 | 詳細 |
|------|------|
| Cloudflare Turnstile | ボット対策CAPTCHA (オプション) |
| パスワードハッシュ化 | bcrypt (12ラウンド) |
| レート制限 | 15分間に最大5回、超過で15分ロックアウト |
| JWTトークン | 24時間有効期限 |
| HTTPOnly Cookie | XSS攻撃から保護 |
| SameSite Cookie | CSRF攻撃から保護 |
| ログイン試行ログ | すべての試行を記録 |
| セッション管理 | DB管理、最大5セッション |
| タイミング攻撃対策 | ユーザー不存在時も同じ処理時間 |

### Cloudflare Turnstile (CAPTCHA) の設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Security → Turnstile
2. Add Widget → サイト名・ドメインを設定 → Managed モード
3. Site Key と Secret Key を取得

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAX...
TURNSTILE_SECRET_KEY=0x4AAAAAAAX...
REQUIRE_TURNSTILE=true  # CAPTCHAを必須にする場合
```

テスト用キー (開発時のみ):
```env
# 常に成功
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### 追加のCloudflareセキュリティ (推奨)

- **Cloudflare Access (ゼロトラスト)**: `/admin/*` へのアクセス前にCloudflare認証を要求
- **WAFルール**: 特定の国からの管理画面アクセスをブロック
  - Expression: `(http.request.uri.path contains "/admin") and (ip.geoip.country ne "JP")`

### 初期管理者の自動作成 (Bootstrap)

管理者がまだ1人も存在しない場合のみ、環境変数から初期管理者を自動作成:
```env
ADMIN_BOOTSTRAP_EMAIL=k-mitsumori@surisuta.jp
ADMIN_BOOTSTRAP_PASSWORD=StrongP@ssw0rd123!
```

### 緊急復旧ログイン (Break-glass)

既存管理者が誰もログインできない場合の緊急手段:
```env
ADMIN_BREAKGLASS_ENABLED=true
ADMIN_BREAKGLASS_EMAIL=k-mitsumori@surisuta.jp
ADMIN_BREAKGLASS_PASSWORD=StrongP@ssw0rd123!
```
※ 使い終わったら必ず `ADMIN_BREAKGLASS_ENABLED` を `false` に戻す

### データベース構造

| テーブル | 内容 |
|---------|------|
| `AdminUser` | 管理者ユーザー情報 (パスワードはハッシュ化) |
| `AdminLoginAttempt` | 全ログイン試行ログ (IP, UA, 成功/失敗) |
| `AdminSession` | アクティブセッション (トークン, 有効期限, IP) |

### Admin API エンドポイント

| メソッド | パス | 機能 |
|---------|------|------|
| POST | `/api/admin/auth/login` | 管理者ログイン |
| POST | `/api/admin/auth/logout` | 管理者ログアウト |
| GET | `/api/admin/auth/session` | セッション確認 |

### 関連ファイル
- `src/lib/admin-auth.ts` - 認証ユーティリティ
- `src/lib/admin-middleware.ts` - 認証ミドルウェア
- `src/app/api/admin/auth/*` - 認証API
- `src/app/admin/login/page.tsx` - ログインページ
- `src/scripts/create-admin.ts` - 管理者作成スクリプト

### トラブルシューティング

| 問題 | 対策 |
|------|------|
| ログインできない | パスワード確認、ロックアウト待機 (15分)、DB接続確認、`ADMIN_JWT_SECRET` 確認 |
| セッションが切れる | JWT有効期限24時間、Cookie有効化確認、HTTPS使用確認 |

---

## 決済 (Stripe)

### 設定ファイル
`src/lib/stripe.ts`

### フロー

```
1. ユーザーが /pricing でプラン選択
2. POST /api/stripe/checkout → Stripe Checkout Session作成
3. Stripe決済画面 → 成功/キャンセル
4. 成功 → Webhook受信 (POST /api/stripe/webhook)
5. Webhook → UserServiceSubscription.plan を更新
6. 次回セッション更新 (1分以内) で反映
```

### PlanId / ServiceId 型定義 (`src/lib/stripe.ts`)
```typescript
type PlanId = 'seo-pro' | 'seo-enterprise' | 'banner-basic' | 'banner-pro' |
              'banner-enterprise' | 'bundle'
type ServiceId = 'seo' | 'banner' | 'bundle'
```
※ Interview/Persona等はサービス別プランの `UserServiceSubscription` で管理されるが、Stripe PlanId型には未登録

### Stripe Price ID 環境変数

**バナー** (5プラン x 月額/年額):
```
STRIPE_PRICE_BANNER_BASIC_MONTHLY / _YEARLY
STRIPE_PRICE_BANNER_STARTER_MONTHLY / _YEARLY
STRIPE_PRICE_BANNER_PRO_MONTHLY / _YEARLY
STRIPE_PRICE_BANNER_BUSINESS_MONTHLY / _YEARLY
STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY / _YEARLY
```

**SEO** (2プラン x 月額/年額):
```
STRIPE_PRICE_SEO_PRO_MONTHLY / _YEARLY
STRIPE_PRICE_SEO_ENTERPRISE_MONTHLY / _YEARLY
```

**インタビュー** (2プラン x 月額/年額):
```
STRIPE_PRICE_INTERVIEW_PRO_MONTHLY / _YEARLY
STRIPE_PRICE_INTERVIEW_ENTERPRISE_MONTHLY / _YEARLY
```

**バンドル** (月額/年額):
```
STRIPE_PRICE_BUNDLE_MONTHLY / _YEARLY
```

**レガシー (NEXT_PUBLIC_ プレフィックス版)**:
```
NEXT_PUBLIC_STRIPE_KANTAN_PRO_PRICE_ID
NEXT_PUBLIC_STRIPE_BANNER_PRO_PRICE_ID / _ENTERPRISE_PRICE_ID
NEXT_PUBLIC_STRIPE_SEO_PRO_PRICE_ID / _ENTERPRISE_PRICE_ID
NEXT_PUBLIC_STRIPE_INTERVIEW_PRO_PRICE_ID / _ENTERPRISE_PRICE_ID
```

### 主要関数 (`src/lib/stripe.ts`)
| 関数 | 説明 |
|-----|------|
| `createCheckoutSession()` | Checkout Session作成 (subscription/payment) |
| `createCustomerPortalSession()` | カスタマーポータルセッション |
| `getPlanIdFromStripePriceId()` | Stripe価格ID → PlanId変換 |
| `getServiceIdFromPlanId()` | PlanId → ServiceId抽出 |
| `getOrCreateCustomer()` | Stripeカスタマー取得・作成 |
| `getSubscription()` | サブスクリプション詳細取得 |
| `cancelSubscription()` | サブスクリプション解約 (期末キャンセル) |
| `resumeSubscription()` | 解約予定を取り消し |
| `constructWebhookEvent()` | Webhook署名検証 |

### Checkout Session設定
- モード: `subscription` (デフォルト) / `payment`
- 決済方法: クレジットカードのみ
- ロケール: `ja` (日本語)
- 税金: 無効 (税込み価格)
- メタデータ: `{ app: 'doya-ai' }`

### 決済成功後のリダイレクト
```
seo      → /seo?success=true&plan=pro&session_id=xxx
banner   → /banner?success=true&plan=pro&session_id=xxx
interview → /interview/projects?success=true&plan=pro&session_id=xxx
```

### カスタマーポータル
`POST /api/stripe/portal` → Stripe Customer Portal URL
- 支払い方法更新: 有効
- 請求履歴表示: 有効
- サブスク解約: 有効 (期末キャンセル, 理由入力付き)
- プラン変更: 有効 (アップ/ダウン両方)

### バンドルプラン (BUNDLE_PRICING)
```typescript
// src/lib/pricing.ts 行579-594
export const BUNDLE_PRICING = {
  name: 'ドヤAI オールインワン',
  price: 5980,          // ¥5,980/月 (約25%OFF)
  originalPrice: '¥7,980',
  features: [
    'ドヤライティングAI プロ',
    'ドヤバナーAI プロ',
    '今後追加される新サービスも利用可能',
    '優先サポート',
  ],
}
// 年間プラン割引: ANNUAL_DISCOUNT = 0.20 (20%OFF)
```

### 新しいサービス/プランを追加する手順

1. **`src/lib/stripe.ts` に Price ID を追加**
   - `STRIPE_PRICE_IDS.<service>.<plan>.{monthly,yearly}` を追加
   - `PlanId` 型に `<service>-<plan>` を追加
   - `getPlanIdFromStripePriceId()` の entries に追加

2. **料金UI (Pricing Page) で `CheckoutButton` を配置**
   - `CheckoutButton` に `planId` を渡すだけでOK

3. **checkout API が planId から priceId を引けることを確認**
   - `src/app/api/stripe/checkout/route.ts`

4. **Webhook のDB反映が serviceId/planId を正しく認識することを確認**
   - `src/app/api/stripe/webhook/route.ts`

### よくある詰まりポイント

| 問題 | 原因 | 対策 |
|------|------|------|
| 決済エラー | test/liveモード不一致 | 全Stripe設定を同一モードに統一 |
| Price ID の取り違え | Test/LiveでIDが違う | 環境変数を分ける |
| Webhook Secret 未設定 | 署名検証で必ず失敗 | `STRIPE_WEBHOOK_SECRET` を設定 |
| callbackUrl のずれ | 戻り先URL不一致 | `NEXT_PUBLIC_APP_URL` を本番URLに合わせる |
| プラン反映されない | Webhook未到達 | `/api/stripe/sync/latest` で手動同期 |

### 実装ファイル一覧
- 価格IDの定義: `src/lib/stripe.ts`
- Checkout Session 作成: `src/app/api/stripe/checkout/route.ts`
- Webhook (サブスク反映): `src/app/api/stripe/webhook/route.ts`
- 料金ページ: `src/app/seo/pricing/page.tsx` / `src/app/banner/**/plan/page.tsx`

---

## アクセス制御

### 料金設定の一元管理
**`src/lib/pricing.ts`** で全サービスの制限を定義。

### 日次利用制限

| サービス | ゲスト | 無料 | PRO | Enterprise |
|---------|--------|------|-----|-----------|
| カンタンマーケ | 3回/日 | 10回/日 | 100回/日 | 要相談 |
| SEO記事 | 合計1回 | 1回/日 | 3回/日 | 30回/日 |
| バナー | 3枚/日 | 9枚/日 | 30枚/日 | 200枚/日 |
| ペルソナ | 2回/日 | 5回/日 | 30回/日 | - |
| インタビュー | 2回/日 | 5回/日 | 30回/日 | 100回/日 |
| 診断 | 1回/日 | 3回/日 | 20回/日 | - |

### 制限チェック関数

```typescript
// 各サービス専用
getSeoDailyLimitByUserPlan(plan)       // → number
getBannerDailyLimitByUserPlan(plan)    // → number
getPersonaDailyLimitByUserPlan(plan)   // → number
getShindanDailyLimitByUserPlan(plan)   // → number
getInterviewLimitsByPlan(plan)         // → { transcriptionMinutes, uploadSizeLimit }

// 共通
isWithinFreeHour(firstLoginAt)         // 初回ログイン1時間以内?
getFreeHourRemainingMs(firstLoginAt)   // 残りms
shouldResetDailyUsage(lastReset)       // 日次リセット必要?
getTodayDateJST()                      // JST基準の今日
```

### テスト用制限無効化
```
DOYA_DISABLE_LIMITS=1           # 全サービス無効化
SEO_DISABLE_LIMITS=1            # SEOのみ
BANNER_DISABLE_LIMITS=1         # バナーのみ
PERSONA_DISABLE_LIMITS=1        # ペルソナのみ
INTERVIEW_DISABLE_LIMITS=1      # インタビューのみ
SHINDAN_DISABLE_LIMITS=1        # 診断のみ
```

### 初回ログイン1時間生成し放題

```typescript
export function isWithinFreeHour(firstLoginAt: string | null | undefined): boolean {
  if (!firstLoginAt) return false
  const elapsed = Date.now() - new Date(firstLoginAt).getTime()
  return elapsed < 60 * 60 * 1000  // 1時間
}
```

### ゲストアクセス

サービスごとにCookieベースのゲストIDを使用:
```
guest_id                      — 共通ゲストID
doya_persona_guest_usage      — ペルソナ回数
doya_persona_guest_portrait   — ポートレート回数
doya_persona_guest_banner     — バナー回数
```

- SEO: `seoAccess.ts` の `getGuestIdFromRequest()` / `ensureGuestId()`
- Interview: `interview/access.ts`
- Persona: Cookie直接操作

### 日次リセット (JST 00:00基準)

```typescript
export function getTodayDateJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)  // 'YYYY-MM-DD'
}
```