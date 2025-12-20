import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, hashPassword, validatePassword, verifyAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifyAdminSession(token)
  if (!session.valid || !session.adminUser) return null
  return session.adminUser
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    isActive?: boolean
    password?: string
    email?: string
    name?: string
    username?: string
  }

  const data: any = {}

  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (typeof body.email === 'string') data.email = body.email.trim().toLowerCase() || null
  if (typeof body.name === 'string') data.name = body.name.trim() || null
  if (typeof body.username === 'string') data.username = body.username.trim()

  if (typeof body.password === 'string') {
    const pw = validatePassword(body.password)
    if (!pw.valid) return NextResponse.json({ error: pw.errors.join(' / ') }, { status: 400 })
    data.passwordHash = await hashPassword(body.password)
    data.isActive = true
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no updates' }, { status: 400 })
  }

  try {
    const updated = await prisma.adminUser.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ adminUser: updated })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (admin.id === params.id) {
    return NextResponse.json({ error: 'cannot delete yourself' }, { status: 400 })
  }

  try {
    await prisma.adminUser.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 400 })
  }
}


