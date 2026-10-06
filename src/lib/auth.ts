import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma, withRetry } from './prisma';
import { sendEventNotification } from './notifications';
import { readAttributionFromCookies } from './attribution';
import { enrollUserInDripSequences } from './drip-enroll';
import { higherPlan } from './plan-utils';
import { authLogger } from './auth-logger';
import { isRecentRegistration } from './registration-classification';

export const authOptions: NextAuthOptions = {
  logger: authLogger,
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // ※ 新規ユーザーの初回OAuthログインでは、この signIn コールバックは
      //   DBにユーザーが作成される前に走る（existing === null）。その場合の
      //   firstLoginAt記録・自動エンロールは events.createUser 側で確実に行う。
      //   ここでは「既にDBに存在するユーザー」だけを扱う。
      if (user?.id && account) {
        try {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { firstLoginAt: true, createdAt: true },
          })
          if (!existing) {
            // 新規ユーザー（DB未作成）→ events.createUser に委譲
          } else if (!existing.firstLoginAt) {
            // ログイン情報の補完は新規登録とは別。作成日時から分類する。
            const attr = await readAttributionFromCookies()
            const isNewRegistration = isRecentRegistration(existing.createdAt?.toISOString())
            const claimed = await prisma.user.updateMany({
              where: { id: user.id, firstLoginAt: null },
              data: {
                firstLoginAt: new Date(),
                ...(isNewRegistration ? { signupService: attr.service, signupSource: attr.source } : {}),
              },
            })
            sendEventNotification({
              type: claimed.count === 1 && isNewRegistration ? 'signup' : 'login',
              userId: user.id,
              userEmail: user.email,
              userName: user.name,
              details: `サービス: ${attr.serviceLabel} ｜ 流入経路: ${attr.source}`,
            }).catch(() => {})
            // 補完を獲得した処理だけが既存のエンロールを起動する。
            if (claimed.count === 1) withRetry(() => enrollUserInDripSequences(user.id)).catch(() => {
              console.error('[Drip] Auto-enroll failed:')
            })
          } else {
            // ログイン通知（どのサービスからのログインか＋流入経路つき）
            const attr = await readAttributionFromCookies()
            sendEventNotification({
              type: 'login',
              userEmail: user.email,
              userName: user.name,
              details: `サービス: ${attr.serviceLabel} ｜ 流入経路: ${attr.source}`,
            }).catch(() => {})
          }
        } catch (e) {
          console.error('Failed to set firstLoginAt:')
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
              createdAt: true,
              serviceSubscriptions: {
                select: { serviceId: true, plan: true }
              }
            }
          })
          
          if (dbUser) {
            (session.user as any).id = dbUser.id;
            (session.user as any).role = dbUser.role || 'USER';
            (session.user as any).plan = dbUser.plan || 'FREE';
            
            // ------------------------------------------------------------------
            // サービス別プランをセッションに載せる
            // ------------------------------------------------------------------
            // ⚠️ 必ず User.plan との**上位**を採る（reference/11-billing-spec.md）。
            //    消費側は `user.seoPlan || user.plan` の形で書かれており **'FREE' は truthy** なので、
            //    UserServiceSubscription の行が古い/欠けていると、User.plan が PRO でも
            //    そのサービスだけ無料に落ちる（2026-08 の障害はこの経路で顕在化した）。
            //    上位採用なら、行が壊れても権利を失わず、管理画面での個別付与も失われない。
            const byService = Object.fromEntries(
              dbUser.serviceSubscriptions.map((s) => [s.serviceId, s.plan])
            )
            const svcPlan = (serviceId: string) => higherPlan(dbUser.plan, byService[serviceId])
            ;(session.user as any).bannerPlan = svcPlan('banner')
            // SEOプランは 'writing' または 'seo' サービスIDを参照（後方互換性）
            ;(session.user as any).seoPlan = higherPlan(
              dbUser.plan,
              byService['writing'] || byService['seo']
            )
            ;(session.user as any).kantanPlan = svcPlan('kantan')
            ;(session.user as any).interviewPlan = svcPlan('interview')
            ;(session.user as any).openingPlan = svcPlan('opening')
            ;(session.user as any).doyalistPlan = svcPlan('doyalist')
            ;(session.user as any).kintaiPlan = svcPlan('kintai')
            // 作成日時は登録計測、初回ログイン日時は既存利用情報として分ける。
            ;(session.user as any).firstLoginAt = dbUser.firstLoginAt?.toISOString() || null
            ;(session.user as any).createdAt = dbUser.createdAt?.toISOString() || null
          }
        } catch {
          // eslint-disable-next-line no-console
          void (console).error('Session callback DB error:');
          ;(session.user as any).createdAt = null
          ;(session.user as any).firstLoginAt = null
          // フォールバック: userオブジェクトの情報を使用
          ;(session.user as any).id = user.id;
          (session.user as any).role = (user as any).role || 'USER';
          (session.user as any).plan = (user as any).plan || 'FREE';
          // DBの再取得に失敗しても、手元の有料プランをFREEへ誤って落とさない。
          (session.user as any).bannerPlan = (session.user as any).plan
        }
      }
      return session;
    },
  },
  events: {
    // 新規ユーザー作成時（OAuth初回ログイン）に確実に1回だけ発火する。
    // ※ signIn コールバックは新規ユーザーではDB作成前に走り user.id がDB未確定のため
    //   firstLoginAt 記録・自動エンロールが取りこぼされる。ここで確実に補完する。
    async createUser({ user }) {
      try {
        if (!user?.id) return
        // 既に signIn 側で処理済みなら二重処理しない（べき等）
        const existing = await prisma.user.findUnique({
          where: { id: user.id },
          select: { firstLoginAt: true, createdAt: true },
        })
        if (!existing || existing.firstLoginAt) return

        const attr = await readAttributionFromCookies()
        const isNewRegistration = isRecentRegistration(existing.createdAt?.toISOString())
        const claimed = await prisma.user.updateMany({
          where: { id: user.id, firstLoginAt: null },
          data: {
            firstLoginAt: new Date(),
            ...(isNewRegistration ? { signupService: attr.service, signupSource: attr.source } : {}),
          },
        })
        if (claimed.count !== 1) return

        // 確認できた作成日時と、成功した補完の結果で分類する。
        sendEventNotification({
          type: isNewRegistration ? 'signup' : 'login',
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          details: `サービス: ${attr.serviceLabel} ｜ 流入経路: ${attr.source}`,
        }).catch(() => {})

        // ドリップ配信: 自動エンロール
        await withRetry(() => enrollUserInDripSequences(user.id)).catch((e) => {
          console.error('[Drip] Auto-enroll failed (createUser):')
        })
      } catch (e) {
        console.error('[events.createUser] failed:')
      }
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

// ドリップ配信の自動エンロールは `src/lib/drip-enroll.ts` に集約（cron/hubspot-sync と共用）。
