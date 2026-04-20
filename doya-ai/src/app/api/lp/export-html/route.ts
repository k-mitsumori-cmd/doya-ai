export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateHtml } from '@/lib/lp/html-export'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
