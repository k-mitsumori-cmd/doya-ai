export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IMAGE_MODELS, RATIOS, estimateCost, type ImageGenRequest } from '@/lib/tenjikai/imagegen'
import { reserveImageQuota } from '@/lib/tenjikai/image-quota'

const MAX_COUNT = 4
const MAX_PROMPT_CHARS = 4000
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024
const JOB_KINDS = ['creative_image', 'booth_render', 'graphic_panel'] as const

// 画面から送られる expectedCostYen は利用者への確認表示にすぎず、課金の防御にはならない。
// そのため、生成の前にサーバー側で上限を消費する（src/lib/tenjikai/image-quota.ts）。
// 1人あたりの枚数とサービス全体の金額を SystemSetting で数えるので、Vercel のインスタンスをまたいでも守れる。
// 実行の記録は TenjikaiGenerationJob に残す（承認した見込み額・結果・失敗の理由）。

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

// 従量課金API。以下の4つがそろったときだけ実行する。
// 1. TENJIKAI_IMAGEGEN_ENABLED=true（明示的に有効化。本番では未設定のまま＝無効）
// 2. ログインしている
// 3. GEMINI_API_KEY が設定されている
// 4. リクエストに approved: true と、サーバー側の見積と一致する expectedCostYen がある
export async function POST(req: NextRequest) {
  if (process.env.TENJIKAI_IMAGEGEN_ENABLED !== 'true') return fail(403, '画像の生成は準備中です。')
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) {
    console.error('[tenjikai/image] GEMINI_API_KEY is not set')
    return fail(500, '画像を作れません。時間をおいて、もう一度お試しください。')
  }

  let body: ImageGenRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が正しくありません。' }, { status: 400 })
  }

  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: `プロンプトは1〜${MAX_PROMPT_CHARS}文字で指定してください。` }, { status: 400 })
  }
  if (!(RATIOS as readonly string[]).includes(body.aspectRatio)) return NextResponse.json({ error: '対応していないアスペクト比です。' }, { status: 400 })
  if (body.referencePng !== undefined && (typeof body.referencePng !== 'string' || body.referencePng.length * 0.75 > MAX_REFERENCE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(body.referencePng))) {
    return NextResponse.json({ error: '参照画像は4MB以下のPNGにしてください。' }, { status: 400 })
  }
  if (body.approved !== true) return NextResponse.json({ error: '見込み額の承認がありません。' }, { status: 400 })
  if (!IMAGE_MODELS.some((m) => m.id === body.model)) return NextResponse.json({ error: '対応していないモデルです。' }, { status: 400 })
  if (!['1K', '2K', '4K'].includes(body.size)) return NextResponse.json({ error: '解像度は 1K / 2K / 4K から指定してください。' }, { status: 400 })
  const count = Math.min(Math.max(1, Math.floor(body.count || 1)), MAX_COUNT)
  const est = estimateCost(body.model, body.size, count)
  if (est.totalYen !== body.expectedCostYen) {
    return NextResponse.json({ error: `見込み額が一致しません（サーバー計算 ¥${est.totalYen}）。画面を更新して再度承認してください。` }, { status: 409 })
  }

  const kind = (JOB_KINDS as readonly string[]).includes(String(body.kind)) ? String(body.kind) : 'creative_image'

  // 上限の消費（DB が使えなければ実行しない）
  const quota = await reserveImageQuota(userId, count, est.totalYen)
  if (!quota.ok) return fail(quota.status, quota.message)

  // 実行の記録。記録できないときは実行しない（課金の跡が残らないため）
  let jobId: string
  try {
    const job = await prisma.tenjikaiGenerationJob.create({
      data: { userId, kind, model: body.model, size: body.size, count, estimatedCostYen: est.totalYen, approvedAt: new Date() },
      select: { id: true },
    })
    jobId = job.id
  } catch (e) {
    console.error('[tenjikai/image] failed to record job', { code: (e as { code?: string })?.code ?? 'unknown' })
    return fail(503, '実行の記録を残せないため、画像を作れません。時間をおいて、もう一度お試しください。')
  }
  const finish = (data: { status: 'done' | 'failed'; imageCount: number; errorCode?: string }) =>
    prisma.tenjikaiGenerationJob.update({ where: { id: jobId }, data: { ...data, finishedAt: new Date() } }).catch((e) => {
      console.error('[tenjikai/image] failed to update job', { jobId, code: (e as { code?: string })?.code ?? 'unknown' })
    })

  const parts: unknown[] = [{ text: body.prompt }]
  if (body.referencePng) parts.push({ inline_data: { mime_type: 'image/png', data: body.referencePng } })

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent`
  const images: string[] = []
  try {
    for (let i = 0; i < count; i++) {
      const res = await fetch(endpoint, {
        signal: AbortSignal.timeout(120_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: body.model.includes('pro') ? { aspectRatio: body.aspectRatio, imageSize: body.size } : { aspectRatio: body.aspectRatio },
          },
        }),
      })
      if (!res.ok) {
        // 応答の本文はサーバーのログにだけ残す。利用者には日本語の文言だけを返す
        const text = await res.text().catch(() => '')
        console.error('[tenjikai/image] upstream error', { jobId, status: res.status, body: text.slice(0, 500) })
        await finish({ status: 'failed', imageCount: images.length, errorCode: `upstream_${res.status}` })
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
    await finish({ status: 'failed', imageCount: images.length, errorCode: 'network' })
    return fail(502, '画像を作れませんでした。時間をおいて、もう一度お試しください。')
  }

  if (images.length === 0) {
    console.error('[tenjikai/image] upstream returned no image', { jobId })
    await finish({ status: 'failed', imageCount: 0, errorCode: 'no_image' })
    return fail(502, '画像を作れませんでした。内容を変えて、もう一度お試しください。')
  }
  await finish({ status: 'done', imageCount: images.length })
  // 画像の保存（Supabase Storage と TenjikaiCreative.imageUrl）は、プロジェクトの保存と一緒に入れる
  return NextResponse.json({ images, costYen: est.totalYen, model: body.model, size: body.size })
}
