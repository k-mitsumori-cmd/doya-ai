# 📚 ドヤAI 完全開発ガイド

新しいサービスを開発する際に必要な全ての情報をまとめた統合ドキュメントです。

---

## 📑 目次

### 基礎編
1. [前提条件・技術スタック](#前提条件)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [新サービス追加手順](#新サービス追加手順)

### 実装編
4. [実装パターン集](#実装パターン集)
5. [デザインシステム](#デザインシステム)
6. [サイドバー実装パターン](#サイドバー実装パターン)
7. [アニメーション仕様](#アニメーション仕様)

### 重要ルール編
8. [サービス分離ルール](#サービス分離ルール)
9. [ベータ版サービス管理](#ベータ版サービスの定義)

### 運用編
10. [デプロイ手順](#デプロイ手順)
11. [トラブルシューティング](#トラブルシューティング)

---

**注意**: このドキュメントは、以下のドキュメントを統合したものです：
- development-guide.md
- implementation-patterns.md
- design-system.md
- sidebar-pattern.md
- service-isolation.md
- animation-spec.md
- beta-services.md

*最終更新: 2026年1月*

---

# 🚀 ドヤAI 開発ガイド（新サービス追加手順）

新しいサービスを追加する際の完全ガイドです。

---

## 目次

1. [前提条件](#前提条件)
2. [技術スタック](#技術スタック)
3. [ディレクトリ構成](#ディレクトリ構成)
4. [新サービス追加手順](#新サービス追加手順)
5. [共通コンポーネント](#共通コンポーネント)
6. [認証・セッション](#認証セッション)
7. [課金連携（Stripe）](#課金連携stripe)
8. [サービス分離ルール](#サービス分離ルール)
9. [絶対に守るべきルール](#絶対に守るべきルール)

---

## 前提条件

- Node.js 18+
- PostgreSQL（Supabase推奨）
- pnpm または npm
- Vercelアカウント（デプロイ用）

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 認証 | NextAuth.js (Google OAuth) |
| データベース | PostgreSQL + Prisma |
| 決済 | Stripe |
| AI (テキスト) | Google Gemini API |
| AI (画像) | Nano Banana Pro |
| ホスティング | Vercel |
| アニメーション | Framer Motion |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── <service-id>/           # サービスごとのページ
│   │   ├── page.tsx            # メインページ
│   │   ├── dashboard/          # ダッシュボード
│   │   ├── pricing/            # 料金ページ
│   │   └── settings/           # 設定ページ
│   ├── api/
│   │   ├── <service-id>/       # サービス専用API
│   │   ├── auth/               # 認証（共通）
│   │   └── stripe/             # Stripe（共通）
│   └── auth/                   # ログインページ
├── components/
│   ├── <Service>Sidebar.tsx    # サービス専用サイドバー
│   ├── <Service>AppLayout.tsx  # サービス専用レイアウト
│   ├── ToolSwitcherMenu.tsx    # ツール切替メニュー（共通）
│   ├── CheckoutButton.tsx      # 決済ボタン（共通）
│   └── ...
├── lib/
│   ├── services.ts             # サービス定義（共通）
│   ├── auth.ts                 # NextAuth設定（共通）
│   ├── stripe.ts               # Stripe設定（共通）
│   ├── prisma.ts               # Prismaクライアント（共通）
│   └── <service-id>/           # サービス専用ロジック
└── types/
```

---

## 新サービス追加手順

### Step 1: サービス定義を追加

`src/lib/services.ts` の `SERVICES` 配列に追加：

```typescript
{
  id: 'myservice',
  name: 'ドヤ○○AI',
  shortName: '○○',
  description: '説明文',
  icon: '🎯',
  color: 'blue',
  gradient: 'from-blue-500 to-cyan-500',
  href: '/myservice',
  dashboardHref: '/myservice/dashboard',
  pricingHref: '/myservice/pricing',
  guideHref: '/myservice/guide',
  features: ['機能1', '機能2', '機能3'],
  pricing: {
    free: { name: '無料プラン', limit: '1日3回まで', dailyLimit: 3, price: 0 },
    pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
  },
  status: 'active',
  category: 'text',
  order: 10,
  requiresAuth: false,
  isNew: true,
}
```

### Step 2: ツール切替メニューに追加

`src/components/ToolSwitcherMenu.tsx` の `TOOLS` 配列に追加：

```typescript
{
  id: 'myservice',
  href: '/myservice',
  title: 'ドヤ○○AI',
  description: '○○生成',
  icon: Target,  // lucide-react
  iconBgClassName: 'bg-gradient-to-br from-blue-500 to-cyan-600',
}
```

### Step 3: サイドバーを作成

`src/components/DashboardSidebar.tsx` または `src/components/SeoSidebar.tsx` をコピーして、サービス専用のサイドバーを作成：

```typescript
// src/components/MyServiceSidebar.tsx
'use client'

import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// ... 既存のサイドバーパターンに従う

const NAV_ITEMS = [
  { href: '/myservice', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/myservice/create', label: '新規作成', icon: Plus },
  { href: '/myservice/history', label: '履歴', icon: Clock },
  { href: '/myservice/pricing', label: '料金/プラン', icon: CreditCard },
]

function MyServiceSidebarImpl({ ... }) {
  // DashboardSidebar.tsx のパターンに従う
}

export const MyServiceSidebar = memo(MyServiceSidebarImpl)
```

**サイドバーの必須要素:**

1. **ロゴ＋サービス名**（上部）
2. **ナビゲーションリンク**（メイン）
3. **1時間生成し放題バナー**（キャンペーン中のみ）
4. **プラン案内バナー**（通常時）
5. **ToolSwitcherMenu**（他ツール切替）
6. **お問い合わせリンク**
7. **ユーザープロフィール＋ログアウト**（下部）
8. **折りたたみボタン**（デスクトップ）

### Step 4: レイアウトを作成

実装例は `InterviewAppLayout.tsx` を参照。以下は基本パターン：

```typescript
// src/components/MyServiceAppLayout.tsx
'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MyServiceSidebar } from './MyServiceSidebar'
import { Menu, X } from 'lucide-react'
import { useSession } from 'next-auth/react'

export function MyServiceAppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  
  // LocalStorageから折りたたみ状態を復元
  React.useEffect(() => {
    const saved = localStorage.getItem('myservice-sidebar-collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  const handleToggle = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem('myservice-sidebar-collapsed', String(collapsed))
  }, [])

  // プラン判定（サービス専用プランまたはグローバルプラン）
  const planLabel = React.useMemo(() => {
    const servicePlan = String((session?.user as any)?.myServicePlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = servicePlan || globalPlan || (session?.user ? 'FREE' : 'GUEST')
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return session?.user ? 'FREE' : 'GUEST'
  }, [session])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <MyServiceSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsSidebarOpen(false)} 
            />
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[240px] shadow-2xl"
            >
              <MyServiceSidebar forceExpanded isMobile />
              <button 
                className="absolute top-4 right-[-3.5rem] p-2 text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[240px]'
      }`}>
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="h-full flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <button 
                className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <p className="text-sm font-black text-gray-900 leading-none">ドヤ○○AI</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1">サービス説明</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* プラン表示など */}
            </div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
```

**実装例（参考）:**
- `src/components/InterviewAppLayout.tsx` - より実践的な実装例（トライアルバナー、プラン表示など）
- `src/components/SeoAppLayout.tsx` - SEOサービス用レイアウト
- `src/components/LpSiteAppLayout.tsx` - LPサイト用レイアウト

### Step 5: ページを作成

```typescript
// src/app/myservice/page.tsx
import { MyServiceAppLayout } from '@/components/MyServiceAppLayout'

export default function MyServicePage() {
  return (
    <MyServiceAppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-slate-900 mb-6">
          ドヤ○○AI
        </h1>
        {/* コンテンツ */}
      </div>
    </MyServiceAppLayout>
  )
}
```

### Step 6: APIを作成

#### 基本パターン

```typescript
// src/app/api/myservice/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // 1. 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. リクエストボディの取得
    const body = await request.json()
    const { input, options } = body

    // 3. 使用量チェック（サービス専用のロジック）
    if (userId) {
      const subscription = await prisma.userServiceSubscription.findUnique({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'myservice',
          },
        },
      })

      const plan = subscription?.plan || 'FREE'
      const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
      const todayUsage = subscription?.dailyUsage || 0

      // 日次リセットチェック
      const lastReset = subscription?.lastUsageReset || new Date()
      const now = new Date()
      const isNewDay = now.toDateString() !== lastReset.toDateString()

      if (isNewDay) {
        await prisma.userServiceSubscription.update({
          where: { id: subscription?.id },
          data: { dailyUsage: 0, lastUsageReset: now },
        })
      } else if (todayUsage >= dailyLimit) {
        return NextResponse.json(
          { error: '使用上限に達しました', limit: dailyLimit },
          { status: 429 }
        )
      }
    }

    // 4. AI生成処理
    // ...

    // 5. 使用量を更新
    if (userId && subscription) {
      await prisma.userServiceSubscription.update({
        where: { id: subscription.id },
        data: { dailyUsage: { increment: 1 } },
      })
    }

    // 6. 結果を返す
    return NextResponse.json({ success: true, result: ... })
  } catch (error: any) {
    console.error('[MYSERVICE] Generation error:', error)
    return NextResponse.json(
      { error: 'Generation failed', details: error.message },
      { status: 500 }
    )
  }
}
```

#### ファイルアップロード（Vercel Blob Storage）

```typescript
// src/app/api/myservice/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // ファイルサイズチェック（4.75GB制限 - Vercel Blob Storageの上限）
  const MAX_FILE_SIZE = 4.75 * 1024 * 1024 * 1024 // 4.75GB
  const VERCEL_LIMIT = 4.5 * 1024 * 1024 // 4.5MB（サーバーレス関数の制限）

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'ファイルサイズが大きすぎます' },
      { status: 400 }
    )
  }

  // 4.5MBを超える場合はチャンクアップロードを使用
  if (file.size > VERCEL_LIMIT) {
    return NextResponse.json(
      { error: 'チャンクアップロードを使用してください', useChunkUpload: true },
      { status: 400 }
    )
  }

  // Vercel Blob Storageにアップロード
  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url })
}
```

#### ファイルアップロード（Google Cloud Storage）

大きなファイル（4.5MB超）や音声・動画ファイルの場合は、Google Cloud Storageを使用します。

**詳細**: [implementation-patterns.md](./implementation-patterns.md#google-cloud-storage-gcs-実装パターン) の「Google Cloud Storage (GCS) 実装パターン」セクションを参照してください。

**主な特徴:**

- **ファイルサイズ上限**: 5TB（Vercel Blob Storageは4.75GB）
- **用途**: 音声・動画ファイル、大きなファイル
- **認証**: サービスアカウントキーが必要

**実装例:**
- `src/lib/gcs.ts` - GCSライブラリ
- `src/app/api/interview/materials/upload/route.ts` - 直接アップロード
- `src/app/api/interview/materials/upload-chunk/route.ts` - チャンクアップロード

**実装例（参考）:**
- `src/app/api/interview/materials/upload/route.ts` - ファイルアップロード実装例
- `src/app/api/banner/generate/route.ts` - 画像生成API実装例
- `src/app/api/seo/jobs/[id]/advance/route.ts` - ジョブ進行API実装例

---

## 共通コンポーネント

### ToolSwitcherMenu（ツール切替）

全サービスのサイドバー下部に配置。`currentTool` で現在のサービスを指定。

```tsx
<ToolSwitcherMenu
  currentTool="myservice"
  showLabel={showLabel}
  isCollapsed={isCollapsed}
  className="px-3 pb-2"
/>
```

### CheckoutButton（決済ボタン）

Stripe Checkout への遷移ボタン。

```tsx
<CheckoutButton
  planId="myservice-pro"
  billingPeriod="monthly"
>
  PROを始める
</CheckoutButton>
```

---

## 認証・セッション

### NextAuth設定

`src/lib/auth.ts` で一元管理。サービス専用のプランは `UserServiceSubscription` テーブルで管理。

```typescript
// セッションでプラン確認
const session = await getServerSession(authOptions)
const userId = session?.user?.id

// サービス専用プランを取得
const subscription = await prisma.userServiceSubscription.findUnique({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',
    },
  },
})

const plan = subscription?.plan || 'FREE'
```

### プラン管理の実装パターン

#### Prismaスキーマ

```prisma
// prisma/schema.prisma
model UserServiceSubscription {
  id                  String   @id @default(cuid())
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String
  serviceId           String   // 'kantan' | 'banner' | 'myservice' など
  
  plan                String   @default("FREE")  // FREE | PRO | ENTERPRISE
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?
  
  dailyUsage           Int       @default(0)
  monthlyUsage         Int       @default(0)
  lastUsageReset       DateTime  @default(now())
  
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@unique([userId, serviceId])
  @@index([serviceId])
}
```

#### 使用量チェック

```typescript
// 日次リセットチェック
const now = new Date()
const lastReset = subscription?.lastUsageReset || now
const isNewDay = now.toDateString() !== lastReset.toDateString()

if (isNewDay) {
  await prisma.userServiceSubscription.update({
    where: { id: subscription.id },
    data: { dailyUsage: 0, lastUsageReset: now },
  })
}

// 使用量チェック
const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
if (subscription.dailyUsage >= dailyLimit) {
  return NextResponse.json({ error: '使用上限に達しました' }, { status: 429 })
}
```

### ⚠️ 注意

1. **NextAuthハンドラーを改変しない**（標準形式を維持）
2. **NEXTAUTH_URLは末尾スラッシュなし**
3. **サービス専用プランは `UserServiceSubscription` で管理**（`User.plan` はグローバルプラン）

---

## 課金連携（Stripe）

### 価格ID登録

`src/lib/stripe.ts` の `STRIPE_PRICE_IDS` に追加：

```typescript
STRIPE_PRICE_IDS = {
  // 既存...
  myservice: {
    pro: {
      monthly: process.env.STRIPE_PRICE_MYSERVICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_MYSERVICE_PRO_YEARLY,
    },
  },
}
```

### Webhook対応

`src/app/api/stripe/webhook/route.ts` で `getPlanIdFromStripePriceId()` にマッピング追加。

```typescript
// src/app/api/stripe/webhook/route.ts
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  const serviceId = subscription.metadata?.serviceId // 'myservice'
  const planId = subscription.metadata?.planId // 'myservice-pro'

  // UserServiceSubscriptionを更新または作成
  await prisma.userServiceSubscription.upsert({
    where: {
      userId_serviceId: {
        userId: userId!,
        serviceId: serviceId!,
      },
    },
    create: {
      userId: userId!,
      serviceId: serviceId!,
      plan: 'PRO',
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      plan: 'PRO',
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
}
```

---

## サービス分離ルール

**最重要：他サービスのAPI/DB/課金に絶対に影響を与えない**

### ✅ やっていいこと

- 自サービス専用のディレクトリ・ファイルを作成
- 共通コンポーネント（ToolSwitcherMenu, CheckoutButton）の使用
- 共通ライブラリ（auth.ts, stripe.ts, prisma.ts）の使用
- CSS変数・Tailwindテーマの使用

### ❌ やってはいけないこと

- 他サービスのAPIエンドポイントの変更
- 他サービスのDBテーブルの変更
- 他サービスのコンポーネントの変更
- 共通コンポーネントへの破壊的変更

---

## 絶対に守るべきルール

### 1. NextAuthハンドラーを改変しない

```typescript
// src/app/api/auth/[...nextauth]/route.ts
// このファイルは標準形式を維持すること
```

### 2. useSearchParamsはSuspenseで包む

```tsx
function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  )
}
```

### 3. 環境変数のハードコードを避ける

```typescript
// ✅ 正しい
const url = process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'

// ❌ 間違い
const url = 'https://doya-ai.vercel.app'
```

### 4. Stripeのモードを統一

- 本番: `sk_live_` + `pk_live_`
- テスト: `sk_test_` + `pk_test_`

---

## 検索系API・外部サービスの活用

検索やデータ取得に役立つ外部APIやサービスを積極的に活用しましょう。環境変数でAPIキーを設定すれば、すぐに使えるようになります。

### 利用可能な検索系API

#### SerpAPI（Google検索結果取得）

SEO記事生成で実装済み。Google検索結果を取得する際に使用。

**実装例:**

```typescript
// seo/lib/serpapi.ts
import { serpapiSearchGoogle, hasSerpApiKey } from '@seo/lib/serpapi'

// APIキー設定チェック
if (!hasSerpApiKey()) {
  console.warn('SerpAPI key not configured')
  return
}

// Google検索実行
const results = await serpapiSearchGoogle({
  query: 'キーワード',
  gl: 'jp',        // 国コード
  hl: 'ja',        // 言語コード
  num: 10,         // 取得件数（最大10件）
  start: 0,        // ページング用オフセット
})

// 結果の使用
results.organic.forEach(result => {
  console.log(result.title, result.url, result.snippet)
})
```

**環境変数:**

```env
SEO_SERPAPI_KEY=your-serpapi-key
# または
SERPAPI_API_KEY=your-serpapi-key
```

**参考実装:**

- `seo/lib/serpapi.ts` - SerpAPI実装
- `seo/lib/pipeline.ts` - SEO記事生成での使用例

#### Sora API（動画生成）

将来の動画生成機能で活用可能。必要に応じて統合してください。

**実装例（想定）:**

```typescript
// lib/sora.ts (将来の実装)
export async function generateVideo(prompt: string) {
  const apiKey = process.env.SORA_API_KEY
  if (!apiKey) throw new Error('Sora API key not configured')
  
  const response = await fetch('https://api.sora.com/v1/videos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })
  
  return await response.json()
}
```

**環境変数（想定）:**

```env
SORA_API_KEY=your-sora-api-key
```

#### その他の検索系API

以下のような検索系APIも活用可能です：

| API | 用途 | 実装状況 |
|-----|------|----------|
| **SerpAPI** | Google検索結果取得 | ✅ 実装済み |
| **Sora API** | 動画生成 | 🔜 将来実装可能 |
| **Perplexity API** | AI検索・リサーチ | 🔜 実装可能 |
| **Tavily API** | リアルタイム検索 | 🔜 実装可能 |
| **Exa API** | セマンティック検索 | 🔜 実装可能 |
| **Google Custom Search API** | カスタム検索 | 🔜 実装可能 |

### 実装のベストプラクティス

#### 1. 環境変数によるオプショナル対応

```typescript
// APIキーがない場合は機能を無効化（エラーにしない）
export function hasSearchApiKey(): boolean {
  return !!(
    process.env.SEO_SERPAPI_KEY || 
    process.env.SERPAPI_API_KEY ||
    process.env.SORA_API_KEY
  )
}

// 使用前にチェック
if (!hasSearchApiKey()) {
  // フォールバック処理（手動入力など）
  return { organic: [] }
}
```

#### 2. エラーハンドリング

```typescript
try {
  const results = await serpapiSearchGoogle({ query: 'test' })
  return results
} catch (error) {
  console.error('[SEARCH_API] Error:', error)
  // ユーザーには「検索APIが利用できません。手動で入力してください」と表示
  throw new Error('検索APIの利用に失敗しました')
}
```

#### 3. レート制限対応

```typescript
// 必要に応じてレート制限を実装
let lastRequestTime = 0
const RATE_LIMIT_MS = 1000 // 1秒間隔

async function rateLimitedSearch(query: string) {
  const now = Date.now()
  if (now - lastRequestTime < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - (now - lastRequestTime)))
  }
  lastRequestTime = Date.now()
  return await serpapiSearchGoogle({ query })
}
```

#### 4. キャッシュ対応

```typescript
// 同じクエリの結果をキャッシュ（短時間）
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分

async function cachedSearch(query: string) {
  const cached = cache.get(query)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }
  
  const results = await serpapiSearchGoogle({ query })
  cache.set(query, {
    data: results,
    expires: Date.now() + CACHE_TTL,
  })
  return results
}
```

---

## デプロイ手順

本番環境へのデプロイ手順です。

### 前提条件

- Vercelアカウント
- Gitリポジトリ（GitHub推奨）
- Vercelプロジェクトとリモートリポジトリの接続

### デプロイ方法

#### 方法1: Git Push（推奨）

```bash
# 1. 変更をコミット
git add -A
git commit -m "feat: 新機能追加"

# 2. メインブランチにプッシュ
git push origin main
```

Vercelが自動的にデプロイを開始します。

#### 方法2: Subtree Push（サブディレクトリのみ）

プロジェクトがサブディレクトリにある場合：

```bash
# 1. 変更をコミット
git add -A
git commit -m "feat: 変更内容"

# 2. Vercel用ブランチを作成してプッシュ
git branch -D doya-ai-deploy 2>/dev/null || true
git subtree split --prefix=doya-ai -b doya-ai-deploy
git push vercel doya-ai-deploy:main --force
```

**リモート設定:**

```bash
# 初回のみ：Vercelリモートを追加
git remote add vercel https://vercel.com/your-project.git

# またはSSH
git remote add vercel git@vercel.com:your-project.git
```

### デプロイ後の確認

#### 1. Vercelダッシュボードで確認

- [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
- ビルドログにエラーがないか確認
- デプロイステータスが「Ready」になるのを待つ

#### 2. 本番チェックリスト

デプロイ完了後に以下を確認：

- [ ] トップページが正常に表示される
  - `https://doya-ai.surisuta.jp/` が200で表示される
- [ ] 認証が動作する
  - `/api/auth/session` が200を返す
  - Googleログインが動作する
- [ ] 主要サービスが動作する
  - `/banner` が正常に表示される
  - `/seo` が正常に表示される
  - バナー生成が動作する（無料枠で1枚テスト）
- [ ] 決済が動作する
  - Stripe決済ページに遷移できる
  - 決済後にプランが反映される

### 環境変数の設定

**Vercelダッシュボードで設定:**

1. [Vercel Dashboard](https://vercel.com/dashboard) → プロジェクト選択
2. 「Settings」→「Environment Variables」
3. 必要な環境変数を追加

**主要な環境変数:**

```env
# 基本設定
NEXTAUTH_URL=https://doya-ai.surisuta.jp
NEXTAUTH_SECRET=your-secret
NEXT_PUBLIC_APP_URL=https://doya-ai.surisuta.jp

# データベース
DATABASE_URL=postgresql://...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI API
GEMINI_API_KEY=...
NANOBANANA_API_KEY=...

# 検索系API（オプション）
SEO_SERPAPI_KEY=...
SORA_API_KEY=...
```

### ビルドエラーの対処

#### よくあるエラー

| エラー | 原因 | 対策 |
|--------|------|------|
| `useSearchParams() should be wrapped in a suspense boundary` | Suspenseで包んでいない | `<Suspense>` で包む |
| `Module not found` | 依存関係が不足 | `package.json` を確認 |
| `Environment variable not found` | 環境変数が未設定 | Vercelで環境変数を設定 |
| `Build failed` | TypeScriptエラー | ローカルで `npm run build` を実行して確認 |

#### デバッグ方法

```bash
# ローカルでビルドを確認
npm run build

# TypeScriptの型チェック
npm run type-check

# Lintチェック
npm run lint
```

### ロールバック

問題が発生した場合：

1. Vercelダッシュボード → 「Deployments」
2. 前の正常なデプロイを選択
3. 「...」→「Promote to Production」

または、Gitでロールバック：

```bash
# 前のコミットに戻す
git revert HEAD
git push origin main
```

---

## 実装パターン集

### パターン1: シンプルな生成サービス

**例**: テキスト生成、画像生成など

```typescript
// API: POST /api/myservice/generate
// 1. 認証チェック
// 2. 使用量チェック
// 3. AI生成
// 4. 使用量更新
// 5. 結果返却
```

**実装例:**
- `src/app/api/banner/generate/route.ts`
- `src/app/api/persona/generate/route.ts`

### パターン2: ジョブ進行型サービス

**例**: SEO記事生成（分割生成パイプライン）

```typescript
// API: POST /api/myservice/jobs/[id]/advance
// 1. ジョブ状態を取得
// 2. 次のステップを実行
// 3. ジョブ状態を更新
// 4. 完了判定
```

**実装例:**
- `src/app/api/seo/jobs/[id]/advance/route.ts`

### パターン3: ファイルアップロード型サービス

**例**: インタビュー記事生成（音声/動画アップロード）

```typescript
// API: POST /api/myservice/upload
// 1. ファイルサイズチェック
// 2. Vercel Blob Storageにアップロード
// 3. メタデータをDBに保存
// 4. URLを返却
```

**実装例:**
- `src/app/api/interview/materials/upload/route.ts`
- `src/app/api/interview/materials/upload-chunk/route.ts`（チャンクアップロード）

### パターン4: ストリーミング生成サービス

**例**: リアルタイム生成結果の表示

```typescript
// API: POST /api/myservice/generate-stream
// 1. StreamingResponseを返す
// 2. 生成途中の結果を逐次送信
// 3. 完了時に最終結果を送信
```

**実装例:**
- `src/app/api/lp-site/generate-stream/route.ts`

---

## よくある実装パターン

### 1. エラーハンドリング

```typescript
try {
  // 処理
} catch (error: any) {
  console.error('[SERVICE_NAME] Error:', error)
  
  // Prismaエラーの判定
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string }
    if (prismaError.code === 'P2021') {
      return NextResponse.json(
        { error: 'データベースのテーブルが存在しません' },
        { status: 503 }
      )
    }
  }
  
  return NextResponse.json(
    { error: '処理に失敗しました', details: error.message },
    { status: 500 }
  )
}
```

### 2. ゲストユーザー対応

```typescript
const userId = session?.user?.id
const guestId = request.headers.get('x-guest-id')

if (!userId && !guestId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// ゲストユーザーの場合は制限を厳しく
const dailyLimit = userId 
  ? (plan === 'PRO' ? 100 : 3)
  : 1 // ゲストは1回まで
```

### 3. 日次リセット処理

```typescript
const now = new Date()
const lastReset = subscription?.lastUsageReset || now
const isNewDay = now.toDateString() !== lastReset.toDateString()

if (isNewDay) {
  await prisma.userServiceSubscription.update({
    where: { id: subscription.id },
    data: { 
      dailyUsage: 0,
      lastUsageReset: now,
    },
  })
}
```

### 4. レート制限

```typescript
// 同じユーザーからの連続リクエストを制限
const lastRequestTime = await redis.get(`rate:${userId}`)
const now = Date.now()
const RATE_LIMIT_MS = 2000 // 2秒間隔

if (lastRequestTime && now - Number(lastRequestTime) < RATE_LIMIT_MS) {
  return NextResponse.json(
    { error: 'リクエストが頻繁すぎます' },
    { status: 429 }
  )
}

await redis.set(`rate:${userId}`, now.toString(), 'EX', 2)
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. プランが反映されない

**症状**: 決済後もプランが更新されない

**原因と対策:**

```typescript
// ✅ 正しい実装
// Webhookで UserServiceSubscription を更新
await prisma.userServiceSubscription.upsert({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',
    },
  },
  update: { plan: 'PRO' },
  create: { userId: userId!, serviceId: 'myservice', plan: 'PRO' },
})

// ❌ 間違い: User.plan を更新してもサービス専用プランには反映されない
await prisma.user.update({
  where: { id: userId },
  data: { plan: 'PRO' }, // これはグローバルプラン
})
```

#### 2. 使用量がリセットされない

**症状**: 日次リセットが動作しない

**原因と対策:**

```typescript
// ✅ 正しい実装: 日付文字列で比較
const isNewDay = now.toDateString() !== lastReset.toDateString()

// ❌ 間違い: 時刻で比較するとリセットされない
const isNewDay = now.getTime() > lastReset.getTime() + 24 * 60 * 60 * 1000
```

#### 3. ファイルアップロードが失敗する

**症状**: 大きなファイルのアップロードが失敗

**原因と対策:**

```typescript
// ✅ 正しい実装: チャンクアップロードを使用
if (file.size > 4.5 * 1024 * 1024) {
  // チャンクアップロードAPIにリダイレクト
  return NextResponse.json({ useChunkUpload: true }, { status: 400 })
}

// ❌ 間違い: 大きなファイルを直接アップロード
// Vercelのサーバーレス関数は4.5MB制限がある
```

#### 4. セッションが取得できない

**症状**: `getServerSession` が `null` を返す

**原因と対策:**

```typescript
// ✅ 正しい実装: authOptionsを正しくインポート
import { authOptions } from '@/lib/auth'
const session = await getServerSession(authOptions)

// ❌ 間違い: 動的にauthOptionsを生成するとセッションが壊れる
const session = await getServerSession({
  // ... 動的生成
})
```

#### 5. TypeScriptエラー: `process is not defined`

**症状**: ビルド時に `process` が見つからないエラー

**原因と対策:**

```typescript
// ✅ 正しい実装: サーバーサイドでのみ使用
// クライアントコンポーネントでは使用しない

// ❌ 間違い: クライアントコンポーネントで process.env を使用
'use client'
const apiKey = process.env.NEXT_PUBLIC_API_KEY // OK
const secret = process.env.SECRET_KEY // ❌ エラー
```

---

## パフォーマンス最適化

### 1. データベースクエリの最適化

```typescript
// ✅ 必要なフィールドのみ取得
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId } },
  select: { plan: true, dailyUsage: true, lastUsageReset: true },
})

// ❌ 全フィールドを取得（不要なデータ転送）
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId } },
})
```

### 2. キャッシュの活用

```typescript
// 頻繁にアクセスされるデータはキャッシュ
const cacheKey = `plan:${userId}:${serviceId}`
const cached = await redis.get(cacheKey)

if (cached) {
  return JSON.parse(cached)
}

const subscription = await prisma.userServiceSubscription.findUnique({...})
await redis.set(cacheKey, JSON.stringify(subscription), 'EX', 300) // 5分
```

### 3. バッチ処理

```typescript
// 複数の更新を1回のトランザクションで実行
await prisma.$transaction([
  prisma.userServiceSubscription.update({...}),
  prisma.generation.create({...}),
])
```

---

## 実装チェックリスト

新サービス追加時に確認：

### 基本実装

- [ ] サービス定義を `src/lib/services.ts` に追加
- [ ] サイドバーコンポーネントを作成
- [ ] レイアウトコンポーネントを作成
- [ ] メインページを作成
- [ ] APIエンドポイントを作成

### プラン管理

- [ ] `UserServiceSubscription` でプラン管理
- [ ] 使用量チェックを実装
- [ ] 日次リセット処理を実装
- [ ] Stripe Webhookでプラン更新

### 認証・セッション

- [ ] 認証チェックを実装
- [ ] ゲストユーザー対応（必要に応じて）
- [ ] セッション取得が正しく動作

### エラーハンドリング

- [ ] try-catch でエラーを捕捉
- [ ] 適切なHTTPステータスコードを返す
- [ ] エラーメッセージをユーザーに表示

### デプロイ

- [ ] 環境変数を設定
- [ ] ビルドエラーがない
- [ ] 本番環境で動作確認

---

*最終更新: 2026年1月*

# 🎯 実装パターン集

実際のコードベースから抽出した、よく使われる実装パターンです。

---

## 目次

1. [API実装パターン](#api実装パターン)
2. [ファイルアップロードパターン](#ファイルアップロードパターン)
3. [Google Cloud Storage (GCS) 実装パターン](#google-cloud-storage-gcs-実装パターン)
4. [プラン管理パターン](#プラン管理パターン)
5. [エラーハンドリングパターン](#エラーハンドリングパターン)
6. [ストリーミング実装パターン](#ストリーミング実装パターン)
7. [ジョブ進行パターン](#ジョブ進行パターン)

---

## API実装パターン

### パターン1: シンプルな生成API

**用途**: テキスト生成、画像生成など、1回のリクエストで完了する処理

```typescript
// src/app/api/myservice/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // 1. 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. リクエストボディの取得
    const body = await request.json()
    const { input, options } = body

    // 3. バリデーション
    if (!input) {
      return NextResponse.json(
        { error: '入力が必要です' },
        { status: 400 }
      )
    }

    // 4. 使用量チェック（ログインユーザーのみ）
    if (userId) {
      const subscription = await prisma.userServiceSubscription.findUnique({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'myservice',
          },
        },
      })

      const plan = subscription?.plan || 'FREE'
      const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
      
      // 日次リセットチェック
      const now = new Date()
      const lastReset = subscription?.lastUsageReset || now
      const isNewDay = now.toDateString() !== lastReset.toDateString()

      if (isNewDay) {
        await prisma.userServiceSubscription.update({
          where: { id: subscription?.id },
          data: { dailyUsage: 0, lastUsageReset: now },
        })
      } else {
        const todayUsage = subscription?.dailyUsage || 0
        if (todayUsage >= dailyLimit) {
          return NextResponse.json(
            { error: '使用上限に達しました', limit: dailyLimit },
            { status: 429 }
          )
        }
      }
    }

    // 5. AI生成処理
    const result = await generateWithAI(input, options)

    // 6. 使用量を更新
    if (userId && subscription) {
      await prisma.userServiceSubscription.update({
        where: { id: subscription.id },
        data: { dailyUsage: { increment: 1 } },
      })
    }

    // 7. 結果を返す
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('[MYSERVICE] Generation error:', error)
    return NextResponse.json(
      { error: 'Generation failed', details: error.message },
      { status: 500 }
    )
  }
}
```

**実装例:**
- `src/app/api/banner/generate/route.ts`
- `src/app/api/persona/generate/route.ts`

---

## ファイルアップロードパターン

### パターン1: 小さいファイル（4.5MB以下）

**用途**: テキストファイル、小さな画像など

```typescript
// src/app/api/myservice/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // ファイルサイズチェック
  const VERCEL_LIMIT = 4.5 * 1024 * 1024 // 4.5MB
  if (file.size > VERCEL_LIMIT) {
    return NextResponse.json(
      { error: 'チャンクアップロードを使用してください', useChunkUpload: true },
      { status: 400 }
    )
  }

  // Vercel Blob Storageにアップロード
  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url })
}
```

### パターン2: 大きいファイル（チャンクアップロード）

**用途**: 音声ファイル、動画ファイルなど

```typescript
// src/app/api/myservice/upload-chunk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const chunk = formData.get('chunk') as File
  const fileName = formData.get('fileName') as string
  const chunkIndex = Number(formData.get('chunkIndex'))
  const totalChunks = Number(formData.get('totalChunks'))

  // チャンクをアップロード
  const blob = await put(`${fileName}.chunk.${chunkIndex}`, chunk, {
    access: 'public',
    addRandomSuffix: false,
  })

  // 最後のチャンクの場合、結合処理を開始
  if (chunkIndex === totalChunks - 1) {
    // 全チャンクを結合するAPIを呼び出す
    // ...
  }

  return NextResponse.json({ url: blob.url, chunkIndex })
}
```

**実装例:**
- `src/app/api/interview/materials/upload/route.ts`
- `src/app/api/interview/materials/upload-chunk/route.ts`

---

## Google Cloud Storage (GCS) 実装パターン

Google Cloud Storageは、大きなファイル（特に4.5MB超）や音声・動画ファイルを保存する場合に使用します。Vercel Blob Storage（4.75GB制限）よりも大きなファイルに対応できます。

### パターン1: GCSの初期化と認証設定

**概要**: GCSを使用するには、認証情報を環境変数で設定する必要があります。

**認証方法（優先順位）:**

1. **方法1: GOOGLE_APPLICATION_CREDENTIALS（推奨）**
   - サービスアカウントキーのJSON文字列を環境変数に設定

2. **方法2: 個別の環境変数**
   - サービスアカウントキーが作成できない場合の代替

3. **方法3: Workload Identity Federation**
   - VercelがOIDCトークンをサポートした場合に使用可能（現在は未対応）

**実装:**

```typescript
// src/lib/gcs.ts
import { Storage } from '@google-cloud/storage'

let storage: Storage | null = null

async function getStorage(): Promise<Storage> {
  if (!storage) {
    let credentials: any = undefined

    // 方法1: GOOGLE_APPLICATION_CREDENTIALS（JSON文字列）
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      } catch {
        // JSONパース失敗時はファイルパスとして扱う
        credentials = undefined
      }
    }

    // 方法2: 個別の環境変数から構築
    if (!credentials && process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
      credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
        private_key_id: process.env.GCS_PRIVATE_KEY_ID || '',
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GCS_CLIENT_EMAIL,
        client_id: process.env.GCS_CLIENT_ID || '',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.GCS_CLIENT_X509_CERT_URL || '',
      }
    }

    const config: any = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    }

    if (credentials) {
      config.credentials = credentials
    }

    storage = new Storage(config)
  }
  return storage
}

function getBucketName(): string {
  return process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
}
```

**環境変数設定:**

```env
# 必須
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name

# 方法1: サービスアカウントキー（JSON文字列）
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"...",...}

# 方法2: 個別の環境変数
GCS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GCS_PRIVATE_KEY_ID=your-private-key-id
GCS_CLIENT_ID=your-client-id
GCS_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
```

### パターン2: ファイルアップロード

**用途**: ファイルをGCSにアップロードし、公開URLを取得

```typescript
// src/lib/gcs.ts
export interface UploadResult {
  url: string
  pathname: string
  size: number
}

export async function uploadToGCS(
  filePath: string,
  buffer: Buffer | ArrayBuffer,
  options?: {
    contentType?: string
    public?: boolean
  }
): Promise<UploadResult> {
  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())
  const file = bucket.file(filePath)

  const bufferData = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer

  await file.save(bufferData, {
    metadata: {
      contentType: options?.contentType || 'application/octet-stream',
    },
    public: options?.public !== false, // デフォルトで公開
  })

  // 公開URLを取得
  const url = `https://storage.googleapis.com/${getBucketName()}/${filePath}`
  const pathname = filePath

  // ファイルサイズを取得
  const [metadata] = await file.getMetadata()
  const size = parseInt(metadata.size || '0', 10)

  return { url, pathname, size }
}
```

**使用例:**

```typescript
// src/app/api/myservice/upload/route.ts
import { uploadToGCS } from '@/lib/gcs'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // 環境変数チェック
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GCS_BUCKET_NAME) {
    return NextResponse.json(
      { error: 'GCS設定が完了していません' },
      { status: 500 }
    )
  }

  // ファイルをバッファに変換
  const buffer = await file.arrayBuffer()

  // GCSにアップロード
  const gcsPath = `myservice/${projectId}/${Date.now()}-${file.name}`
  const uploadResult = await uploadToGCS(gcsPath, buffer, {
    contentType: file.type || undefined,
    public: true,
  })

  return NextResponse.json({
    url: uploadResult.url,
    pathname: uploadResult.pathname,
    size: uploadResult.size,
  })
}
```

### パターン3: ファイル取得

**用途**: GCSからファイルを取得してBufferとして返す

```typescript
// src/lib/gcs.ts
export async function getFileFromGCS(fileUrl: string | null): Promise<Buffer> {
  if (!fileUrl) {
    throw new Error('File URL is required')
  }

  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())

  // URLからパスを抽出
  // https://storage.googleapis.com/bucket-name/path/to/file
  const urlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/
  const match = fileUrl.match(urlPattern)

  if (match && match[1]) {
    const filePath = decodeURIComponent(match[1])
    const file = bucket.file(filePath)
    const [buffer] = await file.download()
    return buffer
  } else {
    // URL形式でない場合は、そのままパスとして使用
    const file = bucket.file(fileUrl)
    const [buffer] = await file.download()
    return buffer
  }
}
```

**使用例:**

```typescript
// ファイルを取得して処理
const fileBuffer = await getFileFromGCS(material.fileUrl)
// ファイル処理...
```

### パターン4: ファイル削除

**用途**: GCSからファイルを削除

```typescript
// src/lib/gcs.ts
export async function deleteFromGCS(fileUrl: string | null): Promise<void> {
  if (!fileUrl) {
    return
  }

  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())

  // URLからパスを抽出
  const urlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/
  const match = fileUrl.match(urlPattern)

  if (match && match[1]) {
    const filePath = decodeURIComponent(match[1])
    const file = bucket.file(filePath)
    await file.delete()
  } else {
    // URL形式でない場合は、そのままパスとして使用
    const file = bucket.file(fileUrl)
    await file.delete()
  }
}
```

**使用例:**

```typescript
// プロジェクト削除時にファイルも削除
const materials = await prisma.myServiceMaterial.findMany({
  where: { projectId },
  select: { fileUrl: true },
})

for (const material of materials) {
  if (material.fileUrl) {
    try {
      await deleteFromGCS(material.fileUrl)
    } catch (error) {
      console.error('Failed to delete file:', error)
      // エラーは無視（ファイルが既に削除されている場合など）
    }
  }
}
```

### パターン5: 使用状況の取得

**用途**: GCSバケット内のファイル数と合計サイズを取得

```typescript
// src/lib/gcs.ts
export async function getGCSUsage(): Promise<{
  totalSize: number
  fileCount: number
}> {
  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())

  // プレフィックスでフィルタ（例: interview/）
  const [files] = await bucket.getFiles({
    prefix: 'myservice/',
  })

  let totalSize = 0
  for (const file of files) {
    const [metadata] = await file.getMetadata()
    totalSize += parseInt(metadata.size || '0', 10)
  }

  return {
    totalSize,
    fileCount: files.length,
  }
}
```

**使用例:**

```typescript
// 使用状況をチェック
const usage = await getGCSUsage()
const GCS_LIMIT = 5 * 1024 * 1024 * 1024 * 1024 // 5TB
const usagePercent = (usage.totalSize / GCS_LIMIT) * 100

if (usagePercent > 90) {
  // 容量が90%を超えた場合の処理
  // 自動クリーンアップなど
}
```

### パターン6: チャンクアップロード（大きなファイル）

**用途**: 4.5MBを超える大きなファイルをチャンクに分割してアップロード

```typescript
// src/app/api/myservice/upload-chunk/route.ts
import { uploadToGCS } from '@/lib/gcs'
import { readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const chunk = formData.get('chunk') as File
  const fileName = formData.get('fileName') as string
  const chunkIndex = Number(formData.get('chunkIndex'))
  const totalChunks = Number(formData.get('totalChunks'))
  const projectId = formData.get('projectId') as string

  // チャンクを一時ファイルに保存
  const chunkPath = join(tmpdir(), `${fileName}.chunk.${chunkIndex}`)
  const chunkBuffer = await chunk.arrayBuffer()
  await writeFile(chunkPath, Buffer.from(chunkBuffer))

  // 全チャンクが揃った場合、結合してGCSにアップロード
  if (chunkIndex === totalChunks - 1) {
    const finalFilePath = join(tmpdir(), fileName)
    const chunks: Buffer[] = []

    // 全チャンクを読み込む
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = join(tmpdir(), `${fileName}.chunk.${i}`)
      const chunkBuffer = await readFile(chunkPath)
      chunks.push(chunkBuffer)
      await unlink(chunkPath) // 一時ファイルを削除
    }

    // チャンクを結合
    const finalBuffer = Buffer.concat(chunks)

    // GCSにアップロード
    const gcsPath = `myservice/${projectId}/${fileName}`
    const uploadResult = await uploadToGCS(gcsPath, finalBuffer, {
      contentType: chunk.type || undefined,
      public: true,
    })

    return NextResponse.json({
      completed: true,
      url: uploadResult.url,
      pathname: uploadResult.pathname,
      size: uploadResult.size,
    })
  }

  return NextResponse.json({
    completed: false,
    chunkIndex,
    totalChunks,
  })
}
```

**実装例:**
- `src/app/api/interview/materials/upload-chunk/route.ts`

### パターン7: エラーハンドリング

**用途**: GCS操作時のエラーを適切に処理

```typescript
try {
  const uploadResult = await uploadToGCS(gcsPath, buffer, {
    contentType: mimeType || undefined,
    public: true,
  })
} catch (gcsError: any) {
  let errorMessage = 'ファイルのアップロードに失敗しました'
  let statusCode = 500

  // 認証エラー
  if (
    gcsError?.message?.includes('Unauthorized') ||
    gcsError?.message?.includes('401') ||
    gcsError?.code === 401
  ) {
    errorMessage = 'GCSの認証に失敗しました'
    statusCode = 401
  }
  // 権限エラー
  else if (
    gcsError?.message?.includes('Forbidden') ||
    gcsError?.message?.includes('403') ||
    gcsError?.code === 403
  ) {
    errorMessage = 'GCSへのアクセスが拒否されました'
    statusCode = 403
  }
  // 容量制限エラー
  else if (
    gcsError?.message?.includes('quota') ||
    gcsError?.message?.includes('quota exceeded')
  ) {
    errorMessage = 'GCSの容量制限に達しました'
    statusCode = 507 // Insufficient Storage
  }

  return NextResponse.json(
    { error: errorMessage, details: gcsError?.message },
    { status: statusCode }
  )
}
```

### GCS vs Vercel Blob Storage

| 項目 | Vercel Blob Storage | Google Cloud Storage |
|------|---------------------|---------------------|
| **ファイルサイズ上限** | 4.75GB | 5TB |
| **認証方法** | 環境変数（簡単） | サービスアカウントキー（複雑） |
| **コスト** | Vercelプランに含まれる | 使用量に応じた課金 |
| **用途** | 小〜中サイズファイル | 大きなファイル（音声・動画） |
| **実装** | `@vercel/blob` パッケージ | `@google-cloud/storage` パッケージ |

**推奨:**

- **4.5MB以下**: Vercel Blob Storage（実装が簡単）
- **4.5MB超、5TB以下**: Google Cloud Storage（大きなファイルに対応）

**実装例:**
- `src/lib/gcs.ts` - GCSライブラリ
- `src/app/api/interview/materials/upload/route.ts` - 小さいファイル用（直接GCSにアップロード）
- `src/app/api/interview/materials/upload-chunk/route.ts` - 大きいファイル用（チャンクアップロード）

---

## プラン管理パターン

### パターン1: プラン取得

```typescript
// サーバーサイド
const subscription = await prisma.userServiceSubscription.findUnique({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',
    },
  },
})

const plan = subscription?.plan || 'FREE'
```

```typescript
// クライアントサイド
const planLabel = useMemo(() => {
  const servicePlan = String((session?.user as any)?.myServicePlan || '').toUpperCase()
  const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
  const p = servicePlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
  
  if (p === 'ENTERPRISE') return 'ENTERPRISE'
  if (p === 'PRO') return 'PRO'
  if (p === 'FREE') return 'FREE'
  return isLoggedIn ? 'FREE' : 'GUEST'
}, [session, isLoggedIn])
```

### パターン2: 使用量チェック

```typescript
// 日次リセットチェック
const now = new Date()
const lastReset = subscription?.lastUsageReset || now
const isNewDay = now.toDateString() !== lastReset.toDateString()

if (isNewDay) {
  await prisma.userServiceSubscription.update({
    where: { id: subscription.id },
    data: { 
      dailyUsage: 0,
      lastUsageReset: now,
    },
  })
}

// 使用量チェック
const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
const todayUsage = subscription?.dailyUsage || 0

if (todayUsage >= dailyLimit) {
  return NextResponse.json(
    { error: '使用上限に達しました', limit: dailyLimit },
    { status: 429 }
  )
}
```

### パターン3: Stripe Webhookでのプラン更新

```typescript
// src/app/api/stripe/webhook/route.ts
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  const serviceId = subscription.metadata?.serviceId // 'myservice'
  const planId = subscription.metadata?.planId // 'myservice-pro'

  // UserServiceSubscriptionを更新または作成
  await prisma.userServiceSubscription.upsert({
    where: {
      userId_serviceId: {
        userId: userId!,
        serviceId: serviceId!,
      },
    },
    create: {
      userId: userId!,
      serviceId: serviceId!,
      plan: 'PRO',
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      plan: 'PRO',
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
}
```

---

## エラーハンドリングパターン

### パターン1: 基本エラーハンドリング

```typescript
try {
  // 処理
} catch (error: any) {
  console.error('[SERVICE_NAME] Error:', error)
  
  // Prismaエラーの判定
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string }
    if (prismaError.code === 'P2021') {
      return NextResponse.json(
        { error: 'データベースのテーブルが存在しません' },
        { status: 503 }
      )
    } else if (prismaError.code === 'P1001' || prismaError.code === 'P1017') {
      return NextResponse.json(
        { error: 'データベース接続エラー' },
        { status: 503 }
      )
    }
  }
  
  return NextResponse.json(
    { error: '処理に失敗しました', details: error.message },
    { status: 500 }
  )
}
```

### パターン2: バリデーションエラー

```typescript
// リクエストボディのバリデーション
const body = await request.json()
const { input, options } = body

if (!input || typeof input !== 'string' || input.trim().length === 0) {
  return NextResponse.json(
    { error: '入力が必要です', field: 'input' },
    { status: 400 }
  )
}

if (input.length > 10000) {
  return NextResponse.json(
    { error: '入力が長すぎます（最大10000文字）' },
    { status: 400 }
  )
}
```

### パターン3: 外部APIエラー

```typescript
try {
  const result = await externalAPI.call({ ... })
} catch (error: any) {
  // レート制限エラー
  if (error.status === 429) {
    return NextResponse.json(
      { error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。' },
      { status: 429 }
    )
  }
  
  // 認証エラー
  if (error.status === 401) {
    return NextResponse.json(
      { error: 'API認証に失敗しました。環境変数を確認してください。' },
      { status: 500 }
    )
  }
  
  // その他のエラー
  throw error
}
```

---

## ストリーミング実装パターン

### パターン1: Server-Sent Events (SSE)

```typescript
// src/app/api/myservice/generate-stream/route.ts
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 生成開始
        controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'))

        // 生成途中の結果を送信
        for await (const chunk of generateStream()) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`)
          )
        }

        // 完了
        controller.enqueue(encoder.encode('data: {"type":"complete"}\n\n'))
        controller.close()
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

**クライアント側:**

```typescript
const eventSource = new EventSource('/api/myservice/generate-stream', {
  method: 'POST',
  body: JSON.stringify({ input }),
})

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'chunk') {
    setResult(prev => prev + data.data)
  } else if (data.type === 'complete') {
    eventSource.close()
  }
}
```

**実装例:**
- `src/app/api/lp-site/generate-stream/route.ts`

---

## ジョブ進行パターン

### パターン1: ステップ進行型

**用途**: 複数ステップで完了する処理（SEO記事生成など）

```typescript
// src/app/api/myservice/jobs/[id]/advance/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const jobId = params.id

  // 1. ジョブ状態を取得
  const job = await prisma.myServiceJob.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // 2. 現在のステップを判定
  const currentStep = job.currentStep
  const nextStep = getNextStep(currentStep)

  // 3. 次のステップを実行
  let result
  switch (nextStep) {
    case 'step1':
      result = await executeStep1(job.input)
      break
    case 'step2':
      result = await executeStep2(job.step1Result)
      break
    case 'step3':
      result = await executeStep3(job.step2Result)
      break
    case 'complete':
      // 完了処理
      await prisma.myServiceJob.update({
        where: { id: jobId },
        data: { status: 'completed', completedAt: new Date() },
      })
      return NextResponse.json({ status: 'completed' })
  }

  // 4. ジョブ状態を更新
  await prisma.myServiceJob.update({
    where: { id: jobId },
    data: {
      currentStep: nextStep,
      [`${nextStep}Result`]: result,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ 
    status: 'in_progress',
    currentStep: nextStep,
    progress: getProgress(nextStep),
  })
}
```

**実装例:**
- `src/app/api/seo/jobs/[id]/advance/route.ts`

---

## データベースパターン

### パターン1: トランザクション

```typescript
// 複数の更新を1回のトランザクションで実行
await prisma.$transaction([
  prisma.userServiceSubscription.update({
    where: { id: subscription.id },
    data: { dailyUsage: { increment: 1 } },
  }),
  prisma.generation.create({
    data: { userId, serviceId: 'myservice', input, result },
  }),
])
```

### パターン2: バッチ処理

```typescript
// 複数のレコードを一度に更新
await prisma.userServiceSubscription.updateMany({
  where: {
    serviceId: 'myservice',
    lastUsageReset: { lt: new Date() }, // 昨日以前
  },
  data: {
    dailyUsage: 0,
    lastUsageReset: new Date(),
  },
})
```

### パターン3: リレーション取得

```typescript
// リレーションを含めて取得
const project = await prisma.interviewProject.findUnique({
  where: { id: projectId },
  include: {
    materials: true,
    drafts: true,
  },
})
```

---

## パフォーマンス最適化パターン

### パターン1: 必要なフィールドのみ取得

```typescript
// ✅ 正しい: select で必要なフィールドのみ
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId } },
  select: { plan: true, dailyUsage: true, lastUsageReset: true },
})

// ❌ 間違い: 全フィールドを取得
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId } },
})
```

### パターン2: インデックスの活用

```prisma
// prisma/schema.prisma
model UserServiceSubscription {
  // ...
  @@unique([userId, serviceId])
  @@index([serviceId])  // サービスIDで検索する場合
  @@index([userId])     // ユーザーIDで検索する場合
}
```

### パターン3: キャッシュの活用

```typescript
// Redis を使用したキャッシュ（オプション）
const cacheKey = `plan:${userId}:${serviceId}`
const cached = await redis.get(cacheKey)

if (cached) {
  return JSON.parse(cached)
}

const subscription = await prisma.userServiceSubscription.findUnique({...})
await redis.set(cacheKey, JSON.stringify(subscription), 'EX', 300) // 5分
```

---

## 実装チェックリスト

新サービス追加時に確認：

### API実装

- [ ] 認証チェックを実装
- [ ] 使用量チェックを実装
- [ ] 日次リセット処理を実装
- [ ] エラーハンドリングを実装
- [ ] 適切なHTTPステータスコードを返す

### データベース

- [ ] サービス専用テーブルを作成
- [ ] インデックスを適切に設定
- [ ] リレーションを正しく定義

### パフォーマンス

- [ ] 必要なフィールドのみ取得（select）
- [ ] バッチ処理で複数更新
- [ ] キャッシュを活用（必要に応じて）

---

*最終更新: 2026年1月*

# 🎨 ドヤAI デザインシステム

全サービスで統一されたデザインシステムです。

---

## 目次

1. [カラーパレット](#カラーパレット)
2. [タイポグラフィ](#タイポグラフィ)
3. [スペーシング](#スペーシング)
4. [コンポーネント](#コンポーネント)
5. [アイコン](#アイコン)
6. [レスポンシブ](#レスポンシブ)
7. [ダークモード対応](#ダークモード対応)

---

## カラーパレット

### CSS変数（`globals.css`）

```css
:root {
  /* ブランドカラー */
  --color-primary: #3B82F6;       /* Blue 500 */
  --color-primary-dark: #2563EB;  /* Blue 600 */
  --color-secondary: #8B5CF6;     /* Purple 500 */
  --color-accent: #EC4899;        /* Pink 500 */
  
  /* グラデーション */
  --gradient-primary: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%);
  --gradient-blue: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
  --gradient-purple: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
  --gradient-dark: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  
  /* シャドウ */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-glow-blue: 0 0 40px rgba(59, 130, 246, 0.3);
  --shadow-glow-purple: 0 0 40px rgba(139, 92, 246, 0.3);
  
  /* トランジション */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Tailwind拡張（`tailwind.config.ts`）

```typescript
colors: {
  brand: {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
  },
},
boxShadow: {
  'glow-sm': '0 0 20px rgba(59, 130, 246, 0.2)',
  'glow-md': '0 0 40px rgba(59, 130, 246, 0.3)',
  'glow-lg': '0 0 60px rgba(59, 130, 246, 0.4)',
  'glow-purple': '0 0 40px rgba(139, 92, 246, 0.3)',
  'glow-pink': '0 0 40px rgba(236, 72, 153, 0.3)',
},
```

### サービス別テーマカラー

| サービス | プライマリ | グラデーション |
|----------|------------|----------------|
| ドヤバナーAI | `#2563EB` (Blue 600) | `from-blue-500 to-blue-600` |
| ドヤライティングAI | `#059669` (Emerald 600) | `from-emerald-600 to-teal-700` |
| ドヤペルソナAI | `#7C3AED` (Purple 600) | `from-purple-500 to-purple-600` |
| ドヤロゴ | `#6366F1` (Indigo 500) | `from-indigo-500 to-sky-500` |

---

## タイポグラフィ

### フォントファミリー

```css
body {
  font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

### フォントサイズ

| クラス | サイズ | 用途 |
|--------|--------|------|
| `text-display-lg` | 4.5rem | ヒーローセクション |
| `text-display-md` | 3.75rem | ページタイトル |
| `text-display-sm` | 3rem | セクションタイトル |
| `text-3xl` | 1.875rem | カードタイトル |
| `text-xl` | 1.25rem | サブタイトル |
| `text-base` | 1rem | 本文 |
| `text-sm` | 0.875rem | 補助テキスト |
| `text-xs` | 0.75rem | キャプション |
| `text-[10px]` | 10px | バッジ、極小テキスト |

### フォントウェイト

| クラス | ウェイト | 用途 |
|--------|----------|------|
| `font-black` | 900 | 見出し、強調 |
| `font-bold` | 700 | サブ見出し |
| `font-semibold` | 600 | ボタン |
| `font-medium` | 500 | 本文（強調） |
| `font-normal` | 400 | 本文 |

---

## スペーシング

### 基本パディング

| 用途 | クラス |
|------|--------|
| ページコンテンツ | `p-4 sm:p-6 md:p-8` |
| カード内側 | `p-4 md:p-6` |
| ボタン | `px-6 py-3` (通常) / `px-4 py-2` (小) |
| サイドバー | `px-3 sm:px-4` |

### 間隔

| 用途 | クラス |
|------|--------|
| セクション間 | `space-y-8` または `gap-8` |
| カード間 | `gap-4` または `gap-6` |
| アイテム間 | `gap-2` または `gap-3` |

---

## コンポーネント

### ボタン

```html
<!-- プライマリボタン -->
<button class="btn-primary">
  保存する
</button>

<!-- セカンダリボタン -->
<button class="btn-secondary">
  キャンセル
</button>

<!-- ゴーストボタン -->
<button class="btn-ghost">
  詳細を見る
</button>
```

```css
.btn-primary {
  @apply inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-md), var(--shadow-glow-blue);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), var(--shadow-glow-blue);
}
```

### カード

```html
<!-- ライトカード -->
<div class="card p-6">
  <h3>タイトル</h3>
  <p>内容</p>
</div>

<!-- ダークカード -->
<div class="card-dark p-6">
  <h3>タイトル</h3>
  <p>内容</p>
</div>
```

```css
.card {
  @apply bg-white rounded-2xl border border-slate-200 shadow-sm;
  @apply transition-all duration-300;
}

.card:hover {
  @apply shadow-lg border-slate-300;
  transform: translateY(-2px);
}
```

### 入力フィールド

```html
<!-- ライト -->
<input class="input" placeholder="入力してください" />

<!-- ダーク -->
<input class="input-dark" placeholder="入力してください" />
```

### バッジ

```html
<span class="badge-primary">PRO</span>
<span class="badge-success">完了</span>
<span class="badge-warning">保留</span>
<span class="badge-new">NEW</span>
```

### グラデーションテキスト

```html
<h1 class="text-gradient">グラデーションテキスト</h1>
<h1 class="text-gradient-blue">ブルーグラデーション</h1>
<h1 class="text-gradient-purple">パープルグラデーション</h1>
```

### ガラス効果

```html
<div class="glass p-6">
  半透明ガラス効果
</div>

<div class="glass-dark p-6">
  ダークガラス効果
</div>
```

---

## アイコン

**使用ライブラリ**: `lucide-react`

### よく使うアイコン

```tsx
import { 
  Sparkles,      // AI/魔法
  Zap,           // プラン/アップグレード
  CreditCard,    // 決済
  Settings,      // 設定
  User,          // ユーザー
  LogIn,         // ログイン
  LogOut,        // ログアウト
  HelpCircle,    // ヘルプ
  ChevronLeft,   // 折りたたみ
  ChevronRight,  // 展開
  ChevronDown,   // ドロップダウン
  Menu,          // ハンバーガー
  X,             // 閉じる
  Plus,          // 追加
  Clock,         // 履歴
  FileText,      // ドキュメント
  Image,         // 画像
  Target,        // ターゲット
  LayoutGrid,    // グリッド
  ExternalLink,  // 外部リンク
} from 'lucide-react'
```

### サイズ規約

| 用途 | クラス |
|------|--------|
| ナビアイコン | `w-5 h-5` |
| ボタンアイコン | `w-4 h-4` |
| 大きいアイコン | `w-8 h-8` |
| 極小アイコン | `w-3 h-3` |

---

## レスポンシブ

### ブレークポイント

| プレフィックス | 最小幅 |
|----------------|--------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

### サイドバー

- **モバイル**: オーバーレイ（240px幅）
- **デスクトップ**: 固定（展開時240px / 折りたたみ時72px）

```css
/* メインコンテンツのパディング */
.main-content {
  @apply md:pl-[240px]; /* 展開時 */
  @apply md:pl-[72px];  /* 折りたたみ時 */
}
```

---

## ダークモード対応

現在はライトモードのみですが、将来的にダークモード対応する場合：

```css
/* ダークモード用CSS変数 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0F172A;
    --color-surface: #1E293B;
    --color-text-primary: #F8FAFC;
    --color-text-secondary: #94A3B8;
  }
}
```

---

## 背景パターン

```html
<!-- グリッドパターン -->
<div class="bg-grid" />

<!-- ドットパターン -->
<div class="bg-dots" />

<!-- 放射グラデーション -->
<div class="bg-gradient-radial" />
```

---

## 実装パターン集

### パターン1: サービス別テーマカラーの適用

```tsx
// サイドバーの背景色
<motion.aside
  className={`h-screen bg-gradient-to-b from-teal-600 to-cyan-600`}
  // または
  className={`h-screen bg-[#2563EB]`}  // 単色の場合
>
```

**サービス別カラー:**

| サービス | 背景色クラス | テーマカラー |
|----------|------------|------------|
| ドヤバナーAI | `bg-[#2563EB]` | Blue 600 |
| ドヤライティングAI | `bg-gradient-to-b from-emerald-600 via-green-600 to-teal-700` | Emerald/Teal |
| ドヤインタビューAI | `bg-gradient-to-b from-orange-600 to-red-600` | Orange/Red |
| ドヤペルソナAI | `bg-gradient-to-b from-purple-600 via-violet-600 to-purple-700` | Purple |

### パターン2: レスポンシブ対応

```tsx
// モバイル/デスクトップで異なる表示
<div className="hidden md:block">
  {/* デスクトップのみ表示 */}
</div>

<div className="md:hidden">
  {/* モバイルのみ表示 */}
</div>

// サイズ別のスタイリング
<div className="text-sm md:text-base lg:text-lg">
  {/* 画面サイズに応じてフォントサイズを変更 */}
</div>
```

### パターン3: アニメーションの適用

```tsx
// Framer Motion を使用
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  {/* コンテンツ */}
</motion.div>

// スタガーアニメーション
<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

---

## ベストプラクティス

### 1. 一貫性の維持

- 同じ機能は同じデザインパターンを使用
- ボタン、カード、入力フィールドは統一されたスタイル
- アニメーションのタイミングを統一

### 2. パフォーマンス

- 不要なアニメーションは避ける
- `memo` でコンポーネントを最適化
- 画像は最適化（Next.js Image コンポーネントを使用）

### 3. アクセシビリティ

- キーボード操作に対応
- フォーカス状態を明確に表示
- コントラスト比を確保（WCAG AA準拠）

---

*最終更新: 2026年1月*


# 📐 サイドバー実装パターン

ドヤAI全サービスで統一されたサイドバーの実装パターンです。

---

## 目次

1. [サイドバー構造](#サイドバー構造)
2. [必須要素](#必須要素)
3. [状態管理](#状態管理)
4. [スタイリング](#スタイリング)
5. [実装例](#実装例)
6. [共通コンポーネント](#共通コンポーネント)

---

## サイドバー構造

```
┌─────────────────────────────┐
│  🎨 サービス名              │ ← ロゴ + タイトル
├─────────────────────────────┤
│  📍 URL自動生成      [HOT]  │ ← ナビゲーション
│     バナー作成              │
│     AIチャット              │
│     ギャラリー              │
│     履歴                    │
│     プラン・使用量          │
├─────────────────────────────┤
│  🚀 生成し放題中！          │ ← キャンペーンバナー
│     残り 45:30              │    （条件付き表示）
├─────────────────────────────┤
│  ⚡ プラン案内              │ ← プランバナー
│     現在: FREE              │    （通常時表示）
│     [PROを始める]           │
├─────────────────────────────┤
│  🔲 他のツールを使う ▼      │ ← ToolSwitcherMenu
├─────────────────────────────┤
│  ❓ お問い合わせ            │ ← サポートリンク
├─────────────────────────────┤
│  👤 ユーザー名       [↪]    │ ← プロフィール + ログアウト
│     FREE プラン             │
└─────────────────────────────┘
    [◀] ← 折りたたみボタン（デスクトップのみ）
```

---

## 必須要素

### 1. ロゴ + サービス名

```tsx
<div className="px-4 py-5 flex items-center gap-2">
  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
    <Sparkles className="w-5 h-5 text-white" />
  </div>
  <AnimatePresence>
    {showLabel && (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="overflow-hidden"
      >
        <h1 className="text-lg font-black text-white tracking-tighter leading-none">
          ドヤ○○AI
        </h1>
        <p className="text-[10px] font-bold text-white/70 mt-0.5">
          サブタイトル
        </p>
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

### 2. ナビゲーションリンク

```tsx
type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  hot?: boolean
  badge?: string | number
}

const NAV_ITEMS: NavItem[] = [
  { href: '/service', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/service/create', label: '新規作成', icon: Plus, hot: true },
  { href: '/service/history', label: '履歴', icon: Clock },
  { href: '/service/pricing', label: 'プラン', icon: CreditCard },
]

// ナビリンクコンポーネント
const NavLink = ({ item }: { item: NavItem }) => {
  const active = isActive(item.href)
  const Icon = item.icon

  return (
    <Link href={item.href}>
      <motion.div
        whileHover={{ x: 4 }}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
          active
            ? 'bg-white/15 text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
        
        <AnimatePresence>
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-semibold whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* HOTバッジ */}
        {item.hot && showLabel && (
          <span className="ml-auto px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-[10px] font-bold text-white rounded-md shadow-sm">
            HOT
          </span>
        )}

        {/* アクティブインジケーター */}
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
          />
        )}
      </motion.div>
    </Link>
  )
}
```

### 3. キャンペーンバナー（1時間生成し放題）

```tsx
const FreeHourBanner = () => {
  if (!isFreeHourActive || freeHourRemainingMs <= 0) return null
  if (!showLabel) return null

  return (
    <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 border border-amber-300/50 relative overflow-hidden shadow-lg shadow-amber-500/20">
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
          <span className="text-xl">🚀</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
          <p className="text-[10px] text-white/80 font-bold">全機能解放</p>
        </div>
        <div className="px-2.5 py-1.5 bg-white/30 rounded-lg backdrop-blur-sm flex-shrink-0">
          <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
            {formatRemainingTime(freeHourRemainingMs)}
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 4. プラン案内バナー

```tsx
const PlanBanner = () => {
  if (isFreeHourActive && freeHourRemainingMs > 0) return null
  if (!showLabel) return null

  return (
    <div className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
          </div>
          <p className="text-xs font-black text-white">プラン案内</p>
        </div>
        <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
          現在：{planLabel}
        </p>
        <Link
          href="/service/pricing"
          className="mt-2 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md block text-center"
        >
          PROを始める
        </Link>
      </div>
    </div>
  )
}
```

### 5. ToolSwitcherMenu

```tsx
<ToolSwitcherMenu
  currentTool="banner"  // 'persona' | 'banner' | 'writing'
  showLabel={showLabel}
  isCollapsed={isCollapsed}
  className="px-3 pb-2"
/>
```

### 6. お問い合わせリンク

```tsx
<div className="px-3 pb-2">
  <a
    href={SUPPORT_CONTACT_URL}
    target="_blank"
    rel="noreferrer"
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
      isCollapsed ? 'justify-center' : ''
    }`}
    title="お問い合わせ"
  >
    <HelpCircle className="w-4 h-4 text-white flex-shrink-0" />
    <AnimatePresence>
      {showLabel && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
        >
          <div className="text-xs font-bold leading-none">お問い合わせ</div>
        </motion.div>
      )}
    </AnimatePresence>
  </a>
</div>
```

### 7. ユーザープロフィール

```tsx
<div className="p-3 border-t border-white/5 bg-blue-700/30">
  <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
    <Link
      href="/service/settings"
      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
    >
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
        {session?.user?.image ? (
          <img src={session.user.image} alt="User" className="w-full h-full rounded-full object-cover" />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>
      <AnimatePresence>
        {showLabel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {session?.user?.name || 'ゲスト'}
            </p>
            <p className="text-[10px] font-bold text-white/60 truncate">
              {planLabel}プラン
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
    {showLabel && (
      <button
        onClick={requestLogout}
        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title="ログアウト"
      >
        <LogOut className="w-4 h-4" />
      </button>
    )}
  </div>
</div>
```

### 8. 折りたたみボタン

```tsx
{!isMobile && (
  <button
    onClick={toggle}
    className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100 z-10"
  >
    {isCollapsed ? (
      <ChevronRight className="w-4 h-4" />
    ) : (
      <ChevronLeft className="w-4 h-4" />
    )}
  </button>
)}
```

---

## 状態管理

### Props

```tsx
interface SidebarProps {
  isCollapsed?: boolean          // 折りたたみ状態（制御コンポーネント用）
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean        // 強制展開（モバイル用）
  isMobile?: boolean             // モバイル表示
}
```

### ラベル表示ロジック

```tsx
const showLabel = isMobile || !isCollapsed
```

### アクティブ判定

```tsx
const isActive = (href: string) => {
  if (href === '/service') return pathname === '/service'
  return pathname.startsWith(href)
}
```

### LocalStorage永続化

```tsx
// レイアウト側で管理
React.useEffect(() => {
  const saved = localStorage.getItem('sidebar-collapsed')
  if (saved !== null) {
    setIsCollapsed(saved === 'true')
  }
}, [])

const handleToggle = React.useCallback((collapsed: boolean) => {
  setIsCollapsed(collapsed)
  localStorage.setItem('sidebar-collapsed', String(collapsed))
}, [])
```

---

## スタイリング

### サイドバー本体

```tsx
<motion.aside
  initial={false}
  animate={{
    width: isCollapsed ? 72 : 240,
  }}
  transition={{ duration: 0.2, ease: 'easeInOut' }}
  className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-[#2563EB] flex flex-col z-50 shadow-xl`}
>
```

### サービス別背景色

| サービス | 背景色クラス |
|----------|--------------|
| ドヤバナーAI | `bg-[#2563EB]` (Blue) |
| ドヤライティングAI | `bg-gradient-to-b from-emerald-600 via-green-600 to-teal-700` |
| ドヤペルソナAI | `bg-gradient-to-b from-purple-600 via-violet-600 to-purple-700` |

---

## 実装例

完全な実装例は以下を参照：

- `src/components/DashboardSidebar.tsx` （ドヤバナーAI）
- `src/components/SeoSidebar.tsx` （ドヤライティングAI）
- `src/components/PersonaSidebar.tsx` （ドヤペルソナAI）
- `src/components/InterviewSidebar.tsx` （ドヤインタビューAI - 最新実装例）

---

## よくある実装パターン

### パターン1: プラン判定

```typescript
const planLabel = useMemo(() => {
  const servicePlan = String((session?.user as any)?.myServicePlan || '').toUpperCase()
  const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
  const p = servicePlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
  
  if (p === 'ENTERPRISE') return 'ENTERPRISE'
  if (p === 'PRO') return 'PRO'
  if (p === 'FREE') return 'FREE'
  return isLoggedIn ? 'FREE' : 'GUEST'
}, [session, isLoggedIn])
```

### パターン2: 1時間生成し放題バナー

```typescript
const FreeHourBanner = () => {
  const firstLoginAt = (session?.user as any)?.firstLoginAt
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => 
    getFreeHourRemainingMs(firstLoginAt)
  )
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)

  useEffect(() => {
    if (!isFreeHourActive) return
    const interval = setInterval(() => {
      setFreeHourRemainingMs(getFreeHourRemainingMs(firstLoginAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])

  if (!isFreeHourActive || freeHourRemainingMs <= 0) return null
  // ... バナー表示
}
```

### パターン3: ログアウト処理

```typescript
const requestLogout = () => {
  if (!isLoggedIn || isLoggingOut) return
  setIsLogoutDialogOpen(true)
}

const confirmLogout = async () => {
  if (isLoggingOut) return
  setIsLoggingOut(true)
  try {
    markLogoutToastPending()
    await signOut({ callbackUrl: '/myservice?loggedOut=1' })
  } finally {
    setIsLoggingOut(false)
    setIsLogoutDialogOpen(false)
  }
}
```

---

## トラブルシューティング

### サイドバーが再レンダリングされすぎる

**症状**: 入力中にサイドバーが「ぱちぱち」する

**対策:**

```typescript
// ✅ 正しい実装: memo と useMemo を使用
export const MyServiceSidebar = memo(MyServiceSidebarImpl)

// 派生値は useMemo でメモ化
const planLabel = useMemo(() => {
  // ...
}, [session, isLoggedIn])

// ❌ 間違い: 毎回計算
const planLabel = String((session?.user as any)?.plan || 'FREE')
```

### モバイルでサイドバーが閉じない

**症状**: モバイルでサイドバーを開いた後、閉じられない

**対策:**

```typescript
// ✅ 正しい実装: AnimatePresence で exit アニメーション
<AnimatePresence>
  {isSidebarOpen && (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      exit={{ x: -280 }}  // exit を指定
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* ... */}
    </motion.div>
  )}
</AnimatePresence>
```

### 折りたたみ状態が保存されない

**症状**: ページリロードで折りたたみ状態がリセットされる

**対策:**

```typescript
// ✅ 正しい実装: LocalStorage で永続化
React.useEffect(() => {
  const saved = localStorage.getItem('myservice-sidebar-collapsed')
  if (saved !== null) {
    setIsCollapsed(saved === 'true')
  }
}, [])

const handleToggle = React.useCallback((collapsed: boolean) => {
  setIsCollapsed(collapsed)
  localStorage.setItem('myservice-sidebar-collapsed', String(collapsed))
}, [])
```

---

## 共通コンポーネント

### ToolSwitcherMenu

`src/components/ToolSwitcherMenu.tsx`

3つのツール間を切り替えるドロップダウンメニュー。

**注意**: ベータ版サービスは他サービスのサイドバーには表示しない。

### LogoutToastListener

`src/components/LogoutToastListener.tsx`

ログアウト後のトースト表示を管理。

### SidebarTour

`src/components/SidebarTour.tsx`

初回ログイン時のサイドバーツアー。

---

*最終更新: 2026年1月*


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


# 🎬 アニメーション仕様

全サービス共通のアニメーション実装リファレンスです。

---

## 目次

1. [モード定義](#モード定義)
2. [共通アニメーション](#共通アニメーション)
3. [Party演出](#party演出)
4. [LoadingOverlayコンポーネント](#loadingoverlayコンポーネント)
5. [CSS/Tailwind定義](#csstailwind定義)
6. [Framer Motion実装例](#framer-motion実装例)

---

## モード定義

```typescript
export type MotionMode = 'party' | 'minimal'
```

---

## 共通アニメーション

### マウント（初期表示）

| 要素 | アニメーション | 時間 |
|------|--------------|------|
| ページ全体 | `opacity 0 → 1` | 0.25s / ease-out |
| メインコンテナ | `y 12 → 0` + `opacity 0 → 1` | 0.3s / ease-out |
| ナビ要素 | delay 0.1s でフェードイン | 0.2s / ease-out |

### 出現順（stagger）

- 出現順：**見出し → 説明 → 入力 → ボタン**
- `staggerChildren: 0.06`

### CTA操作感

| 状態 | 効果 | 時間 |
|------|------|------|
| hover | `scale 1 → 1.02` | 0.15s / ease-out |
| tap | `scale 0.98` | 0.1s |
| party + hover | + `rotate: -0.4deg` | - |
| party + tap | + `rotate: 0.8deg` | - |

### 画面遷移

| 要素 | アニメーション |
|------|--------------|
| 新画面 | `x 16 → 0` / `opacity 0 → 1` |
| 旧画面 | `opacity 1 → 0` |
| duration | 0.25〜0.35s |
| ease | easeOut |
| spring | minimal: 不使用 / party: 任意 |

---

## Party演出

### マスコット（進捗連動）

```typescript
type OverlayMood = 'idle' | 'search' | 'think' | 'happy'
```

| 進捗 | mood | 動き |
|------|------|------|
| `< 35%` | `search` | 小刻み上下＋揺れ |
| `< 70%` | `think` | ゆっくり上下 |
| `>= 70%` | `happy` | 左右スイング＋軽い回転 |

### 紙吹雪

- ライブラリ: `canvas-confetti`
- 発火タイミング: 完了時

---

## マスコット素材

- 参照パス：`/persona/mascot.svg`

```typescript
import confetti from 'canvas-confetti'

confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
})
```

### 動く背景

- `pointer-events: none` 必須
- ブロブアニメーション（rotate / y oscillation）

---

## LoadingOverlayコンポーネント

```typescript
export type LoadingOverlayProps = {
  open: boolean
  mode: MotionMode
  progress: number          // 0-100
  stageText: string
  mood: OverlayMood
  steps: { label: string; threshold: number }[]
}
```

### 使用例

```tsx
<LoadingOverlay
  open={isLoading}
  mode="party"
  progress={progress}
  stageText="生成中..."
  mood={mood}
  steps={[
    { label: '解析', threshold: 25 },
    { label: '生成', threshold: 50 },
    { label: '仕上げ', threshold: 75 },
    { label: '完了', threshold: 100 },
  ]}
/>
```

---

## CSS/Tailwind定義

### キーフレーム

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.5); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### ユーティリティクラス

```css
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
.animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
.animate-fade-in-down { animation: fadeInDown 0.5s ease-out forwards; }
.animate-scale-in { animation: scaleIn 0.3s ease-out forwards; }
.animate-slide-in-right { animation: slideInRight 0.5s ease-out forwards; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }

.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-200 { animation-delay: 200ms; }
.animation-delay-300 { animation-delay: 300ms; }
.animation-delay-400 { animation-delay: 400ms; }
.animation-delay-500 { animation-delay: 500ms; }
```

### Tailwind config

```typescript
animation: {
  'fade-in': 'fadeIn 0.5s ease-out forwards',
  'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
  'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
  'scale-in': 'scaleIn 0.3s ease-out forwards',
  'slide-in-right': 'slideInRight 0.5s ease-out forwards',
  'float': 'float 3s ease-in-out infinite',
  'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
  'shimmer': 'shimmer 2s infinite',
  'spin-slow': 'spin 8s linear infinite',
},
```

---

## Framer Motion実装例

### Stagger Container

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}
```

### CTAボタン

```tsx
<motion.button
  whileHover={{ scale: 1.02, rotate: mode === 'party' ? -0.4 : 0 }}
  whileTap={{ scale: 0.98, rotate: mode === 'party' ? 0.8 : 0 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
  生成する
</motion.button>
```

### マスコット

```tsx
const mascotVariants = {
  search: {
    y: [0, -4, 0],
    rotate: [-2, 2, -2],
    transition: { repeat: Infinity, duration: 0.5 },
  },
  think: {
    y: [0, -8, 0],
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
  },
  happy: {
    x: [-4, 4, -4],
    rotate: [-5, 5, -5],
    transition: { repeat: Infinity, duration: 0.8 },
  },
}
```

### 動く背景

```tsx
<motion.div
  className="fixed inset-0 pointer-events-none z-0"
  animate={{
    background: [
      'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
      'radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
    ],
  }}
  transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
/>
```

---

## 参考実装

- マスコット素材: `public/persona/mascot.svg`

---

*最終更新: 2026年1月*
# 🚧 製作中サービス（ベータ版）管理ガイド

製作中のサービスをベータ版として公開する際の管理方法です。

---

## 目次

1. [ベータ版サービスの定義](#ベータ版サービスの定義)
2. [表示ルール](#表示ルール)
3. [実装方法](#実装方法)
4. [ベータ版マークの表示](#ベータ版マークの表示)
5. [ベータ版から正式版への移行](#ベータ版から正式版への移行)

---

## ベータ版サービスの定義

### ステータス

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  name: 'ドヤサイト',
  status: 'beta',  // 製作中・ベータ版
  badge: 'ベータ版',
  // ...
}
```

### ベータ版の条件

以下の条件を満たすサービスはベータ版として扱います：

1. **基本機能は動作する**が、まだ改善が必要
2. **UI/UXが未完成**または調整中
3. **ドキュメントが不完全**
4. **一般ユーザーへの公開は可能**だが、注意喚起が必要
5. **他サービスのサイドバーには表示しない**（自分自身のサイドバーのみ表示）

---

## 表示ルール

### ✅ 表示する場所

1. **サービス自身のサイドバー**
   - ツール切替メニューに表示（自分自身を含む）
   - ロゴ横に「ベータ版」バッジを表示

2. **サービス自身のページ**
   - ページタイトル横に「ベータ版」バッジを表示

3. **トップページ（ポータル）**
   - サービス一覧に表示（ベータ版バッジ付き）

### ❌ 表示しない場所

1. **他サービスのサイドバー**
   - ToolSwitcherMenuに表示しない
   - 他のサービスのサイドバーからは見えないようにする

2. **サービス一覧ナビゲーション（他サービス内）**
   - 他のサービスのサイドバーからは遷移できない

---

## 実装方法

### 1. サービス定義

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  status: 'beta',
  badge: 'ベータ版',
  // ...
}
```

### 2. ToolSwitcherMenuの修正

製作中のサービス（ベータ版）は、**そのサービス自身のサイドバー**以外では表示しない。

```typescript
// src/components/ToolSwitcherMenu.tsx

// ベータ版でないサービスのみを表示
const TOOLS: Array<{
  id: ToolId
  href: string
  title: string
  description: string
  icon: React.ElementType
  iconBgClassName: string
  isBeta?: boolean  // ベータ版フラグ
}> = [
  {
    id: 'persona',
    // ...
    isBeta: false,
  },
  {
    id: 'banner',
    // ...
    isBeta: false,
  },
  {
    id: 'writing',
    // ...
    isBeta: false,
  },
  // ベータ版サービスは通常のサイドバーには含めない
  // {
  //   id: 'lp-site',
  //   isBeta: true,  // 自分自身のサイドバーでのみ表示
  // }
]

// フィルタリング（オプション）
// const visibleTools = TOOLS.filter(tool => !tool.isBeta || currentTool === tool.id)
```

### 3. サイドバー実装

**ベータ版サービス自身のサイドバー**では、自分自身を含めて全て表示する。

```typescript
// src/components/LpSiteSidebar.tsx

// 自分自身のサイドバーでは、ベータ版も含めて全ツールを表示
const TOOLS_FOR_LP_SITE = [
  ...TOOLS,  // 通常のツール
  {
    id: 'lp-site',
    href: '/lp-site',
    title: 'ドヤサイト',
    description: 'LP自動生成',
    icon: Globe,
    iconBgClassName: 'bg-gradient-to-br from-teal-500 to-cyan-500',
    isBeta: true,
  },
]
```

---

## ベータ版マークの表示

### サイドバー

```tsx
// ロゴ横に表示
<div className="flex items-center gap-2">
  <h1 className="text-lg font-black text-white">ドヤサイト</h1>
  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md">
    ベータ版
  </span>
</div>
```

### ページタイトル

```tsx
// ページタイトル横に表示
<div className="flex items-center gap-3">
  <h1 className="text-4xl font-black text-slate-900">ドヤサイト</h1>
  <span className="px-2 py-1 bg-amber-500 text-white text-xs font-black rounded-md shadow-sm">
    ベータ版
  </span>
</div>
```

### ツール切替メニュー（自分自身のサイドバー内）

```tsx
// ベータ版バッジを表示
<div className="flex items-center gap-1.5">
  <p className="text-sm font-black text-slate-900">ドヤサイト</p>
  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md">
    ベータ版
  </span>
</div>
```

---

## ベータ版から正式版への移行

### 移行手順

1. **サービス定義の更新**

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  status: 'active',  // beta → active に変更
  badge: undefined,  // バッジを削除
  // ...
}
```

2. **ToolSwitcherMenuに追加**

```typescript
// src/components/ToolSwitcherMenu.tsx
const TOOLS = [
  // ... 既存のツール
  {
    id: 'lp-site',
    href: '/lp-site',
    title: 'ドヤサイト',
    description: 'LP自動生成',
    icon: Globe,
    iconBgClassName: 'bg-gradient-to-br from-teal-500 to-cyan-500',
  },
]
```

3. **全てのサイドバーで表示**

- DashboardSidebar.tsx
- SeoSidebar.tsx
- PersonaSidebar.tsx
- その他全てのサイドバー

4. **ベータ版バッジの削除**

- サイドバーのロゴ横
- ページタイトル横
- ToolSwitcherMenu内

5. **テスト**

- 全てのサイドバーからツール切替ができることを確認
- ベータ版バッジが表示されないことを確認

---

## チェックリスト

### 新規ベータ版サービス追加時

- [ ] `src/lib/services.ts` で `status: 'beta'` を設定
- [ ] `badge: 'ベータ版'` を追加
- [ ] サービス自身のサイドバーにベータ版バッジを表示
- [ ] サービス自身のページにベータ版バッジを表示
- [ ] **他サービスのサイドバーには表示しない**（ToolSwitcherMenuに含めない）
- [ ] `getActiveServices()` でベータ版も取得できることを確認

### ベータ版→正式版移行時

- [ ] `status: 'active'` に変更
- [ ] `badge` を削除または `undefined` に設定
- [ ] 全サイドバーのToolSwitcherMenuに追加
- [ ] ベータ版バッジを全箇所から削除
- [ ] 動作確認

---

## 現在のベータ版サービス

| サービスID | サービス名 | ステータス | 備考 |
|-----------|----------|----------|------|
| （現在なし） | - | - | - |

---

## ストップ中のサービス

開発・運用を停止しているサービスです。

### ストップサービスの定義

以下の条件を満たすサービスはストップサービスとして扱います：

1. **開発が停止している**
2. **新規ユーザーへの公開を停止している**
3. **既存ユーザーへのサポートも停止している**
4. **サイドバーやツール切替メニューから非表示**
5. **将来的に再開する可能性がある**（完全削除ではない）

### 表示ルール

#### ❌ 表示しない場所

1. **全てのサイドバー**
   - ToolSwitcherMenuに表示しない
   - どのサービスのサイドバーからも見えない

2. **トップページ（ポータル）**
   - サービス一覧に表示しない

3. **サービス自身のページ**
   - アクセスしてもエラーまたは停止メッセージを表示

### 実装方法

#### 1. サービス定義

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  name: 'ドヤサイト',
  status: 'stopped',  // ストップ中
  badge: undefined,   // バッジなし
  // ...
}
```

#### 2. ToolSwitcherMenu

ストップ中のサービスは、どのサイドバーにも表示しない。

```typescript
// src/components/ToolSwitcherMenu.tsx

// ストップ中のサービスは含めない
const TOOLS = [
  {
    id: 'persona',
    // ...
  },
  {
    id: 'banner',
    // ...
  },
  // lp-site は含めない（ストップ中）
]
```

#### 3. サービスページ

アクセスされた場合は停止メッセージを表示。

```tsx
// src/app/lp-site/page.tsx
export default function LpSitePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">ドヤサイト</h1>
        <p className="text-gray-600">
          現在、このサービスは停止中です。
        </p>
      </div>
    </div>
  )
}
```

### ストップ→再開時の手順

1. **サービス定義の更新**

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  status: 'beta',  // stopped → beta に変更
  badge: 'ベータ版',
  // ...
}
```

2. **サービス自身のサイドバーに追加**

```typescript
// src/components/LpSiteSidebar.tsx
const TOOLS_FOR_LP_SITE = [
  ...TOOLS,
  {
    id: 'lp-site',
    // ...
    isBeta: true,
  },
]
```

3. **ページの復旧**

- 停止メッセージを削除
- 通常の機能を復旧

4. **テスト**

- サービス自身のサイドバーからアクセスできることを確認
- 他サービスのサイドバーには表示されないことを確認

---

## 現在のストップサービス

| サービスID | サービス名 | ステータス | 停止理由 | 備考 |
|-----------|----------|----------|---------|------|
| `lp-site` | ドヤサイト | `stopped` | 開発停止 | LP自動生成ツール |

---

*最終更新: 2026年1月*


