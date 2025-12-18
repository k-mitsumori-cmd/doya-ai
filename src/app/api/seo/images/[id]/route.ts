import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFileAsBuffer } from '@seo/lib/storage'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  const img = await prisma.seoImage.findUnique({ where: { id } })
  if (!img) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

  const buf = await readFileAsBuffer(img.filePath)
  return new NextResponse(buf, {
    headers: {
      'Content-Type': img.mimeType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}


