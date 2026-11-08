import type { Prisma } from '@prisma/client'
import { TOOL_ROLE_TABLES, type ToolId } from '@/lib/company-roles/tool-roles'
import { subscriberKind } from './view'
import { newPricingPriceIds, teamPriceConfig } from './prices'
import { newPricingRollout, isNewPricingEnabledFor } from './rollout'

type ToolMemberReader = {
  findFirst(args: Record<string, unknown>): Promise<{ userId: string | null } | null>
  findMany(args: Record<string, unknown>): Promise<Array<{ userId: string | null }>>
}

/** Read-only adapter for a transaction supplied by the seat coordinator.
 * This does not acquire the company guard, refresh Stripe/cache, add a link or
 * enroll anyone. Admission/effect callers must hold the shared company guard
 * and revalidate the same organization attribution before writing.
 */
type SeatScopeOwner = { id: string; email: string | null; subscriberKind: 'none' | 'legacy' | 'team' }
export interface ToolSeatOwnershipReader {
  globallyEnabled(): boolean
  enabledForOwner(email: string | null): boolean
  findLink(tool: ToolId, organizationId: string): Promise<{ companyId: string } | null>
  findCompany(companyId: string): Promise<{ id: string; owner: SeatScopeOwner } | null>
  findOwnedCompany(ownerUserId: string): Promise<{ id: string } | null>
  findPersonalOwner(tool: ToolId, organizationId: string): Promise<SeatScopeOwner | null>
}

export function createToolSeatOwnershipReader(tx: Prisma.TransactionClient): ToolSeatOwnershipReader {
  const delegates: Record<Exclude<ToolId, 'promane'>, ToolMemberReader> = {
    kintai: tx.kintaiMember as unknown as ToolMemberReader,
    hr: tx.hrOrganizationMember as unknown as ToolMemberReader,
    expense: tx.expenseMember as unknown as ToolMemberReader,
    income: tx.incomeMember as unknown as ToolMemberReader,
    quote: tx.quoteMember as unknown as ToolMemberReader,
    sfa: tx.sfaMember as unknown as ToolMemberReader,
    shodan: tx.shodanMember as unknown as ToolMemberReader,
    aio: tx.aioMember as unknown as ToolMemberReader,
    mensetsu: tx.mensetsuMember as unknown as ToolMemberReader,
    aishodan: tx.aishodanMember as unknown as ToolMemberReader,
  }
  const ownerSelect = { id: true, email: true, plan: true, stripePriceId: true } as const
  const classify = (user: { id: string; email: string | null; plan: string | null; stripePriceId: string | null }) => ({
    id: user.id,
    email: user.email,
    subscriberKind: subscriberKind({ plan: user.plan, stripePriceId: user.stripePriceId, newPriceIds: newPricingPriceIds() }),
  })
  return {
    globallyEnabled() {
      if (newPricingRollout() === 'off') return false
      // Missing configuration must neither read unready new tables nor bypass
      // the seat policy by treating it as deliberately switched off.
      if (!teamPriceConfig().ok) throw new Error('Seat configuration unavailable')
      return true
    },
    enabledForOwner: isNewPricingEnabledFor,
    async findLink(tool: ToolId, organizationId: string) {
      return tx.accountCompanyToolOrg.findUnique({
        where: { tool_organizationId: { tool, organizationId } },
        select: { companyId: true },
      })
    },
    async findCompany(companyId: string) {
      const company = await tx.accountCompany.findUnique({
        where: { id: companyId },
        select: { id: true, userId: true, user: { select: ownerSelect } },
      })
      if (!company?.user || company.userId !== company.user.id) return null
      return { id: company.id, owner: classify(company.user) }
    },
    async findOwnedCompany(ownerUserId: string) {
      return tx.accountCompany.findUnique({ where: { userId: ownerUserId }, select: { id: true } })
    },
    async findPersonalOwner(tool: ToolId, organizationId: string) {
      let creator: string | null = null
      let owners: Array<{ userId: string | null }>
      if (tool === 'promane') {
        const workspace = await tx.promaneWorkspace.findUnique({ where: { id: organizationId }, select: { userId: true } })
        creator = workspace?.userId ?? null
        if (!creator) return null
        owners = await tx.promaneMember.findMany({
          where: { workspaceId: organizationId, isActive: true, role: 'owner' },
          select: { userId: true }, take: 2,
        })
      } else {
        const delegate = delegates[tool]
        if (!delegate) return null
        const first = await delegate.findFirst({
          where: { organizationId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { userId: true },
        })
        creator = first?.userId ?? null
        if (!creator) return null
        const order = TOOL_ROLE_TABLES[tool].order
        owners = await delegate.findMany({
          where: { organizationId, status: 'ACTIVE', role: order[order.length - 1] },
          select: { userId: true }, take: 2,
        })
      }
      // A transferred organization or ambiguous current owners is not personal
      // ownership. Never bill the previous creator's company by inference.
      if (owners.length !== 1 || owners[0].userId !== creator) return null
      const user = await tx.user.findUnique({ where: { id: creator }, select: ownerSelect })
      return user ? classify(user) : null
    },
  }
}
