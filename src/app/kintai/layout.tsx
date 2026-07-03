import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import KintaiLayout from '@/components/kintai/KintaiLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/kintai',
  },
  title: 'ドヤ勤怠 | 勤怠管理システム',
  description: '中小企業のためのクラウド勤怠管理',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/kintai', name: 'ドヤ勤怠', description: '打刻・集計・休暇管理までシンプルに使える中小企業向けクラウド勤怠管理システム。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      {/* HubSpotチャットウィジェットを業務画面で非表示 */}
      <style>{`#hubspot-messages-iframe-container, .hs-chat-widget { display: none !important; }`}</style>
      <KintaiLayout>{children}</KintaiLayout>
    </>
  )
}
