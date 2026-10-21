import { readGenerationEnvelope } from './generation-client'
import { readFullTenjikaiWorkspaceDto, type FullTenjikaiWorkspace } from './workspace-dto'
import type { WorkspacePatch } from './workspace-save'
export type { WorkspacePatch } from './workspace-save'

const OP = /^save\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const validSaveHandle = (value: unknown): value is string => typeof value === 'string' && OP.test(value)
export function newSaveHandle() { return 'save.' + Date.now() + '.' + crypto.randomUUID() }
export function withSaveHandle(href: string, operationId: string | null): string {
  if (!validSaveHandle(operationId)) return href
  const url = new URL(href, 'https://tenjikai.invalid')
  url.searchParams.set('saveOperation', operationId)
  return url.pathname + url.search
}
export type SaveResponse = { state: 'committed' | 'missing' | 'superseded' | 'canceled' | 'rejected' | 'outcome_unknown';
  operationId: string; projectId: string | null; workspace: FullTenjikaiWorkspace | null }

function parse(value: unknown, actor: string, operationId: string, projectId: string): SaveResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.actorId !== actor || row.operationId !== operationId ||
      !['committed', 'missing', 'superseded', 'canceled'].includes(String(row.state))) return null
  if (row.state === 'committed') {
    const workspace = readFullTenjikaiWorkspaceDto(row.workspace)
    if (!workspace || workspace.actorId !== actor || workspace.projectId !== projectId ||
        row.projectId !== projectId || row.resultRevision !== workspace.revision) return null
    return { state: 'committed', operationId, projectId, workspace }
  }
  if (row.workspace !== null || row.state === 'missing' && row.projectId !== null ||
      row.state === 'canceled' && row.projectId !== null ||
      row.state === 'superseded' && !(row.projectId === null || row.projectId === projectId)) return null
  return { state: row.state as SaveResponse['state'], operationId, projectId: row.projectId as string | null, workspace: null }
}
async function request(url: string, init: RequestInit, actor: string, operationId: string, projectId: string, signal: AbortSignal): Promise<SaveResponse> {
  try {
    const response = await readGenerationEnvelope(init, signal, url)
    const bound = parse(response.body, actor, operationId, projectId)
    if (bound) return bound
    if (!response.ok) return { state: response.status === 409 ? 'rejected' : 'outcome_unknown', operationId, projectId, workspace: null }
    return { state: 'outcome_unknown', operationId, projectId, workspace: null }
  } catch { return { state: 'outcome_unknown', operationId, projectId, workspace: null } }
}
export async function saveWorkspace(actor: string, projectId: string, revision: string, operationId: string, patch: WorkspacePatch, signal: AbortSignal) {
  return request('/api/tenjikai/projects/' + encodeURIComponent(projectId) + '/workspace/save',
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedActor: actor, expectedRevision: revision, operationId, patch }) },
    actor, operationId, projectId, signal)
}
export async function readSaveStatus(actor: string, projectId: string, operationId: string, signal: AbortSignal) {
  return request('/api/tenjikai/workspace-save/status',
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedActor: actor, operationId }) }, actor, operationId, projectId, signal)
}
export async function cancelMissingSave(actor: string, projectId: string, operationId: string, signal: AbortSignal) {
  return request('/api/tenjikai/workspace-save/status',
    { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedActor: actor, operationId }) }, actor, operationId, projectId, signal)
}
