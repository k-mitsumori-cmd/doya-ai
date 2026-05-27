import type { Metadata } from 'next'
import KintaiLayout from '@/components/kintai/KintaiLayout'

export const metadata: Metadata = {
  title: 'ドヤ勤怠 | 勤怠管理システム',
  description: '中小企業のためのクラウド勤怠管理',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* HubSpotチャットウィジェットを業務画面で非表示 */}
      <style>{`#hubspot-messages-iframe-container, .hs-chat-widget { display: none !important; }`}</style>
      <KintaiLayout>{children}</KintaiLayout>
    </>
  )
}
