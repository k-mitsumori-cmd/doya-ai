export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/advance — advance_meeting の受け口
// 進行（このフェーズに留まる / 次へ / 締める）をサーバが決めて返す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertSessionUsable, loadGuestSession } from '@/lib/aishodan/session'
import { toScenarioConfig } from '@/lib/aishodan/public'
import { advance } from '@/lib/aishodan/engine'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  const usable = assertSessionUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const cfg = toScenarioConfig(s.room.scenario)
  const intent: 'stay' | 'next' | 'end' =
    body?.intent === 'next' ? 'next' : body?.intent === 'end' ? 'end' : 'stay'

  const [slotValues, phaseTurnCount] = await Promise.all([
    prisma.aishodanSlotValue.findMany({ where: { sessionId: s.id }, select: { key: true, value: true } }),
    prisma.aishodanTurn.count({ where: { sessionId: s.id, phase: s.currentPhase, speaker: 'guest' } }),
  ])

  // 「聞けた」と言えるのは値が実質空でないときだけ。
  // 空文字を埋まった扱いにすると、ヒアリングが素通りする。
  const filled = new Set(slotValues.filter((v) => v.value.trim().length > 0).map((v) => v.key))
  const unfilledRequiredSlots = cfg.slots.filter((sl) => sl.required && !filled.has(sl.key))

  const elapsedSec = s.startedAt ? Math.floor((Date.now() - s.startedAt.getTime()) / 1000) : 0

  const result = advance({
    phases: cfg.phases,
    currentPhaseKey: s.currentPhase,
    phaseTurnCount,
    elapsedSec,
    durationMin: cfg.durationMin,
    unfilledRequiredSlots,
    intent,
  })

  if (result.phaseKey !== s.currentPhase) {
    await prisma.aishodanSession.update({
      where: { id: s.id },
      data: { currentPhase: result.phaseKey },
    })
  }

  return NextResponse.json({
    action: result.action,
    phase: result.phaseName,
    goal: result.goal,
    ask_next: result.askNext,
    remaining_required: result.remainingRequired,
    should_close: result.shouldClose,
    remaining_min: Math.max(0, Math.round((cfg.durationMin * 60 - elapsedSec) / 60)),
  })
}
