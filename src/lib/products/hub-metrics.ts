// ============================================
// 製品のホームに出す数字（経営ホームの集計 getHomeSummary から、製品の分だけを選ぶ）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §4.3
// ⚠️ 作り物の数字は出さない。読めない・まだ無い欄は state を 'empty' / 'error' にして、画面は「まだデータがありません」とツールを始めるボタンを出す。
// ⚠️ 純粋な関数（画面とテストから使う）。集計そのものは src/lib/home/summary.ts。
import type { HomeSummary, HomeToolState } from '@/lib/home/summary'
import type { ProductId } from '@/lib/products'
import type { MarketingSummary } from './marketing-summary'

export interface HubMetric {
  key: string
  label: string
  /** 表に出す値（書式を当てたもの） */
  value: string
  /** 値の下の一言（予と実の比べ・件数など） */
  sub?: string
  /** 押したときに開くツールのページ */
  href: string
  state: HomeToolState
}

export function yen(n: number): string {
  if (Math.abs(n) >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億円`
  if (Math.abs(n) >= 10_000) return `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万円`
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

const pct = (actual: number, plan: number) => (plan > 0 ? `${Math.round((actual / plan) * 100)}%` : '—')

/** 製品ごとの数字。経営管理（経営ホーム）は空。マーケティングは marketingMetrics（別の集計）で作る */
export function hubMetrics(id: ProductId, s: HomeSummary): HubMetric[] {
  if (id === 'sales') {
    return [
      { key: 'won', label: '今月の受注', value: yen(s.sales.wonThisMonth), sub: `${s.sales.wonCountThisMonth}件`, href: s.sales.href, state: s.sales.state },
      { key: 'pipeline', label: '進行中の商談', value: yen(s.sales.openPipeline), sub: `${s.sales.openDeals}件・見込み ${yen(s.sales.weightedPipeline)}`, href: s.sales.href, state: s.sales.state },
      { key: 'quotes', label: '今月確定した見積', value: yen(s.quotes.confirmedThisMonth), sub: `下書き ${s.quotes.draftCount}件・送付済み ${s.quotes.sentCount}件`, href: s.quotes.href, state: s.quotes.state },
      { key: 'tasks', label: '期限切れのタスク', value: `${s.sales.overdueTasks}件`, sub: `未完了 ${s.sales.openTasks}件`, href: s.sales.href, state: s.sales.state },
    ]
  }
  if (id === 'budget') {
    const out: HubMetric[] = []
    const inc = s.money?.income
    const exp = s.money?.expense
    if (inc) {
      out.push({ key: 'revenue', label: '今月の売上（実 / 予）', value: `${yen(inc.received)} / ${yen(inc.scheduled)}`, sub: `入金済みの割合 ${pct(inc.received, inc.scheduled)}`, href: inc.href, state: inc.state })
      out.push({ key: 'unpaid', label: '入金待ち', value: yen(inc.unpaid), sub: inc.overdueCount ? `期日を過ぎた請求 ${inc.overdueCount}件` : '期日を過ぎた請求はありません', href: inc.href, state: inc.state })
    }
    if (exp) {
      out.push({ key: 'spend', label: '今月の支払い（実 / 予）', value: `${yen(exp.paid)} / ${yen(exp.thisMonthOut)}`, sub: `来月の予定 ${yen(exp.nextMonthOut)}`, href: exp.href, state: exp.state })
    }
    out.push({ key: 'projects', label: '案件の利益', value: yen(s.projects.profit), sub: `売上 ${yen(s.projects.revenue)}・原価 ${yen(s.projects.cost)}`, href: s.projects.href, state: s.projects.state })
    return out
  }
  if (id === 'hr') {
    return [
      { key: 'people', label: '在籍している社員', value: `${s.people.activeEmployees}人`, sub: `部署 ${s.people.departments}`, href: s.people.href, state: s.people.state },
      { key: 'overtime', label: '今月の残業', value: `${s.attendance.overtimeHoursThisMonth.toLocaleString('ja-JP')}時間`, sub: `働いた時間 ${s.attendance.workHoursThisMonth.toLocaleString('ja-JP')}時間`, href: s.attendance.href, state: s.attendance.state },
      { key: 'requests', label: '承認待ちの申請', value: `${s.attendance.pendingRequests}件`, href: s.attendance.href, state: s.attendance.state },
    ]
  }
  return []
}

const pctValue = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`)

/** JST の「M月D日」 */
function jstDay(iso: string): string {
  const j = new Date(new Date(iso).getTime() + 9 * 3600_000)
  return `${j.getUTCMonth() + 1}月${j.getUTCDate()}日`
}

/** マーケティングのホームの数字（段3。src/lib/products/marketing-summary.ts の集計から） */
export function marketingMetrics(m: MarketingSummary): HubMetric[] {
  return [
    { key: 'banner', label: '今月つくったバナー', value: `${m.banner.thisMonth}枚`, sub: `これまで ${m.banner.total.toLocaleString('ja-JP')}枚`, href: m.banner.href, state: m.banner.state },
    { key: 'seo', label: '今月つくったSEO記事', value: `${m.seo.thisMonth}本`, sub: `書き上がった記事 ${m.seo.doneThisMonth}本・これまで ${m.seo.total.toLocaleString('ja-JP')}本`, href: m.seo.href, state: m.seo.state },
    {
      key: 'aio', label: 'AI検索で自社に触れた割合', value: pctValue(m.aio.awarenessPct),
      sub: m.aio.scannedAt ? `${jstDay(m.aio.scannedAt)}の調べ・追っている会社の中で ${pctValue(m.aio.shareOfVoice)}` : undefined,
      href: m.aio.href, state: m.aio.state,
    },
    { key: 'persona', label: '今月つくったペルソナ', value: `${m.persona.thisMonth}件`, sub: `これまで ${m.persona.total.toLocaleString('ja-JP')}件`, href: m.persona.href, state: m.persona.state },
  ]
}
