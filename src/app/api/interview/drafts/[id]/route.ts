import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ドラフトの更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const draftId = params.id
    const body = await request.json()
    const { content, title, lead } = body

    // ドラフト取得
    const draft = await prisma.interviewDraft.findFirst({
      where: {
        id: draftId,
        project: {
          OR: [
            { userId: userId || undefined },
            { guestId: guestId || undefined },
          ],
        },
      },
      include: {
        project: true,
      },
    })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // 文字数カウント
    const wordCount = content?.length || draft.content.length
    const readingTime = Math.ceil(wordCount / 400)

    // ドラフト更新
    const updatedDraft = await prisma.interviewDraft.update({
      where: { id: draftId },
      data: {
        content: content || draft.content,
        title: title !== undefined ? title : draft.title,
        lead: lead !== undefined ? lead : draft.lead,
        wordCount,
        readingTime,
      },
    })

    return NextResponse.json({ draft: updatedDraft })
  } catch (error) {
    console.error('[INTERVIEW] Draft update error:', error)
    return NextResponse.json(
      { error: 'Failed to update draft', details: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    )
  }
}

