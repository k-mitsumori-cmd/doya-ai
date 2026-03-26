import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: ダッシュボード KPI とチャートデータ
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') === '30d' ? 30 : 7

    const since = new Date()
    since.setDate(since.getDate() - range)

    // 期間内のログ集計
    const logs = await prisma.dripEmailLog.findMany({
      where: { sentAt: { gte: since } },
      select: {
        id: true,
        status: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        sequenceId: true,
      },
    })

    const totalSent = logs.length
    const opened = logs.filter((l) => l.openedAt !== null).length
    const clicked = logs.filter((l) => l.clickedAt !== null).length
    const bounced = logs.filter((l) => l.bouncedAt !== null).length

    const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 10000) / 100 : 0
    const clickRate = totalSent > 0 ? Math.round((clicked / totalSent) * 10000) / 100 : 0
    const bounceRate = totalSent > 0 ? Math.round((bounced / totalSent) * 10000) / 100 : 0

    // 日別チャートデータ
    const chartMap: Record<string, { sent: number; opened: number; clicked: number; bounced: number }> = {}
    for (let i = 0; i < range; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (range - 1 - i))
      const key = d.toISOString().split('T')[0]
      chartMap[key] = { sent: 0, opened: 0, clicked: 0, bounced: 0 }
    }

    for (const log of logs) {
      const key = log.sentAt ? new Date(log.sentAt).toISOString().split('T')[0] : null
      if (key && chartMap[key]) {
        chartMap[key].sent++
        if (log.openedAt) chartMap[key].opened++
        if (log.clickedAt) chartMap[key].clicked++
        if (log.bouncedAt) chartMap[key].bounced++
      }
    }

    const chartData = Object.entries(chartMap).map(([date, data]) => ({
      date,
      ...data,
    }))

    // シーケンス別パフォーマンス
    const sequenceMap: Record<string, { name: string; sent: number; opened: number; clicked: number }> = {}
    const sequenceIds = [...new Set(logs.map((l) => l.sequenceId).filter(Boolean))] as string[]

    if (sequenceIds.length > 0) {
      const sequences = await prisma.dripSequence.findMany({
        where: { id: { in: sequenceIds } },
        select: { id: true, name: true },
      })

      for (const seq of sequences) {
        sequenceMap[seq.id] = { name: seq.name, sent: 0, opened: 0, clicked: 0 }
      }

      for (const log of logs) {
        if (log.sequenceId && sequenceMap[log.sequenceId]) {
          sequenceMap[log.sequenceId].sent++
          if (log.openedAt) sequenceMap[log.sequenceId].opened++
          if (log.clickedAt) sequenceMap[log.sequenceId].clicked++
        }
      }
    }

    const sequencePerformance = Object.entries(sequenceMap).map(([id, data]) => ({
      sequenceId: id,
      name: data.name,
      sent: data.sent,
      opened: data.opened,
      clicked: data.clicked,
      openRate: data.sent > 0 ? Math.round((data.opened / data.sent) * 10000) / 100 : 0,
      clickRate: data.sent > 0 ? Math.round((data.clicked / data.sent) * 10000) / 100 : 0,
    }))

    return NextResponse.json({
      totalSent,
      openRate,
      clickRate,
      bounceRate,
      chartData,
      sequencePerformance,
    })
  } catch (error) {
    console.error('[Drip] Dashboard error:', error)
    return NextResponse.json({ error: 'ダッシュボードデータの取得に失敗しました' }, { status: 500 })
  }
}
