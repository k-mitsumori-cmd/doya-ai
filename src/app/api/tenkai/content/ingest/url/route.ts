// ============================================
// POST /api/tenkai/content/ingest/url
// ============================================
// URLからコンテンツを抽出し、TenkaiProjectを作成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { scrapeUrl } from '@/lib/tenkai/scraper'
import { incrementProjectCount } from '@/lib/tenkai/access'

const bodySchema = z.object({
  url: z.string().url().max(2048),
  projectId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'URLが正しくありません', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { url, projectId } = parsed.data

    // URLスクレイピング
    const scraped = await scrapeUrl(url)

    let project
    if (projectId) {
      // 既存プロジェクトを更新
      const existing = await prisma.tenkaiProject.findUnique({ where: { id: projectId } })
      if (!existing || existing.userId !== userId) {
        return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
      project = await prisma.tenkaiProject.update({
        where: { id: projectId },
        data: {
          inputUrl: url,
          inputText: scraped.content,
          wordCount: scraped.wordCount,
          language: scraped.language,
          title: existing.title === '無題のプロジェクト' ? (scraped.title || existing.title) : existing.title,
        },
      })
    } else {
      // 新規プロジェクト作成
      project = await prisma.tenkaiProject.create({
        data: {
          userId,
          title: scraped.title || url,
          inputType: 'url',
          inputUrl: url,
          inputText: scraped.content,
          status: 'draft',
          wordCount: scraped.wordCount,
          language: scraped.language,
        },
      })
      await incrementProjectCount(userId)
    }

    return NextResponse.json({
      projectId: project.id,
      title: scraped.title,
      contentPreview: scraped.content.slice(0, 300),
      wordCount: scraped.wordCount,
      language: scraped.language,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] ingest/url error:', message)
    return NextResponse.json(
      { error: message || 'URLからのコンテンツ取得に失敗しました' },
      { status: 500 }
    )
  }
}
