export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { getKintaiEmployeeLimitByUserPlan } from '@/lib/pricing'
import { sendEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const departmentId = searchParams.get('departmentId') || ''
    const employmentType = searchParams.get('employmentType') || ''
    const isActive = searchParams.get('isActive')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50')))

    const where: any = { organizationId: ctx.organizationId }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameKana: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (departmentId) where.departmentId = departmentId
    if (employmentType) where.employmentType = employmentType
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true'

    const [employees, total] = await Promise.all([
      prisma.kintaiEmployee.findMany({
        where,
        include: { department: true, workRule: true, member: { select: { id: true, role: true, status: true, inviteToken: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.kintaiEmployee.count({ where }),
    ])

    return NextResponse.json({ employees, total, page, pageSize })
  } catch (e) {
    console.error('[kintai/employees GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // --- Employee limit check ---
    const owner = await prisma.kintaiMember.findFirst({
      where: { organizationId: ctx.organizationId, role: 'system_admin' },
      select: { userId: true },
    })
    const ownerUser = owner ? await prisma.user.findUnique({
      where: { id: owner.userId },
      select: { plan: true },
    }) : null
    const plan = ownerUser?.plan || 'FREE'
    const limit = getKintaiEmployeeLimitByUserPlan(plan)

    if (limit !== -1) {
      const activeCount = await prisma.kintaiEmployee.count({
        where: { organizationId: ctx.organizationId, isActive: true },
      })
      if (activeCount >= limit) {
        return NextResponse.json(
          { error: `従業員数が上限（${limit}名）に達しています。プランをアップグレードしてください。` },
          { status: 403 },
        )
      }
    }

    const body = await req.json()
    const { name, nameKana, email, departmentId, workRuleId, employmentType, hireDate, role } = body
    if (!name || !email) {
      return NextResponse.json({ error: '氏名とメールは必須です' }, { status: 400 })
    }

    // SEC: departmentId/workRuleId が同じ組織に属するか検証
    if (departmentId) {
      const dept = await prisma.kintaiDepartment.findFirst({ where: { id: departmentId, organizationId: ctx.organizationId } })
      if (!dept) return NextResponse.json({ error: '指定された部署が見つかりません' }, { status: 400 })
    }
    if (workRuleId) {
      const rule = await prisma.kintaiWorkRule.findFirst({ where: { id: workRuleId, organizationId: ctx.organizationId } })
      if (!rule) return NextResponse.json({ error: '指定された就業ルールが見つかりません' }, { status: 400 })
    }

    // SEC: ロール値のホワイトリスト検証 + 権限エスカレーション防止
    const ALLOWED_ROLES = ['employee', 'manager', 'hr_admin'] as const
    const assignRole = ALLOWED_ROLES.includes(role) ? role : 'employee'
    // hr_adminはsystem_adminを割り当て不可
    if (role === 'system_admin') {
      return NextResponse.json({ error: 'system_adminロールは割り当てできません' }, { status: 403 })
    }

    const inviteToken = crypto.randomUUID()
    const employee = await prisma.kintaiEmployee.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        nameKana: nameKana || null,
        email,
        ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
        ...(workRuleId ? { workRule: { connect: { id: workRuleId } } } : {}),
        employmentType: employmentType || 'full_time',
        hireDate: hireDate ? new Date(hireDate) : null,
        member: {
          create: {
            organizationId: ctx.organizationId,
            userId: `pending_${crypto.randomUUID()}`,
            role: assignRole,
            status: 'PENDING',
            inviteToken,
            inviteEmail: email,
          },
        },
      },
      include: { department: true, workRule: true, member: { select: { id: true, role: true, status: true, inviteToken: true } } },
    })

    // 招待メールを自動送信
    const org = await prisma.kintaiOrganization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true },
    })
    const baseUrl = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
    const inviteUrl = `${baseUrl}/kintai/invite/${inviteToken}`

    sendEmail({
      to: email,
      subject: `【ドヤ勤怠】${org?.name || '組織'}への招待`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; border-radius: 16px; background: linear-gradient(135deg, #7f19e6, #5b0fb3); color: white; line-height: 48px; font-size: 20px; font-weight: bold;">⏰</div>
          </div>
          <h1 style="text-align: center; font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">ドヤ勤怠への招待</h1>
          <p style="text-align: center; color: #64748b; font-size: 15px; margin-bottom: 24px;">
            <strong style="color: #7f19e6;">${org?.name || '組織'}</strong> に招待されました
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            ${name} さん、こんにちは！<br>
            以下のボタンをクリックして、ドヤ勤怠に参加してください。
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7f19e6, #5b0fb3); color: white; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 16px;">
              組織に参加する
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            このリンクは本人のみ使用できます。心当たりのない場合は無視してください。
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #cbd5e1; font-size: 11px; text-align: center;">ドヤ勤怠 by ドヤAI</p>
        </div>
      `,
      tags: [{ name: 'service', value: 'kintai-invite' }],
    }).catch(e => console.error('[kintai/employees] invite email failed:', e))

    return NextResponse.json({ employee, inviteUrl }, { status: 201 })
  } catch (e: any) {
    console.error('[kintai/employees POST]', e?.message?.substring(0, 500))
    let msg = '作成に失敗しました'
    if (e?.code === 'P2002') msg = 'このメールアドレスは既に登録されています'
    else if (e?.code === 'P2003') msg = '指定された部署または就業ルールが見つかりません'
    else if (e?.message?.includes('Unique constraint')) msg = '同じデータが既に存在します'
    else if (e?.message?.includes('Foreign key constraint')) msg = '指定された部署または就業ルールが見つかりません'
    return NextResponse.json({ error: msg, detail: e?.message?.substring(0, 300) }, { status: 500 })
  }
}
