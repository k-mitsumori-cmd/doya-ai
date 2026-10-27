// ============================================
// 「これ1つで全部進む」ボタン（各ツールの上の帯）を出すかどうか
// ============================================
//   ONE_BUTTON_ROLLOUT=off      … 誰にも出さない（既定。値が無い・知らない値も off）。今までの画面のまま
//   ONE_BUTTON_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ
//   ONE_BUTTON_ROLLOUT=all      … ログインしている全員
// 2026-10-27 ユーザーの指示（統括経由）「各ページで全部やるボタンを横並びで1つ置き、キャラと一緒に上に出す。機能の多さより分かりやすさ」。
// ⚠️ 判定はサーバーだけで行う。画面には (shell)/layout.tsx が props で渡す（OneButtonContext）。
// ⚠️ off のときは、セッションを読まずに false を返す。
// ⚠️ テストでは、既定の引数に undefined を渡さない（環境変数を読んでしまう）。空の文字を渡す。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type OneButtonRollout = 'off' | 'preview' | 'all'

/** 環境変数の値を読む。既定は off（preview と all だけを受け付ける） */
export function oneButtonRollout(raw: string | undefined = process.env.ONE_BUTTON_ROLLOUT): OneButtonRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideOneButton(input: { rollout: OneButtonRollout; email: string | null | undefined; allow: string[] }): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/** 今のリクエストの人に出すか（サーバーの layout で使う）。off ならセッションを読まない。失敗したら出さない */
export async function isOneButtonEnabled(): Promise<boolean> {
  const rollout = oneButtonRollout()
  if (rollout === 'off') return false
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    if (!session?.user) return false
    return decideOneButton({ rollout, email: session.user.email, allow: uiPreviewEmails() })
  } catch {
    return false
  }
}
