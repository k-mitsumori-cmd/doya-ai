// ============================================
// ドヤAI商談 セッションの解決（ゲスト向けAPI共通）
// ============================================
// ⚠️ 未認証で叩かれる口の入口。sessionId だけで引かず、必ず roomToken と
//    Cookie の guestId の三重条件でスコープする。
//    （sessionId が漏れても他人の商談を操作できないようにするため）
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

export const GUEST_COOKIE = 'aishodan_gid'

export async function loadGuestSession(req: NextRequest, roomToken: string, sessionId: string) {
  const guestId = req.cookies.get(GUEST_COOKIE)?.value
  if (!guestId || !sessionId) return null
  return prisma.aishodanSession.findFirst({
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
export function assertSessionUsable(s: GuestSession): { ok: true } | { ok: false; reason: string; status: number } {
  if (s.status === 'aborted') return { ok: false, reason: 'この商談は終了しています。', status: 410 }
  if (s.status === 'evaluated' || s.status === 'completed') {
    return { ok: false, reason: 'この商談は終了しています。', status: 410 }
  }
  if (!s.consentedAt) return { ok: false, reason: '先に同意が必要です。', status: 403 }
  if (s.room.expiresAt && s.room.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'この商談ルームの公開期間は終了しました。', status: 410 }
  }
  return { ok: true }
}
