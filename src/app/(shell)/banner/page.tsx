/**
 * IMPORTANT: バナー生成ツールの固定URLは /banner
 * ここは外部導線・広告・資料で参照されるため、変更しないこと。
 *
 * URL自動生成は /banner/url に配置。
 *
 * ⚠️ **サーバコンポーネントにすること。**
 *    以前はツール画面（dashboard）をそのまま再export しており、未ログインで
 *    開いてもHTMLに本文がほぼ入らず（可視415字）、検索から来た方には
 *    空のページに見えていた。LP は /banner/landing に完成済みのものがあるので、
 *    未ログインならそれをサーバ側で描く。
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import BannerLanding from './landing/page'
import BannerDashboardPage from './dashboard/page'

export default async function BannerPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <BannerLanding />
  return <BannerDashboardPage />
}
