export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/hr/constants'

// GET /api/hr/audit-logs
// 監査ログ一覧（ADMIN以上のみ）
export async function GET(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = req.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)))
    )
    const action = url.searchParams.get('action') || ''
    const userId = url.searchParams.get('userId') || ''

    const where: any = { organizationId: ctx.organizationId }
    if (action) where.action = action
    if (userId) where.userId = userId

    const [items, total] = await Promise.all([
      prisma.hrAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hrAuditLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
