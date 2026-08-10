// ============================================
// ドヤ広告画像AI 認証・ゲスト・プラン上限
// ============================================
// ログインユーザーは User.plan（統一プラン）、未ログインは guestId(Cookie) で管理する。
// 構成は adbanner/access.ts と同型（組織スコープではない）。
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

/** 日次のコンセプト生成上限 */
export const DAILY_CONCEPT_LIMIT: Record<AdImagePlan, number> = { GUEST: 2, FREE: 5, PRO: 40 }

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
  const raw = req.cookies.get(GUEST_COOKIE)?.value
  const guestId = raw && GUEST_ID_PATTERN.test(raw) ? raw : null
  return { userId: null, guestId, plan: 'GUEST' }
}

/** Cookie が無いゲストには新規発行する（呼び出し側でレスポンスに載せる） */
export function ensureGuestId(id: AdImageIdentity): { identity: AdImageIdentity; newGuestId: string | null } {
  if (id.userId || id.guestId) return { identity: id, newGuestId: null }
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

export async function assertQuota(id: AdImageIdentity): Promise<{ ok: true } | { ok: false; reason: string }> {
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
