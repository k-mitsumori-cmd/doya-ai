import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma, withRetry } from './prisma';
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

            // ドリップ配信: 初回ログイン時のみ自動エンロール（DB接続エラー時はリトライ）
            withRetry(() => enrollUserInDripSequences(user.id)).catch((e) => {
              console.error('[Drip] Auto-enroll failed:', e)
            })
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

// ============================================
// ドリップ配信: ログイン時自動エンロール
// ============================================
async function enrollUserInDripSequences(userId: string) {
  // 配信停止済みユーザーはエンロールしない
  const unsubscribed = await prisma.dripUnsubscribe.findFirst({
    where: { userId },
  })
  if (unsubscribed) return

  // アクティブなシーケンスを取得
  const activeSequences = await prisma.dripSequence.findMany({
    where: { status: 'active' },
    include: { segment: true },
  })

  // ユーザー情報を取得（セグメント判定用）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, firstLoginAt: true, createdAt: true },
  })
  if (!user) return

  for (const seq of activeSequences) {
    // セグメント条件を評価
    if (seq.segment) {
      const conditions = seq.segment.conditions as Record<string, unknown>
      if (!matchesSegment(user, conditions)) continue
    }

    // 既にエンロール済みならスキップ
    const existing = await prisma.dripEnrollment.findUnique({
      where: { userId_sequenceId: { userId, sequenceId: seq.id } },
    })
    if (existing) continue

    // エンロール作成
    await prisma.dripEnrollment.create({
      data: { userId, sequenceId: seq.id, status: 'active', currentStep: 0 },
    })
  }
}

function matchesSegment(
  user: { plan: string; firstLoginAt: Date | null; createdAt: Date },
  conditions: Record<string, unknown>
): boolean {
  const type = conditions.type as string
  if (!type || type === 'all') return true

  if (type === 'plan_and_active') {
    return user.plan === (conditions.plan as string)
  }

  if (type === 'last_login_over') {
    const days = (conditions.days as number) || 7
    const lastLogin = user.firstLoginAt || user.createdAt
    const daysSince = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince >= days
  }

  return true
}
