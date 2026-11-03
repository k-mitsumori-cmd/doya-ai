export type GalleryItem = {
  id: string
  thumbUrl: string
  createdAt: string
  category: string
  purpose: string
  size: string
  keyword: string
  pattern: string
  creator: string
  creatorImage: string | null
  lqip: string
}

export type GalleryPage = { items: GalleryItem[]; nextCursor: string | null }
export type GalleryCache = { items: GalleryItem[]; cursor: string | null; ts: number }

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function isGalleryItem(value: unknown): value is GalleryItem {
  const item = record(value)
  if (!item || typeof item.id !== 'string' || !item.id) return false
  const strings = ['thumbUrl', 'createdAt', 'category', 'purpose', 'size', 'keyword', 'pattern', 'creator', 'lqip'] as const
  if (!strings.every(key => typeof item[key] === 'string')) return false
  if (!(item.creatorImage === null || typeof item.creatorImage === 'string')) return false
  if (!item.thumbUrl) return false
  const time = Date.parse(item.createdAt as string)
  return Number.isFinite(time) && new Date(time).toISOString() === item.createdAt
}

export function parseGalleryPage(value: unknown): GalleryPage | null {
  const page = record(value)
  if (!page || !Array.isArray(page.items) || !page.items.every(isGalleryItem)) return null
  const items = page.items
  if (new Set(items.map(item => item.id)).size !== items.length) return null
  const cursor = page.nextCursor
  if (cursor !== null && (typeof cursor !== 'string' || !cursor || items[items.length - 1]?.id !== cursor)) return null
  return {
    items: items.map(item => ({
      id: item.id, thumbUrl: item.thumbUrl, createdAt: item.createdAt,
      category: item.category, purpose: item.purpose, size: item.size,
      keyword: item.keyword, pattern: item.pattern, creator: item.creator,
      creatorImage: item.creatorImage, lqip: item.lqip,
    })),
    nextCursor: cursor,
  }
}

export function parseGalleryCache(value: unknown, now: number): GalleryCache | null {
  const cache = record(value)
  if (!cache || typeof cache.ts !== 'number' || !Number.isSafeInteger(cache.ts) || cache.ts < 0 || cache.ts > now || !Number.isFinite(now)) return null
  const page = parseGalleryPage({ items: cache.items, nextCursor: cache.cursor })
  return page ? { items: page.items, cursor: page.nextCursor, ts: cache.ts } : null
}
