// ============================================
// 経営ホーム（/home）の横断サマリー
// ============================================
// 各ツールのデータを「読むだけ」で集めて、売上・収入・予定・人の状態を1画面にまとめる。
//
// ⚠️ ここでは DB に一切書き込まない。
//    各ツールの access.ts にある getOrCreateOrganization / getOrCreateWorkspace は
//    組織を自動作成するので呼ばない。所属の解決は同じ条件の findFirst を自前で行う。
// ⚠️ 所属の選び方は各ツールの既定と揃える（ツール側で見える数字とホームの数字がズレないように）。
//    - SFA / 勤怠 / HR: 最後に参加した組織
//    - 見積: 自分が作った組織 → 古い順
//    - プロマネ: 古い順
// ⚠️ 1ツールが落ちてもホーム全体は落とさない（Promise.allSettled で個別に握る）。
// ⚠️ 契約情報（User.plan / Subscription）は表示のみ。変更は既存の課金画面に任せる。
import { prisma } from '@/lib/prisma'
import { jstStartOfMonthUtc } from '@/lib/usage-summary'
import { tierFrom, planLabel, isPaidTier, type PlanTier } from '@/lib/plan-utils'
import { laborCostForEntry } from '@/lib/promane/labor-cost'
import { timeEntryBelongsToProject } from '@/lib/promane/time-entry-project'
import { ROLE_HIERARCHY as SFA_ROLES } from '@/lib/sfa/types'
import { ROLE_HIERARCHY as HR_ROLES } from '@/lib/hr/constants'

const QUOTE_ROLES = ['owner', 'admin', 'manager', 'member']
const PROMANE_ROLES = ['owner', 'admin', 'member', 'guest']
const KINTAI_ADMIN_ROLES = ['system_admin', 'hr_admin']
const CLOSED_PROJECT_STATUSES = ['delivered', 'invoiced', 'completed', 'cancelled']

export type HomeToolState = 'ready' | 'empty' | 'error'

export interface HomeMonthPoint {
  /** YYYY-MM（JST） */
  month: string
  /** 受注（SFA 受注金額） */
  won: number
  /** 確定した見積（税抜） */
  quoted: number
}

export interface HomeEvent {
  id: string
  date: string // ISO
  title: string
  kind: 'deal' | 'task' | 'project' | 'quote'
  href: string
}

/**
 * 売上・支出の数字をどのツールから取ったか（ADDON-SERVICES-2026-10-18.md §4）。
 * - 売上: 収入管理（income）を使っている組織は income が正本。その組織では SFA・見積の金額を足さない（二重計上）
 * - 支出: 支出管理（expense）が正本。使っていなければプロマネの経費＋人件費で代替
 * ⚠️ income / expense はまだ main に入っていない。入ったら loadIncome / loadExpense を足し、
 *    ここを 'income' / 'expense' に切り替える。今は常に代替（sfa_quote / promane）。
 */
export type HomeRevenueSource = 'income' | 'sfa_quote'
export type HomeCostSource = 'expense' | 'promane'

export interface HomeSummary {
  generatedAt: string
  sources: { revenue: HomeRevenueSource; cost: HomeCostSource }
  user: { name: string | null; email: string | null }
  contract: {
    tier: PlanTier
    label: string
    paid: boolean
    status: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  }
  sales: {
    state: HomeToolState
    orgName?: string
    href: string
    wonThisMonth: number
    wonCountThisMonth: number
    openPipeline: number
    weightedPipeline: number
    openDeals: number
    stages: { name: string; amount: number; count: number; color: string }[]
    openTasks: number
    overdueTasks: number
    newLeads: number
  }
  quotes: {
    state: HomeToolState
    orgName?: string
    href: string
    confirmedThisMonth: number
    draftCount: number
    sentCount: number
  }
  projects: {
    state: HomeToolState
    href: string
    activeProjects: number
    revenue: number
    cost: number
    profit: number
    openTasks: number
    top: { name: string; revenue: number; profit: number }[]
  }
  attendance: {
    state: HomeToolState
    href: string
    scope: 'org' | 'self'
    workHoursThisMonth: number
    overtimeHoursThisMonth: number
    pendingRequests: number
    employees: number
  }
  people: {
    state: HomeToolState
    href: string
    activeEmployees: number
    departments: number
  }
  trend: HomeMonthPoint[]
  events: HomeEvent[]
}

const toNum = (v: bigint | number | null | undefined) => {
  if (v == null) return 0
  const n = typeof v === 'bigint' ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

/** JST の YYYY-MM */
function jstMonthKey(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600_000)
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 直近 n か月（今月を含む）の JST 月初 UTC と月キー */
function lastMonths(n: number): { key: string; start: Date }[] {
  const thisMonth = jstStartOfMonthUtc()
  const j = new Date(thisMonth.getTime() + 9 * 3600_000)
  const out: { key: string; start: Date }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const y = j.getUTCFullYear()
    const m = j.getUTCMonth() - i
    const start = new Date(Date.UTC(y, m, 1) - 9 * 3600_000)
    out.push({ key: jstMonthKey(start), start })
  }
  return out
}

async function loadContract(userId: string) {
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, plan: true, stripeCurrentPeriodEnd: true },
    }),
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    }),
  ])
  const tier = tierFrom(user?.plan)
  const periodEnd = sub?.currentPeriodEnd ?? user?.stripeCurrentPeriodEnd ?? null
  return {
    user: { name: user?.name ?? null, email: user?.email ?? null },
    contract: {
      tier,
      label: planLabel(tier),
      paid: isPaidTier(tier),
      status: sub?.status ?? null,
      currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
      cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    },
  }
}

async function loadSales(userId: string, monthStart: Date, trendStart: Date) {
  const membership = await prisma.sfaMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: Object.keys(SFA_ROLES) } },
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership) return null
  const orgId = membership.organizationId
  const slug = membership.organization.slug
  const now = new Date()

  const [deals, wonForTrend, pipeline, openTasks, overdueTasks, newLeads, upcomingTasks] = await Promise.all([
    prisma.sfaDeal.findMany({
      where: { organizationId: orgId, isActive: true, OR: [{ status: 'open' }, { status: 'won', wonAt: { gte: monthStart } }] },
      select: { id: true, name: true, amount: true, probability: true, status: true, stageId: true, expectedCloseDate: true },
      take: 2000,
    }),
    prisma.sfaDeal.findMany({
      where: { organizationId: orgId, isActive: true, status: 'won', wonAt: { gte: trendStart } },
      select: { amount: true, wonAt: true },
      take: 5000,
    }),
    prisma.sfaPipeline.findFirst({
      where: { organizationId: orgId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { stages: { orderBy: { order: 'asc' } } },
    }),
    prisma.sfaTask.count({ where: { organizationId: orgId, status: 'open' } }),
    prisma.sfaTask.count({ where: { organizationId: orgId, status: 'open', dueDate: { lt: now } } }),
    prisma.sfaLead.count({ where: { organizationId: orgId, isActive: true, createdAt: { gte: monthStart } } }),
    prisma.sfaTask.findMany({
      where: { organizationId: orgId, status: 'open', dueDate: { not: null } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, dueDate: true },
      take: 20,
    }),
  ])

  const open = deals.filter((d) => d.status === 'open')
  const won = deals.filter((d) => d.status === 'won')
  const stageList = pipeline?.stages ?? []
  const stages = stageList
    .filter((s) => !s.isWon && !s.isLost)
    .map((s) => {
      const inStage = open.filter((d) => d.stageId === s.id)
      return {
        name: s.name,
        color: s.color,
        count: inStage.length,
        amount: inStage.reduce((a, d) => a + toNum(d.amount), 0),
      }
    })

  return {
    orgName: membership.organization.name,
    slug,
    wonThisMonth: won.reduce((a, d) => a + toNum(d.amount), 0),
    wonCountThisMonth: won.length,
    openPipeline: open.reduce((a, d) => a + toNum(d.amount), 0),
    weightedPipeline: Math.round(open.reduce((a, d) => a + (toNum(d.amount) * Math.min(100, Math.max(0, d.probability))) / 100, 0)),
    openDeals: open.length,
    stages,
    openTasks,
    overdueTasks,
    newLeads,
    wonForTrend: wonForTrend.map((d) => ({ amount: toNum(d.amount), at: d.wonAt! })),
    events: [
      ...open
        .filter((d) => d.expectedCloseDate)
        .map((d) => ({ id: `deal-${d.id}`, date: d.expectedCloseDate!.toISOString(), title: `受注予定: ${d.name}`, kind: 'deal' as const, href: `/sfa/${slug}/deals` })),
      ...upcomingTasks.map((t) => ({ id: `task-${t.id}`, date: t.dueDate!.toISOString(), title: t.title, kind: 'task' as const, href: `/sfa/${slug}/tasks` })),
    ],
  }
}

async function loadQuotes(userId: string, monthStart: Date, trendStart: Date) {
  const membership =
    (await prisma.quoteMember.findFirst({
      where: { userId, status: 'ACTIVE', role: 'owner' },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.quoteMember.findFirst({
      where: { userId, status: 'ACTIVE', role: { in: QUOTE_ROLES } },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    }))
  if (!membership) return null
  const orgId = membership.organizationId
  const [confirmed, draftCount, sentCount, expiring] = await Promise.all([
    prisma.quoteDocument.findMany({
      where: { organizationId: orgId, status: { in: ['confirmed', 'sent'] }, confirmedAt: { gte: trendStart } },
      select: { totalExclTax: true, confirmedAt: true },
      take: 5000,
    }),
    prisma.quoteDocument.count({ where: { organizationId: orgId, status: 'draft' } }),
    prisma.quoteDocument.count({ where: { organizationId: orgId, status: 'sent' } }),
    prisma.quoteDocument.findMany({
      where: { organizationId: orgId, status: 'sent', expiryDate: { gte: new Date() } },
      orderBy: { expiryDate: 'asc' },
      select: { id: true, title: true, expiryDate: true },
      take: 10,
    }),
  ])
  return {
    orgName: membership.organization.name,
    confirmedThisMonth: confirmed.filter((q) => q.confirmedAt && q.confirmedAt >= monthStart).reduce((a, q) => a + toNum(q.totalExclTax), 0),
    draftCount,
    sentCount,
    forTrend: confirmed.map((q) => ({ amount: toNum(q.totalExclTax), at: q.confirmedAt! })),
    events: expiring.map((q) => ({ id: `quote-${q.id}`, date: q.expiryDate.toISOString(), title: `見積の有効期限: ${q.title}`, kind: 'quote' as const, href: `/quote/documents/${q.id}` })),
  }
}

async function loadProjects(userId: string) {
  const membership = await prisma.promaneMember.findFirst({
    where: { userId, isActive: true, role: { in: PROMANE_ROLES } },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) return null
  const ws = membership.workspace
  const [projects, members] = await Promise.all([
    prisma.promaneProject.findMany({
      where: { workspaceId: ws.id },
      select: {
        id: true, name: true, status: true, contractAmount: true, endDate: true,
        expenses: { select: { amount: true } },
        tasks: { select: { id: true, status: true } },
      },
      take: 500,
    }),
    prisma.promaneMember.findMany({
      where: { workspaceId: ws.id },
      select: { hourlyRate: true, timeEntries: { select: { duration: true, hourlyRateSnapshot: true, projectId: true, taskId: true } } },
    }),
  ])
  const safe = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? 0 : Math.max(0, n))
  const rows = projects.map((p) => {
    const taskIds = p.tasks.map((t) => t.id)
    let labor = 0
    for (const m of members) {
      for (const te of m.timeEntries) {
        if (timeEntryBelongsToProject(te, p.id, taskIds)) labor += laborCostForEntry(te, m.hourlyRate)
      }
    }
    const expense = p.expenses.reduce((a, e) => a + safe(e.amount), 0)
    const revenue = safe(p.contractAmount)
    return { ...p, revenue, cost: Math.round(labor + expense), profit: Math.round(revenue - labor - expense) }
  })
  const active = rows.filter((p) => p.status === 'ordered' || p.status === 'in_progress')
  return {
    href: `/promane/${ws.slug}/reports`,
    activeProjects: active.length,
    revenue: rows.reduce((a, p) => a + p.revenue, 0),
    cost: rows.reduce((a, p) => a + p.cost, 0),
    profit: rows.reduce((a, p) => a + p.profit, 0),
    openTasks: rows.reduce((a, p) => a + p.tasks.filter((t) => t.status !== 'done').length, 0),
    top: [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((p) => ({ name: p.name, revenue: p.revenue, profit: p.profit })),
    events: rows
      .filter((p) => p.endDate && !CLOSED_PROJECT_STATUSES.includes(p.status))
      .map((p) => ({ id: `project-${p.id}`, date: p.endDate!.toISOString(), title: `納期: ${p.name}`, kind: 'project' as const, href: `/promane/${ws.slug}/projects/${p.id}` })),
  }
}

async function loadAttendance(userId: string, monthStart: Date) {
  const membership = await prisma.kintaiMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership?.employee) return null
  const isAdmin = membership.employee.isActive && KINTAI_ADMIN_ROLES.includes(membership.role)
  const employeeWhere = isAdmin
    ? { employee: { organizationId: membership.organizationId } }
    : { employeeId: membership.employee.id }
  const [agg, pendingRequests, employees] = await Promise.all([
    prisma.kintaiAttendance.aggregate({
      where: { ...employeeWhere, date: { gte: monthStart } },
      _sum: { workMinutes: true, overtimeMinutes: true },
    }),
    prisma.kintaiRequest.count({ where: { ...employeeWhere, status: 'pending' } }),
    isAdmin
      ? prisma.kintaiEmployee.count({ where: { organizationId: membership.organizationId, isActive: true } })
      : Promise.resolve(1),
  ])
  return {
    scope: (isAdmin ? 'org' : 'self') as 'org' | 'self',
    workHoursThisMonth: Math.round(((agg._sum.workMinutes ?? 0) / 60) * 10) / 10,
    overtimeHoursThisMonth: Math.round(((agg._sum.overtimeMinutes ?? 0) / 60) * 10) / 10,
    pendingRequests,
    employees,
  }
}

async function loadPeople(userId: string) {
  const membership = await prisma.hrOrganizationMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: Object.keys(HR_ROLES) } },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership) return null
  const [activeEmployees, departments] = await Promise.all([
    prisma.hrEmployee.count({ where: { organizationId: membership.organizationId, status: 'ACTIVE' } }),
    prisma.hrDepartment.count({ where: { organizationId: membership.organizationId } }),
  ])
  return { activeEmployees, departments }
}

/**
 * ログに出してよいのは、例外の種類（name）と Prisma のエラーコード（code）だけ。
 * ⚠️ 例外そのものや message を console に出さない（個人情報やSQLが混ざるため。verify-api-error-log-privacy）。
 */
export function safeErrorInfo(reason: unknown): { name: string; code?: string } {
  const name = reason instanceof Error ? reason.name : typeof reason
  const raw = typeof reason === 'object' && reason !== null ? (reason as { code?: unknown }).code : undefined
  return typeof raw === 'string' ? { name, code: raw } : { name }
}

function settle<T>(r: PromiseSettledResult<T | null>): { state: HomeToolState; value: T | null } {
  if (r.status === 'rejected') {
    console.error('[home/summary] tool load failed', safeErrorInfo(r.reason))
    return { state: 'error', value: null }
  }
  return { state: r.value ? 'ready' : 'empty', value: r.value }
}

export async function getHomeSummary(userId: string): Promise<HomeSummary> {
  const monthStart = jstStartOfMonthUtc()
  const months = lastMonths(6)
  const trendStart = months[0].start

  const [contractR, salesR, quotesR, projectsR, attendanceR, peopleR] = await Promise.allSettled([
    loadContract(userId),
    loadSales(userId, monthStart, trendStart),
    loadQuotes(userId, monthStart, trendStart),
    loadProjects(userId),
    loadAttendance(userId, monthStart),
    loadPeople(userId),
  ])

  const contract = contractR.status === 'fulfilled' ? contractR.value : null
  if (contractR.status === 'rejected') console.error('[home/summary] contract load failed', safeErrorInfo(contractR.reason))
  const sales = settle(salesR)
  const quotes = settle(quotesR)
  const projects = settle(projectsR)
  const attendance = settle(attendanceR)
  const people = settle(peopleR)

  const trend: HomeMonthPoint[] = months.map(({ key }) => ({ month: key, won: 0, quoted: 0 }))
  const byKey = new Map(trend.map((p) => [p.month, p]))
  for (const d of sales.value?.wonForTrend ?? []) {
    const p = byKey.get(jstMonthKey(d.at))
    if (p) p.won += d.amount
  }
  for (const q of quotes.value?.forTrend ?? []) {
    const p = byKey.get(jstMonthKey(q.at))
    if (p) p.quoted += q.amount
  }

  const now = Date.now()
  const horizon = now + 45 * 86400_000
  const events = [...(sales.value?.events ?? []), ...(quotes.value?.events ?? []), ...(projects.value?.events ?? [])]
    .filter((e) => {
      const t = new Date(e.date).getTime()
      return t >= now - 7 * 86400_000 && t <= horizon
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40)

  const s = sales.value
  const q = quotes.value
  const p = projects.value
  const a = attendance.value
  const h = people.value

  return {
    generatedAt: new Date().toISOString(),
    sources: { revenue: 'sfa_quote', cost: 'promane' },
    user: contract?.user ?? { name: null, email: null },
    contract: contract?.contract ?? {
      tier: 'FREE', label: planLabel('FREE'), paid: false, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
    },
    sales: {
      state: sales.state,
      orgName: s?.orgName,
      href: s ? `/sfa/${s.slug}` : '/sfa',
      wonThisMonth: s?.wonThisMonth ?? 0,
      wonCountThisMonth: s?.wonCountThisMonth ?? 0,
      openPipeline: s?.openPipeline ?? 0,
      weightedPipeline: s?.weightedPipeline ?? 0,
      openDeals: s?.openDeals ?? 0,
      stages: s?.stages ?? [],
      openTasks: s?.openTasks ?? 0,
      overdueTasks: s?.overdueTasks ?? 0,
      newLeads: s?.newLeads ?? 0,
    },
    quotes: {
      state: quotes.state,
      orgName: q?.orgName,
      href: '/quote',
      confirmedThisMonth: q?.confirmedThisMonth ?? 0,
      draftCount: q?.draftCount ?? 0,
      sentCount: q?.sentCount ?? 0,
    },
    projects: {
      state: projects.state,
      href: p?.href ?? '/promane',
      activeProjects: p?.activeProjects ?? 0,
      revenue: p?.revenue ?? 0,
      cost: p?.cost ?? 0,
      profit: p?.profit ?? 0,
      openTasks: p?.openTasks ?? 0,
      top: p?.top ?? [],
    },
    attendance: {
      state: attendance.state,
      href: '/kintai/dashboard',
      scope: a?.scope ?? 'self',
      workHoursThisMonth: a?.workHoursThisMonth ?? 0,
      overtimeHoursThisMonth: a?.overtimeHoursThisMonth ?? 0,
      pendingRequests: a?.pendingRequests ?? 0,
      employees: a?.employees ?? 0,
    },
    people: {
      state: people.state,
      href: '/hr/dashboard',
      activeEmployees: h?.activeEmployees ?? 0,
      departments: h?.departments ?? 0,
    },
    trend,
    events,
  }
}
