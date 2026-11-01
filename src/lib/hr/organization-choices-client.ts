import { readBillingResponse } from '@/lib/billing-response-client'
export type HrOrganizationChoice = { organizationId: string; memberId: string; role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'; name: string }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
/** No partial list is exposed; membership/name changes between packets require a fresh read. */
export async function loadHrOrganizationChoices(actor: string, signal: AbortSignal): Promise<HrOrganizationChoice[]> {
  const controller = new AbortController(), cancel = () => controller.abort()
  if (signal.aborted) throw Error('組織一覧の取得を中止しました。')
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, 35000)
  let revision: string | undefined, total: number | undefined, offset = 0, cursor: string | null = null
  const chunks: string[] = []
  try {
    do {
      const response = await readBillingResponse('/api/hr/organization?format=choices' + (cursor === null ? '' : '&cursor=' + encodeURIComponent(cursor)), { method: 'GET', credentials: 'same-origin', redirect: 'error' }, controller.signal)
      const data = response.data
      if (controller.signal.aborted || !response.ok || !object(data) || Object.keys(data).sort().join(',') !== 'actor,chunk,format,nextCursor,offset,revision,success,totalCharacters' || data.success !== true || data.format !== 'hr-organization-choices-v1' || data.actor !== actor || typeof data.revision !== 'string' || !/^[a-f0-9]{64}$/.test(data.revision) || !Number.isSafeInteger(data.totalCharacters) || (data.totalCharacters as number) < 2 || data.offset !== offset || typeof data.chunk !== 'string' || !data.chunk.length || data.chunk.length > 8192 || !(data.nextCursor === null || typeof data.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(data.nextCursor))) throw Error('所属組織を確認できませんでした。再取得してください。')
      revision ??= data.revision; total ??= data.totalCharacters as number
      if (data.revision !== revision || data.totalCharacters !== total || offset + data.chunk.length > total) throw Error('所属組織が更新されました。再取得してください。')
      chunks.push(data.chunk); offset += data.chunk.length
      if (data.nextCursor === null ? offset !== total : offset >= total || data.chunk.length !== 8192) throw Error('組織一覧の続きが正しくありません。')
      cursor = data.nextCursor as string | null
    } while (cursor !== null)
    if (controller.signal.aborted) throw Error('組織一覧の取得を中止しました。')
    const rows: unknown = JSON.parse(chunks.join('')), organizations = new Set<string>(), members = new Set<string>()
    if (!Array.isArray(rows)) throw Error('組織一覧が正しくありません。')
    for (const row of rows) {
      if (!object(row) || Object.keys(row).sort().join(',') !== 'memberId,name,organizationId,role' || typeof row.organizationId !== 'string' || !row.organizationId || typeof row.memberId !== 'string' || !row.memberId || typeof row.name !== 'string' || !['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(row.role as string) || organizations.has(row.organizationId) || members.has(row.memberId)) throw Error('組織一覧が正しくありません。')
      organizations.add(row.organizationId); members.add(row.memberId)
    }
    return rows as HrOrganizationChoice[]
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort() }
}
