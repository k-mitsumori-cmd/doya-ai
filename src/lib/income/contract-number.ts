// ============================================
// ドヤ収入管理: 契約番号の自動採番（C-2026-0001 の形。会社〈組織〉ごと・年ごとの連番）
// ============================================
import type { Prisma } from '@prisma/client'
import { todayJst } from './dates'

type Tx = Prisma.TransactionClient

/** 契約番号の接頭辞。例: 'C-2026-' */
export function contractNoPrefix(year: number): string {
  return `C-${year}-`
}

/**
 * 次の契約番号を返す。同じ年の C-YYYY-NNNN のうち最大の番号に 1 を足す。
 * 手で付けた別形式の番号（例: A-001）は数えない。呼び出し側の Serializable トランザクションと、
 * DB の @@unique([organizationId, contractNo]) で、同時登録による重複を防ぐ。
 */
export async function nextContractNo(tx: Tx, organizationId: string, today: string = todayJst()): Promise<string> {
  const year = Number(today.slice(0, 4))
  const prefix = contractNoPrefix(year)
  const rows = await tx.incomeContract.findMany({
    where: { organizationId, contractNo: { startsWith: prefix } },
    select: { contractNo: true },
  })
  let max = 0
  for (const r of rows) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(r.contractNo ?? '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
