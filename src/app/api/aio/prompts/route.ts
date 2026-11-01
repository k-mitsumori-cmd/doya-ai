export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'
import { getAioBilling } from '@/lib/aio/billing'
import { isPaidPlan } from '@/lib/unified-plan'
import { lockPromptActor, promptBody, promptIdForOperation, promptOperationId } from '@/lib/aio/prompt-mutation'

import { AIO_FREE_PROMPT_LIMIT } from '@/lib/aio/types'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAioContext(orgSlugFrom(req))
    if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)
    const query = req.nextUrl.searchParams
    const operation = query.get('operationId'), promptId = query.get('promptId')
    if (operation !== null || promptId !== null) {
      let id: string
      try {
        if (operation !== null && promptId !== null) throw new Error()
        id = operation !== null ? promptIdForOperation(ctx, promptOperationId(operation)) : promptId!
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new Error()
      } catch { return json({ error: '確認対象の操作を指定してください' }, 400) }
      // Includes archived rows, so a lost creation/archive response is recoverable.
      const prompt = await prisma.aioPrompt.findFirst({ where: { id, organizationId: ctx.organizationId } })
      return json({ prompt, ...(operation !== null ? { operationId: promptOperationId(operation) } : {}) })
    }
    const paged = query.get('paged') === '1', cursor = query.get('cursor')
    if (cursor && (!paged || !/^[a-zA-Z0-9_-]{1,200}$/.test(cursor))) return json({ error: '一覧の続きを確認できません。再読み込みしてください' }, 400)
    if (cursor && !await prisma.aioPrompt.findFirst({ where: { id: cursor, organizationId: ctx.organizationId, archivedAt: null }, select: { id: true } })) return json({ error: '一覧が変更されました。先頭から再読み込みしてください', code: 'LIST_CHANGED' }, 409)
    const rows = await prisma.aioPrompt.findMany({
      where: { organizationId: ctx.organizationId, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...(paged ? { take: 101, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) } : {}),
    })
    const prompts = paged ? rows.slice(0, 100) : rows
    return json({ prompts, canEdit: hasMinRole(ctx.role, 'manager'), ...(paged ? { nextCursor: rows.length > 100 ? prompts[prompts.length - 1].id : null } : {}) })
  } catch { return json({ error: '監視プロンプトを確認できませんでした。再読み込みしてください', code: 'PROMPTS_UNAVAILABLE' }, 503) }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAioContext(orgSlugFrom(req))
    if (!ctx) return json({ error: 'ログイン/組織が必要です' }, 401)
    if (!hasMinRole(ctx.role, 'manager')) return json({ error: '編集権限がありません' }, 403)
    let text: string, category: string, id: string | undefined, operationId: string | undefined
    try {
      const body = promptBody(await req.json())
      text = typeof body.text === 'string' ? body.text.trim() : ''
      if (body.category !== undefined && body.category !== null && typeof body.category !== 'string') throw new Error()
      category = typeof body.category === 'string' ? body.category.trim() : ''
      if (!text || text.length > 500 || category.length > 80) throw new Error()
      if (Object.prototype.hasOwnProperty.call(body, 'operationId')) { operationId = promptOperationId(body.operationId); id = promptIdForOperation(ctx, operationId) }
    } catch { return json({ error: 'プロンプトは1〜500文字、分類は80文字以内で入力し、操作情報を確認してください' }, 400) }
    const result = await prisma.$transaction(async tx => {
      const actor = await lockPromptActor(tx, ctx)
      if (!actor) return { kind: 'forbidden' } as const
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM aio_organizations WHERE id = ${ctx.organizationId} FOR NO KEY UPDATE`
      if (locked.length !== 1) return { kind: 'forbidden' } as const
      if (id) {
        const existing = await tx.aioPrompt.findFirst({ where: { id, organizationId: ctx.organizationId } })
        if (existing) {
          if (existing.archivedAt) return { kind: 'archived' } as const
          if (existing.text !== text || existing.category !== (category || null)) return { kind: 'changed' } as const
          return { kind: 'created', prompt: existing } as const
        }
      }
      const billing = await getAioBilling(tx, ctx.organizationId)
      if (!billing) return { kind: 'billing' } as const
      if (!isPaidPlan(billing.plan)) {
        const count = await tx.aioPrompt.count({ where: { organizationId: ctx.organizationId, archivedAt: null } })
        if (count >= AIO_FREE_PROMPT_LIMIT) return { kind: 'limit', role: actor.role } as const
      }
      const prompt = await tx.aioPrompt.create({ data: { ...(id ? { id } : {}), organizationId: ctx.organizationId, text, category: category || null } })
      return { kind: 'created', prompt } as const
    })
    if (result.kind === 'forbidden') return json({ error: '編集権限を確認できません。再読み込みしてください' }, 403)
    if (result.kind === 'archived' || result.kind === 'changed') return json({ error: 'この操作で追加した質問は既に変更または保管されています。一覧を確認してください', code: 'OPERATION_CHANGED' }, 409)
    if (result.kind === 'billing') return json({ error: '組織の契約情報を確認できません。組織オーナーにお問い合わせください。', code: 'BILLING_OWNER' }, 409)
    if (result.kind === 'limit') return json({ error: `無料プランは監視プロンプト${AIO_FREE_PROMPT_LIMIT}件までです。組織オーナーのプランをアップグレードしてください。`, code: 'LIMIT', canManageBilling: result.role === 'owner', ...(result.role === 'owner' ? { upgradeUrl: '/aio/pricing' } : {}) }, 402)
    return json({ ok: true, prompt: result.prompt, ...(operationId ? { operationId } : {}) })
  } catch { return json({ error: '追加結果を確認できませんでした。一覧または操作結果を確認してください', code: 'WRITE_UNCONFIRMED' }, 503) }
}
