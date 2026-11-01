export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'
import { lockPromptActor, promptBody } from '@/lib/aio/prompt-mutation'
import { parseOrgProfileVersion } from '@/lib/org-profile-version'

type Ctx = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

async function mutate(req: NextRequest, ctx: Ctx, archive: boolean) {
  try {
    const { id } = await ctx.params
    const actor = await getAioContext(orgSlugFrom(req))
    if (!actor) return json({ error: 'ログイン/組織が必要です' }, 401)
    if (!hasMinRole(actor.role, 'manager')) return json({ error: '編集権限がありません' }, 403)
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return json({ error: '質問を指定してください' }, 400)
    let expected: Date | undefined
    const data: { text?: string; category?: string | null; isActive?: boolean } = {}
    try {
      // Empty DELETE bodies remain compatible; malformed nonempty JSON never becomes a write.
      const raw = await req.text()
      const body = promptBody(raw ? JSON.parse(raw) : archive ? {} : null)
      const version = parseOrgProfileVersion(body)
      if (version === null) throw new Error()
      expected = version
      if (!archive) {
        if ('text' in body) {
          if (typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 500) throw new Error()
          data.text = body.text.trim()
        }
        if ('category' in body) {
          if (body.category !== null && (typeof body.category !== 'string' || body.category.trim().length > 80)) throw new Error()
          data.category = typeof body.category === 'string' ? body.category.trim() || null : null
        }
        if ('isActive' in body) {
          if (typeof body.isActive !== 'boolean') throw new Error()
          data.isActive = body.isActive
        }
        if (!Object.keys(data).length) throw new Error()
      }
    } catch { return json({ error: '質問の入力内容・更新日時を確認して再読み込みしてください' }, 400) }
    const result = await prisma.$transaction(async tx => {
      if (!await lockPromptActor(tx, actor)) return { kind: 'forbidden' } as const
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM aio_organizations WHERE id = ${actor.organizationId} FOR NO KEY UPDATE`
      if (locked.length !== 1) return { kind: 'forbidden' } as const
      const target = await tx.aioPrompt.findFirst({ where: { id, organizationId: actor.organizationId, archivedAt: null } })
      if (!target) return { kind: 'missing' } as const
      if (expected && target.updatedAt.getTime() !== expected.getTime()) return { kind: 'conflict' } as const
      // Millisecond monotonicity makes even immediate opposing toggles distinguishable.
      const updatedAt = new Date(Math.max(Date.now(), target.updatedAt.getTime() + 1))
      const updated = await tx.aioPrompt.updateMany({
        where: { id, organizationId: actor.organizationId, archivedAt: null, ...(expected ? { updatedAt: expected } : {}) },
        data: { ...data, ...(archive ? { archivedAt: updatedAt, isActive: false } : {}), updatedAt },
      })
      if (updated.count !== 1) return { kind: 'conflict' } as const
      if (archive) return { kind: 'archived' } as const
      const prompt = await tx.aioPrompt.findFirst({ where: { id, organizationId: actor.organizationId, archivedAt: null } })
      if (!prompt) return { kind: 'conflict' } as const
      return { kind: 'updated', prompt } as const
    })
    if (result.kind === 'forbidden') return json({ error: '編集権限を確認できません。再読み込みしてください' }, 403)
    if (result.kind === 'missing') return json({ error: 'プロンプトが見つかりません' }, 404)
    if (result.kind === 'conflict') return json({ error: '質問が別の操作で変更されました。一覧を確認してください', code: 'VERSION_CONFLICT' }, 409)
    return result.kind === 'archived' ? json({ ok: true, archived: true }) : json({ ok: true, prompt: result.prompt })
  } catch { return json({ error: '変更結果を確認できませんでした。一覧または操作結果を確認してください', code: 'WRITE_UNCONFIRMED' }, 503) }
}

export async function PATCH(req: NextRequest, ctx: Ctx) { return mutate(req, ctx, false) }
export async function DELETE(req: NextRequest, ctx: Ctx) { return mutate(req, ctx, true) }
