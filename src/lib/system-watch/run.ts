// 常時確認の実行: 確認を並べて動かし、前回の状態と比べて、知らせるべきものだけを Slack の共通の送り口で送る。
// 状態は SystemSetting（watch:v1:state:<tier>）に JSON で残す。DB に書くのはこの状態と最後の実行時刻だけ。
import { prisma } from '@/lib/prisma'
import { getAlertWebhook } from '@/lib/alert'
import { postSlack } from '@/lib/slack/notify'
import { decide } from './decide'
import { formatFailures, formatObservedChanges, formatRecoveries } from './format'
import type { CheckDef, CheckResult, CheckState, WatchEvent } from './types'

const PER_CHECK_TIMEOUT_MS = 25_000
const CONCURRENCY = 8

async function runOne(c: CheckDef): Promise<CheckResult> {
  const started = Date.now()
  const base = { id: c.id, area: c.area, label: c.label, severity: c.severity, hints: c.hints, at: new Date().toISOString() }
  try {
    const out = await Promise.race([
      c.run(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`確認そのものが ${(c.timeoutMs ?? PER_CHECK_TIMEOUT_MS) / 1000}秒で終わりませんでした`)), c.timeoutMs ?? PER_CHECK_TIMEOUT_MS)),
    ])
    return { ...base, ...out, ms: Date.now() - started }
  } catch (e) {
    // 確認の中で投げられた例外も「失敗」として中身ごと記録する
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return { ...base, ok: false, error: message.slice(0, 300), ms: Date.now() - started }
  }
}

export async function runChecks(checks: CheckDef[], concurrency = CONCURRENCY): Promise<CheckResult[]> {
  const results: CheckResult[] = new Array(checks.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, checks.length) }, async () => {
    while (i < checks.length) {
      const idx = i++
      results[idx] = await runOne(checks[idx])
    }
  }))
  return results
}

const stateKey = (tier: string) => `watch:v1:state:${tier}`

async function loadState(tier: string): Promise<Record<string, CheckState>> {
  const row = await prisma.systemSetting.findUnique({ where: { key: stateKey(tier) } })
  if (!row) return {}
  try { return JSON.parse(row.value) } catch { return {} }
}

async function saveState(tier: string, state: Record<string, CheckState>): Promise<void> {
  const value = JSON.stringify(state)
  await prisma.systemSetting.upsert({ where: { key: stateKey(tier) }, create: { key: stateKey(tier), value }, update: { value } })
  const last = JSON.stringify({ at: new Date().toISOString() })
  await prisma.systemSetting.upsert({ where: { key: `watch:v1:last-run:${tier}` }, create: { key: `watch:v1:last-run:${tier}`, value: last }, update: { value: last } })
}

async function send(title: string, text: string, severity: 'urgent' | 'action' | 'info', kind: 'error' | 'usage', key: string): Promise<boolean> {
  const webhook = await getAlertWebhook()
  if (!webhook) return false
  try {
    // 見出しの1行目は件名だけにする（共通の送り口が「【重さ】ドヤAI｜種類：件名」に整える）
    await postSlack(webhook, { text: `${title}\n${text}` }, { meta: { app: 'ドヤAI', kind, severity }, dedupeKey: key, dedupeWindowMs: 60_000 })
    return true
  } catch {
    return false
  }
}

export type WatchReport = { tier: string; checkedAt: string; total: number; failed: CheckResult[]; events: WatchEvent[]; sent: string[]; results: CheckResult[] }

/** dry=true のときは、状態を書かず、Slack にも送らない（手動の試し用）。 */
export async function runWatch(tier: string, checks: CheckDef[], opts: { dry?: boolean; concurrency?: number } = {}): Promise<WatchReport> {
  const results = await runChecks(checks, opts.concurrency)
  const now = new Date().toISOString()
  const previous = opts.dry ? {} : await loadState(tier).catch(() => ({}))
  const thresholds = Object.fromEntries(checks.map(c => [c.id, c.threshold]))
  const repeats = Object.fromEntries(checks.filter(c => c.repeatMs).map(c => [c.id, c.repeatMs as number]))
  const { events, next } = decide(results, previous, thresholds, now, repeats)
  const sent: string[] = []
  const notified = new Set<string>()

  if (!opts.dry) {
    const failures = events.filter((e): e is Extract<WatchEvent, { type: 'failure' }> => e.type === 'failure')
    const recoveries = events.filter((e): e is Extract<WatchEvent, { type: 'recovery' }> => e.type === 'recovery')
    const changes = events.filter((e): e is Extract<WatchEvent, { type: 'observed-change' }> => e.type === 'observed-change')
    if (failures.length) {
      const f = formatFailures(failures, now)
      const urgent = failures.some(e => e.result.severity === 'urgent')
      if (await send(f.title, f.text, urgent ? 'urgent' : 'action', 'error', `watch:${tier}:fail:${now}`)) { sent.push('failure'); failures.forEach(e => notified.add(e.result.id)) }
    }
    if (recoveries.length) {
      const r = formatRecoveries(recoveries, now)
      if (await send(r.title, r.text, 'info', 'error', `watch:${tier}:recover:${now}`)) sent.push('recovery')
      // 「直りました」を送れなかったら失敗の状態のまま残し、次の回に送り直す
      else for (const e of recoveries) if (previous[e.result.id]) next[e.result.id] = previous[e.result.id]
    }
    if (changes.length) {
      const c = formatObservedChanges(changes, now)
      if (await send(c.title, c.text, 'info', 'usage', `watch:${tier}:observed:${now}`)) sent.push('observed-change')
    }
    // 送れなかった失敗は「知らせた」ことにしない（次の回にもう一度送る）
    for (const e of failures) if (!notified.has(e.result.id)) next[e.result.id] = { ...next[e.result.id], notifiedAt: previous[e.result.id]?.notifiedAt ?? null }
    await saveState(tier, next)
  }
  return { tier, checkedAt: now, total: results.length, failed: results.filter(r => !r.ok), events, sent, results }
}
