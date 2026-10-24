import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import KintaiLayout from '@/components/kintai/KintaiLayout'
import KintaiShellFrame from '@/components/kintai/KintaiShellFrame'
import { FAQ } from './lp-data'

export const metadata: Metadata = buildServiceMetadata('kintai', {
  keywords: ['勤怠管理', 'クラウド勤怠', '打刻', '勤怠システム', '出退勤', '残業管理', '休暇申請', '中小企業 勤怠', 'KING OF TIME 代替', 'ジョブカン 代替'],
})

const SVC = getServiceById('kintai')!

export default async function Layout({ children }: { children: React.ReactNode }) {
  // 未ログイン → 今のまま（KintaiLayout が LP・ログイン案内を出す）。ログイン済み → ToolFrame だけ（AppShell は共通の layout）
  const session = await getServerSession(authOptions)
  const useShell = Boolean(session?.user)
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
        faq={FAQ}
      />
      {/* HubSpotチャットウィジェットを業務画面で非表示 */}
      <style>{`#hubspot-messages-iframe-container, .hs-chat-widget { display: none !important; }`}</style>
      {useShell ? <KintaiShellFrame>{children}</KintaiShellFrame> : <KintaiLayout>{children}</KintaiLayout>}
    </>
  )
}
