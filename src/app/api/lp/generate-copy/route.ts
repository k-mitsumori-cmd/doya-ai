export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildCopyPrompt } from '@/lib/lp/prompts'
import {
  getLpMonthlyLimitByUserPlan,
  shouldResetMonthlyUsage,
  isWithinFreeHour,
} from '@/lib/pricing'
import type { LpProductInfo, LpPurpose, LpSectionDef, LpStructure } from '@/lib/lp/types'

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

    const { projectId, selectedStructure } = await req.json() as {
      projectId: string
      selectedStructure: number
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const project = await prisma.lpProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const structures = project.structures as any as LpStructure[]
    const structureIdx = selectedStructure ?? project.selectedStructure ?? 0
    const structure = structures?.[structureIdx]

    if (!structure) {
      return NextResponse.json({ error: 'Structure not found. Generate structures first.' }, { status: 400 })
    }

    const productInfo = project.productInfo as any as LpProductInfo
    const purposes = (project.purpose || []) as LpPurpose[]

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
          // selectedStructure を保存
          await prisma.lpProject.update({
            where: { id: projectId },
            data: { selectedStructure: structureIdx },
          })

          const sections = structure.sections || []
          const total = sections.length

          if (total === 0) {
            safeEnqueue(`data: ${JSON.stringify({ type: 'error', message: '構成案にセクションが含まれていません。構成案を再生成してください。' })}\n\n`)
            return
          }

          let failedCount = 0

          for (let i = 0; i < sections.length; i++) {
            const sectionDef = sections[i] as LpSectionDef

            safeEnqueue(
              `data: ${JSON.stringify({ type: 'progress', current: i + 1, total, sectionName: sectionDef.name })}\n\n`
            )

            const prompt = buildCopyPrompt(productInfo, sectionDef, purposes)
            let copyData: {
              headline?: string
              subheadline?: string
              body?: string
              ctaText?: string | null
              items?: any[]
            } = {}

            try {
              copyData = await geminiGenerateJson<typeof copyData>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt }) || {}
            } catch (genErr) {
              console.error(`[generate-copy] Section "${sectionDef.name}" generation failed:`, genErr)
              copyData = { headline: sectionDef.name, body: '（コピー生成に失敗しました。ブラッシュアップ機能で再生成してください）' }
              failedCount++
            }

            // DB upsert
            const existing = await prisma.lpSection.findFirst({
              where: { projectId, order: i },
            })

            let savedSection
            if (existing) {
              savedSection = await prisma.lpSection.update({
                where: { id: existing.id },
                data: {
                  type: sectionDef.type,
                  name: sectionDef.name,
                  purpose: sectionDef.purpose,
                  headline: copyData.headline || null,
                  subheadline: copyData.subheadline || null,
                  body: copyData.body || null,
                  ctaText: copyData.ctaText || null,
                  items: (copyData.items || null) as any,
                },
              })
            } else {
              savedSection = await prisma.lpSection.create({
                data: {
                  projectId,
                  order: i,
                  type: sectionDef.type,
                  name: sectionDef.name,
                  purpose: sectionDef.purpose,
                  headline: copyData.headline || null,
                  subheadline: copyData.subheadline || null,
                  body: copyData.body || null,
                  ctaText: copyData.ctaText || null,
                  items: (copyData.items || null) as any,
                },
              })
            }

            safeEnqueue(
              `data: ${JSON.stringify({ type: 'section', section: savedSection })}\n\n`
            )
          }

          if (failedCount > 0) {
            safeEnqueue(
              `data: ${JSON.stringify({ type: 'warning', message: `${failedCount}件のセクションでコピー生成に失敗しました。ブラッシュアップ機能で再生成できます。` })}\n\n`
            )
          }

          safeEnqueue(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        } catch (e: any) {
          console.error('[generate-copy stream error]', e)
          const message = e?.message?.includes('quota') || e?.message?.includes('429')
            ? 'API利用制限に達しました。しばらく時間をおいてお試しください。'
            : `コピー生成に失敗しました: ${e?.message || '不明なエラー'}`
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
    console.error('[POST /api/lp/generate-copy]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
