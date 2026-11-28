import type { Adapter } from 'next-auth/adapters'

/**
 * アプリが発行したセッション（AppDevice.sessionId が指す Session の行）の期限を、NextAuth に延ばさせない。
 *
 * NextAuth は、DB のセッションを使うたびに、updateAge（1分）を過ぎていれば updateSession で expires を「いま + 24時間」に延ばす（spike の 3.3）。
 * そのままだと、アプリのアクセストークン（発行から1時間）が、使うたびに24時間まで延びてしまう。
 * この包みは、アプリのセッションの updateSession だけを何もしない処理にする。Web のセッション・ほかの関数は、従来どおり。
 * 旗 APP_AUTH_ENABLED がオンのときだけ、auth.ts が包む。オフのあいだは、包まない（動きは変わらない）。
 * 期限が切れたセッションは、NextAuth が getSessionAndUser で消す。アプリは 401 を受けて、リフレッシュトークンで取り直す。
 */
export function guardAppSessionExpiry(adapter: Adapter, isAppSession: (sessionToken: string) => Promise<boolean>): Adapter {
  const original = adapter.updateSession
  if (!original) return adapter
  return {
    ...adapter,
    async updateSession(session) {
      if (session?.sessionToken && (await isAppSession(session.sessionToken))) return undefined
      return original.call(adapter, session)
    },
  }
}
