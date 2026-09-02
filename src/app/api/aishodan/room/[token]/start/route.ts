export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/aishodan/room/[token]/start — 同意を記録してセッションを作る
// ⚠️ 未認証。ゲストは Cookie の guestId で識別する（adbanner のパターンを踏襲）。
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertRoomUsable, loadRoomByToken, toPublicSession } from '@/lib/aishodan/public'
import { assertFreeLimit } from '@/lib/plan-limit'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

const GUEST_COOKIE = 'aishodan_gid'

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const room = await loadRoomByToken(p.token)
  if (!room) return NextResponse.json({ error: '商談ルームが見つかりません' }, { status: 404 })

  const usable = assertRoomUsable(room)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const body = await req.json().catch(() => ({}))
  if (body?.consent !== true) {
    return NextResponse.json({ error: '記録に関する同意が必要です' }, { status: 400 })
  }

  // 無料枠の上限（services.ts の「商談5件まで」を実際に効かせる）
  // ⚠️ 判定するのは見込み客ではなく、この部屋を出している契約者のプラン。
  //    ⚠️ 上限が無いと、公開URLを配った分だけ Realtime の従量課金が青天井になる。
  const owner = await prisma.aishodanMember.findFirst({
    where: { organizationId: room.organizationId, status: 'ACTIVE', role: 'owner', userId: { not: null } },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  })
  // ⚠️ 練習は無料枠を消費させない。シナリオを詰めるたびに枠が減ると
  //    「試すと損をする」構造になり、品質調整をしなくなる。
  const quota = room.isPreview
    ? { ok: true as const }
    : await assertFreeLimit(
        'aishodanSessions',
        () => prisma.aishodanSession.count({ where: { organizationId: room.organizationId, room: { isPreview: false } } }),
        owner?.userId ?? null,
        // ⚠️ 商談1件ごとに Realtime の通話料が発生する。有料プランにも月次の上限が要る
        (since) =>
          prisma.aishodanSession.count({
            where: {
              organizationId: room.organizationId,
              room: { isPreview: false },
              createdAt: { gte: since },
            },
          })
      )
  if (!quota.ok) {
    // ⚠️ 見込み客に課金の話を見せない。相手には落ち度がない。
    return NextResponse.json(
      { error: '現在この商談ルームはご利用いただけません。お手数ですが担当者までご連絡ください。' },
      { status: 429 }
    )
  }

  const existingGid = req.cookies.get(GUEST_COOKIE)?.value
  const guestId = existingGid && existingGid.length >= 16 ? existingGid : randomBytes(16).toString('hex')

  // ⚠️ 部屋の利用上限は「予約」してから作る。
  //    件数を数えてから作る形だと、同時アクセスで上限を超えられる。
  const reserved = await prisma.aishodanRoom.updateMany({
    where: { id: room.id, sessionCount: { lt: room.maxSessions } },
    data: { sessionCount: { increment: 1 } },
  })
  if (reserved.count === 0) {
    return NextResponse.json(
      { error: '現在この商談ルームはご利用いただけません。お手数ですが担当者までご連絡ください。' },
      { status: 429 }
    )
  }

  const url = new URL(req.url)
  const utm: Record<string, string> = {}
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = url.searchParams.get(k)
    if (v) utm[k] = v.slice(0, 200)
  }

  const session = await prisma.aishodanSession.create({
    data: {
      organizationId: room.organizationId,
      roomId: room.id,
      guestId,
      guestName: body?.name ? String(body.name).slice(0, 100) : null,
      guestCompany: body?.company ? String(body.company).slice(0, 200) : null,
      guestEmail: body?.email ? String(body.email).slice(0, 200) : null,
      status: 'pending',
      currentPhase: room.scenario.phases && Array.isArray(room.scenario.phases) && (room.scenario.phases as any[])[0]?.key
        ? (room.scenario.phases as any[])[0].key
        : 'opening',
      consentedAt: new Date(),
      referrer: req.headers.get('referer')?.slice(0, 500) || null,
      utm: Object.keys(utm).length > 0 ? utm : undefined,
      purgeAfter: new Date(Date.now() + Math.max(1, room.organization.retentionDays) * 24 * 60 * 60 * 1000),
    },
  })

  const res = NextResponse.json({ session: toPublicSession(session) })
  res.cookies.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  })
  return res
}
