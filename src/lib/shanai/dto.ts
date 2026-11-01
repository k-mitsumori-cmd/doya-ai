// ============================================
// ドヤ社内インタビュー 画面へ返す形
// ============================================
import type { ShanaiArticle, ShanaiFact, ShanaiInterview, ShanaiPhoto } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { checkSurvey } from './survey'
import { getSignedFileUrl } from './storage'
import type { ArticleBlock, SurveyAnswers, TranscriptSegmentDto } from './types'

export async function photoDto(p: ShanaiPhoto) {
  const url = await getSignedFileUrl(p.storagePath, 3600).catch(() => null)
  return { id: p.id, usage: p.usage, caption: p.caption, sortOrder: p.sortOrder, url }
}

export function factDto(f: ShanaiFact) {
  return { id: f.id, sourceType: f.sourceType, sourceRef: f.sourceRef, category: f.category, statement: f.statement, quote: f.quote, approved: f.approved }
}

export function articleDto(a: ShanaiArticle) {
  return {
    id: a.id,
    version: a.version,
    title: a.title,
    lead: a.lead,
    catchphrase: a.catchphrase,
    blocks: (a.blocks as unknown as ArticleBlock[]) || [],
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

export function interviewSummaryDto(i: ShanaiInterview & { articles?: { id: string; title: string; version: number }[]; photos?: { id: string }[] }) {
  return {
    id: i.id,
    mode: i.mode,
    status: i.status,
    intervieweeName: i.intervieweeName,
    department: i.department,
    position: i.position,
    latestTitle: i.articles?.[0]?.title ?? null,
    photoCount: i.photos?.length ?? 0,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }
}

/** 詳細画面用。写真の署名付きURL・事実・最新の記事まで含める */
export async function interviewDetailDto(id: string, userId: string) {
  const i = await prisma.shanaiInterview.findFirst({
    where: { id, userId },
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      facts: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      articles: { orderBy: { version: 'desc' }, take: 1, where: { NOT: { title: '生成中' } } },
    },
  })
  if (!i) return null
  const answers = (i.surveyAnswers as unknown as SurveyAnswers) || {}
  const segments = (i.transcriptSegments as unknown as TranscriptSegmentDto[]) || []
  return {
    id: i.id,
    mode: i.mode,
    status: i.status,
    intervieweeName: i.intervieweeName,
    department: i.department,
    position: i.position,
    joinYear: i.joinYear,
    purpose: i.purpose,
    tone: i.tone,
    serviceSourceIds: (i.serviceSourceIds as unknown as string[]) || [],
    roleInService: i.roleInService,
    survey: {
      token: i.surveyToken,
      answers,
      submittedAt: i.surveySubmittedAt?.toISOString() ?? null,
      check: checkSurvey(answers),
    },
    audio: {
      uploaded: !!i.audioPath,
      size: i.audioSize,
      durationSec: i.audioDurationSec,
      status: i.transcriptStatus,
      error: i.transcriptError,
      runs: i.transcriptRuns,
      segments,
    },
    photos: await Promise.all(i.photos.map(photoDto)),
    facts: i.facts.map(factDto),
    article: i.articles[0] ? articleDto(i.articles[0]) : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }
}
