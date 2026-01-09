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

