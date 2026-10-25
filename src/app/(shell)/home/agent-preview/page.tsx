// 開発用の確認ページ: 経営ホームの「ドヤくんに頼む」の画面を、見本の結果で最後まで動かす（API・DB・AI・ドヤパワーを使わない）
// ⚠️ 本番（NODE_ENV=production）では 404。経営ホームの本物は /home（旗 AGENT_ORCHESTRATION_ROLLOUT の内側）
// ⚠️ ログインしていると (shell)/layout.tsx が枠を出すので、ここでは包まない（枠が二重にならないように）
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/shell/AppShell'
import HomeAgent from '@/components/home-agent/HomeAgent'

export const dynamic = 'force-dynamic'

export default async function HomeAgentPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const body = (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px 64px' }}>
      <HomeAgent executor="sample" />
    </div>
  )
  const signedIn = Boolean((await getServerSession(authOptions).catch(() => null))?.user)
  return signedIn ? body : <AppShell userName="見本">{body}</AppShell>
}
