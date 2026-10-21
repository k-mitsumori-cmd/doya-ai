import { organizationSelection, parseWorkspaceRead, type OrganizationSelection, type WorkspaceRead } from './organization-workspace-selection'

const MAX_BYTES = 64 * 1024
const DEADLINE_MS = 20_000

export class WorkspaceReadError extends Error {
  constructor(readonly status: number, readonly kind: 'denied' | 'unavailable') {
    super(kind === 'denied' ? 'この組織を表示する権限を確認できませんでした。' : '組織を確認できませんでした。再読み込みしてください。')
  }
}

/** An expected actor is an extra equality check. The server always authenticates its own session. */
export async function readOrganizationWorkspace(actorId: string, selected: OrganizationSelection, signal: AbortSignal): Promise<WorkspaceRead> {
  if (!actorId || selected.kind === 'invalid' || signal.aborted) throw new WorkspaceReadError(0, 'unavailable')
  const controller = new AbortController()
  let rejectStopped: (error: WorkspaceReadError) => void = () => {}
  const stopped = new Promise<never>((_, reject) => { rejectStopped = reject })
  const cancel = () => {
    controller.abort()
    rejectStopped(new WorkspaceReadError(0, 'unavailable'))
  }
  signal.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(cancel, DEADLINE_MS)
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    const read = async (): Promise<WorkspaceRead> => {
      const url = selected.kind === 'selected' ? `/api/organization-workspace/aishodan?org=${encodeURIComponent(selected.slug)}` : '/api/organization-workspace/aishodan'
      const response = await fetch(url, { cache: 'no-store', headers: { 'x-doya-workspace-actor': actorId }, signal: controller.signal })
      if (controller.signal.aborted) throw new WorkspaceReadError(0, 'unavailable')
      if (!response.ok) throw new WorkspaceReadError(response.status, response.status === 401 || response.status === 403 || response.status === 409 ? 'denied' : 'unavailable')
      if (!response.body || Number(response.headers.get('content-length')) > MAX_BYTES) throw new WorkspaceReadError(response.status, 'unavailable')
      reader = response.body.getReader()
      const parts: Uint8Array[] = []
      let size = 0
      while (true) {
        const part = await reader.read()
        if (controller.signal.aborted) throw new WorkspaceReadError(0, 'unavailable')
        if (part.done) break
        size += part.value.byteLength
        if (size > MAX_BYTES) throw new WorkspaceReadError(response.status, 'unavailable')
        parts.push(part.value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      return parseWorkspaceRead(value, actorId, selected)
    }
    return await Promise.race([read(), stopped])
  } catch (error) {
    if (error instanceof WorkspaceReadError) throw error
    throw new WorkspaceReadError(0, 'unavailable')
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
    controller.abort()
    if (reader) void (reader as ReadableStreamDefaultReader<Uint8Array>).cancel().catch(() => {})
  }
}

export function selectedWorkspaceFromUrl(search: string, remembered: string | null): OrganizationSelection {
  const explicit = organizationSelection(search)
  if (explicit.kind !== 'absent') return explicit
  return remembered === null ? explicit : organizationSelection(`?org=${encodeURIComponent(remembered)}`)
}
