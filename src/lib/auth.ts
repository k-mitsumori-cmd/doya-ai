import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { normalizeUnifiedPlan, maxPlan } from '@/lib/planSync'
import { sendNewUserNotification } from '@/lib/notifications'

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
            select: { firstLoginAt: true, email: true, name: true, image: true },
          })
          
          // 新規ユーザーかどうかを判定（firstLoginAtがnull = 初回登録）
          const isNewUser = !existing?.firstLoginAt
          
          if (isNewUser) {
            // 初回ログイン時刻を記録
            await prisma.user.update({
              where: { id: user.id },
              data: { firstLoginAt: new Date() },
            })
            
            // 新規ユーザー通知を送信（非同期、エラーはログに記録するだけ）
            sendNewUserNotification({
              userId: user.id,
              email: existing?.email || user.email || null,
              name: existing?.name || user.name || null,
              image: existing?.image || user.image || null,
              provider: account.provider || 'unknown',
            }).catch((e) => {
              console.error('Failed to send new user notification:', e)
            })
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
            // Complete Pack: DB上でサービス別プランがズレていても、ユーザー体験は「統一プラン」で表示する
            // 安全側（権限を落とさない）: user.plan と serviceSubscriptions の最大値を採用
            const serviceMax = dbUser.serviceSubscriptions
              .filter((s) => ['banner', 'writing', 'persona', 'seo'].includes(String(s.serviceId)))
              .map((s) => normalizeUnifiedPlan(s.plan))
              .reduce((acc, p) => maxPlan(acc, p), 'FREE' as const)
            const unified = maxPlan(normalizeUnifiedPlan(dbUser.plan || 'FREE'), serviceMax)
            ;(session.user as any).plan = unified;
            
            // サービス別プランをセッションに載せる
            // Complete Pack: 各サービスの表示/権限は統一プランを優先（DBがまだ揃っていなくてもUIをズラさない）
            ;(session.user as any).bannerPlan = unified
            ;(session.user as any).seoPlan = unified
            ;(session.user as any).personaPlan = unified
            // kantan は Complete Pack 対象外（従来通り）
            const byService = Object.fromEntries(dbUser.serviceSubscriptions.map((s) => [s.serviceId, s.plan]))
            ;(session.user as any).kantanPlan = byService['kantan'] || undefined
            // interview プランをセッションに載せる
            ;(session.user as any).interviewPlan = byService['interview'] || unified
            // 初回ログイン時刻（1時間生成し放題の判定用）
            ;(session.user as any).firstLoginAt = dbUser.firstLoginAt?.toISOString() || null
          }
        } catch (error) {
          console.error('Session callback DB error:', error)
          // フォールバック: userオブジェクトの情報を使用
          (session.user as any).id = user.id;
          (session.user as any).role = (user as any).role || 'USER';
          const unified = normalizeUnifiedPlan((user as any).plan || 'FREE')
          ;(session.user as any).plan = unified;
          ;(session.user as any).bannerPlan = unified
          ;(session.user as any).seoPlan = unified
          ;(session.user as any).personaPlan = unified
          ;(session.user as any).interviewPlan = unified
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
