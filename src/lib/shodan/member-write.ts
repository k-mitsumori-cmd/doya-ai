import { prisma } from '@/lib/prisma'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { assertHistoricalShodanMemberWritable, assertRetirementMembershipWritable, lockLifecycleUsers } from '@/lib/account-lifecycle/store'
import { ROLE_HIERARCHY, type ShodanContext } from './types'

type Member = { id: string; userId: string | null; role: string; status: string; inviteEmail: string | null; inviteToken: string | null; createdAt: Date }
const select = { id: true, userId: true, role: true, status: true, inviteEmail: true, inviteToken: true, createdAt: true } as const
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0
const knownRole = (role: string) => Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, role)
const signature = (rows: Member[]) => JSON.stringify(rows.map(row => [row.id, row.userId, row.role, row.status, row.inviteEmail, row.inviteToken, row.createdAt]))
const changed = () => new LifecycleError('LIFECYCLE_PARTICIPANTS_CHANGED')
const unavailable = () => new LifecycleError('LIFECYCLE_STATE_UNAVAILABLE')

/** Role edits/removals only; this never creates, activates or accepts an invitation. */
export async function mutateShodanMember(ctx: ShodanContext, targetId: string, action: 'update' | 'delete', role?: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const where = { organizationId: ctx.organizationId, OR: [{ role: 'owner' }, { id: ctx.memberId }, { id: targetId }] }
    const discovered = await prisma.shodanMember.findMany({ where, select, orderBy: { id: 'asc' } })
    const discoveredActor = discovered.find(row => row.id === ctx.memberId && row.userId === ctx.userId && row.status === 'ACTIVE' && ['owner', 'admin'].includes(row.role))
    const discoveredTarget = discovered.find(row => row.id === targetId)
    const historicalCandidate = discoveredActor && discoveredTarget && discoveredTarget.status === 'INACTIVE'
      && discoveredTarget.userId && discoveredTarget.userId !== ctx.userId && discoveredTarget.role !== 'owner'
      && discoveredTarget.id !== discoveredActor.id && knownRole(discoveredTarget.role) && rank(discoveredTarget.role) < rank(discoveredActor.role)
      && !discovered.some(row => row.role === 'owner' && row.userId === discoveredTarget.userId)
      ? discoveredTarget.userId : null
    const historicalUserId = historicalCandidate && !await prisma.user.findUnique({ where: { id: historicalCandidate }, select: { id: true } }) ? historicalCandidate : null
    const users = [...new Set([ctx.userId, ...discovered.flatMap(row => row.userId && !(row.id === targetId && row.userId === historicalUserId) ? [row.userId] : [])])].sort()
    try {
      return await prisma.$transaction(async tx => {
        await lockLifecycleUsers(tx, users)
        const organizations = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM shodan_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
        if (organizations.length !== 1) return { kind: 'missing' as const }
        await tx.$queryRaw`SELECT id FROM shodan_members WHERE "organizationId" = ${ctx.organizationId}
          AND (role = 'owner' OR id IN (${ctx.memberId}, ${targetId})) ORDER BY id FOR UPDATE`
        const current = await tx.shodanMember.findMany({ where, select, orderBy: { id: 'asc' } })
        if (signature(current) !== signature(discovered)) throw changed()
        const currentActor = current.find(row => row.id === ctx.memberId && row.userId === ctx.userId && row.status === 'ACTIVE' && ['owner', 'admin'].includes(row.role))
        if (!currentActor) return { kind: 'forbidden' as const }
        const currentTarget = current.find(row => row.id === targetId)
        if (!currentTarget) return { kind: 'missing' as const }
        if (currentTarget.role === 'owner') return { kind: 'owner' as const }
        if (currentTarget.id === currentActor.id) return { kind: 'self' as const }
        if (!knownRole(currentTarget.role) || rank(currentTarget.role) >= rank(currentActor.role)) return { kind: 'peer' as const }
        const owners = current.filter(row => row.role === 'owner')
        if (owners.length !== 1 || owners[0].status !== 'ACTIVE' || !owners[0].userId) throw unavailable()
        if (!['ACTIVE', 'PENDING', 'INACTIVE'].includes(currentTarget.status) || currentTarget.status === 'ACTIVE' && !currentTarget.userId) throw unavailable()
        // Unbound pending/historical rows have no User to lock. These operations never activate them.
        await assertRetirementMembershipWritable(tx, users)
        if (historicalUserId) await assertHistoricalShodanMemberWritable(tx, historicalUserId)
        if (action === 'update') {
          if (!role || !['member', 'manager', 'admin'].includes(role) || rank(role) >= rank(currentActor.role)) return { kind: 'role' as const }
          const member = await tx.shodanMember.update({ where: { id: currentTarget.id, organizationId: ctx.organizationId }, data: { role } })
          return { kind: 'updated' as const, member }
        }
        await tx.shodanMember.delete({ where: { id: currentTarget.id, organizationId: ctx.organizationId } })
        return { kind: 'deleted' as const }
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2034' && code !== 'LIFECYCLE_PARTICIPANTS_CHANGED') throw error
      if (attempt === 3) throw changed()
    }
  }
  throw changed()
}
