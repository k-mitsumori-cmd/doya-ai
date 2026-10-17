// ============================================
// ドヤポップアップ 入口
// ============================================
// ⚠️ サーバコンポーネントにすること（LPの本文を最初のHTMLに入れる。asklink と同じ）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import PopupLp from './Lp'
import PopupTool from './Tool'

export default async function PopupPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <PopupLp />
  return <PopupTool />
}
