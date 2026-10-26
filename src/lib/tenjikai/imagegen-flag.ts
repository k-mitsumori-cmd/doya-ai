// ============================================
// ドヤ展示会の画像の生成（従量課金）を、誰に許すか
// ============================================
//   TENJIKAI_IMAGEGEN_ROLLOUT=off      … 誰にも許さない（既定。値が無い・知らない値も off）
//   TENJIKAI_IMAGEGEN_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ（まず本人だけで本番で試すため。2026-10-26 ユーザーの決定）
//   TENJIKAI_IMAGEGEN_ROLLOUT=all      … ログインしている全員
// 以前の TENJIKAI_IMAGEGEN_ENABLED=true は、ROLLOUT が無いときだけ all と同じに読む（今の設定を変えずに済むように）。
// ⚠️ off のときは、セッションを読まずに false を返す。判定に失敗したときも false（作らない）。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type TenjikaiImagegenRollout = 'off' | 'preview' | 'all'

/** 環境変数の値を読む。ROLLOUT が正しい値ならそれを使い、無ければ以前の ENABLED を見る */
export function tenjikaiImagegenRollout(
  raw: string | undefined = process.env.TENJIKAI_IMAGEGEN_ROLLOUT,
  legacy: string | undefined = process.env.TENJIKAI_IMAGEGEN_ENABLED,
): TenjikaiImagegenRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'off' || v === 'preview' || v === 'all') return v
  return legacy === 'true' ? 'all' : 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideTenjikaiImagegen(input: { rollout: TenjikaiImagegenRollout; email: string | null | undefined; allow: string[] }): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/** 今のリクエストの人に、画像の生成を許すか（/api/tenjikai/image で使う） */
export async function isTenjikaiImagegenAllowed(): Promise<boolean> {
  const rollout = tenjikaiImagegenRollout()
  if (rollout === 'off') return false
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    if (!session?.user) return false
    return decideTenjikaiImagegen({ rollout, email: session.user.email, allow: uiPreviewEmails() })
  } catch {
    return false
  }
}
