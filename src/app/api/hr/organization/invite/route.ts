export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { email, role } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()
    const inviteRole = role || HrMemberRole.MEMBER

    const existingMember = await prisma.hrOrganizationMember.findFirst({
      where: {
        organizationId: ctx.organizationId,
        user: { email: emailNorm },
        status: 'ACTIVE',
      },
    })
    if (existingMember) {
      return NextResponse.json(
        { error: 'This user is already a member' },
        { status: 400 }
      )
    }

    const pendingInvite = await prisma.hrInvitation.findFirst({
      where: {
        organizationId: ctx.organizationId,
        email: emailNorm,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })
    if (pendingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 400 }
      )
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invitation = await prisma.hrInvitation.create({
      data: {
        organizationId: ctx.organizationId,
        email: emailNorm,
        role: inviteRole,
        token,
        invitedBy: ctx.userId,
        status: 'PENDING',
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
