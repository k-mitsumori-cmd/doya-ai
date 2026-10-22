// ============================================
// ドヤ支出管理: 会社情報ウィザードからの初期化（ADDON-SERVICES §7）
// ============================================
// 冪等キー: ExpenseOrganization.companyId（一意）。何度呼んでも組織は 1 つ。
// 作るもの: 組織（決算月）・オーナー・既定の支払方法（銀行振込）。契約や取引先は作らない（空のまま始める）
// ⚠️ 呼ぶ側（ウィザード）が companyId の所有者であることを確かめてから呼ぶ。
import { prisma } from '@/lib/prisma'
import { lockLifecycleUsers, assertRetirementMembershipWritable } from '@/lib/account-lifecycle/store'

export type ExpenseWizardInput = {
  companyId: string
  companyName: string
  userId: string
  memberName: string
  /** 決算月（1〜12）。既定 3 */
  fiscalYearEndMonth?: number
  companyProfileId?: string | null
}

export async function initExpenseForCompany(input: ExpenseWizardInput): Promise<{ organizationId: string; slug: string; created: boolean }> {
  const month = input.fiscalYearEndMonth && Number.isInteger(input.fiscalYearEndMonth) && input.fiscalYearEndMonth >= 1 && input.fiscalYearEndMonth <= 12 ? input.fiscalYearEndMonth : 3
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockLifecycleUsers(tx, [input.userId])
        await assertRetirementMembershipWritable(tx, [input.userId])
        const existing = await tx.expenseOrganization.findUnique({ where: { companyId: input.companyId }, select: { id: true, slug: true } })
        if (existing) return { organizationId: existing.id, slug: existing.slug, created: false }
        const base = input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `org-${Date.now()}`
        const dup = await tx.expenseOrganization.findUnique({ where: { slug: base }, select: { id: true } })
        const org = await tx.expenseOrganization.create({
          data: {
            name: input.companyName.slice(0, 120),
            slug: dup ? `${base}-${Date.now()}` : base,
            companyId: input.companyId,
            companyProfileId: input.companyProfileId ?? null,
            fiscalYearEndMonth: month,
          },
        })
        await tx.expenseMember.create({ data: { organizationId: org.id, userId: input.userId, name: input.memberName.slice(0, 80), role: 'owner', status: 'ACTIVE' } })
        await tx.expensePaymentMethod.create({ data: { organizationId: org.id, type: 'transfer', label: '銀行振込' } })
        return { organizationId: org.id, slug: org.slug, created: true }
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 })
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw e
    }
  }
  throw new Error('unreachable')
}
