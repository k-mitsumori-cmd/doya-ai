export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAdIdentity, ownerWhere, GUEST_COOKIE } from '@/lib/adbanner/access'

// GET /api/adbanner/campaigns — 自分のキャンペーン一覧
export async function GET(req: NextRequest) {
  const id = await getAdIdentity(req)
  const where = ownerWhere(id)
  if (!where) return NextResponse.json({ success: true, data: [] }, { headers: { 'Cache-Control': 'no-store' } })
  const rows = await prisma.adBannerCampaign.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, sourceUrl: true, serviceName: true, media: true, createdAt: true, _count: { select: { banners: true } } },
  })
  return NextResponse.json({ success: true, data: rows }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/adbanner/campaigns — キャンペーン作成（ゲストはCookieでguestId付与）
export async function POST(req: NextRequest) {
  let id = await getAdIdentity(req)
  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || (body.serviceName as string)?.trim() || '新規キャンペーン'

  let setGuest: string | null = null
  if (!id.userId && !id.guestId) {
    setGuest = crypto.randomUUID()
    id = { userId: null, guestId: setGuest, plan: 'GUEST' }
  }

  const brandColors = Array.isArray(body.brandColors) ? body.brandColors.filter((c: any) => typeof c === 'string').slice(0, 6) : undefined
  // logoPath はサーバ(/api/adbanner/logo)が発行する形式のみ許可（任意パス指定でのファイル読みを防ぐ多層防御）
  const rawLogo = (body.logoPath as string)?.trim()
  const logoPath = rawLogo && /^adbanner\/logos\/[0-9a-fA-F-]{36}\.(png|jpg|webp)$/.test(rawLogo) ? rawLogo : null

  const campaign = await prisma.adBannerCampaign.create({
    data: {
      userId: id.userId,
      guestId: id.guestId,
      name: name.slice(0, 120),
      sourceUrl: (body.sourceUrl as string)?.trim()?.slice(0, 500) || null,
      serviceName: (body.serviceName as string)?.trim()?.slice(0, 120) || null,
      appeal: (body.appeal as string)?.trim()?.slice(0, 1000) || null,
      brandColors: brandColors as any,
      logoPath,
      media: (body.media as string)?.trim() || 'meta',
    },
  })

  const res = NextResponse.json({ success: true, data: { id: campaign.id } })
  if (setGuest) res.cookies.set(GUEST_COOKIE, setGuest, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
  return res
}
