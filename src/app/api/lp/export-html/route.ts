export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateHtml } from '@/lib/lp/html-export'

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // プラン制限: Pro以上のみHTMLエクスポート可能
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    if (!isProPlan(user?.plan)) {
      return NextResponse.json(
        { error: 'HTMLエクスポートはProプラン以上で利用可能です', upgradePath: '/lp/pricing' },
        { status: 403 }
      )
    }

    const { projectId } = await req.json()
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const project = await prisma.lpProject.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { sections: { orderBy: { order: 'asc' } } },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.sections || project.sections.length === 0) {
      return NextResponse.json({ error: 'このプロジェクトにはまだセクションがありません。コピー生成を先に行ってください。' }, { status: 400 })
    }

    const html = generateHtml({
      projectName: project.name,
      themeId: project.themeId,
      sections: project.sections.map((s) => ({
        type: s.type,
        name: s.name,
        headline: s.headline,
        subheadline: s.subheadline,
        body: s.body,
        ctaText: s.ctaText,
        ctaUrl: s.ctaUrl,
        layout: s.layout,
        bgColor: s.bgColor,
        bgImage: s.bgImage,
        items: s.items as any,
      })),
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(project.name)}.html"`,
      },
    })
  } catch (error) {
    console.error('[POST /api/lp/export-html]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
