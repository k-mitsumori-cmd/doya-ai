export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/organizations — 所属組織一覧＋現在の組織
// POST /api/mensetsu/organizations — 組織作成（オンボーディング）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getMensetsuContext,
  getOrCreateOrganization,
  listMemberships,
  orgSlugFrom,
  resolveUserId,
} from '@/lib/mensetsu/access'

export async function GET(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const ctx = await getMensetsuContext(orgSlugFrom(req))
  const memberships = await listMemberships()

  if (!ctx) return NextResponse.json({ current: null, memberships })

  const org = await prisma.mensetsuOrganization.findUnique({
    where: { id: ctx.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      recordVideo: true,
      retentionDays: true,
      discloseToCandidate: true,
    },
  })

  return NextResponse.json({
    current: { ...org, role: ctx.role },
    memberships,
  })
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: '組織名を入力してください' }, { status: 400 })

  const org = await getOrCreateOrganization(userId, name, body?.memberName)
  return NextResponse.json({ organization: { id: org.id, name: org.name, slug: org.slug } })
}
