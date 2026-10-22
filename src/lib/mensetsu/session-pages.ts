import { readMensetsuStaffJson } from '@/lib/mensetsu/staff-request-client'
import type { WorkspaceProof } from '@/lib/organization-workspace-selection'

export type MensetsuSessionPage<T> = {
  sessions: T[]
  total: number
  nextCursor: string | null
}

export function parseMensetsuSessionPage<T extends { id: string }>(data: MensetsuSessionPage<T>): MensetsuSessionPage<T> {
  if (!data || !Array.isArray(data.sessions) || data.sessions.length > 200 ||
      !Number.isSafeInteger(data.total) || data.total < 0 ||
      (data.nextCursor !== null && (typeof data.nextCursor !== 'string' || !data.nextCursor)) ||
      data.sessions.some((session) => !session || typeof session.id !== 'string' || !session.id) ||
      (data.nextCursor !== null && (data.sessions.length !== 200 || data.nextCursor !== data.sessions[data.sessions.length - 1].id))) {
    throw new Error('面接一覧の応答が正しくありません')
  }
  return data
}

export function appendMensetsuSessionPage<T extends { id: string }>(
  existing: T[], page: MensetsuSessionPage<T>, expectedTotal: number
): T[] {
  parseMensetsuSessionPage(page)
  if (page.total !== expectedTotal) throw new Error('面接一覧が更新されました。再読み込みしてください')
  const ids = new Set(existing.map((session) => session.id))
  for (const session of page.sessions) {
    if (ids.has(session.id)) throw new Error('面接一覧が更新されました。再読み込みしてください')
    ids.add(session.id)
  }
  const merged = existing.concat(page.sessions)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('面接一覧を最後まで読み込めませんでした。再読み込みしてください')
  }
  return merged
}

export async function fetchMensetsuSessionPage<T extends { id: string }>(proof: WorkspaceProof, cursor?: string | null): Promise<MensetsuSessionPage<T>> {
  if (!proof.current()) throw new Error('組織の確認が切り替わりました')
  const url = cursor ? `/api/mensetsu/sessions?cursor=${encodeURIComponent(cursor)}` : '/api/mensetsu/sessions'
  const page = parseMensetsuSessionPage<T>(await readMensetsuStaffJson(proof, url))
  if (!proof.current()) throw new Error('組織の確認が切り替わりました')
  return page
}
