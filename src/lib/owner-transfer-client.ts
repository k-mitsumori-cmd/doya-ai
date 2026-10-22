import type { OwnerTransferInput, OwnerTransferService } from './owner-transfer/types'

export type OwnerTransferHandle = {
  version: 1
  service: OwnerTransferService
  actorId: string
  organizationId: string
  organizationSlug: string
  operationId: string
}
export type OwnerTransferCandidate = { memberId: string; userId: string; name: string | null; role: 'admin' | 'manager' | 'member'; plan: string }
export type OwnerTransferCandidates = {
  actorId: string
  service: OwnerTransferService
  organization: { id: string; slug: string; name: string }
  owner: { memberId: string; userId: string }
  candidates: OwnerTransferCandidate[]
}
export type OwnerTransferResult = {
  actorId: string; service: OwnerTransferService; organizationId: string; operationId: string
  phase: 'missing' | 'canceled' | 'committed'; input: OwnerTransferInput | null; createdAt: string | null
}
export type OwnerTransferRejection = 'OWNER_TRANSFER_CONFIRMATION_CHANGED' | 'OWNER_TRANSFER_PARTICIPANTS_CHANGED' |
  'OWNER_TRANSFER_ORG_UNAVAILABLE' | 'OWNER_TRANSFER_OWNER_REQUIRED' | 'OWNER_TRANSFER_INPUT_CONFLICT' |
  'INVALID_OWNER_TRANSFER_INPUT' | 'ACCOUNT_RETIREMENT_IN_PROGRESS'
const definitiveRejections: OwnerTransferRejection[] = [
  'OWNER_TRANSFER_CONFIRMATION_CHANGED', 'OWNER_TRANSFER_PARTICIPANTS_CHANGED',
  'OWNER_TRANSFER_ORG_UNAVAILABLE', 'OWNER_TRANSFER_OWNER_REQUIRED', 'OWNER_TRANSFER_INPUT_CONFLICT',
  'INVALID_OWNER_TRANSFER_INPUT', 'ACCOUNT_RETIREMENT_IN_PROGRESS',
]

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: string) => Object.keys(value).sort().join(',') === expected.split(',').sort().join(',')
const iso = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const planLabels: Record<string, string> = {
  GUEST: 'ゲスト', FREE: '無料', LIGHT: 'ライト', LIGHT_MONTHLY: 'ライト', BANNER_LIGHT: 'ライト',
  PRO: 'プロ', PRO_MONTHLY: 'プロ', BANNER_PRO: 'プロ', BUNDLE: 'プロ', BASIC: 'プロ',
  STARTER: 'プロ', BUSINESS: 'プロ', PREMIUM: 'プロ',
  ENTERPRISE: 'エンタープライズ', ENTERPRISE_MONTHLY: 'エンタープライズ', BANNER_ENTERPRISE: 'エンタープライズ',
}
/** Preserve the raw User.plan in the operation; only its known display tier is localized. */
export const ownerTransferPlanLabel = (raw: string): string | null =>
  planLabels[raw.trim().toUpperCase().replace(/-/g, '_')] ?? null
export const ownerTransferSlot = (service: OwnerTransferService, actorId: string, slug: string) =>
  `doya-owner-transfer-handle:v1:${encodeURIComponent(service)}:${encodeURIComponent(actorId)}:${encodeURIComponent(slug)}`
export const ownerTransferLock = (service: OwnerTransferService, actorId: string, slug: string) =>
  `doya-owner-transfer-lock:v1:${service}:${actorId}:${slug}`

export function readOwnerTransferHandle(storage: Pick<Storage, 'getItem'>, service: OwnerTransferService, actorId: string, slug: string): OwnerTransferHandle | null {
  const raw = storage.getItem(ownerTransferSlot(service, actorId, slug))
  if (raw === null) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw Error('保存済みの操作を確認できません。') }
  if (!record(value) || Object.keys(value).sort().join(',') !== 'actorId,operationId,organizationId,organizationSlug,service,version' ||
      value.version !== 1 || value.service !== service || value.actorId !== actorId || value.organizationSlug !== slug ||
      typeof value.organizationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.organizationId) || !uuid.test(String(value.operationId))) {
    throw Error('保存済みの操作を確認できません。')
  }
  return value as OwnerTransferHandle
}

export function saveOwnerTransferHandle(storage: Pick<Storage, 'getItem' | 'setItem'>, handle: OwnerTransferHandle) {
  const key = ownerTransferSlot(handle.service, handle.actorId, handle.organizationSlug)
  storage.setItem(key, JSON.stringify(handle))
  const read = readOwnerTransferHandle(storage, handle.service, handle.actorId, handle.organizationSlug)
  if (!read || read.operationId !== handle.operationId || read.organizationId !== handle.organizationId) throw Error('操作IDを保存できませんでした。')
}

export function clearOwnerTransferHandle(storage: Pick<Storage, 'getItem' | 'removeItem'>, handle: OwnerTransferHandle) {
  const read = readOwnerTransferHandle(storage, handle.service, handle.actorId, handle.organizationSlug)
  if (!read || read.operationId !== handle.operationId) throw Error('保存済みの操作が変更されました。')
  storage.removeItem(ownerTransferSlot(handle.service, handle.actorId, handle.organizationSlug))
}

export function parseOwnerTransferResult(value: unknown, handle: OwnerTransferHandle): OwnerTransferResult {
  if (!record(value) || !keys(value, 'actorId,service,organizationId,operationId,phase,input,createdAt') ||
      value.actorId !== handle.actorId || value.service !== handle.service ||
      value.organizationId !== handle.organizationId || value.operationId !== handle.operationId ||
      !['missing', 'canceled', 'committed'].includes(String(value.phase)) ||
      (value.phase === 'missing' ? value.input !== null || value.createdAt !== null : !iso(value.createdAt)) ||
      (value.phase === 'canceled' && value.input !== null) ||
      (value.phase === 'committed' && (!record(value.input) ||
        !keys(value.input, 'expectedOwnerMemberId,targetMemberId,targetUserId,targetRole,targetPlan') ||
        ['expectedOwnerMemberId', 'targetMemberId', 'targetUserId', 'targetPlan'].some(key =>
          typeof (value.input as Record<string, unknown>)[key] !== 'string') ||
        !['admin', 'manager', 'member'].includes(String(value.input.targetRole))))) throw Error('操作結果の対象を確認できません。')
  return value as OwnerTransferResult
}

/** A rejection is actionable only when the server binds it to the saved operation. */
export function parseOwnerTransferRejection(value: unknown, handle: OwnerTransferHandle, status: number): OwnerTransferRejection {
  if (status < 400 || status >= 500 || !record(value) ||
      !keys(value, 'code,error,actorId,service,organizationId,operationId') ||
      value.actorId !== handle.actorId || value.service !== handle.service ||
      value.organizationId !== handle.organizationId || value.operationId !== handle.operationId ||
      typeof value.error !== 'string' || !definitiveRejections.includes(value.code as OwnerTransferRejection)) {
    throw Error('拒否結果の対象を確認できません。')
  }
  return value.code as OwnerTransferRejection
}

export function parseOwnerTransferCandidates(value: unknown, service: OwnerTransferService, actorId: string, slug: string, expectedOrgId?: string): OwnerTransferCandidates {
  if (!record(value) || !keys(value, 'actorId,service,organization,owner,candidates') ||
      value.actorId !== actorId || value.service !== service || !record(value.organization) ||
      !keys(value.organization, 'id,slug,name') || value.organization.slug !== slug ||
      typeof value.organization.id !== 'string' || typeof value.organization.name !== 'string' ||
      expectedOrgId && value.organization.id !== expectedOrgId || !record(value.owner) ||
      !keys(value.owner, 'memberId,userId') || value.owner.userId !== actorId ||
      typeof value.owner.memberId !== 'string' || !Array.isArray(value.candidates) ||
      value.candidates.length > 60 || value.candidates.some(candidate => !record(candidate) ||
        !keys(candidate, 'memberId,userId,name,role,plan') ||
        typeof candidate.memberId !== 'string' || typeof candidate.userId !== 'string' || candidate.userId === actorId ||
        candidate.name !== null && typeof candidate.name !== 'string' ||
        !['admin', 'manager', 'member'].includes(String(candidate.role)) ||
        typeof candidate.plan !== 'string' || ownerTransferPlanLabel(candidate.plan) === null)) {
    throw Error('後任候補を確認できません。')
  }
  return value as OwnerTransferCandidates
}

/** A single finite transport deadline spans response headers and JSON body. */
export async function ownerTransferRequest(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(Error('通信結果を確認できません。')) }, 15000)
  })
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
        const body = await response.json()
        return { status: response.status, body }
      })(), deadline,
    ])
  } finally { if (timer) clearTimeout(timer); controller.abort() }
}
