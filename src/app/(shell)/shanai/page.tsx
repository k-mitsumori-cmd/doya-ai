// ============================================
// ドヤ社内インタビュー 入口
// ============================================
// ⚠️ サーバコンポーネントにすること（LPの本文を最初のHTMLに入れる。popup / asklink と同じ）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ShanaiLp from './Lp'
import { prisma } from '@/lib/prisma'
import { uiNextMode } from '@/lib/ui-next'
import { getShanaiUserId } from '@/lib/shanai/access'
import { listInterviews } from '@/lib/shanai/interviews-read'
import ShanaiTool, { type ShanaiRow } from './Tool'

// 新しい見た目のときだけ、一覧と会社情報の有無をサーバーで先に読んで Tool に渡す。
// 以前は「ページの表示 → クライアントでセッション取得 → /api/shanai/interviews と /company の2本」と
// 往復が3段つながり、その間ずっとスケルトンだった。ここで読めば最初の描画から中身が出る。
// ⚠️ 読めなかったとき・ユーザーが決まらないときは、今までどおりクライアントで読む（認可は各 API と同じ userId スコープ）。
async function prefetch() {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return undefined
    const [rows, company] = await Promise.all([
      listInterviews(userId),
      prisma.shanaiCompany.findUnique({ where: { userId }, select: { name: true, _count: { select: { sources: true } } } }),
    ])
    return { rows: rows as ShanaiRow[], companyReady: !!company?.name && company._count.sources > 0 }
  } catch {
    return undefined
  }
}

export default async function ShanaiPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <ShanaiLp />
  const initial = (await uiNextMode()) ? await prefetch() : undefined
  return <ShanaiTool initialRows={initial?.rows} initialCompanyReady={initial?.companyReady} />
}
