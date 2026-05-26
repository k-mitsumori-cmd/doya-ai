export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildOneOnOneSummaryPrompt } from '@/lib/hr/prompts'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
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

    if (!oneOnOne.managerNotes && !oneOnOne.employeeNotes) {
      return NextResponse.json(
        { error: 'No notes to summarize. Add manager or employee notes first.' },
        { status: 400 }
      )
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
      where: { id },
      data: { aiSummary },
    })

    return NextResponse.json({ success: true, aiSummary })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to generate AI summary' },
      { status: 500 }
    )
  }
}
