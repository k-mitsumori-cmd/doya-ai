import { prisma } from '@/lib/prisma'
import { homeIncomeSummary } from '@/lib/income/summary-read'
import { ROLE_HIERARCHY } from '@/lib/income/roles'
import { monthlyExpenses, resolveExpenseLink, type ExpenseLink } from '@/lib/income/expense-source'
import { getExpenseSummary } from '@/lib/expense/expense-read'
import { EXPENSE_ROLES } from '@/lib/expense/constants'

export type FinanceState = 'ready' | 'unused' | 'no_access' | 'error'
export type FinanceOrg = { id: string; name: string; slug: string }
export type FinanceRead<T> = { state: FinanceState; organization: FinanceOrg | null; value: T | null }
type IncomeRead = NonNullable<Awaited<ReturnType<typeof homeIncomeSummary>>>
export type HomeIncomeValue = Pick<IncomeRead, 'revenue' | 'billing' | 'todo' | 'trend'> & {
  expense: number | null
  profit: number | null
  expenseConnection: 'ready' | 'not_linked' | 'no_access' | 'not_available' | 'reference_only'
  expenseOrganization: FinanceOrg | null
}
export type HomeExpenseValue = { cashOut: number; paid: number; nextMonthOut: number; accruedExclTax: number }
export type HomeFinance = { month: string; income: FinanceRead<HomeIncomeValue>; expense: FinanceRead<HomeExpenseValue> }

const incomeOrgSelect = { id: true, name: true, slug: true, expenseSourceId: true, expenseOrganizationId: true, promaneWorkspaceId: true } as const
const orgSelect = { id: true, name: true, slug: true } as const
const state = <T>(value: FinanceState, organization: FinanceOrg | null = null, data: T | null = null): FinanceRead<T> => ({ state: value, organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug } : null, value: data })
const validIncomeRole = (role: string) => Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, role) && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.member
const validExpenseRole = (role: string) => (EXPENSE_ROLES as readonly string[]).includes(role)
const sameLink = (a: ExpenseLink, b: ExpenseLink) => a.expenseSourceId === b.expenseSourceId && a.expenseOrganizationId === b.expenseOrganizationId && a.promaneWorkspaceId === b.promaneWorkspaceId
const finite = (...values: number[]) => values.every(Number.isFinite)

/** 読み取りだけで所属を選ぶ。失効・未知role時に別の組織へ切り替えない。 */
export async function loadHomeFinance(userId: string, reference: Date): Promise<HomeFinance> {
  const today = new Date(reference.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const unavailable = (value: 'no_access' | 'error'): HomeFinance => ({ month, income: state(value), expense: state(value) })
  try {
    // 最新の所属を一度だけ選ぶ。INACTIVEや未知roleを除外して過去の組織へ戻らない。
    const incomeMember = await prisma.incomeMember.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { organization: { select: incomeOrgSelect } } })
    if (incomeMember && (incomeMember.userId !== userId || incomeMember.status !== 'ACTIVE' || !validIncomeRole(incomeMember.role))) return unavailable('no_access')
    const incomeOrg = incomeMember?.organization ?? null
    const resolved = incomeOrg ? resolveExpenseLink(incomeOrg) : null
    const hasLinkSettings = !!incomeOrg && !!(incomeOrg.expenseSourceId || incomeOrg.expenseOrganizationId || incomeOrg.promaneWorkspaceId)
    const selectedExpense: { member: { id: string; organizationId: string } | null } = { member: null }
    const incomePromise = incomeMember
      ? homeIncomeSummary({ userId, organizationId: incomeMember.organizationId }, month, today, { readExpense: false })
          .then(value => value ? state<IncomeRead>('ready', incomeOrg, value) : state<IncomeRead>('unused', incomeOrg))
          .catch(() => state<IncomeRead>('error', incomeOrg))
      : Promise.resolve(state<IncomeRead>('unused'))

    const expensePromise = (async (): Promise<FinanceRead<HomeExpenseValue>> => {
      if (resolved?.source === 'promane') return state('unused')
      if (!resolved && hasLinkSettings) return state('error')
      const member = await prisma.expenseMember.findFirst({
        where: { userId, ...(resolved?.source === 'expense' ? { organizationId: resolved.refId } : {}) },
        orderBy: { createdAt: 'desc' }, include: { organization: { select: orgSelect } },
      })
      if (!member) return state(resolved ? 'no_access' : 'unused')
      if (member.userId !== userId || member.status !== 'ACTIVE' || !validExpenseRole(member.role) || (resolved && member.organizationId !== resolved.refId)) return state('no_access')
      selectedExpense.member = { id: member.id, organizationId: member.organizationId }
      const org = member.organization
      const link: ExpenseLink = resolved && incomeOrg ? incomeOrg : { expenseSourceId: 'expense', expenseOrganizationId: member.organizationId, promaneWorkspaceId: null }
      try {
        const [summary, accrued] = await Promise.all([getExpenseSummary(member.organizationId, today), monthlyExpenses(userId, link, month, month)])
        const stillMember = await prisma.expenseMember.findFirst({ where: { id: member.id, userId, organizationId: member.organizationId }, select: { id: true, organizationId: true, userId: true, role: true, status: true } })
        if (!stillMember || stillMember.id !== member.id || stillMember.organizationId !== member.organizationId || stillMember.userId !== userId || stillMember.status !== 'ACTIVE' || !validExpenseRole(stillMember.role)) return state('no_access')
        if (!accrued.connected) return state(accrued.reason === 'no_access' ? 'no_access' : 'error', org)
        if (!summary.inUse) return state('unused', org)
        const cost = accrued.months.find(point => point.month === month)?.total
        if (cost == null || !finite(cost, summary.kpi.thisMonthOut, summary.kpi.paid, summary.kpi.nextMonthOut)) return state('error', org)
        return state('ready', org, { cashOut: summary.kpi.thisMonthOut, paid: summary.kpi.paid, nextMonthOut: summary.kpi.nextMonthOut, accruedExclTax: cost })
      } catch { return state('error', org) }
    })().catch(() => state<HomeExpenseValue>('error'))

    const [income, expenseRead] = await Promise.all([incomePromise, expensePromise])
    let expense = expenseRead
    if (incomeMember) {
      const current = await prisma.incomeMember.findFirst({ where: { id: incomeMember.id, userId, organizationId: incomeMember.organizationId }, include: { organization: { select: incomeOrgSelect } } })
      if (!current || current.id !== incomeMember.id || current.organizationId !== incomeMember.organizationId || current.userId !== userId || current.status !== 'ACTIVE' || !validIncomeRole(current.role) || !incomeOrg || !sameLink(incomeOrg, current.organization)) return unavailable('no_access')
    }
    // 収入側の読み取りが遅い場合も、全集計の後で同じ支出所属をもう一度確認する。
    if (selectedExpense.member) {
      const identity = selectedExpense.member
      try {
        const current = await prisma.expenseMember.findFirst({ where: { id: identity.id, userId, organizationId: identity.organizationId }, select: { id: true, organizationId: true, userId: true, role: true, status: true } })
        if (!current || current.id !== identity.id || current.organizationId !== identity.organizationId || current.userId !== userId || current.status !== 'ACTIVE' || !validExpenseRole(current.role)) expense = state('no_access')
      } catch { expense = state('error', expense.organization) }
    }
    if (!income.value) return { month, income: state(income.state, income.organization), expense }
    const revenue = income.value.revenue
    if (!finite(revenue.scheduled, revenue.invoiced, revenue.received)) return { month, income: state('error', income.organization), expense }
    const connection: HomeIncomeValue['expenseConnection'] = resolved?.source === 'promane' ? 'reference_only'
      : !resolved ? hasLinkSettings ? 'not_available' : 'not_linked'
        : expense.state === 'ready' ? 'ready' : expense.state === 'no_access' ? 'no_access' : 'not_available'
    const cost = connection === 'ready' ? expense.value!.accruedExclTax : null
    return {
      month, expense,
      income: state('ready', income.organization, { revenue, billing: income.value.billing, todo: income.value.todo, trend: income.value.trend, expense: cost, profit: cost === null ? null : revenue.scheduled - cost, expenseConnection: connection, expenseOrganization: connection === 'ready' ? expense.organization : null }),
    }
  } catch { return unavailable('error') }
}
