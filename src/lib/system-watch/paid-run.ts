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

/** 有効なグループの確認を、上限の確認で包んで返す。どれも有効でなければ空 */
export async function budgetedPaidChecks(): Promise<{ checks: CheckDef[]; groups: string[]; skipped: string[] }> {
  const groups: string[] = []
  const list: Paid[] = []
  if (await enabled(PAID_ENABLED_KEY)) { groups.push(PAID_ENABLED_KEY); list.push(...paidChecks()) }
  if (await enabled(PAID_AGENT_ENABLED_KEY)) { groups.push(PAID_AGENT_ENABLED_KEY); list.push(...paidAgentChecks()) }
  list.sort((a, b) => a.costYen - b.costYen)
  const skipped: string[] = []
  const checks = list.map((c): CheckDef => ({
    ...c,
    run: async () => {
      const spent = (await readSpend()).yen
      if (!canSpend(spent)) {
        skipped.push(c.id)
        return { ok: true, detail: `今日の累計の見込み額が ${spent.toFixed(1)}円で、上限 ${DAILY_CAP_YEN}円に届いたため回していません` }
      }
      try {
        return await c.run()
      } finally {
        // 失敗しても費用は出ているとみなして足す（安全側）
        await addSpend(c.id, c.costYen).catch(() => {})
      }
    },
  }))
  return { checks, groups, skipped }
}
