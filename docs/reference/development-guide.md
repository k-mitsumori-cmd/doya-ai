# 🚀 ドヤAI 開発ガイド（新サービス追加手順）

新しいサービスを追加する際の完全ガイドです。

---

## 📋 クイックスタート（開発開始時）

新サービス開発を開始する際は、以下の順番で確認してください：

1. **[共通項目・必須実装の確認](#共通項目必須実装の確認)** ⬅️ **まずここから**
2. **[新サービス開発 完全チェックリスト](#新サービス開発-完全チェックリスト)** - 実装時のチェックリスト
3. [新サービス追加手順](#新サービス追加手順) - 詳細な実装手順
4. [共通コンポーネント](#共通コンポーネント) - 共通で使えるコンポーネント
5. [実装パターン集](#実装パターン集) - 具体的な実装例

---

## 目次

1. [前提条件](#前提条件)
2. [技術スタック](#技術スタック)
3. [ディレクトリ構成](#ディレクトリ構成)
4. [共通項目・必須実装の確認](#共通項目必須実装の確認) ⬅️ **開発開始時に必ず確認**
5. [新サービス追加手順](#新サービス追加手順)
6. [共通コンポーネント](#共通コンポーネント)
7. [認証・セッション](#認証セッション)
8. [課金連携（Stripe）](#課金連携stripe)
9. [サービス分離ルール](#サービス分離ルール)
10. [絶対に守るべきルール](#絶対に守るべきルール)

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

#### プラン体系

| プラン | 説明 | 認証状態 | 主な特徴 |
|--------|------|----------|----------|
| **GUEST** | ゲストユーザー | 未ログイン | 基本的な機能のみ、厳しい使用制限（1回/日など） |
| **FREE** | 無料プラン | ログイン済み | すべての基本機能、軽い使用制限（3-10回/日など） |
| **PRO** | プロプラン | ログイン済み + サブスクリプション | すべての機能、緩い使用制限（50-100回/日など） |
| **ENTERPRISE** | エンタープライズプラン | ログイン済み + サブスクリプション | すべての機能、使用制限なしまたは大幅に緩和 |

**重要**: 新サービス開発時は、**まずプラン設計（プランごとの権限・機能制限）を行ってから実装を開始**してください。

#### プラン取得パターン

**サーバー側（APIエンドポイント）:**
```typescript
// DBからサービス別プランを取得
const subscription = await prisma.userServiceSubscription.findUnique({
  where: {
    userId_serviceId: {
      userId: userId!,
      serviceId: 'myservice',
    },
  },
})

// セッションから統一プランを取得（オプション）
const session = await getServerSession(authOptions)
const userPlan = (session?.user as any)?.plan

// プランを決定（サービス別プラン > 統一プラン > FREE）
const plan = subscription?.plan || userPlan || 'FREE'
const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
```

**クライアント側（サイドバー・レイアウト）:**
```typescript
// サービス別プランと統一プランの両方を考慮
const servicePlan = String((session?.user as any)?.myServicePlan || '').toUpperCase()
const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
const effectivePlan = servicePlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
```

#### 注意点

- **権限のずれを防ぐ**: サービス別プランと統一プランの両方を考慮
- **Complete Pack**: 主要サービス（`banner`, `writing`, `persona`）は統一プランを優先
- **フォールバック**: サービス別プランがない場合は統一プランを使用

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

### 2.5 初回ログイン1時間使い放題機能

**重要**: 新サービス開発時は、**初回ログイン後1時間は全ての機能を使い放題**とする機能を実装してください。

#### 機能概要

ユーザーが初回ログインしてから1時間以内は、プランに関係なく全ての機能を使い放題（PRO相当の権限）にします。

#### 実装パターン

**1. セッションコールバックでの `firstLoginAt` 記録**

`src/lib/auth.ts` の `session` コールバックで、初回ログイン時刻を記録：

```typescript
// src/lib/auth.ts
async session({ session, user }) {
  if (session.user && user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { firstLoginAt: true }
    })
    
    // firstLoginAt をセッションに載せる
    ;(session.user as any).firstLoginAt = dbUser?.firstLoginAt?.toISOString() || null
  }
  return session
}
```

**2. 初回ログイン時刻の記録（`signIn` コールバック）**

`src/lib/auth.ts` の `signIn` コールバックで、初回ログイン時刻を記録：

```typescript
// src/lib/auth.ts
async signIn({ user, account, profile }) {
  if (user?.id) {
    // 初回ログイン時刻を記録（既に記録されている場合は更新しない）
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        firstLoginAt: new Date(),
        // その他のフィールド
      },
    })
    
    // 既存ユーザーの場合、firstLoginAtがnullなら設定
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { firstLoginAt: true }
    })
    
    if (!existingUser?.firstLoginAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { firstLoginAt: new Date() },
      })
    }
  }
  return true
}
```

**3. 1時間以内かどうかの判定（`src/lib/pricing.ts`）**

```typescript
// src/lib/pricing.ts
export function isWithinFreeHour(firstLoginAt: string | null | undefined): boolean {
  if (!firstLoginAt) return false
  const start = Date.parse(firstLoginAt)
  if (!Number.isFinite(start)) return false
  const end = start + 60 * 60 * 1000 // 1時間
  return Date.now() < end
}

export function getFreeHourRemainingMs(firstLoginAt: string | null | undefined): number {
  if (!firstLoginAt) return 0
  const start = Date.parse(firstLoginAt)
  if (!Number.isFinite(start)) return 0
  const end = start + 60 * 60 * 1000 // 1時間
  return Math.max(0, end - Date.now())
}
```

**4. APIエンドポイントでの使用量チェック（1時間使い放題を考慮）**

```typescript
// APIエンドポイントでの実装
import { isWithinFreeHour } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  
  // 初回ログイン時刻を取得
  const firstLoginAt = (session.user as any)?.firstLoginAt as string | null | undefined
  
  // 1時間以内かどうかを判定
  const isFreeHourActive = isWithinFreeHour(firstLoginAt)
  
  // 1時間以内の場合は使用量チェックをスキップ（PRO相当の権限）
  if (!isFreeHourActive) {
    // 通常の使用量チェック
    const subscription = await prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'myservice' } },
    })
    
    const plan = subscription?.plan || 'FREE'
    const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0
    
    // 日次リセットチェック
    const now = new Date()
    const isNewDay = now.toDateString() !== subscription?.lastUsageReset.toDateString()
    if (isNewDay) {
      await prisma.userServiceSubscription.update({
        where: { id: subscription.id },
        data: { dailyUsage: 0, lastUsageReset: now },
      })
    }
    
    // 使用量チェック
    if (subscription && subscription.dailyUsage >= dailyLimit) {
      return NextResponse.json(
        { error: '1日の使用上限に達しました。明日以降、またはPROプランにアップグレードしてご利用ください。', limit: dailyLimit, usage: subscription.dailyUsage },
        { status: 429 }
      )
    }
  }
  
  // 処理実行（1時間以内の場合は使用量をカウントしない）
  // ...
  
  // 使用量更新（1時間以内の場合は更新しない）
  if (!isFreeHourActive && subscription) {
    await prisma.userServiceSubscription.update({
      where: { id: subscription.id },
      data: { dailyUsage: { increment: 1 } },
    })
  }
  
  return NextResponse.json({ success: true })
}
```

**5. クライアント側での表示（サイドバー・レイアウト）**

```typescript
// サイドバー・レイアウトでの実装
import { useSession } from 'next-auth/react'
import { isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'

function MyServiceSidebar() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  
  // 1時間以内かどうかを判定
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  
  // 残り時間を計算
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => 
    getFreeHourRemainingMs(firstLoginAt)
  )
  
  useEffect(() => {
    if (!isFreeHourActive) return
    const interval = setInterval(() => {
      const remaining = getFreeHourRemainingMs(firstLoginAt)
      setFreeHourRemainingMs(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])
  
  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  // プラン表示（1時間以内の場合は「PRO相当」と表示）
  const planLabel = isFreeHourActive 
    ? '初回特典中（PRO相当）'
    : plan === 'PRO' ? 'PRO' : plan === 'FREE' ? 'FREE' : 'GUEST'
  
  // 1時間使い放題バナーの表示
  return (
    <>
      {isFreeHourActive && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-4 rounded-xl mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-sm">初回ログイン特典：1時間 使い放題（PRO相当）</p>
              <p className="text-xs mt-1">全機能解放されています</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase">残り</p>
              <p className="text-lg font-black tabular-nums">
                {formatRemainingTime(freeHourRemainingMs)}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* その他のコンテンツ */}
    </>
  )
}
```

**6. レイアウトでの表示（ヘッダー）**

```typescript
// レイアウトでの実装例（InterviewAppLayout.tsx を参考）
function MyServiceAppLayout() {
  const { data: session } = useSession()
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isWithinFreeHour(firstLoginAt)
  
  return (
    <div>
      {/* 1時間使い放題バナー（ヘッダーの下） */}
      {isFreeHourActive && (
        <div className="px-4 md:px-8 pt-2">
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-orange-900">
                  初回ログイン特典：1時間 使い放題（PRO相当）
                </p>
                <p className="text-[10px] font-bold text-orange-800/80">
                  全機能解放されています
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-orange-700 uppercase">残り</p>
                <p className="text-sm font-black text-orange-900 tabular-nums">
                  {formatRemainingTime(getFreeHourRemainingMs(firstLoginAt))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ヘッダー、メインコンテンツ */}
    </div>
  )
}
```

#### 実装チェックリスト

- [ ] `src/lib/auth.ts` の `signIn` コールバックで `firstLoginAt` を記録
- [ ] `src/lib/auth.ts` の `session` コールバックで `firstLoginAt` をセッションに載せる
- [ ] `src/lib/pricing.ts` に `isWithinFreeHour` と `getFreeHourRemainingMs` 関数を実装
- [ ] APIエンドポイントで `isWithinFreeHour` を使用して使用量チェックをスキップ
- [ ] 1時間以内の場合は使用量をカウントしない
- [ ] サイドバー・レイアウトで1時間使い放題バナーを表示
- [ ] 残り時間のカウントダウンを実装
- [ ] プラン表示で「PRO相当」と表示（1時間以内の場合）

#### 注意点

- ✅ **1時間以内の場合は使用量をカウントしない**: 使用量を増やさないようにする
- ✅ **PRO相当の権限**: 1時間以内の場合は、PROプランと同等の機能を利用できる
- ✅ **初回ログインのみ**: `firstLoginAt` が既に設定されている場合は、新たに設定しない
- ✅ **残り時間の表示**: ユーザーに残り時間を分かりやすく表示する

**参考実装:**
- `src/lib/pricing.ts` - `isWithinFreeHour`, `getFreeHourRemainingMs` 関数
- `src/lib/auth.ts` - `signIn`, `session` コールバック
- `src/components/InterviewSidebar.tsx` - 1時間使い放題バナーの表示
- `src/components/InterviewAppLayout.tsx` - レイアウトでの1時間使い放題バナーの表示

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

## ⚠️ 権限管理・プラン同期の重要事項

新サービス開発時に、**権限のずれを防ぐ**ための重要事項です。必ず確認してください。

### プラン判定の統一パターン

#### クライアント側（サイドバー・レイアウト）

```typescript
// サービス別プランと統一プランの両方を考慮
const servicePlan = String((session?.user as any)?.myServicePlan || '').toUpperCase()
const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
const effectivePlan = servicePlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
```

#### サーバー側（APIエンドポイント）

```typescript
// DBからサービス別プランを取得
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId: 'myservice' } },
})

// セッションから統一プランを取得（オプション）
const session = await getServerSession(authOptions)
const userPlan = (session?.user as any)?.plan

// プランを決定（サービス別プラン > 統一プラン > FREE）
const plan = subscription?.plan || userPlan || 'FREE'
```

### Complete Pack（統一プラン）の扱い

主要サービス（`banner`, `writing`, `persona`）は統一プランで管理されます：

- **セッション**: 統一プランが優先（`session.user.plan`）
- **表示**: 統一プランを使用（`session.user.bannerPlan`, `session.user.seoPlan`, `session.user.personaPlan`）
- **API**: `syncUserPlanAcrossServices()` で全サービスに同期

### よくある権限のずれの原因

1. **セッションとDBの不一致**: セッションコールバックで正しく同期されていない
2. **プラン判定ロジックの不備**: サービス別プランと統一プランの優先順位が間違っている
3. **フォールバック処理の不備**: サービス別プランがない場合の処理が不適切
4. **Complete Packの考慮不足**: 統一プランを考慮していない

### 実装時の注意点

- ✅ セッションコールバック（`auth.ts`）で正しくプランを同期
- ✅ サイドバー・レイアウトでサービス別プランと統一プランの両方を考慮
- ✅ APIエンドポイントでDBから再取得して確認
- ✅ Complete Pack対象サービスは統一プランを優先
- ✅ フォールバック処理を必ず実装（サービス別プランがない場合）

---

## 📋 新サービス開発 完全チェックリスト

新サービスを開発する際に、**必ずこのチェックリストを確認**して、漏れやミスがないようにしてください。

**使い方:**
1. 新サービス開発開始時に、このチェックリストをコピー
2. 各項目を順番に実装・確認
3. チェックボックスに✓を入れて進捗を管理
4. 全て完了してからデプロイ

---

### 📌 Phase 1: サービス定義・基本設定

#### 1.0 プラン設計（最初に行う）

**重要**: プラン設計は**サービス実装の最初**に行います。プランごとの権限・機能制限を明確にしてから実装を開始してください。

**プラン体系:**

| プラン | 説明 | 認証状態 |
|--------|------|----------|
| **GUEST** | ゲストユーザー（ログインしていない） | 未ログイン |
| **FREE** | 無料プラン（ログイン済み） | ログイン済み |
| **PRO** | プロプラン（有料） | ログイン済み + サブスクリプション |
| **ENTERPRISE** | エンタープライズプラン（有料） | ログイン済み + サブスクリプション |

**プラン設計のチェックリスト:**

- [ ] **プランごとの機能制限を設計**
  - [ ] GUEST: どの機能を制限するか
  - [ ] FREE: どの機能を制限するか、使用制限は何回か
  - [ ] PRO: どの機能を解放するか、使用制限は何回か
  - [ ] ENTERPRISE: すべての機能を解放、使用制限は無制限か

- [ ] **プランごとの使用制限を設計**
  - [ ] 1日の使用回数制限（dailyLimit）
  - [ ] 1ヶ月の使用回数制限（必要に応じて）
  - [ ] ファイルサイズ制限（アップロード機能がある場合）
  - [ ] 生成文字数・画像数などの制限

- [ ] **プランごとの機能アクセス権限を設計**
  - [ ] どの機能がどのプランで利用可能か
  - [ ] どの機能がどのプランで制限されるか
  - [ ] プレミアム機能の定義

- [ ] **プラン設計をドキュメント化**
  - [ ] プラン設計を `services.ts` の `pricing` フィールドに反映
  - [ ] プラン設計を開発ドキュメントに記録（必要に応じて）

**プラン設計例:**

```typescript
// services.ts での定義例
pricing: {
  free: { 
    name: '無料プラン', 
    limit: '1日3回まで', 
    dailyLimit: 3, 
    price: 0 
  },
  pro: { 
    name: 'プロプラン', 
    limit: '1日100回まで', 
    dailyLimit: 100, 
    price: 4980 
  },
}

// プランごとの機能制限の設計例
// GUEST: 基本的な機能のみ、使用制限1回
// FREE: すべての機能、使用制限3回/日
// PRO: すべての機能、使用制限100回/日
// ENTERPRISE: すべての機能、使用制限無制限
```

---

#### 1.1 サービス定義（`src/lib/services.ts`）

- [ ] `SERVICES` 配列にサービスを追加
- [ ] **プラン設計が完了している（上記の1.0を参照）**
- [ ] 必須フィールドが全て設定されている：
  - [ ] `id`: サービスID（英数字、ハイフン使用可）
  - [ ] `name`: サービス名（例: 'ドヤ○○AI'）
  - [ ] `shortName`: 短縮名（サイドバー表示用）
  - [ ] `description`: 説明文
  - [ ] `icon`: アイコン（絵文字）
  - [ ] `color`: カラー（Tailwindカラー名）
  - [ ] `gradient`: グラデーション（例: 'from-blue-500 to-cyan-500'）
  - [ ] `href`: メインページのURL
  - [ ] `dashboardHref`: ダッシュボードのURL
  - [ ] `pricingHref`: 料金ページのURL（必要に応じて）
  - [ ] `guideHref`: ガイドページのURL（必要に応じて）
  - [ ] `features`: 機能一覧（配列）
  - [ ] `pricing`: 料金設定（free/pro の dailyLimit, price を設定）**← プラン設計に基づく**
  - [ ] `status`: 'active' | 'beta' | 'coming_soon' | 'stopped'
  - [ ] `badge`: バッジ表示（ベータ版の場合: 'ベータ版'、停止中の場合は必要に応じて設定）
  - [ ] `category`: 'text' | 'image' | 'video' | 'other'
  - [ ] `order`: 表示順序（数値）
  - [ ] `requiresAuth`: 認証必須かどうか（通常は false）
  - [ ] `isNew`: 新サービスマーク（必要に応じて）
- [ ] サービスIDが他のサービスと重複していない
- [ ] プランの dailyLimit が適切に設定されている（FREE/PRO）

**参考実装:**
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
  features: ['機能1', '機能2', '機能3'],
  pricing: {
    free: { name: '無料プラン', limit: '1日3回まで', dailyLimit: 3, price: 0 },
    pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
  },
  status: 'active', // または 'beta'
  badge: status === 'beta' ? 'ベータ版' : undefined,
  category: 'text',
  order: 10,
  requiresAuth: false,
}
```

---

#### 1.2 ベータ版サービス対応

サービスがベータ版の場合：

- [ ] `status: 'beta'` を設定
- [ ] `badge: 'ベータ版'` を設定
- [ ] サービス自身のサイドバーにのみ表示（他サービスのサイドバーには表示しない）
- [ ] ベータ版バッジが表示されることを確認
- [ ] 他サービスの ToolSwitcherMenu に表示されないことを確認

**注意:** ベータ版サービスは、`ToolSwitcherMenu.tsx` の `TOOLS` 配列には追加しない。

---

### 📌 Phase 2: ナビゲーション・UI統合

#### 2.1 ToolSwitcherMenu（アクティブサービスのみ）

サービスが `status: 'active'` の場合：

- [ ] `src/components/ToolSwitcherMenu.tsx` の `TOOLS` 配列に追加
- [ ] 必須フィールドが設定されている：
  - [ ] `id`: サービスID（ToolId型に追加が必要な場合）
  - [ ] `href`: リンク先URL
  - [ ] `title`: サービス名
  - [ ] `description`: 説明文
  - [ ] `icon`: lucide-react のアイコンコンポーネント
  - [ ] `iconBgClassName`: アイコンの背景グラデーション
- [ ] ベータ版サービスは追加しない（自身のサイドバーでのみ表示）
- [ ] アイコンとグラデーションがサービス定義と一致している

**参考実装:**
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

---

#### 2.2 サイドバー実装

- [ ] サービス専用サイドバーコンポーネントを作成（例: `MyServiceSidebar.tsx`）
- [ ] サイドバーの必須要素が実装されている：
  - [ ] ロゴ＋サービス名（上部）
  - [ ] ナビゲーションリンク（メイン）
  - [ ] 1時間生成し放題バナー（キャンペーン中のみ、必要に応じて）
  - [ ] プラン案内バナー（通常時）
  - [ ] ToolSwitcherMenu（他ツール切替）
  - [ ] お問い合わせリンク
  - [ ] ユーザープロフィール＋ログアウト（下部）
  - [ ] 折りたたみボタン（デスクトップ）
- [ ] **プラン判定ロジックが正しく実装されている**（権限のずれを防ぐ）：
  - [ ] サービス別プランと統一プランの両方を考慮
  - [ ] Complete Packの統一プランを優先（必要に応じて）
  - [ ] フォールバック処理が実装されている
- [ ] 既存のサイドバーパターンに従っている（`DashboardSidebar.tsx` や `InterviewSidebar.tsx` を参考）
- [ ] **レスポンシブデザインが実装されている**：
  - [ ] モバイル対応（オーバーレイ表示、`md:hidden`）
  - [ ] デスクトップ対応（固定表示、`hidden md:block`）
  - [ ] モバイルオーバーレイのクローズボタンが実装されている
- [ ] LocalStorage で折りたたみ状態を保存
- [ ] アニメーションが実装されている（Framer Motion）

**参考実装:**
- `src/components/DashboardSidebar.tsx` - バナーサービスのサイドバー
- `src/components/InterviewSidebar.tsx` - インタビューサービスのサイドバー（最新実装例）

---

#### 2.3 レイアウト実装

- [ ] サービス専用レイアウトコンポーネントを作成（例: `MyServiceAppLayout.tsx`）
- [ ] レイアウトの必須要素が実装されている：
  - [ ] サイドバー（デスクトップ、`hidden md:block`）
  - [ ] モバイルオーバーレイ（モバイル、`md:hidden`）
  - [ ] ヘッダー（サービス名、プラン表示）
  - [ ] メインコンテンツエリア
  - [ ] **プラン判定ロジック（サービス専用プランまたはグローバルプラン）**が正しく実装されている
- [ ] **レスポンシブデザインが完全に実装されている**：
  - [ ] サイドバー: デスクトップ固定（`hidden md:block`）、モバイルオーバーレイ（`md:hidden`）
  - [ ] ヘッダー: モバイルメニューボタン（`md:hidden`）、プラン表示のレスポンシブ対応（`hidden sm:block` など）
  - [ ] メインコンテンツ: パディングのレスポンシブ対応（`p-4 sm:p-6 md:p-8`）
  - [ ] サイドバー幅の考慮: メインコンテンツのマージン（`md:pl-[240px]`）
  - [ ] モバイルオーバーレイの背景オーバーレイとアニメーション
- [ ] 既存のレイアウトパターンに従っている（`InterviewAppLayout.tsx` を参考）
- [ ] プラン表示が正しく動作している（権限のずれがない）

**参考実装:**
- `src/components/InterviewAppLayout.tsx` - より実践的な実装例
- `src/components/SeoAppLayout.tsx` - SEOサービス用レイアウト

---

#### 2.4 ページ実装

- [ ] メインページ（`src/app/myservice/page.tsx`）を作成
- [ ] ダッシュボードページ（必要に応じて）を作成
- [ ] 料金ページ（`src/app/myservice/pricing/page.tsx`）を作成
- [ ] レイアウトコンポーネントを使用している
- [ ] サービス定義の `href`, `dashboardHref`, `pricingHref` と一致している

---

### 📌 Phase 3: プラン管理・課金連携

#### 3.0 プラン設計（最初に行う）

**重要**: プラン管理実装の前に、**プラン設計を完了**してください。

- [ ] **プランごとの機能制限を設計**
  - [ ] GUEST: どの機能を制限するか（例: 基本機能のみ、1回/日の制限）
  - [ ] FREE: どの機能を制限するか、使用制限は何回か（例: すべての基本機能、3回/日）
  - [ ] PRO: どの機能を解放するか、使用制限は何回か（例: すべての機能、100回/日）
  - [ ] ENTERPRISE: すべての機能を解放、使用制限は無制限か

- [ ] **プランごとの使用制限を設計**
  - [ ] 1日の使用回数制限（dailyLimit）
    - [ ] GUEST: 1回/日（例）
    - [ ] FREE: 3-10回/日（サービス定義の `pricing.free.dailyLimit` に反映）
    - [ ] PRO: 50-100回/日（サービス定義の `pricing.pro.dailyLimit` に反映）
    - [ ] ENTERPRISE: 無制限または大幅に緩和
  - [ ] ファイルサイズ制限（アップロード機能がある場合）
  - [ ] 生成文字数・画像数などの制限

- [ ] **プランごとの機能アクセス権限を設計**
  - [ ] どの機能がどのプランで利用可能か
  - [ ] どの機能がどのプランで制限されるか
  - [ ] プレミアム機能の定義

- [ ] **プラン設計を `services.ts` に反映**
  - [ ] `pricing.free.dailyLimit` を設定
  - [ ] `pricing.pro.dailyLimit` を設定
  - [ ] プラン設計がサービス定義と一致しているか確認

**参考:**
- Phase 1.0「プラン設計」も参照
- [プラン管理システム](#1-プラン管理システム) の「プラン体系」を参照

---

#### 3.1 Stripe設定

- [ ] `src/lib/stripe.ts` の `STRIPE_PRICE_IDS` に価格IDを追加
- [ ] 月額・年額の両方の価格IDを設定（必要に応じて）
- [ ] `getPlanIdFromStripePriceId()` 関数にマッピングを追加
- [ ] 環境変数に価格IDを設定（Vercelダッシュボード）
- [ ] Stripeダッシュボードで価格を作成
- [ ] テスト環境と本番環境で価格IDを分ける

**参考実装:**
```typescript
// src/lib/stripe.ts
myservice: {
  pro: {
    monthly: process.env.STRIPE_PRICE_MYSERVICE_PRO_MONTHLY,
    yearly: process.env.STRIPE_PRICE_MYSERVICE_PRO_YEARLY,
  },
}
```

---

#### 3.2 Webhook処理

- [ ] `src/app/api/stripe/webhook/route.ts` でサービスIDを処理できることを確認
- [ ] `updateUserSubscription()` 関数がサービス別プランを正しく更新することを確認
- [ ] Complete Pack の場合は `syncUserPlanAcrossServices()` を使用
- [ ] プラン更新が正しく反映されることを確認

---

#### 3.3 プラン管理実装

- [ ] APIエンドポイントで `UserServiceSubscription` を使用
- [ ] 使用量チェックを実装
- [ ] 日次リセット処理を実装
- [ ] プラン判定ロジックを実装（サービス専用プラン or グローバルプラン）
- [ ] 使用制限（dailyLimit）を実装
- [ ] エラーハンドリング（429エラー）を実装

**実装パターン:**
```typescript
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId: 'myservice' } },
})

const plan = subscription?.plan || 'FREE'
const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0

// 日次リセットチェック
const now = new Date()
const isNewDay = now.toDateString() !== subscription?.lastUsageReset.toDateString()
if (isNewDay) {
  await prisma.userServiceSubscription.update({
    where: { id: subscription.id },
    data: { dailyUsage: 0, lastUsageReset: now },
  })
}

// 使用量チェック
if (subscription.dailyUsage >= dailyLimit) {
  return NextResponse.json({ error: '使用上限に達しました' }, { status: 429 })
}
```

---

#### 3.4 決済UI

- [ ] CheckoutButtonコンポーネントを配置（料金ページなど）
- [ ] `planId` が正しく設定されている（例: 'myservice-pro'）
- [ ] `billingPeriod` が設定されている（'monthly' | 'yearly'）
- [ ] カスタマーポータルへのリンクを配置（必要に応じて）
- [ ] 解約・再開機能を実装（必要に応じて）
- [ ] プラン表示が正しく動作している

**参考実装:**
```typescript
<CheckoutButton planId="myservice-pro" billingPeriod="monthly">
  PROを始める
</CheckoutButton>
```

---

### 📌 Phase 4: API実装

#### 4.1 APIエンドポイント

- [ ] サービス専用のAPIディレクトリを作成（`src/app/api/myservice/`）
- [ ] 認証チェックを実装
- [ ] ゲストユーザー対応（必要に応じて）
- [ ] 使用量チェックを実装
- [ ] エラーハンドリングを実装
- [ ] 適切なHTTPステータスコードを返す

**実装パターン:**
```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 使用量チェック
    // ...

    // 3. 処理実行
    // ...

    // 4. 使用量更新
    // ...

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[MYSERVICE] Error:', error)
    return NextResponse.json({ error: '処理に失敗しました' }, { status: 500 })
  }
}
```

---

#### 4.2 ファイルアップロード（必要に応じて）

- [ ] ファイルサイズチェックを実装
- [ ] 小さいファイル（<4.5MB）は Vercel Blob Storage を使用
- [ ] 大きいファイル（>=4.5MB）は Google Cloud Storage を使用
- [ ] チャンクアップロードを実装（必要に応じて）
- [ ] ファイルタイプのバリデーション

---

### 📌 Phase 5: デザイン統一

#### 5.1 デザインシステム準拠

- [ ] CSS変数を使用（`var(--color-primary)` など）
- [ ] Tailwindテーマを使用
- [ ] タイポグラフィが統一されている
- [ ] カラーパレットが統一されている
- [ ] スペーシングが統一されている
- [ ] ボタンスタイルが統一されている

**参考:**
- `docs/reference/design-system.md` - デザインシステム詳細

---

#### 5.2 アニメーション

- [ ] Framer Motion を使用
- [ ] Party Mode 対応（必要に応じて）
- [ ] **生成完了時の派手なお祝いアニメーションを実装**
- [ ] 既存のアニメーションパターンに従っている
- [ ] パフォーマンスを考慮した実装

**参考:**
- `docs/reference/animation-spec.md` - アニメーション仕様
- [共通で使える開発項目](#共通で使える開発項目) の「生成完了時の派手なお祝いアニメーション」を参照

---

#### 5.3 レスポンシブデザイン

- [ ] モバイル対応（< 768px）
- [ ] タブレット対応（768px - 1024px）
- [ ] デスクトップ対応（> 1024px）
- [ ] 各ブレークポイントで表示を確認

---

### 📌 Phase 6: サービス分離・品質保証

#### 6.1 サービス分離ルール

- [ ] 他サービスのAPIエンドポイントを変更していない
- [ ] 他サービスのDBテーブルを変更していない
- [ ] 他サービスのコンポーネントを変更していない
- [ ] 共通コンポーネントへの破壊的変更をしていない
- [ ] 自サービス専用のディレクトリ・ファイルを使用している

**参考:**
- `docs/reference/service-isolation.md` - サービス分離ルール詳細

---

#### 6.2 エラーハンドリング

- [ ] try-catch でエラーを捕捉
- [ ] 適切なHTTPステータスコードを返す
- [ ] **エラーメッセージがユーザーフレンドリーで、原因がわかりやすい**
- [ ] **開発者が修正しやすいように、ログに詳細情報を出力**
- [ ] ログ出力が適切（`[SERVICE_NAME]` プレフィックス付き）
- [ ] Prismaエラーの適切な処理

**詳細**: [エラーメッセージの設計ガイドライン](#エラーメッセージの設計ガイドライン) を参照

---

#### 6.3 パフォーマンス

- [ ] データベースクエリが最適化されている（必要なフィールドのみ取得）
- [ ] キャッシュを活用（必要に応じて）
- [ ] バッチ処理を使用（必要に応じて）
- [ ] ファイルサイズを考慮（アップロードの場合）

---

### 📌 Phase 7: 環境変数・設定

#### 7.1 環境変数

- [ ] 必要な環境変数を特定
- [ ] 環境変数を `.env.example` に追加（ローカル開発用）
- [ ] Vercelダッシュボードに環境変数を設定
- [ ] 環境変数の命名規則が統一されている
- [ ] 機密情報がハードコードされていない

**主要な環境変数:**
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- サービス専用の環境変数（APIキーなど）

---

#### 7.2 型定義

- [ ] TypeScriptの型定義が適切
- [ ] 型エラーがない
- [ ] `any` 型の使用を最小限に

---

## ⚠️ 機能実装後の徹底的なデバッグ・確認・修正（必須）

**重要**: 機能を実装したら、**必ず徹底的にデバッグ確認して修正する**ことが必須です。

### デバッグ・確認の原則

1. **実装したら即座にテスト**: 機能を実装したら、すぐに動作確認を行う
2. **全てのパターンをテスト**: 正常系だけでなく、異常系・エッジケースも確認
3. **複数の環境で確認**: ローカル環境、本番環境（プレビュー）で確認
4. **複数のデバイスで確認**: PC、タブレット、モバイルで表示・動作を確認
5. **エラーを放置しない**: エラーや警告は必ず修正する

### デバッグ・確認のチェックリスト

#### 1. 基本動作確認

- [ ] 実装した機能が正常に動作するか
- [ ] エラーやコンソール警告がないか（ブラウザの開発者ツールで確認）
- [ ] TypeScriptエラーがないか（`pnpm build` で確認）
- [ ] Lintエラーがないか（`pnpm lint` で確認）
- [ ] 型エラーがないか

#### 2. エラーケースの確認

- [ ] ネットワークエラー時の処理が適切か
- [ ] APIエラー時の処理が適切か（404、500、429など）
- [ ] バリデーションエラーの表示が適切か
- [ ] ログインしていないユーザーの処理が適切か
- [ ] プラン制限に達した時の処理が適切か

#### 3. UI/UX確認

- [ ] レスポンシブデザインが適切か（PC、タブレット、モバイル）
- [ ] ローディング状態の表示が適切か
- [ ] エラーメッセージがユーザーフレンドリーか
- [ ] フォームのバリデーションが適切か
- [ ] ボタンの無効化・有効化が適切か
- [ ] アニメーションが適切に動作するか

#### 4. パフォーマンス確認

- [ ] ページの読み込み速度が適切か
- [ ] APIリクエストが適切な頻度か（過度なポーリングがないか）
- [ ] メモリリークがないか（長時間使用しても問題ないか）
- [ ] 大きなデータを扱う場合のパフォーマンスが適切か

#### 5. セキュリティ確認

- [ ] 認証チェックが適切か
- [ ] 権限チェックが適切か（他のユーザーのデータにアクセスできないか）
- [ ] 入力値のサニタイズが適切か（XSS対策）
- [ ] 機密情報がクライアント側に露出していないか

#### 6. データ整合性確認

- [ ] データベースへの保存が適切か
- [ ] データの更新が適切か
- [ ] トランザクションが適切か（複数の操作が途中で失敗した場合）
- [ ] 日次リセットなどの時間ベースの処理が適切か

#### 7. ブラウザ・デバイス確認

- [ ] Chrome で正常に動作するか
- [ ] Safari で正常に動作するか
- [ ] Firefox で正常に動作するか（必要に応じて）
- [ ] モバイルブラウザ（iOS Safari、Android Chrome）で正常に動作するか
- [ ] タブレットで正常に表示・動作するか

#### 8. 統合確認

- [ ] 他のサービスに影響を与えていないか
- [ ] 共通コンポーネントの動作に問題がないか
- [ ] サイドバー・ナビゲーションが正常に動作するか
- [ ] プラン管理が正常に動作するか

### デバッグ手順

#### Step 1: ローカル環境での確認

```bash
# 1. ビルドエラーの確認
pnpm build

# 2. Lintエラーの確認
pnpm lint

# 3. 型チェックの確認
pnpm type-check  # または tsc --noEmit

# 4. ローカルサーバーで動作確認
pnpm dev
```

**確認項目:**
- ブラウザの開発者ツール（Console、Network、Application）を開く
- エラーや警告がないか確認
- ネットワークリクエストが適切に送信されているか確認
- ストレージ（LocalStorage、SessionStorage）の使用が適切か確認

#### Step 2: ブラウザ開発者ツールでの確認

**Consoleタブ:**
- エラー（赤色）がないか確認
- 警告（黄色）がないか確認
- 想定外のログがないか確認

**Networkタブ:**
- APIリクエストが適切に送信されているか確認
- レスポンスステータスコードが適切か確認（200、201、400、401、403、404、429、500など）
- レスポンス時間が適切か確認
- リクエストの重複がないか確認

**Applicationタブ:**
- LocalStorage、SessionStorageの使用が適切か確認
- クッキーの使用が適切か確認

**Elementsタブ:**
- HTMLの構造が適切か確認
- CSSが適切に適用されているか確認
- レスポンシブデザインが適切か確認（デバイスツールバーで確認）

#### Step 3: エラーハンドリングの確認

**以下のシナリオをテスト:**

1. **ネットワークエラー**
   - オフライン状態にする
   - ネットワーク速度を制限する（Chrome DevTools の Network タブで Throttling を設定）

2. **APIエラー**
   - サーバーを停止する
   - 不正なリクエストを送信する
   - 認証エラー（401）を発生させる
   - 権限エラー（403）を発生させる
   - リソースが見つからないエラー（404）を発生させる
   - レート制限エラー（429）を発生させる
   - サーバーエラー（500）を発生させる

3. **バリデーションエラー**
   - 空の入力値を送信する
   - 不正な形式の入力値を送信する
   - 制限を超えた値を送信する

4. **状態エラー**
   - ログインしていない状態でアクセスする
   - プラン制限に達した状態でアクセスする
   - データが存在しない状態でアクセスする

#### Step 4: レスポンシブデザインの確認

**Chrome DevTools のデバイスツールバーで確認:**

- [ ] モバイル（375px、390px、414px）
- [ ] タブレット（768px、1024px）
- [ ] デスクトップ（1280px、1920px）

**確認項目:**
- レイアウトが崩れていないか
- テキストが適切に折り返されているか
- ボタンやリンクがタップしやすいサイズか
- サイドバーが適切に表示・非表示されるか
- モーダルやポップアップが適切に表示されるか

#### Step 5: パフォーマンス確認

**Chrome DevTools の Performance タブ:**

- [ ] ページの読み込み時間が適切か
- [ ] JavaScriptの実行時間が適切か
- [ ] レンダリング時間が適切か
- [ ] メモリ使用量が適切か

**Network タブ:**

- [ ] リクエストの数が適切か（過度に多い場合は最適化を検討）
- [ ] リクエストのサイズが適切か
- [ ] キャッシュが適切に使用されているか

#### Step 6: セキュリティ確認

- [ ] 認証チェックが全ての保護されたエンドポイントで実装されているか
- [ ] 権限チェックが適切か（他のユーザーのデータにアクセスできないか）
- [ ] 入力値のサニタイズが適切か（XSS対策）
- [ ] SQLインジェクション対策が適切か（Prismaを使用している場合は自動で保護されるが、確認）
- [ ] 機密情報（APIキー、トークンなど）がクライアント側に露出していないか

### 修正の原則

1. **エラーは即座に修正**: エラーや警告は放置せず、即座に修正する
2. **根本原因を修正**: 症状だけでなく、根本原因を修正する
3. **再現手順を記録**: バグを見つけたら、再現手順を記録する
4. **修正後は再テスト**: 修正したら、必ず再テストを行う
5. **関連機能も確認**: 修正が他の機能に影響を与えていないか確認する

### よくあるデバッグ漏れ

- ❌ **ミス**: 正常系だけをテストして、異常系をテストしない
- ✅ **正解**: 正常系・異常系・エッジケースを全てテストする

- ❌ **ミス**: ローカル環境だけでテストして、本番環境（プレビュー）でテストしない
- ✅ **正解**: ローカル環境と本番環境（プレビュー）の両方でテストする

- ❌ **ミス**: PCだけでテストして、モバイルでテストしない
- ✅ **正解**: PC、タブレット、モバイルの全てでテストする

- ❌ **ミス**: エラーや警告を無視して、デプロイする
- ✅ **正解**: エラーや警告は必ず修正してからデプロイする

- ❌ **ミス**: ビルドエラーがないから大丈夫だと思って、動作確認をしない
- ✅ **正解**: ビルドエラーがなくても、必ず動作確認を行う

- ❌ **ミス**: 自分のブラウザ（Chrome）だけでテストする
- ✅ **正解**: 複数のブラウザ（Chrome、Safari、Firefox）でテストする

### デバッグチェックリスト（実装時）

機能を実装したら、以下のチェックリストを**必ず確認**してください：

- [ ] ビルドエラーがない（`pnpm build` が成功する）
- [ ] TypeScriptエラーがない
- [ ] Lintエラーがない（`pnpm lint` が成功する）
- [ ] ブラウザのコンソールにエラーや警告がない
- [ ] 実装した機能が正常に動作する
- [ ] エラーケースの処理が適切か（ネットワークエラー、APIエラーなど）
- [ ] レスポンシブデザインが適切か（PC、タブレット、モバイル）
- [ ] ローディング状態の表示が適切か
- [ ] エラーメッセージがユーザーフレンドリーか
- [ ] 認証チェックが適切か
- [ ] 権限チェックが適切か
- [ ] パフォーマンスが適切か（過度なリクエストがないか）
- [ ] 他のサービスに影響を与えていないか
- [ ] 複数のブラウザで動作確認した（Chrome、Safari）

**全ての項目にチェックを入れてから、コミット・デプロイしてください。**

---

### 📌 Phase 8: テスト・デプロイ前確認

#### 8.1 ローカルテスト

- [ ] ローカル環境で動作確認
- [ ] 認証が動作する
- [ ] プラン管理が動作する
- [ ] 決済フローが動作する（テストモード）
- [ ] APIエンドポイントが動作する
- [ ] エラーハンドリングが動作する

---

#### 8.2 ビルド確認

- [ ] `npm run build` が成功する
- [ ] TypeScriptエラーがない
- [ ] Lintエラーがない（`npm run lint`）
- [ ] 型チェックが通る

---

#### 8.3 デプロイ前確認

- [ ] 環境変数が全て設定されている
- [ ] Stripeの価格IDが設定されている
- [ ] ベータ版サービスの場合は表示ルールを確認
- [ ] サービス分離ルールを遵守している
- [ ] チェックリストの全項目が完了している

---

### 📌 Phase 9: デプロイ後確認

#### 9.1 基本動作確認

- [ ] サービスページが正常に表示される
- [ ] 認証が動作する
- [ ] サイドバーが正常に表示される
- [ ] ナビゲーションが動作する

---

#### 9.2 プラン・決済確認

- [ ] プラン表示が正しく動作する
- [ ] CheckoutButtonが動作する
- [ ] Stripe決済ページに遷移できる
- [ ] 決済後にプランが反映される（Webhook確認）
- [ ] 使用量チェックが動作する
- [ ] 使用上限エラーが正しく表示される

---

#### 9.3 統合確認

- [ ] ToolSwitcherMenuに表示される（アクティブサービスの場合）
- [ ] 他サービスのサイドバーからアクセスできる（アクティブサービスの場合）
- [ ] ベータ版サービスの場合は、他サービスのサイドバーに表示されない
- [ ] サービス定義が正しく反映されている

---

### 📌 Phase 10: ドキュメント・メンテナンス

#### 10.1 ドキュメント

- [ ] READMEにサービス情報を追加（必要に応じて）
- [ ] APIドキュメントを追加（必要に応じて）
- [ ] 変更履歴を記録

---

#### 10.2 メンテナンス

- [ ] エラーログを確認
- [ ] パフォーマンスを監視
- [ ] ユーザーフィードバックを収集

---

## ⚠️ よくあるミス・注意点

### プラン管理・権限

- ❌ **ミス**: `User.plan` を直接更新する（サービス別プランは `UserServiceSubscription` を使用）
- ✅ **正解**: `UserServiceSubscription` でプラン管理、Complete Pack の場合は `syncUserPlanAcrossServices` を使用

- ❌ **ミス**: 日次リセット処理を実装していない
- ✅ **正解**: `lastUsageReset` をチェックして日次リセット処理を実装

- ❌ **ミス**: Stripe価格IDを `stripe.ts` に追加していない
- ✅ **正解**: `STRIPE_PRICE_IDS` に追加し、`getPlanIdFromStripePriceId` にもマッピングを追加

- ❌ **ミス**: プラン判定ロジックが不適切（サービス別プランと統一プランを考慮していない）
- ✅ **正解**: サービス別プランと統一プランの両方を考慮し、優先順位を明確にする

**正しいプラン判定パターン:**
```typescript
// サイドバー・レイアウトでのプラン判定
const servicePlan = String((session?.user as any)?.myServicePlan || '').toUpperCase()
const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
const effectivePlan = servicePlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')

// APIエンドポイントでのプラン判定
const subscription = await prisma.userServiceSubscription.findUnique({
  where: { userId_serviceId: { userId, serviceId: 'myservice' } },
})
const plan = subscription?.plan || userPlan || 'FREE'
```

- ❌ **ミス**: セッションとDBのプラン情報が不一致（権限のずれ）
- ✅ **正解**: セッションコールバック（`auth.ts`）で正しくプランを同期、APIエンドポイントでもDBから再取得

- ❌ **ミス**: Complete Packの統一プランを考慮していない
- ✅ **正解**: Complete Pack対象サービス（`banner`, `writing`, `persona`）は統一プランを優先

### ベータ版サービス

- ❌ **ミス**: ベータ版サービスを `ToolSwitcherMenu.tsx` の `TOOLS` に追加する
- ✅ **正解**: ベータ版サービスは自身のサイドバーのみに表示、`TOOLS` には追加しない

- ❌ **ミス**: ベータ版バッジを表示していない
- ✅ **正解**: `status: 'beta'`, `badge: 'ベータ版'` を設定

### デザイン統一・レスポンシブ

- ❌ **ミス**: カラーをハードコードする
- ✅ **正解**: CSS変数やTailwindテーマを使用

- ❌ **ミス**: 既存のコンポーネントを改変する
- ✅ **正解**: 新しいコンポーネントを作成する

- ❌ **ミス**: レスポンシブデザインを実装していない
- ✅ **正解**: モバイル・タブレット・デスクトップの全てのブレークポイントに対応

- ❌ **ミス**: サイドバーがモバイルで表示されない、またはデスクトップでオーバーレイになっている
- ✅ **正解**: デスクトップは固定表示（`hidden md:block`）、モバイルはオーバーレイ（`md:hidden`）

- ❌ **ミス**: メインコンテンツのマージンがレスポンシブでない（モバイルでもサイドバー幅分のマージンがある）
- ✅ **正解**: デスクトップのみマージンを適用（`md:pl-[240px]`）

- ❌ **ミス**: パディングが固定値（全画面サイズで同じ）
- ✅ **正解**: レスポンシブパディングを使用（`p-4 sm:p-6 md:p-8`）

### サービス分離

- ❌ **ミス**: 他サービスのAPIを変更する
- ✅ **正解**: 自サービス専用のAPIエンドポイントを作成

- ❌ **ミス**: 共通コンポーネントを破壊的に変更する
- ✅ **正解**: 新機能は後方互換性を保つ、または新しいコンポーネントを作成

### 環境変数

- ❌ **ミス**: 環境変数をハードコードする
- ✅ **正解**: 環境変数を使用し、`.env.example` に追加

- ❌ **ミス**: Vercelに環境変数を設定していない
- ✅ **正解**: デプロイ前にVercelダッシュボードで環境変数を設定

### デバッグ・確認

- ❌ **ミス**: 機能を実装したら、すぐにコミット・デプロイする
- ✅ **正解**: 機能を実装したら、必ず徹底的にデバッグ確認して修正する

- ❌ **ミス**: 正常系だけをテストして、異常系をテストしない
- ✅ **正解**: 正常系・異常系・エッジケースを全てテストする

- ❌ **ミス**: ローカル環境だけでテストして、本番環境（プレビュー）でテストしない
- ✅ **正解**: ローカル環境と本番環境（プレビュー）の両方でテストする

- ❌ **ミス**: PCだけでテストして、モバイルでテストしない
- ✅ **正解**: PC、タブレット、モバイルの全てでテストする

- ❌ **ミス**: エラーや警告を無視して、デプロイする
- ✅ **正解**: エラーや警告は必ず修正してからデプロイする

- ❌ **ミス**: ビルドエラーがないから大丈夫だと思って、動作確認をしない
- ✅ **正解**: ビルドエラーがなくても、必ず動作確認を行う

- ❌ **ミス**: 自分のブラウザ（Chrome）だけでテストする
- ✅ **正解**: 複数のブラウザ（Chrome、Safari、Firefox）でテストする

- ❌ **ミス**: コンソールのエラーや警告を無視する
- ✅ **正解**: ブラウザの開発者ツールでエラーや警告を確認し、全て修正する

**詳細**: [機能実装後の徹底的なデバッグ・確認・修正](#機能実装後の徹底的なデバッグ確認修正必須) を参照

---

## 📝 チェックリストの使い方

1. **開発開始時**: このチェックリストをコピーして、プロジェクト管理ツール（GitHub Issues、Notion等）に保存
2. **実装中**: 各項目を順番に実装し、チェックボックスに✓を入れる
3. **デプロイ前**: 全項目が完了していることを確認
4. **デプロイ後**: Phase 9の確認項目を実行

---

## 🔗 関連ドキュメント

- [新サービス追加手順](#新サービス追加手順) - 詳細な実装手順
- [プラン管理システム](#2-プラン管理システム) - プラン管理の詳細
- [サービス分離ルール](./service-isolation.md) - サービス分離の詳細
- [デザインシステム](./design-system.md) - デザインシステムの詳細
- [ベータ版サービス管理](./beta-services.md) - ベータ版サービスの詳細

---

## デプロイ手順

本番環境へのデプロイ手順です。

### ⚠️ 重要: Vercelへの反映について

**変更をVercelに反映するには、`doya-ai`ブランチ（またはリポジトリ）にプッシュする必要があります。**

- ❌ **間違い**: 他のブランチやリポジトリにプッシュしても、Vercelには反映されません
- ✅ **正解**: `doya-ai`ブランチ/リポジトリにプッシュすることで、Vercelが自動的にデプロイを開始します

### 前提条件

- Vercelアカウント
- Gitリポジトリ（GitHub推奨）
- Vercelプロジェクトとリモートリポジトリの接続
- **`doya-ai`ブランチ/リポジトリへのアクセス権限**

### デプロイ方法

#### 方法1: Git Push（推奨）

```bash
# 1. 変更をコミット
git add -A
git commit -m "feat: 新機能追加"

# 2. doya-aiブランチにプッシュ（重要！）
git push origin doya-ai
# または
git push origin main  # mainブランチがdoya-aiリポジトリと連携している場合
```

**重要**: `doya-ai`ブランチ/リポジトリにプッシュすることで、Vercelが自動的にデプロイを開始します。

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

**注意**: Subtree Pushの場合も、最終的には`doya-ai`リポジトリにプッシュされる必要があります。

### デプロイ確認

プッシュ後、以下を確認してください：

1. **GitHub/Gitリポジトリ**: `doya-ai`ブランチ/リポジトリに変更がプッシュされているか確認
2. **Vercelダッシュボード**: デプロイが開始されているか確認
   - [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
   - プロジェクトを選択
   - 「Deployments」タブでデプロイ状況を確認

### よくあるミス

- ❌ **ミス**: 変更をコミットしたが、`doya-ai`ブランチ/リポジトリにプッシュしていない
- ✅ **正解**: 必ず`doya-ai`ブランチ/リポジトリにプッシュする

- ❌ **ミス**: 他のブランチ（例: `develop`, `feature/xxx`）にプッシュして、Vercelに反映されないと思っている
- ✅ **正解**: Vercelに反映するには、`doya-ai`ブランチ/リポジトリにプッシュする必要がある

- ❌ **ミス**: ローカルで変更したが、コミット・プッシュを忘れている
- ✅ **正解**: 変更をコミットしてから、`doya-ai`ブランチ/リポジトリにプッシュする

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

### パターン2: ジョブ進行型サービス（リアルタイム生成表示）

**例**: SEO記事生成（分割生成パイプライン）

```typescript
// API: POST /api/myservice/jobs/[id]/advance
// 1. ジョブ状態を取得
// 2. 次のステップを実行
// 3. ジョブ状態を更新
// 4. 完了判定
```

#### AI生成中のリアルタイム表示パターン

ドヤライティングAIのように、**現在進行形感を出して、今作っている文章や調査内容を表示する**パターンです。

**必須要素:**

1. **進捗表示**
   - 進捗パーセンテージ（0-100%）
   - プログレスバー（アニメーション付き）
   - ステップ（工程）の表示
   - 経過時間の表示

2. **リアルタイム生成表示**
   - 「制作中（ライブ）」セクション
   - 現在生成中のセクション/項目の表示
   - タイピング演出（`useTypewriter`フックなど）
   - 完成済みコンテンツのプレビュー

3. **調査・処理内容の表示**
   - リサーチイベントのログ表示
   - 稼働ログ（activityLog）
   - 工程別の詳細メッセージ

**実装パターン:**

```typescript
// 1. ジョブ状態のポーリング
useEffect(() => {
  load({ showLoading: true })
  const t = setInterval(() => {
    const j = jobRef.current
    if (j && (j.status === 'done' || j.status === 'error' || j.status === 'cancelled')) return
    load({ showLoading: false })
  }, 4000) // 4秒ごとにポーリング
  return () => clearInterval(t)
}, [jobId, load])

// 2. タイピング演出フック
function useTypewriter(text: string, opts?: { cps?: number; maxChars?: number }) {
  const cps = Math.max(15, Math.min(90, Number(opts?.cps || 55))) // chars per second
  const maxChars = Math.max(240, Math.min(1400, Number(opts?.maxChars || 900)))
  const src = String(text || '').slice(0, maxChars)
  const [out, setOut] = useState('')
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!src) {
      setOut('')
      return
    }
    startRef.current = performance.now()
    setOut('')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startRef.current)
      const n = Math.min(src.length, Math.floor((elapsed / 1000) * cps))
      setOut(src.slice(0, Math.max(1, n)))
      if (n < src.length) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [src])

  return out
}

// 3. 進捗表示コンポーネント
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
  <div className="flex items-center justify-between mb-2">
    <span className="text-gray-500 text-sm font-black">現在の進捗</span>
    <span className="text-gray-900 font-black text-2xl tabular-nums">{job.progress}%</span>
  </div>
  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
    <motion.div
      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"
      initial={{ width: 0 }}
      animate={{ width: `${job.progress}%` }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
  </div>
</div>

// 4. リアルタイム生成表示セクション
<div className="bg-white rounded-[28px] border border-gray-100 shadow-xl">
  <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
    <p className="text-[10px] font-black text-gray-400 uppercase">制作中（ライブ）</p>
    <p className="text-sm sm:text-base font-black text-gray-900">
      {job.step === 'sections' ? '本文を執筆中' : '準備中'}
    </p>
  </div>
  
  {/* ライブ執筆表示 */}
  <div className="p-5 sm:p-6">
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      ライブ執筆
    </div>
    <h3 className="mt-3 text-xl sm:text-2xl font-black text-gray-900">
      {liveHeading || '本文を執筆中...'}
    </h3>
    
    {/* タイピング演出付きテキスト */}
    <div className="mt-5 p-4 bg-slate-50 rounded-2xl">
      <p className="text-sm text-gray-800 whitespace-pre-wrap">
        {liveTyped}
      </p>
    </div>
  </div>
</div>

// 5. セクション進捗表示
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {job.sections.map((s) => {
    const isGenerating = s.status === 'generating'
    const isComplete = s.status === 'reviewed' || s.status === 'generated'
    return (
      <div className={`p-4 rounded-2xl border ${
        isGenerating ? 'bg-blue-50 border-blue-100' :
        isComplete ? 'bg-emerald-50 border-emerald-100' :
        'bg-white border-gray-100'
      }`}>
        {isGenerating && (
          <motion.div
            className="mb-3 h-1.5 rounded-full bg-gradient-to-r from-blue-200 via-blue-500 to-indigo-200"
            animate={{ backgroundPositionX: ['0%', '100%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isGenerating ? 'bg-blue-100' : isComplete ? 'bg-emerald-100' : 'bg-gray-100'
          }`}>
            {isGenerating ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            ) : isComplete ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : (
              <span className="text-xs font-black text-gray-500">{s.index + 1}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 truncate">
              {s.headingPath || `セクション ${s.index + 1}`}
            </p>
            <p className="text-[10px] text-gray-500 mt-1 font-bold">
              {isGenerating ? '生成中' : isComplete ? '生成済み' : '未生成'}
            </p>
          </div>
        </div>
      </div>
    )
  })}
</div>

// 6. 稼働ログ（activityLog）の表示
const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([])

const pushLog = useCallback((item: Omit<ActivityLogItem, 'id'>) => {
  setActivityLog((prev) => {
    const next: ActivityLogItem[] = [
      ...prev,
      { ...item, id: `${item.at}_${Math.random().toString(16).slice(2)}` },
    ]
    // 最大200件（重くしない）
    if (next.length > 200) return next.slice(next.length - 200)
    return next
  })
}, [])

// ログ表示
<div className="space-y-2 max-h-96 overflow-y-auto">
  {activityLog.map((item) => (
    <div key={item.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
      <div className={`w-2 h-2 rounded-full mt-2 ${
        item.kind === 'error' ? 'bg-red-500' :
        item.kind === 'success' ? 'bg-emerald-500' :
        'bg-blue-500'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900">{item.title}</p>
        {item.detail && (
          <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
        )}
        <p className="text-[10px] text-gray-400 mt-1">
          {new Date(item.at).toLocaleTimeString()}
        </p>
      </div>
    </div>
  ))}
</div>
```

**参考実装:**
- `src/app/seo/jobs/[id]/page.tsx` - ドヤライティングAIのジョブ進捗ページ
- `src/app/seo/articles/[id]/page.tsx` - 記事ページ（生成中表示）

**UIデザインのポイント:**

- ✅ **現在進行形感を出す**: 「制作中（ライブ）」「生成中」などのラベル
- ✅ **リアルタイム更新**: ポーリングで定期的に状態を更新
- ✅ **タイピング演出**: `useTypewriter`フックでタイピング感を演出
- ✅ **進捗の可視化**: プログレスバー、セクション進捗、パーセンテージ
- ✅ **完成済みコンテンツのプレビュー**: 生成が完了した部分から見せていく
- ✅ **調査・処理内容の表示**: リサーチイベント、稼働ログで「何をしているか」を表示
- ✅ **アニメーション**: ローディングスピナー、パルス、グラデーションアニメーション

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

## エラーメッセージの設計ガイドライン

エラーが起きた際のメッセージは、**エラーの原因をわかりやすく、修正しやすいメッセージを出力する**ことが重要です。

### エラーメッセージの原則

1. **ユーザー向けメッセージ**: 技術的な詳細は省き、原因と対処法をわかりやすく伝える
2. **開発者向けログ**: 詳細な情報（スタックトレース、コンテキスト情報）を出力して、原因を特定しやすくする
3. **一貫性**: エラーメッセージの形式を統一する
4. **具体的な対処法**: エラーの原因と、ユーザーが取れる対処法を示す

### ユーザー向けエラーメッセージ

#### 良い例 ✅

**認証エラー:**
```typescript
{ error: 'ログインが必要です。ログインしてから再度お試しください。' }
```

**権限エラー:**
```typescript
{ error: 'この機能を利用するには、PROプランへのアップグレードが必要です。' }
```

**使用制限エラー:**
```typescript
{ error: '1日の使用上限に達しました。明日以降、またはPROプランにアップグレードしてご利用ください。', limit: 3, usage: 3 }
```

**バリデーションエラー:**
```typescript
{ error: '入力内容に問題があります。', details: { field: 'title', message: 'タイトルは1文字以上、100文字以内で入力してください。' } }
```

**ネットワークエラー:**
```typescript
{ error: 'ネットワークエラーが発生しました。インターネット接続を確認して、しばらく時間をおいて再度お試しください。' }
```

**サーバーエラー:**
```typescript
{ error: 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。' }
```

#### 悪い例 ❌

```typescript
// 技術的な詳細が含まれている
{ error: 'Prisma error: P2021 - Table does not exist' }

// 原因が不明確
{ error: 'エラーが発生しました' }

// 対処法が示されていない
{ error: '認証に失敗しました' }

// 開発者向けの情報が含まれている
{ error: 'TypeError: Cannot read property \'id\' of undefined' }
```

### 開発者向けログ

開発者向けのログには、**原因を特定しやすくするための詳細情報**を含めます。

#### 良い例 ✅

```typescript
try {
  // 処理
} catch (error: any) {
  // 開発者向けログ: 詳細な情報を出力
  console.error('[SERVICE_NAME] Error:', {
    message: error?.message,
    stack: error?.stack,
    code: error?.code,
    // エラー発生時のコンテキスト情報
    userId: userId || 'guest',
    serviceId: 'myservice',
    endpoint: '/api/myservice/generate',
    method: 'POST',
    // リクエストの詳細（機密情報は除く）
    requestBody: {
      // 機密情報は含めない
      title: body?.title,
      // パスワードやトークンなどは含めない
    },
    // 環境情報
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
  
  // ユーザー向けメッセージ
  return NextResponse.json(
    { error: '処理に失敗しました。しばらく時間をおいて再度お試しください。' },
    { status: 500 }
  )
}
```

#### ログの形式

**推奨形式:**
```typescript
console.error('[SERVICE_NAME] Error:', {
  // エラー情報
  message: string,
  stack?: string,
  code?: string,
  
  // コンテキスト情報
  userId?: string,
  serviceId: string,
  endpoint: string,
  method: string,
  
  // その他の関連情報
  [key: string]: any,
})
```

**プレフィックスの統一:**
- サービス名を `[SERVICE_NAME]` 形式で統一
- 例: `[BANNER]`, `[SEO]`, `[INTERVIEW]`, `[PERSONA]`

### エラータイプ別のメッセージ設計

#### 1. 認証エラー (401)

```typescript
// ユーザー向け
{ error: 'ログインが必要です。ログインしてから再度お試しください。' }

// 開発者向けログ
console.error('[SERVICE_NAME] Auth Error:', {
  message: 'Unauthorized',
  userId: userId || 'not-set',
  endpoint: '/api/myservice/generate',
})
```

#### 2. 権限エラー (403)

```typescript
// ユーザー向け
{ error: 'この機能を利用するには、PROプランへのアップグレードが必要です。', requiredPlan: 'PRO', currentPlan: 'FREE' }

// 開発者向けログ
console.error('[SERVICE_NAME] Permission Error:', {
  message: 'Insufficient permissions',
  userId,
  requiredPlan: 'PRO',
  currentPlan: subscription?.plan || 'FREE',
  endpoint: '/api/myservice/generate',
})
```

#### 3. 使用制限エラー (429)

```typescript
// ユーザー向け
{ error: '1日の使用上限に達しました。明日以降、またはPROプランにアップグレードしてご利用ください。', limit: 3, usage: 3, resetAt: '2024-01-02T00:00:00Z' }

// 開発者向けログ
console.error('[SERVICE_NAME] Rate Limit Error:', {
  message: 'Daily limit exceeded',
  userId,
  serviceId: 'myservice',
  limit: dailyLimit,
  usage: subscription.dailyUsage,
  resetAt: subscription.lastUsageReset,
})
```

#### 4. バリデーションエラー (400)

```typescript
// ユーザー向け
{ error: '入力内容に問題があります。', details: [
  { field: 'title', message: 'タイトルは1文字以上、100文字以内で入力してください。' },
  { field: 'description', message: '説明は1000文字以内で入力してください。' },
] }

// 開発者向けログ
console.error('[SERVICE_NAME] Validation Error:', {
  message: 'Invalid input',
  userId: userId || 'guest',
  errors: validationErrors,
  requestBody: body,
})
```

#### 5. リソース未找到エラー (404)

```typescript
// ユーザー向け
{ error: 'お探しのリソースが見つかりませんでした。' }

// 開発者向けログ
console.error('[SERVICE_NAME] Not Found Error:', {
  message: 'Resource not found',
  userId,
  resourceId: params.id,
  resourceType: 'article',
  endpoint: '/api/myservice/articles/[id]',
})
```

#### 6. サーバーエラー (500)

```typescript
// ユーザー向け
{ error: 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。' }

// 開発者向けログ
console.error('[SERVICE_NAME] Server Error:', {
  message: error?.message,
  stack: error?.stack,
  code: error?.code,
  userId,
  endpoint: '/api/myservice/generate',
  requestBody: body,
})
```

### Prismaエラーの処理

Prismaエラーは、ユーザー向けメッセージに変換します。

```typescript
try {
  // Prisma操作
} catch (error: any) {
  // 開発者向けログ
  console.error('[SERVICE_NAME] Prisma Error:', {
    code: error?.code,
    message: error?.message,
    meta: error?.meta,
    userId,
  })
  
  // Prismaエラーコードに応じてユーザー向けメッセージを返す
  if (error?.code === 'P2002') {
    // ユニーク制約違反
    return NextResponse.json(
      { error: 'このデータは既に登録されています。' },
      { status: 409 }
    )
  } else if (error?.code === 'P2025') {
    // レコードが見つからない
    return NextResponse.json(
      { error: 'お探しのデータが見つかりませんでした。' },
      { status: 404 }
    )
  } else if (error?.code === 'P2021') {
    // テーブルが存在しない
    return NextResponse.json(
      { error: 'データベースエラーが発生しました。しばらく時間をおいて再度お試しください。' },
      { status: 503 }
    )
  }
  
  // その他のPrismaエラー
  return NextResponse.json(
    { error: 'データベースエラーが発生しました。しばらく時間をおいて再度お試しください。' },
    { status: 500 }
  )
}
```

### エラーメッセージのチェックリスト

エラーメッセージを実装する際は、以下を確認してください：

- [ ] ユーザー向けメッセージが技術的な詳細を含んでいない
- [ ] ユーザー向けメッセージに原因がわかりやすく書かれている
- [ ] ユーザー向けメッセージに対処法が示されている
- [ ] 開発者向けログに詳細な情報が含まれている（スタックトレース、コンテキスト情報）
- [ ] 開発者向けログにプレフィックス `[SERVICE_NAME]` が付いている
- [ ] 機密情報（パスワード、トークンなど）がログに含まれていない
- [ ] HTTPステータスコードが適切か
- [ ] エラーメッセージの形式が統一されている

### 実装例

```typescript
// APIエンドポイントでのエラーハンドリング例
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ログインが必要です。ログインしてから再度お試しください。' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    // バリデーション
    if (!body.title || body.title.length > 100) {
      return NextResponse.json(
        { error: '入力内容に問題があります。', details: { field: 'title', message: 'タイトルは1文字以上、100文字以内で入力してください。' } },
        { status: 400 }
      )
    }
    
    // 使用量チェック
    const subscription = await prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'myservice' } },
    })
    
    const dailyLimit = subscription?.plan === 'PRO' ? 100 : 3
    if (subscription && subscription.dailyUsage >= dailyLimit) {
      const resetAt = new Date(subscription.lastUsageReset)
      resetAt.setDate(resetAt.getDate() + 1)
      resetAt.setHours(0, 0, 0, 0)
      
      return NextResponse.json(
        { 
          error: '1日の使用上限に達しました。明日以降、またはPROプランにアップグレードしてご利用ください。',
          limit: dailyLimit,
          usage: subscription.dailyUsage,
          resetAt: resetAt.toISOString(),
        },
        { status: 429 }
      )
    }
    
    // 処理実行
    // ...
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // 開発者向けログ: 詳細な情報を出力
    console.error('[MYSERVICE] Error:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      userId: session?.user?.id || 'not-set',
      serviceId: 'myservice',
      endpoint: '/api/myservice/generate',
      method: 'POST',
    })
    
    // ユーザー向けメッセージ: 原因がわかりやすく、対処法が示されている
    return NextResponse.json(
      { error: '処理に失敗しました。しばらく時間をおいて再度お試しください。' },
      { status: 500 }
    )
  }
}
```

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

