// ============================================
// ドヤ見積もりAI 見積書の共通処理
// ============================================
import { prisma } from '@/lib/prisma'
import { calcTotals } from './money'

/**
 * 見積番号の採番。Q-YYYYMM-0001 形式。
 * ⚠️ 番号の重複は実務上の事故（同じ番号の別見積が出回る）なので、
 *    DBの unique([organizationId, quoteNo]) を最終防衛線にし、
 *    衝突したら採番し直す。連番の穴は許容する（欠番より重複の方が害が大きい）。
 */
export async function nextQuoteNo(organizationId: string): Promise<string> {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefix = `Q-${ym}-`
  const last = await prisma.quoteDocument.findFirst({
    where: { organizationId, quoteNo: { startsWith: prefix } },
    orderBy: { quoteNo: 'desc' },
    select: { quoteNo: true },
  })
  const n = last ? Number(last.quoteNo.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(Number.isFinite(n) ? n : 1).padStart(4, '0')}`
}

/** 明細から合計を再計算して保存する。金額の正本は常にこの関数が作る */
export async function recalcDocument(documentId: string): Promise<void> {
  const doc = await prisma.quoteDocument.findUnique({
    where: { id: documentId },
    include: { lineItems: true },
  })
  if (!doc) return
  // 「要見積」の行は合計に含めない。0円として足すと総額を誤らせる
  const billable = doc.lineItems.filter((l) => l.priceSource !== 'unknown' && l.unitPrice > 0)
  const t = calcTotals(
    billable.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
    doc.discountType,
    doc.discountValue
  )
  await prisma.quoteDocument.update({
    where: { id: documentId },
    data: { totalExclTax: t.totalExclTax, taxAmount: t.taxAmount, totalInclTax: t.totalInclTax },
  })
}

/** 既定の有効期限（発行から30日）。商談の場で毎回入力させない */
export function defaultExpiry(from = new Date()): Date {
  return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000)
}
