// ============================================
// ドヤ広告画像AI 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    クライアント側で fetch し 401 が返ってから LP を描く作りだと、
//    最初に返るHTMLにLPの本文が1文字も入らず、
//    **検索エンジンからは空のページに見える**（canonicalとメタだけ直しても意味がない）。
// ⚠️ ログイン済みでもツール側の401分岐は保険として残してある（セッション切れ対策）。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdImageLp from './Lp'
import AdImageTool from './Tool'

export default async function AdimagePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <AdImageLp />
  return <AdImageTool />
}
