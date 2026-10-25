// ============================================
// 気軽に聞けるチャット（サポートチャット）を出すかどうか
// ============================================
//   SUPPORT_CHAT_ROLLOUT=off      … 誰にも出さない（既定。値が無い・知らない値も off）
//   SUPPORT_CHAT_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ
//   SUPPORT_CHAT_ROLLOUT=all      … ログインした全員
// ⚠️ 判定はサーバーだけで行う。画面には (shell)/layout.tsx が props で渡す。API も同じ判定を通す。
// 設計: docs/architecture/support-chat/SUPPORT-CHAT-2026-10-26.md
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type SupportChatRollout = 'off' | 'preview' | 'all'

/** 環境変数の値を読む。既定は off（preview と all だけを受け付ける） */
export function supportChatRollout(raw: string | undefined = process.env.SUPPORT_CHAT_ROLLOUT): SupportChatRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideSupportChat(input: { rollout: SupportChatRollout; email: string | null | undefined; allow: string[] }): boolean {
  if (input.rollout === 'all') return Boolean(input.email)
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/**
 * 今のリクエストの人に、チャットを出すか。
 * ⚠️ off のときは、セッションを読まずに false。判定に失敗したときも false（出さない）。
 */
export async function isSupportChatEnabled(): Promise<boolean> {
  const rollout = supportChatRollout()
  if (rollout === 'off') return false
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    if (!session?.user) return false
    return decideSupportChat({ rollout, email: session.user.email, allow: uiPreviewEmails() })
  } catch {
    return false
  }
}
