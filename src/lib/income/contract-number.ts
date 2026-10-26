// ============================================
// ドヤ収入管理: 契約番号の自動採番（C-2026-0001 の形。会社〈組織〉ごと・年ごとの連番）
// ============================================
import type { Prisma } from '@prisma/client'
import { todayJst } from './dates'

type Tx = Prisma.TransactionClient

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const DEFAULT_CONTRACT_NO_HEAD = 'C'
export const DEFAULT_INVOICE_NO_HEAD = 'INV'

/** 番号の頭として使える文字（英数字 1〜8 文字。設定の画面で入れる）。2026-10-26 */
export function normalizeNoHead(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = raw.normalize('NFKC').trim().toUpperCase()
  return s === '' ? null : s
}
export function isValidNoHead(head: string): boolean {
  return /^[A-Z0-9]{1,8}$/.test(head)
}

/** 契約番号の接頭辞。例: 'C-2026-'。head は設定の「契約番号の頭」（未設定なら C） */
export function contractNoPrefix(year: number, head: string = DEFAULT_CONTRACT_NO_HEAD): string {
  return `${head}-${year}-`
}

/** 請求書番号。例: INV-2026-0001。head は設定の「請求書番号の頭」（未設定なら INV） */
export function formatInvoiceNo(year: number, no: number, head: string = DEFAULT_INVOICE_NO_HEAD): string {
  return `${head}-${year}-${String(no).padStart(4, '0')}`
}

/**
 * 次の契約番号を返す。同じ年の C-YYYY-NNNN のうち最大の番号に 1 を足す。
 * 手で付けた別形式の番号（例: A-001）は数えない。呼び出し側の Serializable トランザクションと、
 * DB の @@unique([organizationId, contractNo]) で、同時登録による重複を防ぐ。
 */
export async function nextContractNo(tx: Tx, organizationId: string, today: string = todayJst(), head: string = DEFAULT_CONTRACT_NO_HEAD): Promise<string> {
  const year = Number(today.slice(0, 4))
  const prefix = contractNoPrefix(year, head)
  const rows = await tx.incomeContract.findMany({
    where: { organizationId, contractNo: { startsWith: prefix } },
    select: { contractNo: true },
  })
  let max = 0
  for (const r of rows) {
    // 頭は英数字に限っているが、正規表現の記号が入っても壊れないように逃がす
    const m = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`).exec(r.contractNo ?? '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
