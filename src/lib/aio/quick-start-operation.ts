import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Identity = { userId: string; operationId: string }
type Phase = 'ready' | 'pending' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'linked'
type Receipt = Identity & { version: 1; hostHash: string; phase: Phase; at: string; token: string | null; organizationId: string | null; linkedId: string | null; code: string | null }
type Db = Pick<typeof prisma, '$transaction'>
export const AIO_QUICK_START_LEASE_MS = 10 * 60 * 1000
export const AIO_MAX_WORKSPACES = 20
const knownMemberRole = (role: string) => ['owner', 'admin', 'manager', 'member'].includes(role)
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const hash = (v: string) => createHash('sha256').update(v).digest('hex')
const prefix = (userId: string) => 'aio-start:v1:' + hash(userId) + ':'
const key = (i: Identity) => prefix(i.userId) + i.operationId
const activePrefix = (userId: string) => 'aio-start-active:v1:' + hash(userId) + ':'
const activeKey = (r: Receipt) => activePrefix(r.userId) + r.hostHash
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
export class AioStartError extends Error {
  constructor(readonly code: string, readonly status = 409) { super('開始処理の保存状況を確認してください。') }
}
function identity(i: Identity) {
  if (!id(i?.userId) || typeof i.operationId !== 'string' || !uuid.test(i.operationId)) throw new AioStartError('INVALID_OPERATION', 400)
  return i
}
export function aioHostHash(url: string) {
  let host: string
  try { const u = new URL(url); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); host = u.hostname.toLowerCase().replace(/^www\./, '') } catch { throw new AioStartError('INVALID_URL', 400) }
  if (!host || !host.includes('.')) throw new AioStartError('INVALID_URL', 400)
  return hash(host)
}
function matchesBrandUrl(url: string | null | undefined, expected: string) {
  try { return !!url && aioHostHash(url) === expected } catch { return false }
}
function parse(raw: string, i: Identity): Receipt {
  try {
    if (Buffer.byteLength(raw) > 4096) throw new Error()
    const r: Receipt = JSON.parse(raw)
    identity(r)
    if (r.version !== 1 || r.userId !== i.userId || r.operationId !== i.operationId || !/^[a-f0-9]{64}$/.test(r.hostHash)
      || !['ready', 'pending', 'cancelling', 'completed', 'failed', 'cancelled', 'linked'].includes(r.phase)
      || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at))
      || (r.token !== null && (typeof r.token !== 'string' || !uuid.test(r.token)))
      || (r.organizationId !== null && !id(r.organizationId))
      || (r.linkedId !== null && (typeof r.linkedId !== 'string' || !uuid.test(r.linkedId) || r.linkedId === r.operationId))
      || (r.code !== null && !['GENERATION_FAILED', 'EXPIRED', 'WORKSPACE_LIMIT'].includes(r.code))) throw new Error()
    if ((r.phase === 'pending' || r.phase === 'cancelling') !== (r.token !== null)) throw new Error()
    if ((r.phase === 'completed') !== (r.organizationId !== null)) throw new Error()
    if ((r.phase === 'linked') !== (r.linkedId !== null)) throw new Error()
    if ((r.phase === 'failed') !== (r.code !== null)) throw new Error()
    return r
  } catch { throw new AioStartError('INVALID_RECEIPT') }
}
async function read(tx: Prisma.TransactionClient, i: Identity) {
  const row = await tx.systemSetting.findUnique({ where: { key: key(i) }, select: { value: true } })
  return row ? parse(row.value, i) : null
}
async function write(tx: Prisma.TransactionClient, r: Receipt) {
  const value = JSON.stringify(r); parse(value, r)
  await tx.systemSetting.upsert({ where: { key: key(r) }, create: { key: key(r), value }, update: { value } })
}
async function transaction<T>(i: Identity, db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  identity(i)
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${i.userId} FOR UPDATE`
    if (rows.length !== 1) throw new AioStartError('ACTOR_UNAVAILABLE', 401)
    return fn(tx)
  }, options)
}
async function terminal(tx: Prisma.TransactionClient, r: Receipt, phase: 'failed' | 'cancelled', code: Receipt['code']) {
  const next: Receipt = { ...r, phase, code, token: null }
  await write(tx, next)
  await tx.systemSetting.deleteMany({ where: { key: activeKey(r), value: key(r) } })
  return next
}
async function expire(tx: Prisma.TransactionClient, r: Receipt, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new AioStartError('INVALID_OPERATION', 400)
  if (r.phase !== 'pending' && r.phase !== 'cancelling') return r
  const pointer = await tx.systemSetting.findUnique({ where: { key: activeKey(r) }, select: { value: true } })
  if (pointer?.value !== key(r)) throw new AioStartError('INVALID_RECEIPT')
  return now.getTime() - Date.parse(r.at) < AIO_QUICK_START_LEASE_MS ? r
    : terminal(tx, r, r.phase === 'cancelling' ? 'cancelled' : 'failed', r.phase === 'cancelling' ? null : 'EXPIRED')
}
async function canonical(tx: Prisma.TransactionClient, r: Receipt, now: Date) {
  if (r.phase === 'linked') {
    const root = await read(tx, { userId: r.userId, operationId: r.linkedId! })
    if (!root || root.phase === 'linked' || root.hostHash !== r.hostHash) throw new AioStartError('INVALID_RECEIPT')
    return expire(tx, root, now)
  }
  return expire(tx, r, now)
}
async function result(tx: Prisma.TransactionClient, i: Identity, r: Receipt | null, state?: string) {
  let slug: string | null = null
  if (r?.phase === 'completed') {
    const member = await tx.aioMember.findFirst({ where: { organizationId: r.organizationId!, userId: i.userId, status: 'ACTIVE' }, include: { organization: { include: { profile: true } } } })
    if (!member || !knownMemberRole(member.role) || !matchesBrandUrl(member.organization.profile?.brandUrl, r.hostHash)) throw new AioStartError('RESULT_UNAVAILABLE', 410)
    slug = member.organization.slug
  }
  return { operationId: i.operationId, state: state || r?.phase || 'missing', organizationId: r?.organizationId || null, slug, code: r?.code || null }
}
async function memberships(tx: Prisma.TransactionClient, userId: string) {
  return tx.aioMember.findMany({ where: { userId, status: 'ACTIVE' }, include: { organization: { include: { profile: true } } }, orderBy: { createdAt: 'desc' } })
}
async function held(tx: Prisma.TransactionClient, i: Identity, now: Date, exclude?: string) {
  const pointers = await tx.systemSetting.findMany({ where: { key: { startsWith: activePrefix(i.userId) } }, take: AIO_MAX_WORKSPACES + 1 })
  if (pointers.length > AIO_MAX_WORKSPACES) throw new AioStartError('INVALID_RECEIPT')
  let count = 0
  for (const pointer of pointers) {
    if (!pointer.value.startsWith(prefix(i.userId))) throw new AioStartError('INVALID_RECEIPT')
    const other = await read(tx, { userId: i.userId, operationId: pointer.value.slice(prefix(i.userId).length) })
    if (!other || pointer.key !== activeKey(other) || !['pending', 'cancelling'].includes(other.phase)) throw new AioStartError('INVALID_RECEIPT')
    const current = await expire(tx, other, now)
    if (current.operationId !== exclude && ['pending', 'cancelling'].includes(current.phase)) count++
  }
  return count
}
export async function beginAioQuickStart(input: Identity & { url: string }, db: Db = prisma, now = new Date()) {
  const i = identity(input), hostHash = aioHostHash(input.url)
  return transaction(i, db, async tx => {
    let r = await read(tx, i)
    if (r?.phase === 'cancelled' && r.hostHash === hash('cancelled-before-start')) return result(tx, i, r)
    if (r && r.hostHash !== hostHash) throw new AioStartError('INPUT_CHANGED')
    if (r && r.phase !== 'ready') return result(tx, i, await canonical(tx, r, now))
    r ||= { ...i, version: 1, hostHash, phase: 'ready', at: now.toISOString(), token: null, organizationId: null, linkedId: null, code: null }
    const rows = await memberships(tx, i.userId)
    const matched = rows.find(m => knownMemberRole(m.role) && matchesBrandUrl(m.organization.profile?.brandUrl, hostHash))
    if (matched) {
      r = { ...r, phase: 'completed', organizationId: matched.organizationId }
      await write(tx, r); return result(tx, i, r)
    }
    const reserved = await held(tx, i, now)
    const pointer = await tx.systemSetting.findUnique({ where: { key: activeKey(r) }, select: { value: true } })
    if (pointer) {
      if (!pointer.value.startsWith(prefix(i.userId))) throw new AioStartError('INVALID_RECEIPT')
      const linkedId = pointer.value.slice(prefix(i.userId).length), root = await read(tx, { userId: i.userId, operationId: linkedId })
      if (!root || root.hostHash !== hostHash || !['pending', 'cancelling'].includes(root.phase)) throw new AioStartError('INVALID_RECEIPT')
      r = { ...r, phase: 'linked', linkedId }; await write(tx, r); return result(tx, i, root)
    }
    if (rows.length >= AIO_MAX_WORKSPACES) return result(tx, i, await terminal(tx, r, 'failed', 'WORKSPACE_LIMIT'))
    if (rows.length + reserved >= AIO_MAX_WORKSPACES) { await write(tx, r); return result(tx, i, r, 'busy') }
    r = { ...r, phase: 'pending', at: now.toISOString(), token: randomUUID() }
    await write(tx, r)
    await tx.systemSetting.create({ data: { key: activeKey(r), value: key(r) } })
    return { ...await result(tx, i, r, 'started'), leaseToken: r.token }
  })
}
export async function recoverAioQuickStart(input: Identity, cancel = false, db: Db = prisma, now = new Date()) {
  const i = identity(input)
  return transaction(i, db, async tx => {
    const previous = await read(tx, i)
    if (!previous) {
      if (!cancel) return result(tx, i, null)
      const tombstone: Receipt = { ...i, version: 1, hostHash: hash('cancelled-before-start'), phase: 'cancelled', at: now.toISOString(), token: null, organizationId: null, linkedId: null, code: null }
      await write(tx, tombstone); return result(tx, i, tombstone)
    }
    let r = await canonical(tx, previous, now)
    if (cancel && r.phase === 'ready') r = await terminal(tx, r, 'cancelled', null)
    else if (cancel && r.phase === 'pending') { r = { ...r, phase: 'cancelling' }; await write(tx, r) }
    return result(tx, i, r)
  })
}
export async function finishAioQuickStart(input: Identity & { leaseToken: string }, save: (tx: Prisma.TransactionClient) => Promise<{ id: string }>, db: Db = prisma, now = new Date()) {
  const i = identity(input)
  return transaction(i, db, async tx => {
    let r = await read(tx, i)
    if (!r || r.phase === 'linked') throw new AioStartError('OPERATION_MISSING')
    r = await expire(tx, r, now)
    if (['pending', 'cancelling'].includes(r.phase) && r.token !== input.leaseToken) throw new AioStartError('LEASE_CHANGED')
    if (r.phase === 'cancelling') return result(tx, i, await terminal(tx, r, 'cancelled', null))
    if (r.phase !== 'pending') return result(tx, i, r)
    if (r.token !== input.leaseToken) throw new AioStartError('LEASE_CHANGED')
    const rows = await memberships(tx, i.userId)
    const matched = rows.find(m => knownMemberRole(m.role) && matchesBrandUrl(m.organization.profile?.brandUrl, r!.hostHash))
    if (!matched && rows.length + await held(tx, i, now, i.operationId) >= AIO_MAX_WORKSPACES) return result(tx, i, await terminal(tx, r, 'failed', 'WORKSPACE_LIMIT'))
    const organization = matched?.organization || await save(tx)
    r = { ...r, phase: 'completed', organizationId: organization.id, token: null }
    await write(tx, r)
    await tx.systemSetting.deleteMany({ where: { key: activeKey(r), value: key(r) } })
    return result(tx, i, r)
  })
}
export async function failAioQuickStart(input: Identity & { leaseToken: string }, db: Db = prisma) {
  const i = identity(input)
  return transaction(i, db, async tx => {
    const r = await read(tx, i)
    if (!r || r.phase === 'linked') throw new AioStartError('OPERATION_MISSING')
    if (!['pending', 'cancelling'].includes(r.phase)) return result(tx, i, r)
    if (r.token !== input.leaseToken) throw new AioStartError('LEASE_CHANGED')
    return result(tx, i, await terminal(tx, r, r.phase === 'cancelling' ? 'cancelled' : 'failed', r.phase === 'cancelling' ? null : 'GENERATION_FAILED'))
  })
}
