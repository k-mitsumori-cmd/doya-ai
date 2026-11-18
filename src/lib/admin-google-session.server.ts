import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { isAdminGoogleEmail } from './admin-google-policy'

/** Resolve the existing authenticated app session; never trust a request header
 * or a client-supplied email. authOptions currently has only Google configured. */
export async function hasAdminGoogleSession(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions)
    // 旗 APP_AUTH_ENABLED がオンのときだけ、Google の Account の行も確かめる（Apple などのログイン手段を足したあと、
    // Google 以外で入ったユーザーを通さないため）。オフのあいだは、今までと同じ判定だけで、DB を読まない。
    // ⚠️ scripts/security-regression の検証は、このファイルを許した import だけで読み込む。オフの経路で新しい import を増やさないこと。
    if (typeof process !== 'undefined' && process.env.APP_AUTH_ENABLED === '1') {
      const [{ decideAdminGoogleSession }, { prisma }] = await Promise.all([import('./auth-link/admin-google-session-core'), import('./prisma')])
      return await decideAdminGoogleSession({
        session: session as { user?: { id?: string | null; email?: string | null } | null } | null,
        appAuthOn: true,
        listGoogleAccounts: (userId) => prisma.account.findMany({ where: { userId, provider: 'google' }, select: { provider: true, providerEmail: true, emailVerified: true } }),
      })
    }
    return isAdminGoogleEmail(session?.user?.email)
  } catch {
    return false
  }
}
