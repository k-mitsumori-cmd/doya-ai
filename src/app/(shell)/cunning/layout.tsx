import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { isShellEnabled } from '@/lib/ui-shell'
import CunningLayoutShell from '@/components/cunning/CunningLayoutShell'
import CunningShellFrame from '@/components/cunning/CunningShellFrame'
import BetaServiceNotice from '@/components/BetaServiceNotice'
import { canUseBetaService } from '@/lib/beta-service'

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
  const session = await (async () => {
    try { return await getServerSession(authOptions) } catch { return null }
  })()
  // 開発中のベータ版（services.ts の hidden: 'beta'）。許可した人（UI_PREVIEW_EMAILS）のほかは、画面を出さずに案内だけを出す。
  // /cunning の下のページ（履歴・ナレッジ・料金・ライブなど）はすべてこの layout を通る。API は各ルートの先頭で 403
  if (!canUseBetaService('cunning', session?.user?.email)) {
    return <BetaServiceNotice serviceName={SVC.name} signedIn={Boolean(session?.user)} />
  }
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
