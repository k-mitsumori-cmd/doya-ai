// ============================================
// 会社が使う製品 GET / PUT /api/company/products  PUT body: { enabled: ProductId[] }
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5.1
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT と COMPANY_ROLES_ROLLOUT の内側。読むのは会社の人、決めるのは管理者以上。
// ⚠️ 使わない製品は、切り替えの一覧で下に下げるだけ。ツールは開ける（権限は変えない）。経営管理は止められない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { productHubsRollout } from '@/lib/products/flag'
import { getCompanyEnabledProducts, setCompanyProducts } from '@/lib/products/settings.server'

const off = () => productHubsRollout() === 'off'

export async function GET() {
  if (off()) return json({ error: '見つかりません。' }, 404)
  return companyRolesApi(async (s) => json({ enabled: await getCompanyEnabledProducts(s.companyId) }))
}

export async function PUT(req: NextRequest) {
  if (off()) return json({ error: '見つかりません。' }, 404)
  return companyRolesApi(async (s) => {
    const body = await req.json().catch(() => null)
    const d = await setCompanyProducts(s, body?.enabled)
    if (!d.ok) {
      const messages = { NOT_ALLOWED: '使う製品を決められるのは、管理者とオーナーです。', NOT_FOUND: '会社が見つかりませんでした。', INVALID_VALUE: '製品を選び直してください。' } as const
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    return json({ ok: true, enabled: d.enabled })
  })
}
