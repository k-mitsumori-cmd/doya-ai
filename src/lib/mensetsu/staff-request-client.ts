import type { WorkspaceProof } from '@/lib/organization-workspace-selection'

const READ_DEADLINE_MS = 20_000
const WRITE_DEADLINE_MS = 310_000
const UNKNOWN_WRITE = '操作結果を確認できませんでした。再送すると重複する可能性があります。最新の一覧で状態を確認してください。'
export class MensetsuWriteUnknownError extends Error {
  readonly code = 'MENSET_WRITE_OUTCOME_UNKNOWN'
  constructor() { super(UNKNOWN_WRITE); this.name = 'MensetsuWriteUnknownError' }
}

/** Bound a staff GET through both headers and body, even if fetch ignores AbortSignal. */
export async function requestMensetsuStaff(proof: WorkspaceProof, path: string, init?: RequestInit): Promise<Response> {
  if (!proof.current()) throw new Error('組織の確認が切り替わりました')
  const url = proof.api(path)
  const isRead = !init?.method || init.method.toUpperCase() === 'GET'
  const controller = new AbortController()
  let rejectStopped: (error: Error) => void = () => {}
  const stopped = new Promise<never>((_, reject) => { rejectStopped = reject })
  const cancel = () => { controller.abort(); rejectStopped(isRead ? new Error('読み込みが完了しませんでした。再読み込みしてください。') : new MensetsuWriteUnknownError()) }
  init?.signal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, isRead ? READ_DEADLINE_MS : WRITE_DEADLINE_MS)
  let dispatched = false
  try {
    if (init?.signal?.aborted) throw new Error('読み込みが中断されました')
    const read = async () => {
      dispatched = true
      const response = await globalThis.fetch(url, { ...init, signal: controller.signal })
      if (controller.signal.aborted || !proof.current()) throw new Error('組織の確認が切り替わりました')
      const body = await response.arrayBuffer()
      if (controller.signal.aborted || !proof.current()) throw new Error('組織の確認が切り替わりました')
      return new Response(response.status === 204 || response.status === 205 ? null : body,
        { status: response.status, statusText: response.statusText, headers: response.headers })
    }
    return await Promise.race([read(), stopped])
  } catch (error) {
    if (!isRead && dispatched) throw error instanceof MensetsuWriteUnknownError ? error : new MensetsuWriteUnknownError()
    throw error
  } finally {
    clearTimeout(timer)
    init?.signal?.removeEventListener('abort', cancel)
    controller.abort()
  }
}

export async function readMensetsuStaffJson<T>(proof: WorkspaceProof, path: string): Promise<T> {
  const response = await requestMensetsuStaff(proof, path, { cache: 'no-store' })
  const data = await response.json().catch(() => null)
  if (!proof.current()) throw new Error('組織の確認が切り替わりました')
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : '組織のデータを取得できませんでした')
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('組織のデータを確認できませんでした')
  return data as T
}
