// ============================================
// 今の人の製品 GET /api/company/me/products → { assigned, defaultProduct, source, locked, all, enabled, canManage, canEditSelf }
// 自分の担当と既定 PUT /api/company/me/products  body: { products: ProductId[], defaultProduct: ProductId | null } か { reset: true }
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5.3（2026-11-02 の決定。本人も自分の担当を決められる）
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT と COMPANY_ROLES_ROLLOUT の内側。本人の分だけを読む・書く（ほかの人の id は受け取らない）。
// ⚠️ 管理者が「本人に変えさせない」にした人は 403。製品は見え方だけで、ツールの権限は変えない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { productHubsRollout } from '@/lib/products/flag'
import { getMemberProducts, setSelfProducts } from '@/lib/products/settings.server'

const off = () => productHubsRollout() === 'off'

export async function GET() {
  if (off()) return json({ error: '見つかりません。' }, 404)
  return companyRolesApi(async (s) => json(await getMemberProducts(s.userId)))
}

export async function PUT(req: NextRequest) {
  if (off()) return json({ error: '見つかりません。' }, 404)
  return companyRolesApi(async (s) => {
    const body = await req.json().catch(() => null)
    const d = await setSelfProducts(s, body)
    if (!d.ok) {
      const messages = {
        LOCKED: '担当の製品は、管理者が決めています。変えたいときは、管理者に相談してください。',
        INVALID_VALUE: '製品を選び直してください。',
        DEFAULT_NOT_ASSIGNED: '最初に開く製品は、担当の製品の中から選んでください。',
      } as const
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    return json({ ok: true, ...(d.reset ? { reset: true } : { products: d.products, defaultProduct: d.defaultProduct }) })
  })
}
