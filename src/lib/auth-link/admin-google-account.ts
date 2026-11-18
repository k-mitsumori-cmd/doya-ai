import { isAdminGoogleEmail } from '../admin-google-policy'

/**
 * 管理画面の「Google の条件」の判定（純粋関数）。設計の根拠: account-integrity.md の 4.8。
 *
 * いまの src/lib/admin-google-session.server.ts は、セッションの user.email が @surisuta.jp かどうかだけを見る。
 * ログイン手段に Apple などを足すと、Google 以外で入ったユーザーの User.email が @surisuta.jp でも通ってしまう。
 * そこで「そのユーザーに provider が google の Account があり、その Google が返したメールが @surisuta.jp」に替える。
 *
 * 既存ファイルへの組み込み案（次の担当が行う。この担当では既存ファイルを変えない）:
 *   export async function hasAdminGoogleSession(): Promise<boolean> {
 *     try {
 *       const session = await getServerSession(authOptions)
 *       const userId = session?.user?.id
 *       if (!userId) return false
 *       const accounts = await prisma.account.findMany({
 *         where: { userId, provider: 'google' },
 *         select: { provider: true, providerEmail: true, emailVerified: true },
 *       })
 *       return isAdminGoogleAccount({ userEmail: session.user.email, accounts })
 *     } catch { return false }
 *   }
 * 組み込む前に、本番の admin 利用者に google の Account があることを読み取りの SQL で確かめる（なければ全員が入れなくなる）。
 * Account.providerEmail は新しい列で、既存の行は null。null の行は、従来の判定（User.email）で代用する（下の規則2）。
 */
export type AdminAccountRow = {
  provider: string
  /** そのログイン手段が返したメール。既存の行は null */
  providerEmail?: string | null
  /** そのログイン手段が、メールを確認済みと返したか。既存の行は null（不明） */
  emailVerified?: boolean | null
}

export function isAdminGoogleAccount(args: { userEmail: unknown; accounts: ReadonlyArray<AdminAccountRow> | null | undefined }): boolean {
  const { userEmail, accounts } = args
  if (!accounts || accounts.length === 0) return false
  return accounts.some((a) => {
    // 規則1: provider が google の Account だけを見る（Apple など、ほかの手段は数えない）
    if (!a || a.provider !== 'google') return false
    // 確認済みでないと明示されている Google は通さない（null は不明として、規則2で扱う）
    if (a.emailVerified === false) return false
    // 規則2: その Google が返したメールで判定する。控えが無い既存の行は、User.email で代用する
    const email = a.providerEmail ?? userEmail
    return isAdminGoogleEmail(email)
  })
}
