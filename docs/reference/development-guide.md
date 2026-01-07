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

```typescript
// src/components/MyServiceAppLayout.tsx
'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MyServiceSidebar } from './MyServiceSidebar'
import { Menu, X } from 'lucide-react'

export function MyServiceAppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <MyServiceSidebar isCollapsed={isCollapsed} onToggle={setIsCollapsed} />
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[240px]'
      }`}>
        {/* Header + Content */}
        <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b">
          {/* ... */}
        </header>
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
```

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

```typescript
// src/app/api/myservice/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // 使用量チェック（サービス専用のロジック）
  // ...
  
  // AI生成処理
  // ...
  
  return NextResponse.json({ success: true, result: ... })
}
```

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

`src/lib/auth.ts` で一元管理。サービス専用のプランは `session.user` に含める。

```typescript
// セッションでプラン確認
const session = await getServerSession(authOptions)
const plan = (session?.user as any)?.myservicePlan || 'FREE'
```

### ⚠️ 注意

1. **NextAuthハンドラーを改変しない**（標準形式を維持）
2. **NEXTAUTH_URLは末尾スラッシュなし**

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

*最終更新: 2026年1月*

