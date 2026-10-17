// ============================================
// ドヤ収入管理: 支出の読み取り口（設計書 §8.1 / ADDON-SERVICES §6 #11 / 支出設計書 §8）
// ============================================
// 取り込み元は 1 つだけ選ぶ（promane か expense）。両方は足さない（業務委託の二重計上）。
// ⚠️ ドヤ支出管理（expense）は収入管理より後にマージされる（段 5）。
//    支出側のマージで EXPENSE_ADAPTERS.expense に 1 行足すだけで切り替わるようにしてある（画面は変えない）:
//      import { expenseMonthly, expenseCashOut, canReadExpenseOrganization, listReadableExpenseOrganizations } from '@/lib/expense/income-source'
//      expense: { id: 'expense', label: 'ドヤ支出管理', canRead: async (u, id) => ..., listLinkable: listReadableExpenseOrganizations, monthly: expenseMonthly, cashOut: expenseCashOut }
import { prisma } from '@/lib/prisma'
import { laborCostForEntry } from '@/lib/promane/labor-cost'
import { addMonthsYm, formatYmd, parseYmd } from './dates'

export type MonthlyExpense = {
  month: string
  expense: number
  laborCost: number
  total: number
  byCategory: Record<string, number>
  /** うち予測・未確定分（expense のみ） */
  planned?: number
  /** うち確定分（expense のみ） */
  confirmed?: number
}

/** 出金予定（資金繰り。expense のみ。支出設計書 §8.1） */
export type CashOutEvent = {
  date: string
  amount: number
  category: string
  label: string
  status: 'planned' | 'paid'
}

export type ExpenseSourceId = 'promane' | 'expense'

export type ExpenseAdapter = {
  id: ExpenseSourceId
  label: string
  /** 画面に出す注記（取り込み範囲の限界） */
  note: string
  /** 操作者がその取り込み元の組織を読めるか。読めれば表示名 */
  canRead(userId: string, refId: string): Promise<{ id: string; name: string } | null>
  listLinkable(userId: string): Promise<{ id: string; name: string }[]>
  monthly(refId: string, range: { from: string; to: string }): Promise<MonthlyExpense[]>
  cashOut?(refId: string, range: { from: string; to: string }): Promise<CashOutEvent[]>
}

export type ExpenseResult =
  | { connected: true; source: ExpenseSourceId; sourceLabel: string; note: string; workspaceName: string; months: MonthlyExpense[] }
  | { connected: false; reason: 'not_linked' | 'no_access' | 'not_available' }

/** プロマネで財務を見られるロール。member には経費・時給を見せない */
const PROMANE_FINANCE_ROLES = ['owner', 'admin']

/** 収入側の利用者が、そのプロマネのワークスペースの財務を見られるか */
export async function canReadPromaneWorkspace(userId: string, workspaceId: string) {
  const m = await prisma.promaneMember.findFirst({
    where: { userId, workspaceId, isActive: true, role: { in: PROMANE_FINANCE_ROLES } },
    include: { workspace: { select: { id: true, name: true } } },
  })
  return m?.workspace ?? null
}

export async function listLinkablePromaneWorkspaces(userId: string) {
  const ms = await prisma.promaneMember.findMany({
    where: { userId, isActive: true, role: { in: PROMANE_FINANCE_ROLES } },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return ms.map((m) => m.workspace)
}

/** JST の月キー（PromaneExpense.date は日時のため JST に寄せる） */
function jstMonth(d: Date): string {
  return new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 7)
}

async function promaneMonthly(workspaceId: string, range: { from: string; to: string }): Promise<MonthlyExpense[]> {
  const fromMonth = range.from
  const toMonth = range.to
  const f = parseYmd(`${fromMonth}-01`)
  const t = parseYmd(`${toMonth}-01`)
  const next = addMonthsYm(t.y, t.m, 1)
  // JST の月初 0 時 = UTC 前日 15 時
  const gte = new Date(Date.parse(`${formatYmd(f.y, f.m, 1)}T00:00:00+09:00`))
  const lt = new Date(Date.parse(`${formatYmd(next.y, next.m, 1)}T00:00:00+09:00`))

  const [expenses, entries] = await Promise.all([
    prisma.promaneExpense.findMany({ where: { project: { workspaceId }, date: { gte, lt } }, select: { amount: true, category: true, date: true } }),
    prisma.promaneTimeEntry.findMany({
      where: { member: { workspaceId }, date: { gte, lt } },
      select: { duration: true, hourlyRateSnapshot: true, date: true, member: { select: { hourlyRate: true } } },
    }),
  ])

  const months = new Map<string, { expense: number; labor: number; byCategory: Record<string, number> }>()
  for (let i = 0; ; i++) {
    const ym = addMonthsYm(f.y, f.m, i)
    const key = formatYmd(ym.y, ym.m, 1).slice(0, 7)
    if (key > toMonth) break
    months.set(key, { expense: 0, labor: 0, byCategory: {} })
  }
  for (const e of expenses) {
    const m = months.get(jstMonth(e.date))
    if (!m) continue
    const amount = Math.max(0, e.amount)
    m.expense += amount
    m.byCategory[e.category] = (m.byCategory[e.category] ?? 0) + amount
  }
  for (const e of entries) {
    const m = months.get(jstMonth(e.date))
    if (m) m.labor += laborCostForEntry(e, e.member.hourlyRate)
  }
  return Array.from(months.entries()).map(([month, v]) => {
    // 人件費は小数で返るので、月ごとに合計してから 1 回だけ丸める
    const laborCost = Math.round(v.labor)
    return { month, expense: v.expense, laborCost, total: v.expense + laborCost, byCategory: v.byCategory }
  })
}

const promaneAdapter: ExpenseAdapter = {
  id: 'promane',
  label: 'ドヤプロマネ（暫定）',
  note: '支出はドヤプロマネの記録（プロジェクト経費＋人件費）です。会社全体の固定費は含みません',
  canRead: canReadPromaneWorkspace,
  listLinkable: listLinkablePromaneWorkspaces,
  monthly: promaneMonthly,
}

/** 取り込み元の一覧。expense は支出管理のマージ時に足す（上の注記） */
export const EXPENSE_ADAPTERS: Partial<Record<ExpenseSourceId, ExpenseAdapter>> = {
  promane: promaneAdapter,
}

export type ExpenseLink = { expenseSourceId: string | null; promaneWorkspaceId: string | null; expenseOrganizationId: string | null }

/** 組織の設定から、使う取り込み元と相手の id を決める（expenseSourceId 未設定の旧データはプロマネ扱い） */
export function resolveExpenseLink(link: ExpenseLink): { source: ExpenseSourceId; refId: string } | null {
  const source = (link.expenseSourceId ?? (link.promaneWorkspaceId ? 'promane' : null)) as ExpenseSourceId | null
  if (source === 'promane' && link.promaneWorkspaceId) return { source, refId: link.promaneWorkspaceId }
  if (source === 'expense' && link.expenseOrganizationId) return { source, refId: link.expenseOrganizationId }
  return null
}

/** fromMonth / toMonth は 'YYYY-MM'（両端を含む） */
export async function monthlyExpenses(userId: string, link: ExpenseLink, fromMonth: string, toMonth: string): Promise<ExpenseResult> {
  const resolved = resolveExpenseLink(link)
  if (!resolved) return { connected: false, reason: 'not_linked' }
  const adapter = EXPENSE_ADAPTERS[resolved.source]
  if (!adapter) return { connected: false, reason: 'not_available' }
  // 読むたびに権限を確かめる（結んだ後に相手の組織を抜けた人に見せない）
  const target = await adapter.canRead(userId, resolved.refId)
  if (!target) return { connected: false, reason: 'no_access' }
  const months = await adapter.monthly(resolved.refId, { from: fromMonth, to: toMonth })
  return { connected: true, source: adapter.id, sourceLabel: adapter.label, note: adapter.note, workspaceName: target.name, months }
}
