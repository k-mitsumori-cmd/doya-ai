import { fetchOrgJson } from '@/lib/org-fetch'

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

export async function fetchMensetsuSessionPage<T extends { id: string }>(cursor?: string | null): Promise<MensetsuSessionPage<T>> {
  const url = cursor ? `/api/mensetsu/sessions?cursor=${encodeURIComponent(cursor)}` : '/api/mensetsu/sessions'
  return parseMensetsuSessionPage<T>(await fetchOrgJson(url))
}
