// ============================================
// 初月無料の判定に使う「同じ人の別の User」の取得（サーバーだけ）
// ============================================
// Apple の別の行などで、正規化メール（User.emailNormalized）が同じ User が複数あるとき、
// その行のメールと契約状態も初月無料の判定に含め、二重付与を防ぐ（isTrialEligible の siblingEmails / servicePlans）。
// 取得に失敗したら例外を投げる。呼び出し側は「判定不能」として付与しない（fail-closed）。
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/auth-link/email-normalize'

export type TrialSiblings = {
  emails: string[]
  /** 同じ人の別の User の User.plan と UserServiceSubscription.plan（有料なら対象外にするため） */
  plans: Array<string | null>
}

export async function findTrialSiblings(userId: string | null | undefined, email: string | null | undefined): Promise<TrialSiblings> {
  const n = normalizeEmail(email)
  if (!userId || !n) return { emails: [], plans: [] }
  const rows = await prisma.user.findMany({
    where: { emailNormalized: n, id: { not: userId }, deletedAt: null },
    select: { email: true, plan: true, serviceSubscriptions: { select: { plan: true } } },
    take: 20,
  })
  const emails: string[] = []
  const plans: Array<string | null> = []
  for (const r of rows) {
    if (r.email) emails.push(r.email)
    plans.push(r.plan ?? null)
    for (const s of r.serviceSubscriptions || []) plans.push(s.plan ?? null)
  }
  return { emails, plans }
}
