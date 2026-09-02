// ============================================
// ドヤ広告画像AI 認証・ゲスト・プラン上限
// ============================================
// ⚠️ 2026-08-17 に**ログイン必須**にした。
//    それまでは未ログインでも guestId(Cookie) で生成できたが、
//    上限はCookie単位なので**Cookieを消せば何度でも生成できた**。
//    1コンセプトで複数枚の画像を生成するため、費用が青天井になる経路だった。
//    ゲスト用のコードは残してあるが `ALLOW_GUEST` で止めている（復活の余地）。
//
// ログインユーザーは User.plan（統一プラン）で判定する。組織スコープではない。
//
// ⚠️ 課金・改善の単位は「コンセプト」。1コンセプトから何サイズ書き出しても1回と数える。
//    サイズ単位で数えると、配置を多く選ぶほど不利になり、本サービスの価値と逆行する。
import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const GUEST_COOKIE = 'adimage_gid'

/** ゲストIDの形式。randomBytes(16).toString('hex') と一致させること */
const GUEST_ID_PATTERN = /^[0-9a-f]{32}$/

export type AdImagePlan = 'GUEST' | 'FREE' | 'PRO'

/**
 * 未ログインでの利用を許すか。
 * ⚠️ false のあいだ、ゲスト経路（Cookie発行・GUEST上限）は一切使われない。
 *    上限がCookie単位で、消せば回避できてしまうため止めている。
 */
export const ALLOW_GUEST = false

/** 日次のコンセプト生成上限 */
export const DAILY_CONCEPT_LIMIT: Record<AdImagePlan, number> = { GUEST: 2, FREE: 5, PRO: 40 }

/**
 * 画像枚数の上限。
 * ⚠️ コンセプト数とは別に**枚数でも**縛る。1コンセプトから何枚でも書き出せるため、
 *    コンセプト数だけで縛ると無料でも実質無制限に画像が作れてしまう（課金理由が無くなる）。
 * ⚠️ PRO は1回あたり10枚の上限（MAX_PLACEMENTS_PER_RUN）で守るため、日次・月次は置かない。
 */
export const DAILY_IMAGE_LIMIT: Record<AdImagePlan, number | null> = { GUEST: 2, FREE: 3, PRO: null }
export const MONTHLY_IMAGE_LIMIT: Record<AdImagePlan, number | null> = { GUEST: 5, FREE: 15, PRO: null }

/** 一度の生成で出せる配置の上限。⚠️ 増やすと maxDuration(300秒) に収まらない */
export const MAX_PLACEMENTS_PER_RUN = 10

export interface AdImageIdentity {
  userId: string | null
  guestId: string | null
  plan: AdImagePlan
}

function isPaid(plan?: string | null) {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}

export async function getIdentity(req: NextRequest): Promise<AdImageIdentity> {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = u?.id
  }
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
    return { userId, guestId: null, plan: isPaid(u?.plan) ? 'PRO' : 'FREE' }
  }
  // ⚠️ Cookie の中身をそのまま信用しない。この値は
  //    `${identity.userId || identity.guestId}/...` という形で
  //    Supabase Storage のオブジェクトキーの先頭に入る。
  //    `../interview` のような値を送られると、supabase-js は `..` を除去せず
  //    URL パーサが解決してしまい、**別サービスのバケットへ書き込める**
  //    （service-role キーで upsert される）。
  //    発行時と同じ形式（16バイトのhex）だけを受け付け、外れたら未設定として扱う。
  if (!ALLOW_GUEST) return { userId: null, guestId: null, plan: 'GUEST' }
  const raw = req.cookies.get(GUEST_COOKIE)?.value
  const guestId = raw && GUEST_ID_PATTERN.test(raw) ? raw : null
  return { userId: null, guestId, plan: 'GUEST' }
}

/** Cookie が無いゲストには新規発行する（呼び出し側でレスポンスに載せる） */
export function ensureGuestId(id: AdImageIdentity): { identity: AdImageIdentity; newGuestId: string | null } {
  if (id.userId || id.guestId) return { identity: id, newGuestId: null }
  // ⚠️ ログイン必須のあいだは新規のゲストIDを発行しない
  if (!ALLOW_GUEST) return { identity: id, newGuestId: null }
  const guestId = randomBytes(16).toString('hex')
  return { identity: { ...id, guestId }, newGuestId: guestId }
}

/**
 * 所有者スコープ。⚠️ 全ての取得・更新でこの条件を必ず併用すること（IDOR防止）。
 * null が返るのは識別子が無いときで、その場合は何も返してはいけない。
 */
export function ownerWhere(id: AdImageIdentity): { userId: string } | { guestId: string } | null {
  if (id.userId) return { userId: id.userId }
  if (id.guestId) return { guestId: id.guestId }
  return null
}

/** JST 当日0時の UTC Date */
export function jstStartOfTodayUtc(): Date {
  const now = Date.now()
  const jst = new Date(now + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 0, 0, 0) - 9 * 3600_000)
}

/** 当日に生成したコンセプト数（JST） */
export async function conceptsToday(id: AdImageIdentity): Promise<number> {
  const where = ownerWhere(id)
  if (!where) return 0
  return prisma.adImageConcept.count({
    where: {
      campaign: where,
      createdAt: { gte: jstStartOfTodayUtc() },
    },
  })
}

/** JST 当月1日0時の UTC Date */
export function jstStartOfMonthUtc(): Date {
  const jst = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1, 0, 0, 0) - 9 * 3600_000)
}

/** 期間内に生成した画像の枚数 */
export async function imagesSince(id: AdImageIdentity, since: Date): Promise<number> {
  const where = ownerWhere(id)
  if (!where) return 0
  return prisma.adImageCreative.count({
    where: { concept: { campaign: where }, createdAt: { gte: since } },
  })
}

/**
 * 生成してよいか。
 * @param requestedImages これから作る枚数。枠を超える生成を**始める前に**弾く。
 */
export async function assertQuota(
  id: AdImageIdentity,
  requestedImages = 1
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // 1回あたりの枚数（全プラン共通）
  if (requestedImages > MAX_PLACEMENTS_PER_RUN) {
    return { ok: false, reason: `一度に生成できるのは${MAX_PLACEMENTS_PER_RUN}枚までです。` }
  }

  // 枚数の上限（無料プランのみ）
  const dailyImages = DAILY_IMAGE_LIMIT[id.plan]
  const monthlyImages = MONTHLY_IMAGE_LIMIT[id.plan]
  if (dailyImages != null) {
    const usedToday = await imagesSince(id, jstStartOfTodayUtc())
    if (usedToday + requestedImages > dailyImages) {
      return {
        ok: false,
        reason: `無料プランは1日${dailyImages}枚までです（本日${usedToday}枚）。プロプランにご登録いただくと上限が広がります。`,
      }
    }
  }
  if (monthlyImages != null) {
    const usedMonth = await imagesSince(id, jstStartOfMonthUtc())
    if (usedMonth + requestedImages > monthlyImages) {
      return {
        ok: false,
        reason: `無料プランは月${monthlyImages}枚までです（今月${usedMonth}枚）。プロプランにご登録いただくと上限が広がります。`,
      }
    }
  }

  const used = await conceptsToday(id)
  const limit = DAILY_CONCEPT_LIMIT[id.plan]
  if (used >= limit) {
    return {
      ok: false,
      reason:
        id.plan === 'PRO'
          ? '本日の生成上限に達しました。明日また実行できます。'
          : 'お試しの上限に達しました。プロプランにご登録いただくと制限なくご利用いただけます。',
    }
  }
  return { ok: true }
}

/**
 * ログインしているか。していなければ返すべきエラーを返す。
 * ⚠️ 未ログインを弾くのは各APIの責務。`ownerWhere()` が null を返すのを
 *    そのまま「空の結果」として扱うと、書き込み系APIで
 *    「識別子が無いのに処理が進む」経路を作りかねない。
 */
export function requireUser(id: AdImageIdentity): { ok: true } | { ok: false; reason: string } {
  if (id.userId) return { ok: true }
  return { ok: false, reason: 'ご利用にはログインが必要です。' }
}
