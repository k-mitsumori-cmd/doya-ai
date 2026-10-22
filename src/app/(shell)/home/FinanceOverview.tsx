'use client'

import Link from 'next/link'
import type { HomeFinance, FinanceState } from '@/lib/home/finance-read'
import { CountUp } from '@/components/ds/motion'
import { AreaChart } from '@/components/ds/charts'
import styles from './finance.module.css'

export const financeStateLabel = (state: FinanceState) => state === 'no_access' ? '所属と権限を確認してください' : state === 'error' ? '取得できませんでした' : state === 'unused' ? '未使用' : ''
const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`
export const profitNote = (connection: string) => connection === 'no_access' ? '支出の所属と権限を確認してください' : connection === 'not_available' ? '支出を取得できないため未算定です' : connection === 'reference_only' ? 'プロマネは税区分が異なるため、粗利は未算定です' : '収入管理で支出管理の取り込み元を設定してください'

function Money({ label, value, note, href }: { label: string; value: number | null; note: string; href: string }) {
  return <Link href={href} className={styles.money}><span>{label}</span><strong>{value === null ? '—' : <CountUp value={value} format={yen} />}</strong><small>{note}</small></Link>
}

/** 会社全体の正本と、支払日基準の出金を分けて表示する。旧業務指標はここへ加算しない。 */
export default function FinanceOverview({ finance }: { finance: HomeFinance }) {
  const { income, expense } = finance
  const value = income.state === 'ready' ? income.value : null
  const out = expense.state === 'ready' ? expense.value : null
  const incomeHref = '/income'
  const expenseHref = expense.organization ? `/expense/${encodeURIComponent(expense.organization.slug)}` : '/expense'
  return <div className={styles.overview}>
    {income.state !== 'unused' ? <section aria-label="収入管理の今月の数字">
      <h2 className={styles.heading}>売上・入金 <small>{finance.month} / 収入管理{income.organization ? ` / ${income.organization.name}` : ''}</small></h2>
      {!value ? <p role="status" className={styles.note}>{financeStateLabel(income.state)}。売上を参考値に置き換えていません。</p> : null}
      <div className={styles.grid}>
        <Money label="売上予定（税抜）" value={value?.revenue.scheduled ?? null} note="計上月の予定・請求済みを含みます" href={incomeHref} />
        <Money label="うち請求済み（税抜）" value={value?.revenue.invoiced ?? null} note="売上予定の内訳です" href={incomeHref} />
        <Money label="入金額（税込）" value={value?.revenue.received ?? null} note="受取日基準。売上予定とは合算しません" href={incomeHref} />
        <Money label="粗利（予定・税抜）" value={value?.profit ?? null} note={value?.profit != null ? `計上月の売上予定 − 支出 / ${value.expenseOrganization?.name ?? '支出管理'}` : value ? profitNote(value.expenseConnection) : '取得できないため未算定です'} href={incomeHref} />
      </div>
      {value ? <div className={styles.trend}>
        <h3>売上予定の推移（計上月・税抜）</h3>
        <AreaChart labels={value.trend.slice(-6).map(point => point.month)} series={[{ name: '売上予定（税抜）', values: value.trend.slice(-6).map(point => point.revenue) }]} format={yen} />
      </div> : null}
    </section> : null}
    {expense.state !== 'unused' ? <section className={styles.cash} aria-label="支出管理の出金">
      <h2 className={styles.heading}>出金 <small>{finance.month} / 支出管理{expense.organization ? ` / ${expense.organization.name}` : ''}</small></h2>
      {out ? <div className={styles.grid}>
        <Money label="今月の出金予定・実績" value={out.cashOut} note="支払日基準・税込。源泉税の納付を含みます" href={expenseHref} />
        <Money label="うち支払済み" value={out.paid} note="源泉控除後の支払いと源泉税納付" href={expenseHref} />
        <Money label="来月の出金予定" value={out.nextMonthOut} note="支払日基準。粗利の費用には使いません" href={expenseHref} />
        <Money label="今月の計上費用（税抜）" value={out.accruedExclTax} note="源泉税の納付行を除き、額面を一度だけ計上" href={expenseHref} />
      </div> : <p role="status" className={styles.note}>{financeStateLabel(expense.state)}。出金額は未取得です。</p>}
    </section> : null}
    {income.state !== 'unused' || expense.state !== 'unused' ? <p className={styles.note}>営業と案件の欄は、各ツールの参考情報です。上の売上・粗利には合算していません。</p> : null}
  </div>
}

export function FinanceBillingTasks({ finance }: { finance?: HomeFinance }) {
  const todos = finance?.income.state === 'ready' ? finance.income.value?.todo ?? [] : []
  if (!todos.length) return null
  return <section className={styles.cash} aria-label="請求・入金の要対応"><h2 className={styles.heading}>請求・入金の要対応</h2><ul>{todos.map((todo, index) => <li key={`${todo.kind}-${todo.href}-${index}`}><Link href={todo.href}>{todo.title}</Link></li>)}</ul></section>
}
