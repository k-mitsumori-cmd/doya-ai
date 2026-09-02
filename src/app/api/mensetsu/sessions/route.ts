export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/sessions — 面接一覧（F5-3）
// POST /api/mensetsu/sessions — ワンタイム面接URLを発行（F5-2）
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { interviewUrl } from '@/lib/mensetsu/interview-url'
import { assertFreeLimit } from '@/lib/plan-limit'
import { recordServiceUsage } from '@/lib/service-usage'
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

  // 無料枠の上限（services.ts の宣言を実際に効かせる）
  // ⚠️ 面接1件ごとに Realtime の通話料が発生する。有料プランにも月次の上限が要る
  const quota = await assertFreeLimit(
    'mensetsuSessions',
    () => prisma.mensetsuSession.count({ where: { organizationId: ctx.organizationId } }),
    undefined,
    (since) =>
      prisma.mensetsuSession.count({
        where: { organizationId: ctx.organizationId, createdAt: { gte: since } },
      })
  )
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 402 })

  const body = await req.json().catch(() => ({}))
  const templateId = String(body?.templateId || '').trim()
  const candidateName = String(body?.candidateName || '').trim() || null
  const candidateEmail = String(body?.candidateEmail || '').trim() || null
  // ⚠️ 発行時にも形式を見ること。ここを素通しにすると打ち間違えた宛先で
  //    ご本人確認が有効になり、応募者は正しいアドレスを入れても一致せず、
  //    10回で 429 になって受験できなくなる（PATCH で直すまで復旧しない）。
  if (candidateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
    return NextResponse.json({ error: 'メールアドレスの形式をご確認ください' }, { status: 400 })
  }
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
  // 保持期限の起点は「発行時」。面接が実施されたら /token で実施日起点に貼り直す。
  // ⚠️ 発行時を expiresAt 起点にすると、一度も受験されなかったセッションの
  //    氏名・メール・同意IPが、告知した保持期間より最大 validDays 分長く残る。
  //    受験されなかった面接に「実施日」は無いので、発行時から数えるのが正しい。
  //    受験中に消える心配は、開始時の貼り直しで解消済み。
  const purgeAfter = new Date(
    Date.now() + Math.max(1, org?.retentionDays ?? 180) * 24 * 60 * 60 * 1000
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

  void recordServiceUsage({
    userId: ctx.userId,
    serviceId: 'mensetsu',
    action: '面接URLを発行',
    summary: `${template.jobTitle}${session.candidateName ? ` / ${session.candidateName}` : ''}`,
  })

  // 面接のお渡し方はURLの手渡しのみ。
  // ⚠️ ご案内メールの送信は廃止した（「届いていない」の切り分けに担当者と応募者の
  //    双方が時間を取られ、面接そのものが進まなくなるため）。
  //    candidateEmail は送信用ではなく、開始前のご本人確認に使う。
  return NextResponse.json({ session, url: interviewUrl(session.token) })
}
