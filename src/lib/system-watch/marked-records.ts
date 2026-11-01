// 自動点検（system-watch の B1）が作った記録の ID を残し、利用者の枠の数え方から外すための部品。
// 2026-10-26 ユーザー決定（A）: 「【自動点検】」の付いた商談準備は、月の枠（プロは月50件）に数えない。
//
// ⚠️ 名前の印（【自動点検】）だけで外すと偽れる。商談準備の名前は相手のサイトの社名から決まるので、
//    社名を「【自動点検】…」にしたサイトを作れば枠を抜けられてしまう。
//    そこで、合図（watch-gate.ts の isSystemWatchFor）を確かめたツールのルートだけが、作った記録の ID をここに残す。
//    数えるときは、その ID を除く。外の人は合図を作れないので、ID の一覧は偽れない。DB の列は足さない。
//
// 置き場所: SystemSetting（watch:v1:marked:<種類>:<組織などの ID>:<日本時間の YYYY-MM>）に ID の JSON 配列。
// 月の枠と同じ月の区切り（日本時間）で分ける。1か月に30件ほどなので、上限 400 件で切る。

export type MarkedKind = 'shodan-preparation' | 'quote-document' | 'doyaslide-project'

/** SystemSetting を読み書きできるもの（prisma でもトランザクションの tx でもよい） */
type SettingDb = {
  systemSetting: {
    findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>
    upsert(args: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }): Promise<unknown>
  }
}

const MAX_IDS = 400

/** 日本時間の YYYY-MM */
export function jstMonth(at: Date = new Date()): string {
  return new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 7)
}

export function markedKey(kind: MarkedKind, scopeId: string, month: string): string {
  return `watch:v1:marked:${kind}:${scopeId}:${month}`
}

function parseIds(value: string | undefined | null): string[] {
  if (!value) return []
  try {
    const v = JSON.parse(value)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 自動点検が作った記録として ID を残す。⚠️ 呼ぶのは、isSystemWatchFor(req.headers, 本人の userId) が true のときだけ。
 * 作った記録と同じトランザクションの tx を渡すと、記録と印が一緒に残る。
 */
export async function markSystemWatchRecord(db: SettingDb, kind: MarkedKind, scopeId: string, id: string, at: Date = new Date()): Promise<void> {
  const key = markedKey(kind, scopeId, jstMonth(at))
  const row = await db.systemSetting.findUnique({ where: { key } })
  const ids = parseIds(row?.value)
  if (ids.includes(id)) return
  const value = JSON.stringify([...ids, id].slice(-MAX_IDS))
  await db.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

/** 今月（日本時間）に自動点検が作った記録の ID。月の枠を数えるときに除く */
export async function systemWatchRecordIds(db: SettingDb, kind: MarkedKind, scopeIds: string[], at: Date = new Date()): Promise<string[]> {
  const month = jstMonth(at)
  const rows = await Promise.all(scopeIds.map(s => db.systemSetting.findUnique({ where: { key: markedKey(kind, s, month) } })))
  return rows.flatMap(r => parseIds(r?.value))
}

/** Prisma の where に足す条件（ID が無ければ何も足さない） */
export function excludeIds(ids: string[]): { id?: { notIn: string[] } } {
  return ids.length ? { id: { notIn: ids } } : {}
}
