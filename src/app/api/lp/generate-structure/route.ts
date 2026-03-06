export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildStructurePrompt } from '@/lib/lp/prompts'
import {
  getLpMonthlyLimitByUserPlan,
  shouldResetMonthlyUsage,
  isWithinFreeHour,
} from '@/lib/pricing'
import type { LpProductInfo, LpPurpose, LpStructure } from '@/lib/lp/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // ===== 使用制限チェック =====
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, firstLoginAt: true },
    })

    if (user) {
      let isUnlimited = false
      if (isWithinFreeHour(user.firstLoginAt)) isUnlimited = true

      const monthlyLimit = getLpMonthlyLimitByUserPlan(user.plan)
      if (monthlyLimit < 0) isUnlimited = true

      if (!isUnlimited) {
        let sub = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId, serviceId: 'lp' } },
        })

        if (!sub) {
          sub = await prisma.userServiceSubscription.create({
            data: { userId, serviceId: 'lp', plan: user.plan || 'FREE' },
          })
        }

        let usedThisMonth = sub.monthlyUsage || 0

        if (shouldResetMonthlyUsage(sub.lastUsageReset)) {
          await prisma.userServiceSubscription.update({
            where: { id: sub.id },
            data: { monthlyUsage: 0, lastUsageReset: new Date() },
          })
          usedThisMonth = 0
        }

        if (usedThisMonth >= monthlyLimit) {
          return NextResponse.json(
            {
              error: `今月のLP生成上限（${monthlyLimit}ページ）に達しました`,
              limitReached: true,
              usedThisMonth,
              monthlyLimit,
            },
            { status: 429 }
          )
        }
      }
    }

    const { projectId, productInfo, purposes } = await req.json() as {
      projectId: string
      productInfo: LpProductInfo
      purposes: LpPurpose[]
    }

    if (!projectId || !productInfo) {
      return NextResponse.json({ error: 'projectId and productInfo are required' }, { status: 400 })
    }

    const project = await prisma.lpProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false

        const safeEnqueue = (data: string) => {
          if (!streamClosed) {
            try {
              controller.enqueue(encoder.encode(data))
            } catch {
              streamClosed = true
            }
          }
        }

        try {
          safeEnqueue(`data: ${JSON.stringify({ type: 'status', message: 'LP構成案を生成中...' })}\n\n`)

          const prompt = buildStructurePrompt(productInfo, purposes || [])
          const result = await geminiGenerateJson<{ structures: LpStructure[] }>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt })
          const structures = result?.structures || []

          if (!structures.length) {
            safeEnqueue(`data: ${JSON.stringify({ type: 'error', message: 'AIからの応答が不正です。もう一度お試しください。' })}\n\n`)
            return
          }

          // DB保存
          await prisma.lpProject.update({
            where: { id: projectId },
            data: {
              structures: structures as any,
              productInfo: productInfo as any,
              purpose: purposes || [],
              status: 'editing',
            },
          })

          safeEnqueue(`data: ${JSON.stringify({ type: 'structures', structures })}\n\n`)
          safeEnqueue(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        } catch (e: any) {
          console.error('[generate-structure stream error]', e)
          const message = e?.message?.includes('quota') || e?.message?.includes('429')
            ? 'API利用制限に達しました。しばらく時間をおいてお試しください。'
            : e?.message?.includes('timeout') || e?.message?.includes('ETIMEDOUT')
              ? '生成がタイムアウトしました。もう一度お試しください。'
              : `構成案の生成に失敗しました: ${e?.message || '不明なエラー'}`
          safeEnqueue(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        } finally {
          if (!streamClosed) {
            try { controller.close() } catch { /* already closed */ }
          }
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[POST /api/lp/generate-structure]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
