export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { EXPENSE_ROLES } from '@/lib/expense/constants'
import { oneOf, str } from '@/lib/expense/validate'

// GET /api/expense/members?org=
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const rows = await prisma.expenseMember.findMany({ where: { organizationId: ctx.organizationId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, email: true } })
    const email = new Map(users.map((u) => [u.id, u.email]))
    return NextResponse.json({
      members: rows.map((m) => ({ id: m.id, name: m.name, role: m.role, email: email.get(m.userId) ?? null, isMe: m.userId === ctx.userId })),
    })
  })
}

// POST /api/expense/members?org= — ドヤAI に登録済みのユーザーをメールアドレスで追加（admin 以上）
export async function POST(req: NextRequest) {
  return withExpense(req, 'admin', async (ctx) => {
    const body = await readJson(req)
    const emailAddr = str(body.email, 'メールアドレス', 254)!.toLowerCase()
    const name = str(body.name, '氏名', 80)!
    const role = oneOf(body.role, EXPENSE_ROLES.filter((r) => r !== 'owner'), '権限', 'member')
    const user = await prisma.user.findUnique({ where: { email: emailAddr }, select: { id: true } })
    if (!user) throw new ExpenseHttpError(404, 'このメールアドレスのドヤAIアカウントが見つかりません。先にドヤAIにログインしてもらってください。')
    // ⚠️ 既にいるメンバーの権限はここで変えない（admin がオーナーを降格できてしまう）。権限の変更は PATCH で
    const existing = await prisma.expenseMember.findFirst({ where: { organizationId: ctx.organizationId, userId: user.id } })
    if (existing?.status === 'ACTIVE') throw new ExpenseHttpError(409, 'この方は既にメンバーです。権限はメンバー一覧から変更してください。')
    const member = existing
      ? await prisma.expenseMember.update({ where: { id: existing.id }, data: { name, role, status: 'ACTIVE' } })
      : await prisma.expenseMember.create({ data: { organizationId: ctx.organizationId, userId: user.id, name, role, status: 'ACTIVE' } })
    await audit(prisma, ctx, 'member.add', 'member', member.id, { role })
    return NextResponse.json({ member: { id: member.id } })
  })
}
