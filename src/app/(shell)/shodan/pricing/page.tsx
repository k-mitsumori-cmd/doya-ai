import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { DoyaKun } from '@/components/shodan/ui'
import { getShodanContext } from '@/lib/shodan/access'
import { getShodanBilling } from '@/lib/shodan/billing'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ShodanPricingPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const requestedOrg = (await searchParams).org
  const orgSlug = typeof requestedOrg === 'string' && requestedOrg.trim() && requestedOrg.length <= 100 ? requestedOrg.trim() : null
  const context = orgSlug ? await getShodanContext(orgSlug) : null
  const billing = context ? await getShodanBilling(prisma, context.organizationId) : null
  if (requestedOrg !== undefined && (!orgSlug || !context || !billing)) return (
    <div role="alert" className="mx-auto mt-12 max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
      <p className="font-bold">組織の契約情報を確認できませんでした。</p>
      <p className="mt-2 text-sm">組織の画面から開き直してください。確認できない状態では契約変更を案内しません。</p>
      <Link href="/shodan" className="mt-4 inline-block text-sm font-bold underline">ドヤ商談準備に戻る</Link>
    </div>
  )
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link href={orgSlug ? `/shodan/${encodeURIComponent(orgSlug)}` : '/shodan'} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            ドヤ商談準備に戻る
          </Link>
          <div className="flex justify-center mb-2"><DoyaKun mood="love" size={96} /></div>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
            無料で毎月お試し。プロプラン1つで、ドヤAIの全サービスのプロ機能をプラン別の上限内で利用できます。
          </p>
        </div>
        {context && <div className="mb-8 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-950">
          <p className="font-bold">この組織の利用枠は、組織オーナーの契約で決まります。</p>
          {context.role !== 'owner' && <p className="mt-1">ご自身のプランを購入しても、この組織の利用枠は増えません。契約変更は組織オーナーにご相談ください。</p>}
        </div>}
        <UnifiedPricingPlans serviceId="shodan" currentPlan={billing?.plan} planSource={context ? 'organization' : 'account'} canPurchase={!context || context.role === 'owner'} />
      </div>
    </div>
  )
}
