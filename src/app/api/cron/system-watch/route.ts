import { NextResponse } from 'next/server'
import { freeChecks } from '@/lib/system-watch/checks'
import { runWatch } from '@/lib/system-watch/run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================
// ドヤAIの常時確認（有料の API を使わない分・10分ごと）
// 画面・API・DB・台帳・cron・外部サービス・設定・旗を読むだけで確かめ、
// 失敗したら何がどう失敗したかを Slack の共通の送り口で知らせる。同じ失敗は間引き、直ったら知らせる。
// 認証: Authorization: Bearer ${CRON_SECRET}。?dry=1 は状態を書かず Slack にも送らない（手動の試し用）。
// ============================================
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const report = await runWatch('free', freeChecks(), { dry })
  // ⚠️ console.error にしない。runtime-alert.ts が console.error を拾って「アプリまたはサーバーの処理でエラー」を Slack に送るため、
  //    詳しい通知（runWatch が送る）と二重になる（2026-10-26 本番で、分かっている設定の不足が汎用のエラー通知として出た）
  if (report.failed.length) console.warn('[system-watch] failed', JSON.stringify(report.failed.map(f => ({ id: f.id, status: f.status }))))
  return NextResponse.json({
    ok: report.failed.length === 0,
    dry,
    checkedAt: report.checkedAt,
    total: report.total,
    failed: report.failed.map(f => ({ id: f.id, label: f.label, url: f.url, status: f.status, error: f.error, detail: f.detail })),
    events: report.events.map(e => ({ type: e.type, id: e.result.id })),
    sent: report.sent,
  })
}
