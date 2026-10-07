import type { Prisma, SfaAccount, SfaContact } from '@prisma/client'
import type { SfaContext } from './types'
import { lockSfaMutationActor, lockSfaRelation, SfaMutationError } from './mutation-authority'
import { createSfaOnce, recoverSfaCreation, cancelSfaCreation, sfaOperationId } from './creation-receipt'
import { withSfaAdmission, checkSfaQuota, type SfaQuotaExceeded } from './limits'
import { dealVersion } from './deal-mutation'

type Kind = 'account' | 'contact'
type CrmRecord = SfaAccount | SfaContact
type AccountInput = { name?: string; industry?: string | null; prefecture?: string | null; url?: string | null; note?: string | null }
type ContactInput = { name?: string; accountId?: string | null; title?: string | null; department?: string | null; email?: string | null; phone?: string | null; note?: string | null; isKeyPerson?: boolean }
export class SfaCrmQuotaError extends Error { constructor(public quota: SfaQuotaExceeded) { super('取引先の上限に達しました。') } }
export function crmRecordInput(value: unknown, kind: 'account', create?: boolean): { data: AccountInput; operationId?: string; expectedUpdatedAt?: Date }
export function crmRecordInput(value: unknown, kind: 'contact', create?: boolean): { data: ContactInput; operationId?: string; expectedUpdatedAt?: Date }
export function crmRecordInput(value: unknown, kind: Kind, create = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  const fields = kind === 'account' ? { name: 200, industry: 80, prefecture: 40, url: 300, note: 2000 }
    : { name: 80, title: 80, department: 80, email: 200, phone: 40, note: 2000, accountId: 128 }
  const allowed = [...Object.keys(fields), ...(kind === 'contact' ? ['isKeyPerson'] : []), create ? 'operationId' : 'expectedUpdatedAt']
  if (Object.keys(body).some(k => !allowed.includes(k))) throw new SfaMutationError(400, '保存できない項目が含まれています。')
  const data: Record<string, string | boolean | null> = {}
  for (const [key, limit] of Object.entries(fields)) {
    if (!(key in body) && !(create && key === 'name')) continue
    const v = body[key]
    if (key === 'name') {
      if (typeof v !== 'string' || !v.trim() || v.trim().length > limit) throw new SfaMutationError(400, `${kind === 'account' ? '会社名' : '氏名'}は1〜${limit}文字で入力してください。`)
      data.name = v.trim(); continue
    }
    if (v !== null && typeof v !== 'string' || typeof v === 'string' && v.length > limit) throw new SfaMutationError(400, '入力項目の形式・文字数をご確認ください。')
    data[key] = typeof v === 'string' ? (key === 'note' ? v : v.trim()) || null : null
  }
  if (typeof data.accountId === 'string' && !/^[a-zA-Z0-9_-]{1,128}$/.test(data.accountId)) throw new SfaMutationError(400, '取引先の指定が正しくありません。')
  if ('isKeyPerson' in body) {
    if (typeof body.isKeyPerson !== 'boolean') throw new SfaMutationError(400, 'キーマンの指定が正しくありません。')
    data.isKeyPerson = body.isKeyPerson
  }
  if (!Object.keys(data).length) throw new SfaMutationError(400, '保存する内容を指定してください。')
  const operationId = create ? sfaOperationId(body.operationId) : undefined
  const expectedUpdatedAt = !create ? dealVersion(body.expectedUpdatedAt) : undefined
  if (create && !operationId || !create && !expectedUpdatedAt) throw new SfaMutationError(400, '操作情報・更新日時を確認できません。画面を再読み込みしてください。')
  return { data, operationId, expectedUpdatedAt }
}
export function crmRecordId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new SfaMutationError(400, 'データの指定が正しくありません。')
  return value
}
export async function lockCrmRecord(tx: Prisma.TransactionClient, c: SfaContext, kind: Kind, id: string, write = true) {
  crmRecordId(id)
  const rows = kind === 'account' ? write
    ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_accounts WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_accounts WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR SHARE`
    : write ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_contacts WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_contacts WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR SHARE`
  if (!rows.some(row => row.id === id)) return null
  return kind === 'account' ? tx.sfaAccount.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } })
    : tx.sfaContact.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } })
}
export async function createCrmRecord(c: SfaContext, kind: Kind, value: unknown) {
  const parsed = kind === 'account' ? crmRecordInput(value, 'account', true) : crmRecordInput(value, 'contact', true)
  const result = await withSfaAdmission(c.organizationId, {}, async tx => {
    await lockSfaMutationActor(tx, c)
    return createSfaOnce<CrmRecord>(tx, c, kind, parsed.operationId, parsed.data,
      id => kind === 'account' ? tx.sfaAccount.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } }) : tx.sfaContact.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } }),
      async () => {
        if (kind === 'account') {
          const quota = await checkSfaQuota(tx, c.organizationId, { accounts: 1 })
          if (quota) throw new SfaCrmQuotaError(quota)
          const data = parsed.data as AccountInput
          return tx.sfaAccount.create({ data: { ...data, name: data.name!, organizationId: c.organizationId, ownerMemberId: c.memberId } })
        }
        const data = parsed.data as ContactInput
        if (data.accountId) await lockSfaRelation(tx, c, 'sfaAccount', data.accountId)
        return tx.sfaContact.create({ data: { ...data, name: data.name!, organizationId: c.organizationId } })
      }, { retrySerializableRace: true })
  })
  if (result.limit) throw new Error('Unexpected record admission limit')
  return result.created
}
export async function recoverCrmRecord(c: SfaContext, kind: Kind, operation: unknown, cancel = false) {
  const operationId = sfaOperationId(operation)
  if (!operationId) throw new SfaMutationError(400, '操作情報を指定してください。')
  const result = await withSfaAdmission(c.organizationId, {}, async tx => {
    await lockSfaMutationActor(tx, c)
    const find = (id: string) => kind === 'account' ? tx.sfaAccount.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } }) : tx.sfaContact.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } })
    return cancel ? cancelSfaCreation<CrmRecord>(tx, c, kind, operationId, find) : recoverSfaCreation<CrmRecord>(tx, c, kind, operationId, find)
  })
  if (result.limit) throw new Error('Unexpected record recovery limit')
  return result.created
}

export async function mutateCrmRecord(c: SfaContext, kind: Kind, id: string, value: unknown, remove = false) {
  crmRecordId(id)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  if (remove && Object.keys(body).some(k => k !== 'expectedUpdatedAt')) throw new SfaMutationError(400, '削除操作の入力が正しくありません。')
  const parsed = remove ? { data: {}, expectedUpdatedAt: dealVersion(body.expectedUpdatedAt) }
    : kind === 'account' ? crmRecordInput(body, 'account') : crmRecordInput(body, 'contact')
  if (!parsed.expectedUpdatedAt) throw new SfaMutationError(400, '更新日時を確認できません。一覧を更新してください。')
  const expectedUpdatedAt = parsed.expectedUpdatedAt
  const result = await withSfaAdmission(c.organizationId, {}, async tx => {
    await lockSfaMutationActor(tx, c)
    const row = await lockCrmRecord(tx, c, kind, id)
    if (!row) throw new SfaMutationError(404, 'データが見つかりません。一覧をご確認ください。')
    if (row.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SfaMutationError(409, '他の操作で変更されています。一覧を更新してから再度ご確認ください。')
    if (remove) {
      const deals = await tx.sfaDeal.count({ where: { organizationId: c.organizationId, isActive: true, ...(kind === 'account' ? { accountId: id } : { contactId: id }) } })
      const contacts = kind === 'account' ? await tx.sfaContact.count({ where: { organizationId: c.organizationId, accountId: id, isActive: true } }) : 0
      if (deals || contacts) throw new SfaMutationError(409, kind === 'account' ? 'この取引先には担当者または商談が紐づいています。関連先を変更・整理してから削除してください。' : 'この担当者には商談が紐づいています。商談の詳細で「担当者レコードとの紐づけを解除」を選び、保存してから削除してください。')
    } else if (kind === 'contact') {
      const data = parsed.data as ContactInput
      if (data.accountId) await lockSfaRelation(tx, c, 'sfaAccount', data.accountId)
    }
    const updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1))
    const where = { id, organizationId: c.organizationId, isActive: true, updatedAt: expectedUpdatedAt }
    const changed = kind === 'account' ? await tx.sfaAccount.updateMany({ where, data: remove ? { isActive: false, updatedAt } : { ...parsed.data as AccountInput, updatedAt } })
      : await tx.sfaContact.updateMany({ where, data: remove ? { isActive: false, updatedAt } : { ...parsed.data as ContactInput, updatedAt } })
    if (changed.count !== 1) throw new SfaMutationError(409, 'データが変更されています。一覧をご確認ください。')
    if (remove) return { ok: true as const, id, updatedAt }
    return kind === 'account' ? tx.sfaAccount.findFirstOrThrow({ where: { id, organizationId: c.organizationId, isActive: true } })
      : tx.sfaContact.findFirstOrThrow({ where: { id, organizationId: c.organizationId, isActive: true } })
  })
  if (result.limit) throw new Error('Unexpected record mutation limit')
  return result.created
}
