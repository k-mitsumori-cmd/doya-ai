import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { isMemberRowRole } from '@/lib/company-roles/roles'
import { teamSeatsForCompany, teamTablesAllowedFor } from './team.server'
import { CompanyMembershipSeatError, pinCompanyMembershipPrincipals, readCompanyMembershipLicense, requireCompanyMembershipCapacity } from './company-membership-seat.server'
import { SeatOperationError, withSeatAdmissionInTransaction, withSeatRevocation } from './seat-operation'

export class CompanyRoleSeatError extends Error {
  constructor(public readonly status: 409 | 503, public readonly code: 'NO_SEAT' | 'SEAT_OPERATION_BUSY' | 'SEAT_CONTEXT_CHANGED' | 'SEAT_CAPACITY_UNAVAILABLE') { super(code) }
}

type Change = { from: string; to: string }
type ApplySeatPolicy = <T>(change: Change, write: () => Promise<T>) => Promise<T>

/** Role authorization and event writes stay in the domain callback. New
 * operating entitlement uses strict admission; reductions/non-seat changes
 * use the revocation fence even when a financial request is unresolved.
 * This does not alter tool roles, enroll anyone or issue a provider mutation.
 */
export async function withCompanyRoleSeatChange<T>(input: {
  companyId: string; actorUserId: string; memberId: string; requested: unknown
}, work: (tx: Prisma.TransactionClient, apply: ApplySeatPolicy) => Promise<T>): Promise<T> {
  const company = await prisma.accountCompany.findUnique({
    where: { id: input.companyId }, select: { userId: true, user: { select: { email: true } } },
  })
  // Preserve the old role domain when new pricing is not enabled for its owner.
  // In particular, do not query billing/union/operation tables in that branch.
  if (!company || !teamTablesAllowedFor(company.user?.email)) {
    return prisma.$transaction(tx => work(tx, async (_change, write) => write()), { isolationLevel: 'Serializable' })
  }
  if (isMemberRowRole(input.requested) && input.requested !== 'guest') {
    const hint = await prisma.accountCompanyMember.findFirst({
      where: { id: input.memberId, companyId: input.companyId }, select: { role: true },
    })
    if (hint && (!isMemberRowRole(hint.role) || hint.role === 'guest')) {
      try { await teamSeatsForCompany(input.companyId, { refresh: true, strict: true }) }
      catch (error) {
        if (error instanceof SeatOperationError) throw new CompanyRoleSeatError(409, error.code === 'SEAT_OPERATION_BUSY' ? 'SEAT_OPERATION_BUSY' : 'SEAT_CONTEXT_CHANGED')
        throw new CompanyRoleSeatError(503, 'SEAT_CAPACITY_UNAVAILABLE')
      }
    }
  }
  try {
    return await withSeatRevocation(input.companyId, async tx => {
      await pinCompanyMembershipPrincipals(tx, { companyId: input.companyId, ownerUserId: company.userId, actorUserId: input.actorUserId })
      return work(tx, async (change, write) => {
        if (change.from !== 'guest' || change.to === 'guest') return write()
        return withSeatAdmissionInTransaction(input.companyId, tx, async () => {
          requireCompanyMembershipCapacity(await readCompanyMembershipLicense(tx, input.companyId))
          const result = await write()
          requireCompanyMembershipCapacity(await readCompanyMembershipLicense(tx, input.companyId))
          return result
        })
      })
    })
  } catch (error) {
    if (error instanceof CompanyMembershipSeatError) throw new CompanyRoleSeatError(409, error.code === 'NO_SEAT' ? 'NO_SEAT' : 'SEAT_CONTEXT_CHANGED')
    if (error instanceof SeatOperationError) throw new CompanyRoleSeatError(409, error.code === 'SEAT_OPERATION_BUSY' ? 'SEAT_OPERATION_BUSY' : 'SEAT_CONTEXT_CHANGED')
    const sql = error as { code?: string; meta?: { code?: string } }
    if (sql?.code === 'P2034' || sql?.code === 'P2010' && ['40001', '40P01'].includes(sql.meta?.code ?? '')) throw new CompanyRoleSeatError(409, 'SEAT_CONTEXT_CHANGED')
    throw error
  }
}
