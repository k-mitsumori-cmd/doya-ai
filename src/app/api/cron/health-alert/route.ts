import { observeServiceHealth } from '@/lib/service-operations-monitor';
import { NextRequest, NextResponse } from 'next/server'
import { notifyAlert } from '@/lib/alert'
import { readOps, writeOps } from '@/lib/service-operations-state'
import { prisma } from '@/lib/prisma'
import { bodySnippet, describeFetchError, formatHealthFailure, nextStreak, type FailureStreak } from '@/lib/health-check-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 相互ヘルスチェック（Vercel Cron・5分毎）。稼働中の8サービスの
 * 公開 /api/health を外形監視し、応答遅延・依存(DB)障害・到達不可(ダウン)を Slack 通知。
 * 09_Cursol と noroi が相互に相手を叩くことで、片方が完全ダウンしても他方が検知できる。
 * 認証: Authorization: Bearer ${CRON_SECRET}。
 */

const LATENCY_WARN_MS = Math.max(500, Number(process.env.HEALTH_LATENCY_WARN_MS) || 4000)
const FETCH_TIMEOUT_MS = 15_000

type Target = { name: string; url: string; key: string; webhookUrl?: string }

const TARGETS: Target[] = [
  {
    name: 'ドヤAI',
    url: process.env.SELF_HEALTH_URL || 'https://doya-ai.surisuta.jp/api/health',
    key: 'doyaai',
  },
  {
    name: '呪い日記',
    url: process.env.NOROI_HEALTH_URL || 'https://game.surisuta.jp/noroi/api/health',
    key: 'noroi',
    webhookUrl: process.env.SLACK_APPSTORE_WEBHOOK_URL,
  },
  {
    name: 'ゆるせん',
    url: process.env.YURUSEN_HEALTH_URL || 'https://game.surisuta.jp/yurusen/api/health',
    key: 'yurusen',
    webhookUrl: process.env.SLACK_YURUSEN_APPSTORE_WEBHOOK_URL,
  },
  { name: '推しにマイル', key: 'oshi-mile', url: 'https://game.surisuta.jp/oshimile/api/health', webhookUrl: process.env.SLACK_OSHI_ERROR_WEBHOOK_URL },
  { name: 'ヒトリジメ', key: 'hitorijime', url: 'https://game.surisuta.jp/hitorijime', webhookUrl: process.env.SLACK_HITORIJIME_ERROR_WEBHOOK_URL },
  { name: '旅行ツール', key: 'travel-tools', url: 'https://mitsumoritravel.surisuta.jp', webhookUrl: process.env.SLACK_TRAVEL_ERROR_WEBHOOK_URL },
  { name: 'X投稿管理', key: 'x-worker', url: 'https://x-harness-worker.k-mitsumori.workers.dev/api/health' },
  { name: 'LINE配信管理', key: 'line-worker', url: 'https://line-crm-worker.k-mitsumori.workers.dev/docs' },
]

type CheckResult = { name: string; ok: boolean; rtt: number; status?: number; error?: string; failures?: number }

/** 連続した失敗の回数を DB に残す（インスタンスをまたいでも数えられるように）。DB 障害でも監視は止めない。 */
async function updateStreak(key: string, failed: boolean): Promise<FailureStreak | null> {
  const previous = await readOps<FailureStreak>('health-fail:' + key).catch(() => null)
  const next = nextStreak(previous, failed, new Date().toISOString())
  if (next || (previous && previous.count > 0)) await writeOps('health-fail:' + key, next ?? { count: 0, since: '' }).catch(() => {})
  return next
}

async function checkTarget(t: Target): Promise<CheckResult> {
  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(t.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' })
  } catch (e) {
    // 「接続できない」だけで終わらせず、タイムアウト・DNS・接続拒否・証明書のどれかを書く
    const error = describeFetchError(e, FETCH_TIMEOUT_MS)
    const streak = await updateStreak(t.key, true)
    await notifyAlert({
      systemName: t.name,
      webhookUrl: t.webhookUrl,
      level: 'critical',
      title: `到達不可（ダウンの可能性）`,
      context: t.url,
      detail: `公開URLに接続できませんでした。\n${formatHealthFailure({ url: t.url, at: new Date().toISOString(), rttMs: Date.now() - startedAt, error, streak, intervalMinutes: 5 })}`,
      dedupKey: `health-down-${t.key}`,
      cooldownMs: 10 * 60_000,
    })
    await observeServiceHealth(t.key, t.name, false).catch(() => {});
    return { name: t.name, ok: false, rtt: Date.now() - startedAt, error, failures: streak?.count }
  }
  const rtt = Date.now() - startedAt

  if (!res.ok) {
    // 本文の先頭（/api/health なら DB の状態など）を通知に載せる
    const body = bodySnippet(await res.text().catch(() => ''))
    const streak = await updateStreak(t.key, true)
    await notifyAlert({
      systemName: t.name,
      webhookUrl: t.webhookUrl,
      level: 'critical',
      title: `ヘルスチェック異常（HTTP ${res.status}）`,
      context: t.url,
      detail: `公開URLが正常でない応答を返しました。対象のサーバーとデプロイ状況を確認してください。\n${formatHealthFailure({ url: t.url, at: new Date().toISOString(), status: res.status, rttMs: rtt, body, streak, intervalMinutes: 5 })}`,
      dedupKey: `health-status-${t.key}`,
      cooldownMs: 10 * 60_000,
    })
    await observeServiceHealth(t.key, t.name, false).catch(() => {});
    return { name: t.name, ok: false, rtt, status: res.status, error: body ? `HTTP ${res.status}: ${body}` : `HTTP ${res.status}`, failures: streak?.count }
  }
  await res.body?.cancel().catch(() => {})
  await updateStreak(t.key, false)

  if (rtt > LATENCY_WARN_MS) {
    // 単発のコールドスタートで誤検知しないよう、遅い時は一度だけ再測定する
    // （1回目で関数が温まるため、恒常的な遅延でなければ2回目は速い）。
    // 2回目も閾値超過のときだけ「本当の遅延」として通知する。
    let rtt2 = rtt
    try {
      const s2 = Date.now()
      const res2 = await fetch(t.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' })
      await res2.body?.cancel().catch(() => {})
      if (res2.ok) rtt2 = Date.now() - s2 // 2回目が異常応答なら1回目の値で判断
    } catch {
      /* 再測定失敗時は1回目の値で判断（下の閾値比較へ） */
    }
    if (rtt2 > LATENCY_WARN_MS) {
      await notifyAlert({
        systemName: t.name,
        webhookUrl: t.webhookUrl,
        level: 'warn',
        title: `応答遅延を検知`,
        context: t.url,
        detail: `ヘルスチェック往復が ${rtt2}ms（初回 ${rtt}ms・しきい値 ${LATENCY_WARN_MS}ms）。持続的な負荷増の可能性。`,
        dedupKey: `health-latency-${t.key}`,
        cooldownMs: 15 * 60_000,
      })
    }
  }
  await observeServiceHealth(t.key, t.name, true).catch(() => {});
  return { name: t.name, ok: true, rtt, status: res.status }
}

/**
 * 常時確認（system-watch・10分ごと）が止まっていないかを見る。互いに見張る形にして、
 * 確認の仕組みそのものが止まったときにも気づけるようにする。記録がまだ無い（初回の前）は見ない。
 */
const WATCH_STALE_MS = 35 * 60_000
async function checkSystemWatch(): Promise<{ ok: boolean; lastRun?: string }> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'watch:v1:last-run:free' } }).catch(() => null)
  if (!row) return { ok: true }
  let lastRun = ''
  try { lastRun = JSON.parse(row.value).at ?? '' } catch { /* 壊れた値は止まっているとみなす */ }
  const ageMs = lastRun ? Date.now() - Date.parse(lastRun) : Infinity
  if (ageMs <= WATCH_STALE_MS) return { ok: true, lastRun }
  // 間引きは DB の記録で行う（インスタンスをまたいでも6時間に1回だけ知らせる）
  const notified = await readOps<{ at: string }>('system-watch-stale-notified').catch(() => null)
  if (notified && Date.now() - Date.parse(notified.at) < 6 * 3_600_000) return { ok: false, lastRun }
  const sent = await notifyAlert({
    level: 'warn',
    title: '常時確認（system-watch）が止まっています',
    context: '/api/cron/system-watch',
    detail: `最後に動いた時刻：${lastRun || '読めません'}（${Number.isFinite(ageMs) ? `約${Math.round(ageMs / 60000)}分前` : '不明'}。10分ごとに動く予定）\n確認すること：Vercel の Cron Jobs で /api/cron/system-watch の実行結果と Runtime Logs を見る。vercel.json に登録が残っているかを見る。`,
    dedupKey: 'system-watch-stale',
    cooldownMs: 6 * 3_600_000,
  })
  if (sent) await writeOps('system-watch-stale-notified', { at: new Date().toISOString() }).catch(() => {})
  return { ok: false, lastRun }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const [results, systemWatch] = await Promise.all([Promise.all(TARGETS.map((t) => checkTarget(t))), checkSystemWatch()])
  // 落ちた項目があれば ok:false にし、Vercel のログでもどれが落ちたか分かるようにする
  const failed = results.filter((r) => !r.ok)
  if (failed.length) console.error('[health-alert] failed', JSON.stringify(failed))
  return NextResponse.json({ ok: failed.length === 0 && systemWatch.ok, checkedAt: new Date().toISOString(), failed, results, systemWatch })
}
