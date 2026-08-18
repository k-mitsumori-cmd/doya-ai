// ============================================
// ドヤ面接官 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    クライアント側で fetch し 401 が返ってから LP を描く作りだと、
//    最初に返るHTMLにLPの本文が1文字も入らず、
//    **検索エンジンからは空のページに見える**（canonicalとメタだけ直しても意味がない）。
// ⚠️ ログイン済みでもツール側の401分岐は保険として残してある（セッション切れ対策）。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MensetsuLp from './Lp'
import MensetsuTool from './Tool'

export default async function MensetsuPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <MensetsuLp />
  return <MensetsuTool />
}
