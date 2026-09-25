export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { scoreLead } from '@/lib/sfa/ai'
import { reserveSfaAiUsage, completeSfaAiUsage, releaseSfaAiUsage, sfaAiLimitResponse } from '@/lib/sfa/ai-limit'

// POST /api/sfa/ai/score — リードのAIスコアリング（受注確度0-100＋根拠＋次アクション）
// body: { leadId }
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const leadId = body && typeof body === 'object' && !Array.isArray(body) && typeof body.leadId === 'string'
    ? body.leadId.trim()
    : ''
  if (!leadId) return NextResponse.json({ error: 'leadId は必須です' }, { status: 400 })

  // IDOR対策：ID直指定の後に organizationId 一致を確認
  const lead = await prisma.sfaLead.findUnique({ where: { id: leadId } })
  if (!lead || lead.organizationId !== ctx.organizationId || !lead.isActive) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  }

  // gBizINFO等の属性は raw に入りうるので拾う
  const raw = (lead.raw as Record<string, unknown> | null) || {}
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !isNaN(Number(v)) ? Number(v) : null)

  let reservation: Awaited<ReturnType<typeof reserveSfaAiUsage>>
  try {
    reservation = await reserveSfaAiUsage(ctx.organizationId, ctx.userId, 'score')
  } catch (e) {
    console.error('[sfa/ai/score] quota reservation failed', e)
    return NextResponse.json({ error: '利用状況を確認できません。しばらくしてから再試行してください' }, { status: 503 })
  }
  if ('limit' in reservation) return sfaAiLimitResponse(reservation, ctx.role === 'owner')

  try {
    const result = await scoreLead({
      name: lead.name,
      industry: (raw.industry as string) || null,
      prefecture: (raw.prefecture as string) || null,
      employeeCount: num(raw.employeeCount ?? raw.employee_number),
      capital: num(raw.capital ?? raw.capital_stock),
      status: lead.status,
      note: lead.note,
      source: lead.source,
    })
    // スコアを保存（根拠/次アクションはメモへ追記しない＝表示は都度返却）
    const updated = await prisma.sfaLead.updateMany({ where: { id: lead.id, organizationId: ctx.organizationId, isActive: true }, data: { score: result.score } })
    if (updated.count !== 1) {
      await releaseSfaAiUsage(reservation.id)
      return NextResponse.json({ error: '対象のリードが変更されました。再読み込みしてください' }, { status: 409 })
    }
    await completeSfaAiUsage(reservation.id)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    await releaseSfaAiUsage(reservation.id).catch((releaseError) => console.error('[sfa/ai/score] quota release failed', releaseError))
    console.error('[sfa/ai/score]', e?.message)
    return NextResponse.json({ error: 'スコアリングに失敗しました' }, { status: 500 })
  }
}
