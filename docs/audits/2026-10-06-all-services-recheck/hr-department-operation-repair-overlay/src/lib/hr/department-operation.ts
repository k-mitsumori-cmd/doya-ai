import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import type { DepartmentInput } from '@/lib/hr/department-input'

export type DepartmentOperation = { operationId: string; organizationId: string }
export type DepartmentCreationSnapshot = {
  id: string; name: string; code: string | null; parentId: string | null
  managerId: string | null; sortOrder: number; isActive: boolean
}
export type DepartmentOperationState =
  | { state: 'not_received' | 'canceled' | 'deleted' }
  | { state: 'created'; department: DepartmentCreationSnapshot }
export class DepartmentOperationConflict extends Error {}
const operationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export function validDepartmentOperationId(value: unknown): value is string {
  return typeof value === 'string' && operationPattern.test(value)
}

/** Both headers must be present for opt-in; old callers retain their existing contract. */
export function readDepartmentOperation(request: Request): DepartmentOperation | null | false {
  const operationId = request.headers?.get('x-hr-department-operation') ?? null
  const organizationId = request.headers?.get('x-hr-organization-id') ?? null
  if (operationId === null && organizationId === null) return null
  if (!validDepartmentOperationId(operationId) || typeof organizationId !== 'string' || !organizationId) return false
  return { operationId, organizationId }
}
function key(ctx: HrContext, operationId: string) {
  return 'hr-dept-create-v1:' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex')
}
export function departmentCreationFingerprint(input: DepartmentInput): string {
  return createHash('sha256').update(JSON.stringify([
    input.name, input.code || null, input.parentId || null, input.managerId || null, input.sortOrder ?? 0, true,
  ])).digest('hex')
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function snapshot(value: unknown): DepartmentCreationSnapshot {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() ||
    !['code', 'parentId', 'managerId'].every(k => value[k] === null || typeof value[k] === 'string') ||
    !Number.isInteger(value.sortOrder) || (value.sortOrder as number) < -2147483648 || (value.sortOrder as number) > 2147483647 ||
    typeof value.isActive !== 'boolean') throw new Error('Invalid department receipt')
  return { id: value.id, name: value.name, code: value.code as string | null, parentId: value.parentId as string | null,
    managerId: value.managerId as string | null, sortOrder: value.sortOrder as number, isActive: value.isActive }
}

/** Call only inside runHrDepartmentMutation, after the organization/member locks. */
export async function readDepartmentCreationReceipt(
  tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, fingerprint?: string,
): Promise<DepartmentOperationState> {
  const receipt = await tx.hrAuditLog.findUnique({ where: { id: key(ctx, operationId) } })
  if (!receipt) return { state: 'not_received' }
  const details = receipt.details
  if (receipt.organizationId !== ctx.organizationId || receipt.userId !== ctx.userId || !object(details) ||
    details.version !== 1 || details.operationId !== operationId) throw new Error('Invalid department receipt')
  if (receipt.action === 'DEPARTMENT_CREATE_CANCELED' && details.state === 'canceled') return { state: 'canceled' }
  if (receipt.action !== 'DEPARTMENT_CREATED' || details.state !== 'created' ||
    typeof details.fingerprint !== 'string') throw new Error('Invalid department receipt')
  if (fingerprint !== undefined && details.fingerprint !== fingerprint) throw new DepartmentOperationConflict()
  const department = snapshot(details.department)
  if (receipt.targetId !== department.id) throw new Error('Invalid department receipt')
  const current = await tx.hrDepartment.findFirst({ where: { id: department.id, organizationId: ctx.organizationId }, select: { id: true } })
  return current ? { state: 'created', department } : { state: 'deleted' }
}

export async function saveDepartmentCreationReceipt(
  tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, fingerprint: string,
  department: DepartmentCreationSnapshot,
): Promise<void> {
  const confirmed = snapshot(department)
  await tx.hrAuditLog.create({ data: {
    id: key(ctx, operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'DEPARTMENT_CREATED', target: '部署', targetId: confirmed.id,
    details: { version: 1, operationId, state: 'created', fingerprint, department: confirmed },
  } })
}

/** A persisted cancellation fence prevents an old delayed POST from creating after cancellation. */
export async function cancelDepartmentCreation(
  tx: Prisma.TransactionClient, ctx: HrContext, operationId: string,
): Promise<DepartmentOperationState> {
  const state = await readDepartmentCreationReceipt(tx, ctx, operationId)
  if (state.state !== 'not_received') return state
  await tx.hrAuditLog.create({ data: {
    id: key(ctx, operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'DEPARTMENT_CREATE_CANCELED', target: '部署',
    details: { version: 1, operationId, state: 'canceled' },
  } })
  return { state: 'canceled' }
}
