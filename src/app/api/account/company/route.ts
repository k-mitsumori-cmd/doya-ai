// ============================================
// アカウントの会社（UI 品質 B-1・B-2）
// ============================================
// GET … 本人の会社と、登録の候補（各ツールの組織の名前）
// PUT … 本人の会社を保存する（{ name, websiteUrl?, industry? }）
// ⚠️ 読み書きするのは、セッションの本人の会社だけ。body や URL の userId は使わない。
// ⚠️ 新しい見た目（src/lib/ui-next.ts）の人だけが使える。それ以外は 404。
// ⚠️ 各ツールの組織の名前は書き換えない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { parseCompanyInput } from '@/lib/shell/company'
import { currentUserId, getOwnCompany, listCompanyCandidates, saveOwnCompany } from '@/lib/shell/company.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

async function guard(): Promise<{ userId: string } | NextResponse> {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'ログインしてください' }, { status: 401, headers: NO_STORE })
  return { userId }
}

export async function GET() {
  const g = await guard()
  if (g instanceof NextResponse) return g
  const [company, candidates] = await Promise.all([
    getOwnCompany(g.userId).catch(() => undefined),
    listCompanyCandidates().catch(() => []),
  ])
  if (company === undefined) {
    return NextResponse.json({ error: '会社情報を読み込めませんでした。時間をおいてもう一度お試しください' }, { status: 503, headers: NO_STORE })
  }
  return NextResponse.json({ company, candidates }, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const g = await guard()
  if (g instanceof NextResponse) return g
  const body = await req.json().catch(() => null)
  const parsed = parseCompanyInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE })
  try {
    const company = await saveOwnCompany(g.userId, parsed.data)
    return NextResponse.json({ company }, { headers: NO_STORE })
  } catch (e) {
    console.error('[account/company] save failed', { name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
    return NextResponse.json({ error: '保存できませんでした。時間をおいてもう一度お試しください' }, { status: 503, headers: NO_STORE })
  }
}
