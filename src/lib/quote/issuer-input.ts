/** Shared issuer bounds; reject excess input rather than silently dropping invoice text. */
export const QUOTE_ISSUER_FIELDS = ['companyName', 'postalCode', 'address', 'tel', 'personName', 'invoiceNo', 'paymentTerms', 'deliveryTerms', 'notes'] as const
export type QuoteIssuerInput = Record<typeof QUOTE_ISSUER_FIELDS[number], string | null> & { companyName: string }
export function normalizeQuoteIssuer(value: unknown): QuoteIssuerInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('発行者情報の形式が不正です')
  const body = value as Record<string, unknown>
  if (typeof body.companyName !== 'string' || !body.companyName.trim()) throw new Error('会社名を入力してください')
  const result: Record<string, string | null> = {}
  for (const field of QUOTE_ISSUER_FIELDS) {
    const v = body[field]
    if (v != null && typeof v !== 'string') throw new Error(`${field} の形式が不正です`)
    const text = typeof v === 'string' ? v : ''
    const normalized = field === 'companyName' ? text.trim() : text
    const limit = field === 'companyName' ? 200 : 2000
    if (normalized.length > limit) throw new Error(`${field === 'companyName' ? '会社名' : field} は${limit}文字以内で入力してください`)
    result[field] = text.trim() ? normalized : null
  }
  return result as QuoteIssuerInput
}
export function isQuoteIssuerAcknowledgement(value: unknown, sent: QuoteIssuerInput) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 200
    && QUOTE_ISSUER_FIELDS.every(field => Object.prototype.hasOwnProperty.call(row, field) && row[field] === sent[field])
}
