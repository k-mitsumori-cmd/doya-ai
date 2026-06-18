export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'

// GET /api/aio/brand-profile — 追跡ブランド情報の取得
export async function GET(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const profile = await prisma.aioBrandProfile.findUnique({ where: { organizationId: ctx.organizationId } })
  return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
}

// PUT /api/aio/brand-profile — 追跡ブランド情報の登録/更新（manager+）
export async function PUT(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const str = (v: any, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) || null : null)
  const arr = (v: any) =>
    Array.isArray(v) ? v.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim()).slice(0, 30) : []

  const data = {
    brandName: str(body.brandName, 120),
    brandUrl: str(body.brandUrl, 300),
    aliases: arr(body.aliases),
    competitors: arr(body.competitors),
    category: str(body.category, 200),
    market: str(body.market, 100),
  }

  const profile = await prisma.aioBrandProfile.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, ...data },
    update: data,
  })
  return NextResponse.json({ ok: true, profile })
}
