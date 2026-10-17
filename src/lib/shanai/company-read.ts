// ============================================
// ドヤ社内インタビュー 会社情報の読み取り（読み取り専用）
// ============================================
// ⚠️ 統合仕様 R-4: API route と将来のエージェント道具が同じ関数を呼ぶ。ここでは書き込まない
import { prisma } from '@/lib/prisma'

export async function companyDto(userId: string, db: Pick<typeof prisma, 'shanaiCompany'> = prisma) {
  const c = await db.shanaiCompany.findUnique({
    where: { userId },
    include: {
      sources: { orderBy: { createdAt: 'asc' } },
      profileItems: { orderBy: [{ category: 'asc' }, { createdAt: 'asc' }], include: { webPage: { select: { url: true, title: true } } } },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    websiteUrl: c.websiteUrl,
    brandColor: c.brandColor,
    colors: (c.colors as unknown as string[]) || [],
    manualNote: c.manualNote || '',
    crawledAt: c.crawledAt?.toISOString() ?? null,
    sources: c.sources.map((s) => ({ id: s.id, kind: s.kind, label: s.label, url: s.url, lastCrawledAt: s.lastCrawledAt?.toISOString() ?? null, error: s.error })),
    items: c.profileItems.map((p) => ({
      id: p.id,
      category: p.category,
      statement: p.statement,
      quote: p.quote,
      origin: p.origin,
      approved: p.approved,
      sourceId: p.sourceId,
      pageUrl: p.webPage?.url ?? null,
      pageTitle: p.webPage?.title ?? null,
    })),
  }
}
