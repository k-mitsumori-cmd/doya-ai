export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/mensetsu/sessions/[id]/invite — 発行済みの面接のご案内メールを送る
//
// 面接のお渡し方は2通りあり、どちらでも進められるようにしてある。
//   1. ご案内メールを送る（このルート。開始前にご本人確認が入る）
//   2. 面接URLをそのままお渡しする（一覧の「URLをコピー」）
// ⚠️ 発行時に送りそびれた・宛先を間違えた・応募者がメールを紛失した、は普通に起きる。
//    発行の瞬間しか送れないと、面接をもう一度発行し直すしかなくなる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { interviewUrl, sendInviteMail } from '@/lib/mensetsu/invite-mail'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // ⚠️ id だけで引かない。必ず organizationId との二重条件で絞る
  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: {
      id: true,
      token: true,
      candidateName: true,
      candidateEmail: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      template: { select: { jobTitle: true, durationMin: true } },
    },
  })
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  if (s.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'この面接URLは有効期限が切れています。新しく発行してください。' },
      { status: 400 }
    )
  }
  if (s.status === 'completed' || s.status === 'evaluated') {
    return NextResponse.json({ error: 'この面接は既に終了しています。' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const input = String(body?.candidateEmail || '').trim()

  // 宛先の決定。
  // ⚠️ 面接が始まったあとに宛先を差し替えられると、同意の記録と本人確認の
  //    整合が崩れる。開始後は登録済みの宛先にしか送らない。
  let to = s.candidateEmail
  if (input) {
    if (!EMAIL_PATTERN.test(input)) {
      return NextResponse.json({ error: 'メールアドレスの形式をご確認ください' }, { status: 400 })
    }
    if (s.startedAt && input.toLowerCase() !== (s.candidateEmail || '').toLowerCase()) {
      return NextResponse.json(
        { error: '面接が始まっているため、宛先は変更できません。' },
        { status: 409 }
      )
    }
    to = input
  }
  if (!to) {
    return NextResponse.json({ error: '送り先のメールアドレスを入力してください' }, { status: 400 })
  }

  const org = await prisma.mensetsuOrganization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true },
  })

  const url = interviewUrl(s.token)
  const sent = await sendInviteMail({
    to,
    candidateName: s.candidateName,
    organizationName: org?.name || '',
    jobTitle: s.template.jobTitle,
    durationMin: s.template.durationMin,
    expiresAt: s.expiresAt,
    url,
  })

  // ⚠️ 送信できたときだけ宛先を保存する。届いていない宛先で本人確認を有効にすると、
  //    応募者が「一致しません」から先へ進めなくなる。
  if (sent && to !== s.candidateEmail) {
    await prisma.mensetsuSession.update({
      where: { id: s.id },
      data: { candidateEmail: to, consentAttempts: 0 },
    })
  }

  // 送信に失敗しても URL は返す。手でお渡しすれば面接は進められる
  return NextResponse.json({ emailSent: sent, url })
}
