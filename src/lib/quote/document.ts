// ============================================
// ドヤ見積もりAI 見積書の共通処理
// ============================================
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { billableLines, calcTotals } from './money'

/**
 * 見積番号の採番。Q-YYYYMM-0001 形式。
 * ⚠️ 番号の重複は実務上の事故（同じ番号の別見積が出回る）なので、
 *    DBの unique([organizationId, quoteNo]) を最終防衛線にし、
 *    衝突したら採番し直す。連番の穴は許容する（欠番より重複の方が害が大きい）。
 */
export async function nextQuoteNo(organizationId: string, now = new Date()): Promise<string> {
  // 見積番号の年月は利用者が見る日本時間。実行環境のTZ（VercelではUTC）に依存させない。
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const ym = `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, '0')}`
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
export async function recalcDocument(
  documentId: string,
  db: Pick<Prisma.TransactionClient, 'quoteDocument'> = prisma
): Promise<void> {
  const doc = await db.quoteDocument.findUnique({
    where: { id: documentId },
    include: { lineItems: true },
  })
  if (!doc) return
  // 「要見積」の行は合計に含めない。0円として足すと総額を誤らせる
  const billable = billableLines(doc.lineItems)
  // 明細の乗算と合算がDBの Int 上限を超える前に止める。
  // 巨額入力を Number で計算し続けると精度が失われ、保存時に500になる。
  const intMax = 2147483647
  const rawTotal = billable.reduce((sum, line) => sum + BigInt(line.qty) * BigInt(line.unitPrice), 0n)
  if (rawTotal > BigInt(intMax)) {
    throw Object.assign(new Error('見積金額が保存可能な上限を超えています'), { code: 'QUOTE_TOTAL_OUT_OF_RANGE' })
  }
  const t = calcTotals(
    billable.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
    doc.discountType,
    doc.discountValue
  )
  if (!Number.isInteger(t.totalInclTax) || t.totalInclTax > intMax) {
    throw Object.assign(new Error('税込合計が保存可能な上限を超えています'), { code: 'QUOTE_TOTAL_OUT_OF_RANGE' })
  }
  await db.quoteDocument.update({
    where: { id: documentId },
    data: { totalExclTax: t.totalExclTax, taxAmount: t.taxAmount, totalInclTax: t.totalInclTax },
  })
}

/** 既定の有効期限（発行から30日）。商談の場で毎回入力させない */
export function defaultExpiry(from = new Date()): Date {
  return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000)
}
