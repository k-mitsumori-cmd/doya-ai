// ============================================
// 手動付与アカウント（課金監査の対象外・Webhookでの降格から保護）
// ============================================
// Stripe の契約と DB のプランが**意図的に**一致しないアカウントを登録する。
// 例: 運営用アカウント（契約なしで PRO）、個別契約（Stripeは¥9,980だがDBはENTERPRISE）。
//
// なぜ必要か:
//   1. 監査（billing-audit）はこれらを「過剰付与」「サービス行のズレ」として毎日
//      critical で鳴らす。本物の異常が埋もれるので、意図的なものは除外する。
//   2. **より重要**: updateUserSubscription() は Stripe の価格から算出した階層で
//      User.plan を上書きするため、手動で付けた上位プランは**次回の請求
//      （customer.subscription.updated）で静かに消える**。ここに登録された
//      アカウントは、DB の方が上位なら下げない。
//
// 登録先（どちらでもよい。両方あれば合算）:
//   - SystemSetting.key = 'billing_manual_grants' … 値はカンマ区切り or JSON配列
//   - 環境変数 BILLING_MANUAL_GRANT_EMAILS … カンマ区切り
//
// 仕様: reference/11-billing-spec.md
import { prisma } from '@/lib/prisma'

export const MANUAL_GRANTS_SETTING_KEY = 'billing_manual_grants'

let cache: { at: number; emails: Set<string> } | null = null
const CACHE_MS = 60_000

export function parseManualGrantEmails(raw: string | null | undefined): string[] {
  const v = String(raw || '').trim()
  if (!v) return []
  let entries: unknown[]
  if (v.startsWith('[')) {
    // A malformed exemption list must fail the billing transaction. Treating
    // it as empty can silently downgrade an account on the next Stripe event.
    const arr: unknown = JSON.parse(v)
    if (!Array.isArray(arr)) throw new Error('Invalid manual grant list')
    entries = arr
  } else entries = v.split(',')
  if (entries.some(email => typeof email !== 'string')) throw new Error('Invalid manual grant list')
  const emails = (entries as string[]).filter(email => email.trim())
  if ((entries.length > 0 && emails.length === 0) ||
      emails.some(email => !/^[^\s,@"'\[\]{}]+@[^\s,@"'\[\]{}]+$/.test(email.trim()))) throw new Error('Invalid manual grant list')
  return emails
}

/** 手動付与として扱うメールアドレス（小文字）の集合 */
export async function getManualGrantEmails(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.emails

  const emails = new Set<string>()
  for (const e of parseManualGrantEmails(process.env.BILLING_MANUAL_GRANT_EMAILS)) {
    const t = e.trim().toLowerCase()
    if (t) emails.add(t)
  }
  let value: string | null | undefined
  try {
    value = (await prisma.systemSetting.findUnique({ where: { key: MANUAL_GRANTS_SETTING_KEY } }))?.value
  } catch {
    // 参照できなくても監査自体は続ける（除外されないだけで安全側）
  }
  for (const e of parseManualGrantEmails(value)) {
    const t = e.trim().toLowerCase()
    if (t) emails.add(t)
  }

  cache = { at: Date.now(), emails }
  return emails
}

/** そのメールが手動付与として登録されているか */
export async function isManualGrant(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const set = await getManualGrantEmails()
  return set.has(String(email).trim().toLowerCase())
}
