export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

const VALID_ROLES: string[] = [
  HrMemberRole.OWNER,
  HrMemberRole.ADMIN,
  HrMemberRole.MANAGER,
  HrMemberRole.MEMBER,
]
const VALID_STATUSES: string[] = ['ACTIVE', 'INVITED', 'SUSPENDED']

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const body = await req.json()
    const { role, status, employeeId } = body

    const target = await prisma.hrOrganizationMember.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (target.role === HrMemberRole.OWNER && hrCtx.role !== HrMemberRole.OWNER) {
      return NextResponse.json({ error: 'Cannot modify owner' }, { status: 403 })
    }

    const data: Record<string, any> = {}
    if (role !== undefined) {
      // ⚠️ ロール値を検証せずに保存しない。未知の文字列が入ると
      //    hasMinRole が 0 扱いになり、以後その人は何もできなくなる。
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: '権限の指定が正しくありません' }, { status: 400 })
      }
      // ⚠️ 自分より上の権限を与えさせない。これが無いと ADMIN が
      //    他人を OWNER に昇格させ、実質オーナーを増やせてしまう（権限昇格）。
      if (!hasMinRole(hrCtx.role, role)) {
        return NextResponse.json(
          { error: 'ご自身より上の権限は付与できません' },
          { status: 403 }
        )
      }
      data.role = role
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: '状態の指定が正しくありません' }, { status: 400 })
      }
      data.status = status
    }
    if (employeeId !== undefined) data.employeeId = employeeId
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '変更する項目がありません' }, { status: 400 })
    }

    const updated = await prisma.hrOrganizationMember.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, member: updated })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update member' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const target = await prisma.hrOrganizationMember.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (target.role === HrMemberRole.OWNER) {
      return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 })
    }

    if (target.id === hrCtx.memberId) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    await prisma.hrOrganizationMember.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to remove member' },
      { status: 500 }
    )
  }
}
