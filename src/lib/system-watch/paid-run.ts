// 有料の確認を、1日の上限の中で回す。安い確認から順に1つずつ回し、累計の見込み額が上限に届いたら残りを回さない。
import { prisma } from '@/lib/prisma'
import { paidChecks, PAID_ENABLED_KEY } from './paid-checks'
import { paidAgentChecks, PAID_AGENT_ENABLED_KEY } from './agent-checks'
import { addSpend, canSpend, DAILY_CAP_YEN, readSpend } from './budget'
import type { CheckDef } from './types'

type Paid = CheckDef & { costYen: number }

async function enabled(key: string): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  return row?.value === 'true'
}

type SpendDeps = { readSpend: () => Promise<{ yen: number }>; addSpend: (id: string, yen: number) => Promise<unknown> }
const realSpend: SpendDeps = { readSpend: () => readSpend(), addSpend: (id, yen) => addSpend(id, yen) }

/**
 * 確認を、1日の上限の確認で包む。安い順に並べ、回す前にその日の累計を見て、上限に届いていたら回さない。
 * 回したものは、失敗しても費用は出ているとみなして足す（安全側）。前提がそろわず回さなかったもの（skipped）は足さない。
 */
export function wrapWithDailyCap(list: Paid[], deps: SpendDeps = realSpend): { checks: CheckDef[]; skipped: string[] } {
  const sorted = [...list].sort((a, b) => a.costYen - b.costYen)
  const skipped: string[] = []
  const checks = sorted.map((c): CheckDef => ({
    ...c,
    run: async () => {
      const spent = (await deps.readSpend()).yen
      if (!canSpend(spent)) {
        skipped.push(c.id)
        return { ok: true, skipped: true, detail: `今日の累計の見込み額が ${spent.toFixed(1)}円で、上限 ${DAILY_CAP_YEN}円に届いたため回していません` }
      }
      let out
      try {
        out = await c.run()
        return out
      } finally {
        if (!out?.skipped) await deps.addSpend(c.id, c.costYen).catch(() => {})
      }
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
