export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { EXPENSE_ROLES } from '@/lib/expense/constants'
import { canGrantRole } from '@/lib/expense/member-policy'
import { oneOf, str } from '@/lib/expense/validate'

// GET /api/expense/members?org= — ACTIVE のメンバーと招待中（PENDING）の人
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const rows = await prisma.expenseMember.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ['ACTIVE', 'PENDING'] } },
      orderBy: { createdAt: 'asc' },
    })
    const userIds = rows.map((r) => r.userId).filter((v): v is string => !!v)
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    const email = new Map(users.map((u) => [u.id, u.email]))
    return NextResponse.json({
      members: rows.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        status: m.status,
        email: (m.userId ? email.get(m.userId) : m.invitedEmail) ?? null,
        isMe: !!m.userId && m.userId === ctx.userId,
      })),
    })
  })
}

/**
 * POST /api/expense/members?org= — メールアドレスでメンバーを招待する（admin 以上）
 * ⚠️ そのメールの人がドヤAIに登録しているかどうかで、応答を変えない（システム点検 EXP-F05）。
 *    登録済みならすぐ ACTIVE、未登録なら PENDING で残し、本人がそのメールでログインしたときに ACTIVE にする（claimPendingMemberships）。
 * ⚠️ owner でない人は、自分と同じか上のロールを付与できない（EXP-F02）。
 */
export async function POST(req: NextRequest) {
  return withExpense(req, 'admin', async (ctx) => {
    const body = await readJson(req)
    const emailAddr = str(body.email, 'メールアドレス', 254)!.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) throw new ExpenseHttpError(400, 'メールアドレスの形式が正しくありません')
    const name = str(body.name, '氏名', 80)!
    const role = oneOf(body.role, EXPENSE_ROLES.filter((r) => r !== 'owner'), '権限', 'member')
    if (!canGrantRole(ctx.role, role)) throw new ExpenseHttpError(403, '自分と同じか上の権限は付与できません。オーナーに依頼してください。')

    const user = await prisma.user.findUnique({ where: { email: emailAddr }, select: { id: true } })
    // ⚠️ 既にいるメンバー・招待中の人の権限はここで変えない（admin がオーナーを降格できてしまう）。権限の変更は PATCH で
    const existing = await prisma.expenseMember.findFirst({
      where: { organizationId: ctx.organizationId, OR: [...(user ? [{ userId: user.id }] : []), { invitedEmail: emailAddr }] },
    })
    if (existing && existing.status !== 'INACTIVE') throw new ExpenseHttpError(409, 'この方は既にメンバーか招待中です。権限はメンバー一覧から変更してください。')

    const data = user
      ? { userId: user.id, invitedEmail: emailAddr, name, role, status: 'ACTIVE' }
      : { userId: null, invitedEmail: emailAddr, name, role, status: 'PENDING' }
    const member = existing
      ? await prisma.expenseMember.update({ where: { id: existing.id }, data })
      : await prisma.expenseMember.create({ data: { ...data, organizationId: ctx.organizationId } })
    await audit(prisma, ctx, 'member.add', 'member', member.id, { role })
    // 応答は登録の有無で変えない
    return NextResponse.json({ ok: true })
  })
}
