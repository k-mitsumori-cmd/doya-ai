export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseOrgProfileVersion } from '@/lib/org-profile-version'
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

  let version: ReturnType<typeof parseOrgProfileVersion>
  let data: ReturnType<typeof parseAioBrandProfileInput>
  try {
    const body = await req.json().catch(() => null)
    data = parseAioBrandProfileInput(body)
    version = parseOrgProfileVersion(body)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ブランド設定の入力形式を確認してください。' }, { status: 400 })
  }

  // New clients use compare-and-set so late/duplicate requests cannot overwrite a newer save.
  const profile = version === undefined ? await prisma.aioBrandProfile.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, aliases: [], competitors: [], ...data },
    update: data,
  }) : await prisma.$transaction(async (tx) => {
    // Lock the organization row also when no profile exists yet.
    await tx.$queryRaw`SELECT id FROM aio_organizations WHERE id = ${ctx.organizationId} FOR NO KEY UPDATE`
    const prior = await tx.aioBrandProfile.findUnique({ where: { organizationId: ctx.organizationId } })
    if (version === null) {
      if (prior) return null
      return tx.aioBrandProfile.create({ data: { organizationId: ctx.organizationId, aliases: [], competitors: [], ...data } })
    }
    if (!prior || prior.updatedAt.getTime() !== version.getTime()) return null
    const changed = await tx.aioBrandProfile.updateMany({ where: { organizationId: ctx.organizationId, updatedAt: version }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), prior.updatedAt.getTime() + 1)) } })
    if (changed.count !== 1) return null
    return tx.aioBrandProfile.findUnique({ where: { organizationId: ctx.organizationId } })
  })
  if (!profile) return NextResponse.json({ error: '他の操作で設定が更新されました。保存済みの内容を確認してから、もう一度保存してください。', code: 'PROFILE_CONFLICT' }, { status: 409 })
  return NextResponse.json({ ok: true, profile })
}
