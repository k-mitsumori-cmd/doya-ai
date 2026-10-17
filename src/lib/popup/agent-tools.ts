// ============================================
// ドヤポップアップ: エージェントの道具（統合仕様 ADDON-SERVICES-2026-10-18 §5）
// ============================================
// 形は README §16.1 の agentTools[] に合わせる（Phase0 で src/services/popup/manifest.ts に移す）。
// 区分と承認は §8.2 / §18.5 の規則どおり:
//   - popup.stats         … 読むだけ（承認不要）
//   - popup.proposeDrafts … 下書きを作る（取り消せる・テキストAIを4〜8回。承認は設定次第）
//   - popup.publish       … 公開すると外部のサイトに表示が出る（取り消せない扱い・承認必須）
// ⚠️ run は API と同じ lib 関数を呼ぶ（popup-read / propose / popup-write）。ここで処理を書き直さない。
import { z } from 'zod'

export interface PopupToolCtx {
  userId: string
}

export interface PopupAgentTool<I extends z.ZodTypeAny = z.ZodTypeAny, O extends z.ZodTypeAny = z.ZodTypeAny> {
  key: string
  providerName: string
  description: string
  minServiceRole: 'member' | 'manager' | 'admin' | 'owner'
  reversibility: 'read' | 'reversible' | 'irreversible'
  costClass: 'none' | 'low' | 'high'
  estimatedPaidCalls: number
  sensitive: boolean
  downstreamIdempotency: 'native' | 'local-record' | 'none'
  creditCost: number
  timeoutMs: number
  /** 実行前に利用者の承認が要るか（irreversible は常に true） */
  requiresApproval: boolean | 'by-setting'
  input: I
  output: O
  run: (ctx: PopupToolCtx, input: z.infer<I>, signal?: AbortSignal) => Promise<z.infer<O>>
}

const statTotals = z.object({ impressions: z.number(), clicks: z.number(), closes: z.number(), ctr: z.number().nullable() }).strict()

const statsInput = z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional() }).strict()
const statsOutput = z
  .object({
    days: z.number(),
    totals: statTotals,
    liveCount: z.number(),
    siteCount: z.number(),
    top: z.array(
      z.object({ popupId: z.string(), siteId: z.string(), name: z.string(), siteName: z.string(), impressions: z.number(), clicks: z.number(), ctr: z.number().nullable() }).strict()
    ),
  })
  .strict()

const proposeInput = z.object({ url: z.string().min(4).max(2000), manualText: z.string().max(3000).optional() }).strict()
const proposeOutput = z
  .object({
    siteId: z.string(),
    siteName: z.string(),
    url: z.string(),
    popups: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string() }).strict()),
  })
  .strict()

const publishInput = z.object({ popupId: z.string().regex(/^[a-z0-9]{20,40}$/i), status: z.enum(['live', 'paused']) }).strict()
const publishOutput = z.object({ popupId: z.string(), status: z.enum(['live', 'paused']), url: z.string() }).strict()

/** エージェントが失敗を利用者に伝えるときの例外。message はそのまま画面に出してよい日本語 */
export class PopupToolError extends Error {
  constructor(message: string, public readonly issues: string[] = []) {
    super(message)
    this.name = 'PopupToolError'
  }
}

export const popupStatsTool: PopupAgentTool<typeof statsInput, typeof statsOutput> = {
  key: 'popup.stats',
  providerName: 'popup__stats',
  description: 'ポップアップの表示数・クリック数・クリック率（直近7/30/90日）と、よく表示されている案を読む',
  minServiceRole: 'member',
  reversibility: 'read',
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  downstreamIdempotency: 'none',
  creditCost: 0,
  timeoutMs: 15_000,
  requiresApproval: false,
  input: statsInput,
  output: statsOutput,
  run: async (ctx, input) => {
    const [{ prisma }, { getPopupSummary }] = await Promise.all([import('@/lib/prisma'), import('./popup-read')])
    return getPopupSummary(prisma, ctx.userId, input.days ?? 7)
  },
}

export const popupProposeDraftsTool: PopupAgentTool<typeof proposeInput, typeof proposeOutput> = {
  key: 'popup.proposeDrafts',
  providerName: 'popup__proposeDrafts',
  description: 'サイトのURLから、そのサイトに合ったポップアップを2〜3案（下書き）作る。公開はしない',
  minServiceRole: 'member',
  reversibility: 'reversible',
  costClass: 'low',
  // 読み取り1＋質問リンク2本（作り直し込みで最大6）＋文言1。実測は4回（2026-10-18 ドヤマーケ）
  estimatedPaidCalls: 8,
  sensitive: false,
  downstreamIdempotency: 'local-record',
  creditCost: 1,
  timeoutMs: 120_000,
  requiresApproval: 'by-setting',
  input: proposeInput,
  output: proposeOutput,
  run: async (ctx, input) => {
    const { proposeForUser } = await import('./propose')
    const r = await proposeForUser(ctx.userId, input)
    if (!r.ok) throw new PopupToolError(r.error)
    return { siteId: r.site.id, siteName: r.site.name, url: `/popup/sites/${r.site.id}`, popups: r.popups }
  },
}

export const popupPublishTool: PopupAgentTool<typeof publishInput, typeof publishOutput> = {
  key: 'popup.publish',
  providerName: 'popup__publish',
  description: 'ポップアップを公開する（設置タグのあるサイトに表示が出る）、または停止する',
  minServiceRole: 'member',
  // 公開すると外部のサイトの訪問者に表示が出る。停止しても見た人の記憶は戻らないので irreversible 扱い
  reversibility: 'irreversible',
  costClass: 'none',
  estimatedPaidCalls: 0,
  sensitive: false,
  downstreamIdempotency: 'native',
  creditCost: 0,
  timeoutMs: 15_000,
  requiresApproval: true,
  input: publishInput,
  output: publishOutput,
  run: async (ctx, input) => {
    const { setPopupStatus } = await import('./popup-write')
    const r = await setPopupStatus(ctx.userId, input.popupId, input.status)
    if (!r.ok) throw new PopupToolError(r.error, r.status === 422 ? r.issues : [])
    return { popupId: r.popup.id, status: input.status, url: `/popup/edit/${r.popup.id}` }
  },
}

export const POPUP_AGENT_TOOLS = [popupStatsTool, popupProposeDraftsTool, popupPublishTool] as const
