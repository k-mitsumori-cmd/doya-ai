// ============================================
// ドヤ収入管理: 支出の読み取り口（設計書 §8.1）
// ============================================
// ⚠️ 支出管理は未実装（2026-10-18 確定）。当面はドヤプロマネの経費＋人件費を支出として読む。
//    ドヤ支出管理を作ったら ExpenseSource の実装を足して切り替える。画面は変えない。
import { prisma } from '@/lib/prisma'
import { laborCostForEntry } from '@/lib/promane/labor-cost'
import { addMonthsYm, formatYmd, parseYmd } from './dates'

export type MonthlyExpense = {
  month: string
  expense: number
  laborCost: number
  total: number
  byCategory: Record<string, number>
}

export type ExpenseResult =
  | { connected: true; source: 'promane'; workspaceName: string; months: MonthlyExpense[] }
  | { connected: false; reason: 'not_linked' | 'no_access' }

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

/** fromMonth / toMonth は 'YYYY-MM'（両端を含む） */
export async function monthlyExpenses(userId: string, workspaceId: string | null, fromMonth: string, toMonth: string): Promise<ExpenseResult> {
  if (!workspaceId) return { connected: false, reason: 'not_linked' }
  // 読むたびに権限を確かめる（結んだ後にプロマネを抜けた人に見せない）
  const ws = await canReadPromaneWorkspace(userId, workspaceId)
  if (!ws) return { connected: false, reason: 'no_access' }

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
  return {
    connected: true,
    source: 'promane',
    workspaceName: ws.name,
    months: Array.from(months.entries()).map(([month, v]) => {
      // 人件費は小数で返るので、月ごとに合計してから 1 回だけ丸める
      const laborCost = Math.round(v.labor)
      return { month, expense: v.expense, laborCost, total: v.expense + laborCost, byCategory: v.byCategory }
    }),
  }
}
