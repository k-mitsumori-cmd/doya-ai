export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, orgSlugFrom } from '@/lib/aio/access'
import { siteReadKey } from '@/lib/aio/site-analysis'

// GET /api/aio/site-read — 開始時に読み取ったサイトの内容の記録（所属する組織のメンバーだけ）
export async function GET(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const row = await prisma.systemSetting.findUnique({ where: { key: siteReadKey(ctx.organizationId) }, select: { value: true } })
  let record: unknown = null
  try { record = row ? JSON.parse(row.value) : null } catch { record = null }
  return NextResponse.json({ record }, { headers: { 'Cache-Control': 'no-store' } })
}
