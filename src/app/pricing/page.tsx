// ============================================
// 料金ページ /pricing
// ============================================
// 料金ページ（UI 品質 B-3。PricingNext）。ログインしている人には、ほかの画面と同じ共通の枠（AppShell）の中で出す。
// 新しい料金（PricingV2）は旗 NEW_PRICING_ROLLOUT の内側だけ。off なら、今までどおり PricingNext だけを出す（src/lib/pricing-v2/view.server.ts）。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccountCompanyName } from '@/lib/shell/company.server'
import { shellToolHrefs } from '@/lib/shell/tool-hrefs.server'
import { cookies } from 'next/headers'
import { parseRecent, RECENT_COOKIE } from '@/lib/shell/recent'
import ShellGate from '@/components/shell/ShellGate'
import PricingNext from '@/components/pricing/PricingNext'
import PricingV2 from '@/components/pricing/PricingV2'
import { resolvePricingView } from '@/lib/pricing-v2/view.server'
import { powerPackPriceId } from '@/lib/pricing-v2/prices'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const canceled = Boolean(params.canceled) || params.payment === 'cancelled'
  const session = await getServerSession(authOptions).catch(() => null)
  const view = await resolvePricingView(session?.user?.email, params.pricing)
  // 新しい料金のときだけ: 追加購入を出すか（価格の設定とドヤパワーの台帳の旗）と、決済から戻ったときの値
  const v2Extra = view === 'current' ? {} : {
    canBuyPack: Boolean(powerPackPriceId()) && doyaPowerLedgerAllowed(),
    powerPackSessionId: params.power_pack === 'done' && typeof params.cs === 'string' ? params.cs : null,
    powerPackCanceled: params.power_pack === 'cancel',
  }
  if (!session?.user) {
    return view === 'current'
      ? <PricingNext canceled={canceled} serverSignedIn={false} />
      : <PricingV2 view={view} canceled={canceled} serverSignedIn={false} {...v2Extra} />
  }
  const [company, toolHrefs] = await Promise.all([getAccountCompanyName().catch(() => null), shellToolHrefs().catch(() => ({}))])
  const initialRecent = parseRecent((await cookies()).get(RECENT_COOKIE)?.value)
  return (
    <ShellGate signedIn userName={session.user.name ?? null} company={company} toolHrefs={toolHrefs} initialRecent={initialRecent} always>
      {view === 'current'
        ? <PricingNext canceled={canceled} inShell serverSignedIn serverPlan={(session.user as { plan?: string }).plan ?? null} />
        : <PricingV2 view={view} canceled={canceled} inShell serverSignedIn {...v2Extra} />}
    </ShellGate>
  )
}
