// ============================================
// 料金ページ /pricing
// ============================================
// 料金ページ（UI 品質 B-3。PricingNext）。ログインしている人には、ほかの画面と同じ共通の枠（AppShell）の中で出す。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccountCompanyName } from '@/lib/shell/company.server'
import { shellToolHrefs } from '@/lib/shell/tool-hrefs.server'
import { cookies } from 'next/headers'
import { parseRecent, RECENT_COOKIE } from '@/lib/shell/recent'
import ShellGate from '@/components/shell/ShellGate'
import PricingNext from '@/components/pricing/PricingNext'

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const canceled = Boolean(params.canceled) || params.payment === 'cancelled'
  const session = await getServerSession(authOptions).catch(() => null)
  if (!session?.user) return <PricingNext canceled={canceled} serverSignedIn={false} />
  const [company, toolHrefs] = await Promise.all([getAccountCompanyName().catch(() => null), shellToolHrefs().catch(() => ({}))])
  const initialRecent = parseRecent((await cookies()).get(RECENT_COOKIE)?.value)
  return (
    <ShellGate signedIn userName={session.user.name ?? null} company={company} toolHrefs={toolHrefs} initialRecent={initialRecent} always>
      <PricingNext canceled={canceled} inShell serverSignedIn serverPlan={(session.user as { plan?: string }).plan ?? null} />
    </ShellGate>
  )
}
