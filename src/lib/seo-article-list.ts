import { Prisma } from '@prisma/client'

export type SeoListOwner = { userId: string } | { userId: null; guestId: string }
export function parseSeoListQuery(params: URLSearchParams) {
  const q = (params.get('q') ?? '').trim()
  const status = params.get('status') ?? 'ALL'
  if (q.length > 200 || !['ALL', 'RUNNING', 'DONE', 'DRAFT', 'ERROR'].includes(status)) throw new Error('Invalid search')
  let cursor: { id: string; at: Date } | null = null
  if (params.has('cursor')) {
    const raw = params.get('cursor')!
    if (!raw || raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid cursor')
    const data = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!data || data.v !== 1 || data.q !== q || data.status !== status || typeof data.id !== 'string' || !data.id || data.id.length > 128 || typeof data.at !== 'string') throw new Error('Invalid cursor')
    const at = new Date(data.at)
    if (!Number.isFinite(+at) || at.toISOString() !== data.at) throw new Error('Invalid cursor')
    cursor = { id: data.id, at }
  }
  return { q, status, cursor }
}

export async function readSeoArticleList(db: Prisma.TransactionClient, owner: SeoListOwner, query: ReturnType<typeof parseSeoListQuery>) {
  const owned = owner.userId ? Prisma.sql`a."userId" = ${owner.userId}` : Prisma.sql`a."userId" IS NULL AND a."guestId" = ${'guestId' in owner ? owner.guestId : ''}`
  const pattern = '%' + query.q.replace(/[\\%_]/g, '\\$&') + '%'
  const search = query.q ? Prisma.sql`(a.title ILIKE ${pattern} OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(a.keywords) = 'array' THEN a.keywords ELSE '[]'::jsonb END) AS kw(value) WHERE kw.value ILIKE ${pattern}))` : Prisma.sql`TRUE`
  const status = query.status === 'ALL' ? Prisma.sql`TRUE` : query.status === 'DONE' ? Prisma.sql`a.status IN ('DONE', 'EXPORTED')` : Prisma.sql`a.status = ${query.status}`
  const after = query.cursor ? Prisma.sql`AND (a."createdAt", a.id) < ((${query.cursor.at}::timestamptz AT TIME ZONE 'UTC'), ${query.cursor.id})` : Prisma.empty
  const stats = await db.$queryRaw<{ total: bigint; running: bigint; done: bigint; draft: bigint; matched: bigint }[]>(Prisma.sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE a.status = 'RUNNING') AS running,
      count(*) FILTER (WHERE a.status IN ('DONE','EXPORTED')) AS done,
      count(*) FILTER (WHERE a.status = 'DRAFT') AS draft,
      count(*) FILTER (WHERE ${search} AND ${status}) AS matched FROM "SeoArticle" a WHERE ${owned}`)
  const rows = await db.$queryRaw<{ id: string; createdAt: Date }[]>(Prisma.sql`
    SELECT a.id, a."createdAt" FROM "SeoArticle" a WHERE ${owned} AND ${search} AND ${status} ${after}
    ORDER BY a."createdAt" DESC, a.id DESC LIMIT 51`)
  const page = rows.slice(0, 50)
  const articles = await db.seoArticle.findMany({ where: { ...owner, id: { in: page.map(row => row.id) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, keywords: true, status: true, targetChars: true, createdAt: true, updatedAt: true,
      jobs: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, status: true, progress: true, step: true } },
      images: { where: { kind: 'BANNER' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, kind: true, createdAt: true } },
    },
  })
  const last = page.at(-1)
  const nextCursor = rows.length > 50 && last ? Buffer.from(JSON.stringify({ v: 1, id: last.id, at: last.createdAt.toISOString(), q: query.q, status: query.status })).toString('base64url') : null
  const counts = { total: Number(stats[0].total), running: Number(stats[0].running), done: Number(stats[0].done), draft: Number(stats[0].draft) }
  return { articles: articles.map(article => ({ ...article, keywords: Array.isArray(article.keywords) ? article.keywords.filter((k): k is string => typeof k === 'string') : [] })), nextCursor, counts, matched: Number(stats[0].matched) }
}
