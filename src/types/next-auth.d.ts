import { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'USER' | 'ADMIN'
      plan: 'FREE' | 'PREMIUM'
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: 'USER' | 'ADMIN'
    plan: 'FREE' | 'PREMIUM'
  }
}


