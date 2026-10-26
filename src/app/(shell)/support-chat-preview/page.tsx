// 開発用の確認ページ: サポートチャットを、ログインせずに動かす
// ⚠️ 本番（NODE_ENV=production）では 404。本物は (shell)/layout.tsx が旗 SUPPORT_CHAT_ROLLOUT を見て出す
// ⚠️ API・DB・AI・Slack を使わない。質問と「運営に伝える」は、画面の中のモック（SupportChatPreviewBody）が答える
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import SupportChat from '@/components/support-chat/SupportChat'
import SupportChatPreviewBody from './SupportChatPreviewBody'

export const dynamic = 'force-dynamic'

export default function SupportChatPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <>
      <AppShell userName="見本">
        <SupportChatPreviewBody />
      </AppShell>
      <SupportChat />
    </>
  )
}
