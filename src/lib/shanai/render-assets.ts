// ============================================
// ドヤ社内インタビュー サムネ・Word 出力の共通準備
// ============================================
import { prisma } from '@/lib/prisma'
import { downloadFile } from './storage'
import { renderThumbnail } from './thumbnail'

export async function loadForRender(userId: string, interviewId: string) {
  const interview = await prisma.shanaiInterview.findFirst({
    where: { id: interviewId, userId },
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      articles: { orderBy: { version: 'desc' }, take: 1, where: { NOT: { title: '生成中' } } },
    },
  })
  if (!interview) return null
  const company = await prisma.shanaiCompany.findUnique({ where: { userId }, select: { name: true, brandColor: true } })
  return { interview, article: interview.articles[0] || null, company }
}

export async function buildThumbnail(data: NonNullable<Awaited<ReturnType<typeof loadForRender>>>, catchphraseOverride?: string) {
  const { interview, article, company } = data
  const thumbPhoto = interview.photos.find((p) => p.usage === 'thumbnail') || interview.photos[0]
  const photo = thumbPhoto ? await downloadFile(thumbPhoto.storagePath) : null
  return renderThumbnail({
    photo,
    catchphrase: catchphraseOverride ?? article?.catchphrase ?? '',
    name: interview.intervieweeName,
    department: interview.department,
    position: interview.position,
    companyName: company?.name || '',
    brandColor: company?.brandColor || '#c026d3',
  })
}

export function safeFileName(name: string) {
  return (name || 'interview').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60)
}
