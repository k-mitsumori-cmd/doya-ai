export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/feedback?service=xxx — 今このサービスで聞いてよいか
// POST /api/feedback             — 改善点・要望を受け取る／あとで／今後は表示しない
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postToSlackBlocks } from '@/lib/notifications'
import { notifyAlert } from '@/lib/alert'
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

  // ------------------------------------------------------------------
  // 送信元は2つある。**どちらのキー名も受け取ること。**
  // ------------------------------------------------------------------
  //  A) 利用後アンケート  FeedbackPrompt.tsx      → { serviceId, text, rating, usageCount }
  //  B) サイドバーの問い合わせ SidebarHelpContact.tsx → { service, message, category, page }
  //
  // ⚠️ かつて A のキーしか読んでいなかったため、B は常に 400「サービスが不明です」で弾かれ、
  //    全21サービスのサイドバーに置いた「お問い合わせ・改善依頼」が
  //    **一度も運営に届いていなかった**（ServiceFeedback 0件で確認）。
  //    フォームを増やすときは、必ずここで受け口を合わせること。
  const serviceId = String(body?.serviceId || body?.service || '').slice(0, 60)
  const text = String(body?.text || body?.message || '').trim()
  const category = String(body?.category || '').slice(0, 40)
  const page = String(body?.page || '').slice(0, 200)
  // ------------------------------------------------------------------
  // 受け口が合っていない送信を検知する
  // ------------------------------------------------------------------
  // ⚠️ 2026-08-11〜08-22 の12日間、サイドバーの問い合わせが 400 で弾かれ続けたのに
  //    運営側には何の痕跡も残らなかった（失敗は利用者の画面にしか出ない）。
  //    「本文は書かれているのに、こちらが読めるキーで届いていない」＝実装のズレなので、
  //    利用者の入力ミスと区別して必ず通知する。0件が正常か異常か分からない状態にしない。
  const looksLikeUnknownForm =
    !serviceId && Object.keys(body || {}).some((k) => !['action', 'serviceId', 'service'].includes(k))
  if (looksLikeUnknownForm) {
    notifyAlert({
      level: 'critical',
      title: 'お問い合わせフォームの送信が受け取れていません（キー不一致の可能性）',
      context: '利用者には「送信に失敗しました」と表示され、内容は保存も通知もされていません',
      detail: `受信したキー: ${Object.keys(body || {}).join(', ') || '(なし)'}`,
      dedupKey: 'feedback-payload-mismatch',
      cooldownMs: 6 * 3600_000,
    }).catch(() => {})
  }

  if (!serviceId) return NextResponse.json({ error: 'サービスが不明です' }, { status: 400 })
  if (!text) return NextResponse.json({ error: '内容をご記入ください' }, { status: 400 })

  // 種別・発生画面は保存列が無いので本文の先頭に残す（後から辿れるようにする）
  const CATEGORY_LABELS: Record<string, string> = {
    improvement: '改善したほうがいいこと',
    feature: '追加の機能要望',
    bug: 'エラー報告',
    other: 'その他',
  }
  const categoryLabel = category ? CATEGORY_LABELS[category] || category : ''
  const storedText = [
    categoryLabel ? `【${categoryLabel}】` : '',
    page ? `（${page}）` : '',
    categoryLabel || page ? '\n' : '',
    text,
  ].join('')

  const ratingRaw = Number(body?.rating)
  const rating = Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : null

  const saved = await prisma.serviceFeedback.create({
    data: {
      userId,
      serviceId,
      rating,
      text: storedText.slice(0, 4000),
      usageCount: Number.isFinite(Number(body?.usageCount)) ? Math.max(0, Math.round(Number(body.usageCount))) : 0,
    },
    select: { id: true },
  })

  // ------------------------------------------------------------------
  // 届いたら**必ず** Slack に出す
  // ------------------------------------------------------------------
  // ⚠️ 以前はここが `catch {}` で、Slack への送信が失敗すると
  //    保存はされているのに誰にも知らされないまま終わっていた。
  //    通知の失敗で保存を巻き戻さないのは正しいが、**黙るのは駄目**。
  //    1回リトライし、それでも駄目ならアラート経路（別 webhook 解決）へ回して、
  //    最低限「問い合わせが届いたが通知できなかった」ことは必ず残す。
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { email: true, name: true } })
    .catch(() => null)
  const title = categoryLabel ? `お問い合わせが届きました（${categoryLabel}）` : 'ご意見が届きました'
  const lines = [
    `*${title}*（${serviceLabelOf(serviceId)}）`,
    rating ? `満足度: ${'●'.repeat(rating)}${'○'.repeat(5 - rating)}（${rating}/5）` : null,
    page ? `画面: ${page}` : null,
    `送信者: ${user?.name || user?.email || '不明'}`,
    '',
    // ⚠️ 利用者の入力をSlackのmrkdwnへ入れる。整形記号を効かせない
    escapeHtml(text).slice(0, 1500),
  ].filter((l): l is string => l !== null)
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } }]

  let notified = false
  for (let attempt = 0; attempt < 2 && !notified; attempt++) {
    try {
      await postToSlackBlocks(title, blocks)
      notified = true
    } catch (e: any) {
      console.error(`[Feedback] Slack通知に失敗 (${attempt + 1}/2):`, e?.message)
    }
  }
  if (!notified) {
    await notifyAlert({
      level: 'critical',
      title: 'お問い合わせが届きましたが Slack 通知に失敗しました',
      context: `内容は保存済み（ServiceFeedback id: ${saved.id}）。管理画面から確認してください`,
      detail: lines.join('\n'),
      dedupKey: `feedback-notify-failed:${saved.id}`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, id: saved.id })
}
