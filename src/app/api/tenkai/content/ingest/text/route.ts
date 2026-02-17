// ============================================
// POST /api/tenkai/content/ingest/text
// ============================================
// テキスト直接入力 → TenkaiProject作成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { incrementProjectCount } from '@/lib/tenkai/access'

const bodySchema = z.object({
  title: z.string().min(1).max(300),
  text: z.string().min(100).max(50000),
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
        { error: '入力が正しくありません', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { title, text } = parsed.data

    const project = await prisma.tenkaiProject.create({
      data: {
        userId,
        title: title.trim(),
        inputType: 'text',
        inputText: text.trim(),
        status: 'draft',
        wordCount: text.trim().length,
        language: 'ja',
      },
    })

    await incrementProjectCount(userId)

    return NextResponse.json({
      projectId: project.id,
      title: project.title,
      contentPreview: text.trim().slice(0, 300),
      wordCount: text.trim().length,
      language: 'ja',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] ingest/text error:', message)
    return NextResponse.json(
      { error: message || 'テキストの保存に失敗しました' },
      { status: 500 }
    )
  }
}
