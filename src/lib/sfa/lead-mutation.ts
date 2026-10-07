import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'
import { dealVersion } from './deal-mutation'
import { SfaMutationError } from './mutation-authority'

const STATES = ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified']
const SOURCES = ['manual', 'csv', 'doyalist']
const TEXT = { name: [200, '企業名・氏名'], corporateNumber: [20, '法人番号'], contactName: [80, '担当者名'], email: [200, 'メールアドレス'], phone: [40, '電話番号'], note: [2000, 'メモ'] } as const
export function leadInput(value: unknown, create = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  const allowed = create ? [...Object.keys(TEXT), 'source', 'operationId'] : ['status', 'note', 'contactName', 'email', 'phone', 'score', 'expectedUpdatedAt']
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new SfaMutationError(400, '保存できない項目が含まれています。')
  const data: { name?: string; corporateNumber?: string | null; contactName?: string | null; email?: string | null; phone?: string | null; note?: string | null; source?: string; status?: string; score?: number | null } = {}
  for (const key of Object.keys(TEXT) as (keyof typeof TEXT)[]) {
    if (!(key in body) && !(create && key === 'name')) continue
    const value = body[key], [max, label] = TEXT[key]
    if (typeof value !== 'string' && value !== null && !(create && key !== 'name' && value === undefined)) throw new SfaMutationError(400, `${label}の形式が正しくありません。`)
    const text = typeof value === 'string' ? key === 'name' ? value.trim() : value : null
    if (text && text.length > max) throw new SfaMutationError(400, `${label}は${max}文字以内で入力してください。入力を短くせず、保存を中止しました。`)
    if (key === 'name') { if (!text) throw new SfaMutationError(400, '企業名・氏名を入力してください。'); data.name = text }
    else data[key] = text || null
  }
  if (create) {
    if (body.source != null && (typeof body.source !== 'string' || !SOURCES.includes(body.source))) throw new SfaMutationError(400, '流入元が正しくありません。')
    data.source = typeof body.source === 'string' ? body.source : 'manual'
  }
  if ('status' in body) {
    if (typeof body.status !== 'string' || !STATES.includes(body.status)) throw new SfaMutationError(400, '状態が正しくありません。')
    data.status = body.status
  }
  if ('score' in body) {
    const score = Number(body.score)
    if (body.score === null) data.score = null
    else if ((typeof body.score !== 'number' && typeof body.score !== 'string') || typeof body.score === 'string' && !body.score.trim() || !Number.isFinite(score) || score < 0 || score > 100) throw new SfaMutationError(400, 'スコアは0〜100で入力してください。')
    else data.score = Math.round(score)
  }
  if (!create && !Object.keys(data).length) throw new SfaMutationError(400, '更新する内容を指定してください。')
  const expectedUpdatedAt = create ? undefined : dealVersion(body.expectedUpdatedAt)
  if (!create && !expectedUpdatedAt) throw new SfaMutationError(400, '更新日時を確認できません。画面を再読み込みしてから操作してください。')
  return { body, data, expectedUpdatedAt }
}
export function leadId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new SfaMutationError(400, 'リードの指定が正しくありません。')
  return id
}
export async function lockLead(tx: Prisma.TransactionClient, c: SfaContext, id: string, write = true) {
  leadId(id)
  const rows = write ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_leads WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_leads WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR SHARE`
  if (!rows.some(row => row.id === id)) return null
  return tx.sfaLead.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } })
}
export function assertLeadVersion(expected: Date | undefined, actual: Date) {
  if (expected && expected.getTime() !== actual.getTime()) throw new SfaMutationError(409, 'リードが別の操作で更新されています。一覧を確認してから操作してください。')
}
export const nextLeadVersion = (before: Date) => new Date(Math.max(Date.now(), before.getTime() + 1))
