export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/mensetsu/sessions/[id] — 評価レポート・逐語ログ（採用担当者向け）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { weightedAverage } from '@/lib/mensetsu/evaluate'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // id だけで他組織の面接に到達させない（二重条件）
  const session = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    include: {
      template: {
        include: {
          questions: { orderBy: { ord: 'asc' } },
          criteria: { orderBy: { ord: 'asc' } },
        },
      },
      turns: { orderBy: { ord: 'asc' } },
      scores: { include: { criterion: true } },
    },
  })
  if (!session) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const average = weightedAverage(
    session.scores.map((s) => ({
      criterionKey: s.criterion.key,
      score: s.score,
      insufficient: s.insufficient,
      rationale: s.rationale || '',
      quotes: s.quotes,
    })),
    session.template.criteria.map((c2) => ({ key: c2.key, weight: c2.weight }))
  )

  return NextResponse.json({ session, average })
}

// PATCH /api/mensetsu/sessions/[id] — 応募者情報の修正
//
// ⚠️ ご本人確認用のメールアドレスは打ち間違えうる。直せる導線が無いと、
//    誤った宛先を登録した面接は応募者が「一致しません」から永久に進めず、
//    面接を発行し直すしかなくなる。空にすれば確認自体を外せる。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // ⚠️ 同階層の変更系ルートと揃える。応募者の本人確認の設定を書き換える操作なので、
  //    他の担当者が発行した面接を member が勝手に緩められる状態にしない。
  if (!hasMinRole(c.role, 'manager')) {
    return NextResponse.json({ error: '変更する権限がありません' }, { status: 403 })
  }

  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    select: { id: true, startedAt: true, status: true, consentedAt: true, candidateEmail: true },
  })
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  // ⚠️ 面接が始まったあとに宛先を差し替えない（同意の記録との整合が崩れる）
  if (s.startedAt) {
    return NextResponse.json({ error: '面接が始まっているため変更できません。' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const data: {
    candidateName?: string | null
    candidateEmail?: string | null
    consentAttempts?: number
    status?: string
    consentedAt?: Date | null
  } = {}

  if (typeof body?.candidateName === 'string') {
    data.candidateName = body.candidateName.trim() || null
  }
  if (typeof body?.candidateEmail === 'string') {
    const email = body.candidateEmail.trim()
    if (email && !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'メールアドレスの形式をご確認ください' }, { status: 400 })
    }
    data.candidateEmail = email || null
    // 打ち間違いで積み上がった失敗回数を持ち越さない
    data.consentAttempts = 0

    // ------------------------------------------------------------------
    // 同意済みの面接は、同意そのものをやり直させる
    // ------------------------------------------------------------------
    // ⚠️ 照合は consent の1回しか走らない。同意済み(consented)の面接は
    //    startedAt が null なのでこの PATCH は通るが、応募者側は
    //    「同意済み＝機器チェックへ」と分岐するため同意画面が再表示されず、
    //    変更した宛先での照合が**一度も実行されない**。
    //    「URLが転送された疑いがあるので宛先を設定して締める」という
    //    まさにこの操作が、成功表示だけ出して実際には何も守らなかった。
    //    宛先が実際に変わったときは同意を取り消し、もう一度通してもらう。
    const changed = (data.candidateEmail || '') !== (s.candidateEmail || '')
    if (changed && s.consentedAt) {
      data.status = 'pending'
      data.consentedAt = null
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '変更する内容がありません' }, { status: 400 })
  }

  const session = await prisma.mensetsuSession.update({
    where: { id: s.id },
    data,
    select: { id: true, candidateName: true, candidateEmail: true, status: true },
  })
  return NextResponse.json({ session, reconsentRequired: data.consentedAt === null })
}
