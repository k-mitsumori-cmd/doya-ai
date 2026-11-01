// ============================================
// ドヤAIO 入口
// ============================================
// ⚠️ **サーバコンポーネントにすること。**
//    以前はクライアント側でセッションを確かめ、確定してから初めてLPを描いていた。
//    そのため最初に返るHTMLにLPの本文が1文字も入らず、
//    **検索エンジンからは空のページに見えていた**（2026-08-18に判明）。
//    ここでセッションを見て、未ログインならLPをサーバ側で描く。
// ⚠️ ログイン済みは従来どおりクライアント側で組織を判定して遷移する。
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { listMemberships } from '@/lib/aio/access'
import AioEntry from './Entry'
import AioLp from './Lp'

export default async function AioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <AioLp />
  // ⚠️ 組織があるなら、サーバーで直接その組織のページへ移す（全画面の読み込みを出さない。UI 品質 C-1）。
  //    選び方は、これまでクライアント（Entry）がしていたのと同じ。URL に指定（クイックスタートなど）があるときと、
  //    組織がまだ無いときは、今までどおり Entry に任せる
  //    新しい見た目（チェックリスト §5.1）のときだけ
  const params = await searchParams
  if (Object.keys(params).length === 0) {
    const memberships = await listMemberships().catch(() => [])
    const target = memberships[memberships.length - 1]
    if (target) redirect(`/aio/${encodeURIComponent(target.slug)}/scan`)
  }
  return <AioEntry />
}
