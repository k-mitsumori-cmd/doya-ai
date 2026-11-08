export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { EXPENSE_ROLES } from '@/lib/expense/constants'
import { canGrantRole } from '@/lib/expense/member-policy'
import { addExpenseMember } from '@/lib/expense/member-admission'
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

    await addExpenseMember(ctx, { email: emailAddr, name, role })
    // 応答は登録の有無で変えない
    return NextResponse.json({ ok: true })
  })
}
