import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false
      
      try {
        // ユーザーが存在しなければ作成
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            googleId: account?.providerAccountId,
          },
          create: {
            email: user.email,
            name: user.name,
            googleId: account?.providerAccountId,
          },
        })
        return true
      } catch (error) {
        console.error('SignIn error:', error)
        return false
      }
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: {
            subscription: true,
          },
        })
        if (dbUser) {
          ;(session.user as any).id = dbUser.id
          ;(session.user as any).role = dbUser.role
          ;(session.user as any).plan = dbUser.subscription?.status === 'active' ? 'PRO' : 'FREE'
          ;(session.user as any).subscriptionStatus = dbUser.subscription?.status
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
}

