// ============================================
// ドヤAI質問リンク 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**（adimage と同じ理由：LPの本文を最初のHTMLに入れる）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AskLinkLp from './Lp'
import AskLinkTool from './Tool'

export default async function AsklinkPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <AskLinkLp />
  return <AskLinkTool />
}
