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

    return NextResponse.json({
      organizationId: membership.organizationId,
      employeeId: membership.employee.id,
      role: membership.role,
      employeeName: membership.employee.name,
    })
  } catch (e) {
    console.error('[kintai/usage] Error:', e)
    return NextResponse.json({ organizationId: null })
  }
}
