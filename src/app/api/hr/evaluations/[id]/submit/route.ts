export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'

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

    const evaluation = await prisma.hrEvaluation.findFirst({
      where: { id },
      include: {
        period: { select: { organizationId: true, status: true } },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }
    if (evaluation.period.organizationId !== hrCtx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (evaluation.status === 'FINALIZED') {
      return NextResponse.json(
        { error: 'Evaluation is already finalized' },
        { status: 400 }
      )
    }

    const updated = await prisma.hrEvaluation.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      evaluation: {
        ...updated,
        goals: updated.goals as any,
        competencies: updated.competencies as any,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to submit evaluation' },
      { status: 500 }
    )
  }
}
