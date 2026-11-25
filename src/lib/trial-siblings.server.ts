// ============================================
// 初月無料の判定に使う「同じ人の別の User」の取得（サーバーだけ）
// ============================================
// Apple の別の行などで、正規化メール（User.emailNormalized）が同じ User が複数あるとき、
// その行のメールと契約状態も初月無料の判定に含め、二重付与を防ぐ（isTrialEligible の siblingEmails / servicePlans）。
// 取得に失敗したら例外を投げる。呼び出し側は「判定不能」として付与しない（fail-closed）。
import { prisma } from '@/lib/prisma'
import { gmailCanonicalKey, isGmailAddress, normalizeEmail } from '@/lib/auth-link/email-normalize'

export type TrialSiblings = {
  emails: string[]
  /** 同じ人の別の User の User.plan と UserServiceSubscription.plan（有料なら対象外にするため） */
  plans: Array<string | null>
}

export type GmailVariantUser = { id: string; email: string | null; plan: string | null }

/**
 * Gmail のドット違い・「+」付きで、同じ人とみなす別の User（2026-11-25 三森さんの決定）。
 * 初月無料と「最初の100」の判定だけに使う。結び付けや一意の制約には使わない。
 * Gmail 系以外のメールでは、何も探さず空を返す。取得に失敗したら例外（呼び出し側は判定不能として付与しない）。
 * 索引が効かない照会（正規化メールの式）。件数が増えたら、式の索引か専用の列を足す。
 */
export async function findGmailVariantUsers(userId: string | null | undefined, email: string | null | undefined): Promise<GmailVariantUser[]> {
  if (!userId || !isGmailAddress(email)) return []
  const key = gmailCanonicalKey(email)
  if (!key) return []
  const local = key.slice(0, key.indexOf('@'))
  return prisma.$queryRaw<GmailVariantUser[]>`
    SELECT "id", "email", "plan" FROM "User"
    WHERE "id" <> ${userId}
      AND "deletedAt" IS NULL
      AND split_part("emailNormalized", '@', 2) IN ('gmail.com', 'googlemail.com')
      AND replace(split_part(split_part("emailNormalized", '@', 1), '+', 1), '.', '') = ${local}
    LIMIT 20`
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
  // Gmail のドット違い・「+」付き。メールと有料かどうかだけを加える（サービス別の契約は、同じ正規化メールの行と同様に見たいので追加で取る）
  const variants = await findGmailVariantUsers(userId, email)
  for (const v of variants) {
    if (v.email) emails.push(v.email)
    plans.push(v.plan ?? null)
  }
  if (variants.length) {
    const subs = await prisma.userServiceSubscription.findMany({ where: { userId: { in: variants.map((v) => v.id) } }, select: { plan: true }, take: 100 })
    for (const s of subs) plans.push(s.plan ?? null)
  }
  for (const r of rows) {
    if (r.email) emails.push(r.email)
    plans.push(r.plan ?? null)
    for (const s of r.serviceSubscriptions || []) plans.push(s.plan ?? null)
  }
  return { emails, plans }
}
