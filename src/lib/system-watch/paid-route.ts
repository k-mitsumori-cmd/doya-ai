// 有料の確認の cron（/api/cron/system-watch-paid）の中身。ルートは本物の部品を渡すだけにし、ここをテストする。
//
// ふだん（GET、毎朝 8:40）: スイッチ（watch:v1:paid-enabled・watch:v1:paid-agent-enabled）が true のグループだけを回す。
// 手で1回（POST ?once=agent）: エージェントの確認（B1・B2）だけを、スイッチ2に関係なく1回だけ回す（2026-10-26 統括の依頼）。
//   本番で初めて動かすときに、記録の ID が残り、台帳（枠の数え・構成づくりの回数・ドヤパワー）が増えていないかを確かめるため。
//   スイッチの状態は変えない。1日10円の上限はそのまま守る。作った記録の ID と、台帳の前後を返す。
import type { CheckDef, CheckResult } from './types'

/**
 * 有料の確認を同時に回す数。B1 は最大 270秒（agent-checks.ts の B1_CHECK_TIMEOUT_MS）かかり、
 * B2 と順に回すとルートの maxDuration（300秒）を超えるため、2つずつ同時に回す。
 * 同時に回しても、費用は回す前に1つずつ予約するので、1日の上限は超えない（paid-run.ts の wrapWithDailyCap）。
 */
export const PAID_CONCURRENCY = 2

/** 前後を比べるための写し。SystemSetting のキーと値、ドヤパワーの残り */
export type Snapshot = { settings: Record<string, string>; powerLeft: number | null }

export type PaidRouteDeps = {
  secret: string | undefined
  budgetedPaidChecks: () => Promise<{ checks: CheckDef[]; groups: string[]; skipped: string[] }>
  budgetedAgentChecksOnce: () => { checks: CheckDef[]; skipped: string[] }
  runWatch: (tier: string, checks: CheckDef[], opts: { concurrency?: number }) => Promise<{ checkedAt: string; failed: CheckResult[]; sent: string[]; results: CheckResult[] }>
  readSpend: () => Promise<{ yen: number }>
  capYen: number
  /** 手で1回のときだけ使う。前後の写しを取る */
  snapshot: () => Promise<Snapshot>
  switchKeys: string[]
}

type Res = { status: number; body: Record<string, unknown> }

/** 前後の写しの差。増えた記録の ID と、値が変わった台帳のキー */
export function diffSnapshots(before: Snapshot, after: Snapshot) {
  const createdIds: Record<string, string[]> = {}
  const changed: { key: string; before: string | null; after: string | null }[] = []
  const keys = new Set([...Object.keys(before.settings), ...Object.keys(after.settings)])
  for (const key of [...keys].sort()) {
    const b = before.settings[key] ?? null
    const a = after.settings[key] ?? null
    if (b === a) continue
    if (key.startsWith('watch:v1:marked:')) {
      const parse = (v: string | null): string[] => { try { const x = JSON.parse(v ?? '[]'); return Array.isArray(x) ? x : [] } catch { return [] } }
      const added = parse(a).filter(id => !parse(b).includes(id))
      if (added.length) createdIds[key] = added
    } else {
      changed.push({ key, before: b, after: a })
    }
  }
  return {
    createdIds,
    // 自動点検では増えないはずの台帳（枠の数え org-quota・構成づくりの回数など）。空なら期待どおり
    ledgerChanges: changed,
    powerLeft: { before: before.powerLeft, after: after.powerLeft, diff: before.powerLeft !== null && after.powerLeft !== null ? after.powerLeft - before.powerLeft : null },
  }
}

export async function handlePaidRequest(request: Request, method: 'GET' | 'POST', deps: PaidRouteDeps): Promise<Res> {
  if (!deps.secret || request.headers.get('authorization') !== `Bearer ${deps.secret}`) return { status: 401, body: { error: 'unauthorized' } }
  const once = new URL(request.url).searchParams.get('once')

  if (method === 'POST') {
    if (once !== 'agent') return { status: 400, body: { error: 'once=agent だけを受け付けます' } }
    const { checks, skipped } = deps.budgetedAgentChecksOnce()
    const spentBefore = (await deps.readSpend()).yen
    const before = await deps.snapshot()
    // 1回だけ。上限に届いていれば、各確認は回さずに「回していない」を返す
    const report = await deps.runWatch('paid-once', checks, { concurrency: PAID_CONCURRENCY })
    const after = await deps.snapshot()
    const spentAfter = (await deps.readSpend()).yen
    return {
      status: 200,
      body: {
        ok: report.failed.length === 0,
        once: 'agent',
        checkedAt: report.checkedAt,
        capYen: deps.capYen,
        spentTodayYen: { before: spentBefore, after: spentAfter },
        skippedByCap: skipped,
        results: report.results.map(r => ({ id: r.id, ok: r.ok, status: r.status, error: r.error, detail: r.detail })),
        ...diffSnapshots(before, after),
        note: `スイッチ（${deps.switchKeys.join('・')}）の状態は変えていません`,
      },
    }
  }

  const { checks, groups, skipped } = await deps.budgetedPaidChecks()
  if (!checks.length) return { status: 200, body: { skipped: true, reason: `${deps.switchKeys.join(' と ')} がどちらも true ではないため、有料の確認は動かしていません` } }
  const report = await deps.runWatch('paid', checks, { concurrency: PAID_CONCURRENCY })
  const spend = await deps.readSpend()
  return {
    status: 200,
    body: {
      ok: report.failed.length === 0,
      checkedAt: report.checkedAt,
      groups,
      spentTodayYen: spend.yen,
      capYen: deps.capYen,
      skippedByCap: skipped,
      failed: report.failed.map(f => ({ id: f.id, label: f.label, status: f.status, error: f.error })),
      sent: report.sent,
    },
  }
}
