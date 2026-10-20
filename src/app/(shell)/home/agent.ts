// ============================================
// 経営ホームのエージェント（依頼 → どのツールを読むか → 答えと次の一手）
// ============================================
// ⚠️ いまは「読む」と「下書きへの案内」だけを自動で行う。
//    外部送信・取り消せない操作・課金が発生する生成は、ここから実行しない。
//    次の一手はボタン（各ツールの画面へ移動）として出し、実行は人が各ツールで行う。
// ⚠️ 有料の生成APIも呼ばない。依頼の振り分けは語句の一致で行う（設計書 §18.5 の段階1）。
import type { HomeSummary } from '@/lib/home/summary'

export interface AgentStep {
  tool: string
  label: string
}

export interface AgentRow {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'muted'
}

export interface AgentAction {
  label: string
  href: string
  /** 移動先で人が実行・確認する操作 */
  needsConfirm?: boolean
}

export interface AgentPlan {
  intent: string
  title: string
  steps: AgentStep[]
  lead: string
  rows: AgentRow[]
  actions: AgentAction[]
}

export const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const man = (n: number) => (Math.abs(n) >= 10000 ? `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万円` : yen(n))

const has = (q: string, words: string[]) => words.some((w) => q.includes(w))

export const AGENT_SUGGESTIONS = [
  '今月の売上と収入を教えて',
  '見込み案件と受注予測は？',
  '今日やるべきことは？',
  '今月の残業と勤怠の状況は？',
  '契約中のプランを確認したい',
  '集客を強化したい',
]

const notReady = (name: string) => `${name}はまだ使い始めていません`

export function planAgent(raw: string, s: HomeSummary): AgentPlan {
  const q = raw.replace(/\s+/g, '')

  if (s.finance && has(q, ['売上', '収入', '入金', '請求漏れ', '入金遅延', '粗利', '支出', '出金'])) return financialPlan(s)

  if (has(q, ['契約', 'プラン', '請求', '支払', '解約', '料金'])) {
    const c = s.contract
    const end = c.currentPeriodEnd ? new Date(c.currentPeriodEnd).toLocaleDateString('ja-JP') : '—'
    return {
      intent: 'contract',
      title: '契約中のプラン',
      steps: [{ tool: '契約情報', label: '現在の契約を確認' }],
      lead: c.paid
        ? `${c.label}をご契約中です。${c.cancelAtPeriodEnd ? `${end}で解約予定になっています。` : `次回の更新日は${end}です。`}`
        : `現在は${c.label}です。有料プランにすると全ツールの上限が広がります。`,
      rows: [
        { label: 'プラン', value: c.label },
        { label: '状態', value: c.cancelAtPeriodEnd ? '期間終了で解約予定' : c.paid ? '契約中' : '無料', tone: c.cancelAtPeriodEnd ? 'warn' : 'good' },
        { label: '契約期間の終了日', value: end, tone: 'muted' },
      ],
      actions: c.paid
        ? [{ label: '契約内容・お支払い方法を確認', href: '/api/stripe/portal?returnTo=/home', needsConfirm: true }]
        : [{ label: '料金プランを見る', href: '/pricing' }],
    }
  }

  if (has(q, ['パイプライン', '見込', '予測', 'フォーキャスト', '商談', '案件'])) {
    const sa = s.sales
    if (sa.state !== 'ready') return emptyTool('営業管理', '/sfa', '商談を登録すると、受注予測とパイプラインをここで答えます。')
    const top = [...sa.stages].sort((a, b) => b.amount - a.amount)[0]
    return {
      intent: 'pipeline',
      title: '見込み案件と受注予測',
      steps: [
        { tool: '営業管理', label: '進行中の商談を読み取り' },
        { tool: '営業管理', label: 'ステージごとの確度で加重' },
      ],
      lead: `進行中の商談は${sa.openDeals}件、合計${man(sa.openPipeline)}です。確度で重みづけした受注見込みは${man(sa.weightedPipeline)}です。${top && top.amount > 0 ? `いちばん金額が大きいのは「${top.name}」の段階です。` : ''}`,
      rows: [
        ...sa.stages.map((st) => ({ label: st.name, value: `${st.count}件 / ${man(st.amount)}` })),
        { label: '今月の受注', value: `${sa.wonCountThisMonth}件 / ${man(sa.wonThisMonth)}`, tone: 'good' as const },
      ],
      actions: [
        { label: 'パイプラインを開く', href: `${sa.href}/deals` },
        { label: '受注した案件の見積を作る', href: '/quote', needsConfirm: true },
      ],
    }
  }

  if (has(q, ['今日', 'やること', 'タスク', 'やるべき', '優先', 'todo', 'TODO'])) {
    const rows: AgentRow[] = []
    const actions: AgentAction[] = []
    const billing = s.finance?.income.state === 'ready' ? s.finance.income.value?.todo ?? [] : []
    billing.forEach(item => rows.push({ label: '請求・入金', value: item.title, tone: item.kind === 'leak' || item.kind === 'overdue' ? 'warn' : 'muted' }))
    if (billing.length) actions.push({ label: '請求・入金を確認する', href: '/income' })
    if (s.sales.state === 'ready') {
      rows.push({ label: '営業タスク（未完了）', value: `${s.sales.openTasks}件` })
      rows.push({ label: 'うち期限切れ', value: `${s.sales.overdueTasks}件`, tone: s.sales.overdueTasks > 0 ? 'warn' : 'good' })
      actions.push({ label: '営業タスクを開く', href: `${s.sales.href}/tasks` })
    }
    if (s.projects.state === 'ready') {
      rows.push({ label: 'プロジェクトの未完了タスク', value: `${s.projects.openTasks}件` })
      actions.push({ label: 'プロジェクトを開く', href: s.projects.href.replace(/\/reports$/, '/projects') })
    }
    if (s.attendance.state === 'ready' && s.attendance.pendingRequests > 0) {
      rows.push({ label: '承認待ちの勤怠申請', value: `${s.attendance.pendingRequests}件`, tone: 'warn' })
      actions.push({ label: '申請を確認する', href: '/kintai/approvals' })
    }
    if (s.quotes.state === 'ready' && s.quotes.draftCount > 0) {
      rows.push({ label: '確定前の見積', value: `${s.quotes.draftCount}件` })
    }
    const soon = s.events.filter((e) => new Date(e.date).getTime() >= Date.now() - 86400_000).slice(0, 3)
    soon.forEach((e) => rows.push({ label: new Date(e.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }), value: e.title, tone: 'muted' }))
    return {
      intent: 'today',
      title: '今日やるべきこと',
      steps: [
        { tool: '営業管理', label: 'タスクと期限を確認' },
        { tool: 'プロマネ', label: '未完了タスクを確認' },
        { tool: '勤怠', label: '承認待ちの申請を確認' },
      ],
      lead: rows.length
        ? billing.length ? '請求・入金の要対応があります。内容と期日を確認してください。' : s.sales.overdueTasks > 0
          ? `期限切れの営業タスクが${s.sales.overdueTasks}件あります。まずはそこから片づけましょう。`
          : '期限切れはありません。近い期日のものから順に進めましょう。'
        : 'まだ各ツールにタスクが登録されていません。営業管理かプロマネから始めると、ここに並びます。',
      rows,
      actions: actions.length ? actions : [{ label: '営業管理をはじめる', href: '/sfa' }],
    }
  }

  if (has(q, ['勤怠', '残業', '労働', '出勤', '打刻', '働き方'])) {
    const a = s.attendance
    if (a.state !== 'ready') return emptyTool('勤怠', '/kintai', '勤怠を使い始めると、労働時間と残業をここでまとめます。')
    return {
      intent: 'attendance',
      title: '今月の勤怠',
      steps: [{ tool: '勤怠', label: a.scope === 'org' ? '全社の勤怠を集計' : 'あなたの勤怠を集計' }],
      lead: `${a.scope === 'org' ? `全社（${a.employees}名）` : 'あなた'}の今月の労働時間は${a.workHoursThisMonth}時間、うち残業は${a.overtimeHoursThisMonth}時間です。`,
      rows: [
        { label: '労働時間', value: `${a.workHoursThisMonth}時間` },
        { label: '残業', value: `${a.overtimeHoursThisMonth}時間`, tone: a.overtimeHoursThisMonth > (a.scope === 'org' ? a.employees * 30 : 30) ? 'warn' : 'good' },
        { label: '承認待ちの申請', value: `${a.pendingRequests}件`, tone: a.pendingRequests > 0 ? 'warn' : 'muted' },
      ],
      actions: [{ label: '勤怠を開く', href: a.href }],
    }
  }

  if (has(q, ['人', '社員', '採用', '従業員', '評価', '組織', '面接'])) {
    const p = s.people
    return {
      intent: 'people',
      title: '人と組織',
      steps: [{ tool: '人事', label: '在籍者と部署を確認' }, { tool: '面接', label: '採用の入口を確認' }],
      lead: p.state === 'ready' ? `在籍は${p.activeEmployees}名、部署は${p.departments}つです。` : notReady('人事'),
      rows: p.state === 'ready'
        ? [{ label: '在籍者', value: `${p.activeEmployees}名` }, { label: '部署', value: `${p.departments}` }]
        : [],
      actions: [
        { label: p.state === 'ready' ? '人事を開く' : '人事をはじめる', href: p.state === 'ready' ? p.href : '/hr' },
        { label: '採用面接を準備する', href: '/mensetsu' },
      ],
    }
  }

  if (has(q, ['集客', 'マーケ', 'バナー', '広告', 'LP', 'SEO', '記事', '認知'])) {
    return {
      intent: 'marketing',
      title: '集客を強化する',
      steps: [{ tool: '営業管理', label: '今月の新規リードを確認' }],
      lead: s.sales.state === 'ready'
        ? `今月の新規リードは${s.sales.newLeads}件です。入口を増やすなら、下の順で進めるのがおすすめです。`
        : '入口を増やすなら、下の順で進めるのがおすすめです。',
      rows: [
        { label: '1. 見られ方を知る', value: 'AI検索対策で現状を確認', tone: 'muted' },
        { label: '2. 受け皿を作る', value: 'LP・記事を用意', tone: 'muted' },
        { label: '3. 届ける', value: 'バナー・コピーで広告', tone: 'muted' },
      ],
      actions: [
        { label: 'AI検索対策を開く', href: '/aio' },
        { label: 'LPを作る', href: '/lp', needsConfirm: true },
        { label: 'バナーを作る', href: '/banner', needsConfirm: true },
      ],
    }
  }

  if (has(q, ['予定', 'カレンダー', '締切', '納期', 'スケジュール'])) {
    const upcoming = s.events.filter((e) => new Date(e.date).getTime() >= Date.now() - 86400_000).slice(0, 6)
    return {
      intent: 'calendar',
      title: '近い予定と期日',
      steps: [
        { tool: '営業管理', label: '受注予定日とタスク期限を確認' },
        { tool: '見積', label: '見積の有効期限を確認' },
        { tool: 'プロマネ', label: '納期を確認' },
      ],
      lead: upcoming.length ? `この先の期日が${upcoming.length}件あります。` : 'この先45日に登録された期日はありません。',
      rows: upcoming.map((e) => ({ label: new Date(e.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }), value: e.title })),
      actions: upcoming[0] ? [{ label: 'いちばん近い期日を開く', href: upcoming[0].href }] : [],
    }
  }

  if (has(q, ['見積'])) {
    const qu = s.quotes
    if (qu.state !== 'ready') return emptyTool('見積', '/quote', '見積を使い始めると、確定額と下書きの件数をここでまとめます。')
    return {
      intent: 'quote',
      title: '見積の状況',
      steps: [{ tool: '見積', label: '見積書の状態を集計' }],
      lead: `今月確定した見積は${man(qu.confirmedThisMonth)}（税抜）です。確定前の下書きが${qu.draftCount}件あります。`,
      rows: [
        { label: '今月の確定額（税抜）', value: man(qu.confirmedThisMonth), tone: 'good' },
        { label: '下書き', value: `${qu.draftCount}件` },
        { label: '送付済み', value: `${qu.sentCount}件` },
      ],
      actions: [{ label: '見積を開く', href: qu.href }, { label: '新しい見積を作る', href: '/quote', needsConfirm: true }],
    }
  }

  // 既定: 売上と収入の全体像
  if (s.finance) return financialPlan(s)
  const sa = s.sales
  const pr = s.projects
  const income = sa.wonThisMonth
  const rows: AgentRow[] = [
    { label: '今月の受注（営業管理）', value: sa.state === 'ready' ? man(sa.wonThisMonth) : notReady('営業管理'), tone: sa.state === 'ready' ? 'good' : 'muted' },
    { label: '今月確定した見積（税抜）', value: s.quotes.state === 'ready' ? man(s.quotes.confirmedThisMonth) : notReady('見積'), tone: s.quotes.state === 'ready' ? undefined : 'muted' },
    { label: '受注見込み（加重）', value: sa.state === 'ready' ? man(sa.weightedPipeline) : '—', tone: 'muted' },
    { label: 'プロジェクト収支（売上 − 原価）', value: pr.state === 'ready' ? `${man(pr.revenue)} − ${man(pr.cost)} = ${man(pr.profit)}` : notReady('プロマネ'), tone: pr.state === 'ready' ? (pr.profit >= 0 ? 'good' : 'warn') : 'muted' },
  ]
  return {
    intent: 'revenue',
    title: '売上と収入の全体像',
    steps: [
      { tool: '営業管理', label: '今月の受注を集計' },
      { tool: '見積', label: '確定した見積を集計' },
      { tool: 'プロマネ', label: '案件ごとの収支を計算' },
    ],
    lead: sa.state === 'ready' || pr.state === 'ready'
      ? `今月の受注は${man(income)}です。${pr.state === 'ready' ? `プロジェクト全体の利益は${man(pr.profit)}です。` : ''}`
      : '営業管理やプロマネを使い始めると、売上と収入をここでまとめて答えます。',
    rows,
    actions: [
      { label: '営業管理を開く', href: sa.href },
      { label: 'プロジェクト収支を開く', href: pr.href },
    ],
  }
}

function financialPlan(s: HomeSummary): AgentPlan {
  const finance = s.finance!
  const { income, expense } = finance
  const value = income.state === 'ready' ? income.value : null
  const rows: AgentRow[] = []
  const unavailable = (state: string) => state === 'no_access' ? '所属と権限を確認してください' : '取得できませんでした'
  const note = value?.expenseConnection === 'no_access' ? '支出の所属と権限を確認してください'
    : value?.expenseConnection === 'reference_only' ? 'プロマネは税区分が異なるため未算定'
      : value?.expenseConnection === 'not_linked' ? '支出管理の取り込み元が未設定です' : '支出を取得できないため未算定'
  if (income.state !== 'unused') {
    rows.push(
      { label: '売上予定（計上月・税抜）', value: value ? man(value.revenue.scheduled) : '—' },
      { label: 'うち請求済み（税抜）', value: value ? man(value.revenue.invoiced) : '—' },
      { label: '入金額（受取日・税込）', value: value ? man(value.revenue.received) : '—' },
      { label: '粗利（予定・税抜）', value: value?.profit != null ? man(value.profit) : `— / ${value ? note : unavailable(income.state)}` },
    )
    if (value) rows.push({ label: '請求漏れ / 入金遅延', value: `${value.billing.leaks}件 / ${value.billing.overdue}件`, tone: value.billing.leaks || value.billing.overdue ? 'warn' : 'muted' })
  } else {
    // 正常な未使用のときだけ旧業務指標を参考値として返す。合算して売上にはしない。
    rows.push({ label: '受注（営業管理・参考）', value: s.sales.state === 'ready' ? man(s.sales.wonThisMonth) : '—' }, { label: '確定見積（参考・税抜）', value: s.quotes.state === 'ready' ? man(s.quotes.confirmedThisMonth) : '—' })
  }
  if (expense.state !== 'unused') {
    rows.push({ label: '今月の出金（支払日・税込、源泉税納付含む）', value: expense.state === 'ready' && expense.value ? man(expense.value.cashOut) : `— / ${unavailable(expense.state)}` })
  } else if (income.state === 'unused') {
    rows.push({ label: '案件経費・人件費（プロマネ・参考）', value: s.projects.state === 'ready' ? man(s.projects.cost) : '—' })
  }
  return {
    intent: 'revenue', title: '売上・入金と出金',
    steps: [{ tool: '収入管理', label: '計上月の売上と受取日の入金を確認' }, { tool: '支出管理', label: '選択した組織の計上費用と出金を確認' }],
    lead: value ? `${finance.month}の収入管理${income.organization ? `（${income.organization.name}）` : ''}の数字です。売上と入金は基準が異なるため合算しません。`
      : income.state === 'unused' ? '収入管理は未使用です。営業・見積・案件の数字は参考値として表示します。' : `${unavailable(income.state)}。売上を0円や参考値に置き換えていません。`,
    rows, actions: [{ label: '収入管理を確認する', href: '/income' }, { label: '支出管理を確認する', href: expense.organization ? `/expense/${encodeURIComponent(expense.organization.slug)}` : '/expense' }],
  }
}

function emptyTool(name: string, href: string, lead: string): AgentPlan {
  return {
    intent: 'empty',
    title: `${name}はまだ使われていません`,
    steps: [{ tool: name, label: '利用状況を確認' }],
    lead,
    rows: [],
    actions: [{ label: `${name}をはじめる`, href }],
  }
}
