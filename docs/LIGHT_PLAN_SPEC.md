# ライトプラン（LIGHT）開発ドキュメント

> 最終更新: 2026-03-06 v2

## 1. 概要

全サービス共通で ¥2,980/月 の中間プランを追加。
プラン階層: `GUEST → FREE → LIGHT (¥2,980) → PRO (¥9,980) → ENTERPRISE (¥49,800)`

### 1.1 設計原則

- **統一課金**: 1つのサービスで LIGHT を購入すると、全サービスが LIGHT レベルになる
- **単一環境変数**: `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` を設定すれば全サービスで動作
- **既存フローへの追加**: checkout / webhook / sync の3箇所に LIGHT 判定を挿入

---

## 2. プラン体系

### 2.1 サービス別制限値

| サービス | FREE | LIGHT (¥2,980) | PRO (¥9,980) | ENTERPRISE (¥49,800) |
|---------|------|-----------------|--------------|----------------------|
| banner | 月15枚 | 月50枚 | 1日30枚 | 1日200枚 |
| seo | 1日3回 | 月10回 | 1日30回 | 1日200回 |
| interview | 1日5回 | 1日10回 | 1日30回 | 無制限 |
| copy | 月10回 | 月50回 | 月200回 | 月1000回 |
| lp | 月3ページ | 月10ページ | 月30ページ | 月100ページ |
| voice | 月10回 | 月50回 | 月200回 | 月1000回 |
| movie | 月3本 | 月10本 | 月30本 | 月200本 |
| persona | 1日5回 | 1日15回 | 1日50回 | 1日200回 |
| opening | 1日3回 | 1日15回 | 1日30回 | 1日100回 |
| shindan | 1日3回 | 1日10回 | 1日30回 | 1日100回 |

### 2.2 LIGHT で使えない機能（PRO以上限定）

- SEO: 画像生成（図解/バナー自動生成）→ `canUseSeoImages()` で PRO 以上チェック
- banner: サイズ自由指定 → LIGHT は 1080x1080 固定
- movie: 最大尺 30秒（PRO は 60秒）

---

## 3. ファイル構成

### 3.1 バックエンド（Stripe決済）

```
src/lib/stripe.ts                    # Stripe Price ID 定義 / PlanId 型 / マッピング
src/lib/pricing.ts                   # 各サービスの制限値定数 / lightLimit
src/lib/services.ts                  # Service 型定義 / light pricing
src/app/api/stripe/checkout/route.ts # Checkout Session 作成
src/app/api/stripe/webhook/route.ts  # Webhook ハンドラ（DB更新）
src/app/api/stripe/sync/route.ts     # 同期API（Webhook遅延の保険）
```

### 3.2 アクセス制御

```
src/lib/seoAccess.ts                 # SeoPlanCode 型 / seoMonthlyArticleLimit()
src/lib/interview/types.ts           # InterviewPlanCode 型
src/lib/interview/access.ts          # normalizePlan() / interviewDailyLimit()
src/lib/movie/access.ts              # getMovieMonthlyLimit()
src/lib/opening/usage.ts             # getOpeningDailyLimit()
src/lib/tenkai/access.ts             # TenkaiPlanCode 型 / PLAN_LIMITS
```

### 3.3 料金ページ UI

```
src/app/pricing/page.tsx             # グローバル料金ページ（バナー中心）
src/app/banner/pricing/page.tsx      # バナー料金ページ
src/app/seo/pricing/page.tsx         # SEO料金ページ
src/app/copy/pricing/page.tsx        # コピー料金ページ（COPY_PRICING.plans で動的生成）
src/app/movie/pricing/page.tsx       # 動画料金ページ（比較表あり）
src/app/voice/pricing/page.tsx       # 音声料金ページ（VOICE_PRICING.plans で動的生成）
src/app/lp/pricing/page.tsx          # LP料金ページ（比較表あり）
src/app/banner/dashboard/plan/page.tsx  # バナーダッシュボード プラン管理
src/app/seo/dashboard/plan/page.tsx     # SEOダッシュボード プラン管理
```

### 3.4 サイドバー

```
src/components/DashboardSidebar.tsx       # バナー用
src/components/SeoSidebar.tsx             # SEO用
src/components/CopySidebar.tsx            # コピー用
src/components/LpSidebar.tsx              # LP用
src/components/PersonaSidebar.tsx         # ペルソナ用
src/components/ShindanSidebar.tsx         # Web診断用
src/components/interview/InterviewSidebar.tsx  # インタビュー用
src/components/movie/MovieSidebar.tsx     # 動画用
src/components/voice/VoiceSidebar.tsx     # 音声用
```

---

## 4. 決済フロー詳細

### 4.1 購入フロー

```
[ユーザー] → "ライトプランを始める" クリック
    ↓
[CheckoutButton] → POST /api/stripe/checkout
    body: { planId: "banner-light", billingPeriod: "monthly" }
    ↓
[checkout/route.ts]
    getPriceId("banner-light", "monthly")
    → STRIPE_PRICE_IDS.banner.light.monthly
    → process.env.STRIPE_PRICE_BANNER_LIGHT_MONTHLY
    ↓
[Stripe Checkout Session] 作成 → リダイレクト
    ↓
[決済完了]
    ↓
[webhook/route.ts] ← Stripe Webhook
    customer.subscription.created / updated
    → updateUserSubscription()
    → getPlanIdFromStripePriceId(priceId) → "banner-light"
    → planId.endsWith('-light') → userPlan = 'LIGHT'
    → user.plan = 'LIGHT' (DB保存)
    → 全サービスの userServiceSubscription.plan = 'LIGHT'
    ↓
[sync/route.ts] ← 決済直後の保険（Webhook遅延対策）
    POST /api/stripe/sync { sessionId }
    → 同じロジックで LIGHT 判定 & DB保存
```

### 4.2 PlanId マッピング

| planId | Stripe Price ID 環境変数 | フォールバック |
|--------|------------------------|---------------|
| banner-light | `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` | - |
| seo-light | `STRIPE_PRICE_SEO_LIGHT_MONTHLY` | → `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` |
| interview-light | `STRIPE_PRICE_INTERVIEW_LIGHT_MONTHLY` | → `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` |
| copy-light | `STRIPE_PRICE_COPY_LIGHT_MONTHLY` | → `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` |
| lp-light | `STRIPE_PRICE_LP_LIGHT_MONTHLY` | → `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` |
| voice-light | `STRIPE_PRICE_VOICE_LIGHT_MONTHLY` | → `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` |
| movie-light | `STRIPE_PRICE_MOVIE_LIGHT_MONTHLY` | → `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` |

### 4.3 必須環境変数

```env
# 最低限これ1つだけ設定すれば全サービスで動作
STRIPE_PRICE_BANNER_LIGHT_MONTHLY=price_xxxxxxxxxxxxxxx
```

---

## 5. 共通ユーティリティ (`src/lib/plan-utils.ts`)

### 5.0 共通モジュール（必ず使用すること）

各ページでプラン判定ロジックをローカル定義すると LIGHT の漏れが発生する。
**必ず `src/lib/plan-utils.ts` のヘルパーを使うこと。**

```typescript
import { tierFrom, planLabel, planBadge, planPrice, isPaidTier, tierFromPlanId } from '@/lib/plan-utils'
import type { PlanTier } from '@/lib/plan-utils'
```

| 関数 | 用途 | 例 |
|------|------|---|
| `tierFrom(raw)` | 生文字列 → PlanTier 正規化 | `tierFrom('BANNER_PRO') → 'PRO'` |
| `planLabel(tier)` | 日本語表示ラベル | `planLabel('LIGHT') → 'ライト'` |
| `planBadge(tier)` | バッジの text + CSS | `planBadge('LIGHT') → { text: 'LIGHT', cls: 'bg-blue-500...' }` |
| `planPrice(tier)` | 月額料金（円） | `planPrice('LIGHT') → 2980` |
| `isPaidTier(tier)` | 有料プランか？ | `isPaidTier('LIGHT') → true` |
| `tierFromPlanId(id)` | planId文字列 → PlanTier | `tierFromPlanId('banner-light') → 'LIGHT'` |

### 5.1 プラン判定（サイドバー共通パターン）

```typescript
// 推奨: plan-utils.ts の tierFrom() を使用
import { tierFrom } from '@/lib/plan-utils'

const tier = tierFrom(
  (session?.user as any)?.{service}Plan ||
  (session?.user as any)?.plan ||
  (isLoggedIn ? 'FREE' : 'GUEST')
)
```

> **注意**: `{service}Plan` は各サービス固有のプランフィールド名に置換する
> （例: `bannerPlan`, `seoPlan`, `copyPlan`, `interviewPlan` 等）

### 5.2 次の推奨プラン（サイドバー共通）

```typescript
const nextPlanLabel = (() => {
  if (planLabel === 'GUEST' || planLabel === 'FREE') return 'LIGHT'
  if (planLabel === 'LIGHT') return 'PRO'
  if (planLabel === 'PRO') return 'ENTERPRISE'
  return null  // ENTERPRISE は推奨なし
})()
```

### 5.3 アクセス制御ヘルパー（pricing.ts共通パターン）

```typescript
export function get{Service}LimitByUserPlan(plan: string | null | undefined): number {
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return {SERVICE}_PRICING.enterpriseLimit ?? 200
  if (p === 'PRO') return {SERVICE}_PRICING.proLimit
  if (p === 'LIGHT') return {SERVICE}_PRICING.lightLimit ?? 10
  if (p === 'FREE') return {SERVICE}_PRICING.freeLimit
  return {SERVICE}_PRICING.guestLimit ?? 3
}
```

### 5.4 料金カード UI（LIGHT カード共通デザイン）

```tsx
<div className="rounded-3xl bg-blue-50 border border-blue-200 p-8">
  <h2 className="text-2xl font-black text-slate-900">ライトプラン</h2>
  <p className="text-sm text-slate-600 mt-2">...</p>
  <div className="px-6 py-4 rounded-2xl bg-white text-blue-700 font-black text-xl">
    ¥2,980/月
  </div>
  <CheckoutButton
    planId="{service}-light"
    loginCallbackUrl="/{service}/pricing"
    className="w-full py-4 rounded-2xl text-base"
    variant="primary"
  >
    ライトプランを始める
  </CheckoutButton>
</div>
```

### 5.5 Webhook での LIGHT 判定

```typescript
// webhook/route.ts - updateUserSubscription()
} else if (planId.endsWith('-light')) {
  userPlan = 'LIGHT'
}

// sync/route.ts - servicePlan 判定
: planId.endsWith('-light')
  ? 'LIGHT'
  : 'FREE'
```

---

## 6. 型定義

### 6.1 PlanId 型（stripe.ts）

```typescript
export type PlanId =
  | 'bundle'
  | 'seo-light' | 'seo-pro' | 'seo-enterprise'
  | 'banner-light' | 'banner-pro' | 'banner-basic' | 'banner-starter'
  | 'banner-business' | 'banner-enterprise'
  | 'interview-light' | 'interview-pro' | 'interview-enterprise'
  | 'copy-light' | 'copy-pro' | 'copy-enterprise'
  | 'lp-light' | 'lp-pro' | 'lp-enterprise'
  | 'voice-light' | 'voice-pro' | 'voice-enterprise'
  | 'movie-light' | 'movie-pro' | 'movie-enterprise'
```

### 6.2 アクセス制御型

```typescript
// seoAccess.ts
export type SeoPlanCode = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

// interview/types.ts
export type InterviewPlanCode = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

// tenkai/access.ts
export type TenkaiPlanCode = 'FREE' | 'LIGHT' | 'STARTER' | 'PRO' | 'ENTERPRISE'
```

### 6.3 Service 型（services.ts）

```typescript
interface ServicePricing {
  limit: string
  dailyLimit: number
  price: number
}

interface Service {
  pricing: {
    free: ServicePricing
    light?: ServicePricing   // ← 追加
    pro: ServicePricing
    enterprise?: ServicePricing
  }
}
```

---

## 7. DB スキーマ

### 7.1 関連テーブル

```
User
  plan: String           # 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE' | 'BUNDLE'
  stripeCustomerId: String?
  stripeSubscriptionId: String?
  stripePriceId: String?
  stripeCurrentPeriodEnd: DateTime?

UserServiceSubscription
  userId: String
  serviceId: String       # 'banner' | 'seo' | 'interview' | ...
  plan: String            # 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'
  stripeSubscriptionId: String?
  stripePriceId: String?
  stripeCurrentPeriodEnd: DateTime?
  dailyUsage: Int
  monthlyUsage: Int
  lastUsageReset: DateTime
```

### 7.2 統一課金の DB 更新

Webhook で LIGHT 購入時、以下が実行される：

```typescript
// 1. グローバル plan を更新
await prisma.user.update({
  where: { id: userId },
  data: { plan: 'LIGHT', ... }
})

// 2. 全サービスの subscription を LIGHT に更新
const allServiceIds = ['banner', 'seo', 'interview', 'persona',
  'kantan', 'copy', 'voice', 'movie', 'lp', 'opening', 'shindan', 'tenkai']
for (const serviceId of allServiceIds) {
  await prisma.userServiceSubscription.upsert({
    where: { userId_serviceId: { userId, serviceId } },
    create: { ..., plan: 'LIGHT' },
    update: { plan: 'LIGHT' }
  })
}
```

---

## 8. テスト手順

### 8.1 Stripe テストモード確認

1. テストモードで Stripe に LIGHT 商品（¥2,980/月）を作成
2. 環境変数 `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` に Price ID を設定
3. 各料金ページで「ライトプランを始める」をクリック
4. Stripe Checkout に遷移 → テストカード（4242...）で決済
5. リダイレクト後、DB の `user.plan = 'LIGHT'` を確認
6. 全サービスの `userServiceSubscription.plan = 'LIGHT'` を確認

### 8.2 UI 確認チェックリスト

- [ ] `/pricing` - LIGHT カード表示、CTA ボタン動作
- [ ] `/banner/pricing` - LIGHT カード表示
- [ ] `/seo/pricing` - LIGHT カード表示
- [ ] `/copy/pricing` - 4カード表示（グリッド崩れなし）
- [ ] `/movie/pricing` - 比較表の横スクロール（スマホ）
- [ ] `/voice/pricing` - 4カード表示
- [ ] `/lp/pricing` - 比較表の横スクロール
- [ ] 各サイドバー - FREE ユーザーに「ライト推奨」表示
- [ ] 各サイドバー - LIGHT ユーザーに「PRO推奨」表示

### 8.3 レスポンシブ確認（375px）

- [ ] 料金カードが1列に折りたたまれる
- [ ] 比較表が横スクロール可能
- [ ] ボタンのタップ領域が十分（44px以上）
- [ ] テキストがはみ出さない

---

## 9. 修正ファイル一覧（全30ファイル）

| カテゴリ | ファイル | 変更内容 |
|---------|---------|---------|
| Stripe | `src/app/api/stripe/checkout/route.ts` | getPriceId() に7サービスのLIGHTマッピング追加 |
| Stripe | `src/app/api/stripe/webhook/route.ts` | updateUserSubscription() にLIGHT判定追加 |
| Stripe | `src/app/api/stripe/sync/route.ts` | servicePlan/userPlan判定にLIGHT追加 |
| 型定義 | `src/lib/services.ts` | Service型にlight pricing追加、全10サービスの値定義 |
| アクセス | `src/lib/seoAccess.ts` | SeoPlanCode型、seoMonthlyArticleLimit()にLIGHT |
| アクセス | `src/lib/interview/types.ts` | InterviewPlanCode型にLIGHT |
| アクセス | `src/lib/interview/access.ts` | normalizePlan()、interviewDailyLimit()にLIGHT |
| アクセス | `src/lib/movie/access.ts` | getMovieMonthlyLimit()にLIGHT |
| アクセス | `src/lib/opening/usage.ts` | getOpeningDailyLimit()にLIGHT |
| アクセス | `src/lib/tenkai/access.ts` | TenkaiPlanCode型、PLAN_LIMITSにLIGHT |
| UI | `src/app/pricing/page.tsx` | LIGHTカード追加、LIGHT検出、handleSubscribeLight |
| UI | `src/app/banner/pricing/page.tsx` | LIGHTカード追加、planTier判定 |
| UI | `src/app/banner/dashboard/plan/page.tsx` | LIGHTカード追加、グリッド4列化 |
| UI | `src/app/seo/pricing/page.tsx` | LIGHTカード追加、planTier判定 |
| UI | `src/app/seo/dashboard/plan/page.tsx` | LIGHTアップグレードセクション追加 |
| UI | `src/app/copy/pricing/page.tsx` | グリッドレスポンシブ修正 |
| UI | `src/app/movie/pricing/page.tsx` | LIGHTカラム追加、テーブル横スクロール対応 |
| UI | `src/app/voice/pricing/page.tsx` | scale修正、リンク先修正 |
| Sidebar | `src/components/DashboardSidebar.tsx` | LIGHT検出、ライト推奨バナー |
| Sidebar | `src/components/SeoSidebar.tsx` | LIGHT検出、ライト推奨バナー |
| Sidebar | `src/components/CopySidebar.tsx` | copyPlan取得修正、LIGHT検出追加 |
| Sidebar | `src/components/LpSidebar.tsx` | LIGHT検出、ライト推奨バナー |
| Sidebar | `src/components/PersonaSidebar.tsx` | LIGHT検出、ライト推奨バナー |
| Sidebar | `src/components/ShindanSidebar.tsx` | 動的プラン検出、ライト推奨バナー |
| Sidebar | `src/components/interview/InterviewSidebar.tsx` | LIGHT検出、upgrade金額表示 |
| Sidebar | `src/components/movie/MovieSidebar.tsx` | LIGHT検出、ライト推奨バナー |
| Sidebar | `src/components/voice/VoiceSidebar.tsx` | LIGHT検出 |
| Config | `src/app/banner/dashboard/page.tsx` | PLAN_CONFIGにLIGHT追加 |
| 共通 | `src/lib/plan-utils.ts` | tierFrom, planLabel, planBadge, planPrice, isPaidTier, tierFromPlanId |

---

## 10. 既知の制限・注意点

1. **interview/pricing, persona/pricing ページは存在しない** - サービス固有の料金ページがない。グローバル `/pricing` にリダイレクトする
2. **UpgradeSuccessModal** は PRO/ENTERPRISE のみ対応（LIGHT 非対応）- バナー固有モーダル
3. **Customer Portal** での LIGHT プラン表示は Stripe ダッシュボード側の設定が必要
4. **kantan, tenkai** の LIGHT pricing は services.ts 未定義（メンテナンス/coming_soon ステータスのため）
5. **copy/pricing の #contact アンカー** - Enterprise の CTA が `#contact` を指すが該当セクションが未実装
6. **movie/guide ページ** - FAQ からリンクされているが未実装の可能性あり

---

## 11. よくあるバグパターンと防止策

### 11.1 `isPaid` で PRO 表示をするバグ（最重要）

**問題**: `isPaid = isLight || isPro || isEnterprise` を使って条件分岐すると、
LIGHT ユーザーに PRO の表示（ラベル・バッジ・価格・CTA）が出る。

```typescript
// ❌ NG: LIGHT が PRO 扱いになる
const label = isPaid ? 'プロ' : '無料'
const price = isPaid ? '¥9,980' : '¥0'

// ✅ OK: 階層ごとに分岐する
const label = isEnterprise ? 'エンタープライズ' : isPro ? 'プロ' : isLight ? 'ライト' : '無料'
// または plan-utils.ts を使う
import { planLabel } from '@/lib/plan-utils'
const label = planLabel(tier)
```

**影響箇所**: currentPlanLabel, planBadge, 価格表示, CTA ボタン, イベント dispatch, 解約メッセージ

### 11.2 解約/再開セクションの表示条件

```typescript
// ❌ NG: LIGHT ユーザーが解約できない
{(tier === 'PRO' || tier === 'ENTERPRISE') && sub?.hasSubscription && (...)}

// ✅ OK: LIGHT も含める
{(tier === 'LIGHT' || tier === 'PRO' || tier === 'ENTERPRISE') && sub?.hasSubscription && (...)}

// ✅ もっとシンプル:
import { isPaidTier } from '@/lib/plan-utils'
{isPaidTier(tier) && sub?.hasSubscription && (...)}
```

### 11.3 ハードコード文字列の回避

```typescript
// ❌ NG: PRO/Enterprise 固定
"PRO/Enterpriseの機能をご利用いただけます"
"決済直後にPROへ切り替わらない場合"

// ✅ OK: 汎用的な表現
"有料プランの機能をご利用いただけます"
"決済直後にプランへ切り替わらない場合"
```

### 11.4 FREE ユーザーの CTA

FREE ユーザーのアップグレード CTA は **LIGHT を主導線** にする（PRO ではない）。

```typescript
// ❌ NG: FREE → PRO のみ
<CheckoutButton planId="banner-pro">プロプランへアップグレード</CheckoutButton>

// ✅ OK: FREE → LIGHT を主導線
<CheckoutButton planId="banner-light">ライトプランへアップグレード</CheckoutButton>
```

### 11.5 dispatchEvent での planTier

```typescript
// ❌ NG: LIGHT が PRO になる
planTier: planId.includes('enterprise') ? 'ENTERPRISE' : 'PRO'

// ✅ OK: plan-utils.ts を使用
import { tierFromPlanId } from '@/lib/plan-utils'
planTier: tierFromPlanId(data?.planId || '')
```

---

## 12. 新しいサービス追加時のチェックリスト

新サービスに LIGHT プランを追加する場合の手順：

1. [ ] `src/lib/pricing.ts` に `lightLimit` 定数を追加
2. [ ] `src/lib/services.ts` に `light` pricing を追加
3. [ ] `src/lib/stripe.ts` の `STRIPE_PRICE_IDS` に light マッピング追加
4. [ ] `src/app/api/stripe/checkout/route.ts` の `getPriceId()` にマッピング追加
5. [ ] 料金ページに LIGHT カード追加（`bg-blue-50 border-blue-200` デザイン）
6. [ ] dashboard/plan ページで LIGHT 対応（plan-utils.ts を使用）
7. [ ] サイドバーに LIGHT 検出 + 推奨バナー追加
8. [ ] アクセス制御ヘルパーに LIGHT 分岐追加
9. [ ] レスポンシブ確認（375px でカード崩れなし）
10. [ ] `isPaid` ではなく `isLight / isPro / isEnterprise` で個別分岐すること
