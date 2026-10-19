// ドヤ支出管理 入口（サーバコンポーネント。LPの本文を最初のHTMLに入れる）
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isUiNext } from '@/lib/ui-next'
import { claimPendingMemberships, getExpenseContext, resolveUserId } from '@/lib/expense/access'
import ExpenseLp from './Lp'
import ExpenseEntry from './Entry'

export default async function ExpensePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <ExpenseLp />
  // ⚠️ 新しい見た目（チェックリスト §5.1）のときだけ、組織があればサーバーで直接その組織へ移す
  //    （全画面の読み込みを出さない。UI 品質 C-1・S-69）。選び方は /api/expense/usage と Entry と同じ:
  //    招待中の所属を本人のものにしてから、最後に入った組織（getExpenseContext）へ。
  //    組織が無いときは、読み込みを挟まずに作成の画面を出す
  if (await isUiNext()) {
    let slug: string | null = null
    try {
      const userId = await resolveUserId()
      if (userId) {
        await claimPendingMemberships(userId)
        slug = (await getExpenseContext())?.organizationSlug ?? null
      }
    } catch {
      // 判定に失敗したら、今までどおりクライアント（Entry）に任せる
      return <ExpenseEntry />
    }
    if (slug) redirect(`/expense/${encodeURIComponent(slug)}`)
    return <ExpenseEntry known />
  }
  return <ExpenseEntry />
}
