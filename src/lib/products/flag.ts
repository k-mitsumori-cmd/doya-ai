// ============================================
// 部門ごとの製品（ドヤバディ マーケティング・セールス・人事・予実管理・経営管理）を出すかどうか
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §7
//   PRODUCT_HUBS_ROLLOUT=off      … 誰にも出さない（既定。値が無い・知らない値も off）
//   PRODUCT_HUBS_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ
//   PRODUCT_HUBS_ROLLOUT=all      … 全員
// ⚠️ 判定はサーバーだけで行う。画面には layout / page が props で渡す。
// ⚠️ off のときは、セッションを読まずに false を返す。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type ProductHubsRollout = 'off' | 'preview' | 'all'

/** 環境変数の値を読む。既定は off（preview と all だけを受け付ける） */
export function productHubsRollout(raw: string | undefined = process.env.PRODUCT_HUBS_ROLLOUT): ProductHubsRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideProductHubs(input: {
  rollout: ProductHubsRollout
  email: string | null | undefined
  allow: string[]
}): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/**
 * 今のリクエストの人に、部門ごとの製品を出すか（サーバーの layout・page で使う）。
 * ⚠️ off のときは、セッションを読まずに false。判定に失敗したときも false（出さない）。
 */
export async function isProductHubsEnabled(): Promise<boolean> {
  const rollout = productHubsRollout()
  if (rollout === 'off') return false
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    // all でも、ログインしていない人には出さない
    if (!session?.user) return false
    if (rollout === 'all') return true
    return decideProductHubs({ rollout, email: session.user.email, allow: uiPreviewEmails() })
  } catch {
    return false
  }
}
