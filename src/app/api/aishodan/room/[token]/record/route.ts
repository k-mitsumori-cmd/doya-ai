export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/aishodan/room/[token]/record — record_answer の受け口
// ヒアリングで聞き取った内容を構造化して保存する。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertSessionUsable, loadGuestSession } from '@/lib/aishodan/session'
import { toScenarioConfig } from '@/lib/aishodan/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  const usable = assertSessionUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const key = String(body?.key || '').trim()
  const value = String(body?.value || '').trim()
  if (!key || !value) return NextResponse.json({ ok: false, error: 'key と value が必要です' }, { status: 400 })

  // シナリオに無いキーは受け付けない。
  // 受け入れると、集計もICP判定も参照できないゴミが溜まる。
  const cfg = toScenarioConfig(s.room.scenario)
  const slot = cfg.slots.find((sl) => sl.key === key)
  if (!slot) {
    return NextResponse.json({
      ok: false,
      message: `"${key}" はヒアリング項目にありません。次のいずれかを使ってください: ${cfg.slots.map((sl) => sl.key).join(', ')}`,
    })
  }

  await prisma.aishodanSlotValue.upsert({
    where: { sessionId_key: { sessionId: s.id, key } },
    create: { sessionId: s.id, key, value: value.slice(0, 4000), confidence: 0.8 },
    update: { value: value.slice(0, 4000), confidence: 0.8 },
  })

  const values = await prisma.aishodanSlotValue.findMany({
    where: { sessionId: s.id },
    select: { key: true, value: true },
  })
  const filled = new Set(values.filter((v) => v.value.trim()).map((v) => v.key))
  const remaining = cfg.slots.filter((sl) => sl.required && !filled.has(sl.key)).map((sl) => sl.label)

  return NextResponse.json({ ok: true, recorded: slot.label, remaining_required: remaining })
}
