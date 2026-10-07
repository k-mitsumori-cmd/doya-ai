import type { Prisma, SfaLead } from '@prisma/client'
import type { SfaContext } from './types'
import { parseSfaAmount } from './amount'
import { dealVersion } from './deal-mutation'
import { SfaMutationError } from './mutation-authority'

const TEXT_FIELDS = {
  dealName: [200, '商談名'], accountName: [200, '取引先名'], contactName: [80, '担当者名'],
  corporateNumber: [20, '法人番号'], email: [200, 'メール'], phone: [40, '電話番号'],
  industry: [80, '業界'], prefecture: [40, '都道府県'], url: [300, 'URL'], note: [2000, 'メモ'],
} as const
type Field = keyof typeof TEXT_FIELDS
export function conversionInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  const allowed = [...Object.keys(TEXT_FIELDS), 'amount', 'operationId', 'expectedUpdatedAt']
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new SfaMutationError(400, '保存できない項目が含まれています。')
  const text: Partial<Record<Field, string | null>> = {}
  for (const key of Object.keys(TEXT_FIELDS) as Field[]) {
    if (!(key in body)) continue
    const [max, label] = TEXT_FIELDS[key], value = body[key]
    if (typeof value !== 'string' && value !== null) throw new SfaMutationError(400, `${label}の形式が正しくありません。`)
    const normalized = typeof value === 'string' ? value.trim() : null
    if (normalized && normalized.length > max) throw new SfaMutationError(400, `${label}は${max}文字以内で入力してください。元のリードは変更されていません。`)
    if (key === 'accountName' && !normalized) throw new SfaMutationError(400, '取引先名を入力してください。')
    text[key] = normalized || null
  }
  const amount = body.amount === undefined || body.amount === '' ? 0n : parseSfaAmount(body.amount)
  if (amount === null) throw new SfaMutationError(400, '金額は0以上の有効な数値で入力してください。')
  const expectedUpdatedAt = dealVersion(body.expectedUpdatedAt)
  return { body, text, amount, expectedUpdatedAt }
}

/** Snapshot values are checked in the conversion transaction, never silently shortened. */
export function conversionValues(lead: SfaLead, text: Partial<Record<Field, string | null>>) {
  const raw = lead.raw && typeof lead.raw === 'object' && !Array.isArray(lead.raw) ? lead.raw as Record<string, unknown> : {}
  const source = { accountName: lead.name, contactName: lead.contactName, corporateNumber: lead.corporateNumber,
    email: lead.email, phone: lead.phone, industry: raw.industry, prefecture: raw.prefecture, url: raw.url, note: lead.note }
  const values: Partial<Record<Field, string | null>> = {}
  for (const key of Object.keys(source) as (keyof typeof source)[]) {
    const v = key in text ? text[key] : source[key]
    const [max, label] = TEXT_FIELDS[key]
    if (v != null && typeof v !== 'string' || typeof v === 'string' && v.trim().length > max) throw new SfaMutationError(400, `${label}を${max}文字以内で確認・入力してください。元のリードは変更されていません。`)
    values[key] = typeof v === 'string' ? v.trim() || null : null
  }
  if (!values.accountName) throw new SfaMutationError(400, '取引先名を入力してください。')
  const suggestedName = `${values.accountName} 新規商談`
  values.dealName = text.dealName || (suggestedName.length <= 200 ? suggestedName : values.accountName)
  return values as Record<Field, string | null> & { accountName: string; dealName: string }
}
export async function lockConversionLead(tx: Prisma.TransactionClient, c: SfaContext, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_leads WHERE id = ${id} AND "organizationId" = ${c.organizationId} FOR UPDATE`
  if (!rows.some(row => row.id === id)) return null
  return tx.sfaLead.findFirst({ where: { id, organizationId: c.organizationId, isActive: true } })
}

/** Receipt stores the exact created deal, and recovery verifies its original lead/account pair. */
export async function findConversion(tx: Prisma.TransactionClient, c: SfaContext, leadId: string, dealId: string) {
  const lead = await tx.sfaLead.findFirst({ where: { id: leadId, organizationId: c.organizationId, isActive: true, status: 'converted' } })
  if (!lead?.convertedAccountId) return null
  const [account, deal] = await Promise.all([
    tx.sfaAccount.findFirst({ where: { id: lead.convertedAccountId, organizationId: c.organizationId, isActive: true } }),
    tx.sfaDeal.findFirst({ where: { id: dealId, accountId: lead.convertedAccountId, organizationId: c.organizationId, isActive: true } }),
  ])
  return account && deal ? { id: deal.id, leadId, account, deal } : null
}
