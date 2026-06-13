export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { researchCompany } from '@/lib/shodan/research'
import { draftOwnProfile } from '@/lib/shodan/ai'

function normalizeUrl(input: string): string | null {
  let s = (input || '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

// POST /api/shodan/company-profile/extract — 自社URLを解析して自社情報の下書き＋加筆推奨を返す（保存はしない）
export async function POST(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const url = normalizeUrl(body.url as string)
  if (!url) return NextResponse.json({ error: '有効な自社URLを入力してください' }, { status: 400 })

  try {
    const research = await researchCompany(url)
    const draft = await draftOwnProfile(research)
    return NextResponse.json({
      suggested: {
        companyName: draft.companyName,
        url,
        description: draft.description,
        valueProp: draft.valueProp,
        products: draft.products,
        targetCustomer: draft.targetCustomer,
        pricingNote: draft.pricingNote,
        caseStudies: draft.caseStudies,
      },
      gaps: draft.gaps,
    })
  } catch (e: any) {
    console.error('[shodan/company-profile/extract]', e?.message)
    return NextResponse.json({ error: '自社情報の抽出に失敗しました。URLを確認して再度お試しください。' }, { status: 500 })
  }
}
