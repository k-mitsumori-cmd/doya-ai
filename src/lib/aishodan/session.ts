// ============================================
// ドヤAI商談 セッションの解決（ゲスト向けAPI共通）
// ============================================
// ⚠️ 未認証で叩かれる口の入口。sessionId だけで引かず、必ず roomToken と
//    Cookie の guestId の三重条件でスコープする。
//    （sessionId が漏れても他人の商談を操作できないようにするため）
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

export const GUEST_COOKIE = 'aishodan_gid'

export async function loadGuestSession(req: NextRequest, roomToken: string, sessionId: string, db: Pick<Prisma.TransactionClient, 'aishodanSession'> = prisma) {
  const guestId = req.cookies.get(GUEST_COOKIE)?.value
  if (!guestId || !sessionId) return null
  return db.aishodanSession.findFirst({
    where: { id: sessionId, guestId, room: { token: roomToken } },
    include: {
      room: {
        include: {
          organization: { select: { id: true, name: true, retentionDays: true } },
          scenario: { include: { product: { select: { id: true, name: true, profile: true } } } },
        },
      },
    },
  })
}

export type GuestSession = NonNullable<Awaited<ReturnType<typeof loadGuestSession>>>

/** 商談を続けてよい状態か */
export function assertSessionUsable(s: GuestSession, options: { requireStarted?: boolean } = {}): { ok: true } | { ok: false; reason: string; status: number } {
  if (s.purgeAfter && s.purgeAfter.getTime() <= Date.now()) {
    return { ok: false, reason: 'この商談の保存期間は終了しました。', status: 410 }
  }
  if (s.endedAt || !['pending', 'live'].includes(s.status)) {
    return { ok: false, reason: 'この商談は終了しているか、利用できない状態です。', status: 410 }
  }
  if (s.room.isActive === false) {
    return { ok: false, reason: 'この商談ルームは公開を終了しています。', status: 410 }
  }
  if (!s.consentedAt) return { ok: false, reason: '先に同意が必要です。', status: 403 }
  if (options.requireStarted && (!s.startedAt || s.status !== 'live')) {
    return { ok: false, reason: '先に音声商談を開始してください。', status: 409 }
  }
  if (s.room.expiresAt && s.room.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'この商談ルームの公開期間は終了しました。', status: 410 }
  }
  return { ok: true }
}
