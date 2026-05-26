export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { getHrEmployeeLimitByUserPlan } from '@/lib/pricing'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ employeeCount: 0, employeeLimit: 5 })
    }

    const session = await getServerSession(authOptions)
    const plan = (session?.user as any)?.plan || 'FREE'

    const employeeCount = await prisma.hrEmployee.count({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
    })

    const employeeLimit = getHrEmployeeLimitByUserPlan(plan)

    return NextResponse.json({
      employeeCount,
      employeeLimit: employeeLimit === -1 ? 999 : employeeLimit,
      organizationId: ctx.organizationId,
    })
  } catch {
    return NextResponse.json({ employeeCount: 0, employeeLimit: 5 })
  }
}
