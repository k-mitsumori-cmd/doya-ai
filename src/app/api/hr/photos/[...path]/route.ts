export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { downloadHrPhoto } from '@/lib/hr/storage'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
const absent = () => NextResponse.json({ error: '写真が見つからないか、閲覧権限が変更されています。' }, { status: 404, headers })
type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const actor = await getHrContext()
    if (!actor) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers })
    const { path } = await ctx.params
    if (!Array.isArray(path) || path.length !== 2 || path[0] !== actor.organizationId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(path[1])) return absent()
    const storagePath = path.join('/')
    const url = `/api/hr/photos/${storagePath}`
    const attachment = { organizationId: actor.organizationId, OR: [{ photoUrl: url }, { thumbnailUrl: url }] }
    const employee = await prisma.hrEmployee.findFirst({ where: attachment, select: { id: true } })
    if (!employee) return absent()
    const image = await downloadHrPhoto(storagePath)
    if (!image) return absent()
    // Awaiting storage must not outlive the original membership or employee attachment.
    const membership = { id: actor.memberId, userId: actor.userId, organizationId: actor.organizationId, status: 'ACTIVE' }
    const current = await prisma.hrEmployee.findFirst({
      where: { ...attachment, id: employee.id, organization: { members: { some: membership } } },
      select: { id: true },
    })
    if (!current) return absent()
    const mime = path[1].endsWith('.png') ? 'image/png' : path[1].endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    return new NextResponse(new Uint8Array(image), { headers: { ...headers, 'Content-Type': mime } })
  } catch {
    return NextResponse.json({ error: '写真を読み込めませんでした。時間をおいて再度お試しください。' }, { status: 503, headers })
  }
}
