// 有料の確認を、1日の上限の中で回す。安い確認から順に1つずつ回し、累計の見込み額が上限に届いたら残りを回さない。
import { prisma } from '@/lib/prisma'
import { paidChecks, PAID_ENABLED_KEY } from './paid-checks'
import { paidAgentChecks, PAID_AGENT_ENABLED_KEY } from './agent-checks'
import { addSpend, DAILY_CAP_YEN, fitsDailyCap, readSpend } from './budget'
import type { CheckDef } from './types'

type Paid = CheckDef & { costYen: number }

async function enabled(key: string): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  return row?.value === 'true'
}

type SpendDeps = { readSpend: () => Promise<{ yen: number }>; addSpend: (id: string, yen: number) => Promise<unknown> }
const realSpend: SpendDeps = { readSpend: () => readSpend(), addSpend: (id, yen) => addSpend(id, yen) }

/**
 * 確認を、1日の上限の確認で包む（2026-10-26 統括の依頼で、同時に回しても上限を超えない形にした）。
 * - 回す前に、その確認の費用を先に予約する。予約は1つずつ順に行い、「累計＋この確認の費用」が上限を超えるなら回さない。
 *   同時に回す2つが同じ累計を見て、2つとも回ってしまうことを防ぐ（前は最大で 約4.2円 超えることがあった）。
 * - 回したものは、失敗しても費用は出ているとみなし、予約をそのまま残す（安全側）。
 * - 前提がそろわず回さなかったもの（skipped）は、予約を戻す。
 * - 予約を書けなかったとき（DB の障害など）は、費用を数えられないので回さない。
 */
export function wrapWithDailyCap(list: Paid[], deps: SpendDeps = realSpend): { checks: CheckDef[]; skipped: string[] } {
  const sorted = [...list].sort((a, b) => a.costYen - b.costYen)
  const skipped: string[] = []
  // 予約を1つずつ順に行うための鎖（毎朝の cron は1回の呼び出しの中で回るので、この中で順にすれば足りる）
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn)
    chain = next.catch(() => {})
    return next
  }
  const checks = sorted.map((c): CheckDef => ({
    ...c,
    run: async () => {
      const reserved = await serial(async () => {
        const spent = (await deps.readSpend()).yen
        if (!fitsDailyCap(spent, c.costYen)) return { ok: false as const, spent, reason: 'cap' as const }
        try { await deps.addSpend(c.id, c.costYen) } catch { return { ok: false as const, spent, reason: 'write' as const } }
        return { ok: true as const, spent }
      })
      if (!reserved.ok) {
        skipped.push(c.id)
        return {
          ok: true, skipped: true,
          detail: reserved.reason === 'cap'
            ? `今日の累計の見込み額が ${reserved.spent.toFixed(1)}円で、この確認（${c.costYen}円）を足すと上限 ${DAILY_CAP_YEN}円を超えるため回していません`
            : '費用の予約を書けなかったため、回していません（費用を数えられないため）',
        }
      }
      const out = await c.run()
      // 前提がそろわず回さなかったなら、予約を戻す
      if (out?.skipped) await serial(() => deps.addSpend(c.id, -c.costYen)).catch(() => {})
      return out
    },
  }))
  return { checks, skipped }
}

/** 有効なグループの確認を、上限の確認で包んで返す。どれも有効でなければ空 */
export async function budgetedPaidChecks(): Promise<{ checks: CheckDef[]; groups: string[]; skipped: string[] }> {
  const groups: string[] = []
  const list: Paid[] = []
  if (await enabled(PAID_ENABLED_KEY)) { groups.push(PAID_ENABLED_KEY); list.push(...paidChecks()) }
  if (await enabled(PAID_AGENT_ENABLED_KEY)) { groups.push(PAID_AGENT_ENABLED_KEY); list.push(...paidAgentChecks()) }
  return { ...wrapWithDailyCap(list), groups }
}

/**
 * エージェントの確認（B1・B2）だけを、スイッチ2に関係なく1回分、上限の確認で包んで返す。
 * 本番で初めて動かすときに、統括が手で1回だけ回すための入口（?once=agent）で使う。スイッチの状態は変えない。
 */
export function budgetedAgentChecksOnce(): { checks: CheckDef[]; skipped: string[] } {
  return wrapWithDailyCap(paidAgentChecks())
}
