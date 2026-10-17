export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { IncomeError, audit } from '@/lib/income/access'
import { asBody, oneOf, paymentTerms, reqStr, str } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const issuer = await prisma.incomeIssuer.findUnique({ where: { organizationId: ctx.organizationId } })
    return NextResponse.json({ issuer })
  })
}

export async function PUT(req: NextRequest) {
  return withIncome(req, 'admin', async (ctx) => {
    const body = asBody(await readJson(req))
    const invoiceRegNo = str(body, 'invoiceRegNo', '登録番号', { max: 14 })
    if (invoiceRegNo && !/^T\d{13}$/.test(invoiceRegNo)) throw new IncomeError('登録番号は T＋13 桁の数字で入力してください')
    const terms = paymentTerms(body)
    const data = {
      companyName: reqStr(body, 'companyName', '自社名', 120),
      postalCode: str(body, 'postalCode', '郵便番号', { max: 10 }),
      address: str(body, 'address', '住所', { max: 300 }),
      tel: str(body, 'tel', '電話番号', { max: 30 }),
      personName: str(body, 'personName', '担当者名', { max: 60 }),
      invoiceRegNo,
      bankName: str(body, 'bankName', '銀行名', { max: 60 }),
      bankBranch: str(body, 'bankBranch', '支店名', { max: 60 }),
      bankAccountType: oneOf(body, 'bankAccountType', '口座種別', ['ordinary', 'checking'] as const, 'ordinary'),
      bankAccountNo: str(body, 'bankAccountNo', '口座番号', { max: 20 }),
      bankAccountHolder: str(body, 'bankAccountHolder', '口座名義', { max: 100 }),
      invoiceNotes: str(body, 'invoiceNotes', '請求書の備考', { max: 1000 }),
      defaultClosingDay: terms.closingDay ?? 31,
      defaultPaymentMonths: terms.paymentMonths ?? 1,
      defaultPaymentDay: terms.paymentDay ?? 31,
    }
    const issuer = await prisma.incomeIssuer.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, ...data }, update: data })
    await audit(prisma, ctx, 'issuer.update', 'issuer', ctx.organizationId)
    return NextResponse.json({ issuer })
  })
}
