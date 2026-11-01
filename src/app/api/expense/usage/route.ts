export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { privateApiJson } from '@/lib/private-api-response'
import { claimPendingMemberships, getExpenseContext, listMemberships, resolveUserId } from '@/lib/expense/access'

// GET /api/expense/usage — 入口の判定用（所属組織と権限）。?org= があればその組織での権限も返す
export async function GET(req: Request) {
  try {
    const userId = await resolveUserId()
    if (!userId) return privateApiJson({ onboarded: false, memberships: [] }, { status: 401 })
    // 招待されていた組織があれば、ここで本人の所属にする
    await claimPendingMemberships(userId)
    const memberships = await listMemberships()
    const slug = new URL(req.url).searchParams.get('org')?.trim() || undefined
    const ctx = await getExpenseContext(slug)
    return privateApiJson({
      onboarded: memberships.length > 0,
      organization: ctx ? { slug: ctx.organizationSlug } : null,
      role: ctx?.role ?? null,
      memberships,
    })
  } catch {
    console.error('[expense/usage] failed')
    return privateApiJson({ error: '読み込みに失敗しました' }, { status: 500 })
  }
}
