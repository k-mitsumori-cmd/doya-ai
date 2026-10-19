export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IMAGE_SIZE, RATIOS, estimateQuotaYen, imageModelChain, type ImageGenRequest } from '@/lib/tenjikai/imagegen'
import { perUserDailyImages, remainingImagesToday, reserveImageQuota } from '@/lib/tenjikai/image-quota'
import { mockPanelImage } from '@/lib/tenjikai/mock-image'

const MAX_COUNT = 4
const MAX_PROMPT_CHARS = 4000
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024
const JOB_KINDS = ['creative_image', 'booth_render', 'graphic_panel'] as const

// 従量課金の API。モデルと解像度はサーバーが決める（利用者には選ばせず、原価も見せない）。
// 生成の前にサーバー側で上限を消費する（src/lib/tenjikai/image-quota.ts）。
// 1人あたりの枚数とサービス全体の金額を SystemSetting で数えるので、Vercel のインスタンスをまたいでも守れる。
// 実行の記録は TenjikaiGenerationJob に残す（見込み額・結果・失敗の理由）。

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
const enabled = () => process.env.TENJIKAI_IMAGEGEN_ENABLED === 'true'
// 開発中の画面確認用。課金 API を呼ばずに見本の画像を返す。開発サーバー（next dev）でだけ効く
const mockMode = () => process.env.NODE_ENV === 'development' && process.env.TENJIKAI_IMAGEGEN_MOCK === 'true'

async function currentUserId() {
  const session = await getServerSession(authOptions).catch(() => null)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

// 画面に出す「きょう作れる残りの枚数」
export async function GET() {
  if (mockMode()) return NextResponse.json({ enabled: true, remaining: perUserDailyImages(), perDay: perUserDailyImages() })
  if (!enabled()) return NextResponse.json({ enabled: false, remaining: 0, perDay: perUserDailyImages() })
  const userId = await currentUserId()
  if (!userId) return fail(401, 'ログインが必要です。')
  return NextResponse.json({ enabled: true, remaining: await remainingImagesToday(userId), perDay: perUserDailyImages() })
}

// 以下がそろったときだけ実行する。
// 1. TENJIKAI_IMAGEGEN_ENABLED=true（明示的に有効化。本番では未設定のまま＝無効）
// 2. ログインしている
// 3. GEMINI_API_KEY が設定されている
// 4. リクエストに approved: true がある（利用者が「作る」を押した）
export async function POST(req: NextRequest) {
  const mock = mockMode()
  if (!mock && !enabled()) return fail(403, '画像の生成は準備中です。')

  let body: ImageGenRequest
  try {
    body = await req.json()
  } catch {
    return fail(400, 'リクエストの形式が正しくありません。')
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_CHARS) {
    return fail(400, `指示文は1〜${MAX_PROMPT_CHARS}文字にしてください。`)
  }
  if (!(RATIOS as readonly string[]).includes(body.aspectRatio)) return fail(400, '対応していない縦横比です。')
  if (body.referencePng !== undefined && (typeof body.referencePng !== 'string' || body.referencePng.length * 0.75 > MAX_REFERENCE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(body.referencePng))) {
    return fail(400, '参照画像は4MB以下のPNGにしてください。')
  }
  if (body.approved !== true) return fail(400, '作成の確認がありません。')
  const count = Math.min(Math.max(1, Math.floor(body.count || 1)), MAX_COUNT)

  if (mock) return NextResponse.json({ images: Array.from({ length: count }, (_, i) => mockPanelImage(body.aspectRatio, i)), mock: true })

  const userId = await currentUserId()
  if (!userId) return fail(401, 'ログインが必要です。')
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) {
    console.error('[tenjikai/image] GEMINI_API_KEY is not set')
    return fail(500, '画像を作れません。時間をおいて、もう一度お試しください。')
  }

  const kind = (JOB_KINDS as readonly string[]).includes(String(body.kind)) ? String(body.kind) : 'creative_image'
  const costYen = estimateQuotaYen(count)

  // 上限の消費（DB が使えなければ実行しない）
  const quota = await reserveImageQuota(userId, count, costYen)
  if (!quota.ok) return fail(quota.status, quota.message)

  // 実行の記録。記録できないときは実行しない（課金の跡が残らないため）
  const chain = imageModelChain()
  let jobId: string
  try {
    const job = await prisma.tenjikaiGenerationJob.create({
      data: { userId, kind, model: chain[0], size: IMAGE_SIZE, count, estimatedCostYen: costYen, approvedAt: new Date() },
      select: { id: true },
    })
    jobId = job.id
  } catch (e) {
    console.error('[tenjikai/image] failed to record job', { code: (e as { code?: string })?.code ?? 'unknown' })
    return fail(503, '実行の記録を残せないため、画像を作れません。時間をおいて、もう一度お試しください。')
  }
  const finish = (data: { status: 'done' | 'failed'; imageCount: number; errorCode?: string; model?: string }) =>
    prisma.tenjikaiGenerationJob.update({ where: { id: jobId }, data: { ...data, finishedAt: new Date() } }).catch((e) => {
      console.error('[tenjikai/image] failed to update job', { jobId, code: (e as { code?: string })?.code ?? 'unknown' })
    })

  const parts: unknown[] = [{ text: body.prompt }]
  if (body.referencePng) parts.push({ inline_data: { mime_type: 'image/png', data: body.referencePng } })

  const images: string[] = []
  let used = chain[0]
  try {
    for (let i = 0; i < count; i++) {
      let res: Response | null = null
      // 404（廃止・未提供の ID）のときだけ、次のモデルを試す
      for (let m = chain.indexOf(used); m < chain.length; m++) {
        used = chain[m]
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${used}:generateContent`, {
          signal: AbortSignal.timeout(120_000),
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['IMAGE'],
              imageConfig: used.includes('pro') ? { aspectRatio: body.aspectRatio, imageSize: IMAGE_SIZE } : { aspectRatio: body.aspectRatio },
            },
          }),
        })
        if (res.status !== 404) break
        console.warn('[tenjikai/image] model unavailable, trying next', { jobId, model: used })
      }
      if (!res || !res.ok) {
        // 応答の本文はサーバーのログにだけ残す。利用者には日本語の文言だけを返す
        const text = res ? await res.text().catch(() => '') : ''
        console.error('[tenjikai/image] upstream error', { jobId, model: used, status: res?.status, body: text.slice(0, 500) })
        await finish({ status: 'failed', imageCount: images.length, errorCode: `upstream_${res?.status ?? 'none'}`, model: used })
        return fail(502, '画像を作れませんでした。時間をおいて、もう一度お試しください。')
      }
      const json = await res.json()
      const found = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
      const data = found?.inlineData?.data ?? found?.inline_data?.data
      const mime = found?.inlineData?.mimeType ?? found?.inline_data?.mime_type ?? 'image/png'
      if (data) images.push(`data:${mime};base64,${data}`)
    }
  } catch (e) {
    console.error('[tenjikai/image] upstream request failed', { jobId, kind: e instanceof Error ? e.name : 'unknown' })
    await finish({ status: 'failed', imageCount: images.length, errorCode: 'network', model: used })
    return fail(502, '画像を作れませんでした。時間をおいて、もう一度お試しください。')
  }

  if (images.length === 0) {
    console.error('[tenjikai/image] upstream returned no image', { jobId })
    await finish({ status: 'failed', imageCount: 0, errorCode: 'no_image', model: used })
    return fail(502, '画像を作れませんでした。内容を変えて、もう一度お試しください。')
  }
  await finish({ status: 'done', imageCount: images.length, model: used })
  // 画像の保存（Supabase Storage と TenjikaiCreative.imageUrl）は、プロジェクトの保存と一緒に入れる
  return NextResponse.json({ images })
}
