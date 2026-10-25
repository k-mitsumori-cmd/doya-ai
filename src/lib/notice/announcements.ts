// ============================================
// 新機能のお知らせ（提案リスト (10)）
// ============================================
// 載せた日から 30 日だけ、ログインした人に1回ずつ出す（once）。古いものから順に足す。
// ⚠️ 文面は yomiyasu の原則で書く。絵文字は使わない。中身が本番に出てから載せる。
// ⚠️ id は変えない（変えると、見た人にもう一度出る）。

export interface Announcement {
  id: string
  /** 載せた日（YYYY-MM-DD、日本時間） */
  date: string
  title: string
  body: string
  /** 「試してみる」の行き先 */
  href?: string
  /** ドヤくんの絵（/character/{pose}-256.webp） */
  pose?: string
  /** そのツールのメニューの項目に「新機能」の札を出す（tools.ts の id。提案リスト (11)） */
  toolId?: string
}

export const ANNOUNCEMENT_DAYS = 30
/** メニューの「新機能」の札を出す日数 */
export const NEW_TAG_DAYS = 7

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announce:2026-10-25-shell',
    date: '2026-10-25',
    title: 'すべてのツールを、左のメニューから行き来できるようになりました',
    body: 'ツールを移っても、メニューと最近使ったツールはそのまま残ります。パソコンでは ⌘K（Ctrl+K）で、ツールを名前で探せます。',
    pose: 'jump',
  },
]

/** 今出してよいお知らせ（載せた日から ANNOUNCEMENT_DAYS 日以内。新しいものが先） */
export function activeAnnouncements(now: Date, list: Announcement[] = ANNOUNCEMENTS): Announcement[] {
  const t = now.getTime()
  return list
    .filter((a) => {
      const start = Date.parse(`${a.date}T00:00:00+09:00`)
      return Number.isFinite(start) && t >= start && t < start + ANNOUNCEMENT_DAYS * 86_400_000
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** メニューに「新機能」の札を出すツールの id（載せた日から NEW_TAG_DAYS 日以内） */
export function newToolIds(now: Date, list: Announcement[] = ANNOUNCEMENTS): Set<string> {
  const t = now.getTime()
  const ids = list.filter((a) => {
    const start = Date.parse(`${a.date}T00:00:00+09:00`)
    return a.toolId && Number.isFinite(start) && t >= start && t < start + NEW_TAG_DAYS * 86_400_000
  }).map((a) => a.toolId as string)
  return new Set(ids)
}
