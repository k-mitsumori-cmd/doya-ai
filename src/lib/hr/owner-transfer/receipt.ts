import { validLifecycleDigest } from '@/lib/account-lifecycle/state'
import {
  assertOwnerTransferIdentity, exactObject, ownerTransferInputDigest, ownerTransferKey,
  OwnerTransferError, type OwnerTransferIdentity, type OwnerTransferInput,
} from './types'

export type OwnerTransferReceipt = {
  version: 1
  identity: OwnerTransferIdentity
  input: OwnerTransferInput | null
  inputDigest: string | null
  phase: 'committed' | 'canceled'
  createdAt: string
}

const fail = (): never => { throw new OwnerTransferError('OWNER_TRANSFER_STATE_UNAVAILABLE') }
export function readOwnerTransferReceipt(raw: string, identity: OwnerTransferIdentity): OwnerTransferReceipt {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4096) return fail()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return fail() }
  if (!exactObject(value, 'version,identity,input,inputDigest,phase,createdAt') || value.version !== 1 ||
      !['committed', 'canceled'].includes(value.phase as string) ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      new Date(value.createdAt).toISOString() !== value.createdAt) return fail()
  try { assertOwnerTransferIdentity(value.identity) } catch { return fail() }
  if (ownerTransferKey(value.identity) !== ownerTransferKey(identity) ||
      value.identity.service !== identity.service || value.identity.organizationId !== identity.organizationId ||
      value.identity.actorUserId !== identity.actorUserId || value.identity.operationId !== identity.operationId) return fail()
  if (value.phase === 'canceled') {
    if (value.input !== null || value.inputDigest !== null) return fail()
  } else {
    try {
      if (!value.input || !validLifecycleDigest(value.inputDigest) ||
          ownerTransferInputDigest(identity, value.input as OwnerTransferInput) !== value.inputDigest) return fail()
    } catch { return fail() }
  }
  return value as OwnerTransferReceipt
}
