import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { ToolId } from './tool-roles'

/** A company-scoped opt-out is independent of billing attribution. Its presence
 * blocks only inferred role linking to that company, never explicit relinking.
 * No timestamps/expiry or user-provided JSON can silently remove this choice. */
export function automaticLinkOptOutKey(companyId: string, tool: ToolId, organizationId: string) {
  return 'company-tool-auto-link-opt-out:v1:' + createHash('sha256')
    .update(JSON.stringify([companyId, tool, organizationId])).digest('hex')
}
type Reader = Pick<Prisma.TransactionClient, 'systemSetting'>
export async function automaticLinkOptedOut(tx: Reader, companyId: string, tool: ToolId, organizationId: string) {
  return !!(await tx.systemSetting.findUnique({
    where: { key: automaticLinkOptOutKey(companyId, tool, organizationId) }, select: { key: true },
  }))
}
export async function suppressAutomaticLink(tx: Reader, companyId: string, tool: ToolId, organizationId: string) {
  const key = automaticLinkOptOutKey(companyId, tool, organizationId)
  await tx.systemSetting.upsert({ where: { key }, create: { key, value: 'blocked-v1' }, update: { value: 'blocked-v1' } })
}
export async function clearAutomaticLinkOptOut(tx: Reader, companyId: string, tool: ToolId, organizationId: string) {
  await tx.systemSetting.deleteMany({ where: { key: automaticLinkOptOutKey(companyId, tool, organizationId) } })
}
