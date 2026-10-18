// ============================================
// ドヤ社内インタビュー インタビューの読み取り（読み取り専用）
// ============================================
// ⚠️ 統合仕様 R-4: 一覧・詳細の取得はここに集める。API route（GET /api/shanai/interviews）と
//    エージェント道具 shanai.listInterviews（agent-tools.ts）、将来のホームのカードが同じ関数を呼ぶ。
// ⚠️ どの関数も userId で絞る。他人の行は返さない
import { prisma } from '@/lib/prisma'
import { interviewDetailDto, interviewSummaryDto } from './dto'

type InterviewReader = Pick<typeof prisma, 'shanaiInterview'>

export interface InterviewSummary {
  id: string
  mode: string
  status: string
  intervieweeName: string
  department: string
  position: string
  latestTitle: string | null
  photoCount: number
  createdAt: string
  updatedAt: string
}

export interface ListInterviewsOptions {
  /** 'DONE' など。指定しなければすべて */
  status?: string
  /** 最大件数（1〜200） */
  limit?: number
}

export async function listInterviews(userId: string, opts: ListInterviewsOptions = {}, db: InterviewReader = prisma): Promise<InterviewSummary[]> {
  if (!userId) return []
  const take = Math.min(Math.max(Math.floor(opts.limit ?? 200), 1), 200)
  const rows = await db.shanaiInterview.findMany({
    where: { userId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { updatedAt: 'desc' },
    take,
    include: {
      articles: { orderBy: { version: 'desc' }, take: 1, select: { id: true, title: true, version: true }, where: { NOT: { title: '生成中' } } },
      photos: { select: { id: true } },
    },
  })
  return rows.map(interviewSummaryDto)
}

/** 件数の集計（ホームのカード用）。記事ができたもの・作業中のもの */
export async function countInterviews(userId: string, db: InterviewReader = prisma) {
  if (!userId) return { total: 0, done: 0, inProgress: 0 }
  const [total, done] = await Promise.all([
    db.shanaiInterview.count({ where: { userId } }),
    db.shanaiInterview.count({ where: { userId, status: 'DONE' } }),
  ])
  return { total, done, inProgress: total - done }
}

export async function getInterviewDetail(userId: string, id: string) {
  if (!userId) return null
  return interviewDetailDto(id, userId)
}
