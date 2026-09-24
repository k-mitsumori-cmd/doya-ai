export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import type { LeadStatus } from '@/lib/sfa/types'

type Ctx = { params: Promise<{ id: string }> }

const LEAD_STATUSES: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified']

async function owned(orgId: string, id: string) {
  const l = await prisma.sfaLead.findUnique({ where: { id } })
  return l && l.organizationId === orgId && l.isActive ? l : null
}

// PATCH /api/sfa/leads/[id] — ステータス/担当/メモ/スコアの更新（ホワイトリスト検証）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const lead = await owned(c.organizationId, p.id)
  if (!lead) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '更新内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  const allowed = ['status', 'note', 'contactName', 'email', 'phone', 'score']
  if (Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowed.includes(key))) {
    return NextResponse.json({ error: '更新できない項目が含まれています' }, { status: 400 })
  }
  const data: any = {}
  if ('status' in body) {
    if (typeof body.status !== 'string' || !(LEAD_STATUSES as string[]).includes(body.status)) {
      return NextResponse.json({ error: '状態が正しくありません' }, { status: 400 })
    }
    if (body.status === 'converted' && lead.status !== 'converted') {
      return NextResponse.json({ error: '転換済への変更は「取引先に転換」から行ってください' }, { status: 400 })
    }
    if ((lead.status === 'converted' || lead.convertedAccountId) && body.status !== 'converted') {
      return NextResponse.json({ error: '転換済のリードは状態を戻せません' }, { status: 409 })
    }
    data.status = body.status
  }
  for (const [key, limit] of [['note', 2000], ['contactName', 80], ['email', 200], ['phone', 40]] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== 'string') {
        return NextResponse.json({ error: '入力項目の形式が正しくありません' }, { status: 400 })
      }
      data[key] = typeof body[key] === 'string' ? body[key].slice(0, limit) : null
    }
  }
  if ('score' in body) {
    if (body.score === null) {
      data.score = null
    } else {
      const score = Number(body.score)
      if ((typeof body.score !== 'number' && typeof body.score !== 'string') || (typeof body.score === 'string' && !body.score.trim()) || !Number.isFinite(score) || score < 0 || score > 100) {
        return NextResponse.json({ error: 'スコアは0〜100で入力してください' }, { status: 400 })
      }
      data.score = Math.round(score)
    }
  }

  // 転換処理と競合しても、通常更新から転換済の状態を巻き戻さない。
  const changed = await prisma.sfaLead.updateMany({
    where: {
      id: lead.id,
      organizationId: c.organizationId,
      isActive: true,
      ...(data.status !== undefined && data.status !== 'converted'
        ? { status: { not: 'converted' }, convertedAccountId: null }
        : {}),
    },
    data,
  })
  if (changed.count !== 1) return NextResponse.json({ error: '状態が変更されました。再読み込みしてください' }, { status: 409 })
  const updated = await prisma.sfaLead.findUniqueOrThrow({ where: { id: lead.id } })
  return NextResponse.json({ lead: bigIntToNumber(updated) })
}

// DELETE /api/sfa/leads/[id] — 論理削除（除外とは別。一覧から消す）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params
  const lead = await owned(c.organizationId, p.id)
  if (!lead) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  await prisma.sfaLead.update({ where: { id: lead.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
