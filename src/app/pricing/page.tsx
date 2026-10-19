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
import ShellGate from '@/components/shell/ShellGate'
import PricingNext from '@/components/pricing/PricingNext'
import PricingLegacy from './PricingLegacy'

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const uiNext = await uiNextMode()
  if (!uiNext) return <PricingLegacy />
  const params = await searchParams
  const canceled = Boolean(params.canceled) || params.payment === 'cancelled'
  const session = await getServerSession(authOptions).catch(() => null)
  if (!session?.user) return <PricingNext canceled={canceled} />
  const company = await getAccountCompanyName().catch(() => null)
  return (
    <ShellGate signedIn userName={session.user.name ?? null} enabledIds={[]} uiNext={uiNext} company={company} always>
      <PricingNext canceled={canceled} inShell />
    </ShellGate>
  )
}
