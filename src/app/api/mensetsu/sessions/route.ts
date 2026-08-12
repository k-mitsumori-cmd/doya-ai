export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/sessions — 面接一覧（F5-3）
// POST /api/mensetsu/sessions — ワンタイム面接URLを発行（F5-2）
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html-escape'
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
  const quota = await assertFreeLimit('mensetsuSessions', () =>
    prisma.mensetsuSession.count({ where: { organizationId: ctx.organizationId } })
  )
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 402 })

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

  // ⚠️ メール等の外部向けURLに VERCEL_URL を使わないこと（デプロイ保護で弾かれる）
  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const url = `${base}/mensetsu/live/${session.token}`

  // ------------------------------------------------------------------
  // 面接のご案内メール
  // ------------------------------------------------------------------
  // ⚠️ 担当者が明示的に「送る」を選んだときだけ送信する。発行のたびに自動送信しない
  //    （下書きのつもりで発行した面接が応募者に届いてしまう）。
  let emailSent: boolean | null = null
  if (candidateEmail && body?.sendEmail === true) {
    const org = await prisma.mensetsuOrganization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true },
    })
    const orgName = org?.name || ''
    const mail = await sendEmail({
      to: candidateEmail,
      subject: `【${orgName}】一次面接（${template.jobTitle}）のご案内`,
      html: `
      <div style="font-family:sans-serif;line-height:1.8;color:#0a0f3c">
        <p>${escapeHtml(candidateName || '')}様</p>
        <p>${escapeHtml(orgName)} の ${escapeHtml(template.jobTitle)} にご応募いただき、ありがとうございます。</p>
        <p>一次面接のご案内です。下のリンクをお開きください。</p>
        <p><a href="${escapeHtml(url)}" style="color:#0066ff">${escapeHtml(url)}</a></p>
        <ul style="color:#425071;font-size:14px">
          <li>所要時間は約${template.durationMin}分です。</li>
          <li>この面接はAIが面接官として実施します。</li>
          <li>静かな場所で、マイクをお使いいただける環境からご受験ください。</li>
          <li>${escapeHtml(expiresAt.toLocaleDateString('ja-JP'))} まで有効です。</li>
        </ul>
        <p style="color:#8a94ad;font-size:13px">
          このリンクはご本人専用です。他の方に転送しないでください。<br>
          お心当たりがない場合は破棄してください。
        </p>
      </div>`,
    })
    emailSent = mail.success
  }

  return NextResponse.json({ session, url, emailSent })
}
