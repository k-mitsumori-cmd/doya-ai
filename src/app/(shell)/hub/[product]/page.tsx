// ============================================
// 製品のホーム（/hub/sales・/hub/marketing・/hub/hr・/hub/budget）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §4.3（2026-11-01 本人の決定「おすすめで進める」）
// - 中身は、部門の数字（経営ホームの集計から製品の分だけ）・ドヤくんに頼む（例を部門向けに）・製品のツール・ほかの製品。
// - 経営管理のホームは今の経営ホーム（/home）なので、/hub/management は /home へ移る。
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT が off の人には 404 を返す（見せない）。
// ⚠️ ここは読むだけ。組織の自動作成や契約の変更はしない。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHomeSummary } from '@/lib/home/summary'
import { isProductHubsEnabled } from '@/lib/products/flag'
import { departmentOfProduct, getProduct, parseProductId } from '@/lib/products'
import { hubMetrics, marketingMetrics } from '@/lib/products/hub-metrics'
import { getMarketingSummary } from '@/lib/products/marketing-summary'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import HomeAgent from '@/components/home-agent/HomeAgent'
import { brandRenamedFlag, japanHour, pickHeadline } from '@/components/home-agent/headlines'
import { brandName } from '@/lib/brand'
import HubView from '../HubView'

// Next.js 15 のページの params は Promise（.next/types の PageProps の決まり）
type Ctx = { params: Promise<{ product: string }> }

export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: Ctx): Promise<Metadata> {
  const id = parseProductId((await ctx.params).product)
  return { title: id ? `${brandName()} ${getProduct(id).name}` : 'ホーム', robots: { index: false, follow: false } }
}

export default async function ProductHubPage(ctx: Ctx) {
  const id = parseProductId((await ctx.params).product)
  if (!(await isProductHubsEnabled())) notFound()
  if (!id) notFound()
  if (id === 'management') redirect('/home')

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/hub/${id}`)}`)

  // 数字は経営ホームと同じ集計から選ぶ（読めない欄は state で分かる。ホーム全体は落とさない）
  // マーケティングだけは、経営ホームの集計に数字が無いので、別の集計から読む（段3）
  const summary = id === 'marketing'
    ? await getMarketingSummary(userId).then(marketingMetrics).catch(() => null)
    : await getHomeSummary(userId).then((s) => hubMetrics(id, s)).catch(() => null)
  const metrics = summary ?? []
  // 「ドヤくんに頼む」（旗 AGENT_ORCHESTRATION_ROLLOUT の内側だけ）。例と道具を、製品の部署に合わせて絞る
  const agent = await isAgentOrchestrationEnabled()
  const headline = pickHeadline({ renamed: brandRenamedFlag(), hour: japanHour() })
  return (
    <HubView
      productId={id}
      metrics={metrics}
      metricsUnavailable={!summary}
      agentStage={agent ? <HomeAgent key={id} dept={departmentOfProduct(id)} headline={headline} /> : null}
    />
  )
}
