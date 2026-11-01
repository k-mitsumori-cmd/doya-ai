export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, hasMinRole, readJson, withExpense } from '@/lib/expense/access'
import { vendorDto } from '@/lib/expense/dto'
import { BANK_FIELDS, vendorInput } from '@/lib/expense/inputs'

// GET /api/expense/vendors?org=&kind=individual
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const kind = req.nextUrl.searchParams.get('kind')
    const rows = await prisma.expenseVendor.findMany({
      where: { organizationId: ctx.organizationId, ...(kind === 'individual' || kind === 'company' ? { kind } : {}) },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ vendors: rows.map((v) => vendorDto(v, ctx)) })
  })
}

// POST /api/expense/vendors?org= — 取引先の登録（manager 以上）
export async function POST(req: NextRequest) {
  return withExpense(req, 'manager', async (ctx) => {
    const data = vendorInput(await readJson(req))
    if (!hasMinRole(ctx.role, 'manager') && BANK_FIELDS.some((k) => data[k])) throw new ExpenseHttpError(403, '振込先を登録する権限がありません')
    const v = await prisma.expenseVendor.create({ data: { ...data, organizationId: ctx.organizationId } })
    await audit(prisma, ctx, 'vendor.create', 'vendor', v.id)
    return NextResponse.json({ vendor: vendorDto(v, ctx) })
  })
}
