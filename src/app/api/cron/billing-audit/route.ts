export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import {
  runBillingAudit,
  formatBillingAuditMessage,
  runMonthlyRevenue,
  formatMonthlyRevenueMessage,
} from '@/lib/billing-audit'
import { postPlainToSlack } from '@/lib/notifications'
import { deliverBillingReport } from '@/lib/billing-report-delivery'
import { notifyAlert } from '@/lib/alert'

/**
 * 課金レポート＋整合監査（毎日 JST 8:00 / 月曜は週次も併記）。
 *
 * Stripe を直接読むため **Webhook が死んでいても必ず届く**。
 * - その日に有料契約したアカウントを一覧で通知
 * - 課金されているのに DB が FREE の方を検出（＝反映漏れ。2026-08 に2名発生）
 * - 契約は有効でもStripeの階層とDBプランが異なる方を検出
 * - Doya契約なのに価格からプランを特定できない状態を検出
 * - 同一利用者の重複契約（顧客メールが分かれた場合も過剰請求を検出）
 * - 有料なのに UserServiceSubscription が揃っていない（障害#5 と同じ状態）を検出
 * - Stripe に契約が無いのに DB が有料のまま（＝過剰付与）を検出
 * - 本番 Webhook エンドポイントの登録・購読イベントを点検
 *
 * 仕様の正本: reference/11-billing-spec.md
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 * 手動実行: ?window=168 で直近7日分を対象にできる
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const overrideWindow = Number(url.searchParams.get('window')) || 0

    // JSTの曜日（月曜=1）。月曜は週次（168h）も出す。
    const jstNow = new Date(Date.now() + 9 * 3600_000)
    const isMonday = jstNow.getUTCDay() === 1

    const windowHours = overrideWindow > 0 ? overrideWindow : 24
    const audit = await runBillingAudit(windowHours)
    const label = overrideWindow > 0 ? `直近${overrideWindow}時間` : '昨日'
    // 集計に失敗した後の再実行で日次レポートが重複しないよう、全種類を先に作る。
    const reports: Array<{ kind: 'daily' | 'weekly' | 'monthly'; text: string }> = [
      { kind: 'daily', text: formatBillingAuditMessage(audit, { windowLabel: label }) },
    ]

    if (isMonday && overrideWindow === 0) {
      const weekly = await runBillingAudit(24 * 7)
      reports.push({ kind: 'weekly', text: formatBillingAuditMessage(weekly, { windowLabel: '直近7日' }) })
    }

    // 毎月1日は前月の売上も報告する。
    // ⚠️ 売上は「契約数 × 単価」ではなく **実際に入金された請求書** から出す。
    //    トライアル中は1円も入っていないため、混ぜると売上を過大に見積もる。
    const isFirstOfMonth = jstNow.getUTCDate() === 1
    if ((isFirstOfMonth && overrideWindow === 0) || url.searchParams.get('monthly') === '1') {
      const revenue = await runMonthlyRevenue()
      reports.push({ kind: 'monthly', text: formatMonthlyRevenueMessage(revenue) })
    }
    const dayKey = [jstNow.getUTCFullYear(), String(jstNow.getUTCMonth() + 1).padStart(2, '0'),
      String(jstNow.getUTCDate()).padStart(2, '0')].join('-')
    for (const report of reports) {
      // 手動の期間指定と明示的な月次再送は従来どおり送る。定期実行は日付別の配信記録を使う。
      if (overrideWindow > 0 || (report.kind === 'monthly' && url.searchParams.get('monthly') === '1')) {
        await postPlainToSlack(report.text)
      } else {
        await deliverBillingReport(`${dayKey}:${report.kind}`, report.text)
      }
    }

    // 重大な異常はアラート基盤にも流す（専用チャンネル/デデュープ付き）
    if (!audit.webhookOk) {
      await notifyAlert({
        level: 'critical',
        title: 'Stripe Webhook が本番に登録されていない/無効',
        context: '課金がプランに反映されず、課金通知も飛ばない状態です',
        detail: audit.webhookDetail,
        dedupKey: 'billing-webhook-missing',
        cooldownMs: 12 * 3600_000,
        aiRepair:
          'Stripe の本番 Webhook エンドポイント（https://doya-ai.surisuta.jp/api/stripe/webhook）を再登録し、' +
          'checkout.session.completed / customer.subscription.created|updated|deleted / invoice.payment_succeeded|failed を購読、' +
          '発行された signing secret を Vercel の STRIPE_WEBHOOK_SECRET に設定して再デプロイしてください。',
      })
    }
    if (audit.mismatched.length > 0) {
      await notifyAlert({
        level: 'critical',
        title: `課金済みなのに無料プランのままの利用者が ${audit.mismatched.length} 名います`,
        detail: audit.mismatched.map((s) => `${s.email} / ${s.tier}(${s.status}) / DB:${s.dbPlan ?? '未登録'}`).join('\n'),
        dedupKey: 'billing-plan-mismatch',
        cooldownMs: 12 * 3600_000,
      })
    }
    if (audit.tierDrift.length > 0) {
      await notifyAlert({
        level: 'critical',
        title: `Stripe契約とDBプランの階層が異なる利用者が ${audit.tierDrift.length} 名います`,
        detail: audit.tierDrift
          .map((d) => `${d.email || d.userId} / Stripe:${d.stripeTier} / DB:${d.dbPlan} / sub:${d.subscriptionIds.join(',')}`)
          .join('\n'),
        dedupKey: 'billing-tier-drift',
        cooldownMs: 12 * 3600_000,
      })
    }
    if (audit.unmappedPlans.length > 0) {
      await notifyAlert({
        level: 'critical',
        title: `Stripe契約のプランを特定できないものが ${audit.unmappedPlans.length} 件あります`,
        detail: audit.unmappedPlans.map((s) => `${s.email || s.customerId} / sub:${s.id} / status:${s.status}`).join('\n'),
        dedupKey: 'billing-unmapped-plan',
        cooldownMs: 12 * 3600_000,
      })
    }
    if (audit.serviceDrift.length > 0) {
      await notifyAlert({
        level: 'critical',
        title: `有料なのにサービス別プランが揃っていない利用者が ${audit.serviceDrift.length} 名います`,
        context: '一部サービスだけ無料扱いになっています（2026-08 障害#5 と同じ状態）',
        detail: audit.serviceDrift
          .map((d) => `${d.email} / User.plan=${d.userPlan} / 未反映: ${d.broken.join(', ')}`)
          .join('\n'),
        dedupKey: 'billing-service-plan-drift',
        cooldownMs: 12 * 3600_000,
      })
    }
    if (audit.duplicates.length > 0) {
      await notifyAlert({
        level: 'critical',
        title: `同一利用者で契約が重複しています（${audit.duplicates.length}件・過剰請求の恐れ）`,
        detail: audit.duplicates.map((d) => `${d.email}: ${d.subs.map((s) => `${s.id}(${s.status})`).join(' / ')}`).join('\n'),
        dedupKey: 'billing-duplicate-subscription',
        cooldownMs: 12 * 3600_000,
      })
    }

    return NextResponse.json({
      ok: true,
      window: windowHours,
      new: audit.newInWindow.length,
      live: audit.subscriptions.length,
      mismatched: audit.mismatched.length,
      tierDrift: audit.tierDrift.length,
      unmappedPlans: audit.unmappedPlans.length,
      serviceDrift: audit.serviceDrift.length,
      overGranted: audit.overGranted.length,
      duplicates: audit.duplicates.length,
      webhookOk: audit.webhookOk,
    })
  } catch (error: any) {
    console.error('[Cron] billing-audit error:', error)
    await notifyAlert({
      level: 'critical',
      title: '課金監査cronが失敗しました',
      detail: String(error?.message || error),
      dedupKey: 'billing-audit-failed',
    }).catch(() => {})
    return NextResponse.json({ error: '課金監査を完了できませんでした' }, { status: 500 })
  }
}
