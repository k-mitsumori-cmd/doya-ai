// ============================================
// チームの人数（買った人数）の確認と変更 /api/pricing/seats
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404（新しい表も Stripe も読まない）。
// ⚠️ 操作できるのは、チームの契約の持ち主（account_companies.userId）だけ。body の会社や契約の ID は受け取らない。
// ⚠️ 人数の正は Stripe の契約の数量。先に Stripe を変え、そのあと控え（account_company_billing）を書き直す。User.plan は書かない。
// 決まり（team.ts の decideSeatChange）: 増やす → その場で日割りを請求する。支払いが済まなければ人数を変えない（error_if_incomplete）。
//                                       増えた席の分のドヤパワーは、席の番号ごとに月1回・今月の残りの割合で足す（seatAddGrants）。
//                                     減らす → 返金なし。使っている人数（持ち主＋招待中＋参加）より下げられない。
// ⚠️ 新しい確定操作だけ operationKey を作り、再読込・再開・結果確認では元の ID を使う。
//    Stripe の冪等キーと変更内容は会社の永続操作へ保存し、再試行で変えない。
//    招待・受諾・人数の控えと同じ会社ガードを使う。ネットワーク待ちはSQLロックの外。
//    未確定の変更は期限が過ぎても招待を止める。20時間後の check は Stripe 更新を送らず、
//    サーバーで元操作のイベント・支払い・現在の所有契約を照合してからローカルへ反映する。
// ⚠️ Stripe から返った契約の数量が、求めた人数と同じときだけ控えを書き、ドヤパワーを足す。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { newPricingPriceIds, teamPriceConfig } from '@/lib/pricing-v2/prices'
import { subscriberKind } from '@/lib/pricing-v2/view'
import { decideSeatChange, findSeatItem, isValidOperationKey, seatAddGrants } from '@/lib/pricing-v2/team'
import { isTeamSeatCount, teamMonthly, teamMonthlyPoints } from '@/lib/pricing-v2/plans'
import { ownerTeamContext, readOwnerTeamSubscription, saveSeatCache, writeTeamSeatCache, teamSeatsUsed, teamTablesAllowed } from '@/lib/pricing-v2/team.server'
import { beginSeatOperation, cancelSeatPreparation, claimVerifiedSeatReconciliation, finishSeatOperation, inspectSeatReconciliation, pendingSeatChangeForOwner, readCompletedSeatOperation, recordSeatPaymentRejection, recordSeatStripeAttempt, saveSeatPreparationCache, seatCacheRevision, seatPreparationGrantAllowed, SeatOperationError, type SeatOperationClaim, type SeatOperationStart } from '@/lib/pricing-v2/seat-operation'
import { CompanySeatMinimumError, verifyCompanySeatMinimum } from '@/lib/pricing-v2/company-seat-minimum.server'
import { readSeatReconciliationEvidence } from '@/lib/pricing-v2/seat-reconciliation.server'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { jstMonthKey, monthlyGrantExpiresAt } from '@/lib/doya-power/rules'
import { sendEventNotification } from '@/lib/notifications'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

async function context(expectedOwner: string | null = null) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email ?? null
  if (!userId || !email) return { error: json({ error: 'ログインが必要です。' }, 401) }
  if (!isNewPricingEnabledFor(email) || !teamTablesAllowed()) return { error: json({ error: '見つかりません。' }, 404) }
  if (expectedOwner !== null && expectedOwner !== userId) return { error: json({ code: 'OWNER_CHANGED', error: 'ログイン状態が変わりました。画面を読み込み直してください。' }, 403) }
  const ctx = await ownerTeamContext(userId)
  if (!ctx) return { error: json({ code: 'OWNER_REQUIRED', error: '人数を変えられるのは、会社の持ち主の方だけです。' }, 403) }
  const kind = subscriberKind({ plan: ctx.owner.plan, stripePriceId: ctx.owner.stripePriceId, newPriceIds: newPricingPriceIds() })
  if (kind !== 'team') return { error: json({ code: 'NOT_TEAM', error: 'チームプランのご契約がありません。' }, 409) }
  return { ctx }
}

export async function GET(req: NextRequest) {
  try {
    const c = await context(req?.headers?.get('x-doya-owner'))
    if ('error' in c) return c.error
    const pending = await pendingSeatChangeForOwner(c.ctx.companyId)
    if (pending) return json({ pending })
    const revision = await seatCacheRevision(c.ctx.companyId)
    const t = await readOwnerTeamSubscription(c.ctx)
    if (!t) return json({ code: 'NO_TEAM_SUBSCRIPTION', error: 'チームプランのご契約を確認できませんでした。' }, 409)
    await saveSeatCache(c.ctx.companyId, t, revision)
    const used = await teamSeatsUsed(c.ctx.companyId)
    return json({ seats: t.seats, used, interval: t.interval, monthly: teamMonthly(t.seats), points: teamMonthlyPoints(t.seats) })
  } catch {
    console.error('[pricing/seats] could not read seats')
    return json({ error: '人数を確認できませんでした。時間をおいて再度お試しください。' }, 503)
  }
}

export async function POST(req: NextRequest) {
  let stage: 'check' | 'stripe' | 'after' = 'check'
  let claim: SeatOperationClaim | null = null
  let reconciliationOnly = false
  const paymentFailed = () => json({ code: 'PAYMENT_FAILED', error: 'お支払いができなかったため、人数は変えていません。お支払い方法を確かめてください。' }, 402)
  try {
    const c = await context(req?.headers?.get('x-doya-owner'))
    if ('error' in c) return c.error
    const body = await req.json().catch(() => null)
    const mode = body?.mode
    if (mode !== undefined && mode !== 'resume' && mode !== 'check') return json({ code: 'INVALID_ACTION', error: '操作を確認できませんでした。画面を読み込み直してください。' }, 400)
    const requested = body?.seats
    const expectedSeats = body?.expectedSeats
    if (expectedSeats !== undefined && !isTeamSeatCount(expectedSeats)) return json({ code: 'INVALID_CURRENT_SEATS', error: '現在の人数を確認できませんでした。画面を読み込み直してください。' }, 400)
    const operationKey = body?.operationKey
    if (!isValidOperationKey(operationKey)) return json({ code: 'INVALID_OPERATION', error: '画面を読み込み直して、もう一度お試しください。' }, 400)
    if (!isTeamSeatCount(requested)) {
      const enterprise = typeof requested === 'number' && Number.isFinite(requested) && requested >= 50
      return json({ code: enterprise ? 'ENTERPRISE_QUOTE' : 'INVALID_SEATS', error: enterprise ? '50人以上は個別にお見積りします。お問い合わせください。' : '人数を選び直してください。' }, 400)
    }
    const reconcileCurrent = async (): Promise<{ started: SeatOperationStart } | { error: ReturnType<typeof json> }> => {
      const completed = await readCompletedSeatOperation(c.ctx.companyId, operationKey, requested)
      if (completed) return { started: completed }
      const snapshot = await inspectSeatReconciliation(c.ctx.companyId, operationKey, requested)
      // Reconfirm current ownership through the same central subscription
      // lookup used for normal changes. Old proof alone cannot revive a
      // subscription that is no longer this company's current contract.
      const currentContract = await readOwnerTeamSubscription(c.ctx)
      if (snapshot.active.phase !== 'stripe' || !currentContract || currentContract.subscriptionId !== snapshot.active.request.subscriptionId || currentContract.seatItemId !== snapshot.active.request.seatItemId) return { error: json({ code: 'SEAT_OPERATION_RECONCILE', error: '現在の契約との対応を確認できませんでした。変更を保留しています。運営にお問い合わせください。' }, 409) }
      const evidence = await readSeatReconciliationEvidence(snapshot)
      if (!evidence.ready) return { error: json({ code: 'SEAT_OPERATION_RECONCILE', error: '人数変更の結果を確認できませんでした。契約を変更せずに保留しています。運営にお問い合わせください。' }, 409) }
      const reconciled = await claimVerifiedSeatReconciliation(snapshot, evidence.proof)
      return { started: { kind: 'claimed', claim: reconciled } }
    }
    let started: SeatOperationStart
    if (mode === 'check') {
      // Explicit check mode never falls through to begin/update, even if the
      // browser's clock or a stale status response suggests a different age.
      const checked = await reconcileCurrent()
      if ('error' in checked) return checked.error
      started = checked.started
      reconciliationOnly = true
    } else {
      try {
        started = await beginSeatOperation(c.ctx.companyId, operationKey, requested, undefined, Date.now(), { existingOnly: mode === 'resume' })
      } catch (error) {
        if (!(error instanceof SeatOperationError) || error.code !== 'SEAT_OPERATION_RECONCILE') throw error
        const checked = await reconcileCurrent()
        if ('error' in checked) return checked.error
        started = checked.started
        reconciliationOnly = true
      }
    }
    if (started.kind === 'replay') return json({ ok: true, ...started.result, replayed: true })
    if (started.kind === 'rejected') return paymentFailed()
    claim = started.claim
    if (claim.active.phase === 'preparing') {
      const t = await readOwnerTeamSubscription(c.ctx)
      if (!t) {
        await cancelSeatPreparation(claim)
        return json({ code: 'NO_TEAM_SUBSCRIPTION', error: 'チームプランのご契約を確認できませんでした。' }, 409)
      }
      if (expectedSeats !== undefined && t.seats !== expectedSeats) {
        await cancelSeatPreparation(claim)
        return json({ code: 'SEATS_CHANGED', error: '確認中に契約人数が変わりました。現在の人数を確認してから、もう一度お手続きください。' }, 409)
      }
      const used = await teamSeatsUsed(c.ctx.companyId)
      const decision = decideSeatChange({ current: t.seats, requested, used })
      if (!decision.ok) {
        const messages: Record<typeof decision.code, string> = {
          INVALID_SEATS: '人数を選び直してください。',
          ENTERPRISE_QUOTE: '50人以上は個別にお見積りします。お問い合わせください。',
          BELOW_USED: `今使っている人数（${used}人）より少なくはできません。先にメンバーを外してください。`,
          NO_CHANGE: '今と同じ人数です。',
        }
        await cancelSeatPreparation(claim)
        return json({ code: decision.code, error: messages[decision.code], used }, decision.status)
      }
      if (t.status === 'trialing') {
        await cancelSeatPreparation(claim)
        return json({ code: 'TRIALING', error: '無料の期間のあいだは、人数を変えられません。期間が終わってからお手続きください。' }, 409)
      }
      const grantPoints = decision.direction === 'up' && doyaPowerLedgerAllowed()
      const pointsAt = Date.now()
      if (grantPoints) {
        await saveSeatPreparationCache(claim, tx => writeTeamSeatCache(c.ctx.companyId, t, tx))
        const preparingClaim = claim
        const monthlyAmount = teamMonthlyPoints(t.seats)
        if (monthlyAmount === null) throw new Error('Previous seat allowance unavailable')
        const { grant } = await import('@/lib/doya-power')
        const pointsDate = new Date(pointsAt)
        const monthly = await grant(c.ctx.companyId, 'monthly', monthlyAmount, monthlyGrantExpiresAt(pointsDate), {
          sourceKey: `monthly:${jstMonthKey(pointsDate)}`, note: 'monthly',
          inTransaction: tx => seatPreparationGrantAllowed(preparingClaim, tx),
        })
        if (!monthly.ok) {
          await cancelSeatPreparation(claim)
          return json({ code: 'MONTHLY_GRANT_FAILED', error: '人数を変える準備ができませんでした。時間をおいて再度お試しください。人数は変わっていません。' }, 503)
        }
      }
      try {
        claim = await recordSeatStripeAttempt(claim, {
          subscriptionId: t.subscriptionId, seatItemId: t.seatItemId, from: t.seats,
          to: requested, interval: t.interval, status: t.status, used,
          direction: decision.direction, grantPoints, pointsAt,
        }, undefined, Date.now(), tx => verifyCompanySeatMinimum(tx, {
          companyId: c.ctx.companyId, ownerUserId: c.ctx.owner.id, requested,
        }))
      } catch (error) {
        if (!(error instanceof CompanySeatMinimumError)) throw error
        await cancelSeatPreparation(claim)
        return json({ code: error.code, ...(error.used === null ? {} : { used: error.used }), error: error.code === 'BELOW_USED'
          ? `今使っている人数（${error.used}人）より少なくはできません。先にメンバーを外してください。`
          : '会社の持ち主が変わりました。画面を読み込み直してください。' }, 409)
      }
    }
    if (claim.active.phase !== 'stripe') throw new Error('Seat request not recorded')
    const active = claim.active
    const request = active.request
    if (request.grantPoints && !doyaPowerLedgerAllowed()) return json({ code: 'FULFILLMENT_PAUSED', error: '人数変更の処理を確認中です。時間をおいて、現在の人数をご確認ください。' }, 503)
    // A retry uses the original immutable request, including quantity and key.
    // Never derive another mutation from the current Stripe quantity here.
    if (!reconciliationOnly) {
      // A persisted request is not authority to charge a contract after the
      // owner has changed contracts. Re-read the current contract before every
      // attempt while preserving the original quantity and idempotency key.
      const currentContract = await readOwnerTeamSubscription(c.ctx)
      if (!currentContract || currentContract.subscriptionId !== request.subscriptionId ||
        currentContract.seatItemId !== request.seatItemId || currentContract.interval !== request.interval ||
        currentContract.status !== request.status ||
        (currentContract.seats !== request.from && currentContract.seats !== request.to)) {
        return json({ code: 'SEAT_OPERATION_RECONCILE', error: '現在の契約との対応を確認できませんでした。変更を保留しています。運営にお問い合わせください。' }, 409)
      }
      stage = 'stripe'
      const updated = await stripe.subscriptions.update(request.subscriptionId, {
        items: [{ id: request.seatItemId, quantity: request.to }],
        proration_behavior: request.direction === 'up' ? 'always_invoice' : 'none',
        ...(request.direction === 'up' ? { payment_behavior: 'error_if_incomplete' as const } : {}),
      }, { idempotencyKey: active.idempotencyKey })
      stage = 'after'
      const config = teamPriceConfig()
      const seatItem = config.ok ? findSeatItem(updated.items.data as any[], new Set([config.seat.monthly, config.seat.yearly])) : null
      if (!seatItem || seatItem.id !== request.seatItemId || seatItem.quantity !== request.to) {
        // Keep the reservation. A mismatched response cannot authorize cache
        // publication, points, another change, or new admissions.
        return json({ code: 'SEATS_NOT_CHANGED', error: '人数変更の結果を確認できませんでした。時間をおいて、現在の人数をご確認ください。' }, 409)
      }
    }
    stage = 'after'
    let addedPoints = 0
    if (request.grantPoints) {
      const { grant } = await import('@/lib/doya-power')
      const originalDate = new Date(request.pointsAt)
      const addedSeats = Array.from({ length: request.to - request.from }, (_, i) => request.from + i + 1)
      for (const pointGrant of seatAddGrants({ subscriptionId: request.subscriptionId, monthKey: jstMonthKey(originalDate), addedSeats, now: originalDate })) {
        const receipt = await grant(c.ctx.companyId, 'monthly', pointGrant.amount, monthlyGrantExpiresAt(originalDate), { sourceKey: pointGrant.sourceKey, note: 'seat-add' })
        if (!receipt.ok) throw new Error('Seat point grant did not complete')
        if (!receipt.duplicated) addedPoints += receipt.granted
      }
    }
    const monthly = teamMonthly(request.to), points = teamMonthlyPoints(request.to)
    if (monthly === null || points === null) throw new Error('Seat totals unavailable')
    const result = { seats: request.to, used: request.used, monthly, points, addedPoints }
    await finishSeatOperation(claim, result, tx => writeTeamSeatCache(c.ctx.companyId, {
      companyId: c.ctx.companyId, subscriptionId: request.subscriptionId,
      seatItemId: request.seatItemId, seats: request.to, interval: request.interval, status: request.status,
    }, tx))
    if (request.direction === 'up') {
      void sendEventNotification({ type: 'payment', userId: c.ctx.owner.id, userEmail: c.ctx.owner.email, details: `チームの人数を ${request.from}人 から ${request.to}人 に増やしました（日割りを請求済み）` }).catch(() => console.error('[pricing/seats] notification delivery failed'))
    }
    return json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof SeatOperationError) return json({ code: error.code, error: '人数の変更を確認中です。時間をおいて、現在の人数をご確認ください。' }, 409)
    if (stage === 'stripe' && claim?.active.phase === 'stripe' && claim.active.request.direction === 'up' && (error as { type?: string })?.type === 'StripeCardError') {
      try {
        await recordSeatPaymentRejection(claim)
        return paymentFailed()
      } catch {
        return json({ error: 'お支払い結果の記録を確認できませんでした。時間をおいて、現在の人数をご確認ください。' }, 502)
      }
    }
    if (stage === 'check' && claim?.active.phase === 'preparing') {
      // If persisting the Stripe stage committed despite a lost DB response,
      // this cancellation refuses to erase that durable uncertainty.
      await cancelSeatPreparation(claim).catch(() => {})
    }
    console.error(`[pricing/seats] seat change failed at ${stage}`)
    return json({ error: stage === 'check'
      ? '人数を確認できませんでした。時間をおいて再度お試しください。'
      : '人数を変えられたか確認できませんでした。時間をおいて、現在の人数をご確認ください。' }, stage === 'check' ? 503 : 502)
  }
}
