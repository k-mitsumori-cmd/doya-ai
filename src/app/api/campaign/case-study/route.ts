export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campaign/case-study — 活用事例／ロゴ掲載キャンペーンの申込
//
// 30分ほどの取材と、企業ロゴ・サービスロゴの掲載にご協力いただいた方を6ヶ月無料にする。
// ⚠️ 申込は商談そのもの。取りこぼすと機会損失になるため、
//    「まずDBに保存 → そのあとSlack通知 → 通知が落ちたらアラート」の順を崩さない。
//    （/api/feedback で同じ設計にしてある。通知失敗で黙るのが最悪。）
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postToSlackBlocks } from '@/lib/notifications'
import { notifyAlert } from '@/lib/alert'
import { escapeHtml } from '@/lib/html-escape'
import { privateApiJson } from '@/lib/private-api-response'
import { lockRetirementUser } from '@/lib/account-retirement'
import { CASE_STUDY_CONTEXT_REFRESH, readCaseStudySubmissionContext } from '@/lib/case-study/submission-context'

const MAX = { short: 200, url: 500, note: 2000 }

function clean(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const context = readCaseStudySubmissionContext(body?.submissionContext)
  if (!context) return privateApiJson({ error: CASE_STUDY_CONTEXT_REFRESH, code: 'CONTEXT_REQUIRED' }, { status: 428 })

  let session
  try {
    session = await getServerSession(authOptions)
  } catch {
    return privateApiJson({ error: '利用者を確認できませんでした。時間をおいて再度お試しください。', code: 'CONTEXT_UNAVAILABLE' }, { status: 503 })
  }
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (session && !userId) return privateApiJson({ error: 'ログイン状態を確認できませんでした。再読み込みしてお試しください。', code: 'CONTEXT_INVALID' }, { status: 401 })
  if (context.mode === 'guest' ? Boolean(session) : !userId || userId !== context.userId) {
    return privateApiJson({ error: '利用者が変わりました。再読み込みしてから内容を入力し直してください。', code: 'CONTEXT_CHANGED' }, { status: 409 })
  }

  const companyName = clean(body?.companyName, MAX.short)
  const contactName = clean(body?.contactName, MAX.short)
  const email = clean(body?.email, MAX.short)
  const serviceUrl = clean(body?.serviceUrl, MAX.url)
  const usingService = clean(body?.usingService, MAX.short)
  const preferredAt = clean(body?.preferredAt, MAX.short)
  const note = clean(body?.note, MAX.note)
  const allowLogo = body?.allowLogo !== false
  const allowName = body?.allowName !== false

  if (!companyName || !contactName || !email) {
    return privateApiJson({ error: '会社名・お名前・メールアドレスは必須です' }, { status: 400 })
  }
  // 厳密な検証はしない（弾きすぎる方が損）。形だけ確認する。
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return privateApiJson({ error: 'メールアドレスの形式をご確認ください' }, { status: 400 })
  }
  // ⚠️ ロゴも社名も両方お断りだと、この特典の前提が成り立たない
  if (!allowLogo && !allowName) {
    return privateApiJson(
      { error: 'ロゴまたは社名のいずれかの掲載にご同意いただく必要があります' },
      { status: 400 }
    )
  }

  const application = {
      companyName,
      contactName,
      email,
      serviceUrl: serviceUrl || null,
      usingService: usingService || null,
      preferredAt: preferredAt || null,
      note: note || null,
      allowLogo,
      allowName,
      userId: context.mode === 'user' ? context.userId : null,
  }
  // Genuine guests remain welcome. Authenticated writers serialize with retirement;
  // an expired/deleted account must never be silently reclassified as a guest.
  const saved = context.mode === 'guest'
    ? await prisma.caseStudyApplication.create({ data: application, select: { id: true } })
    : await prisma.$transaction(async tx => {
      if (!await lockRetirementUser(tx, context.userId)) return null
      return tx.caseStudyApplication.create({ data: application, select: { id: true } })
    })
  if (!saved) return privateApiJson({ error: 'このアカウントでは申し込めません。ログイン状態をご確認ください。', code: 'ACCOUNT_UNAVAILABLE' }, { status: 409 })

  const title = '活用事例／ロゴ掲載キャンペーンのお申し込み'
  const lines = [
    `*${title}*`,
    `会社名: ${escapeHtml(companyName)}`,
    `お名前: ${escapeHtml(contactName)}`,
    `メール: ${escapeHtml(email)}`,
    serviceUrl ? `サービスURL: ${escapeHtml(serviceUrl)}` : null,
    usingService ? `ご利用中: ${escapeHtml(usingService)}` : null,
    `掲載可否: ロゴ ${allowLogo ? '可' : '不可'} / 社名 ${allowName ? '可' : '不可'}`,
    preferredAt ? `ご希望の日程: ${escapeHtml(preferredAt)}` : null,
    session?.user?.email ? `ログイン中: ${escapeHtml(session.user.email)}` : 'ログインなしでの申込',
    note ? `\n${escapeHtml(note)}` : null,
  ].filter((l): l is string => l !== null)

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `6ヶ月無料の付与は手動です。取材日程を調整してから反映してください（id: ${saved.id}）` }],
    },
  ]

  let notified = false
  for (let attempt = 0; attempt < 2 && !notified; attempt++) {
    try {
      await postToSlackBlocks(title, blocks)
      notified = true
    } catch (e: any) {
      console.error("[api/campaign/case-study] failed")
    }
  }
  if (!notified) {
    await notifyAlert({
      level: 'critical',
      title: 'キャンペーンの申込が届きましたが Slack 通知に失敗しました',
      context: `内容は保存済み（CaseStudyApplication id: ${saved.id}）`,
      detail: lines.join('\n'),
      dedupKey: `case-study-notify-failed:${saved.id}`,
    }).catch(() => {})
  }

  return privateApiJson({ ok: true, id: saved.id })
}
