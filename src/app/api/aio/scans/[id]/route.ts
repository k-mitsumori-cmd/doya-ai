export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'
import { effectiveScanStatus } from '@/lib/aio/types'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/aio/scans/[id] — スキャン詳細（summary 全文）
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const scan = await prisma.aioScan.findFirst({ where: { id: p.id, organizationId: sctx.organizationId, status: { not: 'deleted' } } })
  if (!scan) return NextResponse.json({ error: 'スキャンが見つかりません' }, { status: 404 })
  return NextResponse.json(
    { scan: { ...scan, status: effectiveScanStatus(scan.status, scan.updatedAt) } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// DELETE /api/aio/scans/[id]（admin+）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const result = await prisma.$transaction(async (tx) => {
    // Share the reservation lock, then lock this scan against completion updates.
    await tx.$queryRaw`SELECT id FROM aio_organizations WHERE id = ${sctx.organizationId} FOR NO KEY UPDATE`
    await tx.$queryRaw`SELECT id FROM aio_scans WHERE id = ${p.id} AND "organizationId" = ${sctx.organizationId} FOR NO KEY UPDATE`
    const scan = await tx.aioScan.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
    if (!scan || scan.status === 'deleted') return 'missing'
    if (effectiveScanStatus(scan.status, scan.updatedAt) === 'processing') return 'processing'
    if (scan.status === 'done') {
      // Remove result content, retaining only the usage marker and original timestamp.
      await tx.aioResult.deleteMany({ where: { scanId: scan.id, organizationId: sctx.organizationId } })
      await tx.aioScan.update({
        where: { id: scan.id },
        data: {
          status: 'deleted', engines: Prisma.DbNull, repetitions: 0,
          errorMessage: null, summary: Prisma.DbNull,
          awarenessPct: null, shareOfVoice: null, sentimentPos: null,
          sentimentNeu: null, sentimentNeg: null, ownCitationPct: null,
        },
      })
    } else if (effectiveScanStatus(scan.status, scan.updatedAt) === 'failed') {
      // Failed/expired executions never consume quota and need no usage marker.
      await tx.aioScan.delete({ where: { id: scan.id } })
    } else {
      return 'unsupported'
    }
    return 'deleted'
  })
  if (result === 'missing') return NextResponse.json({ error: 'スキャンが見つかりません' }, { status: 404 })
  if (result === 'processing') return NextResponse.json({ error: '実行中のスキャンは削除できません。完了後にお試しください。' }, { status: 409 })
  if (result === 'unsupported') return NextResponse.json({ error: '現在の状態では削除できません。再読み込みしてください。' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
