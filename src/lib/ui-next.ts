// ============================================
// 新しい見た目（UI 品質の直し）を出すかどうか
// ============================================
// 直した見た目は本番に入れるが、ふつうの利用者には今の画面のまま見せる。
// 許可した人（UI_PREVIEW_EMAILS）だけが、/api/ui-preview?on=1 で切り替えて確かめられる。
//   UI_NEXT_ROLLOUT=off      … 誰にも出さない
//   UI_NEXT_ROLLOUT=preview  … 切り替えた、許可した人だけ（既定）
//   UI_NEXT_ROLLOUT=all      … 全員
// ⚠️ 判定はサーバーだけで行う。cookie だけでは真にしない。毎回ログイン中のメールを確かめる
//    （ほかの人が cookie を手で付けても、今の画面のまま）。
// ⚠️ 全員に出す・戻すは、環境変数を変えて再デプロイするだけ。コードとデータは変わらない。
// 仕様: docs/architecture/management-agent/UI-QUALITY-CHECKLIST-2026-10-19.md §5.1

export type UiNextRollout = 'off' | 'preview' | 'all'

export const UI_NEXT_COOKIE = 'doya_ui_next'
/** cookie を持たせる期間（秒）。30日 */
export const UI_NEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function uiNextRollout(raw: string | undefined = process.env.UI_NEXT_ROLLOUT): UiNextRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'off' || v === 'all') return v
  return 'preview'
}

export function uiPreviewEmails(raw: string | undefined = process.env.UI_PREVIEW_EMAILS): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** このメールの人が、プレビューの切り替えを使ってよいか */
export function canPreviewUiNext(email: string | null | undefined, allow: string[] = uiPreviewEmails()): boolean {
  const e = (email ?? '').trim().toLowerCase()
  return e.length > 0 && allow.includes(e)
}

/** 判定の中身（テストのため、環境変数・cookie・セッションを引数で受け取る） */
export function decideUiNext(input: {
  rollout: UiNextRollout
  cookie: string | null | undefined
  email: string | null | undefined
  allow: string[]
}): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return input.cookie === '1' && canPreviewUiNext(input.email, input.allow)
}

export type UiNextMode = 'all' | 'preview' | null

/**
 * 今のリクエストで新しい見た目を出すか（サーバーの layout・page で使う）。
 * 'all' は全員に出している、'preview' は切り替えた本人にだけ出している、null は今の見た目。
 * ⚠️ 判定に失敗したときは、今の見た目（null）にする。
 */
export async function uiNextMode(): Promise<UiNextMode> {
  const rollout = uiNextRollout()
  if (rollout === 'all') return 'all'
  if (rollout === 'off') return null
  try {
    const { cookies } = await import('next/headers')
    const cookie = (await cookies()).get(UI_NEXT_COOKIE)?.value
    if (cookie !== '1') return null
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    return decideUiNext({ rollout, cookie, email: session?.user?.email, allow: uiPreviewEmails() }) ? 'preview' : null
  } catch {
    return null
  }
}

export async function isUiNext(): Promise<boolean> {
  return (await uiNextMode()) !== null
}

/** 切り替えのあとに戻す先。同じサイトの中のパスだけを許す（ほかのサイトへ飛ばさない） */
export function safeReturnPath(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw || !raw.startsWith('/')) return fallback
  // ⚠️ 制御文字は URL の読み取りで消されることがある（/\t/evil → //evil）。含むものは使わない
  if (/[\u0000-\u001F\u007F\\]/.test(raw)) return fallback
  // 実際に移るときと同じ読み方で読み、同じサイトのままかを確かめる
  const base = 'https://return-path.invalid'
  let u: URL
  try {
    u = new URL(raw, base)
  } catch {
    return fallback
  }
  if (u.origin !== base) return fallback
  const path = u.pathname + u.search
  if (path.startsWith('/api/') || path.startsWith('//')) return fallback
  return path
}
