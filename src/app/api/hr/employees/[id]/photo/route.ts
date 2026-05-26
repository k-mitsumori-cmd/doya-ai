export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const existing = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const body = await req.json()
    const { photoBase64, mimeType } = body

    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return NextResponse.json({ error: 'photoBase64 is required' }, { status: 400 })
    }

    const dataUrl = `data:${mimeType || 'image/png'};base64,${photoBase64}`

    const updated = await prisma.hrEmployee.update({
      where: { id },
      data: {
        photoUrl: dataUrl,
        thumbnailUrl: dataUrl,
      },
    })

    return NextResponse.json({
      success: true,
      photoUrl: updated.photoUrl,
      thumbnailUrl: updated.thumbnailUrl,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to upload photo' },
      { status: 500 }
    )
  }
}
