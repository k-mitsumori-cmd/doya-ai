export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/aishodan/organizations — 所属組織一覧＋現在の組織
// POST /api/aishodan/organizations — 初回オンボーディング（組織作成）
import { NextRequest, NextResponse } from 'next/server'
import { getAishodanContext, getOrCreateOrganization, listMemberships, orgSlugFrom, resolveUserId } from '@/lib/aishodan/access'

export async function GET(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const ctx = await getAishodanContext(orgSlugFrom(req))
  const memberships = await listMemberships()
  return NextResponse.json({
    current: ctx ? { slug: ctx.organizationSlug, name: ctx.organizationName, role: ctx.role } : null,
    memberships,
  })
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: '組織名を入力してください' }, { status: 400 })
  const org = await getOrCreateOrganization(userId, name.slice(0, 120), String(body?.memberName || '').trim() || undefined)
  return NextResponse.json({ slug: org.slug, name: org.name })
}
