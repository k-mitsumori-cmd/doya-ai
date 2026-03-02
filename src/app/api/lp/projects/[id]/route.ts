export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { id } = p

    const project = await prisma.lpProject.findFirst({
      where: { id, userId: session.user.id },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[GET /api/lp/projects/[id]]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { id } = p

    const existing = await prisma.lpProject.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, purpose, productInfo, persona, structures, selectedStructure, themeId, customColors, customFonts, status, htmlUrl, pdfUrl, sections } = body

    const updated = await prisma.lpProject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(purpose !== undefined && { purpose }),
        ...(productInfo !== undefined && { productInfo: productInfo as any }),
        ...(persona !== undefined && { persona: persona as any }),
        ...(structures !== undefined && { structures: structures as any }),
        ...(selectedStructure !== undefined && { selectedStructure }),
        ...(themeId !== undefined && { themeId }),
        ...(customColors !== undefined && { customColors: customColors as any }),
        ...(customFonts !== undefined && { customFonts: customFonts as any }),
        ...(status !== undefined && { status }),
        ...(htmlUrl !== undefined && { htmlUrl }),
        ...(pdfUrl !== undefined && { pdfUrl }),
      },
    })

    // セクションの一括更新（並べ替え対応）
    if (sections && Array.isArray(sections)) {
      for (const sec of sections) {
        if (sec.id) {
          await prisma.lpSection.update({
            where: { id: sec.id },
            data: {
              order: sec.order,
              headline: sec.headline,
              subheadline: sec.subheadline,
              body: sec.body,
              ctaText: sec.ctaText,
              ctaUrl: sec.ctaUrl,
              layout: sec.layout,
              bgColor: sec.bgColor,
              items: sec.items as any,
            },
          })
        }
      }
    }

    return NextResponse.json({ project: updated })
  } catch (error) {
    console.error('[PUT /api/lp/projects/[id]]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { id } = p

    const existing = await prisma.lpProject.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.lpProject.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/lp/projects/[id]]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
