// 開発用の確認ページ: 「ドヤくんが進めた仕事」を、この端末に残した見本の作戦で出す（/home/agent-preview で進めた分）
// ⚠️ 本番（NODE_ENV=production）では 404
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/shell/AppShell'
import WorkHistory from '@/components/home-agent/WorkHistory'

export const dynamic = 'force-dynamic'

export default async function WorkPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const body = <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px 64px' }}><WorkHistory executor="sample" /></div>
  const signedIn = Boolean((await getServerSession(authOptions).catch(() => null))?.user)
  return signedIn ? body : <AppShell userName="見本">{body}</AppShell>
}
