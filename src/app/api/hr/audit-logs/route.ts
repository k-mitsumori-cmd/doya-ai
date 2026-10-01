export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/hr/constants'

const MAX_PAGE = 10000

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
    const page = url.searchParams.has('page') ? Number(url.searchParams.get('page')) : 1
    const pageSize = url.searchParams.has('pageSize') ? Number(url.searchParams.get('pageSize')) : DEFAULT_PAGE_SIZE
    if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE
      || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
    const action = url.searchParams.get('action') || ''
    const userId = url.searchParams.get('userId') || ''

    const where: any = { organizationId: ctx.organizationId }
    if (action) where.action = action
    if (userId) where.userId = userId

    const [items, total] = await Promise.all([
      prisma.hrAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
  } catch {
    console.error('[hr/audit-logs] failed')
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
