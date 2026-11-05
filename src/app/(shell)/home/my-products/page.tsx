// ============================================
// 自分の担当（/home/my-products）— 本人が担当の製品と、最初に開く製品を決める（段2・2026-11-02）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5.3
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT か COMPANY_ROLES_ROLLOUT が off、会社に入っていない人には 404。旗を先に見る（off ならセッションも DB も読まない）。
// ⚠️ 管理者が「本人に変えさせない」にした人も開ける（見るだけ）。最初の表示の中身はサーバーで作って渡す（ちらつかせない）。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { companyRolesRollout } from '@/lib/company-roles/rollout'
import { companyRolesSession } from '@/lib/company-roles/members.server'
import { productHubsRollout } from '@/lib/products/flag'
import { getMyProductsSettings } from '@/lib/products/settings.server'
import MyProducts from '@/components/products/MyProducts'

export const metadata: Metadata = { title: '自分の担当', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function MyProductsPage() {
  if (productHubsRollout() === 'off' || companyRolesRollout() === 'off') notFound()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/my-products')
  const s = await companyRolesSession(userId, session?.user?.email ?? null)
  if (!s) notFound()
  return <MyProducts initial={await getMyProductsSettings(s)} />
}
