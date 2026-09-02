// ============================================
// 組織スコープ型サービスの無料枠（統一プラン方式）
// ============================================
// ⚠️ services.ts の pricing.free.limit は**利用者への約束**であり、
//    サービスカードと料金表に表示される。ここで実際に効かせないと
//    「3件までと書いてあるのに無制限に使える」という嘘になる。
//    2026-08-09 時点で quote / aishodan / mensetsu は宣言だけで
//    未実装だった（＝無料で無制限に使えていた）。
//
// ⚠️ 特に音声を使うサービス（商談・面接）は1件ごとに OpenAI Realtime の
//    従量課金が発生する。上限が無いと費用が青天井になる。
//
// ⚠️ **プロプランにも上限を置く。** 無制限にすると、月額9,980円の統一プランに対して
//    実費（Realtime の通話時間・AIエンジンへの一斉問い合わせ）が青天井になり、
//    使われるほど赤字が深くなる。2026-09-02 まで有料側は完全に無制限だった。
//    無料は「累計」、プロは「月次」で数える（有料は毎月枠が戻る）。
//
// ⚠️ 上限値はこのファイルに集約する。services.ts の表示文言を変えたら
//    ここも必ず合わせること（片方だけ直すと表示と実態がずれる）。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPaidPlan } from '@/lib/unified-plan'

/** 無料プランの上限。services.ts の pricing.free.limit と対応させること */
export const FREE_LIMITS = {
  /** 見積書の作成件数（累計） */
  quoteDocuments: 3,
  /** 商材の登録件数（累計） */
  aishodanProducts: 1,
  /** 商談の実施件数（累計） */
  aishodanSessions: 5,
  /** 質問セットの作成件数（累計） */
  mensetsuTemplates: 1,
  /** 面接の発行件数（累計） */
  mensetsuSessions: 3,
} as const

/**
 * プロプランの上限（**月次**。毎月1日に戻る）。
 * ⚠️ 1件あたりの実費に応じて決める。音声を使う面接・商談が最も重く、
 *    テキストだけの見積書が最も軽い。
 * ⚠️ 「登録件数」のような、実費がほぼ発生しない累計上限には枠を置かない（null）。
 */
export const PRO_MONTHLY_LIMITS: Record<FreeLimitKey, number | null> = {
  // 1件10分の音声通話。Realtime の従量課金が直接効く
  mensetsuSessions: 30,
  aishodanSessions: 30,
  // テキストのみで軽い
  quoteDocuments: 100,
  // 置き場所を作るだけで実費が出ない
  aishodanProducts: null,
  mensetsuTemplates: null,
}

/** ENTERPRISE の月次上限。個別契約のため広めに取るが、無制限にはしない */
export const ENTERPRISE_MONTHLY_LIMITS: Record<FreeLimitKey, number | null> = {
  mensetsuSessions: 200,
  aishodanSessions: 200,
  quoteDocuments: 500,
  aishodanProducts: null,
  mensetsuTemplates: null,
}

export type FreeLimitKey = keyof typeof FREE_LIMITS

/** ログイン中ユーザーが有料プランか */
export async function isProUser(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const id = (session?.user as any)?.id as string | undefined
  if (!id && !email) return false
  const user = await prisma.user.findFirst({
    where: id ? { id } : { email: email as string },
    select: { plan: true },
  })
  return isPaidPlan(user?.plan)
}

/**
 * 指定ユーザーが有料プランか。
 * ⚠️ ゲスト（未ログイン）が起点となる処理で使う。
 *    商談ルームは見込み客が開くため、判定すべきは「開いた人」ではなく
 *    「その部屋を出している契約者」のプラン。
 */
export async function isUserPro(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  return isPaidPlan(user?.plan)
}

export interface QuotaResult {
  ok: boolean
  /** 利用者に見せる文言 */
  reason?: string
  used?: number
  limit?: number
}

/** JST 当月1日0時の UTC Date。有料プランの枠は毎月ここで戻る */
export function jstStartOfMonthUtc(): Date {
  const jst = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1, 0, 0, 0) - 9 * 3600_000)
}

/** 指定ユーザーのプラン区分。未ログイン・不明は FREE 扱い */
async function planTierOf(userId: string | null | undefined): Promise<'FREE' | 'PRO' | 'ENTERPRISE'> {
  if (!userId) return 'FREE'
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  if (String(user?.plan || '').toUpperCase() === 'ENTERPRISE') return 'ENTERPRISE'
  return isPaidPlan(user?.plan) ? 'PRO' : 'FREE'
}

/** ログイン中ユーザーのプラン区分 */
async function currentPlanTier(): Promise<'FREE' | 'PRO' | 'ENTERPRISE'> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const id = (session?.user as any)?.id as string | undefined
  if (!id && !email) return 'FREE'
  const user = await prisma.user.findFirst({
    where: id ? { id } : { email: email as string },
    select: { id: true },
  })
  return planTierOf(user?.id)
}

/**
 * 上限を超えていないか判定する。
 * @param key        上限の種類
 * @param countUsed  現在の利用数を数える関数（組織スコープで数えること）
 * @param ownerUserId ログイン中ユーザーではなく、指定ユーザーのプランで判定する（ゲスト起点の処理用）
 * @param countSince  **有料プラン用**。指定日時以降の利用数を数える関数。
 *                    渡さないと有料プランは無制限になるため、実費が発生する処理では必ず渡すこと。
 *
 * ⚠️ 有料判定は「ログイン中ユーザー」で行う。組織単位ではない。
 *    統一プランは個人の契約なので、判定すべきは契約者のプラン。
 */
export async function assertFreeLimit(
  key: FreeLimitKey,
  countUsed: () => Promise<number>,
  ownerUserId?: string | null,
  countSince?: (since: Date) => Promise<number>
): Promise<QuotaResult> {
  const tier = ownerUserId !== undefined ? await planTierOf(ownerUserId) : await currentPlanTier()

  if (tier !== 'FREE') {
    const table = tier === 'ENTERPRISE' ? ENTERPRISE_MONTHLY_LIMITS : PRO_MONTHLY_LIMITS
    const monthly = table[key]
    // 上限を置いていない種類、または月次を数える手段が渡されていない場合は通す
    if (monthly == null || !countSince) return { ok: true }

    const used = await countSince(jstStartOfMonthUtc())
    if (used < monthly) return { ok: true, used, limit: monthly }
    return {
      ok: false,
      used,
      limit: monthly,
      // ⚠️ 既に支払っている方に「プロにご登録を」と返さないこと
      reason: `今月の上限（${monthly}件）に達しました。来月1日に枠が戻ります。追加をご希望の場合はお問い合わせよりご相談ください。`,
    }
  }

  const limit = FREE_LIMITS[key]
  const used = await countUsed()
  if (used < limit) return { ok: true, used, limit }

  return {
    ok: false,
    used,
    limit,
    reason: `無料プランでご利用いただける上限（${limit}件）に達しました。プロプランにご登録いただくと上限が広がります。`,
  }
}
