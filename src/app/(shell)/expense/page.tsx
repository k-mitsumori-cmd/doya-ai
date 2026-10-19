// ドヤ支出管理 入口（サーバコンポーネント。LPの本文を最初のHTMLに入れる）
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ExpenseLp from './Lp'
import ExpenseEntry from './Entry'

export default async function ExpensePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <ExpenseLp />
  return <ExpenseEntry />
}
