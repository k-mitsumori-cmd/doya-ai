// ============================================
// ドヤ収入管理: 入金と請求書の照合（ルールのみ。AI は Phase2）
// ============================================
// 候補を出すだけで、消込を確定するのは人（設計書 §6）。

/** 振込名義の正規化: 全角カタカナに寄せ、空白・法人略号・記号を落とす */
export function normalizePayerName(name: string | null | undefined): string {
  if (!name) return ''
  let s = name.normalize('NFKC')
  // ひらがな → カタカナ
  s = s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
  s = s.toUpperCase()
  // 法人略号。銀行明細では前に付くと「カ)」、後ろに付くと「(カ」になる
  s = s.replace(/[(（](カ|ユ|ド|シャ|ザイ|イ|ガク)[)）]?|(カ|ユ|ド|シャ|ザイ|イ|ガク)[)）]/g, '')
  s = s.replace(/カブシキガイシャ|カブシキカイシャ|ユウゲンガイシャ|ゴウドウガイシャ|株式会社|有限会社|合同会社/g, '')
  s = s.replace(/[\s　・.,，、。()（）「」\-ー－]/g, '')
  return s
}

export type OpenInvoice = {
  id: string
  invoiceNo: string | null
  clientName: string
  payerNameKana: string | null
  remaining: number
  dueDate: string
}

export type MatchCandidate = {
  invoiceId: string
  score: number
  reason: string
}

/** 振込手数料として差し引かれうる上限（円） */
export const FEE_TOLERANCE = 1_000

export function suggestMatches(payment: { amount: number; payerName: string | null }, invoices: OpenInvoice[]): MatchCandidate[] {
  const payer = normalizePayerName(payment.payerName)
  const out: MatchCandidate[] = []
  for (const inv of invoices) {
    if (inv.remaining <= 0) continue
    const names = [normalizePayerName(inv.payerNameKana), normalizePayerName(inv.clientName)].filter(Boolean)
    const nameHit = !!payer && names.some((n) => n.length >= 2 && (payer.includes(n) || n.includes(payer)))
    const exact = payment.amount === inv.remaining
    const feeGap = inv.remaining - payment.amount
    const withFee = feeGap > 0 && feeGap <= FEE_TOLERANCE
    let score = 0
    let reason = ''
    if (exact && nameHit) { score = 100; reason = '金額と振込名義が一致' }
    else if (withFee && nameHit) { score = 80; reason = `振込名義が一致（${feeGap.toLocaleString('ja-JP')}円 不足・手数料の可能性）` }
    else if (exact) { score = 60; reason = '金額が一致' }
    else if (nameHit) { score = 40; reason = '振込名義が一致（金額は不一致）' }
    if (score > 0) out.push({ invoiceId: inv.id, score, reason })
  }
  return out.sort((a, b) => b.score - a.score || a.invoiceId.localeCompare(b.invoiceId))
}
