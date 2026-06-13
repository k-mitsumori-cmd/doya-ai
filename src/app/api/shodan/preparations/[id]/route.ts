export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { PREP_STALE_MS } from '@/lib/shodan/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// GET /api/shodan/preparations/[id] — 詳細（成果物フル）
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // organizationId + id の両方で検索（IDOR防止）
  let item = await prisma.shodanPreparation.findFirst({
    where: { id: p.id, organizationId: sctx.organizationId },
  })
  if (!item) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  // Vercelタイムアウト等で 'processing' のまま放置された案件を救済（catchが走らず残るケース）
  if (item.status === 'processing' && Date.now() - new Date(item.updatedAt).getTime() > PREP_STALE_MS) {
    item = await prisma.shodanPreparation.update({
      where: { id: item.id },
      data: { status: 'failed', errorMessage: item.errorMessage || '生成がタイムアウトしました。再度お試しください。' },
    })
  }
  return NextResponse.json({ item }, { headers: { 'Cache-Control': 'no-store' } })
}

// DELETE /api/shodan/preparations/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const item = await prisma.shodanPreparation.findFirst({
    where: { id: p.id, organizationId: sctx.organizationId },
    select: { id: true },
  })
  if (!item) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  await prisma.shodanPreparation.delete({ where: { id: item.id } })
  return NextResponse.json({ ok: true })
}
