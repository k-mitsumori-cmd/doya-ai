// ============================================
// ドヤ見積もりAI 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    以前はクライアント側で fetch し、401が返ってから初めてLPを描いていた。
//    そのため最初に返るHTMLにLPの本文が1文字も入らず、
//    **検索エンジンからは空のページに見えていた**（canonicalとメタだけ直しても意味がない）。
//    ここでセッションを見て、未ログインならLPをサーバ側で描く。
// ⚠️ ログイン済みでもツール側に401の分岐は残してある（セッション切れの保険）。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import QuoteLp from './Lp'
import QuoteTool from './Tool'

export default async function QuotePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <QuoteLp />
  return <QuoteTool />
}
