export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/mensetsu/sessions/[id]/hr-handoff — 引き渡せるHR組織の一覧
// POST /api/mensetsu/sessions/[id]/hr-handoff — 合格者をドヤHRの従業員として登録
//
// ⚠️ 自動同期にしない。面接AIが出すのは「推薦度」であって採用の決定ではない。
//    採用を決めるのは人なので、担当者が明示的に押したときだけ引き渡す。
// ⚠️ 生年月日・性別はドヤHR側に項目があるが、**面接では一切収集していない**ので
//    引き渡さない。選考で取ってはいけない情報を、この経路で持ち込ませない。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { HrMemberRole } from '@/lib/hr/types'
import { hasMinRole as hasHrRole } from '@/lib/hr/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

/** 「山田 太郎」→ { lastName: '山田', firstName: '太郎' } */
function splitName(full: string): { lastName: string; firstName: string } {
  const t = String(full || '').trim().replace(/[　\s]+/g, ' ')
  if (!t) return { lastName: '（未設定）', firstName: '' }
  const parts = t.split(' ')
  if (parts.length >= 2) return { lastName: parts[0], firstName: parts.slice(1).join(' ') }
  // 区切りが無い場合は姓に入れる。勝手に分割すると誤った氏名になる
  return { lastName: t, firstName: '' }
}

/** この利用者が書き込めるHR組織 */
async function writableHrOrgs(userId: string) {
  const memberships = await prisma.hrOrganizationMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  // ⚠️ 従業員の作成は管理者以上。閲覧だけの人に引き渡させない
  return memberships.filter((m) => hasHrRole(m.role, HrMemberRole.ADMIN))
}

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true, candidateName: true, candidateEmail: true, hrEmployeeId: true },
  })
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  const orgs = await writableHrOrgs(ctx.userId)
  return NextResponse.json({
    canHandoff: hasMinRole(ctx.role, 'manager') && orgs.length > 0,
    alreadyHandedOff: Boolean(s.hrEmployeeId),
    candidateName: s.candidateName,
    organizations: orgs.map((m) => ({ id: m.organization.id, name: m.organization.name })),
  })
}

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '引き渡す権限がありません' }, { status: 403 })
  }

  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true, candidateName: true, candidateEmail: true, hrEmployeeId: true },
  })
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (s.hrEmployeeId) {
    return NextResponse.json({ error: 'この方は既に登録済みです' }, { status: 409 })
  }
  if (!s.candidateName) {
    return NextResponse.json({ error: '応募者のお名前が記録されていません' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const hrOrganizationId = String(body?.hrOrganizationId || '')

  const orgs = await writableHrOrgs(ctx.userId)
  if (!orgs.some((m) => m.organization.id === hrOrganizationId)) {
    return NextResponse.json({ error: 'この組織へは登録できません' }, { status: 403 })
  }

  const { lastName, firstName } = splitName(s.candidateName)

  const employee = await prisma.hrEmployee.create({
    data: {
      organizationId: hrOrganizationId,
      lastName,
      firstName,
      email: s.candidateEmail,
      // ⚠️ 生年月日・性別は入れない。面接で収集していない情報をここで作らない
      employmentType: String(body?.employmentType || 'FULL_TIME'),
      status: 'ACTIVE',
      hireDate: body?.hireDate ? new Date(body.hireDate) : null,
      notes: `ドヤ面接官の一次面接から登録（面接ID: ${s.id}）`,
    },
    select: { id: true, lastName: true, firstName: true },
  })

  // ⚠️ 二重登録を防ぐため、面接側に紐付けを残す
  await prisma.mensetsuSession.update({
    where: { id: s.id },
    data: { hrEmployeeId: employee.id },
  })

  return NextResponse.json({ employee })
}
