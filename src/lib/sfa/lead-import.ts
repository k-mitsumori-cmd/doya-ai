import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'
import { SfaMutationError } from './mutation-authority'
import { createSfaOnce, SfaReceiptRaceError } from './creation-receipt'

type Row = Record<string, unknown>
export interface SfaLeadImportResult { id: string; imported: number; skipped: number; skippedRows: number[] }
export function leadImportInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '取込内容が正しくありません。')
  const body = value as Row
  if (Object.keys(body).some(key => !['rows', 'source', 'operationId'].includes(key))) throw new SfaMutationError(400, '取込できない項目が含まれています。')
  if (!Array.isArray(body.rows) || !body.rows.length) throw new SfaMutationError(400, '取込データがありません。')
  if (body.rows.length > 500) throw new SfaMutationError(413, '一度に取り込めるのは500件までです。')
  if (body.source !== undefined && (typeof body.source !== 'string' || !['csv', 'doyalist'].includes(body.source))) throw new SfaMutationError(400, '取込元が正しくありません。')
  const source = body.source === 'doyalist' ? 'doyalist' : 'csv', skippedRows: number[] = []
  const data = body.rows.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { skippedRows.push(index + 1); return [] }
    const row = item as Row
    const nameValue = row.name ?? row.companyName ?? row.会社名 ?? row.企業名
    if ((typeof nameValue !== 'string' && typeof nameValue !== 'number') || !String(nameValue).trim()) { skippedRows.push(index + 1); return [] }
    const str = (value: unknown, max: number, label: string): string | null => {
      if (value == null) return null
      if (typeof value !== 'string' && typeof value !== 'number' || typeof value === 'number' && !Number.isFinite(value)) throw new SfaMutationError(400, `取込データ${index + 1}件目の${label}の形式が正しくありません。取込は行っていません。`)
      const text = String(value).trim()
      if (text.length > max) throw new SfaMutationError(400, `取込データ${index + 1}件目の${label}は${max}文字以内で入力してください。取込は行っていません。`)
      return text || null
    }
    const name = str(nameValue, 200, '企業名')!
    const scalar = (value: unknown, label: string) => { const text = str(value, 64, label); return typeof value === 'number' ? value : text }
    const raw = { prefecture: str(row.prefecture ?? row.都道府県, 40, '都道府県'), url: str(row.url ?? row.URL ?? row.website, 300, 'URL'),
      industry: str(row.industry ?? row.業界, 80, '業界'), employeeCount: scalar(row.employeeCount ?? row.従業員数, '従業員数'), capital: scalar(row.capital ?? row.資本金, '資本金'),
      representative: str(row.representative ?? row.代表者, 80, '代表者'), address: str(row.address ?? row.住所, 200, '住所') }
    return [{ name, corporateNumber: str(row.corporateNumber ?? row.法人番号, 20, '法人番号'), contactName: str(row.contactName ?? row.representative ?? row.代表者, 80, '担当者名'),
      email: str(row.email ?? row.メール, 200, 'メール'), phone: str(row.phone ?? row.電話番号 ?? row.tel, 40, '電話番号'), note: str(row.note ?? row.メモ, 2000, 'メモ'), source, status: 'new', raw }]
  })
  if (!data.length) throw new SfaMutationError(400, '有効な行（企業名）がありませんでした。')
  return { body, data, skippedRows }
}
const batchKey = (c: SfaContext, id: string) => 'sfa-lead-import:v1:' + createHash('sha256').update(JSON.stringify([c.userId, c.organizationId, id])).digest('hex')
export async function findLeadImport(tx: Prisma.TransactionClient, c: SfaContext, id: string): Promise<SfaLeadImportResult | null> {
  const saved = await tx.systemSetting.findUnique({ where: { key: batchKey(c, id) }, select: { value: true } })
  if (!saved || saved.value.length > 100000) return null
  let record: unknown
  try { record = JSON.parse(saved.value) } catch { return null }
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const r = record as Row
  if (r.version !== 1 || r.userId !== c.userId || r.organizationId !== c.organizationId || !Array.isArray(r.ids) || !r.ids.length || r.ids.length > 500 || !r.ids.every(v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)) || new Set(r.ids).size !== r.ids.length
    || !Array.isArray(r.skippedRows) || r.skippedRows.length + r.ids.length > 500 || new Set(r.skippedRows).size !== r.skippedRows.length || !r.skippedRows.every(v => Number.isInteger(v) && v > 0 && v <= (r.ids as unknown[]).length + (r.skippedRows as unknown[]).length)) return null
  const count = await tx.sfaLead.count({ where: { id: { in: r.ids as string[] }, organizationId: c.organizationId, isActive: true } })
  return count === r.ids.length ? { id, imported: count, skipped: r.skippedRows.length, skippedRows: r.skippedRows as number[] } : null
}

/** The result marker, lead rows and replay receipt share one Serializable transaction. */
export async function createLeadImport(tx: Prisma.TransactionClient, c: SfaContext, operationId: string | undefined, input: ReturnType<typeof leadImportInput>) {
  return createSfaOnce(tx, c, 'lead-import', operationId, { rows: input.data, skippedRows: input.skippedRows },
    id => findLeadImport(tx, c, id), async () => {
      const id = operationId || randomUUID(), ids = input.data.map(() => randomUUID())
      const rows = input.data.map((row, index) => ({ ...row, id: ids[index], organizationId: c.organizationId, assigneeMemberId: c.memberId }))
      const created = await tx.sfaLead.createMany({ data: rows })
      if (created.count !== rows.length) throw new Error('Incomplete atomic lead import')
      try {
        await tx.systemSetting.create({ data: { key: batchKey(c, id), value: JSON.stringify({ version: 1, userId: c.userId, organizationId: c.organizationId, ids, skippedRows: input.skippedRows }) } })
      } catch (error) {
        const failure = error as { code?: string; meta?: { target?: unknown } }
        if (failure?.code === 'P2002' && Array.isArray(failure.meta?.target) && failure.meta.target.length === 1 && failure.meta.target[0] === 'key') throw new SfaReceiptRaceError('取込結果の競合を再確認します。')
        throw error
      }
      return { id, imported: rows.length, skipped: input.skippedRows.length, skippedRows: input.skippedRows }
    }, { retrySerializableRace: true })
}
