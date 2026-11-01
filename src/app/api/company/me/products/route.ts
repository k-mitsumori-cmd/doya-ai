// ============================================
// 今の人の製品 GET /api/company/me/products → { assigned, adminDefault, all, enabled }
// ============================================
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT と COMPANY_ROLES_ROLLOUT の内側。本人の分だけを返す。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { productHubsRollout } from '@/lib/products/flag'
import { getMemberProducts } from '@/lib/products/settings.server'

export async function GET() {
  if (productHubsRollout() === 'off') return json({ error: '見つかりません。' }, 404)
  return companyRolesApi(async (s) => json(await getMemberProducts(s.userId)))
}
