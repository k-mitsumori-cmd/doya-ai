import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { DoyaKun } from '@/components/aio/ui'
import { getAioContext } from '@/lib/aio/access'
import { getAioBilling } from '@/lib/aio/billing'
import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { aioReturnRedirect } from '@/lib/aio/billing-return-route'
import { AioPricingScope } from '@/components/aio/AioPricingScope'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AioPricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const returnPath = aioReturnRedirect(params)
  if (returnPath) redirect(returnPath)
  const requestedOrg = params.org
  const orgSlug = validWorkspaceSlug(requestedOrg) ? requestedOrg : null
  const context = orgSlug ? await getAioContext(orgSlug) : null
  const billing = context ? await getAioBilling(prisma, context.organizationId) : null
  const guest = orgSlug && !context ? !await getServerSession(authOptions) : false
  if (requestedOrg !== undefined && (!orgSlug || !context || !billing)) return (
    <div role="alert" className="mx-auto mt-12 max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
      <p className="font-bold">組織の契約情報を確認できませんでした。</p>
      <p className="mt-2 text-sm">組織の画面から開き直してください。確認できない状態では契約変更を案内しません。</p>
      {guest && orgSlug && <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/aio/pricing?org=${encodeURIComponent(orgSlug)}`)}`}
        className="mt-4 mr-4 inline-block text-sm font-bold underline">ログインして再確認する</Link>}
      <Link href="/aio" className="mt-4 inline-block text-sm font-bold underline">ドヤAIOに戻る</Link>
    </div>
  )
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link href={orgSlug ? `/aio/${encodeURIComponent(orgSlug)}` : '/aio'} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            ドヤAIOに戻る
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
        {context && billing ? <AioPricingScope expected={{ actorId: context.userId, organizationId: context.organizationId,
          slug: context.organizationSlug, role: context.role, plan: billing.plan }} /> :
          <UnifiedPricingPlans serviceId="aio" currentPlan={billing?.plan} planSource="account" canPurchase />}
      </div>
    </div>
  )
}
