export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/sessions — 面接一覧（F5-3）
// POST /api/mensetsu/sessions — ワンタイム面接URLを発行（F5-2）
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'

/** 推測不能なワンタイムトークン（URLに載るため base64url） */
function newToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function GET(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const status = new URL(req.url).searchParams.get('status') || undefined

  const sessions = await prisma.mensetsuSession.findMany({
    where: { organizationId: ctx.organizationId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      token: true,
      candidateName: true,
      candidateEmail: true,
      status: true,
      verdict: true,
      expiresAt: true,
      startedAt: true,
      endedAt: true,
      evaluatedAt: true,
      createdAt: true,
      template: { select: { id: true, name: true, jobTitle: true, durationMin: true } },
    },
  })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const templateId = String(body?.templateId || '').trim()
  const candidateName = String(body?.candidateName || '').trim() || null
  const candidateEmail = String(body?.candidateEmail || '').trim() || null
  const validDays = Number.isFinite(Number(body?.validDays)) ? Number(body.validDays) : 14

  if (!templateId) return NextResponse.json({ error: 'テンプレートを選んでください' }, { status: 400 })

  const template = await prisma.mensetsuTemplate.findFirst({
    where: { id: templateId, organizationId: ctx.organizationId },
    include: { _count: { select: { questions: true, criteria: true } } },
  })
  if (!template) return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
  if (template._count.questions === 0) {
    return NextResponse.json({ error: '質問が1問もないテンプレートでは面接を発行できません' }, { status: 400 })
  }

  const org = await prisma.mensetsuOrganization.findUnique({
    where: { id: ctx.organizationId },
    select: { retentionDays: true },
  })

  const expiresAt = new Date(Date.now() + Math.max(1, validDays) * 24 * 60 * 60 * 1000)
  // ⚠️ 保持期限は「面接を実施した時点」から数える。
  //    発行時点から数えると、retentionDays が短い組織では応募者が面接を受ける前や
  //    受けた直後に削除が走り、逐語ログごと消えて評価できなくなる。
  //    ここでは仮に expiresAt を起点に置き、実際の開始時（/token）で貼り直す。
  const purgeAfter = new Date(
    expiresAt.getTime() + Math.max(1, org?.retentionDays ?? 180) * 24 * 60 * 60 * 1000
  )

  const session = await prisma.mensetsuSession.create({
    data: {
      organizationId: ctx.organizationId,
      templateId,
      token: newToken(),
      candidateName,
      candidateEmail,
      expiresAt,
      purgeAfter,
      status: 'pending',
    },
    select: { id: true, token: true, expiresAt: true, candidateName: true },
  })

  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  return NextResponse.json({
    session,
    // ⚠️ メール等の外部向けURLに VERCEL_URL を使わないこと（デプロイ保護で弾かれる）
    url: `${base}/mensetsu/live/${session.token}`,
  })
}
