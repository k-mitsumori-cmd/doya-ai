import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 記事エクスポート（Word/Markdown/HTML）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, format } = body // format: 'word' | 'markdown' | 'html'

    if (!projectId || !format) {
      return NextResponse.json({ error: 'Missing projectId or format' }, { status: 400 })
    }

    // プロジェクト取得
    const project = await prisma.interviewProject.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        drafts: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const draft = project.drafts[0]
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // フォーマット別に変換
    let content = ''
    let mimeType = 'text/plain'
    let fileName = `${project.title}.txt`

    switch (format) {
      case 'markdown':
        content = `# ${draft.title || project.title}\n\n${draft.lead ? `${draft.lead}\n\n` : ''}${draft.content}`
        mimeType = 'text/markdown'
        fileName = `${project.title}.md`
        break
      case 'html':
        content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${draft.title || project.title}</title>
</head>
<body>
  <h1>${draft.title || project.title}</h1>
  ${draft.lead ? `<p class="lead">${draft.lead}</p>` : ''}
  <div class="content">
    ${draft.content.replace(/\n/g, '<br>')}
  </div>
</body>
</html>`
        mimeType = 'text/html'
        fileName = `${project.title}.html`
        break
      case 'word':
        // TODO: docx形式の生成（docxライブラリ使用）
        content = draft.content
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        fileName = `${project.title}.docx`
        break
      default:
        content = draft.content
    }

    // エクスポート形式を保存
    const exportFormats = (project.exportFormats as any) || {}
    exportFormats[format] = content

    await prisma.interviewProject.update({
      where: { id: projectId },
      data: { exportFormats },
    })

    return NextResponse.json({
      content,
      mimeType,
      fileName,
      format,
    })
  } catch (error) {
    console.error('[INTERVIEW] Export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}


