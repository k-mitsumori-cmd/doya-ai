/** Opt-in lossless JSON transport. Consumers must publish only the fully verified snapshot. */
export const HR_DETAIL_CHUNK_CHARACTERS = 262144
export const HR_DETAIL_PACKET_BYTES = 2 * 1024 * 1024
export type HrDetailPacket = {
  protocol: 'hr-evaluation-detail-v1'; evaluationId: string; organizationId: string
  revision: string; offset: number; total: number; data: string; next: string | null
}
const digestPattern = /^[a-f0-9]{64}$/
const cursorPattern = /^[a-f0-9]{64}:(0|[1-9][0-9]*)$/
const invalid = (): never => { throw Error('評価データを完全に確認できませんでした。入力を保持して再取得してください。') }
const object = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
export function readHrDetailPacket(value: unknown): HrDetailPacket {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'data,evaluationId,next,offset,organizationId,protocol,revision,total' ||
    value.protocol !== 'hr-evaluation-detail-v1' || typeof value.evaluationId !== 'string' || !value.evaluationId ||
    typeof value.organizationId !== 'string' || !value.organizationId || typeof value.revision !== 'string' || !digestPattern.test(value.revision) ||
    !Number.isSafeInteger(value.offset) || !Number.isSafeInteger(value.total) || (value.offset as number) < 0 || (value.total as number) <= 0 ||
    typeof value.data !== 'string' || value.data.length === 0 || value.data.length > HR_DETAIL_CHUNK_CHARACTERS ||
    (value.offset as number) + value.data.length > (value.total as number)) return invalid()
  const end = (value.offset as number) + value.data.length
  if (end === value.total ? value.next !== null : typeof value.next !== 'string' || !cursorPattern.test(value.next) || Number(value.next.split(':')[1]) !== end) return invalid()
  return value as HrDetailPacket
}
/** readPacket must authenticate each page and bound/decode each HTTP response before this call. */
export async function assembleHrEvaluationDetail(
  evaluationId: string, expectedOrganization: string | undefined,
  readPacket: (cursor: string | null) => Promise<unknown>, signal?: AbortSignal,
): Promise<unknown> {
  let cursor: string | null = null, revision = '', organizationId = '', total = 0, offset = 0
  const chunks: string[] = []
  do {
    if (signal?.aborted) return invalid()
    const packet = readHrDetailPacket(await readPacket(cursor))
    if (signal?.aborted || packet.evaluationId !== evaluationId || packet.offset !== offset ||
      expectedOrganization !== undefined && packet.organizationId !== expectedOrganization) return invalid()
    if (offset === 0) { revision = packet.revision; organizationId = packet.organizationId; total = packet.total }
    else if (packet.revision !== revision || packet.organizationId !== organizationId || packet.total !== total) return invalid()
    chunks.push(packet.data); offset += packet.data.length; cursor = packet.next
  } while (cursor !== null)
  if (offset !== total || signal?.aborted) return invalid()
  const text = chunks.join(''), bytes = new TextEncoder().encode(text)
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
  if (hash !== revision || signal?.aborted) return invalid()
  try { return JSON.parse(text) as unknown } catch { return invalid() }
}
