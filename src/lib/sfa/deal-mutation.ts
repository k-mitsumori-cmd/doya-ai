import type { Prisma, SfaDeal } from '@prisma/client'
import type { SfaContext } from './types'
import { parseSfaAmount } from './amount'
import { SfaMutationError } from './mutation-authority'

export function dealBody(value: unknown, create = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  const fields = create ? ['name', 'amount', 'accountId', 'stageId', 'startDate', 'operationId']
    : ['name', 'amount', 'accountId', 'stageId', 'startDate', 'expectedCloseDate', 'probability', 'contactName', 'contactId', 'note', 'lostReason', 'expectedUpdatedAt']
  if (Object.keys(body).some(key => !fields.includes(key))) throw new SfaMutationError(400, '保存できない項目が含まれています。')
  const data: { name?: string; amount?: bigint; contactName?: string | null; contactId?: null; note?: string | null; lostReason?: string | null; probability?: number; startDate?: Date | null; expectedCloseDate?: Date | null; accountId?: string | null; stageId?: string | null } = {}
  if (create || 'name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 200) throw new SfaMutationError(400, '商談名は1〜200文字で入力してください。')
    data.name = body.name.trim()
  }
  if ('amount' in body || create) {
    const amount = create && (body.amount === undefined || body.amount === '') ? 0n : parseSfaAmount(body.amount)
    if (amount === null) throw new SfaMutationError(400, '金額は0以上の有効な数値で入力してください。')
    data.amount = amount
  }
  for (const [key, max, label] of [['contactName', 100, '担当者名'], ['note', 5000, '商談メモ'], ['lostReason', 300, '失注理由']] as const) {
    if (!(key in body)) continue
    const value = body[key]
    if (value !== null && typeof value !== 'string') throw new SfaMutationError(400, `${label}の形式が正しくありません。`)
    const text = typeof value === 'string' ? key === 'contactName' ? value.trim() : value : null
    if (text && text.length > max) throw new SfaMutationError(400, `${label}は${max}文字以内で入力してください。`)
    data[key] = text || null
  }
  if ('contactId' in body) {
    if (body.contactId !== null) throw new SfaMutationError(400, '担当者の紐づけ解除には明示的な解除操作が必要です。')
    data.contactId = null
  }
  if ('probability' in body) {
    const value = body.probability
    const n = Number(value)
    if ((typeof value !== 'number' && typeof value !== 'string') || typeof value === 'string' && !/^\d{1,3}$/.test(value) || !Number.isInteger(n) || n < 0 || n > 100) throw new SfaMutationError(400, '確度は0〜100の整数で入力してください。')
    data.probability = n
  }
  for (const key of ['startDate', 'expectedCloseDate'] as const) {
    if (!(key in body)) continue
    const value = body[key]
    if (value === null || value === '') { data[key] = null; continue }
    const format = /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/
    const day = typeof value === 'string' ? value.slice(0, 10) : ''
    const calendar = new Date(day + 'T00:00:00.000Z'), date = typeof value === 'string' ? new Date(value) : null
    if (typeof value !== 'string' || !format.test(value) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day || !date || !Number.isFinite(date.getTime())) throw new SfaMutationError(400, '日付には有効な日付を入力してください。')
    data[key] = date
  }
  for (const key of ['accountId', 'stageId'] as const) {
    if (!(key in body)) continue
    const value = body[key]
    if (value !== null && (typeof value !== 'string' || value !== '' && !/^[a-zA-Z0-9_-]{1,128}$/.test(value))) throw new SfaMutationError(400, '関連先の指定が正しくありません。')
    if (!create && key === 'stageId' && !value) throw new SfaMutationError(400, 'ステージを選び直してください。')
    data[key] = typeof value === 'string' ? value || null : null
  }
  if (!create && !Object.keys(data).length) throw new SfaMutationError(400, '更新する内容を指定してください。')
  return { body, data }
}
export function dealVersion(value: unknown): Date | undefined {
  if (value === undefined) return undefined
  const d = typeof value === 'string' && value.length === 24 ? new Date(value) : null
  if (!d || !Number.isFinite(d.getTime()) || d.toISOString() !== value) throw new SfaMutationError(400, '更新日時を確認できません。一覧を再読み込みしてください。')
  return d
}
export async function lockDeal(tx: Prisma.TransactionClient, ctx: SfaContext, id: string, write = true) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new SfaMutationError(400, '商談の指定が正しくありません。')
  const rows = write ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_deals WHERE id = ${id} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_deals WHERE id = ${id} AND "organizationId" = ${ctx.organizationId} FOR SHARE`
  if (!rows.some(row => row.id === id)) return null
  return tx.sfaDeal.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } })
}
export async function lockDealStage(tx: Prisma.TransactionClient, ctx: SfaContext, requestedId: string | null) {
  const rows = requestedId
    ? await tx.$queryRaw<{ id: string }[]>`SELECT s.id FROM sfa_stages s JOIN sfa_pipelines p ON p.id = s."pipelineId" WHERE s.id = ${requestedId} AND p."organizationId" = ${ctx.organizationId} FOR SHARE OF s, p`
    : await tx.$queryRaw<{ id: string }[]>`SELECT s.id FROM sfa_stages s JOIN sfa_pipelines p ON p.id = s."pipelineId" WHERE p."organizationId" = ${ctx.organizationId} ORDER BY s."order", s.id LIMIT 1 FOR SHARE OF s, p`
  if (!rows.length) { if (requestedId) throw new SfaMutationError(400, '選択したステージが見つかりません。'); return null }
  const stage = await tx.sfaStage.findUnique({ where: { id: rows[0].id }, include: { pipeline: true } })
  if (!stage || stage.pipeline.organizationId !== ctx.organizationId || stage.isWon && stage.isLost || !Number.isInteger(stage.probability) || stage.probability < 0 || stage.probability > 100) throw new SfaMutationError(400, 'ステージの設定を確認してください。')
  return stage
}
export function dealStageChange(stage: { id: string; probability: number; isWon: boolean; isLost: boolean }, before?: SfaDeal) {
  const now = new Date(), status = stage.isWon ? 'won' : stage.isLost ? 'lost' : 'open'
  return { stageId: stage.id, probability: stage.probability, status,
    wonAt: status === 'won' ? before?.status === 'won' && before.wonAt ? before.wonAt : now : null,
    lostAt: status === 'lost' ? before?.status === 'lost' && before.lostAt ? before.lostAt : now : null,
    lastActivityAt: new Date(Math.max(now.getTime(), before?.lastActivityAt?.getTime() || 0)) }
}
