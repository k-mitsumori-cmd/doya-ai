// ============================================
// 使う製品と担当（/home/products）— 部門ごとの製品の設定（段2）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT か COMPANY_ROLES_ROLLOUT が off、会社に入っていない、管理者でない人には 404。旗を先に見る（off ならセッションも DB も読まない）。
// ⚠️ 最初の表示の中身はサーバーで作って渡す（読み込みの表示を全面に出さない・ちらつかせない）。
// ⚠️ 製品は見え方だけ。ここで決めた担当で、ツールが使えなくなることはない。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { companyRolesRollout } from '@/lib/company-roles/rollout'
import { companyRolesSession } from '@/lib/company-roles/members.server'
import { hasMinCompanyRole } from '@/lib/company-roles/roles'
import { productHubsRollout } from '@/lib/products/flag'
import { getCompanyEnabledProducts, listMembersForProducts } from '@/lib/products/settings.server'
import ProductSettings from '@/components/products/ProductSettings'

export const metadata: Metadata = { title: '使う製品と担当', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ProductSettingsPage() {
  if (productHubsRollout() === 'off' || companyRolesRollout() === 'off') notFound()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/products')
  const s = await companyRolesSession(userId, session?.user?.email ?? null)
  if (!s || !hasMinCompanyRole(s.role, 'admin')) notFound()
  const [enabled, members] = await Promise.all([getCompanyEnabledProducts(s.companyId), listMembersForProducts(s)])
  return <ProductSettings initial={{ enabled, members }} />
}
