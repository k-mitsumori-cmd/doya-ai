export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import type { LeadStatus } from '@/lib/sfa/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

const LEAD_STATUSES: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified']

async function owned(orgId: string, id: string) {
  const l = await prisma.sfaLead.findUnique({ where: { id } })
  return l && l.organizationId === orgId ? l : null
}

// PATCH /api/sfa/leads/[id] — ステータス/担当/メモ/スコアの更新（ホワイトリスト検証）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const lead = await owned(c.organizationId, p.id)
  if (!lead) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof body.status === 'string' && (LEAD_STATUSES as string[]).includes(body.status)) data.status = body.status
  if (typeof body.note === 'string') data.note = body.note.slice(0, 2000)
  if (typeof body.contactName === 'string') data.contactName = body.contactName.slice(0, 80)
  if (typeof body.email === 'string') data.email = body.email.slice(0, 200)
  if (typeof body.phone === 'string') data.phone = body.phone.slice(0, 40)
  if (body.score != null && Number.isFinite(Number(body.score))) {
    data.score = Math.max(0, Math.min(100, Math.round(Number(body.score))))
  }

  const updated = await prisma.sfaLead.update({ where: { id: lead.id }, data })
  return NextResponse.json({ lead: bigIntToNumber(updated) })
}

// DELETE /api/sfa/leads/[id] — 論理削除（除外とは別。一覧から消す）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const lead = await owned(c.organizationId, p.id)
  if (!lead) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  await prisma.sfaLead.update({ where: { id: lead.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
