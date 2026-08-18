// ============================================
// ドヤ商談準備 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    以前はクライアント側でセッションを確かめ、確定してから初めてLPを描いていた。
//    そのため最初に返るHTMLにLPの本文が1文字も入らず、
//    **検索エンジンからは空のページに見えていた**（2026-08-18に判明）。
//    ここでセッションを見て、未ログインならLPをサーバ側で描く。
// ⚠️ ログイン済みは従来どおりクライアント側で組織を判定して遷移する。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ShodanEntry from './Entry'
import ShodanLp from './Lp'

export default async function ShodanPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <ShodanLp />
  return <ShodanEntry />
}
