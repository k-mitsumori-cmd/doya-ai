// ドヤスライドの入口（/doyaslide）
// 未ログインの人には紹介ページを出す。新しい見た目でログインしている人は、プロジェクトの一覧（共通の枠の中）へ移す
// （2026-10-23 ユーザーの指摘。左のメニューから押すと、枠の外の紹介ページに出ていた）。今の見た目のときは今までどおり
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isUiNext } from '@/lib/ui-next'
import DoyaSlideLp from './Lp'

export default async function DoyaSlideHomePage() {
  const session = await getServerSession(authOptions).catch(() => null)
  if (session?.user && (await isUiNext())) redirect('/doyaslide/projects')
  return <DoyaSlideLp />
}
