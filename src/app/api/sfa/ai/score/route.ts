export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { scoreLead } from '@/lib/sfa/ai'

// POST /api/sfa/ai/score — リードのAIスコアリング（受注確度0-100＋根拠＋次アクション）
// body: { leadId }
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const leadId = (body.leadId as string)?.trim()
  if (!leadId) return NextResponse.json({ error: 'leadId は必須です' }, { status: 400 })

  // IDOR対策：ID直指定の後に organizationId 一致を確認
  const lead = await prisma.sfaLead.findUnique({ where: { id: leadId } })
  if (!lead || lead.organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  }

  // gBizINFO等の属性は raw に入りうるので拾う
  const raw = (lead.raw as Record<string, unknown> | null) || {}
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !isNaN(Number(v)) ? Number(v) : null)

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
    await prisma.sfaLead.update({ where: { id: lead.id }, data: { score: result.score } })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[sfa/ai/score]', e?.message)
    return NextResponse.json({ error: 'スコアリングに失敗しました' }, { status: 500 })
  }
}
