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
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: 'USER' | 'ADMIN'
    plan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'BUNDLE' | 'ENTERPRISE' | 'PREMIUM'
  }
}


