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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const adminUsers = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
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

  return NextResponse.json({ adminUsers })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    email?: string
    username?: string
    name?: string
    password?: string
  }

  const email = (body.email || '').trim().toLowerCase()
  const username = ((body.username || email) || '').trim()
  const name = (body.name || '').trim() || null
  const password = (body.password || '').toString()

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!password) return NextResponse.json({ error: 'password is required' }, { status: 400 })

  const pw = validatePassword(password)
  if (!pw.valid) {
    return NextResponse.json({ error: pw.errors.join(' / ') }, { status: 400 })
  }

  try {
    const passwordHash = await hashPassword(password)
    const created = await prisma.adminUser.create({
      data: {
        username,
        email,
        name,
        passwordHash,
        isActive: true,
      },
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

    return NextResponse.json({ adminUser: created })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 400 })
  }
}


