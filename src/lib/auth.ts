import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        (session.user as any).id = user.id;
        (session.user as any).role = (user as any).role || 'USER';
        (session.user as any).plan = (user as any).plan || 'FREE';
        // サービス別プラン（例: bannerPlan）をセッションに載せてUI/上限判定のブレを防ぐ
        try {
          const subs = await prisma.userServiceSubscription.findMany({
            where: { userId: user.id },
            select: { serviceId: true, plan: true },
          })
          const byService = Object.fromEntries(subs.map((s) => [s.serviceId, s.plan]))
          ;(session.user as any).bannerPlan = byService['banner'] || 'FREE'
          ;(session.user as any).seoPlan = byService['seo'] || undefined
          ;(session.user as any).kantanPlan = byService['kantan'] || undefined
        } catch {
          ;(session.user as any).bannerPlan = (session.user as any).bannerPlan || 'FREE'
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
