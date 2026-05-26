export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
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
          select: {
            id: true, firstName: true, lastName: true,
            position: true,
            department: { select: { id: true, name: true } },
          },
        },
        manager: {
          select: {
            id: true, firstName: true, lastName: true,
            position: true,
          },
        },
      },
    })

    if (!oneOnOne) {
      return NextResponse.json({ error: '1on1 record not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      oneOnOne: {
        ...oneOnOne,
        agenda: oneOnOne.agenda as any,
        aiActionItems: oneOnOne.aiActionItems as any,
        aiInsights: oneOnOne.aiInsights as any,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch 1on1 record' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
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

    const existing = await prisma.hrOneOnOne.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: '1on1 record not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      scheduledAt,
      conductedAt,
      duration,
      agenda,
      managerNotes,
      employeeNotes,
      privateNotes,
      status,
    } = body

    const data: Record<string, any> = {}
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null
    if (conductedAt !== undefined) data.conductedAt = conductedAt ? new Date(conductedAt) : null
    if (duration !== undefined) data.duration = duration
    if (agenda !== undefined) data.agenda = agenda
    if (managerNotes !== undefined) data.managerNotes = managerNotes
    if (employeeNotes !== undefined) data.employeeNotes = employeeNotes
    if (privateNotes !== undefined) data.privateNotes = privateNotes
    if (status !== undefined) data.status = status

    const updated = await prisma.hrOneOnOne.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      success: true,
      oneOnOne: {
        ...updated,
        agenda: updated.agenda as any,
        aiActionItems: updated.aiActionItems as any,
        aiInsights: updated.aiInsights as any,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update 1on1 record' },
      { status: 500 }
    )
  }
}
