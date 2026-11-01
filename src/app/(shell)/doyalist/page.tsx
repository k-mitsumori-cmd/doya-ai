// ============================================
// ドヤリスト 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    以前はツール画面をそのまま出しており、未ログインで開いてもHTMLに
//    本文がほぼ入らず（可視415字）、検索から来た方には空のページに見えていた。
//    未ログインならLPをサーバ側で描く。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DoyalistLp from './Lp'
import DoyalistTool from './Tool'

export default async function DoyalistPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <DoyalistLp />
  return <DoyalistTool />
}
