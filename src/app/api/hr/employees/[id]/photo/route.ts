export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'

type Ctx = { params: Promise<{ id: string }> }
const MAX_INLINE_PHOTO_BYTES = 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params
    const id = p.id

    const existing = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const photoBase64 = body?.photoBase64
    const mimeType = body?.mimeType
    if (typeof photoBase64 !== 'string' || typeof mimeType !== 'string'
      || !ALLOWED_MIME_TYPES.has(mimeType)
      || photoBase64.length === 0
      || photoBase64.length > Math.ceil(MAX_INLINE_PHOTO_BYTES * 4 / 3) + 4
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(photoBase64)) {
      return NextResponse.json({ error: 'JPG・PNG・WebPの画像を1MB以下で指定してください' }, { status: 400 })
    }
    const bytes = Buffer.from(photoBase64, 'base64')
    if (bytes.length === 0 || bytes.length > MAX_INLINE_PHOTO_BYTES || bytes.toString('base64') !== photoBase64) {
      return NextResponse.json({ error: '画像データが不正か、1MBを超えています' }, { status: 400 })
    }
    const isJpeg = mimeType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng = mimeType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const isWebp = mimeType === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    if (!isJpeg && !isPng && !isWebp) {
      return NextResponse.json({ error: '画像形式が一致しません' }, { status: 400 })
    }

    const dataUrl = `data:${mimeType};base64,${photoBase64}`

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
    console.error('[hr/employees/photo]', e)
    return NextResponse.json(
      { error: '写真の保存に失敗しました' },
      { status: 500 }
    )
  }
}
