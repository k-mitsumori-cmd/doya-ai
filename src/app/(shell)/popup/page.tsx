// ============================================
// ドヤポップアップ 入口
// ============================================
// ⚠️ サーバコンポーネントにすること（LPの本文を最初のHTMLに入れる。初期表示のデータもここで取る。§11）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPopupUserId } from '@/lib/popup/access'
import { listSites } from '@/lib/popup/popup-read'
import PopupLp from './Lp'
import PopupTool from './Tool'

export default async function PopupPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <PopupLp />
  const userId = await getPopupUserId()
  if (!userId) return <PopupLp />
  // 失敗したら error.tsx（エラー表示と「もう一度」）に任せる
  const sites = await listSites(prisma, userId)
  return <PopupTool initialSites={sites} />
}
