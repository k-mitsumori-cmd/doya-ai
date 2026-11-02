// ============================================
// /hub — 最初に開く製品のホームへ移る（旗 PRODUCT_HUBS_ROLLOUT の内側だけ）
// ============================================
// 決め方は src/lib/products.ts の resolveStartProduct（本人が既定にした製品 → 最後に開いた製品 → 経営管理）。
// ⚠️ 旗が off のときは今の経営ホームへ移る（404 にしない。古いリンクからも開けるように）。
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { isProductHubsEnabled } from '@/lib/products/flag'
import { PRODUCT_COOKIE, PRODUCT_DEFAULT_COOKIE, getProduct, parseProductId, resolveStartProduct } from '@/lib/products'

export const dynamic = 'force-dynamic'

export default async function HubIndexPage() {
  if (!(await isProductHubsEnabled())) redirect('/home')
  const jar = await cookies()
  const start = resolveStartProduct({
    selfDefault: parseProductId(jar.get(PRODUCT_DEFAULT_COOKIE)?.value),
    last: parseProductId(jar.get(PRODUCT_COOKIE)?.value),
  })
  redirect(getProduct(start).home)
}
