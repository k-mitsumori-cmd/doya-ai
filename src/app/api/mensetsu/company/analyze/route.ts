export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/company/analyze — 企業URL調査 → CompanyProfile（F3-1〜F3-3）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { analyzeCompany } from '@/lib/mensetsu/company'

export async function POST(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const url = String(body?.url || '').trim()
  if (!url) return NextResponse.json({ error: '企業URLを入力してください' }, { status: 400 })

  let normalized: string
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol')
    normalized = u.toString()
  } catch {
    return NextResponse.json({ error: 'URLの形式が正しくありません' }, { status: 400 })
  }

  try {
    const { profile, pages } = await analyzeCompany(normalized)

    const saved = await prisma.mensetsuCompanyProfile.create({
      data: {
        organizationId: ctx.organizationId,
        sourceUrl: normalized,
        companyName: profile.companyName || null,
        business: profile.business || null,
        valueProp: profile.valueProp || null,
        culture: profile.culture || null,
        idealProfile: profile.idealProfile || null,
        raw: { pages: pages.map((p) => ({ url: p.url, length: p.text.length })) },
      },
    })

    return NextResponse.json({ profile: saved, pageCount: pages.length })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || '企業サイトの解析に失敗しました' },
      { status: 502 }
    )
  }
}
