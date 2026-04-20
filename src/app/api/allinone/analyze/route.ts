/**
 * POST /api/allinone/analyze
 *
 * URL を受け取り、ドヤマーケAI の多角分析を起動する SSE エンドポイント。
 * 1. DB に AllinoneAnalysis レコードを作成
 * 2. SSE で段階的に結果を送信
 * 3. 完了時に status='completed' で保存
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSseStream, SSE_HEADERS } from '@/lib/allinone/sse'
import { runAnalysis } from '@/lib/allinone/orchestrator'
import type { AnalyzeSseEvent } from '@/lib/allinone/types'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function isLimitsDisabled(): boolean {
  return (
    process.env.ALLINONE_DISABLE_LIMITS === '1' ||
    process.env.ALLINONE_DISABLE_LIMITS === 'true' ||
    process.env.DOYA_DISABLE_LIMITS === '1'
  )
}

export async function POST(req: NextRequest) {
  let body: { url?: string; targetKeyword?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const rawUrl = (body.url || '').trim()
  if (!rawUrl) {
    return new Response(JSON.stringify({ error: 'url is required' }), { status: 400 })
  }

  // 入力 URL の正規化
  let normalizedUrl = rawUrl
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`
  try {
    new URL(normalizedUrl)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid url' }), { status: 400 })
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined

  // ゲスト識別子
  const guestCookie = req.cookies.get('doya_allinone_guest')?.value
  const guestId = !userId && guestCookie ? guestCookie : !userId ? crypto.randomUUID() : undefined

  // 使用制限チェック（Free: 月3回、ログインユーザーのみ厳格に）
  if (userId && !isLimitsDisabled()) {
    const sub = await prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'allinone' } },
    })
    const isPro = sub?.plan === 'PRO' || sub?.plan === 'ENTERPRISE'
    if (!isPro) {
      const used = sub?.monthlyUsage ?? 0
      if (used >= 3) {
        return new Response(
          JSON.stringify({
            error: 'limit_exceeded',
            message: '無料プランの月3回分析の上限に達しました。PROプランで無制限に。',
          }),
          { status: 429 }
        )
      }
    }
  }

  // レコード作成
  const analysis = await prisma.allinoneAnalysis.create({
    data: {
      userId: userId || null,
      guestId: userId ? null : guestId,
      url: normalizedUrl,
      targetKw: body.targetKeyword || null,
      status: 'running',
      progress: { scrape: 'pending' },
    },
  })

  // 使用量インクリメント
  if (userId && !isLimitsDisabled()) {
    await prisma.userServiceSubscription.upsert({
      where: { userId_serviceId: { userId, serviceId: 'allinone' } },
      update: { monthlyUsage: { increment: 1 }, dailyUsage: { increment: 1 } },
      create: {
        userId,
        serviceId: 'allinone',
        plan: 'FREE',
        monthlyUsage: 1,
        dailyUsage: 1,
      },
    })
  }

  // SSE ストリーム
  const stream = createSseStream<AnalyzeSseEvent>(async (ctrl) => {
    ctrl.send({ type: 'start', analysisId: analysis.id })

    await runAnalysis({
      url: normalizedUrl,
      targetKeyword: body.targetKeyword,
      analysisId: analysis.id,
      send: (evt) => ctrl.send(evt),
      save: async (patch) => {
        try {
          await prisma.allinoneAnalysis.update({
            where: { id: analysis.id },
            data: patch as any,
          })
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[allinone] save patch failed', e)
        }
      },
      saveAsset: async (asset) => {
        try {
          await prisma.allinoneAsset.create({
            data: {
              analysisId: analysis.id,
              kind: asset.kind,
              label: asset.label,
              url: asset.url,
              mimeType: asset.mimeType || 'image/png',
              width: asset.width,
              height: asset.height,
              prompt: asset.prompt,
              meta: asset.meta,
            },
          })
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[allinone] saveAsset failed', e)
        }
      },
    })

    ctrl.send({ type: 'complete', analysisId: analysis.id })
  })

  const headers = new Headers(SSE_HEADERS)
  if (guestId && !userId) {
    headers.append(
      'Set-Cookie',
      `doya_allinone_guest=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}`
    )
  }
  headers.set('X-Analysis-Id', analysis.id)

  return new Response(stream, { headers })
}
