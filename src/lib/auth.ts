import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { sendEventNotification } from './notifications';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // 初回ログイン時（firstLoginAt が null）なら現在時刻を記録
      if (user?.id && account) {
        try {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { firstLoginAt: true },
          })
          if (!existing?.firstLoginAt) {
            await prisma.user.update({
              where: { id: user.id },
              data: { firstLoginAt: new Date() },
            })
            // 新規登録通知
            sendEventNotification({
              type: 'signup',
              userEmail: user.email,
              userName: user.name,
            }).catch(() => {})
          } else {
            // ログイン通知
            sendEventNotification({
              type: 'login',
              userEmail: user.email,
              userName: user.name,
            }).catch(() => {})
          }
        } catch (e) {
          console.error('Failed to set firstLoginAt:', e)
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        // 常にDBから最新のユーザー情報を取得（管理画面での変更を即反映）
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { 
              id: true, 
              role: true, 
              plan: true,
              firstLoginAt: true,
              serviceSubscriptions: {
                select: { serviceId: true, plan: true }
              }
            }
          })
          
          if (dbUser) {
            (session.user as any).id = dbUser.id;
            (session.user as any).role = dbUser.role || 'USER';
            (session.user as any).plan = dbUser.plan || 'FREE';
            
            // サービス別プランをセッションに載せる
            const byService = Object.fromEntries(
              dbUser.serviceSubscriptions.map((s) => [s.serviceId, s.plan])
            )
            ;(session.user as any).bannerPlan = byService['banner'] || 'FREE'
            // SEOプランは 'writing' または 'seo' サービスIDを参照（後方互換性）
            ;(session.user as any).seoPlan = byService['writing'] || byService['seo'] || undefined
            ;(session.user as any).kantanPlan = byService['kantan'] || undefined
            ;(session.user as any).interviewPlan = byService['interview'] || undefined
            ;(session.user as any).openingPlan = byService['opening'] || undefined
            // 初回ログイン時刻（1時間生成し放題の判定用）
            ;(session.user as any).firstLoginAt = dbUser.firstLoginAt?.toISOString() || null
          }
        } catch (dbErr: unknown) {
          // eslint-disable-next-line no-console
          void (console).error('Session callback DB error:', dbErr);
          // フォールバック: userオブジェクトの情報を使用
          ;(session.user as any).id = user.id;
          (session.user as any).role = (user as any).role || 'USER';
          (session.user as any).plan = (user as any).plan || 'FREE';
          (session.user as any).bannerPlan = 'FREE'
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  session: {
    // セッション更新間隔を短くして、プラン変更が素早く反映されるようにする
    maxAge: 24 * 60 * 60, // 24時間
    updateAge: 60, // 1分ごとにセッションを更新
  },
  secret: process.env.NEXTAUTH_SECRET,
};
