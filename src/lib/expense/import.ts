// ============================================
// ドヤ支出管理: 他ツールからの支出の取り込み口（ADDON-SERVICES §6 #12）
// ============================================
// 例: 展示会の予算（TenjikaiBudgetLine、発注済み）→ 単発の支出（expense.importFromTenjikai）
// 規則（§18.4 共通規則）: 作成のみ・既にあれば上書きしない・取り消しはリンクを外す。
// ⚠️ 呼ぶ側は、操作者が支出側の組織で manager 以上であること、取り込み元の行が操作者のものであることを確かめてから呼ぶ。
// ⚠️ 冪等キーは (organizationId, sourceType, sourceId) の一意制約。
import { prisma } from '@/lib/prisma'
import { CATEGORIES } from './constants'
import { firstOfMonth, isYmd, toDbDate, ymOf, type Ymd } from './dates'
import { settle, splitTax } from './plan'
import { syncWithholding } from './sync'

export const IMPORT_SOURCE_TYPES = ['tenjikai.budgetLine'] as const
export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number]

export type ImportExpenseInput = {
  sourceType: ImportSourceType
  sourceId: string
  title: string
  /** 既定は ads（展示会の出展費・制作費） */
  category?: string
  /** 円 */
  amount: number
  taxRate?: 10 | 8 | 0
  taxIncluded?: boolean
  payDate: Ymd
  /** 計上日（既定は支払日） */
  accrualDate?: Ymd
  note?: string
}

export async function importExternalExpense(
  organizationId: string,
  actorUserId: string,
  input: ImportExpenseInput
): Promise<{ created: boolean; scheduleId: string }> {
  if (!(IMPORT_SOURCE_TYPES as readonly string[]).includes(input.sourceType)) throw new Error('unsupported sourceType')
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(input.sourceId)) throw new Error('invalid sourceId')
  if (!isYmd(input.payDate) || (input.accrualDate && !isYmd(input.accrualDate))) throw new Error('invalid date')
  if (!Number.isInteger(input.amount) || input.amount < 0 || input.amount > 999_999_999) throw new Error('invalid amount')

  const existing = await prisma.expenseSchedule.findFirst({ where: { organizationId, sourceType: input.sourceType, sourceId: input.sourceId }, select: { id: true } })
  if (existing) return { created: false, scheduleId: existing.id }

  const { exclTax, tax } = splitTax(input.amount, input.taxRate ?? 10, input.taxIncluded ?? false)
  const category = input.category && (CATEGORIES as readonly string[]).includes(input.category) ? input.category : 'ads'
  try {
    const row = await prisma.$transaction(async (tx) => {
      const r = await tx.expenseSchedule.create({
        data: {
          organizationId,
          kind: 'one_time',
          title: input.title.trim().slice(0, 120) || '取り込んだ支出',
          category,
          period: toDbDate(firstOfMonth(ymOf(input.accrualDate ?? input.payDate))),
          plannedPayDate: toDbDate(input.payDate),
          plannedAmountExclTax: exclTax,
          amountExclTax: exclTax,
          taxAmount: tax,
          ...settle(exclTax, tax, false),
          note: input.note?.slice(0, 1000) ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      })
      await tx.expenseAuditLog.create({ data: { organizationId, actorUserId, action: 'schedule.import', targetType: 'schedule', targetId: r.id, diff: { sourceType: input.sourceType, sourceId: input.sourceId } } })
      return r
    })
    return { created: true, scheduleId: row.id }
  } catch (e) {
    // 同時に 2 回呼ばれたとき: 一意制約で後の方が失敗する。先にできた行を返す
    if ((e as { code?: string })?.code === 'P2002') {
      const r = await prisma.expenseSchedule.findFirst({ where: { organizationId, sourceType: input.sourceType, sourceId: input.sourceId }, select: { id: true } })
      if (r) return { created: false, scheduleId: r.id }
    }
    throw e
  }
}

/** 取り込み元で取り消したとき: 支出は消さず、リンクだけ外す（§18.4「取り消しはリンクを外す」） */
export async function unlinkImportedExpense(organizationId: string, actorUserId: string, sourceType: ImportSourceType, sourceId: string): Promise<boolean> {
  const r = await prisma.expenseSchedule.findFirst({ where: { organizationId, sourceType, sourceId }, select: { id: true, withholdingAmount: true } })
  if (!r) return false
  await prisma.$transaction(async (tx) => {
    await tx.expenseSchedule.update({ where: { id: r.id }, data: { sourceType: null, sourceId: null } })
    if (r.withholdingAmount > 0) await syncWithholding(tx, organizationId)
    await tx.expenseAuditLog.create({ data: { organizationId, actorUserId, action: 'schedule.unlink', targetType: 'schedule', targetId: r.id, diff: { sourceType, sourceId } } })
  })
  return true
}
