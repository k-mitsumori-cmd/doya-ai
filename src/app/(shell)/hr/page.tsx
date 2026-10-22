// ============================================
// ドヤHR 入口（/hr）
// ============================================
// 未ログインの人には紹介ページ（Landing.tsx）を出す。
// 新しい見た目でログインしている人は、作業の画面（/hr/dashboard）へ移す。左のメニューから来た人が、共通の枠の外の紹介ページに出ないため
// （2026-10-23 ユーザーの指摘。ツールを押すと上のヘッダーが消えて画面が変わる）。今の見た目のときは今までどおり紹介ページ
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isUiNext } from '@/lib/ui-next'
import HrLandingPage from './Landing'

export default async function HrEntryPage() {
  const session = await getServerSession(authOptions).catch(() => null)
  if (session?.user && (await isUiNext())) redirect('/hr/dashboard')
  return <HrLandingPage />
}
