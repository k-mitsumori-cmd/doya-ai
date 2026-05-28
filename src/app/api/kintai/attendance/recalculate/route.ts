export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { recalculateAllForOrganization } from '@/lib/kintai/recalculate'

export async function POST() {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const fixed = await recalculateAllForOrganization(ctx.organizationId)

    return NextResponse.json({ message: `${fixed}件の勤怠データを再計算しました`, fixed })
  } catch (error) {
    console.error('[kintai/attendance/recalculate]', error)
    return NextResponse.json({ error: '再計算に失敗しました' }, { status: 500 })
  }
}
