import { createHash } from 'node:crypto'
import { HR_DETAIL_CHUNK_CHARACTERS, HR_DETAIL_PACKET_BYTES, type HrDetailPacket } from '@/lib/hr/evaluation-detail-transfer'
export class HrDetailTransferError extends Error {
  constructor(public readonly status: 400 | 409) { super('評価データが更新されたか、取得情報を確認できません。最初から再取得してください。') }
}
/** Caller must check current actor, organization and evaluation access on every page, including continuations. */
export function makeHrEvaluationDetailPacket(
  value: unknown, scope: { actor: string; organizationId: string; evaluationId: string }, cursor: string | null,
): HrDetailPacket {
  if (!scope.actor || !scope.organizationId || !scope.evaluationId) throw new HrDetailTransferError(400)
  const text = JSON.stringify(value)
  if (!text) throw new HrDetailTransferError(400)
  const digest = (input: string) => createHash('sha256').update(input).digest('hex')
  const revision = digest(text), scopeRevision = digest(JSON.stringify([scope.actor, scope.organizationId, scope.evaluationId, revision]))
  let offset = 0
  if (cursor !== null) {
    const match = /^([a-f0-9]{64}):(0|[1-9][0-9]*)$/.exec(cursor)
    if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) === 0) throw new HrDetailTransferError(400)
    if (match[1] !== scopeRevision) throw new HrDetailTransferError(409)
    offset = Number(match[2])
    if (offset >= text.length || offset % HR_DETAIL_CHUNK_CHARACTERS !== 0) throw new HrDetailTransferError(400)
  }
  const data = text.slice(offset, offset + HR_DETAIL_CHUNK_CHARACTERS), end = offset + data.length
  const packet: HrDetailPacket = { protocol: 'hr-evaluation-detail-v1', evaluationId: scope.evaluationId, organizationId: scope.organizationId,
    revision, offset, total: text.length, data, next: end < text.length ? scopeRevision + ':' + end : null }
  // JSON escaping can expand a character sixfold. Check actual bytes, including metadata.
  if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > HR_DETAIL_PACKET_BYTES) throw new HrDetailTransferError(400)
  return packet
}
