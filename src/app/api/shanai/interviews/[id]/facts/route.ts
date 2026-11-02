// POST /api/shanai/interviews/[id]/facts — 素材と会社プロフィールから事実を抽出（作り直し）
// PUT  { facts: [{ id, statement?, approved?, delete? }] } — 担当者の確認・修正
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { planTierOf } from '@/lib/plan-limit'
import { claimFactRun, getShanaiUserId, json, notFound, quotaExceeded, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { extractFacts } from '@/lib/shanai/generate'
import { checkSurvey } from '@/lib/shanai/survey'
import { clip, isCuid } from '@/lib/shanai/types'
import { lockFactInterview, readFactExtractionSnapshot, FACT_EXTRACTION_CHANGED, FACT_EDIT_CHANGED } from '@/lib/shanai/fact-extraction-snapshot'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    // Read the plan before taking a transaction connection (including single-connection pools).
    const tier = await planTierOf(userId)
    const prepared = await prisma.$transaction(async tx => {
      if (!await lockFactInterview(tx, userId, id)) return { ok: false as const, response: notFound() }
      const snapshot = await readFactExtractionSnapshot(tx, userId, id)
      if (!snapshot) return { ok: false as const, response: notFound() }
      if (snapshot.input.mode === 'voice' && snapshot.input.segments.length === 0) {
        return { ok: false as const, response: json({ error: '先に録音を文字起こししてください。' }, 400) }
      }
      if (snapshot.input.mode === 'survey' && !checkSurvey(snapshot.input.answers).canSubmit) {
        return { ok: false as const, response: json({ error: 'アンケートの回答がまだ足りません。すべての必須設問が最低文字数に達してから抽出できます。' }, 400) }
      }
      // Preserve the original quota and five-run policy; reserve in the same transaction as the snapshot.
      const claim = await claimFactRun(userId, id, tier, tx)
      if (!claim.ok) return { ok: false as const, response: claim.quota ? quotaExceeded(claim.quota) : json({ error: claim.reason }, 429) }
      return { ok: true as const, snapshot, generation: snapshot.generation + 1 }
    }, { maxWait: 10000, timeout: 20000 })
    if (!prepared.ok) return prepared.response

    const facts = await extractFacts(prepared.snapshot.input)
    if (facts.filter((f) => f.sourceType !== 'company').length === 0) {
      return json({ error: '記事にできる具体的な内容を見つけられませんでした。録音や回答の内容をご確認ください。' }, 422)
    }

    const saved = await prisma.$transaction(async tx => {
      if (!await lockFactInterview(tx, userId, id)) return 'missing' as const
      const current = await readFactExtractionSnapshot(tx, userId, id)
      if (!current) return 'missing' as const
      if (current.generation !== prepared.generation || current.sourceHash !== prepared.snapshot.sourceHash ||
        current.factHash !== prepared.snapshot.factHash) return 'changed' as const
      await tx.shanaiFact.deleteMany({ where: { interviewId: id } })
      await tx.shanaiFact.createMany({ data: facts.map((f, i) => ({ interviewId: id, ...f, sortOrder: i })) })
      await tx.shanaiInterview.update({ where: { id }, data: { status: 'WRITING' } })
      return 'saved' as const
    }, { maxWait: 10000, timeout: 20000 })
    if (saved === 'missing') return notFound()
    if (saved === 'changed') return json({ error: FACT_EXTRACTION_CHANGED, code: 'FACT_EXTRACTION_CHANGED' }, 409)
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/facts][POST] failed', (e as Error)?.name)
    return json({ error: '事実の抽出に失敗しました。時間をおいてもう一度お試しください。' }, 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const body = await req.json().catch(() => ({}))
    const list: any[] = Array.isArray(body.facts) ? body.facts.slice(0, 200) : []
    const saved = await prisma.$transaction(async (tx) => {
      if (!await lockFactInterview(tx, userId, id)) return 'missing' as const
      const ids = [...new Set(list.filter(f => typeof f?.id === 'string').map(f => f.id as string))]
      const existing = await tx.shanaiFact.findMany({ where: { interviewId: id, id: { in: ids } }, select: { id: true } })
      if (existing.length !== ids.length) return 'changed' as const
      for (const f of list) {
        if (typeof f?.id !== 'string') continue
        // ⚠️ 原文（quote）は書き換えさせない。根拠の改ざんを防ぐ
        if (f.delete) {
          await tx.shanaiFact.deleteMany({ where: { id: f.id, interviewId: id } })
          continue
        }
        const statement = clip(f.statement, 300)
        await tx.shanaiFact.updateMany({
          where: { id: f.id, interviewId: id },
          data: { ...(typeof f.approved === 'boolean' ? { approved: f.approved } : {}), ...(statement ? { statement } : {}) },
        })
      }
      return 'saved' as const
    }, { maxWait: 10000, timeout: 20000 })
    if (saved === 'missing') return notFound()
    if (saved === 'changed') return json({ error: FACT_EDIT_CHANGED, code: 'FACT_EDIT_CHANGED' }, 409)
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/facts][PUT] failed', (e as Error)?.name)
    return json({ error: '事実の保存に失敗しました。' }, 500)
  }
}
