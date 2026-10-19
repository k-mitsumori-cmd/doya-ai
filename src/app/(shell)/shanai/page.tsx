// ============================================
// ドヤ社内インタビュー 入口
// ============================================
// ⚠️ サーバコンポーネントにすること（LPの本文を最初のHTMLに入れる。popup / asklink と同じ）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ShanaiLp from './Lp'
import ShanaiTool from './Tool'

export default async function ShanaiPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <ShanaiLp />
  return <ShanaiTool />
}
