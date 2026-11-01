import type { Prisma } from '@prisma/client'
import { SfaMutationError } from './mutation-authority'
import { sfaRecordWhere, type SfaRecordScope } from './record-policy'

type RelationKind = 'account' | 'contact' | 'deal'
type RelationIds = { accountId?: string | null; contactId?: string | null; dealId?: string | null }

/** Linking a record never grants access to a private related record. */
export async function redactSfaRelations<T extends RelationIds>(tx: Prisma.TransactionClient, scope: SfaRecordScope, rows: readonly T[]): Promise<T[]> {
  const accountIds = [...new Set(rows.map(row => row.accountId).filter((id): id is string => Boolean(id)))]
  const contactIds = [...new Set(rows.map(row => row.contactId).filter((id): id is string => Boolean(id)))]
  const dealIds = [...new Set(rows.map(row => row.dealId).filter((id): id is string => Boolean(id)))]
  const [accounts, contacts, deals] = await Promise.all([
    accountIds.length ? tx.sfaAccount.findMany({ where: sfaRecordWhere(scope, 'account', false, { id: { in: accountIds } }), select: { id: true } }) : [],
    contactIds.length ? tx.sfaContact.findMany({ where: sfaRecordWhere(scope, 'contact', false, { id: { in: contactIds } }), select: { id: true } }) : [],
    dealIds.length ? tx.sfaDeal.findMany({ where: sfaRecordWhere(scope, 'deal', false, { id: { in: dealIds } }), select: { id: true } }) : [],
  ])
  const visible = { accountId: new Set(accounts.map(row => row.id)), contactId: new Set(contacts.map(row => row.id)), dealId: new Set(deals.map(row => row.id)) }
  return rows.map(row => {
    const safe = { ...row }
    for (const key of ['accountId', 'contactId', 'dealId'] as const) {
      if (key in row && row[key] && !visible[key].has(row[key]!)) safe[key] = null
    }
    return safe
  })
}
export async function redactSfaRelation<T extends RelationIds>(tx: Prisma.TransactionClient, scope: SfaRecordScope, row: T | null): Promise<T | null> {
  return row ? (await redactSfaRelations(tx, scope, [row]))[0] : null
}

/** A relation is checked after locking; activities that update a deal request its write lock. */
export async function lockSfaRecordRelation(tx: Prisma.TransactionClient, scope: SfaRecordScope, kind: RelationKind, id: string, write = false): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new SfaMutationError(400, '関連先の指定が正しくありません。')
  const org = scope.actor.organizationId
  const locked = kind === 'account'
    ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_accounts WHERE id = ${id} AND "organizationId" = ${org} FOR SHARE`
    : kind === 'contact'
      ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_contacts WHERE id = ${id} AND "organizationId" = ${org} FOR SHARE`
      : write
        ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_deals WHERE id = ${id} AND "organizationId" = ${org} FOR UPDATE`
        : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_deals WHERE id = ${id} AND "organizationId" = ${org} FOR SHARE`
  if (!locked.some(row => row.id === id)) throw new SfaMutationError(404, '関連先が見つかりません。画面を更新して選び直してください。')
  const row = kind === 'account'
    ? await tx.sfaAccount.findFirst({ where: sfaRecordWhere(scope, 'account', write, { id }), select: { id: true } })
    : kind === 'contact'
      ? await tx.sfaContact.findFirst({ where: sfaRecordWhere(scope, 'contact', write, { id }), select: { id: true } })
      : await tx.sfaDeal.findFirst({ where: sfaRecordWhere(scope, 'deal', write, { id }), select: { id: true } })
  if (!row) throw new SfaMutationError(404, '関連先が見つかりません。画面を更新して選び直してください。')
  return row.id
}
