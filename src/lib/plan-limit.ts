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

/**
 * 無料枠を超えていないか判定する。
 * @param key       上限の種類
 * @param countUsed 現在の利用数を数える関数（組織スコープで数えること）
 *
 * ⚠️ 有料判定は「ログイン中ユーザー」で行う。組織単位ではない。
 *    統一プランは個人の契約なので、契約者が操作している限り上限は外れる。
 */
export async function assertFreeLimit(
  key: FreeLimitKey,
  countUsed: () => Promise<number>,
  /** ログイン中ユーザーではなく、指定ユーザーのプランで判定する（ゲスト起点の処理用） */
  ownerUserId?: string | null
): Promise<QuotaResult> {
  const pro = ownerUserId !== undefined ? await isUserPro(ownerUserId) : await isProUser()
  if (pro) return { ok: true }

  const limit = FREE_LIMITS[key]
  const used = await countUsed()
  if (used < limit) return { ok: true, used, limit }

  return {
    ok: false,
    used,
    limit,
    reason: `無料プランでご利用いただける上限（${limit}件）に達しました。プロプランにご登録いただくと制限なくご利用いただけます。`,
  }
}
