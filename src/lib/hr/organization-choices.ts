import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { HrMemberRole } from './types'
export class HrOrganizationChoicesError extends Error { constructor(public status: number) { super('Organization choices could not be confirmed') } }
/** A complete actor-bound snapshot, split into bounded lossless packets. */
export async function readHrOrganizationChoicesPage(db: PrismaClient, actor: string, cursor: string | null) {
  let requested: { revision: string; offset: number } | null = null
  if (cursor !== null) {
    try {
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) throw Error()
      const v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
      if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== 'offset,revision' || !/^[a-f0-9]{64}$/.test(v.revision) || !Number.isSafeInteger(v.offset) || v.offset <= 0) throw Error()
      requested = v
    } catch { throw new HrOrganizationChoicesError(400) }
  }
  return db.$transaction(async tx => {
    const memberships = await tx.hrOrganizationMember.findMany({
      where: { userId: actor, status: 'ACTIVE', role: { in: Object.values(HrMemberRole) } },
      select: { id: true, organizationId: true, role: true, organization: { select: { name: true } } }, orderBy: { id: 'asc' },
    })
    const serialized = JSON.stringify(memberships.map(m => ({ organizationId: m.organizationId, memberId: m.id, role: m.role, name: m.organization.name })))
    const revision = createHash('sha256').update(JSON.stringify([actor, serialized])).digest('hex')
    if (requested && requested.revision !== revision) throw new HrOrganizationChoicesError(409)
    const offset = requested?.offset ?? 0
    if (offset >= serialized.length || offset % 8192 !== 0) throw new HrOrganizationChoicesError(400)
    const chunk = serialized.slice(offset, offset + 8192), nextOffset = offset + chunk.length
    return { success: true, format: 'hr-organization-choices-v1', actor, revision, totalCharacters: serialized.length, offset, chunk,
      nextCursor: nextOffset < serialized.length ? Buffer.from(JSON.stringify({ revision, offset: nextOffset })).toString('base64url') : null }
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 30000 })
}
