import { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'USER' | 'ADMIN'
      plan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'BUNDLE' | 'ENTERPRISE' | 'PREMIUM'
      bannerPlan?: 'FREE' | 'PRO' | 'ENTERPRISE'
      seoPlan?: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'
      kantanPlan?: 'FREE' | 'PRO' | 'ENTERPRISE'
      /** 初回ログイン時刻（ISO文字列）。この時刻から1時間は生成し放題 */
      firstLoginAt?: string | null
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: 'USER' | 'ADMIN'
    plan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'BUNDLE' | 'ENTERPRISE' | 'PREMIUM'
  }
}


