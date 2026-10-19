import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { isShellEnabled } from '@/lib/ui-shell'
import CunningLayoutShell from '@/components/cunning/CunningLayoutShell'
import CunningShellFrame from '@/components/cunning/CunningShellFrame'
import { betaServiceAllowed } from '@/lib/beta-services'
import BetaServiceNotice from '@/components/BetaServiceNotice'

export const metadata: Metadata = {
  ...buildServiceMetadata('cunning', {
    tagline: 'Web会議中にAIが回答をカンペ表示',
    keywords: ['Web会議 AI', 'AIカンペ', 'リアルタイム文字起こし', '商談支援', '面接対策', 'カスタマーサポート', 'AI回答', '質問検出'],
  }),
  // 開発中のベータ版として非表示の間は、検索に出さない（src/lib/services.ts の BETA_HIDDEN_SERVICE_IDS）
  robots: { index: false, follow: false },
}

const SVC = getServiceById('cunning')!

export default async function CunningLayout({ children }: { children: React.ReactNode }) {
  // 開発中のベータ版として非表示の間は、許可した人だけが使える。それ以外の人には案内だけを出す（API も同じ判定。2026-10-19）
  if (!(await betaServiceAllowed('cunning'))) return <BetaServiceNotice name={SVC.name} />
  const session = await getServerSession(authOptions)
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      {/* 未ログイン → 今のまま / 枠が有効 → ToolFrame だけ（枠は (shell)/layout.tsx） / それ以外 → 今のレイアウト。/cunning/live は要ログインの画面なので枠に含める */}
      {!session?.user ? children : isShellEnabled('cunning') ? <CunningShellFrame>{children}</CunningShellFrame> : <CunningLayoutShell>{children}</CunningLayoutShell>}
    </>
  )
}
