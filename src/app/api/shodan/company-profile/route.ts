export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseOrgProfileVersion } from '@/lib/org-profile-version'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { signedUrl } from '@/lib/shodan/storage'

const FIELDS = ['companyName', 'url', 'description', 'valueProp', 'products', 'targetCustomer', 'pricingNote', 'caseStudies'] as const

// GET /api/shodan/company-profile — 自社情報の取得（ロゴは署名URLを付与）
const privateReadHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(req: NextRequest) {
  try {
    const ctx = await getShodanContext(orgSlugFrom(req))
    if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401, headers: privateReadHeaders })
    const profile = await prisma.shodanCompanyProfile.findUnique({ where: { organizationId: ctx.organizationId } })
    const logoUrl = profile?.logoPath ? await signedUrl(profile.logoPath) : null
    const member = { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE' }
    if (!profile) {
      const currentMember = await prisma.shodanMember.findFirst({ where: member, select: { id: true } })
      if (!currentMember) return NextResponse.json({ error: '閲覧権限が変更されています。一覧を更新してください。' }, { status: 404, headers: privateReadHeaders })
      return NextResponse.json({ profile: null }, { headers: privateReadHeaders })
    }
    // ロゴの署名URL取得後に、現在のプロフィールと元の所属権限を確認する。
    const current = await prisma.shodanCompanyProfile.findFirst({
      where: { id: profile.id, organizationId: ctx.organizationId, organization: { members: { some: member } } },
    })
    if (!current) return NextResponse.json({ error: '自社情報が見つからないか、閲覧権限が変更されています。一覧を更新してください。' }, { status: 404, headers: privateReadHeaders })
    if (current.updatedAt.getTime() !== profile.updatedAt.getTime() || current.logoPath !== profile.logoPath) {
      return NextResponse.json({ error: '自社情報が更新されています。再読み込みしてからお試しください。' }, { status: 409, headers: privateReadHeaders })
    }
    return NextResponse.json({ profile: { ...current, logoUrl } }, { headers: privateReadHeaders })
  } catch {
    return NextResponse.json({ error: '自社情報を読み込めませんでした。時間をおいて再度お試しください。' }, { status: 503, headers: privateReadHeaders })
  }
}

// PUT /api/shodan/company-profile — 自社情報の登録/更新（manager+）
export async function PUT(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || ![...FIELDS, 'logoPath', 'brandColors'].some((field) => Object.prototype.hasOwnProperty.call(body, field))
    || FIELDS.some((field) => body[field] != null && (typeof body[field] !== 'string' || body[field].trim().length > 4000))
    || (body.logoPath != null && typeof body.logoPath !== 'string')
    || (body.brandColors != null && (!Array.isArray(body.brandColors) || body.brandColors.length > 4
      || body.brandColors.some((color: unknown) => typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))))) {
    return NextResponse.json({ error: '自社情報の入力形式を確認してください' }, { status: 400 })
  }
  let version: ReturnType<typeof parseOrgProfileVersion>
  try { version = parseOrgProfileVersion(body) }
  catch { return NextResponse.json({ error: '設定の更新日時を確認できません。再読み込みしてください。' }, { status: 400 }) }
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    const v = body[f]
    data[f] = typeof v === 'string' ? v.trim().slice(0, 4000) || null : null
  }
  // ロゴパス（自前アップロード形式のみ許可）
  const rawLogo = typeof body.logoPath === 'string' ? body.logoPath.trim() : ''
  data.logoPath = rawLogo && /^shodan\/logos\/[a-z0-9-]+\/[0-9a-fA-F-]{36}\.(png|jpg|webp)$/.test(rawLogo) ? rawLogo : null
  // ブランドカラー（#RRGGBB を最大4色）
  data.brandColors = Array.isArray(body.brandColors)
    ? body.brandColors.filter((c: any) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 4)
    : null

  // New clients use compare-and-set so late/duplicate requests cannot overwrite a newer save.
  const profile = version === undefined ? await prisma.shodanCompanyProfile.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, ...data },
    update: data,
  }) : await prisma.$transaction(async (tx) => {
    // Lock the organization row also when no profile exists yet.
    await tx.$queryRaw`SELECT id FROM shodan_organizations WHERE id = ${ctx.organizationId} FOR NO KEY UPDATE`
    const prior = await tx.shodanCompanyProfile.findUnique({ where: { organizationId: ctx.organizationId } })
    if (version === null) {
      if (prior) return null
      return tx.shodanCompanyProfile.create({ data: { organizationId: ctx.organizationId, ...data } })
    }
    if (!prior || prior.updatedAt.getTime() !== version.getTime()) return null
    const changed = await tx.shodanCompanyProfile.updateMany({ where: { organizationId: ctx.organizationId, updatedAt: version }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), prior.updatedAt.getTime() + 1)) } })
    if (changed.count !== 1) return null
    return tx.shodanCompanyProfile.findUnique({ where: { organizationId: ctx.organizationId } })
  })
  if (!profile) return NextResponse.json({ error: '他の操作で設定が更新されました。保存済みの内容を確認してから、もう一度保存してください。', code: 'PROFILE_CONFLICT' }, { status: 409 })
  const logoUrl = profile.logoPath ? await signedUrl(profile.logoPath) : null
  return NextResponse.json({ ok: true, profile: { ...profile, logoUrl } })
}
