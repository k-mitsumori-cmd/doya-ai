// ============================================
// ドヤくんの知らせ（下からのシート・右下のカード・トースト・吹き出し）を出すかどうか
// ============================================
//   GUIDE_POPUPS_ROLLOUT=off      … 誰にも出さない（既定。値が無い・知らない値も off）
//   GUIDE_POPUPS_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ
//   GUIDE_POPUPS_ROLLOUT=all      … 全員
// ⚠️ 判定はサーバーだけで行う。画面には (shell)/layout.tsx が props で渡す。
// ⚠️ off のときは、セッションを読まずに false を返す。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type GuidePopupsRollout = 'off' | 'preview' | 'all'

/** 環境変数の値を読む。既定は off（preview と all だけを受け付ける） */
export function guidePopupsRollout(raw: string | undefined = process.env.GUIDE_POPUPS_ROLLOUT): GuidePopupsRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideGuidePopups(input: { rollout: GuidePopupsRollout; email: string | null | undefined; allow: string[] }): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/**
 * 今のリクエストの人に、知らせを出すか（サーバーの layout で使う）。
 * ⚠️ off のときは、セッションを読まずに false。判定に失敗したときも false（出さない）。
 */
export async function isGuidePopupsEnabled(): Promise<boolean> {
  const rollout = guidePopupsRollout()
  if (rollout === 'off') return false
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    if (!session?.user) return false
    if (rollout === 'all') return true
    return decideGuidePopups({ rollout, email: session.user.email, allow: uiPreviewEmails() })
  } catch {
    return false
  }
}
