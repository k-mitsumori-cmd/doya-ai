import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFileAsBuffer } from '@seo/lib/storage'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const img = await (prisma as any).seoImage.findUnique({ where: { id } })
  if (!img) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

  const buf = await readFileAsBuffer(img.filePath)
  // BufferをUint8Arrayに変換してBodyInitとして渡す
  const body = new Uint8Array(buf)
  return new NextResponse(body, {
    headers: {
      'Content-Type': img.mimeType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}


