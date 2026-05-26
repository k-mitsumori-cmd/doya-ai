export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

export async function GET() {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const departments = await prisma.kintaiDepartment.findMany({
      where: { organizationId: ctx.organizationId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ departments })
  } catch (e) {
    console.error('[kintai/departments GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { name, parentId, managerId } = await req.json()
    if (!name) return NextResponse.json({ error: '部署名は必須です' }, { status: 400 })

    const dept = await prisma.kintaiDepartment.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        parentId: parentId || null,
        managerId: managerId || null,
      },
      include: { _count: { select: { employees: true } } },
    })

    return NextResponse.json({ department: dept }, { status: 201 })
  } catch (e) {
    console.error('[kintai/departments POST]', e)
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 })
  }
}
