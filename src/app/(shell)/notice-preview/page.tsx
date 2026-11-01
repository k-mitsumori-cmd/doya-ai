// 開発用の確認ページ: ドヤくんの知らせ（シート・カード・トースト・吹き出し）を、ログインせずに動かす
// ⚠️ 本番（NODE_ENV=production）では 404。本物は (shell)/layout.tsx が旗 GUIDE_POPUPS_ROLLOUT を見て出す
// ⚠️ API・DB・AI・ドヤパワーを使わない。見た記録は端末（localStorage）の「preview」のキーにだけ残す
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import NoticeProvider from '@/components/notice/NoticeProvider'
import ShellNotices from '@/components/notice/ShellNotices'
import NoticePreviewBody from './NoticePreviewBody'

export const dynamic = 'force-dynamic'

export default function NoticePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <NoticeProvider userKey="preview">
      <AppShell userName="見本">
        <NoticePreviewBody />
      </AppShell>
      <ShellNotices />
    </NoticeProvider>
  )
}
