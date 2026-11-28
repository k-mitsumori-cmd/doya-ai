import { isAdminGoogleEmail } from '../admin-google-policy'
import { isAdminGoogleAccount, type AdminAccountRow } from './admin-google-account'

/**
 * 管理画面の Google の条件の判定（セッションと DB を引数で受け取る形）。
 *  - 旗 APP_AUTH_ENABLED がオフ: 今までどおり、セッションの user.email が @surisuta.jp かどうかだけ。DB は読まない。
 *  - 旗がオン: セッションのユーザーに provider が google の Account があり、その Google が返したメールが @surisuta.jp のとき。
 *    Apple など、Google 以外で入ったユーザーは、User.email が @surisuta.jp でも通らない。
 * 実際の組み込みは admin-google-session.server.ts（旗がオンのときだけ、このファイルを読み込む）。
 */
export async function decideAdminGoogleSession(args: {
  session: { user?: { id?: string | null; email?: string | null } | null } | null
  appAuthOn: boolean
  listGoogleAccounts: (userId: string) => Promise<ReadonlyArray<AdminAccountRow>>
}): Promise<boolean> {
  const { session, appAuthOn, listGoogleAccounts } = args
  if (!appAuthOn) return isAdminGoogleEmail(session?.user?.email)
  const userId = session?.user?.id
  if (!userId) return false
  const accounts = await listGoogleAccounts(userId)
  return isAdminGoogleAccount({ userEmail: session?.user?.email, accounts })
}
