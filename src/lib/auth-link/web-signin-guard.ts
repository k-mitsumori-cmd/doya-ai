/**
 * Web（NextAuth）の signIn コールバックで、結び付けの決まり（decideLink）を通す入口。
 * 戻り値: true なら NextAuth が続きを処理する。文字列ならその URL へ移動させる。
 *
 * - apple: 常に決まりを通す（既存の動き。失敗したら AccessDenied）。
 * - google: 旗 APP_AUTH_ENABLED がオンのときだけ通す。アプリで Apple を先に使った人が、あとで同じメールの Google で入ると、
 *   NextAuth の既定は OAuthAccountNotLinked（行き止まり）になる。ここで確認の画面 /auth/link?request=<id> へ誘導する。
 *   旗がオフなら何もしない（今までと同じ。DB も読まない）。決まりの処理が失敗したときは、今までの動きに任せる
 *   （既存の Google ログインを、この追加の処理の失敗で止めない）。
 * - ほか: 何もしない。
 * メールでの自動の結び付け（allowDangerousEmailAccountLinking）は使わない。乗っ取りの危険があるため。
 */
export async function webSignInGuard(
  provider: string | undefined,
  input: { providerAccountId: string; profile: { email?: unknown; email_verified?: unknown } | null | undefined },
  ctx: {
    appAuthEnabled: boolean
    decide: (input: { provider: string; providerAccountId: string; profile: { email?: unknown; email_verified?: unknown } | null | undefined }) => Promise<true | string>
  },
): Promise<true | string> {
  if (provider === 'apple') {
    try {
      return await ctx.decide({ provider: 'apple', ...input })
    } catch {
      return '/auth/signin?error=AccessDenied'
    }
  }
  if (provider === 'google' && ctx.appAuthEnabled) {
    try {
      return await ctx.decide({ provider: 'google', ...input })
    } catch {
      return true
    }
  }
  return true
}
