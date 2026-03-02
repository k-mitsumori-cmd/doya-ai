# 07. 開発ガイド

## 新しいサービスを追加する手順

### 1. サービス登録
`src/lib/services.ts` の `SERVICES` 配列に追加:
```typescript
{
  id: 'new-service',
  name: 'サービス名',
  icon: '🆕',
  color: 'blue',
  gradient: 'from-blue-500 to-cyan-500',
  href: '/new-service',
  dashboardHref: '/new-service/dashboard',
  pricing: { free: { ... }, pro: { ... } },
  status: 'active',
  category: 'text',
  order: 10,
  requiresAuth: false,
}
```

### 2. 料金設定
`src/lib/pricing.ts` に `NEW_SERVICE_PRICING` を追加:
```typescript
export const NEW_SERVICE_PRICING: ServicePricing = {
  serviceId: 'new-service',
  serviceName: 'サービス名',
  guestLimit: 3,
  freeLimit: 5,
  proLimit: 30,
  historyDays: { free: 7, pro: -1 },
  plans: [ ... ],
}
```

### 3. セッションにプラン追加
`src/lib/auth.ts` の session callback に:
```typescript
;(session.user as any).newServicePlan = byService['new-service'] || 'FREE'
```

### 4. ページ作成
```
src/app/new-service/
  ├── layout.tsx    # レイアウト
  └── page.tsx      # メインページ
```

### 5. API作成
```
src/app/api/new-service/
  └── generate/route.ts
```

### 6. (任意) DBモデル追加
`prisma/schema.prisma` にモデル追加 → `npx prisma db push`

### 7. (任意) Stripe決済連携
1. `src/lib/stripe.ts` の `PlanId` 型に新プランを追加
2. 環境変数 `STRIPE_PRICE_{SERVICE}_{PLAN}_{MONTHLY|YEARLY}` を追加
3. `getPlanIdFromStripePriceId()` の変換マップに追加
4. `src/app/api/stripe/webhook/route.ts` でWebhook処理にサービスを追加
5. 決済成功後のリダイレクトURLを設定

### 8. (任意) 管理画面対応
管理画面 (`src/app/admin/`) でユーザーのプラン管理が必要な場合:
- `/api/admin/users` のPATCHエンドポイントでサービスプランを更新可能
- 管理者認証: `AdminUser` + bcrypt + Turnstile CAPTCHA

---

## API ルート作成の定型パターン

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    // 1. 認証
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    // 2. リクエストパース
    const body = await req.json()

    // 3. 利用制限チェック
    // ...

    // 4. ビジネスロジック
    // ...

    // 5. レスポンス
    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
```

## 動的パラメータの取得 (Next.js 15 互換)

```typescript
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = p.id
  // ...
}
```

## Gemini API 呼び出し

### パターン1: 直接 fetch（バナー画像生成等）

```typescript
const apiKey = process.env.GOOGLE_GENAI_API_KEY
const model = 'gemini-2.0-flash'
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',  // JSON出力を強制
    },
  }),
})

const data = await res.json()
const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
```

### パターン2: seo/lib/gemini.ts ラッパー

```typescript
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { geminiGenerateJson } from '@seo/lib/gemini'

// テキスト生成 — GenerateContentRequest 形式（parts 必須）
await geminiGenerateText({
  model: GEMINI_TEXT_MODEL_DEFAULT,
  parts: [{ text: prompt }],
})

// JSON生成 — { prompt } 形式（テキストのみ、parts不要）
await geminiGenerateJson<ResponseType>({
  prompt,
  model: GEMINI_TEXT_MODEL_DEFAULT,
})
```

> **⚠️ 注意**: `geminiGenerateText` と `geminiGenerateJson` は引数形式が異なる。
> - `geminiGenerateText`: `{ model, parts: [{ text }] }` (GenerateContentRequest)
> - `geminiGenerateJson`: `{ prompt, model? }` (文字列のpromptを直接渡す)

## SSE ストリーミング

```typescript
const encoder = new TextEncoder()
const stream = new ReadableStream({
  async start(controller) {
    // チャンクを送信
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
    // 完了
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller.close()
  },
})

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  },
})
```

## Supabase Storage 操作

```typescript
import { getSignedFileUrl, uploadFile } from '@/lib/interview/storage'

// 署名付きURL取得
const url = await getSignedFileUrl(storagePath, expiresIn)

// ファイルアップロード (サーバーサイド)
await uploadFile(bucket, path, buffer, contentType)
```

## DB テーブルプレフィックス

```prisma
// インタビュー系
model InterviewProject {
  // ...
  @@map("interview_project")
}

// 展開AI系
model TenkaiProject {
  // ...
  @@map("tenkai_project")
}
```

## ビルド・デプロイ

### ビルド確認
```bash
npx next build
```
注意: `typescript.ignoreBuildErrors: true` のため型エラーがあってもビルドは通る。

### Vercel 設定
- `maxDuration = 300` (Pro プラン: 5分)
- `runtime = 'nodejs'`
- `dynamic = 'force-dynamic'`

### デプロイ手順

> **重要**: Vercelは `09_Cursol/`（Gitルート）を直接ビルドする。
> `doya-ai/` サブディレクトリは使われない。subtree splitは不要。

#### 1. コミット
```bash
git add <修正ファイル>
git commit -m "feat: 変更内容"
```

#### 2. Vercelへプッシュ（ルート直接）
```bash
git push vercel HEAD:main
```

#### 3. デプロイ確認
- Vercelが自動ビルド開始（約2-3分）
- 本番 https://doya-ai.surisuta.jp で表示確認

> **⚠️ 旧手順（subtree split）は使わないこと**
> 以前の `git subtree split --prefix=doya-ai` 方式は廃止。
> `09_Cursol/src/` がそのまま本番コードとなる。

### 本番チェックリスト
- [ ] `https://doya-ai.surisuta.jp/` が200で表示される
- [ ] `/api/auth/session` が200を返す
- [ ] `/banner` が正常に表示される
- [ ] Googleログインが動作する
- [ ] バナー生成が動作する (無料枠で1枚テスト)
- [ ] Stripe決済ページに遷移できる
- [ ] 決済後にプランが反映される

---

## コーディング規約

| 項目 | ルール |
|------|-------|
| 言語 | TypeScript |
| UIテキスト | 日本語 |
| ブランドカラー | `#7f19e6` (紫) |
| アイコン | Material Symbols Outlined |
| CSS | Tailwind CSS (カスタムCSS禁止) |
| 状態管理 | Zustand (必要な場合のみ) |
| フォーム | Controlled components |
| API | `runtime='nodejs'`, `force-dynamic`, `maxDuration=300` |
| 認証 | `getServerSession(authOptions)` |
| DB | Prisma Client (`@/lib/prisma`) |
| エラー | `{ success: false, error: string }` 形式 |

## よく使う import パス

```typescript
// 認証
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// DB
import { prisma } from '@/lib/prisma'

// 料金
import { BANNER_PRICING, SEO_PRICING, ... } from '@/lib/pricing'
import { isWithinFreeHour, getTodayDateJST } from '@/lib/pricing'

// UI
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

// バリデーション
import { z } from 'zod'
```

---

## トラブルシューティング

| 問題 | 原因 | 対策 |
|------|------|------|
| HTTP 500 (全ページ) | NextAuthハンドラーの改変 | 標準形式に戻す |
| `redirect_uri_mismatch` | NEXTAUTH_URL不一致 | 環境変数とGoogle OAuth設定を確認 |
| Vercelビルド失敗 | `useSearchParams()` 未wrap | `<Suspense>` で包む |
| `.next` キャッシュ破損 | framer-motion等のインポートエラー | `rm -rf .next && npm run dev` |
| 文字起こしが失敗する | ASSEMBLYAI_API_KEY未設定、署名URL無効 | キー確認、Supabase Storage確認、DBステータス確認 |
| アップロードが失敗する | バケット未作成、キー誤り | Supabase Storageバケット確認、`SUPABASE_SERVICE_ROLE_KEY` 確認 |
| 画像アップロード失敗 | リクエストサイズ超過 | クライアントで圧縮 |
| Prisma 型が見つからない | 新モデル追加後に generate 忘れ | `npx prisma generate` を実行 |
| NextResponse(Buffer) エラー | Buffer を直接渡せない | `new NextResponse(new Uint8Array(buf), ...)` |
| Stripe apiVersion 型エラー | 型定義と不一致 | `apiVersion: '2023-10-16'` に統一 |
| doya-ai/ を編集したのに本番に反映されない | Vercel は 09_Cursol/ をデプロイ | `09_Cursol/src/` を編集すること |
| ゲストで機能が動かない | session チェックで早期 return | ゲスト許可の場合は session チェックを外す |