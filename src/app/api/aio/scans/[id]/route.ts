export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'
import { effectiveScanStatus } from '@/lib/aio/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// GET /api/aio/scans/[id] — スキャン詳細（summary 全文）
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const scan = await prisma.aioScan.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!scan) return NextResponse.json({ error: 'スキャンが見つかりません' }, { status: 404 })
  return NextResponse.json(
    { scan: { ...scan, status: effectiveScanStatus(scan.status, scan.updatedAt) } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// DELETE /api/aio/scans/[id]（admin+）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const scan = await prisma.aioScan.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!scan) return NextResponse.json({ error: 'スキャンが見つかりません' }, { status: 404 })
  await prisma.aioScan.delete({ where: { id: scan.id } })
  return NextResponse.json({ ok: true })
}
