import { createHash, randomUUID } from 'node:crypto'
import type { Prisma, QuoteDocument, QuoteLineItem } from '@prisma/client'
export class QuoteDocumentRevisionError extends Error { constructor(public status: number, message: string) { super(message) } }
type Document = QuoteDocument & { lineItems: QuoteLineItem[] }
type Store = Pick<Prisma.TransactionClient, 'systemSetting'>
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const key = (doc: QuoteDocument) => 'quote-document-revision:v1:' + hash([doc.organizationId, doc.id])
const fields = ['id','organizationId','productId','quoteNo','title','clientCompany','clientDept','clientPerson','issueDate','expiryDate','paymentTerms','deliveryTerms','notes','discountType','discountValue','status','confirmedBy','confirmedAt','sentAt','totalExclTax','taxAmount','totalInclTax','createdAt'] as const
const lineFields = ['id','documentId','ord','itemName','spec','qty','unit','unitPrice','taxRate','priceSource','sourceRef','rangeMin','rangeMax','createdAt'] as const
export function quoteExpectedRevision(value: unknown): string {
  if (value === undefined) throw new QuoteDocumentRevisionError(428, '最新の見積書を読み込み直してください。変更は保存されていません。')
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new QuoteDocumentRevisionError(400, '見積書の版を確認できません。最新の画面を開き直してください。')
  return value
}
export async function withQuoteDocumentRevision<T extends Document>(db: Store, doc: T): Promise<T & { revision: string }> {
  const stored = await db.systemSetting.findUnique({ where: { key: key(doc) }, select: { value: true } })
  let nonce = 'legacy'
  if (stored) {
    let record: { version?: unknown; nonce?: unknown }
    try { record = JSON.parse(stored.value) } catch { throw new QuoteDocumentRevisionError(409, '見積書の版の記録を確認できません。管理者にご確認ください。') }
    if (!record || record.version !== 1 || typeof record.nonce !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.nonce)) throw new QuoteDocumentRevisionError(409, '見積書の版の記録を確認できません。管理者にご確認ください。')
    nonce = record.nonce
  }
  const lines = [...doc.lineItems].sort((a,b)=>a.ord-b.ord || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { ...doc, revision: hash([nonce,fields.map(f=>doc[f]),lines.map(line=>lineFields.map(f=>line[f]))]) }
}
/** Caller holds the current document row lock; generation and business rows commit together. */
export async function advanceQuoteDocumentRevision<T extends Document>(tx: Store, doc: T): Promise<T & { revision: string }> {
  const value = JSON.stringify({ version:1, nonce:randomUUID() })
  await tx.systemSetting.upsert({where:{key:key(doc)},create:{key:key(doc),value},update:{value}})
  return withQuoteDocumentRevision(tx,doc)
}
export async function assertQuoteDocumentRevision(db: Store, doc: Document, expected: string) {
  if ((await withQuoteDocumentRevision(db,doc)).revision !== expected) throw new QuoteDocumentRevisionError(409, 'この見積書は別の操作で変更されています。変更は保存されていません。最新の内容をご確認ください。')
}
/** Lock fresh membership before the document, including role revocation/deletion races. */
export async function lockQuoteDocumentActor(tx: Prisma.TransactionClient, ctx: {organizationId:string;userId:string}, id:string): Promise<{role:string}|null> {
  const actors = await tx.$queryRaw<Array<{role:string}>>`SELECT role FROM quote_members WHERE "organizationId" = ${ctx.organizationId} AND "userId" = ${ctx.userId} AND status = 'ACTIVE' FOR UPDATE`
  if (actors.length !== 1) return null
  await tx.$queryRaw`SELECT id FROM quote_documents WHERE id = ${id} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`
  return actors[0]
}

/** Raw row-lock conflicts use SQLSTATE inside Prisma P2010; they are not save failures. */
export function isQuoteDocumentWriteConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  if (error.code === 'P2034') return true
  if (error.code !== 'P2010' || !('meta' in error) || !error.meta || typeof error.meta !== 'object' || !('code' in error.meta)) return false
  return error.meta.code === '40001' || error.meta.code === '40P01'
}
