// ドヤ収入管理: カレンダーの予定を作る純粋関数（DB に触れない。calendar-read.ts から呼ぶ）
import { addDays, type Ymd } from './dates'

export type IncomeCalendarKind = 'issue_due' | 'payment_due' | 'renewal_notice' | 'contract_end'

export type IncomeCalendarEvent = {
  /** 'income:<kind>:<対象id>'。同じ予定は同じ id（ICS の UID・重複除去に使う） */
  id: string
  service: 'income'
  kind: IncomeCalendarKind
  date: Ymd
  title: string
  /** 金額を出してよい画面だけで使う（共有カレンダーでは隠す。設計書 §7） */
  amount: number | null
  /** 期日を過ぎて未対応（請求漏れ・入金遅延） */
  late: boolean
  href: string
}

export const CALENDAR_KIND_LABEL: Record<IncomeCalendarKind, string> = {
  issue_due: '請求予定日',
  payment_due: '支払期日',
  renewal_notice: '解約予告期限',
  contract_end: '契約終了日',
}

export type CalendarSource = {
  schedules: { id: string; plannedIssueDate: Ymd; amountExclTax: number; clientName: string; contractTitle: string; periodMonth: string }[]
  invoices: { id: string; invoiceNo: string | null; dueDate: Ymd; remaining: number; clientName: string }[]
  contracts: { id: string; title: string; clientName: string; endDate: Ymd; autoRenew: boolean; renewalNoticeDays: number | null }[]
}

/** 純粋関数: 読んだ行から予定を作る（calc.test.ts で確かめる） */
export function buildCalendarEvents(src: CalendarSource, from: Ymd, to: Ymd, today: Ymd): IncomeCalendarEvent[] {
  const inRange = (d: Ymd) => d >= from && d <= to
  const out: IncomeCalendarEvent[] = []
  for (const s of src.schedules) {
    if (!inRange(s.plannedIssueDate)) continue
    out.push({
      id: `income:issue_due:${s.id}`, service: 'income', kind: 'issue_due', date: s.plannedIssueDate,
      title: `請求 ${s.clientName}（${s.contractTitle}）`, amount: s.amountExclTax, late: s.plannedIssueDate < today,
      href: `/income/revenue?month=${s.periodMonth}`,
    })
  }
  for (const i of src.invoices) {
    if (i.remaining <= 0 || !inRange(i.dueDate)) continue
    out.push({
      id: `income:payment_due:${i.id}`, service: 'income', kind: 'payment_due', date: i.dueDate,
      title: `入金期日 ${i.clientName}${i.invoiceNo ? `（${i.invoiceNo}）` : ''}`, amount: i.remaining, late: i.dueDate < today,
      href: `/income/invoices/${i.id}`,
    })
  }
  for (const c of src.contracts) {
    if (c.autoRenew && c.renewalNoticeDays != null) {
      const notice = addDays(c.endDate, -c.renewalNoticeDays)
      if (inRange(notice)) out.push({ id: `income:renewal_notice:${c.id}`, service: 'income', kind: 'renewal_notice', date: notice, title: `解約予告期限 ${c.clientName}（${c.title}）`, amount: null, late: false, href: `/income/contracts/${c.id}` })
    } else if (!c.autoRenew && inRange(c.endDate)) {
      out.push({ id: `income:contract_end:${c.id}`, service: 'income', kind: 'contract_end', date: c.endDate, title: `契約終了 ${c.clientName}（${c.title}）`, amount: null, late: false, href: `/income/contracts/${c.id}` })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
}

