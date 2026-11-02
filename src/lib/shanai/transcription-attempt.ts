import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { QuotaResult } from '@/lib/plan-limit'
import { prisma } from '@/lib/prisma'
import { lockShanaiStorage, SHANAI_TRANSCRIPT_ATTEMPT_PREFIX } from './storage-purge'

const PREPARE_LEASE_MS = 5 * 60_000
const SUBMIT_WAIT_MS = 60_000
export const SUBMISSION_UNCERTAIN = '文字起こしの送信状況を確認できません。重複処理を避けるため再送を停止しています。時間をおいて再確認し、続く場合はお問い合わせください。'
export const RECORDING_CHANGED = '録音が変更または削除されました。画面を読み直してください。'

type Source = { id: string; userId: string; audioPath: string }
type Phase = 'prepared' | 'submitting' | 'polling' | 'complete' | 'failed' | 'uncertain'
type Attempt = Source & { version: 1; token: string; phase: Phase; expiresAt: number; jobId: string | null; durationSec: number }
export type TranscriptContext = Source & { token: string; durationSec: number }
export type TranscriptReservation =
  | { ok: true; action: 'done' }
  | { ok: true; action: 'submit' | 'poll'; context: TranscriptContext; jobId: string | null }
  | { ok: false; pending?: boolean; uncertain?: boolean; changed?: boolean; needsDuration?: boolean; reason?: string; quota?: QuotaResult }
type Current = { audioPath: string | null; transcriptStatus: string; transcriptJobId: string | null; audioDurationSec: number | null }

export class ShanaiRecordingChangedError extends Error {
  constructor() { super(RECORDING_CHANGED) }
}

function key(source: Source) {
  return `${SHANAI_TRANSCRIPT_ATTEMPT_PREFIX}${source.id}:${createHash('sha256').update(source.audioPath).digest('hex')}`
}

async function read(tx: Prisma.TransactionClient, source: Source): Promise<Attempt | null> {
  const row = await tx.systemSetting.findUnique({ where: { key: key(source) } })
  if (!row) return null
  const a = JSON.parse(row.value) as Attempt
  if (a.version !== 1 || a.id !== source.id || a.userId !== source.userId || a.audioPath !== source.audioPath ||
    typeof a.token !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(a.token) ||
    !['prepared', 'submitting', 'polling', 'complete', 'failed', 'uncertain'].includes(a.phase) ||
    !Number.isFinite(a.expiresAt) || !Number.isFinite(a.durationSec) ||
    (a.jobId !== null && (typeof a.jobId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(a.jobId)))) {
    throw new Error('文字起こしの処理記録を確認できません')
  }
  return a
}

async function write(tx: Prisma.TransactionClient, a: Attempt) {
  const value = JSON.stringify(a)
  await tx.systemSetting.upsert({ where: { key: key(a) }, create: { key: key(a), value }, update: { value } })
}

function reservation(a: Attempt): TranscriptReservation {
  return { ok: true, action: a.jobId ? 'poll' : 'submit', jobId: a.jobId,
    context: { id: a.id, userId: a.userId, audioPath: a.audioPath, token: a.token, durationSec: a.durationSec } }
}

/** Called under the interview lifecycle lock, before any new quota reservation. */
export async function existingTranscriptAttempt(tx: Prisma.TransactionClient, source: Source, current: Current, now = new Date()): Promise<TranscriptReservation | null> {
  if (current.audioPath !== source.audioPath) return { ok: false, changed: true, reason: RECORDING_CHANGED }
  if (current.transcriptStatus === 'done') return { ok: true, action: 'done' }
  let a = await read(tx, source)
  // Adopt jobs created before durable attempts were introduced, without another charge/run.
  if (current.transcriptJobId && (!a || !a.jobId) && current.transcriptStatus !== 'failed') {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(current.transcriptJobId)) throw new Error('文字起こしジョブを確認できません')
    a = { ...source, version: 1, token: a?.token || randomUUID(), phase: 'polling', expiresAt: now.getTime(), jobId: current.transcriptJobId, durationSec: current.audioDurationSec || 0 }
    await write(tx, a)
  }
  if (a?.jobId && a.phase !== 'failed') {
    await tx.shanaiInterview.update({ where: { id: source.id }, data: { transcriptStatus: 'processing', transcriptJobId: a.jobId, transcriptError: null } })
    return reservation(a)
  }
  if (a?.phase === 'prepared') {
    if (a.expiresAt > now.getTime()) return { ok: false, pending: true }
    // No POST was authorized: reclaim the same reserved run, with a fresh execution token.
    a = { ...a, token: randomUUID(), expiresAt: now.getTime() + PREPARE_LEASE_MS }
    await write(tx, a)
    await tx.shanaiInterview.update({ where: { id: source.id }, data: { transcriptStatus: 'processing', transcriptError: null } })
    return reservation(a)
  }
  if (a?.phase === 'submitting' && a.expiresAt > now.getTime()) return { ok: false, pending: true }
  if (a?.phase === 'submitting' || a?.phase === 'uncertain' ||
    (!a && ['processing', 'uncertain'].includes(current.transcriptStatus))) {
    a = a || { ...source, version: 1, token: randomUUID(), phase: 'uncertain', expiresAt: now.getTime(), jobId: null, durationSec: current.audioDurationSec || 0 }
    await write(tx, { ...a, phase: 'uncertain' })
    await tx.shanaiInterview.update({ where: { id: source.id }, data: { transcriptStatus: 'uncertain', transcriptError: SUBMISSION_UNCERTAIN } })
    return { ok: false, uncertain: true, reason: SUBMISSION_UNCERTAIN }
  }
  if (a?.phase === 'complete') return { ok: false, changed: true, reason: RECORDING_CHANGED }
  return null
}

export async function createTranscriptAttempt(tx: Prisma.TransactionClient, source: Source, durationSec: number, now = new Date()): Promise<TranscriptReservation> {
  const a: Attempt = { ...source, version: 1, token: randomUUID(), phase: 'prepared', expiresAt: now.getTime() + PREPARE_LEASE_MS, jobId: null, durationSec }
  await write(tx, a)
  return reservation(a)
}

async function locked<T>(context: TranscriptContext, fn: (tx: Prisma.TransactionClient, a: Attempt | null) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await lockShanaiStorage(tx, context.id)
    const a = await read(tx, context)
    return fn(tx, a?.token === context.token ? a : null)
  })
}

async function current(tx: Prisma.TransactionClient, c: TranscriptContext) {
  return tx.shanaiInterview.findFirst({ where: { id: c.id, userId: c.userId, audioPath: c.audioPath } })
}

/** This durable transition must finish before the adapter performs its POST. */
export async function authorizeTranscriptSubmission(c: TranscriptContext, now = new Date()) {
  const allowed = await locked(c, async (tx, a) => {
    if (!a || a.phase !== 'prepared' || a.expiresAt <= now.getTime() || !await current(tx, c)) return false
    await write(tx, { ...a, phase: 'submitting', expiresAt: now.getTime() + SUBMIT_WAIT_MS })
    await tx.shanaiInterview.update({ where: { id: c.id }, data: { audioDurationSec: a.durationSec } })
    return true
  })
  if (!allowed) throw new ShanaiRecordingChangedError()
}

export async function rememberTranscriptJob(c: TranscriptContext, jobId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) throw new Error('文字起こしジョブを確認できません')
  const active = await locked(c, async (tx, a) => {
    if (!a || !['submitting', 'uncertain'].includes(a.phase)) return false
    // Keep the received ID even if a replacement retired this generation; never attach it to the new audio.
    await write(tx, { ...a, phase: 'polling', jobId })
    if (!await current(tx, c)) return false
    await tx.shanaiInterview.update({ where: { id: c.id }, data: { transcriptStatus: 'processing', transcriptJobId: jobId, transcriptError: null } })
    return true
  })
  if (!active) throw new ShanaiRecordingChangedError()
}

export async function completeTranscriptAttempt(c: TranscriptContext, jobId: string | null, segments: Prisma.InputJsonValue): Promise<'saved' | 'already' | 'stale'> {
  return locked(c, async (tx, a) => {
    const row = a && await current(tx, c)
    if (!a || !row || !jobId || a.jobId !== jobId || row.transcriptJobId !== jobId) return 'stale'
    if (a.phase === 'complete' && row.transcriptStatus === 'done') return 'already'
    if (a.phase !== 'polling') return 'stale'
    await tx.shanaiInterview.update({ where: { id: c.id }, data: { transcriptStatus: 'done', transcriptSegments: segments, transcriptError: null, status: 'FACTS' } })
    await write(tx, { ...a, phase: 'complete' })
    return 'saved'
  })
}

export async function failTranscriptAttempt(c: TranscriptContext, terminal: boolean, message: string): Promise<'stale' | 'pending' | 'uncertain' | 'failed'> {
  return locked(c, async (tx, a) => {
    if (!a || !await current(tx, c)) return 'stale'
    if (a.phase === 'complete') return 'pending'
    if (a.phase === 'failed') return 'failed'
    if (a.jobId && !terminal) return 'pending'
    if (!a.jobId && ['submitting', 'uncertain'].includes(a.phase)) {
      await write(tx, { ...a, phase: 'uncertain' })
      await tx.shanaiInterview.update({ where: { id: c.id }, data: { transcriptStatus: 'uncertain', transcriptError: SUBMISSION_UNCERTAIN } })
      return 'uncertain'
    }
    // A pre-POST error can safely reuse its reserved run; a terminal provider job consumes its attempt.
    await write(tx, a.phase === 'prepared' ? { ...a, expiresAt: 0 } : { ...a, phase: 'failed' })
    await tx.shanaiInterview.update({ where: { id: c.id }, data: { transcriptStatus: 'failed', transcriptError: message, transcriptJobId: null } })
    return 'failed'
  })
}
