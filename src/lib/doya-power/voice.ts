// ============================================
// 音声（AI商談・AI面接）のドヤパワー（本番の部品をつないだもの）
// ============================================
// 中身は voice-core.ts。ここは旗・組織の持ち主・会社・台帳（Prisma）をつなぐだけ。
// ⚠️ 相手側（ログインしていない応募者・お客さま）と cron からも呼ぶので、セッションは使わない。
//    会社は組織の持ち主（getOrganizationOwnerUserId。今の上限の数え方と同じ人）の account_companies から決める。
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getOrganizationOwnerUserId } from '@/lib/organization-billing'
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'
import { doyaPowerRollout } from './flag'
import { consume, refund, grantMonthlyForPlan, operationStatus } from './index'
import { createVoiceCharger } from './voice-core'

export const voiceCharger = createVoiceCharger({
  rollout: () => doyaPowerRollout(),
  owner: async (service, organizationId) => {
    const userId = await getOrganizationOwnerUserId(service, organizationId)
    if (!userId) return null
    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, plan: true } }),
      prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } }),
    ])
    return { email: user?.email ?? null, plan: user?.plan ?? null, companyId: company?.id ?? null }
  },
  allowed: (email) => canPreviewUiNext(email, uiPreviewEmails()),
  ledger: { consume, refund, grantMonthlyForPlan, operationStatus },
})

/** URL の文字列（秘密）をそのまま台帳に残さないための、短い要約 */
export function voiceTokenKey(prefix: string, token: string): string {
  return `${prefix}-${createHash('sha256').update(token).digest('hex').slice(0, 24)}`
}
