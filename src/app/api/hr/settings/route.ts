export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const org = await prisma.hrOrganization.findUnique({
      where: { id: ctx.organizationId },
    })

    const memberships = await prisma.hrOrganizationMember.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(!hasMinRole(ctx.role, 'ADMIN') ? { id: ctx.memberId } : {}),
      },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const members = memberships.map((m) => ({
      id: m.id,
      name: m.user.name || '',
      email: m.user.email || m.invitedEmail || '',
      image: m.user.image || null,
      role: m.role,
      employeeId: m.employeeId,
      joinedAt: m.acceptedAt?.toISOString() || m.createdAt.toISOString(),
    }))

    return NextResponse.json({
      settings: {
        id: org?.id,
        name: org?.name || '',
        industry: org?.industry || '',
        employeeScale: org?.size || '',
        fiscalYearStart: org?.fiscalMonth ? String(org.fiscalMonth).padStart(2, '0') : '04',
      },
      members,
      // ⚠️ 画面が「誰に何を出してよいか」を判断するために要る。
      //    これが無いと、権限のない人にも権限変更・削除の操作を出してしまう
      //    （押しても403で弾かれるが、出す方が不親切）。
      myRole: ctx.role,
      myMemberId: ctx.memberId,
    })
  } catch (e) {
    console.error('[hr/settings GET]', e)
    return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasMinRole(ctx.role, 'ADMIN')) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const { name, industry, employeeScale, fiscalYearStart } = body
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: '組織名を入力してください' }, { status: 400 })
    }
    if ((industry != null && typeof industry !== 'string') || (employeeScale != null && typeof employeeScale !== 'string')) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    if (fiscalYearStart !== undefined &&
      (typeof fiscalYearStart !== 'string' || !/^(0?[1-9]|1[0-2])$/.test(fiscalYearStart))) {
      return NextResponse.json({ error: '期首月は1〜12月で指定してください' }, { status: 400 })
    }
    const data: Record<string, string | number | null> = {}
    if (name !== undefined) data.name = name.trim().slice(0, 120)
    if (industry !== undefined) data.industry = industry?.trim().slice(0, 100) || null
    if (employeeScale !== undefined) data.size = employeeScale?.trim().slice(0, 50) || null
    if (fiscalYearStart !== undefined) data.fiscalMonth = Number(fiscalYearStart)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '変更内容を指定してください' }, { status: 400 })
    }

    await prisma.hrOrganization.update({
      where: { id: ctx.organizationId },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[hr/settings PUT]', e)
    return NextResponse.json({ error: '設定の保存に失敗しました' }, { status: 500 })
  }
}
