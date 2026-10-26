// ============================================
// ドヤ収入管理: 経営エージェントの道具（ADDON-SERVICES §5 / README §8.2）
// ============================================
// ⚠️ ここは定義と呼び先だけ。登録（src/services/income/manifest.ts の agentTools[]）は Phase0 で移す。
// ⚠️ run は API と同じ lib 関数を呼ぶ（R-4）。画面の API を経由しない。
// ⚠️ 承認: irreversible は常に承認（issueInvoice）。reversible × none は会社設定 approveDrafts 次第。read は不要。
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { IncomeError, audit, hasMinRole, type IncomeContext, type IncomeRole } from './access'
import { listCalendarEvents } from './calendar-read'
import { fromDbDate, isMonthKey, isYmd, todayJst } from './dates'
import { buildDunningDraft } from './dunning'
import { confirmInvoiceWithRetry, draftFromSchedules, paymentState } from './invoices'
import { buildSummary } from './summary-read'

type Reversibility = 'read' | 'reversible' | 'irreversible'
type CostClass = 'none' | 'low' | 'high'
type DownstreamIdempotency = 'native' | 'local-record' | 'none'

export type IncomeAgentTool<I extends z.ZodTypeAny = z.ZodTypeAny> = {
  key: `income.${string}`
  /** LLM に渡す名前（^[a-zA-Z0-9_-]{1,64}$） */
  providerName: string
  serviceId: 'income'
  description: string
  minServiceRole: IncomeRole
  reversibility: Reversibility
  costClass: CostClass
  estimatedPaidCalls: number
  sensitive: boolean
  downstreamIdempotency: DownstreamIdempotency
  /** irreversible は常に true。それ以外は会社設定で決まる（ここは既定値） */
  requiresApproval: boolean
  input: I
  timeoutMs: number
  run(ctx: IncomeContext, input: z.infer<I>): Promise<unknown>
}

function guard(ctx: IncomeContext, tool: { minServiceRole: IncomeRole }) {
  if (!hasMinRole(ctx.role, tool.minServiceRole)) throw new IncomeError('この操作の権限がありません', 403)
}

const monthInput = z.object({ month: z.string().refine(isMonthKey, '月は YYYY-MM').optional() })

export const incomeSummaryTool: IncomeAgentTool<typeof monthInput> = {
  key: 'income.summary',
  providerName: 'income__summary',
  serviceId: 'income',
  description: '今月（または指定月）の売上予定・請求済・入金済・未入金と、請求漏れ・入金遅延・更新期限の一覧を返す',
  minServiceRole: 'member',
  reversibility: 'read',
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  downstreamIdempotency: 'none',
  requiresApproval: false,
  input: monthInput,
  timeoutMs: 15_000,
  async run(ctx, input) {
    guard(ctx, this)
    const s = await buildSummary(ctx, input.month ?? todayJst().slice(0, 7))
    // planner には要約だけ渡す（推移の全月・カテゴリ内訳は渡さない）
    return { month: s.month, kpi: s.kpi, actions: s.actions.slice(0, 20), expenseConnected: s.expense.connected }
  },
}

const rangeInput = z.object({
  from: z.string().refine(isYmd, '日付は YYYY-MM-DD'),
  to: z.string().refine(isYmd, '日付は YYYY-MM-DD'),
})

export const incomeCalendarTool: IncomeAgentTool<typeof rangeInput> = {
  key: 'income.listCalendarEvents',
  providerName: 'income__listCalendarEvents',
  serviceId: 'income',
  description: '期間内の請求予定日・支払期日・解約予告期限・契約終了日を返す',
  minServiceRole: 'member',
  reversibility: 'read',
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  downstreamIdempotency: 'none',
  requiresApproval: false,
  input: rangeInput,
  timeoutMs: 15_000,
  async run(ctx, input) {
    guard(ctx, this)
    return { events: await listCalendarEvents(ctx, input.from, input.to) }
  },
}

const draftInvoiceInput = z.object({
  scheduleIds: z.array(z.string().min(1).max(64)).min(1).max(50),
  issueDate: z.string().refine(isYmd, '日付は YYYY-MM-DD').optional(),
})

export const incomeDraftInvoiceTool: IncomeAgentTool<typeof draftInvoiceInput> = {
  key: 'income.draftInvoice',
  providerName: 'income__draftInvoice',
  serviceId: 'income',
  description: '未請求の売上予定から、取引先ごとに請求書の下書きを作る（番号は付けない。発行は income.issueInvoice）',
  minServiceRole: 'member',
  reversibility: 'reversible',
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  // 同じ予定は 2 回請求できない（claimSchedules が状態で止める）。結果は ToolCall に記録する
  downstreamIdempotency: 'local-record',
  requiresApproval: false,
  input: draftInvoiceInput,
  timeoutMs: 30_000,
  async run(ctx, input) {
    guard(ctx, this)
    const ids = await prisma.$transaction((tx) => draftFromSchedules(tx, ctx, input.scheduleIds, input.issueDate ?? todayJst()), { timeout: 30000, isolationLevel: 'Serializable' })
    for (const id of ids) await audit(prisma, ctx, 'invoice.create', 'invoice', id, { from: 'agent' })
    return { invoiceIds: ids, hrefs: ids.map((id) => `/income/invoices/${id}`) }
  },
}

const issueInput = z.object({ invoiceId: z.string().min(1).max(64) })

export const incomeIssueInvoiceTool: IncomeAgentTool<typeof issueInput> = {
  key: 'income.issueInvoice',
  providerName: 'income__issueInvoice',
  serviceId: 'income',
  description: '請求書の下書きを確定し、請求書番号を採番する。確定後は編集できず、番号は戻せない',
  minServiceRole: 'manager',
  reversibility: 'irreversible',
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  // 2 回目は「下書きではない」で止まる（状態で冪等）
  downstreamIdempotency: 'local-record',
  requiresApproval: true,
  input: issueInput,
  timeoutMs: 15_000,
  async run(ctx, input) {
    guard(ctx, this)
    const inv = await confirmInvoiceWithRetry(prisma, ctx, input.invoiceId)
    await audit(prisma, ctx, 'invoice.confirm', 'invoice', inv.id, { invoiceNo: inv.invoiceNo, from: 'agent' })
    return { invoiceId: inv.id, invoiceNo: inv.invoiceNo, href: `/income/invoices/${inv.id}` }
  },
}

export const incomeDraftDunningTool: IncomeAgentTool<typeof issueInput> = {
  key: 'income.draftDunning',
  providerName: 'income__draftDunning',
  serviceId: 'income',
  description: '支払期日を過ぎた請求書の督促メールの文面を下書きする（送信はしない）',
  minServiceRole: 'manager',
  reversibility: 'reversible',
  // Phase1 は定型文で作るので費用なし。Phase2 で AI 下書きにしたら low（1 回）に変える
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  // 書き込みはしないが、read 以外は冪等の宣言が要る（README §8.2 M-8）。下書きは ToolCall に記録する
  downstreamIdempotency: 'local-record',
  requiresApproval: false,
  input: issueInput,
  timeoutMs: 15_000,
  async run(ctx, input) {
    guard(ctx, this)
    const inv = await prisma.incomeInvoice.findFirst({ where: { id: input.invoiceId, organizationId: ctx.organizationId }, include: { client: true } })
    if (!inv) throw new IncomeError('請求書が見つかりません', 404)
    const state = paymentState(inv)
    if (!inv.invoiceNo || !state.overdue) throw new IncomeError('支払期日を過ぎた未入金の請求書ではありません', 409)
    const issuer = (inv.issuerSnapshot ?? {}) as { companyName?: string; personName?: string | null }
    const draft = buildDunningDraft({
      clientName: inv.client.name,
      contactName: inv.client.billingContactName,
      invoiceNo: inv.invoiceNo,
      issueDate: fromDbDate(inv.issueDate),
      dueDate: fromDbDate(inv.dueDate),
      remaining: state.remaining,
      issuerName: issuer.companyName ?? ctx.organizationName,
      issuerPerson: issuer.personName ?? null,
      today: todayJst(),
    })
    return { ...draft, to: inv.client.billingEmail }
  },
}

export const INCOME_AGENT_TOOLS = [incomeSummaryTool, incomeCalendarTool, incomeDraftInvoiceTool, incomeIssueInvoiceTool, incomeDraftDunningTool] as const
