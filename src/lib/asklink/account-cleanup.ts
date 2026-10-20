import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { purgeAskLinkCreationReceipts } from './creation-receipts'

export const ASKLINK_ACCOUNT_PURGE = 'asklink-account-purge:v2:'
export const ASKLINK_UPLOAD_TICKET = 'asklink-upload-ticket:v1:'
export const ASKLINK_SETTLED_TICKET_MS = 24 * 60 * 60 * 1000
export const ASKLINK_UNKNOWN_REVIEW_MS = 24 * 60 * 60 * 1000
export const ASKLINK_TICKET_LIMIT = 512
export const askLinkActorHash = (actor: string) => createHash('sha256').update(JSON.stringify(actor)).digest('hex')
export const askLinkAccountKey = (actor: string) => ASKLINK_ACCOUNT_PURGE + askLinkActorHash(actor)
export const askLinkInvalidAccountKey = (key: string) => 'asklink-account-purge-invalid:v1:' + askLinkActorHash(key)
export const askLinkTicketPrefix = (actor: string) => ASKLINK_UPLOAD_TICKET + askLinkActorHash(actor) + ':'
export const askLinkTicketKey = (actor: string, token: string) => askLinkTicketPrefix(actor) + token
export const safeAskLinkActor = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
export const safeAskLinkRun = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]{20,40}$/i.test(value)
export const safeAskLinkToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export type UploadPhase = 'reserved' | 'uploading' | 'uploaded' | 'settled' | 'not-written' | 'unknown' | 'needs_review'
export type AskLinkUploadTicket = { version: 1; actor: string; runId: string; kind: string; token: string; bannerId: string; generation: number; bannerVersion: string; createdAt: string; updatedAt: string; phase: UploadPhase }
export type AskLinkAccountPurge = { version: 2; actor: string; generation: string; queuedAt: string; nextAttemptAt: string; leaseToken: string | null; leaseUntil: string | null; folderOffset: number; attempts: number; lastError: string | null }
export function askLinkUploadPath(ticket: Pick<AskLinkUploadTicket, 'actor' | 'runId' | 'kind' | 'token'>) {
  if (!safeAskLinkActor(ticket.actor) || !safeAskLinkRun(ticket.runId) || !['landscape', 'square', 'portrait'].includes(ticket.kind) || !safeAskLinkToken(ticket.token)) throw Error('Invalid AskLink upload scope')
  return `asklink/${ticket.actor}/${ticket.runId}/${ticket.kind}_${ticket.token}.png`
}
export function readAskLinkUploadTicket(value: string, key: string): AskLinkUploadTicket {
  if (Buffer.byteLength(value) > 4096) throw Error('Invalid AskLink ticket')
  const r: unknown = JSON.parse(value)
  if (!object(r) || r.version !== 1 || !safeAskLinkActor(r.actor) || !safeAskLinkRun(r.runId) || !safeAskLinkRun(r.bannerId) || !safeAskLinkToken(r.token) || !['landscape', 'square', 'portrait'].includes(String(r.kind)) || !['reserved', 'uploading', 'uploaded', 'settled', 'not-written', 'unknown', 'needs_review'].includes(String(r.phase)) || !Number.isSafeInteger(r.generation) || Number(r.generation) < 1 || Number(r.generation) > 2 || !iso(r.bannerVersion) || !iso(r.createdAt) || !iso(r.updatedAt) || askLinkTicketKey(r.actor, r.token) !== key) throw Error('Invalid AskLink ticket')
  return r as AskLinkUploadTicket
}
export function readAskLinkAccountPurge(value: string, key: string): AskLinkAccountPurge {
  if (Buffer.byteLength(value) > 4096) throw Error('Invalid AskLink purge task')
  const r: unknown = JSON.parse(value)
  if (!object(r) || r.version !== 2 || !safeAskLinkActor(r.actor) || askLinkAccountKey(r.actor) !== key || !safeAskLinkToken(r.generation) || !iso(r.queuedAt) || !iso(r.nextAttemptAt) || !(r.leaseToken === null && r.leaseUntil === null || safeAskLinkToken(r.leaseToken) && iso(r.leaseUntil)) || !Number.isSafeInteger(r.folderOffset) || Number(r.folderOffset) < 0 || Number(r.folderOffset) > 1_000_000 || !Number.isSafeInteger(r.attempts) || Number(r.attempts) < 0 || !(r.lastError === null || typeof r.lastError === 'string' && /^[A-Z_]{1,40}$/.test(r.lastError))) throw Error('Invalid AskLink purge task')
  return r as AskLinkAccountPurge
}
export async function lockAskLinkUser(tx: Prisma.TransactionClient, actor: string) {
  if (!safeAskLinkActor(actor)) throw Error('Invalid AskLink actor')
  return (await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`).some(row => row.id === actor)
}
export async function hasAskLinkAccountFence(tx: Prisma.TransactionClient, actor: string) {
  const key = askLinkAccountKey(actor)
  return Boolean(await tx.systemSetting.findFirst({ where: { key: { in: [key, askLinkInvalidAccountKey(key)] } }, select: { key: true } }))
}

/** DB-only. Caller owns the transaction; callback preserves existing User deletion return/error. */
export async function deleteAskLinkAccount<T>(tx: Prisma.TransactionClient, actor: string, removeUser: () => Promise<T>, now = new Date()): Promise<T> {
  if (!Number.isFinite(now.getTime())) throw Error('Invalid AskLink cleanup time')
  // An already missing User still follows the adapter's original P2025 contract; no orphan backfill.
  if (!await lockAskLinkUser(tx, actor)) return removeUser()
  const key = askLinkAccountKey(actor), previous = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  const old = previous ? readAskLinkAccountPurge(previous.value, key) : null
  const task: AskLinkAccountPurge = { version: 2, actor, generation: randomUUID(), queuedAt: old?.queuedAt ?? now.toISOString(), nextAttemptAt: now.toISOString(), leaseToken: null, leaseUntil: null, folderOffset: 0, attempts: 0, lastError: null }
  const value = JSON.stringify(task)
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
  await tx.askLinkRun.deleteMany({ where: { userId: actor } })
  await purgeAskLinkCreationReceipts(tx, actor)
  return removeUser()
}
