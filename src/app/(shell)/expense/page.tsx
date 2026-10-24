// ドヤ支出管理 入口（サーバコンポーネント。LPの本文を最初のHTMLに入れる）
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { claimPendingMemberships, getExpenseContext, resolveUserId } from '@/lib/expense/access'
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
  let slug: string | null = null
  let companyName: string | null = null
  try {
    const userId = await resolveUserId()
    if (userId) {
      await claimPendingMemberships(userId)
      slug = (await getExpenseContext())?.organizationSlug ?? null
      // 1アカウント＝1会社（2026-10-24 ユーザーの決定）。支出管理の組織が無ければ、アカウントの会社（account_companies）の名前を読む。
      // ⚠️ ここ（画面を開く GET）では組織を作らない。先取りや他サイトからの読み込みでも作られてしまうため。
      //    作るのは、画面の「◯◯で始める」を押したときの POST だけ（/api/expense/organization の fromAccountCompany）
      if (!slug) companyName = (await getOwnCompany(userId))?.name?.trim() || null
    }
  } catch {
    // 判定に失敗したら、今までどおりクライアント（Entry）に任せる
    return <ExpenseEntry />
  }
  if (slug) redirect(`/expense/${encodeURIComponent(slug)}`)
  // 会社があれば「その会社の名前で始める」を、無ければ会社の登録を案内する（どちらも組織名・氏名の入力は出さない）
  return companyName ? <ExpenseEntry known companyName={companyName} /> : <ExpenseEntry known needsCompany />
}
