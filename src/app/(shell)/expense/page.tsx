// ドヤ支出管理 入口（サーバコンポーネント。LPの本文を最初のHTMLに入れる）
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isUiNext } from '@/lib/ui-next'
import { claimPendingMemberships, createOrganization, getExpenseContext, resolveUserId } from '@/lib/expense/access'
import { getOwnCompany } from '@/lib/shell/company.server'
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
    let companyName: string | null = null
    try {
      const userId = await resolveUserId()
      if (userId) {
        await claimPendingMemberships(userId)
        slug = (await getExpenseContext())?.organizationSlug ?? null
        // 1アカウント＝1会社（2026-10-24 ユーザーの決定）。支出管理の組織が無く、アカウントの会社（account_companies）があれば、
        // その会社の名前で組織を裏で作って移す（組織の作成を求めない。表の持ち方は変えない。createOrganization は所属があればそれを返す）
        if (!slug) {
          companyName = (await getOwnCompany(userId))?.name?.trim() || null
          if (companyName) {
            const memberName = session.user.name?.trim() || session.user.email?.split('@')[0] || companyName
            slug = (await createOrganization(userId, companyName, memberName)).slug
          }
        }
      }
    } catch {
      // 判定・作成に失敗したら、今までどおりクライアント（Entry）に任せる
      return <ExpenseEntry />
    }
    if (slug) redirect(`/expense/${encodeURIComponent(slug)}`)
    // アカウントの会社がまだ無い: 会社の登録を案内する（登録すると、この画面を読み直して、上で組織を作って移る）
    return <ExpenseEntry known needsCompany />
  }
  return <ExpenseEntry />
}
