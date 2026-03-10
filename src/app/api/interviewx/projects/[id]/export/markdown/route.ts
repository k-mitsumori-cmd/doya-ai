import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const { userId } = await getInterviewXUser()
  const authErr = requireAuth(userId)
  if (authErr) return authErr

  try {
    const project = await prisma.interviewXProject.findUnique({
      where: { id: params.id },
      select: { userId: true, title: true },
    })
    if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    const draft = await prisma.interviewXDraft.findFirst({
      where: { projectId: params.id },
      orderBy: { version: 'desc' },
    })
    if (!draft) return NextResponse.json({ success: false, error: 'ドラフトがありません' }, { status: 404 })

    const markdown = draft.content

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(draft.title || project.title)}.md"`,
      },
    })
  } catch (e) {
    console.error('[InterviewX] export/markdown error:', e)
    return NextResponse.json({ success: false, error: 'Markdownエクスポートに失敗しました' }, { status: 500 })
  }
}
