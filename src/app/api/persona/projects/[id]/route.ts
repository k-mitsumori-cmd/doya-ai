import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPersonaProjectId, readPersonaProject } from '@/lib/persona/project-history'
import { deletePersonaProject } from '@/lib/persona/image-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

/** Revalidate access without transferring the generated text or images. */
export async function HEAD(_req: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return new Response(null, { status: 401, headers })
    const { id } = await params
    const project = isPersonaProjectId(id) && await prisma.personaProject.findFirst({
      where: { id, userId: session.user.id, status: 'succeeded', deletedAt: null }, select: { id: true },
    })
    return new Response(null, { status: project ? 204 : 404, headers })
  } catch { return new Response(null, { status: 503, headers }) }
}

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers })
    const { id } = await params
    const project = isPersonaProjectId(id) ? await readPersonaProject(prisma, session.user.id, id) : null
    if (!project) return NextResponse.json({ error: '履歴が見つかりません。' }, { status: 404, headers })
    return NextResponse.json(project, { headers })
  } catch {
    return NextResponse.json({ error: '履歴を読み込めませんでした。再度お試しください。' }, { status: 503, headers })
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers })
    const { id } = await params
    const deleted = isPersonaProjectId(id) && await deletePersonaProject(prisma, session.user.id, id)
    if (!deleted) return NextResponse.json({ error: '履歴が見つかりません。' }, { status: 404, headers })
    return NextResponse.json({ success: true, deleted: true }, { headers })
  } catch {
    return NextResponse.json({ error: '履歴を削除できませんでした。再度お試しください。' }, { status: 503, headers })
  }
}
