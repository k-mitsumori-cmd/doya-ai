import { randomBytes } from 'node:crypto'
import { prisma, withRetry } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendEventNotification } from '@/lib/notifications'
import { enrollUserInDripSequences } from '@/lib/drip-enroll'
import { getJwks } from './jwks'
import { createPrismaAuthRepo } from './repo.server'
import type { AuthDeps } from './app-auth-service'

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)

/**
 * 本番の部品をつなぐ（Prisma・Resend・fetch・crypto）。
 * 許す aud は環境変数で決める（コードに本番の値を書かない）。
 *  - APP_GOOGLE_CLIENT_IDS: Google の iOS のクライアント ID（カンマ区切り）
 *  - APP_APPLE_BUNDLE_IDS: アプリの Bundle ID（カンマ区切り。Apple の id_token の aud）
 */
export function createRealAuthDeps(): AuthDeps {
  return {
    repo: createPrismaAuthRepo(prisma),
    now: () => new Date(),
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    getJwks: (provider, o) => getJwks(provider, { fetchImpl: fetch, now: new Date(), forceRefresh: o?.forceRefresh }),
    audiences: { google: list(process.env.APP_GOOGLE_CLIENT_IDS), apple: list(process.env.APP_APPLE_BUNDLE_IDS) },
    sendMail: async (m) => {
      const r = await sendEmail({ to: m.to, subject: m.subject, html: m.html })
      return { success: r.success }
    },
    // Web の events.createUser と同じ初回の処理（firstLoginAt の記録・通知・ドリップのエンロール）。どれが失敗しても交換は成功にする
    onUserCreated: async (userId) => {
      try {
        await prisma.user.updateMany({ where: { id: userId, firstLoginAt: null }, data: { firstLoginAt: new Date(), signupService: 'app', signupSource: 'app' } })
      } catch { /* 記録に失敗してもログインは続ける */ }
      sendEventNotification({ type: 'signup', userId, details: 'サービス: アプリ ｜ 流入経路: app' }).catch(() => {})
      await withRetry(() => enrollUserInDripSequences(userId)).catch(() => {})
    },
  }
}
