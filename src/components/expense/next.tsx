'use client'

// ドヤ支出管理: 新しい見た目（UI 品質の直し）の部品
// ⚠️ 新しい見た目で使う。）
// ⚠️ 計算・集計はしない。API の値を並べ替えて表示するだけ
import tokens from '@/components/ds/tokens.module.css'
import { ToolHero } from '@/components/ds'
import { Donut } from '@/components/ds/charts'
import { CountUp, Stagger, StaggerItem } from '@/components/ds/motion'
import { CATEGORY_LABEL } from '@/lib/expense/constants'
import type { ForecastMatrix } from './types'
import { Btn, Field, inputCls } from './ui'
import { CATEGORY_OTHER_COLOR, colorOf } from './CashBars'
import { CompanyRegisterButton } from '@/components/shell/ShellCompanyCard'

const STEPS = [
  { title: '契約を登録する', body: 'SaaS・業務委託・家賃などを、金額と支払周期で登録します。', art: '/expense/step-1.webp' },
  { title: '出金予定が自動で並ぶ', body: '締め日・支払日から、お金が出る日を12か月先まで計算します。', art: '/expense/step-2.webp' },
  { title: '請求書と支払を記録する', body: '請求書待ちや金額の差異は「要対応」に出ます。', art: '/expense/step-3.webp' },
]

/** 入口（組織がまだ無い人）。共通の枠の中に出すので、見出し（h1）は ToolFrame が持つ。ここは h2（1画面に h1 は1つ。2026-10-24 統括の確認） */
export function EntryNext({ orgName, memberName, busy, onOrgName, onMemberName, onCreate, needsCompany = false, companyName = null, onStartWithCompany }: {
  orgName: string
  memberName: string
  busy: boolean
  onOrgName: (v: string) => void
  onMemberName: (v: string) => void
  onCreate: () => void
  /** アカウントの会社が未登録。組織の作成ではなく、会社の登録を案内する（1アカウント＝1会社。2026-10-24） */
  needsCompany?: boolean
  /** アカウントの会社の名前。あれば「◯◯で始める」のボタンだけを出す（組織名・氏名の入力は出さない） */
  companyName?: string | null
  onStartWithCompany?: () => void
}) {
  return (
    <div data-ui-next="true" className="bg-[var(--bg)]">
      <div className={`${tokens.ds} mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8 md:py-12`}>
        <h2 className="text-[13px] font-bold tracking-wide text-[var(--blue-deep)]">ドヤ支出管理をはじめる</h2>
        <ToolHero
          title="支払いの予定を、12か月先まで見える化"
          lead="固定費・業務委託・家賃の支払いを契約ごとに登録すると、毎月いくら出ていくかが一目で分かります。"
          tool="expense"
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {companyName && onStartWithCompany ? (
          <section className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)] md:p-6" aria-labelledby="expense-start-title">
            <h2 id="expense-start-title" className="text-[18px] font-bold leading-[1.4] text-[var(--ink)]">登録した会社で始める</h2>
            <p className="mt-1 text-[14px] leading-[1.7] text-[var(--sub)]">ドヤAIは、1つのアカウントで1つの会社を扱います。支出管理も、登録した会社の名前で使えます。</p>
            <p className="mt-3 rounded-[var(--r-sm)] bg-[var(--bg)] px-3 py-2 text-[15px] font-bold text-[var(--ink)]">{companyName}</p>
            <div className="mt-5">
              <Btn onClick={onStartWithCompany} busy={busy}>この会社で始める</Btn>
            </div>
          </section>
          ) : needsCompany ? (
          <section className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)] md:p-6" aria-labelledby="expense-company-title">
            <h2 id="expense-company-title" className="text-[18px] font-bold leading-[1.4] text-[var(--ink)]">会社を登録して始める</h2>
            <p className="mt-1 text-[14px] leading-[1.7] text-[var(--sub)]">ドヤAIは、1つのアカウントで1つの会社を扱います。会社を登録すると、支出管理はその会社の名前ですぐに使えます。</p>
            <p className="mt-2 text-[14px] leading-[1.7] text-[var(--sub)]">ほかのツールで使っている組織の名前があれば、候補から選べます。</p>
            <div className="mt-5">
              <CompanyRegisterButton className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-sm)] bg-[var(--blue)] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[var(--blue-deep)]">
                会社を登録する
              </CompanyRegisterButton>
            </div>
          </section>
          ) : (
          <section className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow)] md:p-6" aria-labelledby="expense-create-title">
            <h2 id="expense-create-title" className="text-[18px] font-bold leading-[1.4] text-[var(--ink)]">組織を作成する</h2>
            <p className="mt-1 text-[14px] leading-[1.7] text-[var(--sub)]">会社名とあなたの氏名だけで始められます。あとからメンバーを招待できます。</p>
            <div className="mt-4 space-y-3">
              <Field label="組織名（会社名）">
                <input className={inputCls} value={orgName} onChange={(e) => onOrgName(e.target.value)} placeholder="例: 株式会社スリスタ" autoComplete="organization" />
              </Field>
              <Field label="あなたの氏名">
                <input className={inputCls} value={memberName} onChange={(e) => onMemberName(e.target.value)} placeholder="例: 三森 律稀" autoComplete="name" />
              </Field>
            </div>
            <div className="mt-5">
              <Btn onClick={onCreate} busy={busy} disabled={!orgName.trim() || !memberName.trim()}>
                組織を作成して始める
              </Btn>
            </div>
          </section>
          )}
          <section aria-labelledby="expense-steps-title">
            <h2 id="expense-steps-title" className="mb-3 text-[18px] font-bold leading-[1.4] text-[var(--ink)]">3ステップで始める</h2>
            <Stagger as="ol" className="m-0 grid list-none grid-cols-1 gap-3 p-0">
              {STEPS.map((st, i) => (
                <StaggerItem as="li" index={i} key={st.title}>
                  <div className="flex items-center gap-4 rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={st.art} alt="" width={1200} height={800} loading="lazy" className="aspect-[3/2] w-24 flex-none rounded-[var(--r-sm)] bg-[var(--bg)] object-cover sm:w-32" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[15px] font-bold text-[var(--ink)]">
                        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--blue-soft)] text-[12px] tabular-nums text-[var(--blue-deep)]" aria-hidden="true">{i + 1}</span>
                        <span className="min-w-0">{st.title}</span>
                      </p>
                      <p className="mt-1 text-[13px] leading-[1.7] text-[var(--sub)]">{st.body}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </div>
      </div>
    </div>
  )
}

/** ダッシュボードの最初の帯。見出しは「何ができるか」（ツール名は ToolFrame の h1） */
export function ExpenseHero({ month, contractCount, action }: { month: string; contractCount: number; action?: React.ReactNode }) {
  return (
    <ToolHero
      title={`${month}の支払いと、12か月先の出金`}
      lead={`有効な契約 ${contractCount} 件から、出金の予定と要対応をまとめています。`}
      action={action}
      tool="expense"
    />
  )
}

/** 金額の数字の動き */
export function YenCount({ value }: { value: number }) {
  return <CountUp value={value} />
}

/** 今月の出金のカテゴリ別の割合（多い順に4つ＋その他） */
export function MonthDonut({ cash, month }: { cash: ForecastMatrix; month: string }) {
  const rows = cash.categories
    .map((c) => ({ label: CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c, value: cash.cells[c]?.[month]?.amount ?? 0, color: colorOf(c) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  if (rows.length === 0) return null
  const data = rows.length > 5 ? [...rows.slice(0, 4), { label: 'その他', value: rows.slice(4).reduce((a, r) => a + r.value, 0), color: CATEGORY_OTHER_COLOR }] : rows
  // 色は積み上げの棒（CashBars）と同じ費目の色にする
  return <Donut data={data.map(({ label, value }) => ({ label, value }))} colors={data.map((d) => d.color)} size={128} label="今月の出金のカテゴリ別の割合" />
}
