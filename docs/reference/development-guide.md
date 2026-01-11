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
| AI (テキスト) | Google Gemini API (Gemini 3 Pro Preview, Gemini 2.0 Flash) |
| AI (画像) | Nano Banana Pro |
| 音声処理 | Google Cloud Speech-to-Text API |
| ストレージ | Vercel Blob Storage / Google Cloud Storage (GCS) |
| ホスティング | Vercel |
| アニメーション | Framer Motion |
| その他 | OpenAI API, SerpAPI, Google Slides API |

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

## 現状のサービス一覧

現在実装されているサービスとその特徴です。

### アクティブサービス

#### 1. カンタンマーケAI (`kantan`)
- **ID**: `kantan`
- **ステータス**: `active`
- **カテゴリ**: テキスト生成
- **主な機能**:
  - 15種類のマーケAIエージェント
  - チャット形式でマーケ相談
  - ブランド設定対応
  - 広告データ分析
- **プラン**: 無料（1日10回） / プロ（1日100回）

#### 2. ドヤバナーAI (`banner`)
- **ID**: `banner`
- **ステータス**: `active`
- **カテゴリ**: 画像生成
- **主な機能**:
  - 3案同時生成
  - カテゴリ別テンプレート
  - サイズ自動調整
  - 履歴保存
  - URLからの画像生成
  - バナーコピー機能
  - チャット機能
- **プラン**: 無料（1日9枚） / プロ（1日50枚）

#### 3. ドヤライティングAI (`seo`)
- **ID**: `seo`
- **ステータス**: `active`
- **カテゴリ**: テキスト生成
- **主な機能**:
  - アウトライン/セクション生成
  - 画像生成（図解/サムネ）
  - 監査（二重チェック）
  - 履歴保存
  - ジョブ進行型パイプライン
  - SerpAPIによる検索結果取得
- **プラン**: 無料（1日1回） / プロ（1日3回）

#### 4. ドヤペルソナAI (`persona`)
- **ID**: `persona`
- **ステータス**: `active`
- **カテゴリ**: テキスト生成
- **主な機能**:
  - ペルソナ自動生成
  - 詳細な属性設定
  - 画像生成（ポートレート、バナー、日記画像）
  - 履歴保存
- **プラン**: 無料（1日3回） / プロ（1日100回）

### ベータ版サービス

#### 5. ドヤインタビューAI (`interview`)
- **ID**: `interview`
- **ステータス**: `beta`
- **カテゴリ**: テキスト生成
- **主な機能**:
  - **音声・動画の自動文字起こし**（Google Cloud Speech-to-Text）
  - 企画提案と質問リスト生成
  - 構成案の自動作成
  - 記事ドラフト生成
  - 校閲・品質チェック
  - レシピ機能（テンプレート保存）
  - ファイルアップロード（GCS使用）
  - チャンクアップロード対応
- **プラン**: 無料（1日3回） / プロ（1日100回）
- **特徴**: 音声入力機能を実装した最初のサービス

#### 6. ドヤサイト (`lp-site`)
- **ID**: `lp-site`
- **ステータス**: `beta`
- **カテゴリ**: 画像生成
- **主な機能**:
  - セクション単位の画像生成
  - ドラッグ&ドロップで並び替え
  - セクションごとの編集・再生成
  - PC版・SP版対応
  - ワイヤーフレームから完成まで
  - ストリーミング生成対応
- **プラン**: 無料（1日3回） / プロ（1日100回）

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
| **SerpAPI** | Google検索結果取得 | ✅ 実装済み（SEOサービス） |
| **Google Cloud Speech-to-Text** | 音声・動画文字起こし | ✅ 実装済み（インタビューサービス） |
| **Google Cloud Storage** | ファイルストレージ | ✅ 実装済み（インタビューサービス） |
| **Google Slides API** | スライド生成・公開 | ✅ 実装済み（スライドサービス） |
| **OpenAI API** | テキスト・画像生成 | ✅ 実装済み（共通ライブラリ） |
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

## 共通で使える開発項目

新サービス開発時に活用できる共通機能やパターンです。

### 1. プラン管理システム

全てのサービスで統一されたプラン管理システムを使用します。

```typescript
// UserServiceSubscription を使用
const subscription = await prisma.userServiceSubscription.findUnique({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',
    },
  },
})

const plan = subscription?.plan || 'FREE'
const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
```

**詳細**: [implementation-patterns.md](./implementation-patterns.md#プラン管理パターン) を参照

### 2. 使用量チェック

日次リセット機能付きの使用量チェックパターン。

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
if (subscription.dailyUsage >= dailyLimit) {
  return NextResponse.json(
    { error: '使用上限に達しました', limit: dailyLimit },
    { status: 429 }
  )
}
```

### 3. ゲストユーザー対応

ログインしていないユーザーも利用できるようにするパターン。

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

### 4. エラーハンドリングパターン

統一されたエラーハンドリングパターン。

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

### 5. ストリーミング生成

リアルタイムで生成結果を送信するパターン。

```typescript
// Server-Sent Events (SSE) を使用
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // 生成途中の結果を送信
      for await (const chunk of generateStream()) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`)
        )
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
```

**実装例:**
- `src/app/api/lp-site/generate-stream/route.ts` - ストリーミング生成実装

### 6. ジョブ進行型処理

複数ステップで完了する処理のパターン（SEO記事生成など）。

```typescript
// API: POST /api/myservice/jobs/[id]/advance
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.myServiceJob.findUnique({
    where: { id: params.id },
  })

  const currentStep = job.currentStep
  const nextStep = getNextStep(currentStep)

  // 次のステップを実行
  const result = await executeStep(nextStep, job)

  // ジョブ状態を更新
  await prisma.myServiceJob.update({
    where: { id: params.id },
    data: {
      currentStep: nextStep,
      [`${nextStep}Result`]: result,
    },
  })

  return NextResponse.json({ status: 'in_progress', currentStep: nextStep })
}
```

**実装例:**
- `src/app/api/seo/jobs/[id]/advance/route.ts` - ジョブ進行実装

### 7. ファイルアップロード

小さいファイルと大きいファイルの両方に対応。

- **小さいファイル（<4.5MB）**: Vercel Blob Storage
- **大きいファイル（>=4.5MB）**: Google Cloud Storage + チャンクアップロード

**詳細**: [implementation-patterns.md](./implementation-patterns.md#ファイルアップロードパターン) を参照

### 8. 認証・セッション管理

NextAuth.jsを使用した統一された認証システム。

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const session = await getServerSession(authOptions)
const userId = session?.user?.id
```

### 9. 決済連携（Stripe）

統一されたStripe決済システム。

```typescript
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { CheckoutButton } from '@/components/CheckoutButton'

// クライアント側
<CheckoutButton planId="myservice-pro" billingPeriod="monthly">
  PROを始める
</CheckoutButton>
```

### 10. 通知機能

```typescript
import { sendPaymentNotification } from '@/lib/notifications'

await sendPaymentNotification({
  userId,
  email: user.email,
  plan: 'PRO',
  amount: 4980,
})
```

**共通ライブラリ:**
- `src/lib/notifications.ts` - 通知機能

---

## アカウント共通機能・プラン管理の詳細マニュアル

新サービス開発時に活用できるアカウント管理・プラン管理の共通機能です。

### 1. 認証・セッション管理システム

#### 概要

NextAuth.jsを使用した統一された認証システムです。Google OAuthでログインし、セッション情報にはプラン情報も含まれます。

#### 実装

```typescript
// src/lib/auth.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// サーバー側でのセッション取得
const session = await getServerSession(authOptions)
const userId = session?.user?.id
const userPlan = (session?.user as any)?.plan // 'FREE' | 'PRO' | 'ENTERPRISE'
```

#### セッション情報

セッションには以下の情報が含まれます：

```typescript
{
  user: {
    id: string                    // ユーザーID
    email: string                 // メールアドレス
    name: string                  // ユーザー名
    image: string                 // プロフィール画像URL
    role: 'USER' | 'ADMIN'        // ロール
    plan: 'FREE' | 'PRO' | 'ENTERPRISE'  // 統一プラン（Complete Pack）
    bannerPlan: string            // バナーサービスのプラン
    seoPlan: string               // SEOサービスのプラン
    personaPlan: string           // ペルソナサービスのプラン
    kantanPlan?: string           // カンタンマーケのプラン（個別）
    firstLoginAt: string | null   // 初回ログイン時刻
  }
}
```

#### クライアント側での使用

```typescript
'use client'
import { useSession } from 'next-auth/react'

function MyComponent() {
  const { data: session, status } = useSession()
  
  if (status === 'loading') return <div>読み込み中...</div>
  if (status === 'unauthenticated') return <div>ログインが必要です</div>
  
  const userPlan = (session?.user as any)?.plan
  const userId = session?.user?.id
}
```

#### 初回ログイン処理

新規ユーザーの初回ログイン時には、`firstLoginAt`が記録され、新規ユーザー通知が送信されます。

```typescript
// src/lib/auth.ts の signIn コールバックで自動処理
// firstLoginAt が null の場合、現在時刻を記録
// sendNewUserNotification が呼び出される
```

#### セッション更新

- **セッション有効期限**: 24時間
- **更新間隔**: 1分ごとに更新（プラン変更を素早く反映）

---

### 2. プラン管理システム

#### プランの種類

**統一プラン（Complete Pack）:**
- `FREE`: 無料プラン
- `PRO`: プロプラン
- `ENTERPRISE`: エンタープライズプラン

**サービス別プラン:**
各サービスは `UserServiceSubscription` テーブルで個別にプランを管理できますが、Complete Packでは統一プランが優先されます。

#### プラン管理の実装

```typescript
// src/lib/planSync.ts
import { normalizeUnifiedPlan, syncUserPlanAcrossServices, maxPlan } from '@/lib/planSync'

// プランを正規化（旧プラン名も互換）
const unified = normalizeUnifiedPlan(user.plan) // 'FREE' | 'PRO' | 'ENTERPRISE'

// 複数プランから最大値を取得
const max = maxPlan('FREE', 'PRO') // 'PRO'

// 全サービスにプランを同期（Complete Pack）
await syncUserPlanAcrossServices({
  userId: user.id,
  plan: 'PRO',
  stripeSubscriptionId: subscription.id,
  stripePriceId: price.id,
  stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
})
```

#### プランの取得

```typescript
// サービス別プランを取得
const subscription = await prisma.userServiceSubscription.findUnique({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',
    },
  },
})

const plan = subscription?.plan || 'FREE'

// 統一プランとサービス別プランの両方を考慮
const effectivePlan = subscription?.plan || userPlan || 'FREE'
```

#### Complete Pack（統一プラン）

主要サービス（`banner`, `writing`, `persona`）は統一プランで管理されます：

- ユーザーの `User.plan` が真実のソース
- `syncUserPlanAcrossServices` で全サービスに同期
- セッションでは統一プランが優先表示

---

### 3. プランのアップグレード・決済フロー

#### CheckoutButtonコンポーネント

```typescript
// src/components/CheckoutButton.tsx
import { CheckoutButton } from '@/components/CheckoutButton'

<CheckoutButton
  planId="myservice-pro"
  billingPeriod="monthly"
  loginCallbackUrl="/myservice/pricing"
  variant="primary"
>
  PROを始める
</CheckoutButton>
```

**パラメータ:**
- `planId`: プランID（例: `myservice-pro`, `banner-pro-monthly`）
- `billingPeriod`: `'monthly'` | `'yearly'`
- `loginCallbackUrl`: ログイン後のリダイレクト先
- `variant`: `'primary'` | `'secondary'`

#### 決済セッション作成API

```typescript
// POST /api/stripe/checkout
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: 'myservice-pro',
    billingPeriod: 'monthly',
  }),
})

const { url } = await response.json() // Stripe Checkout URL
```

#### 決済フロー

1. **ユーザーがCheckoutButtonをクリック**
2. **未ログインの場合**: ログインページへリダイレクト
3. **ログイン済みの場合**: `/api/stripe/checkout` を呼び出し
4. **Stripe Checkoutセッション作成**
5. **Stripeの決済ページへリダイレクト**
6. **決済完了後**: Webhookでプランを更新

---

### 4. Stripe Webhook処理

#### 対応イベント

StripeからのWebhookイベントを処理します：

| イベント | 処理内容 |
|---------|---------|
| `checkout.session.completed` | チェックアウト完了時の処理 |
| `customer.subscription.created` | サブスクリプション作成時の処理 |
| `customer.subscription.updated` | サブスクリプション更新時の処理（アップグレード・ダウングレード） |
| `customer.subscription.deleted` | サブスクリプション削除時の処理（解約） |
| `invoice.payment_succeeded` | 支払い成功時の処理 |
| `invoice.payment_failed` | 支払い失敗時の処理 |

#### 実装例

```typescript
// src/app/api/stripe/webhook/route.ts
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')
  
  // Webhook署名を検証
  const event = constructWebhookEvent(body, signature, webhookSecret)
  
  switch (event.type) {
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionUpdated(subscription)
      break
    // ...
  }
}
```

#### サブスクリプション更新時の処理

```typescript
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  const serviceId = subscription.metadata?.serviceId
  
  // プランを同期（Complete Pack）
  await syncUserPlanAcrossServices({
    userId: userId!,
    plan: 'PRO', // サブスクリプションの状態から判定
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id,
    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
  })
}
```

#### 環境変数

```env
STRIPE_SECRET_KEY=sk_live_...  # または sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

### 5. サブスクリプション解約・再開

#### 解約（期間末解約）

```typescript
// POST /api/stripe/subscription/cancel
const response = await fetch('/api/stripe/subscription/cancel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId: 'myservice',
    mode: 'period_end', // 期間末に解約（デフォルト）
  }),
})

const { ok, cancelAtPeriodEnd, currentPeriodEnd } = await response.json()
```

**モード:**
- `period_end`: 期間末に解約（デフォルト、推奨）
- `immediate`: 即座に解約（返金なし）

#### 再開（解約取り消し）

```typescript
// POST /api/stripe/subscription/resume
const response = await fetch('/api/stripe/subscription/resume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId: 'myservice',
  }),
})

const { ok, cancelAtPeriodEnd } = await response.json()
```

#### 実装のポイント

- サービスIDでサブスクリプションを特定
- DBにない場合はStripeから検索
- `cancel_at_period_end` フラグで解約予約状態を管理

---

### 6. カスタマーポータル

#### 概要

Stripeのカスタマーポータルにリダイレクトして、ユーザー自身でサブスクリプションを管理できるようにします。

#### 実装

```typescript
// POST /api/stripe/portal
const response = await fetch('/api/stripe/portal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    returnTo: '/myservice/pricing', // ポータル終了後のリダイレクト先
  }),
})

const { url } = await response.json() // ポータルURL
window.location.href = url
```

#### GET エンドポイント（リンク遷移用）

```typescript
// GET /api/stripe/portal?returnTo=/myservice/pricing
// ブラウザで直接アクセスできる形式
```

#### ポータルでできること

- プランの変更（アップグレード・ダウングレード）
- 支払い方法の変更
- 請求履歴の確認
- サブスクリプションの解約

---

### 7. 使用量管理システム

#### 日次使用量の管理

```typescript
// src/lib/usage.ts はクライアント側のローカルストレージ管理用
// サーバー側では UserServiceSubscription テーブルを使用

const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId: 'myservice' } },
})

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
  return NextResponse.json(
    { error: '使用上限に達しました', limit: dailyLimit },
    { status: 429 }
  )
}

// 使用量を増やす
await prisma.userServiceSubscription.update({
  where: { id: subscription.id },
  data: { dailyUsage: { increment: 1 } },
})
```

#### プランごとの使用制限

```typescript
const PLAN_LIMITS = {
  FREE: { dailyLimit: 3 },
  PRO: { dailyLimit: 100 },
  ENTERPRISE: { dailyLimit: -1 }, // 無制限
}
```

---

### 8. プラン同期機能（Complete Pack）

#### 概要

主要サービス（`banner`, `writing`, `persona`）のプランを統一する機能です。

#### 実装

```typescript
// src/lib/planSync.ts
import { syncUserPlanAcrossServices } from '@/lib/planSync'

// 全サービスにプランを同期
await syncUserPlanAcrossServices({
  userId: user.id,
  plan: 'PRO',
  stripeSubscriptionId: subscription.id,
  stripePriceId: price.id,
  stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
})
```

#### 処理内容

1. **ユーザーレコードの更新**: `User.plan` を更新
2. **主要サービスの同期**: `banner`, `writing`, `persona` のプランを更新または作成
3. **旧サービスの更新**: `seo` が存在する場合のみ更新（作成はしない）

#### セッションでの反映

```typescript
// src/lib/auth.ts の session コールバック
// 統一プランが優先される
const unified = maxPlan(
  normalizeUnifiedPlan(dbUser.plan || 'FREE'),
  serviceMax
)
;(session.user as any).plan = unified
;(session.user as any).bannerPlan = unified
;(session.user as any).seoPlan = unified
;(session.user as any).personaPlan = unified
```

---

### 9. 通知機能

#### 決済通知

```typescript
// src/lib/notifications.ts
import { sendPaymentNotification } from '@/lib/notifications'

await sendPaymentNotification({
  userId,
  email: user.email,
  name: user.name,
  plan: 'PRO',
  amount: 4980,
  currency: 'jpy',
  subscriptionId: subscription.id,
  isRecurring: false, // 初回: false, 更新: true
})
```

#### 新規ユーザー通知

```typescript
import { sendNewUserNotification } from '@/lib/notifications'

await sendNewUserNotification({
  userId: user.id,
  email: user.email,
  name: user.name,
  image: user.image,
  provider: 'google',
})
```

---

### 10. 実装チェックリスト

新サービスでプラン管理を実装する際のチェックリスト：

- [ ] `UserServiceSubscription` でプラン管理
- [ ] 使用量チェックを実装（日次リセット含む）
- [ ] Stripe価格IDを `src/lib/stripe.ts` に追加
- [ ] Webhook処理でプラン更新（`syncUserPlanAcrossServices` 使用）
- [ ] CheckoutButtonコンポーネントを配置
- [ ] カスタマーポータルへのリンクを配置
- [ ] 解約・再開機能を実装（必要に応じて）
- [ ] プラン表示を実装（セッションから取得）

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

