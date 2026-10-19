// ============================================
// 料金ページ /pricing
// ============================================
// 新しい見た目（UI 品質 B-3。src/lib/ui-next.ts）の人には PricingNext、それ以外は今までの料金ページを出す。
// 新しい見た目でログインしている人には、ほかの画面と同じ共通の枠（AppShell）の中で出す。
// ⚠️ 判定はサーバーで行う（cookie だけでは新しい見た目にならない）。ログインしていない人の /pricing は今までどおり。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uiNextMode } from '@/lib/ui-next'
import { getAccountCompanyName } from '@/lib/shell/company.server'
import { shellToolHrefs } from '@/lib/shell/tool-hrefs.server'
import { cookies } from 'next/headers'
import { parseRecent, RECENT_COOKIE } from '@/lib/shell/recent'
import ShellGate from '@/components/shell/ShellGate'
import PricingNext from '@/components/pricing/PricingNext'
import PricingLegacy from './PricingLegacy'

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const uiNext = await uiNextMode()
  if (!uiNext) return <PricingLegacy />
  const params = await searchParams
  const canceled = Boolean(params.canceled) || params.payment === 'cancelled'
  const session = await getServerSession(authOptions).catch(() => null)
  if (!session?.user) return <PricingNext canceled={canceled} serverSignedIn={false} />
  const [company, toolHrefs] = await Promise.all([getAccountCompanyName().catch(() => null), shellToolHrefs().catch(() => ({}))])
  const initialRecent = parseRecent((await cookies()).get(RECENT_COOKIE)?.value)
  return (
    <ShellGate signedIn userName={session.user.name ?? null} enabledIds={[]} uiNext={uiNext} company={company} toolHrefs={toolHrefs} initialRecent={initialRecent} always>
      <PricingNext canceled={canceled} inShell serverSignedIn serverPlan={(session.user as { plan?: string }).plan ?? null} />
    </ShellGate>
  )
}
