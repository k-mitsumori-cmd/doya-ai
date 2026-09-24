export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { canAccessOneOnOne, getOneOnOneViewer, canViewManagerNotes } from '@/lib/hr/one-on-one-access'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildOneOnOneSummaryPrompt } from '@/lib/hr/prompts'
import { checkAiUsageLimit, incrementAiUsage } from '@/lib/hr/billing'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = await ctx.params
    const id = p.id

    const oneOnOne = await prisma.hrOneOnOne.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
        manager: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    if (!oneOnOne) {
      return NextResponse.json({ error: '1on1 record not found' }, { status: 404 })
    }
    if (!(await canAccessOneOnOne(hrCtx, oneOnOne))) {
      return NextResponse.json({ error: 'この1on1記録にアクセスする権限がありません' }, { status: 403 })
    }
    if (!canViewManagerNotes(await getOneOnOneViewer(hrCtx), oneOnOne)) {
      return NextResponse.json({ error: '上司メモを含む要約の利用権限がありません' }, { status: 403 })
    }
    if (oneOnOne.status === 'COMPLETED') {
      return NextResponse.json({ error: '完了済みの1on1は要約を更新できません' }, { status: 409 })
    }

    if (!oneOnOne.managerNotes && !oneOnOne.employeeNotes) {
      return NextResponse.json(
        { error: 'No notes to summarize. Add manager or employee notes first.' },
        { status: 400 }
      )
    }

    // AI使用量制限チェック
    const aiLimitError = await checkAiUsageLimit(hrCtx.organizationId)
    if (aiLimitError) {
      return NextResponse.json({ error: aiLimitError, code: 'HR_ORG_AI_LIMIT', canManageBilling: hrCtx.role === 'OWNER' }, { status: 403 })
    }

    const prompt = buildOneOnOneSummaryPrompt({
      employeeName: `${oneOnOne.employee.lastName} ${oneOnOne.employee.firstName}`,
      managerName: `${oneOnOne.manager.lastName} ${oneOnOne.manager.firstName}`,
      agenda: oneOnOne.agenda as any,
      managerNotes: oneOnOne.managerNotes,
      employeeNotes: oneOnOne.employeeNotes,
      conductedAt: oneOnOne.conductedAt?.toISOString() || null,
    })

    const aiSummary = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
    })

    await prisma.hrOneOnOne.update({
      where: { id, status: { not: 'COMPLETED' }, updatedAt: oneOnOne.updatedAt },
      data: { aiSummary },
    })

    // AI使用カウントをインクリメント
    await incrementAiUsage(hrCtx.organizationId)

    return NextResponse.json({ success: true, aiSummary })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: '要約中に1on1が更新されました。内容を確認して再試行してください。' }, { status: 409 })
    return NextResponse.json(
      { error: e?.message || 'Failed to generate AI summary' },
      { status: 500 }
    )
  }
}
