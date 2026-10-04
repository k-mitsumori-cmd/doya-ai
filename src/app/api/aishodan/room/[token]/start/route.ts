export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/aishodan/room/[token]/start — 同意を記録してセッションを作る
// ⚠️ 未認証。ゲストは Cookie の guestId で識別する（adbanner のパターンを踏襲）。
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertRoomUsable, loadRoomByToken, toPublicSession } from '@/lib/aishodan/public'
import { resolveUserId } from '@/lib/aishodan/access'
import { assertFreeLimit, jstStartOfMonthUtc, FREE_LIMITS } from '@/lib/plan-limit'
import { getOrganizationQuotaUsage, recordOrganizationQuotaUsage } from '@/lib/organization-quota-ledger'

type Ctx = { params: Promise<{ token: string }> }

const GUEST_COOKIE = 'aishodan_gid'
// 練習は販売枠を消費しないが、音声接続の実費は発生する。
const PREVIEW_DAILY_LIMIT = 10

function jstStartOfDayUtc(): Date {
  const jst = new Date(Date.now() + 9 * 3600_000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9 * 3600_000)
}

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const room = await loadRoomByToken(p.token)
  if (!room) return NextResponse.json({ error: '商談ルームが見つかりません' }, { status: 404 })

  const usable = assertRoomUsable(room)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const body = await req.json().catch(() => ({}))
  if (body?.consent !== true) {
    return NextResponse.json({ error: '記録に関する同意が必要です' }, { status: 400 })
  }

  // 練習URLが転送・流出しても、組織外の人に音声の従量課金を発生させない。
  const previewUserId = room.isPreview ? await resolveUserId() : null
  if (room.isPreview && !previewUserId) return NextResponse.json({ error: '練習を開始するにはログインしてください。' }, { status: 401 })

  // 無料枠の上限（services.ts の「商談5件まで」を実際に効かせる）
  // ⚠️ 判定するのは見込み客ではなく、この部屋を出している契約者のプラン。
  //    ⚠️ 上限が無いと、公開URLを配った分だけ Realtime の従量課金が青天井になる。
  const owner = room.isPreview ? null : await prisma.aishodanMember.findFirst({
    where: { organizationId: room.organizationId, status: 'ACTIVE', role: 'owner', userId: { not: null } },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  })
  // ⚠️ 練習は無料枠を消費させない。シナリオを詰めるたびに枠が減ると
  //    「試すと損をする」構造になり、品質調整をしなくなる。
  let quota: Awaited<ReturnType<typeof assertFreeLimit>>
  try {
    quota = room.isPreview ? { ok: true } : await assertFreeLimit(
        'aishodanSessions',
        () => getOrganizationQuotaUsage(prisma, 'aishodanSessions', room.organizationId, 'lifetime', () =>
          prisma.aishodanSession.count({ where: { organizationId: room.organizationId, room: { isPreview: false } } })),
        owner?.userId ?? null,
        // ⚠️ 商談1件ごとに Realtime の通話料が発生する。有料プランにも月次の上限が要る
        (since) => getOrganizationQuotaUsage(prisma, 'aishodanSessions', room.organizationId, 'monthly', () =>
          prisma.aishodanSession.count({
            where: {
              organizationId: room.organizationId,
              room: { isPreview: false },
              createdAt: { gte: since },
            },
          }), since)
      )
  } catch {
    console.error('[aishodan/room/start] quota unavailable')
    return NextResponse.json({ error: '商談ルームの利用状況を確認できませんでした。時間をおいて再試行してください。' }, { status: 503 })
  }
  if (!quota.ok) {
    // ⚠️ 見込み客に課金の話を見せない。相手には落ち度がない。
    return NextResponse.json(
      { error: '現在この商談ルームはご利用いただけません。お手数ですが担当者までご連絡ください。' },
      { status: 429 }
    )
  }

  const existingGid = req.cookies.get(GUEST_COOKIE)?.value
  const guestId = existingGid && existingGid.length >= 16 ? existingGid : randomBytes(16).toString('hex')

  const url = new URL(req.url)
  const utm: Record<string, string> = {}
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = url.searchParams.get(k)
    if (v) utm[k] = v.slice(0, 200)
  }

  const unavailable = '現在この商談ルームはご利用いただけません。お手数ですが担当者までご連絡ください。'
  let result: { kind: 'created'; session: Awaited<ReturnType<typeof prisma.aishodanSession.create>> } | { kind: 'unavailable' } | { kind: 'expired' } | { kind: 'changed' } | { kind: 'previewLimit' } | { kind: 'previewUnauthorized' } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      result = await prisma.$transaction(async (tx) => {
        const currentRoom = await tx.aishodanRoom.findUnique({
          where: { id: room.id },
          select: { isActive: true, isPreview: true, expiresAt: true, maxSessions: true, sessionCount: true },
        })
        if (!currentRoom?.isActive) return { kind: 'unavailable' } as const
        if (currentRoom.expiresAt && currentRoom.expiresAt.getTime() < Date.now()) return { kind: 'expired' } as const
        if (currentRoom.isPreview !== room.isPreview) return { kind: 'changed' } as const
        if (currentRoom.sessionCount >= currentRoom.maxSessions) return { kind: 'unavailable' } as const

        // 組織全体の枠と、この部屋の枠を同じ直列化トランザクションで確保する。
        // セッション保存が失敗した場合は部屋の回数もロールバックされる。
        let billableUsage: { lifetime: number; monthly: number; now: Date } | null = null
        if (currentRoom.isPreview) {
          const member = await tx.aishodanMember.findFirst({
            where: { organizationId: room.organizationId, userId: previewUserId!, status: 'ACTIVE' },
            select: { id: true },
          })
          if (!member) return { kind: 'previewUnauthorized' } as const
          const usedToday = await tx.aishodanSession.count({
            where: { organizationId: room.organizationId, room: { isPreview: true }, createdAt: { gte: jstStartOfDayUtc() } },
          })
          if (usedToday >= PREVIEW_DAILY_LIMIT) return { kind: 'previewLimit' } as const
        } else if (quota.limit !== undefined) {
          const now = new Date()
          const lifetime = await getOrganizationQuotaUsage(tx, 'aishodanSessions', room.organizationId, 'lifetime', () =>
            tx.aishodanSession.count({ where: { organizationId: room.organizationId, room: { isPreview: false } } }), now)
          const monthly = await getOrganizationQuotaUsage(tx, 'aishodanSessions', room.organizationId, 'monthly', () =>
            tx.aishodanSession.count({ where: { organizationId: room.organizationId, room: { isPreview: false }, createdAt: { gte: jstStartOfMonthUtc(now) } } }), now)
          if ((quota.limit === FREE_LIMITS.aishodanSessions ? lifetime : monthly) >= quota.limit) return { kind: 'unavailable' } as const
          billableUsage = { lifetime, monthly, now }
        }

        const reserved = await tx.aishodanRoom.updateMany({
          where: {
            id: room.id,
            isActive: true,
            sessionCount: { lt: currentRoom.maxSessions },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          data: { sessionCount: { increment: 1 } },
        })
        if (reserved.count === 0) return { kind: 'unavailable' } as const

        const session = await tx.aishodanSession.create({
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
            ...(billableUsage ? { createdAt: billableUsage.now } : {}),
          },
        })
        if (billableUsage) await recordOrganizationQuotaUsage(tx, 'aishodanSessions', room.organizationId, billableUsage.lifetime, billableUsage.monthly, billableUsage.now)
        return { kind: 'created', session } as const
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      break
    } catch (error: any) {
      if ((error?.code === 'P2034' || error?.code === 'P2002') && attempt < 4) continue
      console.error('[aishodan/room/start] create failed', error?.code || 'unknown')
      return NextResponse.json({ error: '商談を開始できませんでした。時間をおいてもう一度お試しください。' }, { status: 503 })
    }
  }
  if (result?.kind === 'expired') return NextResponse.json({ error: 'この商談ルームの公開期間は終了しました。' }, { status: 410 })
  if (result?.kind === 'changed') return NextResponse.json({ error: '商談ルームの設定が更新されました。再読み込みしてください。' }, { status: 409 })
  if (result?.kind === 'previewUnauthorized') return NextResponse.json({ error: 'この組織の練習ルームはご利用いただけません。' }, { status: 403 })
  if (result?.kind === 'previewLimit') return NextResponse.json({ error: '本日の練習回数の上限に達しました。明日またお試しください。', code: 'PREVIEW_DAILY_LIMIT' }, { status: 429 })
  if (!result || result.kind !== 'created') return NextResponse.json({ error: unavailable }, { status: 429 })
  const session = result.session

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
