import { createHash, randomUUID } from 'node:crypto'
import type { Prisma, KintaiWorkRule } from '@prisma/client'
export class KintaiWorkRuleRevisionError extends Error { constructor(public status: number, message: string) { super(message) } }
type Store = Pick<Prisma.TransactionClient, 'systemSetting'>
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const key = (rule: KintaiWorkRule) => 'kintai-work-rule-revision:v1:' + hash([rule.organizationId, rule.id])
export function workRuleExpectedRevision(value: unknown): string {
 if (value === undefined) throw new KintaiWorkRuleRevisionError(428, '最新の就業ルールを読み込み直してください。入力内容はまだ保存されていません。')
 if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new KintaiWorkRuleRevisionError(400, '就業ルールの版を確認できません。最新の画面を開き直してください。')
 return value
}
/** Include both a persistent generation and current business fields, detecting out-of-band edits too. */
function decorate<T extends KintaiWorkRule>(rule: T, stored: { value: string } | null): T & { revision: string } {
 let nonce = 'legacy'
 if (stored) {
  let record: { version?: unknown; nonce?: unknown }
  try { record = JSON.parse(stored.value) } catch { throw new KintaiWorkRuleRevisionError(409, '就業ルールの版の記録を確認できません。管理者にご確認ください。') }
  if (!record || record.version !== 1 || typeof record.nonce !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.nonce)) throw new KintaiWorkRuleRevisionError(409, '就業ルールの版の記録を確認できません。管理者にご確認ください。')
  nonce = record.nonce
 }
 const revision = hash([nonce, rule.id, rule.organizationId, rule.createdAt, rule.name, rule.workStart, rule.workEnd, rule.breakMinutes, rule.overtimeCalcMethod, rule.flexEnabled, rule.coreStart, rule.coreEnd])
 return { ...rule, revision }
}
export async function withKintaiWorkRuleRevision<T extends KintaiWorkRule>(db: Store, rule: T): Promise<T & { revision: string }> {
 return decorate(rule, await db.systemSetting.findUnique({ where: { key: key(rule) }, select: { value: true } }))
}
export async function withKintaiWorkRuleRevisions<T extends KintaiWorkRule>(db: Store, rules: T[]): Promise<Array<T & { revision: string }>> {
 if (!rules.length) return []
 const records = await db.systemSetting.findMany({ where: { key: { in: rules.map(key) } }, select: { key: true, value: true } })
 const byKey = new Map(records.map(r => [r.key, r]))
 return rules.map(rule => decorate(rule, byKey.get(key(rule)) || null))
}
/** Caller holds organization and current-manager locks; revision and row commit together. */
export async function advanceKintaiWorkRuleRevision<T extends KintaiWorkRule>(tx: Store, rule: T): Promise<T & { revision: string }> {
 const value = JSON.stringify({ version: 1, nonce: randomUUID() })
 await tx.systemSetting.upsert({ where: { key: key(rule) }, create: { key: key(rule), value }, update: { value } })
 return withKintaiWorkRuleRevision(tx, rule)
}
export async function assertKintaiWorkRuleRevision(db: Store, rule: KintaiWorkRule, expected: string) {
 if ((await withKintaiWorkRuleRevision(db, rule)).revision !== expected) throw new KintaiWorkRuleRevisionError(409, 'この就業ルールは別の操作で変更されています。入力内容は保存されていません。最新のルールをご確認ください。')
}
