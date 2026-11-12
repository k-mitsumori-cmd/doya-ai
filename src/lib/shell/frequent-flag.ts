// ============================================
// 左のメニューの「よく使うツール」を、誰に出すか
// ============================================
//   SHELL_FREQUENT_TOOLS_ROLLOUT=off      … 誰にも出さない。記録もしない（既定。値が無い・知らない値も off）
//   SHELL_FREQUENT_TOOLS_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ
//   SHELL_FREQUENT_TOOLS_ROLLOUT=all      … ログインしている全員
// ⚠️ off のときは、メールを見ずに false を返す。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type ShellFrequentRollout = 'off' | 'preview' | 'all'

export function shellFrequentRollout(raw: string | undefined = process.env.SHELL_FREQUENT_TOOLS_ROLLOUT): ShellFrequentRollout {
  const v = (raw ?? '').trim().toLowerCase()
  return v === 'preview' || v === 'all' ? v : 'off'
}

export function decideShellFrequent(input: { rollout: ShellFrequentRollout; email: string | null | undefined; allow: string[] }): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/** このメールの人に、よく使うツールを出すか（ログインしている人のときだけ呼ぶ） */
export function isShellFrequentEnabledFor(email: string | null | undefined): boolean {
  const rollout = shellFrequentRollout()
  if (rollout === 'off') return false
  return decideShellFrequent({ rollout, email, allow: uiPreviewEmails() })
}
