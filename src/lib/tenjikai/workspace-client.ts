import { readGenerationEnvelope } from './generation-client'
import { readFullTenjikaiWorkspaceDto, type FullTenjikaiWorkspace } from './workspace-dto'

export type SavedWorkspaceResult =
  | { state: 'ready_full'; workspace: FullTenjikaiWorkspace }
  | { state: 'ready_partial' | 'not_found' | 'unavailable' | 'unauthenticated' | 'auth_changed' }

/** Bounded private reader; an invalid/late body is never adopted as a saved workspace. */
export async function readSavedTenjikaiWorkspace(actorId: string, projectId: string, signal: AbortSignal): Promise<SavedWorkspaceResult> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(actorId) || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) return { state: 'unavailable' }
  const url = `/api/tenjikai/projects/${encodeURIComponent(projectId)}/workspace?expectedActor=${encodeURIComponent(actorId)}`
  try {
    const response = await readGenerationEnvelope({ method: 'GET' }, signal, url)
    if (response.status === 401) return { state: 'unauthenticated' }
    if (response.status === 409) return { state: 'auth_changed' }
    if (!response.body || typeof response.body !== 'object' || Array.isArray(response.body)) return { state: 'unavailable' }
    const body = response.body as Record<string, unknown>
    if (response.status === 200 && body.state === 'ready_full' && body.actorId === actorId && body.projectId === projectId) {
      const workspace = readFullTenjikaiWorkspaceDto(body.workspace)
      return workspace?.actorId === actorId && workspace.projectId === projectId ? { state: 'ready_full', workspace } : { state: 'unavailable' }
    }
    if (response.status === 200 && body.state === 'ready_partial' && body.actorId === actorId && body.projectId === projectId) return { state: 'ready_partial' }
    if (response.status === 404 && body.state === 'not_found') return { state: 'not_found' }
    return { state: 'unavailable' }
  } catch { return { state: 'unavailable' } }
}
