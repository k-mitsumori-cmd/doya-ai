// ============================================
// メンバーの担当の製品と既定の製品 PUT /api/company/members/[id]/products
// body: { products: ProductId[], defaultProduct: ProductId | null }
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5.2
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT と COMPANY_ROLES_ROLLOUT の内側。管理者以上だけ。id は account_company_members の id、持ち主は 'owner'。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { productHubsRollout } from '@/lib/products/flag'
import { setMemberProducts } from '@/lib/products/settings.server'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  if (productHubsRollout() === 'off') return json({ error: '見つかりません。' }, 404)
  return companyRolesApi(async (s) => {
    const { id } = await ctx.params
    if (!id || id.length > 64) return json({ error: 'メンバーを選び直してください。' }, 400)
    const body = await req.json().catch(() => null)
    const d = await setMemberProducts(s, id, body)
    if (!d.ok) {
      const messages = {
        NOT_ALLOWED: '担当の製品を決められるのは、管理者とオーナーです。',
        NOT_FOUND: 'メンバーが見つかりませんでした（参加したあとに決められます）。',
        INVALID_VALUE: '製品を選び直してください。',
        DEFAULT_NOT_ASSIGNED: '既定の製品は、担当の製品の中から選んでください。',
      } as const
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    return json({ ok: true, products: d.products, defaultProduct: d.defaultProduct })
  })
}
