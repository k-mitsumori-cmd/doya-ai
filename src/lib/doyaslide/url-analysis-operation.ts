import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { reserveDoyaSlideTextCallInTransaction, DoyaSlideTextLimitError } from './text-budget'

export type UrlAnalysisProposal = { title: string; brief: string; referenceText: string; aiAnalyzed: boolean }
type Identity = { actor: string; operationId: string }
type Input = Identity & { url: string }
type Phase = 'pending' | 'completed' | 'failed' | 'cancelled'
type Receipt = Identity & { version: 1; inputHash: string | null; url: string | null; phase: Phase; startedAt: string; reserved: boolean; result: UrlAnalysisProposal | null; code: string | null }
type Db = Pick<typeof prisma, '$transaction'>
export type UrlAnalysisOperation = { operationId: string; state: Phase | 'started' | 'missing' | 'busy'; sourceUrl: string | null; result: UrlAnalysisProposal | null; reserved: boolean; code: string | null }
export const URL_ANALYSIS_LEASE_MS = 10 * 60 * 1000
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
export class UrlAnalysisOperationError extends Error {
  constructor(readonly status: number, readonly code: string, message = '取り込み結果を確認できません。新しく解析せず、結果を再確認してください。') { super(message) }
}
function identity(value: Identity): Identity {
  if (!value || typeof value !== 'object' || !identifier(value.actor) || typeof value.operationId !== 'string' || !uuid.test(value.operationId)) throw new UrlAnalysisOperationError(400, 'INVALID_OPERATION')
  return { actor: value.actor, operationId: value.operationId.toLowerCase() }
}
function validUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password } catch { return false }
}
function proposal(value: unknown): value is UrlAnalysisProposal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as UrlAnalysisProposal
  return typeof r.title === 'string' && r.title.length <= 120 && typeof r.brief === 'string' && r.brief.length <= 2000
    && typeof r.referenceText === 'string' && !!r.referenceText.trim() && r.referenceText.length <= 6000 && typeof r.aiAnalyzed === 'boolean'
    && Object.keys(r).every(k => ['title','brief','referenceText','aiAnalyzed'].includes(k))
}
function keys(i: Identity) { return { receipt: 'doyaslide-url-operation:v1:' + hash([i.actor,i.operationId]), active: 'doyaslide-url-active:v1:' + hash(i.actor) } }
function parse(raw: string, i: Identity): Receipt {
  try {
    if (Buffer.byteLength(raw) > 64 * 1024) throw new Error()
    const r: Receipt = JSON.parse(raw)
    if (!r || r.version !== 1 || r.actor !== i.actor || r.operationId !== i.operationId || !['pending','completed','failed','cancelled'].includes(r.phase)
      || typeof r.startedAt !== 'string' || !Number.isFinite(Date.parse(r.startedAt)) || typeof r.reserved !== 'boolean'
      || ![null,'ANALYSIS_FAILED','OPERATION_EXPIRED','DOYASLIDE_TEXT_DAILY_LIMIT'].includes(r.code)) throw new Error()
    if (r.url === null ? r.inputHash !== null || r.reserved || r.phase !== 'cancelled' : !validUrl(r.url) || r.inputHash !== hash(r.url)) throw new Error()
    if (r.phase === 'completed' ? !r.reserved || !proposal(r.result) || r.code !== null : r.result !== null) throw new Error()
    if (r.phase === 'pending' && (!r.reserved || r.code !== null)) throw new Error()
    if (r.phase === 'failed' && (r.code === null || (r.code === 'DOYASLIDE_TEXT_DAILY_LIMIT' ? r.reserved : !r.reserved))) throw new Error()
    if (r.phase === 'cancelled' && r.code !== null) throw new Error()
    return r
  } catch { throw new UrlAnalysisOperationError(409,'INVALID_RECEIPT') }
}
async function lock(tx: Prisma.TransactionClient, i: Identity) {
  const actors = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${i.actor} FOR UPDATE`
  if (!actors.some(a => a.id === i.actor)) throw new UrlAnalysisOperationError(403,'ACTOR_UNAVAILABLE','ログイン情報を確認してください。')
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${keys(i).active}))`
}
async function read(tx: Prisma.TransactionClient, i: Identity) {
  const row = await tx.systemSetting.findUnique({ where: { key: keys(i).receipt }, select: { value: true } })
  return row ? parse(row.value,i) : null
}
async function write(tx: Prisma.TransactionClient, r: Receipt) {
  const value = JSON.stringify(r)
  if (Buffer.byteLength(value) > 64 * 1024) throw new UrlAnalysisOperationError(409,'RECEIPT_CAPACITY')
  await tx.systemSetting.upsert({ where: { key: keys(r).receipt }, create: { key: keys(r).receipt, value }, update: { value } })
}
async function release(tx: Prisma.TransactionClient, i: Identity) {
  await tx.systemSetting.deleteMany({ where: { key: keys(i).active, value: i.operationId } })
}
async function expire(tx: Prisma.TransactionClient, r: Receipt, now: Date) {
  if (r.phase === 'pending') {
    const active = await tx.systemSetting.findUnique({ where: { key: keys(r).active }, select: { value: true } })
    if (active?.value !== r.operationId) throw new UrlAnalysisOperationError(409,'INVALID_RECEIPT')
  }
  if (r.phase === 'pending' && now.getTime() - Date.parse(r.startedAt) >= URL_ANALYSIS_LEASE_MS) {
    r = { ...r, phase: 'failed', result: null, code: 'OPERATION_EXPIRED' }
    await write(tx,r); await release(tx,r)
  }
  return r
}
function result(i: Identity, r: Receipt | null, state?: UrlAnalysisOperation['state']): UrlAnalysisOperation {
  return { operationId: i.operationId, state: state || r?.phase || 'missing', sourceUrl: r?.url || null, result: r?.result || null, reserved: r?.reserved || false, code: r?.code || null }
}
function time(now: Date) { if (!Number.isFinite(now.getTime())) throw new UrlAnalysisOperationError(400,'INVALID_OPERATION'); return now }

/** Admission and operational attempt count commit together; replay never starts another provider call. */
export async function beginUrlAnalysisOperation(input: Input, db: Db = prisma, now = new Date()): Promise<UrlAnalysisOperation> {
  const i = identity(input); time(now)
  if (!validUrl(input.url)) throw new UrlAnalysisOperationError(400,'INVALID_OPERATION','httpまたはhttpsのURLを入力してください。')
  return db.$transaction(async tx => {
    await lock(tx,i)
    const previous = await read(tx,i)
    if (previous) {
      if (previous.url !== null && previous.inputHash !== hash(input.url)) throw new UrlAnalysisOperationError(409,'INPUT_CHANGED','前回と異なるURLです。前の取り込み結果を確認してください。')
      return result(i,await expire(tx,previous,now))
    }
    const active = await tx.systemSetting.findUnique({ where: { key: keys(i).active }, select: { value: true } })
    if (active) {
      if (!uuid.test(active.value)) throw new UrlAnalysisOperationError(409,'INVALID_RECEIPT')
      const other = await read(tx,{ actor: i.actor, operationId: active.value.toLowerCase() })
      if (!other) throw new UrlAnalysisOperationError(409,'INVALID_RECEIPT')
      if ((await expire(tx,other,now)).phase === 'pending') return result(i,null,'busy')
      await tx.systemSetting.deleteMany({ where: { key: keys(i).active, value: active.value } })
    }
    const r: Receipt = { ...i, version: 1, inputHash: hash(input.url), url: input.url, phase: 'pending', startedAt: now.toISOString(), reserved: false, result: null, code: null }
    try { await reserveDoyaSlideTextCallInTransaction(i.actor,'url-analysis',tx,now); r.reserved = true }
    catch (error) {
      if (!(error instanceof DoyaSlideTextLimitError)) throw error
      r.phase = 'failed'; r.code = 'DOYASLIDE_TEXT_DAILY_LIMIT'; await write(tx,r); return result(i,r)
    }
    await write(tx,r)
    await tx.systemSetting.upsert({ where: { key: keys(i).active }, create: { key: keys(i).active, value: i.operationId }, update: { value: i.operationId } })
    return result(i,r,'started')
  },options)
}

/** Recovery and cancellation never invoke external services or guess-refund counted attempts. */
export async function recoverUrlAnalysisOperation(input: Identity, cancel = false, db: Db = prisma, now = new Date()): Promise<UrlAnalysisOperation> {
  const i = identity(input); time(now)
  return db.$transaction(async tx => {
    await lock(tx,i)
    let r = await read(tx,i)
    if (r) r = await expire(tx,r,now)
    if (cancel && (!r || r.phase === 'pending')) {
      r = r ? { ...r, phase: 'cancelled', code: null, result: null } : { ...i, version: 1, inputHash: null, url: null, phase: 'cancelled', startedAt: now.toISOString(), reserved: false, result: null, code: null }
      await write(tx,r); await release(tx,i)
    }
    return result(i,r)
  },options)
}

export async function settleUrlAnalysisOperation(input: Input, output: UrlAnalysisProposal | null, db: Db = prisma, now = new Date()): Promise<UrlAnalysisOperation> {
  const i = identity(input); time(now)
  if (!validUrl(input.url) || (output !== null && !proposal(output))) throw new UrlAnalysisOperationError(400,'INVALID_RESULT')
  return db.$transaction(async tx => {
    await lock(tx,i)
    let r = await read(tx,i)
    if (!r) throw new UrlAnalysisOperationError(409,'OPERATION_MISSING')
    if (r.url !== null && r.inputHash !== hash(input.url)) throw new UrlAnalysisOperationError(409,'INPUT_CHANGED')
    r = await expire(tx,r,now)
    if (r.phase !== 'pending') return result(i,r)
    r = { ...r, phase: output ? 'completed' : 'failed', result: output, code: output ? null : 'ANALYSIS_FAILED' }
    await write(tx,r); await release(tx,i)
    return result(i,r)
  },options)
}
