import { NextRequest, NextResponse } from 'next/server'
import { notifyAlert } from '@/lib/alert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 相互ヘルスチェック（Vercel Cron・5分毎）。ドヤAI 自身と 呪い日記(noroi) の
 * 公開 /api/health を外形監視し、応答遅延・依存(DB)障害・到達不可(ダウン)を Slack 通知。
 * 09_Cursol と noroi が相互に相手を叩くことで、片方が完全ダウンしても他方が検知できる。
 * 認証: Authorization: Bearer ${CRON_SECRET}。
 */

const LATENCY_WARN_MS = Math.max(500, Number(process.env.HEALTH_LATENCY_WARN_MS) || 4000)
const FETCH_TIMEOUT_MS = 15_000

type Target = { name: string; url: string; key: string }

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
  },
  {
    name: 'ゆるせん',
    url: process.env.YURUSEN_HEALTH_URL || 'https://game.surisuta.jp/yurusen/api/health',
    key: 'yurusen',
  },
]

async function checkTarget(t: Target): Promise<{ name: string; ok: boolean; rtt: number; status?: number }> {
  const startedAt = Date.now()
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(t.url, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(to)
    const rtt = Date.now() - startedAt
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null

    if (!res.ok) {
      await notifyAlert({
        level: 'critical',
        title: `${t.name}: ヘルスチェック異常（依存障害の可能性）`,
        context: t.url,
        detail: `/api/health が HTTP ${res.status}。body=${JSON.stringify(body ?? {}).slice(0, 400)}`,
        dedupKey: `health-status-${t.key}`,
        cooldownMs: 10 * 60_000,
        extra: { 往復ms: rtt },
      })
    } else if (rtt > LATENCY_WARN_MS) {
      // 単発のコールドスタートで誤検知しないよう、遅い時は一度だけ再測定する
      // （1回目で関数が温まるため、恒常的な遅延でなければ2回目は速い）。
      // 2回目も閾値超過のときだけ「本当の遅延」として通知する。
      let rtt2 = rtt
      try {
        const ctrl2 = new AbortController()
        const to2 = setTimeout(() => ctrl2.abort(), FETCH_TIMEOUT_MS)
        const s2 = Date.now()
        const res2 = await fetch(t.url, { signal: ctrl2.signal, cache: 'no-store' })
        clearTimeout(to2)
        await res2.body?.cancel().catch(() => {})
        if (res2.ok) rtt2 = Date.now() - s2 // 2回目が異常応答なら1回目の値で判断
      } catch {
        /* 再測定失敗時は1回目の値で判断（下の閾値比較へ） */
      }
      if (rtt2 > LATENCY_WARN_MS) {
        await notifyAlert({
          level: 'warn',
          title: `${t.name}: 応答遅延を検知`,
          context: t.url,
          detail: `ヘルスチェック往復が ${rtt2}ms（初回 ${rtt}ms・しきい値 ${LATENCY_WARN_MS}ms）。持続的な負荷増の可能性。`,
          dedupKey: `health-latency-${t.key}`,
          cooldownMs: 15 * 60_000,
        })
      }
    }
    return { name: t.name, ok: res.ok, rtt, status: res.status }
  } catch (e) {
    await notifyAlert({
      level: 'critical',
      title: `${t.name}: 到達不可（ダウンの可能性）`,
      context: t.url,
      detail: `/api/health へ到達できません: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`,
      dedupKey: `health-down-${t.key}`,
      cooldownMs: 10 * 60_000,
    })
    return { name: t.name, ok: false, rtt: Date.now() - startedAt }
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const results = await Promise.all(TARGETS.map((t) => checkTarget(t)))
  return NextResponse.json({ ok: true, results })
}
