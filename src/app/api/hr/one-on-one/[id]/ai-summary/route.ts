import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { canAccessOneOnOne, getOneOnOneViewer, canViewManagerNotes } from '@/lib/hr/one-on-one-access'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildOneOnOneSummaryPrompt } from '@/lib/hr/prompts'
import { reserveAiUsage, releaseAiUsage } from '@/lib/hr/billing'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
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
      return privateApiJson({ error: 'この1on1の記録は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    }
    if (!(await canAccessOneOnOne(hrCtx, oneOnOne))) {
      return privateApiJson({ error: 'この1on1記録にアクセスする権限がありません' }, { status: 403 })
    }
    if (!canViewManagerNotes(await getOneOnOneViewer(hrCtx), oneOnOne)) {
      return privateApiJson({ error: '上司メモを含む要約の利用権限がありません' }, { status: 403 })
    }
    if (oneOnOne.status === 'COMPLETED') {
      return privateApiJson({ error: '完了済みの1on1は要約を更新できません' }, { status: 409 })
    }

    if (!oneOnOne.managerNotes && !oneOnOne.employeeNotes) {
      return privateApiJson(
        { error: '要約するメモがありません。上司か本人のメモを書いてから、お試しください。' },
        { status: 400 }
      )
    }

    const admission = await reserveAiUsage(hrCtx.organizationId)
    if (!admission.granted) {
      return privateApiJson({ error: admission.error, code: 'HR_ORG_AI_LIMIT', canManageBilling: hrCtx.role === 'OWNER' }, { status: 403 })
    }
    let saved = false
    try {
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
      saved = true
      return privateApiJson({ success: true, aiSummary })
    } finally {
      if (!saved) await releaseAiUsage(admission.reservation)
    }
  } catch (e: any) {
    if (e?.code === 'P2025') return privateApiJson({ error: '要約中に1on1が更新されました。内容を確認して再試行してください。' }, { status: 409 })
    console.error('[hr/one-on-one/[id]/ai-summary] unexpected error')
    return privateApiJson(
      { error: 'AIの要約を作れませんでした。時間をおいて、もう一度お試しください。' },
      { status: 500 }
    )
  }
}
