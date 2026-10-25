// ============================================
// ドヤパワーの追加購入（一回払い）— Checkout の作成と、付与（サーバーだけ）
// ============================================
// 付与の経路は2つ（どちらも同じ関数 fulfillPowerPackSession を通る。決済の ID を sourceKey にして1回だけ付ける）:
//   1. 決済の直後: /pricing?power_pack=done&cs=... から /api/pricing/power-pack/confirm
//   2. Webhook: checkout.session.completed（mode=payment・metadata.kind=power_pack）
// ⚠️ 決済の直後の戻り先に success=true&session_id= を付けない（ルートレイアウトの StripeSuccessSync が、契約の同期と取り違える）。
// ⚠️ 買った分の有効期限は6か月以内（台帳の clampPurchaseExpiresAt。前払式支払手段の扱いを避けるため。法務の確認が要る）。
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { stripe, createCheckoutSession } from '@/lib/stripe'
import { isPaidPlan } from '@/lib/unified-plan'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { POWER_PACK } from './plans'
import { powerPackPriceId, POWER_PACK_MAX_PER_ORDER } from './prices'

export const POWER_PACK_KIND = 'power_pack'

export function isValidPackCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= POWER_PACK_MAX_PER_ORDER
}

export type PackCheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; status: number; code: 'NOT_CONFIGURED' | 'LEDGER_OFF' | 'OWNER_REQUIRED' | 'PAID_PLAN_REQUIRED' | 'INVALID_PACKS'; error: string }

/** 追加購入の Checkout を作る。会社の持ち主で、有料の人だけ */
export async function createPowerPackCheckout(input: { userId: string; email: string; packs: unknown; baseUrl: string }): Promise<PackCheckoutResult> {
  const priceId = powerPackPriceId()
  if (!priceId) return { ok: false, status: 503, code: 'NOT_CONFIGURED', error: '追加購入の準備をしています。時間をおいて再度お試しください。' }
  if (!doyaPowerLedgerAllowed()) return { ok: false, status: 404, code: 'LEDGER_OFF', error: '見つかりません。' }
  if (!isValidPackCount(input.packs)) return { ok: false, status: 400, code: 'INVALID_PACKS', error: `1回に買えるのは${POWER_PACK_MAX_PER_ORDER}パックまでです。` }
  const company = await prisma.accountCompany.findUnique({ where: { userId: input.userId }, select: { id: true, user: { select: { plan: true } } } })
  if (!company) return { ok: false, status: 403, code: 'OWNER_REQUIRED', error: '追加購入は、会社の持ち主の方だけができます。先に会社を登録してください。' }
  if (!isPaidPlan(company.user?.plan)) return { ok: false, status: 403, code: 'PAID_PLAN_REQUIRED', error: '追加購入は、有料のプランの方だけができます。' }
  const packs = input.packs
  const session = await createCheckoutSession({
    mode: 'payment',
    priceId,
    lineItems: [{ price: priceId, quantity: packs }],
    userId: input.userId,
    userEmail: input.email,
    successUrl: `${input.baseUrl}/pricing?power_pack=done&cs={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${input.baseUrl}/pricing?power_pack=cancel`,
    metadata: { kind: POWER_PACK_KIND, companyId: company.id, packs: String(packs), points: String(packs * POWER_PACK.points) },
    idempotencyKey: `doya-power-pack:${input.userId}:${packs}:${Math.floor(Date.now() / 60_000)}`,
  })
  if (!session.url) throw new Error('power pack checkout has no url')
  return { ok: true, url: session.url, sessionId: session.id }
}

export type FulfillResult =
  | { ok: true; points: number; duplicated: boolean }
  | { ok: false; reason: 'not_power_pack' | 'not_paid' | 'mismatch' | 'ledger_off' | 'grant_failed' }

/**
 * 支払いが済んだ追加購入に、ドヤパワーを付ける（同じ決済には1回だけ）。
 * expectUserId を渡したときは、決済の持ち主がその人であることも確かめる（決済の直後の経路）。
 */
export async function fulfillPowerPackSession(sessionOrId: string | Stripe.Checkout.Session, expectUserId?: string): Promise<FulfillResult> {
  const session = typeof sessionOrId === 'string' ? await stripe.checkout.sessions.retrieve(sessionOrId) : sessionOrId
  const md = session.metadata ?? {}
  if (session.mode !== 'payment' || md.app !== 'doya-ai' || md.kind !== POWER_PACK_KIND) return { ok: false, reason: 'not_power_pack' }
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not_paid' }
  const userId = md.userId || session.client_reference_id || ''
  const packs = Number(md.packs)
  if (!userId || !md.companyId || !isValidPackCount(packs) || (expectUserId && expectUserId !== userId)) return { ok: false, reason: 'mismatch' }
  // 会社が、決済した人の会社であること
  const company = await prisma.accountCompany.findUnique({ where: { id: md.companyId }, select: { userId: true } })
  if (!company || company.userId !== userId) return { ok: false, reason: 'mismatch' }
  // 明細が、追加購入の価格 × パックの数であること（metadata だけを信じない）
  const priceId = powerPackPriceId()
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 })
  const qty = items.data.filter((i) => i.price?.id === priceId).reduce((s, i) => s + (i.quantity ?? 0), 0)
  if (!priceId || qty !== packs || items.data.length !== 1) return { ok: false, reason: 'mismatch' }
  if (!doyaPowerLedgerAllowed()) return { ok: false, reason: 'ledger_off' }
  const { grant } = await import('@/lib/doya-power')
  const r = await grant(md.companyId, 'purchase', packs * POWER_PACK.points, null, { sourceKey: `purchase:${session.id}`, note: 'power-pack' })
  if (!r.ok) return { ok: false, reason: 'grant_failed' }
  return { ok: true, points: r.granted, duplicated: r.duplicated }
}
