import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/interview/storage'
import { ASKLINK_ACCOUNT_PURGE, ASKLINK_UPLOAD_TICKET, ASKLINK_SETTLED_TICKET_MS, ASKLINK_UNKNOWN_REVIEW_MS, ASKLINK_TICKET_LIMIT, askLinkInvalidAccountKey, askLinkTicketPrefix, askLinkUploadPath, hasAskLinkAccountFence, lockAskLinkUser, readAskLinkAccountPurge, readAskLinkUploadTicket, safeAskLinkActor, safeAskLinkRun, type AskLinkAccountPurge } from './account-cleanup'

const TX = { maxWait: 1000, timeout: 5000 }
const LEASE_MS = 120_000
const RETRY_MS = 15 * 60 * 1000
const ACCOUNT_CURSOR = 'asklink-account-purge-cursor:v2'
const TICKET_CURSOR = 'asklink-upload-ticket-cursor:v1'
type Db = typeof prisma
type Owned = { key: string; task: AskLinkAccountPurge }
async function bounded<T>(work: () => PromiseLike<T>, deadline: number): Promise<T> {
  const remaining = Math.min(10_000, deadline - Date.now())
  if (remaining <= 0) throw Error('Storage deadline')
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Storage deadline')), remaining) })]) }
  finally { clearTimeout(timer) }
}
async function privateBucket(deadline: number) {
  const storage = getSupabaseAdmin().storage, name = process.env.ADIMAGE_STORAGE_BUCKET || 'adimage'
  const state = await bounded(() => storage.getBucket(name), deadline)
  if (state.error || !state.data || state.data.public !== false || state.data.name !== name) throw Error('Private storage unavailable')
  return storage.from(name)
}
async function removePaths(paths: string[], deadline: number) {
  const bucket = await privateBucket(deadline), removed = await bounded(() => bucket.remove(paths), deadline)
  // Successful removal is idempotent: a previously absent key need not appear in the returned rows.
  if (removed.error || !Array.isArray(removed.data) || removed.data.length > paths.length || new Set(removed.data.map(file => file.name)).size !== removed.data.length || removed.data.some(file => !paths.includes(file.name))) throw Error('Storage removal unconfirmed')
}
/** Only one level of safe run folders and object basenames; never follows stored URLs. */
export async function purgeAskLinkStorageBatch(actor: string, folderOffset: number, deadline: number) {
  if (!safeAskLinkActor(actor) || !Number.isSafeInteger(folderOffset) || folderOffset < 0 || folderOffset > 1_000_000) throw Error('Invalid storage scope')
  const bucket = await privateBucket(deadline), prefix = 'asklink/' + actor
  const folders = await bounded(() => bucket.list(prefix, { limit: 1, offset: folderOffset, sortBy: { column: 'name', order: 'asc' } }), deadline)
  if (folders.error || !Array.isArray(folders.data) || folders.data.length > 1) throw Error('Invalid folder listing')
  if (!folders.data.length) return { empty: true, folderOffset: 0 }
  const folder = folders.data[0]
  if (folder.id || !safeAskLinkRun(folder.name)) throw Error('Invalid run folder')
  const runPrefix = prefix + '/' + folder.name
  const files = await bounded(() => bucket.list(runPrefix, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } }), deadline)
  if (files.error || !Array.isArray(files.data) || files.data.length > 100) throw Error('Invalid object listing')
  const paths = files.data.map(file => {
    if (!file.id || typeof file.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(file.name) || ['.', '..'].includes(file.name)) throw Error('Invalid object scope')
    return runPrefix + '/' + file.name
  })
  if (!paths.length) return { empty: false, folderOffset: folderOffset + 1 }
  await removePaths(paths, deadline)
  return { empty: false, folderOffset }
}
async function owned(tx: Prisma.TransactionClient, claim: Owned, now: Date) {
  const present = await lockAskLinkUser(tx, claim.task.actor)
  // Account task is the per-actor fence/lease even after its User row has disappeared.
  await tx.$queryRaw`SELECT key FROM "SystemSetting" WHERE key = ${claim.key} FOR UPDATE`
  const row = await tx.systemSetting.findUnique({ where: { key: claim.key }, select: { value: true } })
  if (!row) return null
  const task = readAskLinkAccountPurge(row.value, claim.key)
  if (task.generation !== claim.task.generation || task.leaseToken !== claim.task.leaseToken || !task.leaseUntil || Date.parse(task.leaseUntil) <= now.getTime()) return null
  if (present) {
    await tx.systemSetting.updateMany({ where: { key: claim.key, value: row.value }, data: { value: JSON.stringify({ ...task, leaseToken: null, leaseUntil: null, nextAttemptAt: new Date(now.getTime() + RETRY_MS).toISOString(), folderOffset: 0, lastError: 'ACTOR_PRESENT' }) } })
    return null
  }
  return { row, task }
}
async function ticketStates(tx: Prisma.TransactionClient, actor: string, now: Date) {
  const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: askLinkTicketPrefix(actor) } }, orderBy: { key: 'asc' }, take: ASKLINK_TICKET_LIMIT + 1, select: { key: true, value: true } })
  if (rows.length > ASKLINK_TICKET_LIMIT) throw Error('Ticket capacity exceeded')
  let unresolved = 0, needsReview = 0
  const snapshot: Array<[string, string]> = [], knownPaths: string[] = []
  for (const row of rows) {
    const t = readAskLinkUploadTicket(row.value, row.key)
    let phase = t.phase
    if (phase === 'reserved') phase = 'not-written' // No User: upload preflight cannot pass anymore.
    else if (['uploading', 'unknown'].includes(phase) && now.getTime() - Date.parse(t.createdAt) >= ASKLINK_UNKNOWN_REVIEW_MS) phase = 'needs_review'
    let value = row.value
    if (phase !== t.phase) {
      value = JSON.stringify({ ...t, phase, updatedAt: now.toISOString() })
      const updated = await tx.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value } })
      if (updated.count !== 1) throw Error('Ticket changed')
    }
    if (['uploading', 'unknown', 'needs_review'].includes(phase)) unresolved++
    if (phase === 'needs_review') needsReview++
    snapshot.push([row.key, value])
    if (phase === 'uploaded' || phase === 'settled') knownPaths.push(askLinkUploadPath(t))
  }
  return { unresolved, needsReview, knownPaths, signature: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') }
}
async function claimAccount(db: Db, row: { key: string; value: string }, now: Date): Promise<Owned | null> {
  const snapshot = readAskLinkAccountPurge(row.value, row.key)
  return db.$transaction(async tx => {
    const present = await lockAskLinkUser(tx, snapshot.actor)
    await tx.$queryRaw`SELECT key FROM "SystemSetting" WHERE key = ${row.key} FOR UPDATE`
    const latest = await tx.systemSetting.findUnique({ where: { key: row.key }, select: { value: true } })
    if (!latest) return null
    const task = readAskLinkAccountPurge(latest.value, row.key)
    if (Date.parse(task.nextAttemptAt) > now.getTime() || task.leaseUntil && Date.parse(task.leaseUntil) > now.getTime()) return null
    if (present) {
      await tx.systemSetting.updateMany({ where: { key: row.key, value: latest.value }, data: { value: JSON.stringify({ ...task, nextAttemptAt: new Date(now.getTime() + RETRY_MS).toISOString(), lastError: 'ACTOR_PRESENT' }) } })
      return null
    }
    const claimed: AskLinkAccountPurge = { ...task, leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(), attempts: task.attempts + 1, lastError: null }
    const changed = await tx.systemSetting.updateMany({ where: { key: row.key, value: latest.value }, data: { value: JSON.stringify(claimed) } })
    return changed.count === 1 ? { key: row.key, task: claimed } : null
  }, TX)
}
async function finishAccount(db: Db, claim: Owned, now: Date, empty: boolean, folderOffset: number, failed: boolean, scanned?: Awaited<ReturnType<typeof ticketStates>>) {
  return db.$transaction(async tx => {
    const current = await owned(tx, claim, now)
    if (!current) return { completed: false, needsReview: 0 }
    const state = await ticketStates(tx, claim.task.actor, now)
    if (empty && !failed && scanned?.unresolved === 0 && state.unresolved === 0 && scanned.signature === state.signature) {
      await tx.systemSetting.deleteMany({ where: { key: { startsWith: askLinkTicketPrefix(claim.task.actor) } } })
      const removed = await tx.systemSetting.deleteMany({ where: { key: claim.key, value: current.row.value } })
      if (removed.count !== 1) throw Error('Account lease changed')
      return { completed: true, needsReview: state.needsReview }
    }
    await tx.systemSetting.updateMany({ where: { key: claim.key, value: current.row.value }, data: { value: JSON.stringify({ ...current.task, leaseToken: null, leaseUntil: null, folderOffset: empty ? 0 : folderOffset, nextAttemptAt: new Date(now.getTime() + RETRY_MS).toISOString(), lastError: failed ? 'STORAGE_UNCONFIRMED' : state.needsReview ? 'UPLOAD_NEEDS_REVIEW' : state.unresolved ? 'UPLOAD_UNKNOWN' : null }) } })
    return { completed: false, needsReview: state.needsReview }
  }, TX)
}
async function page(db: Db, prefix: string, cursorKey: string) {
  const saved = await db.systemSetting.findUnique({ where: { key: cursorKey }, select: { value: true } })
  const cursor = saved?.value.startsWith(prefix) ? saved.value : ''
  const rows = await db.systemSetting.findMany({ where: { key: { startsWith: prefix, ...(cursor ? { gt: cursor } : {}) } }, orderBy: { key: 'asc' }, take: 25, select: { key: true, value: true } })
  return { rows, cursorKey, cursor }
}
async function advance(db: Db, scan: Awaited<ReturnType<typeof page>>, last: string, checked: number) {
  const value = scan.rows.length < 25 && checked === scan.rows.length ? '' : last
  await db.systemSetting.upsert({ where: { key: scan.cursorKey }, create: { key: scan.cursorKey, value }, update: { value } })
}
/** Bounded sweep. Unknown/no-ack tickets never expire into success, including needs_review. */
export async function collectAskLinkAccountStorage(db: Db = prisma, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw Error('Invalid cleanup time')
  const started = Date.now(), deadline = started + 45_000, clock = () => new Date(now.getTime() + Date.now() - started)
  const result = { processed: 0, completed: 0, pending: 0, failed: 0, needsReview: 0, settledTicketsRemoved: 0, notWrittenTicketsRemoved: 0 }
  const scan = await page(db, ASKLINK_ACCOUNT_PURGE, ACCOUNT_CURSOR)
  let last = scan.cursor, checked = 0
  for (const row of scan.rows) {
    if (Date.now() >= deadline || result.processed >= 5) break
    last = row.key; checked++
    let claim: Owned | null = null
    try {
      try { readAskLinkAccountPurge(row.value, row.key) }
      catch {
        // Retain invalid data for review in a distinct queue; its deterministic key remains a writer fence.
        await db.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { key: askLinkInvalidAccountKey(row.key) } })
        result.failed++; continue
      }
      claim = await claimAccount(db, row, clock())
      if (!claim) continue
      result.processed++
      const scanned = await db.$transaction(async tx => { if (!await owned(tx, claim!, clock())) throw Error('Account lease unavailable'); return ticketStates(tx, claim!.task.actor, clock()) }, TX)
      // Explicitly delete every acknowledged key; listing alone is not confirmation of its absence.
      for (let offset = 0; offset < scanned.knownPaths.length; offset += 100) {
        if (!await db.$transaction(tx => owned(tx, claim!, clock()), TX)) throw Error('Account lease unavailable')
        await removePaths(scanned.knownPaths.slice(offset, offset + 100), deadline)
      }
      let empty = false, offset = claim.task.folderOffset
      for (let step = 0; step < 10 && Date.now() < deadline; step++) {
        const allowed = await db.$transaction(tx => owned(tx, claim!, clock()), TX)
        if (!allowed) break
        const batch = await purgeAskLinkStorageBatch(claim.task.actor, offset, deadline)
        empty = batch.empty; offset = batch.folderOffset
        if (empty) break
      }
      const done = await finishAccount(db, claim, clock(), empty, offset, false, scanned)
      if (done.completed) result.completed++; else result.pending++
      result.needsReview += done.needsReview
    } catch {
      result.failed++
      if (claim) await finishAccount(db, claim, clock(), false, claim.task.folderOffset, true).catch(() => {})
    }
  }
  await advance(db, scan, last, checked)
  if (Date.now() < deadline) {
    const tickets = await page(db, ASKLINK_UPLOAD_TICKET, TICKET_CURSOR)
    let ticketLast = tickets.cursor, ticketChecked = 0
    for (const row of tickets.rows) {
      if (Date.now() >= deadline) break
      ticketLast = row.key; ticketChecked++
      try {
        const t = readAskLinkUploadTicket(row.value, row.key)
        // Only proven terminal tickets expire. not-written can never prepare/upload/ack again.
        if (!['settled', 'not-written'].includes(t.phase) || clock().getTime() - Date.parse(t.updatedAt) < ASKLINK_SETTLED_TICKET_MS) continue
        const removed = await db.$transaction(async tx => {
          if (!await lockAskLinkUser(tx, t.actor) || await hasAskLinkAccountFence(tx, t.actor)) return 0
          return (await tx.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })).count
        }, TX)
        if (t.phase === 'settled') result.settledTicketsRemoved += removed
        else result.notWrittenTicketsRemoved += removed
      } catch { result.failed++ }
    }
    await advance(db, tickets, ticketLast, ticketChecked)
  }
  return result
}
