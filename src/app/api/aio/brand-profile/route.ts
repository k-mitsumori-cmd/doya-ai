export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'
import { parseAioBrandProfileInput } from '@/lib/aio/brand-profile-input'

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

  let data: ReturnType<typeof parseAioBrandProfileInput>
  try {
    data = parseAioBrandProfileInput(await req.json().catch(() => null))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ブランド設定の入力形式を確認してください。' }, { status: 400 })
  }

  const profile = await prisma.aioBrandProfile.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, aliases: [], competitors: [], ...data },
    update: data,
  })
  return NextResponse.json({ ok: true, profile })
}
