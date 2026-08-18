// ============================================
// ドヤインタビュー 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    以前はツール画面をそのまま出しており、未ログインで開いても説明の面が無く、
//    料金への導線もHTMLに含まれていなかった。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import InterviewLp from './Lp'
import InterviewTool from './Tool'

export default async function InterviewPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <InterviewLp />
  return <InterviewTool />
}
