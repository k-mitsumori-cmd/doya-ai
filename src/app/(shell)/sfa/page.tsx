// ============================================
// ドヤ営業管理 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    以前はクライアント側でセッションを確かめ、確定してから初めてLPを描いていた。
//    そのため最初に返るHTMLにLPの本文が1文字も入らず、
//    **検索エンジンからは空のページに見えていた**（2026-08-18に判明）。
//    ここでセッションを見て、未ログインならLPをサーバ側で描く。
// ⚠️ ログイン済みは従来どおりクライアント側で組織を判定して遷移する。
//    ただし新しい見た目（チェックリスト §5.1）のときは、組織があればサーバーで先に移す（中身の空の枠を出さない。UI 品質 C-1）
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { listMemberships } from '@/lib/sfa/access'
import SfaEntry from './Entry'
import SfaLp from './Lp'

export default async function SfaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <SfaLp />
  // 選び方は Entry と同じにする。URL に指定があるときと、組織がまだ無いときは、今までどおり Entry に任せる
  const params = await searchParams
  if (Object.keys(params).length === 0) {
    const memberships = await listMemberships().catch(() => [])
    // Entry が使う /api/sfa/usage は、組織の指定が無いと「いちばん新しく入った組織」を選ぶ（listMemberships は古い順）
    const target = memberships[memberships.length - 1]
    if (target) redirect(`/sfa/${encodeURIComponent(target.slug)}`)
  }
  return <SfaEntry />
}
