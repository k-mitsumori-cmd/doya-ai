export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/aishodan/room/[token] — 商談ルームの公開情報
// ⚠️ 未認証で叩ける。返すのは toPublicRoom() を通した最小限のみ。
import { NextRequest, NextResponse } from 'next/server'
import { assertRoomUsable, loadRoomByToken, toPublicRoom } from '@/lib/aishodan/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function GET(_req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const room = await loadRoomByToken(p.token)
  if (!room) return NextResponse.json({ error: '商談ルームが見つかりません' }, { status: 404 })

  const usable = assertRoomUsable(room)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  return NextResponse.json({ room: toPublicRoom(room) })
}
