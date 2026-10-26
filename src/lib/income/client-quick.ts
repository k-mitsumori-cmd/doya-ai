// ============================================
// ドヤ収入管理: 取引先を名前だけでその場で登録する（契約・請求書の画面から。2026-10-26）
// ============================================
// 本人の依頼「取引先から登録しなくても、契約の方から取引先を登録できるように」。
// 詳しい項目（住所・請求先のメール・支払条件）は、あとから取引先の画面で足す。
// ⚠️ 同じ名前の有効な取引先があれば、新しく作らずにそれを使う（二重に作らない）。
import type { Prisma } from '@prisma/client'
import { audit, IncomeError, type IncomeContext } from './access'

type Tx = Prisma.TransactionClient

export function normalizeClientName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export async function findOrCreateClientByName(tx: Tx, ctx: IncomeContext, rawName: string, from: 'contract' | 'invoice') {
  const name = normalizeClientName(rawName)
  if (!name) throw new IncomeError('取引先名を入力してください')
  const same = await tx.incomeClient.findFirst({ where: { organizationId: ctx.organizationId, name, isActive: true }, select: { id: true } })
  if (same) return { id: same.id, created: false }
  const created = await tx.incomeClient.create({ data: { organizationId: ctx.organizationId, name }, select: { id: true } })
  await audit(tx, ctx, 'client.create', 'client', created.id, { from })
  return { id: created.id, created: true }
}
