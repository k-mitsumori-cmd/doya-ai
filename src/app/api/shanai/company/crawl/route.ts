// POST /api/shanai/company/crawl — 登録URLを読み取り、会社プロフィールを作る
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, unauthorized } from '@/lib/shanai/access'
import { companyDto } from '@/lib/shanai/company-dto'
import { crawlCompany } from '@/lib/shanai/company'
import { recordServiceUsage } from '@/lib/service-usage'

/** 読み取りの間隔（AI要約の連打を防ぐ） */
const COOLDOWN_MS = 3 * 60 * 1000

export async function POST() {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const company = await prisma.shanaiCompany.findUnique({ where: { userId }, include: { _count: { select: { sources: true } } } })
    if (!company || company._count.sources === 0) return json({ error: '先に会社サイトのURLを登録してください。' }, 400)

    // 同時押し・連打を、更新件数で判定して1回に絞る
    const since = new Date(Date.now() - COOLDOWN_MS)
    const claimed = await prisma.shanaiCompany.updateMany({
      where: { id: company.id, OR: [{ crawledAt: null }, { crawledAt: { lt: since } }] },
      data: { crawledAt: new Date() },
    })
    if (claimed.count === 0) return json({ error: '読み取りは3分に1回までです。少し時間をおいてお試しください。' }, 429)

    const summary = await crawlCompany(company.id)
    void recordServiceUsage({
      userId,
      serviceId: 'shanai',
      action: '会社サイトを読み取り',
      summary: `${summary.pagesRead}ページ / 項目${summary.itemsAdded}件`,
      metadata: { pagesChanged: summary.pagesChanged, robotsSkipped: summary.robotsSkipped },
    })
    return json({ success: true, summary, company: await companyDto(userId) })
  } catch (e) {
    console.error('[shanai/company/crawl] failed', (e as Error)?.name)
    return json({ error: '会社サイトの読み取りに失敗しました。時間をおいてもう一度お試しください。' }, 500)
  }
}
