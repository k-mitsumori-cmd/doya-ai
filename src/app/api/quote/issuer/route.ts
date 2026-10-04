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

async function retryIssuerTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('発行元情報を同時に変更できませんでした')
    }
  }
  throw new Error('発行元情報を保存できませんでした')
}

export async function PUT(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // 見積書の発行元は取引の主体。書き換えは管理者以上に限る
  if (!hasMinRole(ctx.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  if (typeof body?.companyName !== 'string' || !body.companyName.trim()) {
    return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })
  }
  const companyName = body.companyName.trim()

  const data: Record<string, string | null> = {}
  for (const f of FIELDS) {
    if (f === 'companyName') continue
    const v = body?.[f]
    if (v != null && typeof v !== 'string') {
      return NextResponse.json({ error: `${f} の形式が不正です` }, { status: 400 })
    }
    data[f] = v == null || v.trim() === '' ? null : v.slice(0, 2000)
  }

  const result = await retryIssuerTransaction(() => prisma.$transaction(async tx => {
    const member = await tx.quoteMember.findFirst({
      where: { organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: ['owner', 'admin'] } },
      select: { id: true },
    })
    if (!member) return { status: 403 as const, issuer: null }
    const issuer = await tx.quoteIssuer.upsert({
      where: { organizationId: ctx.organizationId },
      create: { organizationId: ctx.organizationId, companyName: companyName.slice(0, 200), ...data },
      update: { companyName: companyName.slice(0, 200), ...data },
    })
    return { status: 200 as const, issuer }
  }, { isolationLevel: 'Serializable' }))
  if (result.status === 403) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  const issuer = result.issuer
  return NextResponse.json({ issuer })
}
