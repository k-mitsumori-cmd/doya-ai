export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { signedUrl } from '@/lib/shodan/storage'

const FIELDS = ['companyName', 'url', 'description', 'valueProp', 'products', 'targetCustomer', 'pricingNote', 'caseStudies'] as const

// GET /api/shodan/company-profile — 自社情報の取得（ロゴは署名URLを付与）
export async function GET(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const profile = await prisma.shodanCompanyProfile.findUnique({ where: { organizationId: ctx.organizationId } })
  const logoUrl = profile?.logoPath ? await signedUrl(profile.logoPath) : null
  return NextResponse.json({ profile: profile ? { ...profile, logoUrl } : null }, { headers: { 'Cache-Control': 'no-store' } })
}

// PUT /api/shodan/company-profile — 自社情報の登録/更新（manager+）
export async function PUT(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    const v = body[f]
    data[f] = typeof v === 'string' ? v.trim().slice(0, 4000) || null : null
  }
  // ロゴパス（自前アップロード形式のみ許可）
  const rawLogo = (body.logoPath as string)?.trim()
  data.logoPath = rawLogo && /^shodan\/logos\/[a-z0-9-]+\/[0-9a-fA-F-]{36}\.(png|jpg|webp)$/.test(rawLogo) ? rawLogo : null
  // ブランドカラー（#RRGGBB を最大4色）
  data.brandColors = Array.isArray(body.brandColors)
    ? body.brandColors.filter((c: any) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 4)
    : null

  const profile = await prisma.shodanCompanyProfile.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, ...data },
    update: data,
  })
  const logoUrl = profile.logoPath ? await signedUrl(profile.logoPath) : null
  return NextResponse.json({ ok: true, profile: { ...profile, logoUrl } })
}
