export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, getOrCreateOrganization, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, slug, industry, size } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const org = await getOrCreateOrganization(userId, name.trim(), {
      slug,
      industry,
      size,
    })

    return NextResponse.json({ success: true, organization: org })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create organization' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.hrOrganizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                employees: true,
                departments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const organizations = memberships.map((m) => ({
      ...m.organization,
      myRole: m.role,
      memberId: m.id,
    }))

    return NextResponse.json({ success: true, organizations })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      logoUrl,
      industry,
      size,
      address,
      website,
      fiscalMonth,
      evaluationType,
      evaluationCycle,
      customFields,
    } = body

    const data: Record<string, any> = {}
    if (name !== undefined) data.name = name
    if (logoUrl !== undefined) data.logoUrl = logoUrl
    if (industry !== undefined) data.industry = industry
    if (size !== undefined) data.size = size
    if (address !== undefined) data.address = address
    if (website !== undefined) data.website = website
    if (fiscalMonth !== undefined) data.fiscalMonth = fiscalMonth
    if (evaluationType !== undefined) data.evaluationType = evaluationType
    if (evaluationCycle !== undefined) data.evaluationCycle = evaluationCycle
    if (customFields !== undefined) data.customFields = customFields

    const org = await prisma.hrOrganization.update({
      where: { id: ctx.organizationId },
      data,
    })

    return NextResponse.json({ success: true, organization: org })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update organization' },
      { status: 500 }
    )
  }
}
