// ============================================
// ドヤ収入管理 入口
// ============================================
// ⚠️ サーバコンポーネントにすること（LPの本文を最初のHTMLに入れる。popup と同じ）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import IncomeLp from './Lp'
import IncomeDashboard from './Dashboard'

export default async function IncomePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <IncomeLp />
  return <IncomeDashboard />
}
