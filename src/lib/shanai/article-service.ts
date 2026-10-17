// ============================================
// ドヤ社内インタビュー 記事の下書き生成（API とエージェント道具の共通処理）
// ============================================
// ⚠️ 枠の確保は LLM 呼び出しの前。失敗したら記事行と台帳を消して枠を戻す
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import type { QuotaResult } from '@/lib/plan-limit'
import { ownInterview, releaseArticle, reserveArticle } from './access'
import { articleDto } from './dto'
import { generateArticle } from './generate'
import type { ShanaiPurpose, ShanaiTone } from './types'

export const MIN_PERSON_FACTS = 5

export type DraftArticleResult =
  | { ok: true; article: ReturnType<typeof articleDto> }
  | { ok: false; reason: 'not_found' | 'not_enough_facts' | 'failed'; message: string }
  | { ok: false; reason: 'quota'; quota: QuotaResult; message: string }

export async function draftArticle(userId: string, interviewId: string): Promise<DraftArticleResult> {
  const interview = await prisma.shanaiInterview.findFirst({
    where: ownInterview(userId, interviewId),
    include: { facts: { where: { approved: true }, orderBy: { sortOrder: 'asc' } } },
  })
  if (!interview) return { ok: false, reason: 'not_found', message: 'インタビューが見つかりません。' }
  if (interview.facts.filter((f) => f.sourceType !== 'company').length < MIN_PERSON_FACTS) {
    return { ok: false, reason: 'not_enough_facts', message: '記事にするには、確認済みの事実が5件以上必要です。先に事実を抽出・確認してください。' }
  }

  const reserved = await reserveArticle(userId, interviewId)
  if (!reserved.ok) return { ok: false, reason: 'quota', quota: reserved.quota, message: reserved.quota.reason || '利用上限に達しました。' }

  try {
    const company = await prisma.shanaiCompany.findUnique({ where: { userId }, include: { sources: { select: { id: true, label: true, url: true } } } })
    const serviceIds = new Set((interview.serviceSourceIds as unknown as string[]) || [])
    const serviceNames = (company?.sources || []).filter((s) => serviceIds.has(s.id)).map((s) => s.label || new URL(s.url).hostname)

    const article = await generateArticle({
      companyName: company?.name || '',
      intervieweeName: interview.intervieweeName,
      department: interview.department,
      position: interview.position,
      joinYear: interview.joinYear,
      purpose: interview.purpose as ShanaiPurpose,
      tone: interview.tone as ShanaiTone,
      roleInService: interview.roleInService,
      serviceNames,
      facts: interview.facts.map((f) => ({ id: f.id, sourceType: f.sourceType, category: f.category, statement: f.statement, quote: f.quote })),
    })

    const saved = await prisma.shanaiArticle.update({
      where: { id: reserved.articleId },
      data: { title: article.title, lead: article.lead, catchphrase: article.catchphrase, blocks: article.blocks as any, model: 'default' },
    })
    await prisma.shanaiInterview.update({ where: { id: interviewId }, data: { status: 'DONE' } })
    void recordServiceUsage({
      userId,
      serviceId: 'shanai',
      action: '社内インタビュー記事を生成',
      summary: article.title,
      metadata: { version: reserved.version, blocks: article.blocks.length, unsupported: article.blocks.filter((b) => b.unsupported).length },
    })
    return { ok: true, article: articleDto(saved) }
  } catch (e) {
    console.error('[shanai/draftArticle] failed', (e as Error)?.name)
    await releaseArticle(reserved.articleId).catch(() => {})
    return { ok: false, reason: 'failed', message: '記事の生成に失敗しました。利用回数は消費していません。時間をおいてもう一度お試しください。' }
  }
}
