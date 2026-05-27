export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ organizationId: null })
    }

    const membership = await prisma.kintaiMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!membership || !membership.employee) {
      return NextResponse.json({ organizationId: null })
    }

    // Get the organization owner's plan
    const owner = await prisma.kintaiMember.findFirst({
      where: { organizationId: membership.organizationId, role: 'system_admin' },
      select: { userId: true },
    })
    const ownerUser = owner ? await prisma.user.findUnique({
      where: { id: owner.userId },
      select: { plan: true },
    }) : null

    return NextResponse.json({
      organizationId: membership.organizationId,
      employeeId: membership.employee.id,
      role: membership.role,
      employeeName: membership.employee.name,
      plan: ownerUser?.plan || 'FREE',
    })
  } catch (e) {
    console.error('[kintai/usage] Error:', e)
    return NextResponse.json({ organizationId: null })
  }
}
