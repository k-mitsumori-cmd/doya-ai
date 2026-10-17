export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getExpenseContext, listMemberships, resolveUserId } from '@/lib/expense/access'

// GET /api/expense/usage — 入口の判定用（所属組織と権限）。?org= があればその組織での権限も返す
export async function GET(req: Request) {
  try {
    const userId = await resolveUserId()
    if (!userId) return NextResponse.json({ onboarded: false, memberships: [] }, { status: 401 })
    const memberships = await listMemberships()
    const slug = new URL(req.url).searchParams.get('org')?.trim() || undefined
    const ctx = await getExpenseContext(slug)
    return NextResponse.json({
      onboarded: memberships.length > 0,
      organization: ctx ? { slug: ctx.organizationSlug } : null,
      role: ctx?.role ?? null,
      memberships,
    })
  } catch {
    console.error('[expense/usage] failed')
    return NextResponse.json({ error: '読み込みに失敗しました' }, { status: 500 })
  }
}
