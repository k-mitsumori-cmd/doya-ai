export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { postPlainToSlack } from '@/lib/notifications'
import { notifyAlert } from '@/lib/alert'
import { serviceLabelOf } from '@/lib/attribution'

/**
 * 問い合わせ・ご意見の受信件数レポート（毎週月曜 JST 9:05）
 *
 * なぜ必要か（2026-08 の不具合）:
 *   サイドバーの問い合わせフォームが API とキー不一致で 400 を返し続け、
 *   12日間ぶんの問い合わせが保存も通知もされないまま消えた。
 *   失敗は利用者の画面にしか出ないため、運営側には**何の痕跡も残らなかった**。
 *   保存0件が「誰も送っていない」のか「全部弾かれている」のか判別できない状態が
 *   一番危ない。だから **0件のときこそ必ず送る**。沈黙を許さないための定点観測。
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 * 手動実行: ?days=30 で対象期間を変更できる
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const days = Number(new URL(request.url).searchParams.get('days')) || 7
    const since = new Date(Date.now() - days * 86400_000)

    const [recent, total, lastOne] = await Promise.all([
      prisma.serviceFeedback.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, serviceId: true, rating: true, text: true },
      }),
      prisma.serviceFeedback.count(),
      prisma.serviceFeedback.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    const byService = new Map<string, number>()
    for (const r of recent) byService.set(r.serviceId, (byService.get(r.serviceId) || 0) + 1)

    const jstDateTime = (d: Date) => d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const daysSinceLast = lastOne
      ? Math.floor((Date.now() - lastOne.createdAt.getTime()) / 86400_000)
      : null

    const lines: string[] = []
    lines.push(`:inbox_tray: *[お問い合わせ受信レポート/直近${days}日]* ${jstDateTime(new Date())}`)
    lines.push('')
    lines.push(`*受信件数: ${recent.length}件*（累計 ${total}件）`)

    if (recent.length > 0) {
      lines.push('')
      lines.push('*サービス別*')
      for (const [serviceId, count] of [...byService.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`・${serviceLabelOf(serviceId)}: ${count}件`)
      }
      lines.push('')
      lines.push('*直近の内容*')
      for (const r of recent.slice(0, 5)) {
        const head = String(r.text).replace(/\n/g, ' ').slice(0, 60)
        lines.push(`・${jstDateTime(r.createdAt)} ｜ ${serviceLabelOf(r.serviceId)} ｜ ${head}…`)
      }
    } else {
      lines.push('・この期間の受信はありません。')
      lines.push(
        lastOne
          ? `・最後に受信したのは ${jstDateTime(lastOne.createdAt)}（${daysSinceLast}日前）です。`
          : '・これまで一度も受信がありません。'
      )
      lines.push('・フォームが壊れていないか、サイドバーの「お問い合わせ・改善依頼」から1件テスト送信して確認できます。')
    }

    await postPlainToSlack(lines.join('\n'))

    // ⚠️ 「ずっと0件」は壊れているときと見分けがつかない。長期の沈黙は異常として扱う。
    //    （2026-08 の不具合は12日間気づかれなかった）
    if (daysSinceLast !== null && daysSinceLast >= 30) {
      await notifyAlert({
        level: 'warn',
        title: `お問い合わせが ${daysSinceLast}日間 1件も届いていません`,
        context: 'フォームの受け口が壊れている可能性があります（2026-08 に12日間の不達が発生）',
        detail: `最終受信: ${jstDateTime(lastOne!.createdAt)}`,
        dedupKey: 'feedback-silence',
        cooldownMs: 7 * 24 * 3600_000,
      })
    }

    return NextResponse.json({ ok: true, days, received: recent.length, total, daysSinceLast })
  } catch (error: any) {
    console.error('[Cron] feedback-report error:', error)
    await notifyAlert({
      level: 'critical',
      title: 'お問い合わせ受信レポートcronが失敗しました',
      detail: String(error?.message || error),
      dedupKey: 'feedback-report-failed',
    }).catch(() => {})
    return NextResponse.json({ error: error?.message || 'failed' }, { status: 500 })
  }
}
