import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readPersonaImageFile } from '@/lib/persona/image-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers })
    const { id } = await params
    const job = await prisma.personaImageJob.findFirst({ where: {
      id, status: 'succeeded', project: { userId: session.user.id, deletedAt: null, status: 'succeeded' },
    } })
    if (!job?.outputRef || job.outputRef !== `${job.projectId}/${job.id}/${job.leaseToken}.png`) {
      return NextResponse.json({ error: '画像が見つかりません。' }, { status: 404, headers })
    }
    const buffer = await readPersonaImageFile(job.outputRef)
    return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'inline; filename="persona.png"' } })
  } catch {
    return NextResponse.json({ error: '画像を読み込めませんでした。再度お試しください。' }, { status: 503, headers })
  }
}
