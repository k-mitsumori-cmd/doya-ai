# 🎯 実装パターン集

実際のコードベースから抽出した、よく使われる実装パターンです。

---

## 目次

1. [API実装パターン](#api実装パターン)
2. [ファイルアップロードパターン](#ファイルアップロードパターン)
3. [プラン管理パターン](#プラン管理パターン)
4. [エラーハンドリングパターン](#エラーハンドリングパターン)
5. [ストリーミング実装パターン](#ストリーミング実装パターン)
6. [ジョブ進行パターン](#ジョブ進行パターン)

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

