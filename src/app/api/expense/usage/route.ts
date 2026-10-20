export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { claimPendingMemberships, listMemberships, resolveUserId } from '@/lib/expense/access'
import { readExpenseEntryMembership } from '@/lib/expense/entry-read'

// GET /api/expense/usage — 入口の判定用（所属組織と権限）。?org= があればその組織での権限も返す
export async function GET(req: Request) {
  try {
    const userId = await resolveUserId()
    if (!userId) return NextResponse.json({ onboarded: false, memberships: [] }, { status: 401 })
    // 招待されていた組織があれば、ここで本人の所属にする
    await claimPendingMemberships(userId)
    const memberships = await listMemberships()
    const slug = new URL(req.url).searchParams.get('org')?.trim() || undefined
    const target = await readExpenseEntryMembership(userId, slug)
    if (target.state === 'forbidden') return NextResponse.json({ error: 'この組織にアクセスできません' }, { status: 403 })
    return NextResponse.json({
      onboarded: memberships.length > 0,
      organization: target.state === 'found' ? { slug: target.slug } : null,
      role: target.state === 'found' ? target.role : null,
      memberships,
    })
  } catch {
    console.error('[expense/usage] failed')
    return NextResponse.json({ error: '読み込みに失敗しました' }, { status: 500 })
  }
}
