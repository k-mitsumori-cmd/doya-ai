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
import { POWER_PACK, withTax } from './plans'
import { sendEventNotification } from '@/lib/notifications'
import { notifyAlert } from '@/lib/alert'
import { powerPackPriceId, POWER_PACK_MAX_PER_ORDER } from './prices'
import { recordPowerPackReceipt } from './power-pack-receipt'

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
    // 割引コードは使えない（値引きした額でポイントだけが付くのを防ぐ。付けるときも支払いの額を確かめる）
    allowPromotionCodes: false,
  })
  if (!session.url) throw new Error('power pack checkout has no url')
  return { ok: true, url: session.url, sessionId: session.id }
}

export type FulfillResult =
  | { ok: true; points: number; duplicated: boolean; refundedPoints?: number }
  | { ok: false; reason: 'not_power_pack' | 'not_paid' | 'mismatch' | 'ledger_off' | 'grant_failed' }

/**
 * 支払いが済んだ追加購入に、ドヤパワーを付ける（同じ決済には1回だけ）。
 * expectUserId を渡したときは、決済の持ち主がその人であることも確かめる（決済の直後の経路）。
 */
async function verifyPowerPackSession(session: Stripe.Checkout.Session, expectUserId: string | undefined, requirePaid: boolean): Promise<{ ok: true; userId: string; packs: number } | { ok: false; reason: 'not_power_pack' | 'not_paid' | 'mismatch' }> {
  const md = session.metadata ?? {}
  if (session.mode !== 'payment' || md.app !== 'doya-ai' || md.kind !== POWER_PACK_KIND) return { ok: false, reason: 'not_power_pack' }
  if (requirePaid && session.payment_status !== 'paid') return { ok: false, reason: 'not_paid' }
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
  // 支払いの額が、税込の単価 × パックの数と同じであること（割引・価格の設定の誤りで、少ない額のままポイントが付かないように）
  if (session.currency !== 'jpy' || session.amount_total !== packs * withTax(POWER_PACK.price)) return { ok: false, reason: 'mismatch' }
  return { ok: true, userId, packs }
}

/** A paid Checkout can already be refunded. Read the authoritative charge before (re)fulfillment. */
async function currentCashRefund(session: Stripe.Checkout.Session, paymentIntentId: string): Promise<{ ok: true; refunded: number } | { ok: false }> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })
  if (intent.id !== paymentIntentId) return { ok: false }
  if (!intent.latest_charge) throw new Error('Paid purchase charge is not available yet')
  const expectedChargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id
  const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge
  if (!expectedChargeId || charge.id !== expectedChargeId) return { ok: false }
  const chargeIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (chargeIntent !== paymentIntentId || charge.paid !== true || charge.currency !== 'jpy' || charge.amount !== session.amount_total || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount) return { ok: false }
  return { ok: true, refunded: charge.amount_refunded }
}

export async function fulfillPowerPackSession(sessionOrId: string | Stripe.Checkout.Session, expectUserId?: string): Promise<FulfillResult> {
  const session = typeof sessionOrId === 'string' ? await stripe.checkout.sessions.retrieve(sessionOrId) : sessionOrId
  const verified = await verifyPowerPackSession(session, expectUserId, true)
  if (!verified.ok) return verified
  const { userId, packs } = verified
  const md = session.metadata ?? {}
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId || typeof session.amount_total !== 'number') return { ok: false, reason: 'mismatch' }
  const cash = await currentCashRefund(session, paymentIntentId)
  if (!cash.ok) return { ok: false, reason: 'mismatch' }
  const purchase = await recordPowerPackReceipt(prisma, { companyId: md.companyId, sourceKey: `purchase:${session.id}`, amount: packs * POWER_PACK.points, cashAmount: session.amount_total, cashRefunded: cash.refunded, paymentIntentId })
  if (!purchase.ok) return { ok: false, reason: 'mismatch' }
  if (!doyaPowerLedgerAllowed()) return { ok: false, reason: 'ledger_off' }
  const { grant } = await import('@/lib/doya-power')
  const r = await grant(md.companyId, 'purchase', packs * POWER_PACK.points, null, { sourceKey: `purchase:${session.id}`, note: 'power-pack', trackPurchase: true })
  if (!r.ok) return { ok: false, reason: 'grant_failed' }
  // 運営への知らせは、初めて付けたときだけ（2つの経路のどちらか一方。メールは伏せ字で出る）
  const refundedPoints = r.cashRefundTarget ?? 0
  if (!Number.isSafeInteger(refundedPoints) || refundedPoints < 0 || refundedPoints > r.granted) return { ok: false, reason: 'grant_failed' }
  if (!r.duplicated && refundedPoints === 0) {
    void sendEventNotification({ type: 'payment', userId, userEmail: session.customer_details?.email ?? session.customer_email ?? null, details: `ドヤパワーの追加購入（${(packs * POWER_PACK.points).toLocaleString('ja-JP')}）` })
  }
  return { ok: true, points: r.granted - refundedPoints, refundedPoints, duplicated: r.duplicated }
}

/**
 * Webhook で付けられなかった追加購入を、運営に知らせる（直せない失敗。Stripe に再送させても直らないもの）。
 * 知らせられたら true。知らせられなければ false（呼ぶ側が例外にして、Stripe の再送で知らせ直す）。
 */
export async function reportPowerPackFailure(sessionId: string, reason: string): Promise<boolean> {
  return notifyAlert({
    title: 'ドヤパワーの追加購入を付けられませんでした（支払いは済んでいる可能性があります）',
    level: 'critical',
    kind: 'billing',
    detail: '支払い済みの追加購入を反映できませんでした。元の決済IDと会社IDを確認し、/api/admin/doya-power/purchase/replay で再処理してください（管理者認証と台帳の再開が必要です）。返金履歴も再確認し、同じ購入から返金分を除いて反映します。量を指定した調整付与で、返金済みのポイントを戻さないでください。',
    extra: { 決済: sessionId, 理由: reason },
  }).catch(() => false)
}

export type PackRefundResult =
  | { handled: false }
  | { handled: true; ok: true; sessionId: string; revoked: number; uncollected: number; pendingGrant?: boolean; pendingLedger?: boolean }
  | { handled: true; ok: false; sessionId: string; reason: 'mismatch' | 'ledger_off' | 'not_found' | 'invalid' }

/**
 * 返金された決済が追加購入なら、返金の累計に見合うドヤパワーをその購入の分から減らす（Webhook の charge.refunded）。
 * 追加購入でない返金は何もしない。量は累計で渡すので、知らせが重なっても二重に減らない。
 */
export async function revokePowerPackForCharge(charge: Stripe.Charge): Promise<PackRefundResult> {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntent) return { handled: false }
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 })
  const session = sessions.data[0]
  const md = session?.metadata ?? {}
  if (!session || session.mode !== 'payment' || md.app !== 'doya-ai' || md.kind !== POWER_PACK_KIND) return { handled: false }
  const verified = await verifyPowerPackSession(session, undefined, false)
  if (!verified.ok) return { handled: true, ok: false, sessionId: session.id, reason: 'mismatch' }
  const { packs } = verified
  const sessionIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (sessionIntent !== paymentIntent || charge.currency !== 'jpy' || charge.amount !== session.amount_total || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount) return { handled: true, ok: false, sessionId: session.id, reason: 'mismatch' }
  const purchase = await recordPowerPackReceipt(prisma, { companyId: md.companyId, sourceKey: `purchase:${session.id}`, amount: packs * POWER_PACK.points, cashAmount: charge.amount, cashRefunded: charge.amount_refunded, paymentIntentId: paymentIntent })
  if (!purchase.ok) return { handled: true, ok: false, sessionId: session.id, reason: 'mismatch' }
  // The verified cash fact is durable. Do not touch point tables while their ledger is off.
  if (!doyaPowerLedgerAllowed()) return { handled: true, ok: true, sessionId: session.id, revoked: 0, uncollected: 0, pendingLedger: true }
  const target = purchase.receipt.cancelTarget
  const { revokeGrant } = await import('@/lib/doya-power')
  const r = await revokeGrant(md.companyId, `purchase:${session.id}`, target, { note: `stripe-refund:${charge.id}`, expectedAmount: packs * POWER_PACK.points })
  if (!r.ok) return { handled: true, ok: false, sessionId: session.id, reason: r.reason }
  return { handled: true, ok: true, sessionId: session.id, revoked: r.revoked, uncollected: r.uncollected, ...(r.pendingGrant ? { pendingGrant: true } : {}) }
}

/**
 * 返金のあとに減らせなかった分を、運営に知らせる。知らせられたら true。
 * reason は処理の失敗の理由。使い済みで減らせなかったときは uncollected に量を渡す。
 */
export async function reportPowerPackRefundIssue(sessionId: string, issue: { reason?: string; uncollected?: number }): Promise<boolean> {
  return notifyAlert({
    title: 'ドヤパワーの追加購入の返金で、減らせなかった分があります',
    level: 'critical',
    kind: 'billing',
    detail: '返金された追加購入のドヤパワーを、全部は減らせませんでした。Stripe の返金と台帳を確かめ、残りの扱いを決めてください。自動では、ほかの付与から減らしません。',
    extra: { 決済: sessionId, ...(issue.reason ? { 理由: issue.reason } : {}), ...(issue.uncollected ? { 減らせなかった量: String(issue.uncollected) } : {}) },
  }).catch(() => false)
}
