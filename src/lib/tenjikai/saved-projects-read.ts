// 保存された出展条件の事実だけを読む。生成成功・準備進捗・画面の復元は保証しない。
// user tenant / 書込・provider・自動組織作成なし。Home接続前の独立read。
import type { PrismaClient } from '@prisma/client'

const DAY_MS = 86_400_000
const JST_OFFSET_MS = 9 * 3_600_000
const MAX_PROJECTS = 20
const WINDOW_DAYS = 60
const ENTRY_HREF = '/tenjikai' as const

export interface SavedTenjikaiProject {
  key: `tenjikai:project:${string}`
  /** 保存された案件名。同じ展示会・会期でも案件を区別する。 */
  projectName: string
  eventName: string
  /** 会期初日のJST日付。保存された会期であり、準備完了日ではない。 */
  eventDate: string
  daysUntil: number
}

export type SavedTenjikaiProjects =
  | { state: 'ready'; items: SavedTenjikaiProject[]; href: typeof ENTRY_HREF }
  | { state: 'error'; items: null; href: typeof ENTRY_HREF }

export interface SavedTenjikaiReadCtx {
  db: Pick<PrismaClient, 'tenjikaiProject'>
  userId: string
}

/** JSTの今日〜60日後に始まる、保存済みの出展条件。空と読取失敗は区別する。 */
export async function readSavedTenjikaiProjects(ctx: SavedTenjikaiReadCtx, now = new Date()): Promise<SavedTenjikaiProjects> {
  const unavailable: SavedTenjikaiProjects = { state: 'error', items: null, href: ENTRY_HREF }
  const reference = now.getTime()
  if (typeof ctx.userId !== 'string' || !ctx.userId.trim() || !Number.isFinite(reference)) return unavailable
  const todayOrdinal = Math.floor((reference + JST_OFFSET_MS) / DAY_MS)
  const today = new Date(todayOrdinal * DAY_MS - JST_OFFSET_MS)
  try {
    const projects = await ctx.db.tenjikaiProject.findMany({
      where: { userId: ctx.userId, eventStart: { gte: today, lt: new Date(today.getTime() + (WINDOW_DAYS + 1) * DAY_MS) } },
      // Projectはprovider実行前に保存され、analysis保存も失敗し得る。成功状態を推測しない。
      select: { id: true, name: true, eventName: true, eventStart: true },
      orderBy: [{ eventStart: 'asc' }, { id: 'asc' }],
      take: MAX_PROJECTS,
    })
    return {
      state: 'ready', href: ENTRY_HREF,
      items: projects.map(project => {
        const eventOrdinal = Math.floor((project.eventStart.getTime() + JST_OFFSET_MS) / DAY_MS)
        return {
          key: `tenjikai:project:${project.id}`,
          projectName: project.name,
          eventName: project.eventName,
          eventDate: new Date(eventOrdinal * DAY_MS).toISOString().slice(0, 10),
          daysUntil: eventOrdinal - todayOrdinal,
        }
      }),
    }
  } catch {
    return unavailable
  }
}
