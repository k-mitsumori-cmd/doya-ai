import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { uploadPng } from '@/lib/adimage/storage'
import { BANNER_MAX_GENERATIONS } from './dto'
import { askLinkTicketKey, askLinkTicketPrefix, askLinkUploadPath, hasAskLinkAccountFence, lockAskLinkUser, readAskLinkUploadTicket, safeAskLinkActor, safeAskLinkRun, safeAskLinkToken, ASKLINK_TICKET_LIMIT, type AskLinkUploadTicket } from './account-cleanup'
import type { BannerVerify } from './types'

const TX = { maxWait: 10000, timeout: 20000 }
const STALE_MS = 6 * 60 * 1000
const UPLOAD_WAIT_MS = 60_000
type Db = Pick<typeof prisma, '$transaction'>
export type AskLinkBannerClaim = { actor: string; runId: string; kind: string; token: string }
export class AskLinkBannerWriteError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code === 'TICKET_LIMIT' ? '保存状態の確認が完了するまで、新しいバナーの作成をお待ちください。' : status === 401 ? 'ログイン状態を確認してください。' : status === 429 ? 'このバナーを作り直せる回数の上限に達しました。' : status === 409 ? 'このバナーは生成中か、保存内容が変更されています。' : 'バナーの保存を確認できませんでした。') }
}
function validate(i: Omit<AskLinkBannerClaim, 'token'> & { token?: string }) {
  if (!safeAskLinkActor(i.actor) || !safeAskLinkRun(i.runId) || !['landscape', 'square', 'portrait'].includes(i.kind) || i.token !== undefined && !safeAskLinkToken(i.token)) throw new AskLinkBannerWriteError(400, 'INVALID_SCOPE')
}
async function read(tx: Prisma.TransactionClient, c: AskLinkBannerClaim) {
  const key = askLinkTicketKey(c.actor, c.token), row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  const ticket = readAskLinkUploadTicket(row.value, key)
  if (ticket.runId !== c.runId || ticket.kind !== c.kind) throw new AskLinkBannerWriteError(409, 'CLAIM_CHANGED')
  return { key, value: row.value, ticket }
}
async function change(tx: Prisma.TransactionClient, r: NonNullable<Awaited<ReturnType<typeof read>>>, phase: AskLinkUploadTicket['phase'], now = new Date()) {
  return (await tx.systemSetting.updateMany({ where: { key: r.key, value: r.value }, data: { value: JSON.stringify({ ...r.ticket, phase, updatedAt: now.toISOString() }) } })).count === 1
}
function where(t: AskLinkUploadTicket) {
  return { id: t.bannerId, runId: t.runId, kind: t.kind, generations: t.generation, updatedAt: new Date(t.bannerVersion), status: 'generating', run: { userId: t.actor } }
}
export async function claimAskLinkBanner(i: Omit<AskLinkBannerClaim, 'token'>, db: Db = prisma, now = new Date()) {
  validate(i)
  return db.$transaction(async tx => {
    if (!await lockAskLinkUser(tx, i.actor) || await hasAskLinkAccountFence(tx, i.actor)) throw new AskLinkBannerWriteError(401, 'ACTOR_UNAVAILABLE')
    const run = await tx.askLinkRun.findFirst({ where: { id: i.runId, userId: i.actor }, select: { id: true, site: true, bannerCopy: true } })
    if (!run?.bannerCopy) throw new AskLinkBannerWriteError(404, 'RUN_UNAVAILABLE')
    if (await tx.systemSetting.count({ where: { key: { startsWith: askLinkTicketPrefix(i.actor) } } }) >= ASKLINK_TICKET_LIMIT) throw new AskLinkBannerWriteError(429, 'TICKET_LIMIT')
    await tx.askLinkBanner.upsert({ where: { runId_kind: { runId: i.runId, kind: i.kind } }, create: { runId: i.runId, kind: i.kind }, update: {} })
    const claimed = await tx.askLinkBanner.updateMany({ where: { runId: i.runId, kind: i.kind, generations: { lt: BANNER_MAX_GENERATIONS }, OR: [{ status: { not: 'generating' } }, { updatedAt: { lt: new Date(now.getTime() - STALE_MS) } }] }, data: { generations: { increment: 1 }, status: 'generating' } })
    if (claimed.count !== 1) {
      const existing = await tx.askLinkBanner.findUnique({ where: { runId_kind: { runId: i.runId, kind: i.kind } }, select: { status: true } })
      throw new AskLinkBannerWriteError(existing?.status === 'generating' ? 409 : 429, 'BANNER_UNAVAILABLE')
    }
    const banner = await tx.askLinkBanner.findUniqueOrThrow({ where: { runId_kind: { runId: i.runId, kind: i.kind } } })
    const claim = { ...i, token: randomUUID() }, ticket: AskLinkUploadTicket = { version: 1, ...claim, bannerId: banner.id, generation: banner.generations, bannerVersion: banner.updatedAt.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(), phase: 'reserved' }
    await tx.systemSetting.create({ data: { key: askLinkTicketKey(i.actor, claim.token), value: JSON.stringify(ticket) } })
    return { claim, run }
  }, TX)
}
/** The durable uploading transition precedes external I/O. No User lock is held across upload. */
export async function prepareAskLinkBannerUpload(c: AskLinkBannerClaim, db: Db = prisma) {
  validate(c)
  return db.$transaction(async tx => {
    const present = await lockAskLinkUser(tx, c.actor), r = await read(tx, c)
    if (!r || r.ticket.phase !== 'reserved') return null
    if (!present || await hasAskLinkAccountFence(tx, c.actor) || !await tx.askLinkBanner.findFirst({ where: where(r.ticket), select: { id: true } })) { await change(tx, r, 'not-written'); return null }
    return await change(tx, r, 'uploading') ? askLinkUploadPath(r.ticket) : null
  }, TX)
}
/** Only updates an existing claim; a late acknowledgment never recreates account data. */
export async function recordAskLinkUploadOutcome(c: AskLinkBannerClaim, uploaded: boolean, db: Db = prisma) {
  validate(c)
  return db.$transaction(async tx => {
    await lockAskLinkUser(tx, c.actor)
    const r = await read(tx, c)
    if (!r || !['uploading', 'unknown', 'needs_review'].includes(r.ticket.phase)) return false
    return change(tx, r, uploaded ? 'uploaded' : r.ticket.phase === 'needs_review' ? 'needs_review' : 'unknown')
  }, TX)
}
export async function uploadAskLinkBanner(c: AskLinkBannerClaim, png: Buffer, db: Db = prisma) {
  const path = await prepareAskLinkBannerUpload(c, db)
  if (!path) throw new AskLinkBannerWriteError(409, 'CLAIM_UNAVAILABLE')
  // Keep the completion handler attached after a local timeout. A process death still leaves uploading.
  const work = uploadPng(path, png).then(async saved => {
    if (saved !== path) throw new AskLinkBannerWriteError(503, 'UPLOAD_PATH_CHANGED')
    if (!await recordAskLinkUploadOutcome(c, true, db)) throw new AskLinkBannerWriteError(409, 'CLAIM_UNAVAILABLE')
    return path
  }).catch(async () => { await recordAskLinkUploadOutcome(c, false, db); throw new AskLinkBannerWriteError(503, 'UPLOAD_UNKNOWN') })
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AskLinkBannerWriteError(503, 'UPLOAD_UNKNOWN')), UPLOAD_WAIT_MS) })]) }
  catch (error) { await recordAskLinkUploadOutcome(c, false, db); throw error }
  finally { clearTimeout(timer) }
}
export async function settleAskLinkBanner(c: AskLinkBannerClaim, result: { path: string; verify: BannerVerify; model: string } | null, db: Db = prisma) {
  validate(c)
  return db.$transaction(async tx => {
    const present = await lockAskLinkUser(tx, c.actor), r = await read(tx, c)
    if (!r) return false
    if (!result && r.ticket.phase === 'reserved') await change(tx, r, 'not-written')
    if (!present || await hasAskLinkAccountFence(tx, c.actor)) return false
    if (result && (r.ticket.phase !== 'uploaded' || result.path !== askLinkUploadPath(r.ticket))) return false
    const changed = await tx.askLinkBanner.updateMany({ where: where(r.ticket), data: result ? { status: 'done', imagePath: result.path, verify: result.verify as unknown as Prisma.InputJsonValue, model: result.model } : { status: 'failed' } })
    if (changed.count !== 1) return false
    if (result) await change(tx, r, 'settled')
    return true
  }, TX)
}
