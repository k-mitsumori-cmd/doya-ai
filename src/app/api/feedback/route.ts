export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/feedback?service=xxx — 今このサービスで聞いてよいか
// POST /api/feedback             — 改善点・要望を受け取る／あとで／今後は表示しない
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postToSlackBlocks } from '@/lib/notifications'
import { serviceLabelOf } from '@/lib/attribution'
import { escapeHtml } from '@/lib/html-escape'
import {
  markPromptShown,
  optOutPrompt,
  shouldPromptFeedback,
  snoozePrompt,
} from '@/lib/feedback'

async function resolveUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as any)?.id as string | undefined
  if (id) return id
  const email = session?.user?.email
  if (!email) return undefined
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return u?.id
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId()
  // ⚠️ 未ログイン・ゲストには出さない。401ではなく「出さない」で返す
  //    （画面側でエラー表示にしないため）。
  if (!userId) return NextResponse.json({ show: false })

  const serviceId = new URL(req.url).searchParams.get('service') || ''
  const decision = await shouldPromptFeedback(userId, serviceId)
  if (!decision.show) return NextResponse.json({ show: false })

  // 表示した時点で記録する。⚠️ 送信時ではない。
  //    送信されなかった場合にも連続表示を防ぐ必要がある。
  await markPromptShown(userId).catch(() => {})

  return NextResponse.json({
    show: true,
    serviceId,
    serviceLabel: serviceLabelOf(serviceId),
    usageCount: decision.usageCount ?? 0,
  })
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || 'submit')

  if (action === 'snooze') {
    await snoozePrompt(userId)
    return NextResponse.json({ ok: true })
  }
  if (action === 'opt_out') {
    await optOutPrompt(userId)
    return NextResponse.json({ ok: true })
  }

  const serviceId = String(body?.serviceId || '').slice(0, 60)
  const text = String(body?.text || '').trim()
  if (!serviceId) return NextResponse.json({ error: 'サービスが不明です' }, { status: 400 })
  if (!text) return NextResponse.json({ error: '内容をご記入ください' }, { status: 400 })

  const ratingRaw = Number(body?.rating)
  const rating = Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : null

  const saved = await prisma.serviceFeedback.create({
    data: {
      userId,
      serviceId,
      rating,
      text: text.slice(0, 4000),
      usageCount: Number.isFinite(Number(body?.usageCount)) ? Math.max(0, Math.round(Number(body.usageCount))) : 0,
    },
    select: { id: true },
  })

  // 送ってもらった以上、開発に反映するのが目的。届いたことが分かる形にする。
  // ⚠️ 通知の失敗で保存を巻き戻さない（書いてもらった内容を失う方が損失が大きい）。
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    const lines = [
      `*ご意見が届きました*（${serviceLabelOf(serviceId)}）`,
      rating ? `満足度: ${'●'.repeat(rating)}${'○'.repeat(5 - rating)}（${rating}/5）` : '満足度: 未回答',
      `利用回数: ${body?.usageCount ?? '不明'}回目`,
      `送信者: ${user?.name || user?.email || '不明'}`,
      '',
      // ⚠️ 利用者の入力をSlackのmrkdwnへ入れる。整形記号を効かせない
      escapeHtml(text).slice(0, 1500),
    ]
    await postToSlackBlocks('ご意見が届きました', [
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    ])
  } catch {
    /* 通知に失敗しても保存は成立している */
  }

  return NextResponse.json({ ok: true, id: saved.id })
}
