// ============================================
// ドヤ収入管理への支出の受け渡し（ExpenseSource 'expense' の中身）
// ============================================
// 収入側 src/lib/income/expense-source.ts の ExpenseSource（id: 'expense'）から呼ぶ想定。
// ⚠️ 収入側のファイルはここでは編集しない。型は収入設計書 §8.1 と本書 §8.1 に合わせて同じ形で持つ。
//    収入側での接続例:
//      import { expenseMonthly, expenseCashOut } from '@/lib/expense/income-source'
//      const source: ExpenseSource = {
//        id: 'expense',
//        monthly: (range) => expenseMonthly(org.expenseOrganizationId!, range),
//        cashOut: (range) => expenseCashOut(org.expenseOrganizationId!, range),
//      }
// ⚠️ 呼ぶ側は、操作者が支出側の ACTIVE メンバーであることを canReadExpenseOrganization で確かめること（設計書 §8.3）
import { prisma } from '@/lib/prisma'
import { monthlyExpenses, cashOutEvents, type MonthlyExpense, type CashOutEvent } from './aggregate'
import { addMonthsToYm, isYm, isYmd, toDbDate, type Ym, type Ymd } from './dates'
import { toRowLike } from './sync'

export type { MonthlyExpense, CashOutEvent }

/** 計上月ごとの支出（税抜）。range は 'YYYY-MM' */
export async function expenseMonthly(organizationId: string, range: { from: string; to: string }): Promise<MonthlyExpense[]> {
  if (!isYm(range.from) || !isYm(range.to) || range.from > range.to) throw new Error('range must be YYYY-MM')
  const rows = await prisma.expenseSchedule.findMany({
    where: {
      organizationId,
      period: { gte: toDbDate(`${range.from}-01`), lt: toDbDate(`${addMonthsToYm(range.to as Ym, 1)}-01`) },
    },
  })
  return monthlyExpenses(rows.map(toRowLike), range.from, range.to)
}

/** 出金日ごとの出金（税込・源泉控除後・源泉税の納付を含む）。range は 'YYYY-MM-DD' か 'YYYY-MM' */
export async function expenseCashOut(organizationId: string, range: { from: string; to: string }): Promise<CashOutEvent[]> {
  const from: Ymd = isYm(range.from) ? `${range.from}-01` : range.from
  const to: Ymd = isYm(range.to) ? `${range.to}-31` : range.to
  if (!isYmd(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('range must be YYYY-MM-DD or YYYY-MM')
  // 支払済みは paidOn で並べるので、予定日で少し広めに引いてから絞る
  const rows = await prisma.expenseSchedule.findMany({
    where: { organizationId, OR: [{ plannedPayDate: { gte: toDbDate(from) } }, { paidOn: { gte: toDbDate(from) } }] },
  })
  return cashOutEvents(rows.map(toRowLike), from, to)
}

/** 収入側の設定画面で、支出側の組織を「取り込み元」に選べるか */
export async function canReadExpenseOrganization(userId: string, expenseOrganizationId: string): Promise<boolean> {
  const m = await prisma.expenseMember.findFirst({ where: { userId, organizationId: expenseOrganizationId, status: 'ACTIVE' }, select: { id: true } })
  return !!m
}

/** 収入側の設定画面で選択肢に出す、操作者が所属する支出側の組織 */
export async function listReadableExpenseOrganizations(userId: string) {
  const rows = await prisma.expenseMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  })
  return rows.map((r) => r.organization)
}
