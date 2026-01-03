# Stripe課金（ドヤバナーAIと同じ接続方式）マニュアル

このリポジトリでは、**どのサービスでも同じ“型”でStripe課金を接続**できるようにしています。  
（例：ドヤバナーAI、ドヤライティングAI）

## 1) 仕組みの全体像（最短）

- **価格ID（Price ID）** を環境変数で管理  
  - 実装：`src/lib/stripe.ts` の `STRIPE_PRICE_IDS`
- UIの「PROを始める」ボタンは **planId** を指定して checkout API を呼ぶ  
  - 例：`planId="banner-pro"` / `planId="seo-pro"`
- checkout API は Stripe Checkout Session を作成し、**metadata に serviceId/planId を埋める**
  - 実装：`src/app/api/stripe/checkout/route.ts`
- Webhook が subscription の状態変化を受け取り、DB（Prisma）へ反映
  - 実装：`src/app/api/stripe/webhook/route.ts`
- DB 反映後、セッション/画面側で「プラン判定・機能制御」を行う

## 2) 必要な環境変数

必須（本番は Vercel の Environment Variables に設定）：

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`（success/cancel の戻り先生成に使用）

各プランの Price ID：

- **ドヤライティングAI（serviceId=seo）**
  - `STRIPE_PRICE_SEO_PRO_MONTHLY`
  - `STRIPE_PRICE_SEO_PRO_YEARLY`
  - `STRIPE_PRICE_SEO_ENTERPRISE_MONTHLY`
  - `STRIPE_PRICE_SEO_ENTERPRISE_YEARLY`

- **ドヤバナーAI（serviceId=banner）**
  - `STRIPE_PRICE_BANNER_BASIC_MONTHLY`
  - `STRIPE_PRICE_BANNER_BASIC_YEARLY`
  - `STRIPE_PRICE_BANNER_PRO_MONTHLY`
  - `STRIPE_PRICE_BANNER_PRO_YEARLY`
  - `STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY`
  - `STRIPE_PRICE_BANNER_ENTERPRISE_YEARLY`

- **バンドル（bundle）**
  - `STRIPE_PRICE_BUNDLE_MONTHLY`
  - `STRIPE_PRICE_BUNDLE_YEARLY`

※ 変数名は `src/lib/stripe.ts` を正とします。

## 3) Stripe側（ダッシュボード）で作るもの

1. Product（商品）を作成（例：ドヤバナーAI PRO）
2. Pricing（価格）を作成（例：月額 / 年額）
3. 作成した Price の ID を環境変数へ設定

## 4) 新しいサービス/プランを追加する手順（テンプレ）

### A. `src/lib/stripe.ts` に Price ID を追加

- `STRIPE_PRICE_IDS.<service>.<plan>.{monthly,yearly}` を追加
- `PlanId` 型に `<service>-<plan>` を追加
- `getPlanIdFromStripePriceId()` の entries に追加

### B. 料金UI（Pricing Page）で `CheckoutButton` を置く

- 例（既存）：
  - `src/app/seo/pricing/page.tsx`
  - `src/app/banner/dashboard/plan/page.tsx`

`CheckoutButton` に `planId` を渡すだけでOKです。

### C. checkout API（`/api/stripe/checkout`）が planId から priceId を引けることを確認

- 実装：`src/app/api/stripe/checkout/route.ts`
- `getPriceId(planId, billingPeriod)` のマップに存在すること

### D. Webhook のDB反映が serviceId/planId を正しく認識することを確認

- 実装：`src/app/api/stripe/webhook/route.ts`
- `getPlanIdFromStripePriceId()` / `getServiceIdFromPlanId()` が正しく返すこと

## 5) よくある詰まりポイント

- **Price ID の取り違え**：Test/LiveでIDが違う（環境変数を分ける）
- **Webhook Secret 未設定**：`STRIPE_WEBHOOK_SECRET` が無いと署名検証で必ず失敗
- **callbackUrl のずれ**：`NEXT_PUBLIC_APP_URL` を本番URLに合わせる

## 6) 実装ファイル一覧（入口）

- 価格IDの定義：`src/lib/stripe.ts`
- Checkout Session 作成：`src/app/api/stripe/checkout/route.ts`
- Webhook（サブスク反映）：`src/app/api/stripe/webhook/route.ts`
- 料金ページ：`src/app/seo/pricing/page.tsx` / `src/app/banner/**/plan/page.tsx`


