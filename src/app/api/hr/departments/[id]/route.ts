export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

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

    const existing = await prisma.hrDepartment.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, code, parentId, managerId, sortOrder, isActive } = body

    if (parentId === id) {
      return NextResponse.json({ error: 'Cannot set self as parent' }, { status: 400 })
    }

    const data: Record<string, any> = {}
    if (name !== undefined) data.name = name
    if (code !== undefined) data.code = code || null
    if (parentId !== undefined) data.parentId = parentId || null
    if (managerId !== undefined) data.managerId = managerId || null
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (isActive !== undefined) data.isActive = isActive

    const updated = await prisma.hrDepartment.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, department: updated })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update department' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
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

    const existing = await prisma.hrDepartment.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: {
        _count: { select: { employees: true, children: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with employees. Move or remove employees first.' },
        { status: 400 }
      )
    }

    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with sub-departments. Remove sub-departments first.' },
        { status: 400 }
      )
    }

    await prisma.hrDepartment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to delete department' },
      { status: 500 }
    )
  }
}
