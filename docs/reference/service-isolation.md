# 🔒 サービス分離ルール

**最重要原則：他サービスのAPI/DB/課金に絶対に影響を与えない**

---

## 目次

1. [分離の原則](#分離の原則)
2. [ディレクトリ構成ルール](#ディレクトリ構成ルール)
3. [共有可能なもの](#共有可能なもの)
4. [共有禁止なもの](#共有禁止なもの)
5. [API設計ルール](#api設計ルール)
6. [DB設計ルール](#db設計ルール)
7. [課金設計ルール](#課金設計ルール)
8. [チェックリスト](#チェックリスト)

---

## 分離の原則

### なぜ分離が重要か

1. **障害の局所化**: あるサービスで障害が発生しても他サービスに影響しない
2. **独立したリリース**: サービスごとに独立してデプロイ可能
3. **責任の明確化**: コードの所有者が明確になる
4. **テストの容易さ**: サービス単位でテスト可能

### 分離のレベル

```
┌─────────────────────────────────────────────────────┐
│                  共通インフラ層                      │
│  認証(NextAuth) / 決済(Stripe) / DB(Prisma)        │
└─────────────────────────────────────────────────────┘
          ↓              ↓              ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ドヤバナーAI │  │ドヤSEO AI  │  │ドヤペルソナ │
│             │  │             │  │             │
│ /banner/*   │  │ /seo/*      │  │ /persona/*  │
│ /api/banner │  │ /api/seo    │  │ /api/persona│
│             │  │             │  │             │
│ BannerPlan  │  │ SeoPlan     │  │ PersonaPlan │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## ディレクトリ構成ルール

### ✅ 正しい構成

```
src/
├── app/
│   ├── banner/              # バナーサービス専用
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   └── ...
│   ├── seo/                 # SEOサービス専用
│   │   ├── page.tsx
│   │   ├── articles/
│   │   └── ...
│   ├── api/
│   │   ├── banner/          # バナーAPI専用
│   │   │   ├── generate/
│   │   │   └── refine/
│   │   ├── seo/             # SEO API専用
│   │   │   ├── jobs/
│   │   │   └── articles/
│   │   ├── auth/            # 共通認証
│   │   └── stripe/          # 共通決済
│   └── ...
├── components/
│   ├── DashboardSidebar.tsx # バナー専用サイドバー
│   ├── SeoSidebar.tsx       # SEO専用サイドバー
│   ├── ToolSwitcherMenu.tsx # 共通コンポーネント
│   └── CheckoutButton.tsx   # 共通コンポーネント
├── lib/
│   ├── banner/              # バナー専用ロジック（推奨）
│   │   └── generation.ts
│   ├── seo/                 # SEO専用ロジック（推奨）
│   │   └── pipeline.ts
│   ├── auth.ts              # 共通認証
│   ├── stripe.ts            # 共通決済
│   └── prisma.ts            # 共通DB
└── ...
```

### ❌ 避けるべき構成

```
src/
├── lib/
│   └── generation.ts        # ❌ どのサービスのものか不明
├── components/
│   └── Sidebar.tsx          # ❌ 全サービス共通は危険
└── ...
```

---

## 共有可能なもの

### 1. 認証（NextAuth）

```typescript
// src/lib/auth.ts - 共通
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'

const session = await getServerSession(authOptions)
```

### 2. 決済（Stripe）

```typescript
// src/lib/stripe.ts - 共通
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
```

### 3. DBクライアント（Prisma）

```typescript
// src/lib/prisma.ts - 共通
import { prisma } from '@/lib/prisma'
```

### 4. UIコンポーネント（読み取り専用）

```typescript
// 共有可能なコンポーネント
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { CheckoutButton } from '@/components/CheckoutButton'
import { Providers } from '@/components/Providers'
```

### 5. 料金定義（読み取り専用）

```typescript
// src/lib/pricing.ts - 共通
import { BANNER_PRICING, SEO_PRICING } from '@/lib/pricing'
```

### 6. サービス定義（読み取り専用）

```typescript
// src/lib/services.ts - 共通
import { getServiceById, getActiveServices } from '@/lib/services'
```

---

## 共有禁止なもの

### 1. APIエンドポイント

```typescript
// ❌ 他サービスのAPIを呼ばない
// src/app/api/seo/generate/route.ts で
import { bannerGenerate } from '@/app/api/banner/generate'  // ❌

// ✅ 同じサービス内のみ
import { seoGenerate } from '@/lib/seo/generation'  // ✅
```

### 2. DBテーブル直接参照

```typescript
// ❌ 他サービスのテーブルを直接触らない
// src/app/api/seo/route.ts で
const banners = await prisma.banner.findMany()  // ❌

// ✅ 自サービスのテーブルのみ
const articles = await prisma.seoArticle.findMany()  // ✅
```

### 3. サービス専用コンポーネント

```typescript
// ❌ 他サービスのサイドバーを使わない
// src/app/seo/page.tsx で
import { DashboardSidebar } from '@/components/DashboardSidebar'  // ❌

// ✅ 自サービス専用を作成
import { SeoSidebar } from '@/components/SeoSidebar'  // ✅
```

---

## API設計ルール

### URLパターン

```
/api/<service-id>/<action>
```

**例:**

```
/api/banner/generate      # バナー生成
/api/banner/refine        # バナー編集
/api/seo/jobs/[id]/advance # SEOジョブ進行
/api/persona/create       # ペルソナ作成
```

### 認証チェック

```typescript
export async function POST(request: NextRequest) {
  // 1. セッション取得
  const session = await getServerSession(authOptions)
  
  // 2. 認証チェック（必要に応じて）
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 3. プランチェック（自サービスのプランのみ）
  const plan = (session.user as any).bannerPlan || 'FREE'
  
  // 4. 使用量チェック（自サービスの使用量のみ）
  const usage = await checkBannerUsage(session.user.id)
  
  // 5. 処理実行
  // ...
}
```

### エラーハンドリング

```typescript
try {
  // 処理
} catch (error) {
  console.error('[BANNER] Generation error:', error)
  return NextResponse.json(
    { error: 'Generation failed', details: error.message },
    { status: 500 }
  )
}
```

---

## DB設計ルール

### テーブル命名

```
<service>_<entity>
```

**例:**

```sql
-- バナーサービス
banner                  -- バナー生成履歴
banner_usage            -- バナー使用量

-- SEOサービス
seo_article             -- 記事
seo_job                 -- 生成ジョブ
seo_section             -- セクション

-- ペルソナサービス
persona                 -- ペルソナ
persona_history         -- 生成履歴
```

### プラン管理

```typescript
// Userテーブルにサービスごとのプランを保持
model User {
  id          String   @id @default(cuid())
  email       String?  @unique
  
  // サービスごとのプラン（分離）
  bannerPlan  String   @default("FREE")
  seoPlan     String   @default("FREE")
  personaPlan String   @default("FREE")
  
  // サブスクリプションID（分離）
  bannerSubscriptionId  String?
  seoSubscriptionId     String?
  personaSubscriptionId String?
}
```

---

## 課金設計ルール

### 価格ID管理

```typescript
// src/lib/stripe.ts
export const STRIPE_PRICE_IDS = {
  banner: {
    pro: {
      monthly: process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_BANNER_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_BANNER_ENTERPRISE_YEARLY,
    },
  },
  seo: {
    pro: {
      monthly: process.env.STRIPE_PRICE_SEO_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_SEO_PRO_YEARLY,
    },
  },
  // 新サービス追加時はここに追加
}
```

### Checkout Session

```typescript
// metadata にサービスIDとプランIDを埋め込む
const session = await stripe.checkout.sessions.create({
  // ...
  metadata: {
    userId: user.id,
    serviceId: 'banner',  // サービスを明示
    planId: 'banner-pro',
  },
})
```

### Webhook処理

```typescript
// サービスIDでDB更新先を分岐
const serviceId = subscription.metadata.serviceId

switch (serviceId) {
  case 'banner':
    await prisma.user.update({
      where: { id: userId },
      data: { bannerPlan: 'PRO' },
    })
    break
  case 'seo':
    await prisma.user.update({
      where: { id: userId },
      data: { seoPlan: 'PRO' },
    })
    break
}
```

---

## チェックリスト

新サービス追加時に確認：

### ディレクトリ

- [ ] `src/app/<service-id>/` を新規作成
- [ ] `src/app/api/<service-id>/` を新規作成
- [ ] 他サービスのディレクトリを変更していない

### コンポーネント

- [ ] `<Service>Sidebar.tsx` を新規作成
- [ ] `<Service>AppLayout.tsx` を新規作成
- [ ] 他サービスのコンポーネントを変更していない

### API

- [ ] `/api/<service-id>/` 配下にのみAPIを追加
- [ ] 他サービスのAPIを呼び出していない

### DB

- [ ] サービス専用のテーブルを使用
- [ ] 他サービスのテーブルを直接参照していない

### 課金

- [ ] `STRIPE_PRICE_IDS` にサービス専用の価格IDを追加
- [ ] Webhook処理にサービス分岐を追加
- [ ] Userテーブルにサービス専用のプランカラムを追加

### 共通コンポーネント

- [ ] 共通コンポーネントへの破壊的変更がない
- [ ] `ToolSwitcherMenu` に新サービスを追加（追記のみ）
- [ ] `services.ts` に新サービスを追加（追記のみ）

---

## 緊急時の対応

### 他サービスに影響が出た場合

1. **即座にデプロイをロールバック**
2. 問題のコミットを特定
3. 分離ルール違反を修正
4. 再デプロイ

### 共通コンポーネントに問題が出た場合

1. 問題の影響範囲を特定
2. 必要に応じて一時的にハードコード
3. 共通コンポーネントを慎重に修正
4. 全サービスで動作確認

---

## 実装パターン集

### パターン1: サービス専用プラン管理

```typescript
// ✅ 正しい実装: UserServiceSubscription を使用
const subscription = await prisma.userServiceSubscription.findUnique({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',  // サービスIDを明示
    },
  },
})

const plan = subscription?.plan || 'FREE'

// ❌ 間違い: グローバルプランを使用
const plan = (session?.user as any)?.plan || 'FREE'  // 他サービスに影響
```

### パターン2: サービス専用APIエンドポイント

```typescript
// ✅ 正しい実装: /api/myservice/... 配下にのみAPIを作成
// src/app/api/myservice/generate/route.ts
export async function POST(request: NextRequest) {
  // 自サービスのロジックのみ
}

// ❌ 間違い: 他サービスのAPIを呼び出す
import { bannerGenerate } from '@/app/api/banner/generate'  // 禁止
```

### パターン3: サービス専用DBテーブル

```typescript
// ✅ 正しい実装: サービス専用テーブルを使用
const result = await prisma.myServiceGeneration.create({
  data: { userId, input, result },
})

// ❌ 間違い: 他サービスのテーブルを使用
const result = await prisma.bannerGeneration.create({  // 禁止
  data: { userId, input, result },
})
```

### パターン4: サービス専用コンポーネント

```typescript
// ✅ 正しい実装: サービス専用サイドバーを作成
import { MyServiceSidebar } from '@/components/MyServiceSidebar'

// ❌ 間違い: 他サービスのサイドバーを使用
import { DashboardSidebar } from '@/components/DashboardSidebar'  // 禁止
```

---

## よくある分離違反と対策

### 違反1: グローバルプランで判定

```typescript
// ❌ 間違い
const plan = (session?.user as any)?.plan || 'FREE'

// ✅ 正しい
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId: 'myservice' } },
})
const plan = subscription?.plan || 'FREE'
```

### 違反2: 他サービスのAPIを直接呼び出し

```typescript
// ❌ 間違い
const response = await fetch('/api/banner/generate', { ... })

// ✅ 正しい: 自サービスのAPIのみ使用
const response = await fetch('/api/myservice/generate', { ... })
```

### 違反3: 共通コンポーネントへの破壊的変更

```typescript
// ❌ 間違い: ToolSwitcherMenu を改変
export function ToolSwitcherMenu({ currentTool, ... }) {
  // 自サービスのみのロジックを追加
}

// ✅ 正しい: サービス専用コンポーネントを作成
export function MyServiceToolSwitcher({ ... }) {
  // 自サービスのみのロジック
}
```

---

## 分離チェックツール

### コードレビュー時のチェック項目

```bash
# 1. 他サービスのAPIを呼んでいないか
grep -r "from '@/app/api/banner" src/app/myservice/
grep -r "from '@/app/api/seo" src/app/myservice/

# 2. 他サービスのコンポーネントを使用していないか
grep -r "from '@/components/DashboardSidebar" src/app/myservice/
grep -r "from '@/components/SeoSidebar" src/app/myservice/

# 3. 他サービスのテーブルを直接参照していないか
grep -r "prisma.banner" src/app/api/myservice/
grep -r "prisma.seo" src/app/api/myservice/
```

---

*最終更新: 2026年1月*


