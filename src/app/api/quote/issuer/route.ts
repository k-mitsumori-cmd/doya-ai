export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET/PUT /api/quote/issuer — 見積書に印字する自社情報
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, hasMinRole, orgSlugFrom } from '@/lib/quote/access'

export async function GET(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const issuer = await prisma.quoteIssuer.findUnique({ where: { organizationId: ctx.organizationId } })
  return NextResponse.json({ issuer })
}

const FIELDS = [
  'companyName', 'postalCode', 'address', 'tel', 'personName',
  'invoiceNo', 'paymentTerms', 'deliveryTerms', 'notes',
] as const

export async function PUT(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // 見積書の発行元は取引の主体。書き換えは管理者以上に限る
  if (!hasMinRole(ctx.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const companyName = String(body?.companyName || '').trim()
  if (!companyName) return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })

  const data: Record<string, string | null> = {}
  for (const f of FIELDS) {
    if (f === 'companyName') continue
    const v = body?.[f]
    data[f] = v == null || String(v).trim() === '' ? null : String(v).slice(0, 2000)
  }

  const issuer = await prisma.quoteIssuer.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, companyName: companyName.slice(0, 200), ...data },
    update: { companyName: companyName.slice(0, 200), ...data },
  })
  return NextResponse.json({ issuer })
}
